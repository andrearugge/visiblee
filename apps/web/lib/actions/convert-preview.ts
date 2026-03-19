'use server';

import { db } from '@/lib/db';

export async function convertPreview(
  userId: string,
  previewId: string,
): Promise<{ projectId: string }> {
  const preview = await db.previewAnalysis.findUnique({ where: { id: previewId } });
  if (!preview) throw new Error('Preview not found');
  if (preview.convertedAt) throw new Error('Preview already converted');

  const project = await db.project.create({
    data: {
      userId,
      name: preview.brandName,
      brandName: preview.brandName,
      websiteUrl: preview.websiteUrl,
      previewId: preview.id,
      status: 'active',
    },
  });

  if (preview.queryTargets.length > 0) {
    await db.targetQuery.createMany({
      data: preview.queryTargets.map((q) => ({ projectId: project.id, queryText: q })),
    });
  }

  await db.previewAnalysis.update({
    where: { id: previewId },
    data: { userId, projectId: project.id, convertedAt: new Date() },
  });

  // Placeholder job for Phase 3 full analysis
  await db.job.create({
    data: {
      projectId: project.id,
      type: 'full_analysis',
      payload: { projectId: project.id },
    },
  });

  return { projectId: project.id };
}
