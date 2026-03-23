from __future__ import annotations

"""
Email sending via MailerSend — preview report emails.
"""

import logging

from mailersend import Email, EmailBuilder, MailerSendClient

from .config import config

log = logging.getLogger(__name__)


def _score_bar(value: float, width: int = 120) -> str:
    """Render an inline HTML progress bar for a 0–1 score."""
    pct = round(value * 100)
    if pct >= 70:
        color = "#22c55e"
    elif pct >= 40:
        color = "#f59e0b"
    else:
        color = "#ef4444"
    filled = round(width * value)
    return (
        f'<div style="display:inline-block;width:{width}px;height:8px;'
        f'background:#f4f4f5;border-radius:4px;overflow:hidden;vertical-align:middle;">'
        f'<div style="width:{filled}px;height:100%;background:{color};border-radius:4px;"></div>'
        f"</div>"
        f'<span style="margin-left:8px;font-size:13px;font-weight:600;'
        f'color:#18181b;font-variant-numeric:tabular-nums;">{pct}</span>'
    )


def _build_html(
    brand_name: str,
    website_url: str,
    ai_readiness_score: float,
    fanout_coverage_score: float,
    citation_power_score: float,
    extractability_score: float,
    entity_authority_score: float,
    source_authority_score: float,
    insights: list[str],
    preview_id: str,
    language: str,
    app_url: str,
) -> str:
    ai_score = round(ai_readiness_score * 100)

    if language == "it":
        subject_scores = [
            ("Query Reach", fanout_coverage_score),
            ("Citation Power", citation_power_score),
            ("Extractability", extractability_score),
            ("Brand Authority", entity_authority_score),
            ("Source Authority", source_authority_score),
        ]
    else:
        subject_scores = [
            ("Query Reach", fanout_coverage_score),
            ("Citation Power", citation_power_score),
            ("Extractability", extractability_score),
            ("Brand Authority", entity_authority_score),
            ("Source Authority", source_authority_score),
        ]

    if language == "it":
        t = {
            "headline": f"Il tuo AI Readiness Report per {brand_name}",
            "intro": f"Abbiamo analizzato <strong>{website_url}</strong> e calcolato il tuo punteggio di visibilità AI.",
            "score_label": "AI Readiness Score",
            "score_desc": "Punteggio complessivo basato su 5 dimensioni",
            "breakdown_title": "Dettaglio punteggi",
            "insights_title": "Insight principali",
            "view_report_text": "Visualizza il tuo report →",
            "upgrade_text": "Registrati per l'analisi completa →",
            "upgrade_desc": "Accedi all'inventario completo dei contenuti, ai punteggi per pagina e a una roadmap di miglioramento prioritizzata.",
            "footer": "Hai ricevuto questa email perché hai richiesto il report da Visiblee.",
        }
    else:
        t = {
            "headline": f"Your AI Readiness Report for {brand_name}",
            "intro": f"We analyzed <strong>{website_url}</strong> and calculated your AI visibility score.",
            "score_label": "AI Readiness Score",
            "score_desc": "Overall score based on 5 dimensions",
            "breakdown_title": "Score breakdown",
            "insights_title": "Key insights",
            "view_report_text": "View your full report →",
            "upgrade_text": "Sign up for the full analysis →",
            "upgrade_desc": "Access your complete content inventory, per-page scores, and a prioritized improvement roadmap.",
            "footer": "You received this email because you requested a report from Visiblee.",
        }

    score_rows = "".join(
        f"""
        <tr>
          <td style="padding:10px 0;width:130px;font-size:13px;color:#52525b;font-weight:500;">{label}</td>
          <td style="padding:10px 0;">{_score_bar(val)}</td>
        </tr>
        """
        for label, val in subject_scores
    )

    insight_items = "".join(
        f'<li style="margin-bottom:8px;font-size:14px;color:#3f3f46;line-height:1.5;">{ins}</li>'
        for ins in insights
    ) if insights else ""

    insights_section = (
        f"""
        <tr><td colspan="2" style="padding-top:28px;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:600;text-transform:uppercase;
                    letter-spacing:.08em;color:#a1a1aa;">{t["insights_title"]}</p>
          <ul style="margin:0;padding-left:20px;">{insight_items}</ul>
        </td></tr>
        """
        if insight_items
        else ""
    )

    preview_url = f"{app_url}/preview/{preview_id}"
    register_url = f"{app_url}/register?preview={preview_id}"

    return f"""
<!DOCTYPE html>
<html lang="{language}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9f9f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f8;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;
             border:1px solid #e4e4e7;overflow:hidden;max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #f4f4f5;">
            <p style="margin:0 0 4px;font-size:13px;color:#a1a1aa;font-weight:500;">Visiblee</p>
            <h1 style="margin:0;font-size:20px;font-weight:700;color:#09090b;line-height:1.3;">
              {t["headline"]}
            </h1>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:24px 40px 0;font-size:14px;color:#52525b;line-height:1.6;">
            {t["intro"]}
          </td>
        </tr>

        <!-- Main score -->
        <tr>
          <td style="padding:24px 40px;">
            <div style="background:#fafaf9;border:1px solid #f4f4f5;border-radius:12px;
                        padding:24px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;
                         letter-spacing:.08em;color:#a1a1aa;">{t["score_label"]}</p>
              <div style="font-size:64px;font-weight:800;color:#09090b;line-height:1;
                           letter-spacing:-2px;">{ai_score}</div>
              <div style="font-size:20px;color:#d4d4d8;margin-top:2px;">/ 100</div>
              <p style="margin:10px 0 0;font-size:12px;color:#a1a1aa;">{t["score_desc"]}</p>
            </div>
          </td>
        </tr>

        <!-- Score breakdown -->
        <tr>
          <td style="padding:0 40px 24px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;text-transform:uppercase;
                      letter-spacing:.08em;color:#a1a1aa;">{t["breakdown_title"]}</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              {score_rows}
              {insights_section}
            </table>
          </td>
        </tr>

        <!-- View report CTA -->
        <tr>
          <td style="padding:0 40px 16px;text-align:center;">
            <a href="{preview_url}"
               style="display:inline-block;background:#09090b;color:#ffffff;
                      text-decoration:none;font-size:14px;font-weight:600;
                      padding:12px 28px;border-radius:8px;">
              {t["view_report_text"]}
            </a>
          </td>
        </tr>

        <!-- Upgrade CTA -->
        <tr>
          <td style="padding:0 40px 32px;">
            <div style="background:#fafaf5;border:1px solid #fde68a;border-radius:12px;padding:20px;">
              <p style="margin:0 0 12px;font-size:13px;color:#52525b;line-height:1.5;">
                {t["upgrade_desc"]}
              </p>
              <a href="{register_url}"
                 style="display:inline-block;background:#ffffff;color:#09090b;
                        text-decoration:none;font-size:13px;font-weight:600;
                        padding:8px 18px;border-radius:8px;border:1px solid #e4e4e7;">
                {t["upgrade_text"]}
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #f4f4f5;">
            <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">
              {t["footer"]}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
"""


def send_preview_report(
    to_email: str,
    brand_name: str,
    website_url: str,
    ai_readiness_score: float,
    fanout_coverage_score: float,
    citation_power_score: float,
    extractability_score: float,
    entity_authority_score: float,
    source_authority_score: float,
    insights: list[str],
    preview_id: str,
    language: str = "en",
) -> None:
    """Send the preview report email via MailerSend."""
    if not config.MAILERSEND_API_KEY:
        raise RuntimeError("MAILERSEND_API_KEY is not configured")

    if language == "it":
        subject = f"Il tuo AI Readiness Report — {brand_name}"
    else:
        subject = f"Your AI Readiness Report — {brand_name}"

    html = _build_html(
        brand_name=brand_name,
        website_url=website_url,
        ai_readiness_score=ai_readiness_score,
        fanout_coverage_score=fanout_coverage_score,
        citation_power_score=citation_power_score,
        extractability_score=extractability_score,
        entity_authority_score=entity_authority_score,
        source_authority_score=source_authority_score,
        insights=insights,
        preview_id=preview_id,
        language=language,
        app_url=config.APP_URL,
    )

    client = MailerSendClient(api_key=config.MAILERSEND_API_KEY)
    email_resource = Email(client)

    request = (
        EmailBuilder()
        .from_email(config.EMAIL_FROM, "Visiblee")
        .to(to_email)
        .subject(subject)
        .html(html)
        .build()
    )

    response = email_resource.send(request)
    log.info(f"Email sent to {to_email} — status {response.status_code}")

    if response.status_code not in (200, 202):
        raise RuntimeError(f"MailerSend returned {response.status_code}: {response.body}")
