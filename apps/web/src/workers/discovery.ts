/**
 * Discovery Worker — standalone process, run with:
 *   npm run worker --workspace=apps/web
 *
 * Picks up jobs from the "discovery" BullMQ queue and:
 *   1. Marks DiscoveryJob as RUNNING
 *   2. Calls the Python engine (crawl / search)
 *   3. Persists results as ContentItems
 *   4. Marks DiscoveryJob as COMPLETED or FAILED
 */

import path from "node:path";
import { createHash } from "node:crypto";
import { config } from "dotenv";

// Load env before any other import that might need env vars
config({ path: path.resolve(process.cwd(), ".env.local") });

import { Worker, Queue } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Prisma, SourcePlatform, ContentType } from "@prisma/client";
// scoring helpers (no @/ alias — relative path for standalone worker process)

// Worker only needs the queue names and types; `import type` is erased at runtime
// so we avoid instantiating the Queues in this process.
import { DISCOVERY_QUEUE_NAME, ANALYSIS_QUEUE_NAME } from "../lib/queue";
import type {
  DiscoveryJobPayload,
  CrawlSitePayload,
  SearchPlatformPayload,
  AnalysisJobPayload,
  ExtractEntitiesPayload,
  GenerateEmbeddingsPayload,
  ClusterTopicsPayload,
  ComputeScorePayload,
  FullAnalysisPayload,
  GenerateContentSuggestionsPayload,
  GenerateBriefsPayload,
} from "../lib/queue";
import { computeScoreDimensions } from "../lib/scoring";
import { generateSuggestions } from "../lib/suggestions";

// ─── Prisma (dedicated client for the worker process) ─────────────────────────

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ─── Audit logging (inline — avoids double Prisma singleton) ─────────────────

async function logAudit(
  action: string,
  actorId: string,
  projectId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        actorId,
        targetId: projectId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error("[worker] Audit log failed:", err);
  }
}

// ─── Notification helper ──────────────────────────────────────────────────────

async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  link: string
): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, type, title, message, link } });
  } catch (err) {
    console.error("[worker] Notification create failed:", err);
  }
}

// ─── Safe DB update (guard against record-not-found on stale jobs) ────────────

async function safeUpdateJob(
  id: string,
  data: Parameters<typeof prisma.discoveryJob.update>[0]["data"]
): Promise<void> {
  try {
    await prisma.discoveryJob.update({ where: { id }, data });
  } catch (err) {
    // P2025 = record not found; ignore silently, log everything else
    const code = (err as { code?: string }).code;
    if (code !== "P2025") console.error("[worker] DB update failed:", err);
  }
}

// ─── Engine config ────────────────────────────────────────────────────────────

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";
const ENGINE_API_KEY = process.env.ENGINE_API_KEY ?? "";

// ─── Schedule helper ──────────────────────────────────────────────────────────

function calcNextRunAt(frequency: string, from: Date): Date {
  const d = new Date(from);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    default:
      d.setDate(d.getDate() + 7);
  }
  return d;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

function detectPlatform(url: string): SourcePlatform {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes("substack.com")) return "SUBSTACK";
    if (host.includes("medium.com")) return "MEDIUM";
    if (host.includes("linkedin.com")) return "LINKEDIN";
    if (host.includes("reddit.com")) return "REDDIT";
    if (host.includes("youtube.com")) return "YOUTUBE";
    if (host.includes("twitter.com") || host.includes("x.com")) return "TWITTER";
  } catch {
    // fall through
  }
  return "WEBSITE";
}

function detectContentType(url: string): ContentType {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (/\/(blog|post|article|news|story|insights?)/.test(pathname)) return "ARTICLE";
  } catch {
    // fall through
  }
  return "PAGE";
}

// ─── Engine response types ────────────────────────────────────────────────────

interface EnginePageResult {
  url: string;
  title: string | null;
  raw_content: string | null;
  word_count: number | null;
  excerpt: string | null;
  published_at: string | null;
}

interface EngineCrawlResponse {
  pages: EnginePageResult[];
  crawled_count: number;
  error_count: number;
  errors: { url: string; error: string }[];
}

interface EngineSearchResult {
  url: string;
  title: string;
  snippet: string | null;
  platform: string;
}

interface EngineSearchResponse {
  results: EngineSearchResult[];
  total_found: number;
  errors: { platform: string; error: string }[];
}

const PLATFORM_TO_SOURCE: Record<string, SourcePlatform> = {
  SUBSTACK: "SUBSTACK",
  MEDIUM: "MEDIUM",
  LINKEDIN: "LINKEDIN",
  REDDIT: "REDDIT",
  YOUTUBE: "YOUTUBE",
  TWITTER: "TWITTER",
  QUORA: "QUORA",
  NEWS: "NEWS",
  WEBSITE: "WEBSITE",
  OTHER: "OTHER",
};

const PLATFORM_TO_CONTENT_TYPE: Record<string, ContentType> = {
  SUBSTACK: "BLOG_POST",
  MEDIUM: "BLOG_POST",
  LINKEDIN: "ARTICLE",
  REDDIT: "SOCIAL_POST",
  YOUTUBE: "VIDEO",
  TWITTER: "SOCIAL_POST",
  QUORA: "COMMENT",
  NEWS: "MENTION",
  WEBSITE: "PAGE",
  OTHER: "ARTICLE",
};

// ─── Job handlers ─────────────────────────────────────────────────────────────

interface CrawlResult {
  crawledCount: number;
  created: number;
  skipped: number;
  engineErrors: number;
}

async function runCrawl(payload: CrawlSitePayload): Promise<CrawlResult> {
  const { projectId, config } = payload;
  const { siteUrl, maxDepth, maxPages, rateLimit } = config;

  const engineRes = await fetch(`${ENGINE_URL}/api/crawl/site`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-engine-api-key": ENGINE_API_KEY,
    },
    body: JSON.stringify({
      url: siteUrl,
      max_depth: maxDepth,
      max_pages: maxPages,
      rate_limit: rateLimit,
    }),
    signal: AbortSignal.timeout(300_000), // 5 min
  });

  if (!engineRes.ok) {
    const detail = await engineRes.json().catch(() => ({}));
    throw new Error(`Engine crawl failed (${engineRes.status}): ${JSON.stringify(detail)}`);
  }

  const data = (await engineRes.json()) as EngineCrawlResponse;
  const sourcePlatform = detectPlatform(siteUrl);

  const items = data.pages.map((p) => ({
    projectId,
    url: p.url,
    title: (p.title ?? p.url).slice(0, 500),
    sourcePlatform,
    contentType: detectContentType(p.url),
    rawContent: p.raw_content ?? null,
    excerpt: p.excerpt ?? null,
    wordCount: p.word_count ?? null,
    publishedAt: p.published_at ? new Date(p.published_at) : null,
    contentHash: hashUrl(p.url),
    discoveryMethod: "AGENT_CRAWL" as const,
    status: "DISCOVERED" as const,
  }));

  const result = await prisma.contentItem.createMany({ data: items, skipDuplicates: true });

  return {
    crawledCount: data.crawled_count,
    created: result.count,
    skipped: items.length - result.count,
    engineErrors: data.error_count,
  };
}

interface SearchResult {
  totalFound: number;
  created: number;
  skipped: number;
  engineErrors: number;
}

async function runSearch(payload: SearchPlatformPayload): Promise<SearchResult> {
  const { projectId, config } = payload;
  const { brand, domain, platforms, maxResultsPerPlatform } = config;

  const engineRes = await fetch(`${ENGINE_URL}/api/search/platform`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-engine-api-key": ENGINE_API_KEY,
    },
    body: JSON.stringify({
      brand,
      domain: domain ?? null,
      platforms,
      max_results_per_platform: maxResultsPerPlatform,
    }),
    signal: AbortSignal.timeout(120_000), // 2 min
  });

  if (!engineRes.ok) {
    const detail = await engineRes.json().catch(() => ({}));
    throw new Error(`Engine search failed (${engineRes.status}): ${JSON.stringify(detail)}`);
  }

  const data = (await engineRes.json()) as EngineSearchResponse;

  const items = data.results.map((r) => ({
    projectId,
    url: r.url,
    title: r.title.slice(0, 500),
    sourcePlatform: (PLATFORM_TO_SOURCE[r.platform] ?? "OTHER") as SourcePlatform,
    contentType: (PLATFORM_TO_CONTENT_TYPE[r.platform] ?? "ARTICLE") as ContentType,
    rawContent: null,
    excerpt: r.snippet ?? null,
    wordCount: null,
    publishedAt: null,
    contentHash: hashUrl(r.url),
    discoveryMethod: "AGENT_SEARCH" as const,
    status: "DISCOVERED" as const,
  }));

  const result = await prisma.contentItem.createMany({ data: items, skipDuplicates: true });

  return {
    totalFound: data.total_found,
    created: result.count,
    skipped: items.length - result.count,
    engineErrors: data.errors.length,
  };
}

// ─── Analysis job helpers ─────────────────────────────────────────────────────

async function safeUpdateAnalysisJob(
  id: string,
  data: Parameters<typeof prisma.analysisJob.update>[0]["data"]
): Promise<void> {
  try {
    await prisma.analysisJob.update({ where: { id }, data });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "P2025") console.error("[worker] Analysis DB update failed:", err);
  }
}

// ─── Engine types for extraction ──────────────────────────────────────────────

interface EngineEntityItem {
  label: string;
  type: string;
  salience: number;
  context: string | null;
}

interface EngineExtractionResult {
  id: string;
  entities: EngineEntityItem[];
  error: string | null;
}

interface EngineExtractResponse {
  results: EngineExtractionResult[];
}

// ─── EXTRACT_ENTITIES handler ─────────────────────────────────────────────────

interface ExtractResult {
  processed: number;
  entitiesFound: number;
  errors: number;
}

async function runExtractEntities(
  payload: ExtractEntitiesPayload
): Promise<ExtractResult> {
  const { projectId } = payload;

  // Fetch APPROVED items with rawContent (max 50 per engine request)
  const items = await prisma.contentItem.findMany({
    where: { projectId, status: "APPROVED", rawContent: { not: null } },
    select: { id: true, title: true, rawContent: true },
    take: 50,
  });

  if (items.length === 0) {
    return { processed: 0, entitiesFound: 0, errors: 0 };
  }

  const engineRes = await fetch(`${ENGINE_URL}/api/extract/entities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-engine-api-key": ENGINE_API_KEY,
    },
    body: JSON.stringify({
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        text: item.rawContent!,
      })),
    }),
    signal: AbortSignal.timeout(600_000), // 10 min (sequential Haiku calls)
  });

  if (!engineRes.ok) {
    const detail = await engineRes.json().catch(() => ({}));
    throw new Error(
      `Engine extract failed (${engineRes.status}): ${JSON.stringify(detail)}`
    );
  }

  const data = (await engineRes.json()) as EngineExtractResponse;
  let entitiesFound = 0;
  let errors = 0;

  for (const result of data.results) {
    if (result.error) {
      errors++;
      continue;
    }

    for (const e of result.entities) {
      const normalizedLabel = e.label.trim().toLowerCase();
      if (!normalizedLabel) continue;

      // Upsert Entity — increment frequency if already seen
      const entity = await prisma.entity.upsert({
        where: {
          projectId_normalizedLabel_type: {
            projectId,
            normalizedLabel,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            type: e.type as any,
          },
        },
        update: { frequency: { increment: 1 } },
        create: {
          projectId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: e.type as any,
          label: e.label.trim(),
          normalizedLabel,
          frequency: 1,
        },
      });

      // Upsert ContentEntity
      await prisma.contentEntity.upsert({
        where: {
          contentId_entityId: { contentId: result.id, entityId: entity.id },
        },
        update: { salience: e.salience, context: e.context },
        create: {
          contentId: result.id,
          entityId: entity.id,
          salience: e.salience,
          context: e.context,
        },
      });

      entitiesFound++;
    }
  }

  return { processed: items.length, entitiesFound, errors };
}

// ─── GENERATE_EMBEDDINGS handler ─────────────────────────────────────────────

interface EmbedItemResponse {
  id: string;
  embedding: number[];
  error: string | null;
}

interface EngineEmbedResponse {
  results: EmbedItemResponse[];
  dimensions: number;
}

interface EmbedResult {
  processed: number;
  errors: number;
}

const EMBED_BATCH_SIZE = 100; // items per engine request

async function runGenerateEmbeddings(
  payload: GenerateEmbeddingsPayload
): Promise<EmbedResult> {
  const { projectId } = payload;

  // Fetch items that have rawContent but no embedding yet.
  // Prisma omits the `embedding` (Unsupported type) from where input — use raw SQL.
  // Note: rawContent has no @map, so the DB column is camelCase and must be quoted.
  const items = await prisma.$queryRawUnsafe<
    { id: string; title: string; rawContent: string }[]
  >(
    `SELECT id, title, "rawContent"
     FROM content_items
     WHERE project_id = $1
       AND "rawContent" IS NOT NULL
       AND embedding IS NULL`,
    projectId
  );

  if (items.length === 0) {
    return { processed: 0, errors: 0 };
  }

  let processed = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < items.length; i += EMBED_BATCH_SIZE) {
    const batch = items.slice(i, i + EMBED_BATCH_SIZE);

    const engineRes = await fetch(`${ENGINE_URL}/api/embed/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-engine-api-key": ENGINE_API_KEY,
      },
      body: JSON.stringify({
        items: batch.map((item) => ({
          id: item.id,
          // Combine title + content for richer embedding
          text: `${item.title}. ${(item.rawContent ?? "").slice(0, 3500)}`,
        })),
      }),
      signal: AbortSignal.timeout(300_000), // 5 min per batch
    });

    if (!engineRes.ok) {
      const detail = await engineRes.json().catch(() => ({}));
      throw new Error(
        `Engine embed failed (${engineRes.status}): ${JSON.stringify(detail)}`
      );
    }

    const data = (await engineRes.json()) as EngineEmbedResponse;

    for (const result of data.results) {
      if (result.error || result.embedding.length === 0) {
        errors++;
        continue;
      }

      // pgvector requires raw SQL since Prisma doesn't support the vector type
      const embeddingStr = `[${result.embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE content_items SET embedding = $1::vector WHERE id = $2`,
        embeddingStr,
        result.id
      );
      processed++;
    }
  }

  return { processed, errors };
}

// ─── CLUSTER_TOPICS handler ───────────────────────────────────────────────────

interface EngineClusterAssignment {
  id: string;
  cluster_idx: number;
  topic_label: string;
  confidence: number;
}

interface EngineClusterResponse {
  assignments: EngineClusterAssignment[];
  clusters_found: number;
  error: string | null;
}

interface ClusterTopicsResult {
  clustersFound: number;
  itemsClustered: number;
  errors: number;
}

async function runClusterTopics(
  payload: ClusterTopicsPayload
): Promise<ClusterTopicsResult> {
  const { projectId } = payload;

  // Fetch items with embeddings — cast to text since Prisma omits Unsupported fields
  const rows = await prisma.$queryRawUnsafe<
    { id: string; title: string; embedding: string }[]
  >(
    `SELECT id, title, embedding::text AS embedding
     FROM content_items
     WHERE project_id = $1
       AND embedding IS NOT NULL`,
    projectId
  );

  if (rows.length === 0) {
    return { clustersFound: 0, itemsClustered: 0, errors: 0 };
  }

  // pgvector returns "[x,y,z,...]" which is valid JSON
  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    embedding: JSON.parse(r.embedding) as number[],
  }));

  const engineRes = await fetch(`${ENGINE_URL}/api/analyze/topics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-engine-api-key": ENGINE_API_KEY,
    },
    body: JSON.stringify({
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        embedding: item.embedding,
      })),
    }),
    signal: AbortSignal.timeout(300_000), // 5 min (KMeans + LLM labeling)
  });

  if (!engineRes.ok) {
    const detail = await engineRes.json().catch(() => ({}));
    throw new Error(
      `Engine cluster failed (${engineRes.status}): ${JSON.stringify(detail)}`
    );
  }

  const data = (await engineRes.json()) as EngineClusterResponse;

  if (data.error) {
    // Soft error from engine (e.g. not enough items)
    console.warn(`[worker] Cluster topics soft error: ${data.error}`);
    return { clustersFound: 0, itemsClustered: 0, errors: 1 };
  }

  if (data.assignments.length === 0) {
    return { clustersFound: 0, itemsClustered: 0, errors: 0 };
  }

  // Remove existing TOPIC entities for this project (cascades ContentEntity)
  await prisma.entity.deleteMany({ where: { projectId, type: "TOPIC" } });

  // Deduplicate labels and create Entity records
  const uniqueLabels = [...new Set(data.assignments.map((a) => a.topic_label))];
  const labelToEntityId = new Map<string, string>();

  for (const label of uniqueLabels) {
    const entity = await prisma.entity.create({
      data: {
        projectId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: "TOPIC" as any,
        label,
        normalizedLabel: label.trim().toLowerCase(),
        frequency: 0,
      },
    });
    labelToEntityId.set(label, entity.id);
  }

  // Create ContentEntity + increment frequency per assignment
  let itemsClustered = 0;

  for (const assignment of data.assignments) {
    const entityId = labelToEntityId.get(assignment.topic_label);
    if (!entityId) continue;

    await prisma.contentEntity.create({
      data: {
        contentId: assignment.id,
        entityId,
        salience: assignment.confidence,
      },
    });

    await prisma.entity.update({
      where: { id: entityId },
      data: { frequency: { increment: 1 } },
    });

    itemsClustered++;
  }

  return { clustersFound: data.clusters_found, itemsClustered, errors: 0 };
}

// ─── COMPUTE_SCORE handler ────────────────────────────────────────────────────

import type { ScoreDimensions } from "../lib/scoring";

interface ComputeScoreResult {
  overall: number;
  dimensions: ScoreDimensions;
  suggestionsCount: number;
}

async function runComputeScore(payload: ComputeScorePayload): Promise<ComputeScoreResult> {
  const { projectId } = payload;

  // Get project name for suggestions prompt
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  const scoreResult = await computeScoreDimensions(projectId, prisma);
  const suggestions = await generateSuggestions(
    project?.name ?? "",
    scoreResult.dimensions
  );

  // Upsert ProjectScore (idempotent)
  // dimensions/suggestions must be cast to InputJsonValue for Prisma JsonB
  await prisma.projectScore.upsert({
    where: { projectId },
    create: {
      projectId,
      overallScore: scoreResult.overall,
      dimensions: scoreResult.dimensions as unknown as Prisma.InputJsonValue,
      suggestions: suggestions as unknown as Prisma.InputJsonValue,
      contentCount: scoreResult.contentCount,
      isStale: false,
      computedAt: new Date(),
    },
    update: {
      overallScore: scoreResult.overall,
      dimensions: scoreResult.dimensions as unknown as Prisma.InputJsonValue,
      suggestions: suggestions as unknown as Prisma.InputJsonValue,
      contentCount: scoreResult.contentCount,
      isStale: false,
      computedAt: new Date(),
    },
  });

  return {
    overall: scoreResult.overall,
    dimensions: scoreResult.dimensions,
    suggestionsCount: suggestions.length,
  };
}

// ─── GENERATE_CONTENT_SUGGESTIONS handler ─────────────────────────────────────

interface ContentSuggestionResult {
  processed: number;
  skipped: number;
  errors: number;
}

const SUGGESTIONS_BATCH_SIZE = 50;
const SUGGESTIONS_MAX_AGE_DAYS = 7;

async function runGenerateContentSuggestions(
  payload: GenerateContentSuggestionsPayload
): Promise<ContentSuggestionResult> {
  const { projectId } = payload;

  // Fetch project name for prompt context
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  const projectName = project?.name ?? "Progetto";

  // Fetch APPROVED items with rawContent that either have no suggestion or
  // whose suggestion is older than SUGGESTIONS_MAX_AGE_DAYS
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SUGGESTIONS_MAX_AGE_DAYS);

  const itemsRaw = await prisma.$queryRawUnsafe<
    { id: string; title: string; rawContent: string }[]
  >(
    `SELECT ci.id, ci.title, ci."rawContent"
     FROM content_items ci
     LEFT JOIN content_suggestions cs ON cs.content_id = ci.id
     WHERE ci.project_id = $1
       AND ci.status = 'APPROVED'
       AND ci."rawContent" IS NOT NULL
       AND (cs.id IS NULL OR cs.generated_at < $2)
     ORDER BY ci.created_at DESC
     LIMIT $3`,
    projectId,
    cutoff,
    SUGGESTIONS_BATCH_SIZE
  );

  if (itemsRaw.length === 0) {
    return { processed: 0, skipped: 0, errors: 0 };
  }

  // Fetch entity labels per content item for richer prompt context
  const contentIds = itemsRaw.map((r) => r.id);
  const entityRows = await prisma.contentEntity.findMany({
    where: { contentId: { in: contentIds } },
    include: { entity: { select: { label: true } } },
    orderBy: { salience: "desc" },
  });
  const entitiesByContent: Record<string, string[]> = {};
  for (const row of entityRows) {
    if (!entitiesByContent[row.contentId]) entitiesByContent[row.contentId] = [];
    entitiesByContent[row.contentId].push(row.entity.label);
  }

  let processed = 0;
  let errors = 0;

  for (const item of itemsRaw) {
    try {
      const entities = (entitiesByContent[item.id] ?? []).slice(0, 10);

      const engineRes = await fetch(`${ENGINE_URL}/api/analyze/content-suggestion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-engine-api-key": ENGINE_API_KEY,
        },
        body: JSON.stringify({
          id: item.id,
          title: item.title,
          text: (item.rawContent ?? "").slice(0, 3000),
          entities,
          project_name: projectName,
        }),
        signal: AbortSignal.timeout(30_000), // 30s per item
      });

      if (!engineRes.ok) {
        console.warn(`[worker] Content suggestion failed for ${item.id}: HTTP ${engineRes.status}`);
        errors++;
        continue;
      }

      const data = (await engineRes.json()) as { id: string; suggestions: string[] };

      if (data.suggestions.length === 0) {
        errors++;
        continue;
      }

      const now = new Date();
      await prisma.contentSuggestion.upsert({
        where: { contentId: item.id },
        update: {
          suggestions: data.suggestions,
          generatedAt: now,
          updatedAt: now,
        },
        create: {
          contentId: item.id,
          projectId,
          suggestions: data.suggestions,
          generatedAt: now,
        },
      });

      processed++;
    } catch (err) {
      console.warn(
        `[worker] Content suggestion error for ${item.id}:`,
        err instanceof Error ? err.message : String(err)
      );
      errors++;
    }
  }

  return { processed, skipped: itemsRaw.length - processed - errors, errors };
}

// ─── GENERATE_BRIEFS handler ──────────────────────────────────────────────────

const KEY_PLATFORMS_WORKER = new Set(["WEBSITE", "LINKEDIN", "MEDIUM", "SUBSTACK", "YOUTUBE", "NEWS"]);

const PLATFORM_LABELS_WORKER: Record<string, string> = {
  WEBSITE: "Website", SUBSTACK: "Substack", MEDIUM: "Medium",
  LINKEDIN: "LinkedIn", REDDIT: "Reddit", QUORA: "Quora",
  YOUTUBE: "YouTube", TWITTER: "Twitter / X", NEWS: "News", OTHER: "Altro",
};

interface BriefsResult {
  briefsGenerated: number;
  skipped: number;
  errors: number;
}

interface GapEntry {
  gapType: string;
  gapLabel: string;
  platform: string;
  severity: "critical" | "warning";
}

async function runGenerateBriefs(
  payload: GenerateBriefsPayload
): Promise<BriefsResult> {
  const { projectId } = payload;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  const projectName = project?.name ?? "Progetto";

  const now = new Date();
  const sixMonthsAgo = new Date(now); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const twelveMonthsAgo = new Date(now); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // ── Fetch all data needed for gap analysis ──
  const [
    byPlatform,
    rawTopics,
    rawEntities,
    approvedCount,
    freshCount,
    staleCount,
    totalWithDateCount,
    topEntities,
    recentTitlesRaw,
  ] = await Promise.all([
    prisma.contentItem.groupBy({
      by: ["sourcePlatform"],
      where: { projectId },
      _count: { _all: true },
    }),
    prisma.entity.findMany({
      where: { projectId, type: "TOPIC" },
      orderBy: { frequency: "desc" },
      select: { label: true, frequency: true },
    }),
    prisma.entity.findMany({
      where: { projectId, NOT: { type: "TOPIC" } },
      orderBy: { frequency: "desc" },
      take: 10,
      select: { label: true, type: true, frequency: true },
    }),
    prisma.contentItem.count({ where: { projectId, status: "APPROVED" } }),
    prisma.contentItem.count({ where: { projectId, publishedAt: { gte: sixMonthsAgo } } }),
    prisma.contentItem.count({ where: { projectId, publishedAt: { lt: twelveMonthsAgo } } }),
    prisma.contentItem.count({ where: { projectId, publishedAt: { not: null } } }),
    prisma.entity.findMany({
      where: { projectId, NOT: { type: "TOPIC" } },
      orderBy: { frequency: "desc" },
      take: 10,
      select: { label: true },
    }),
    prisma.contentItem.findMany({
      where: { projectId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { title: true },
    }),
  ]);

  const topEntityLabels = topEntities.map((e) => e.label);
  const existingTitles = recentTitlesRaw.map((t) => t.title);
  const platformsWithContent = new Set(byPlatform.map((r) => r.sourcePlatform as string));

  // ── Build gaps (mirrors gap-analysis-card.tsx logic) ──
  const gaps: GapEntry[] = [];

  // 1. Missing key platforms
  for (const platform of KEY_PLATFORMS_WORKER) {
    if (!platformsWithContent.has(platform)) {
      gaps.push({
        gapType: "PLATFORM",
        gapLabel: PLATFORM_LABELS_WORKER[platform] ?? platform,
        platform,
        severity: "warning",
      });
    }
  }

  // 2. Weak platform presence (≤ 2 content items on key platform)
  for (const r of byPlatform) {
    const p = r.sourcePlatform as string;
    if (KEY_PLATFORMS_WORKER.has(p) && r._count._all <= 2) {
      gaps.push({
        gapType: "PLATFORM",
        gapLabel: PLATFORM_LABELS_WORKER[p] ?? p,
        platform: p,
        severity: "warning",
      });
    }
  }

  // 3. Thin topic clusters
  for (const t of rawTopics.filter((t) => t.frequency < 3)) {
    gaps.push({
      gapType: "TOPIC",
      gapLabel: t.label,
      platform: "WEBSITE",
      severity: t.frequency <= 1 ? "critical" : "warning",
    });
  }

  // 4. Low-coverage entities (only when ≥ 5 approved)
  if (approvedCount >= 5) {
    for (const e of rawEntities
      .filter(
        (e) =>
          ["BRAND", "PERSON", "ORGANIZATION", "PRODUCT"].includes(e.type) &&
          e.frequency / approvedCount < 0.25
      )
      .slice(0, 3)) {
      const pct = Math.round((e.frequency / approvedCount) * 100);
      gaps.push({
        gapType: "ENTITY",
        gapLabel: e.label,
        platform: "WEBSITE",
        severity: pct < 10 ? "critical" : "warning",
      });
    }
  }

  // 5. Freshness gaps
  if (totalWithDateCount > 0) {
    const stalePct = Math.round((staleCount / totalWithDateCount) * 100);
    if (stalePct > 50) {
      gaps.push({ gapType: "FRESHNESS", gapLabel: "Contenuto datato (>50%)", platform: "WEBSITE", severity: "critical" });
    } else if (stalePct > 25) {
      gaps.push({ gapType: "FRESHNESS", gapLabel: "Parte del contenuto è datata", platform: "WEBSITE", severity: "warning" });
    }
    if (freshCount === 0) {
      gaps.push({ gapType: "FRESHNESS", gapLabel: "Nessun contenuto recente", platform: "WEBSITE", severity: "critical" });
    } else if (freshCount < 3 && approvedCount >= 5) {
      gaps.push({ gapType: "FRESHNESS", gapLabel: "Pochi contenuti recenti", platform: "WEBSITE", severity: "warning" });
    }
  }

  if (gaps.length === 0) {
    return { briefsGenerated: 0, skipped: 0, errors: 0 };
  }

  let briefsGenerated = 0;
  let skipped = 0;
  let errors = 0;

  for (const gap of gaps) {
    // Check if a non-REJECTED brief already exists for this gap
    const existing = await prisma.contentBrief.findUnique({
      where: { projectId_gapType_gapLabel: { projectId, gapType: gap.gapType, gapLabel: gap.gapLabel } },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== "REJECTED") {
      skipped++;
      continue;
    }

    try {
      const engineRes = await fetch(`${ENGINE_URL}/api/analyze/content-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-engine-api-key": ENGINE_API_KEY },
        body: JSON.stringify({
          gap_type: gap.gapType,
          gap_label: gap.gapLabel,
          top_entities: topEntityLabels,
          existing_titles: existingTitles,
          platform: gap.platform,
          project_name: projectName,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!engineRes.ok) {
        console.warn(`[worker] Brief generation failed for gap "${gap.gapLabel}": HTTP ${engineRes.status}`);
        errors++;
        continue;
      }

      const data = (await engineRes.json()) as {
        title: string;
        key_points: string[];
        entities: string[];
        target_word_count: number | null;
        notes: string | null;
      };

      const generatedAt = new Date();
      await prisma.contentBrief.upsert({
        where: { projectId_gapType_gapLabel: { projectId, gapType: gap.gapType, gapLabel: gap.gapLabel } },
        update: {
          title: data.title,
          platform: gap.platform as SourcePlatform,
          keyPoints: data.key_points as unknown as Prisma.InputJsonValue,
          entities: data.entities as unknown as Prisma.InputJsonValue,
          targetWordCount: data.target_word_count ?? null,
          notes: data.notes ?? null,
          status: "PENDING",
          generatedAt,
          updatedAt: generatedAt,
        },
        create: {
          projectId,
          title: data.title,
          platform: gap.platform as SourcePlatform,
          gapType: gap.gapType,
          gapLabel: gap.gapLabel,
          keyPoints: data.key_points as unknown as Prisma.InputJsonValue,
          entities: data.entities as unknown as Prisma.InputJsonValue,
          targetWordCount: data.target_word_count ?? null,
          notes: data.notes ?? null,
          generatedAt,
        },
      });

      briefsGenerated++;
    } catch (err) {
      console.warn(
        `[worker] Brief error for gap "${gap.gapLabel}":`,
        err instanceof Error ? err.message : String(err)
      );
      errors++;
    }
  }

  return { briefsGenerated, skipped, errors };
}

// ─── FULL_ANALYSIS handler ────────────────────────────────────────────────────

const MIN_EMBEDDINGS_FOR_CLUSTER = 6;

interface FullAnalysisResult {
  extract: ExtractResult;
  embed: EmbedResult;
  cluster: (ClusterTopicsResult & { skipped?: boolean }) | null;
  score: ComputeScoreResult;
}

async function runFullAnalysis(
  payload: FullAnalysisPayload
): Promise<FullAnalysisResult> {
  const { projectId } = payload;

  // Step 1: Extract entities — abort if fails
  const extract = await runExtractEntities({
    ...payload,
    jobType: "EXTRACT_ENTITIES",
  });

  // Step 2: Generate embeddings — abort if fails
  const embed = await runGenerateEmbeddings({
    ...payload,
    jobType: "GENERATE_EMBEDDINGS",
  });

  // Step 3: Cluster topics — skip if < MIN_EMBEDDINGS_FOR_CLUSTER; don't abort if fails
  let cluster: (ClusterTopicsResult & { skipped?: boolean }) | null = null;
  const rows = await prisma.$queryRawUnsafe<[{ count: string }]>(
    `SELECT COUNT(*)::text AS count FROM content_items WHERE project_id = $1 AND embedding IS NOT NULL`,
    projectId
  );
  const embeddedCount = parseInt(rows[0]?.count ?? "0", 10);

  if (embeddedCount < MIN_EMBEDDINGS_FOR_CLUSTER) {
    console.log(
      `[worker] FULL_ANALYSIS: only ${embeddedCount} embeddings, skipping cluster (min ${MIN_EMBEDDINGS_FOR_CLUSTER})`
    );
    cluster = { clustersFound: 0, itemsClustered: 0, errors: 0, skipped: true };
  } else {
    try {
      cluster = await runClusterTopics({ ...payload, jobType: "CLUSTER_TOPICS" });
    } catch (err) {
      console.warn(
        "[worker] FULL_ANALYSIS: cluster step failed, continuing with score:",
        err instanceof Error ? err.message : String(err)
      );
      cluster = { clustersFound: 0, itemsClustered: 0, errors: 1, skipped: false };
    }
  }

  // Step 4: Compute score — always runs
  const score = await runComputeScore({ ...payload, jobType: "COMPUTE_SCORE" });

  return { extract, embed, cluster, score };
}

// ─── Redis connection ─────────────────────────────────────────────────────────

const redisConnection = (() => {
  const url = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: Number(parsed.port) || 6379,
      password: parsed.password || undefined,
      db: Number(parsed.pathname.slice(1)) || 0,
      // Upstash and other TLS Redis providers use rediss:// scheme
      tls: url.startsWith("rediss://") ? {} : undefined,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
})();

// ─── Worker ───────────────────────────────────────────────────────────────────

const worker = new Worker<DiscoveryJobPayload>(
  DISCOVERY_QUEUE_NAME,
  async (job) => {
    const payload = job.data;
    const { discoveryJobId, projectId, userId } = payload;

    console.log(
      `[worker] Starting job ${job.id} — type: ${payload.jobType}, discoveryJobId: ${discoveryJobId}`
    );

    // Mark as RUNNING
    await safeUpdateJob(discoveryJobId, { status: "RUNNING", startedAt: new Date() });
    await logAudit("discovery.job.started", userId, projectId, { jobType: payload.jobType, discoveryJobId });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resultSummary: Record<string, any>;

      if (payload.jobType === "CRAWL_SITE") {
        resultSummary = await runCrawl(payload);
      } else if (payload.jobType === "SEARCH_PLATFORM") {
        resultSummary = await runSearch(payload);
      } else {
        // FULL_DISCOVERY — optional crawl + search
        const { config } = payload;
        let crawlResult: CrawlResult | null = null;

        if (config.crawl) {
          crawlResult = await runCrawl({
            jobType: "CRAWL_SITE",
            projectId,
            userId,
            discoveryJobId,
            config: config.crawl,
          });
        }

        const searchResult = await runSearch({
          jobType: "SEARCH_PLATFORM",
          projectId,
          userId,
          discoveryJobId,
          config: {
            brand: config.brand,
            domain: config.domain,
            platforms: config.platforms,
            maxResultsPerPlatform: config.maxResultsPerPlatform,
          },
        });

        resultSummary = {
          crawl: crawlResult,
          search: searchResult,
          totalCreated: (crawlResult?.created ?? 0) + searchResult.created,
        };
      }

      await safeUpdateJob(discoveryJobId, {
        status: "COMPLETED",
        completedAt: new Date(),
        resultSummary: resultSummary as Prisma.InputJsonValue,
      });
      await logAudit("discovery.job.completed", userId, projectId, {
        jobType: payload.jobType,
        discoveryJobId,
        ...resultSummary,
      });

      // Send notification to project owner
      const notifProject = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      });
      if (notifProject) {
        const foundCount =
          payload.jobType === "CRAWL_SITE"
            ? (resultSummary as CrawlResult).created
            : payload.jobType === "SEARCH_PLATFORM"
            ? (resultSummary as SearchResult).created
            : (resultSummary as { totalCreated: number }).totalCreated;
        await createNotification(
          userId,
          "discovery",
          "Discovery completata",
          `La discovery per "${notifProject.name}" è terminata con ${foundCount} contenuti trovati.`,
          `/projects/${projectId}/content/discovery`
        );
      }

      console.log(`[worker] Job ${job.id} completed:`, JSON.stringify(resultSummary));
    } catch (err) {
      const isEngineDown =
        err instanceof Error &&
        (err.message.includes("fetch failed") ||
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("Engine crawl failed") ||
          err.message.includes("Engine search failed"));

      const message = isEngineDown
        ? `Engine non raggiungibile: ${err instanceof Error ? err.message : String(err)}`
        : err instanceof Error
        ? err.message
        : String(err);

      console.error(`[worker] Job ${job.id} failed:`, message);

      await safeUpdateJob(discoveryJobId, {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message,
      });
      await logAudit("discovery.job.failed", userId, projectId, {
        jobType: payload.jobType,
        discoveryJobId,
        error: message,
      });

      throw err; // re-throw so BullMQ marks the job as failed
    }
  },
  { connection: redisConnection, concurrency: 2 }
);

worker.on("completed", (job) => console.log(`[worker] ✓ Job ${job.id} done`));
worker.on("failed", (job, err) =>
  console.error(`[worker] ✗ Job ${job?.id} failed:`, err.message)
);

console.log(`[worker] Discovery worker started — queue: ${DISCOVERY_QUEUE_NAME}`);

// ─── Analysis Worker ──────────────────────────────────────────────────────────

const analysisWorker = new Worker<AnalysisJobPayload>(
  ANALYSIS_QUEUE_NAME,
  async (job) => {
    const payload = job.data;
    const { analysisJobId, projectId, userId } = payload;

    console.log(
      `[worker] Starting analysis job ${job.id} — type: ${payload.jobType}, analysisJobId: ${analysisJobId}`
    );

    await safeUpdateAnalysisJob(analysisJobId, {
      status: "RUNNING",
      startedAt: new Date(),
    });
    await logAudit("analysis.job.started", userId, projectId, {
      jobType: payload.jobType,
      analysisJobId,
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let resultSummary: Record<string, any>;

      if (payload.jobType === "EXTRACT_ENTITIES") {
        resultSummary = await runExtractEntities(payload);
      } else if (payload.jobType === "GENERATE_EMBEDDINGS") {
        resultSummary = await runGenerateEmbeddings(payload);
      } else if (payload.jobType === "CLUSTER_TOPICS") {
        resultSummary = await runClusterTopics(payload);
      } else if (payload.jobType === "COMPUTE_SCORE") {
        resultSummary = await runComputeScore(payload);
      } else if (payload.jobType === "FULL_ANALYSIS") {
        resultSummary = await runFullAnalysis(payload);
      } else if (payload.jobType === "GENERATE_CONTENT_SUGGESTIONS") {
        resultSummary = await runGenerateContentSuggestions(payload);
      } else if (payload.jobType === "GENERATE_BRIEFS") {
        resultSummary = await runGenerateBriefs(payload);
      } else {
        throw new Error(`Unknown analysis job type: ${(payload as { jobType: string }).jobType}`);
      }

      await safeUpdateAnalysisJob(analysisJobId, {
        status: "COMPLETED",
        completedAt: new Date(),
        resultSummary: resultSummary as Prisma.InputJsonValue,
      });
      await logAudit("analysis.job.completed", userId, projectId, {
        jobType: payload.jobType,
        analysisJobId,
        ...resultSummary,
      });

      // Send notification for relevant job types
      if (
        payload.jobType === "FULL_ANALYSIS" ||
        payload.jobType === "GENERATE_BRIEFS"
      ) {
        const notifProject = await prisma.project.findUnique({
          where: { id: projectId },
          select: { name: true },
        });
        if (notifProject) {
          if (payload.jobType === "FULL_ANALYSIS") {
            await createNotification(
              userId,
              "analysis",
              "Analisi AI completata",
              `L'analisi di "${notifProject.name}" è completata. Score aggiornato.`,
              `/projects/${projectId}/analysis`
            );
          } else {
            const briefCount = (resultSummary as BriefsResult).briefsGenerated;
            await createNotification(
              userId,
              "briefs",
              "Brief generati",
              `${briefCount} brief generati per "${notifProject.name}".`,
              `/projects/${projectId}/briefs`
            );
          }
        }
      }

      console.log(
        `[worker] Analysis job ${job.id} completed:`,
        JSON.stringify(resultSummary)
      );
    } catch (err) {
      const isEngineDown =
        err instanceof Error &&
        (err.message.includes("fetch failed") ||
          err.message.includes("ECONNREFUSED") ||
          err.message.includes("Engine extract failed") ||
          err.message.includes("Engine embed failed") ||
          err.message.includes("Engine cluster failed") ||
          err.message.includes("Engine analyze failed"));

      const message = isEngineDown
        ? `Engine non raggiungibile: ${err instanceof Error ? err.message : String(err)}`
        : err instanceof Error
        ? err.message
        : String(err);

      console.error(`[worker] Analysis job ${job.id} failed:`, message);

      await safeUpdateAnalysisJob(analysisJobId, {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: message,
      });
      await logAudit("analysis.job.failed", userId, projectId, {
        jobType: payload.jobType,
        analysisJobId,
        error: message,
      });

      throw err;
    }
  },
  { connection: redisConnection, concurrency: 1 }
);

analysisWorker.on("completed", (job) =>
  console.log(`[worker] ✓ Analysis job ${job.id} done`)
);
analysisWorker.on("failed", (job, err) =>
  console.error(`[worker] ✗ Analysis job ${job?.id} failed:`, err.message)
);

console.log(`[worker] Analysis worker started — queue: ${ANALYSIS_QUEUE_NAME}`);

// ─── Maintenance queue (scheduled jobs) ──────────────────────────────────────

const MAINTENANCE_QUEUE_NAME = "maintenance";

const maintenanceQueue = new Queue(MAINTENANCE_QUEUE_NAME, {
  connection: redisConnection,
});

// Local queue reference used by the maintenance worker to enqueue discovery jobs
const localDiscoveryQueue = new Queue<DiscoveryJobPayload>(DISCOVERY_QUEUE_NAME, {
  connection: redisConnection,
});

const maintenanceWorker = new Worker(
  MAINTENANCE_QUEUE_NAME,
  async (job) => {
    if (job.name === "CLEANUP_AUDIT_LOGS") {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const { count } = await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      console.log(`[maintenance] Deleted ${count} audit log${count === 1 ? "" : "s"} older than 7 days`);
    }

    if (job.name === "CHECK_DISCOVERY_SCHEDULES") {
      const now = new Date();
      const dueSchedules = await prisma.discoverySchedule.findMany({
        where: { enabled: true, nextRunAt: { lte: now } },
      });

      for (const schedule of dueSchedules) {
        try {
          // Create the DiscoveryJob record
          const dbJob = await prisma.discoveryJob.create({
            data: {
              projectId: schedule.projectId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              jobType: schedule.jobType as any,
              status: "PENDING",
              config: schedule.config as Prisma.InputJsonValue,
            },
          });

          // Enqueue to discovery queue
          await localDiscoveryQueue.add(schedule.jobType, {
            jobType: schedule.jobType,
            projectId: schedule.projectId,
            userId: schedule.userId,
            discoveryJobId: dbJob.id,
            config: schedule.config,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);

          // Advance nextRunAt
          const next = calcNextRunAt(schedule.frequency, now);
          await prisma.discoverySchedule.update({
            where: { id: schedule.id },
            data: { lastRunAt: now, nextRunAt: next },
          });

          console.log(
            `[maintenance] Enqueued scheduled ${schedule.jobType} for project ${schedule.projectId} (${schedule.frequency}) — next: ${next.toISOString()}`
          );
        } catch (err) {
          console.error(
            `[maintenance] Failed to enqueue schedule ${schedule.id}:`,
            err instanceof Error ? err.message : String(err)
          );
        }
      }
    }
  },
  { connection: redisConnection }
);

maintenanceWorker.on("failed", (job, err) =>
  console.error(`[maintenance] ✗ Job ${job?.id} failed:`, err.message)
);

// Schedule daily cleanup at 03:00 server time.
// The stable jobId prevents duplicate schedules across worker restarts.
(async () => {
  await maintenanceQueue.add(
    "CLEANUP_AUDIT_LOGS",
    {},
    {
      repeat: { pattern: "0 3 * * *" },
      jobId: "cleanup-audit-logs-daily",
    }
  );

  // Check discovery schedules every hour.
  await maintenanceQueue.add(
    "CHECK_DISCOVERY_SCHEDULES",
    {},
    {
      repeat: { pattern: "0 * * * *" },
      jobId: "check-discovery-schedules-hourly",
    }
  );

  console.log("[worker] Maintenance worker started — audit log cleanup @ 03:00 daily, discovery schedule check @ every hour");
})();

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown() {
  console.log("[worker] Shutting down...");
  await worker.close();
  await analysisWorker.close();
  await maintenanceWorker.close();
  await maintenanceQueue.close();
  await localDiscoveryQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
