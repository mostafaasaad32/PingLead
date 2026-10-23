// ==============================================================================
// src/lib/notifications/email.ts
// Email digest of new matching projects, sent through Resend's HTTP API.
// Needs RESEND_API_KEY and EMAIL_FROM (an address on a domain verified in Resend;
// without a domain Resend only delivers to the Resend account owner's address).
// Server-side only.
// ==============================================================================

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!isEmailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.warn("[Email] Resend returned", res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn("[Email] Send failed:", err.message);
    return false;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface DigestProject {
  title: string;
  url: string;
  platformLabel: string;
  budget?: string | null;
  aiScore?: number | null;
  aiReason?: string | null;
}

/** RTL, inline-styled HTML (email clients ignore <style> blocks and web fonts) */
export function digestEmailHtml(params: {
  name?: string | null;
  periodLabel: string;
  projects: DigestProject[];
  totalCount: number;
  siteUrl: string;
}): string {
  const rows = params.projects
    .map(
      (p) => `
      <tr><td style="padding:14px 0;border-bottom:1px solid #e3eaea;">
        <a href="${escapeHtml(p.url)}" style="color:#0c6a65;font-size:15px;font-weight:bold;text-decoration:none;">${escapeHtml(p.title)}</a>
        <div style="color:#56696c;font-size:13px;margin-top:4px;">
          ${escapeHtml(p.platformLabel)}${p.budget ? ` · <span dir="ltr">${escapeHtml(p.budget)}</span>` : ""}${
            typeof p.aiScore === "number" ? ` · 🤖 ${p.aiScore}% توافق` : ""
          }
        </div>
        ${p.aiReason ? `<div style="color:#56696c;font-size:12px;margin-top:2px;">${escapeHtml(p.aiReason)}</div>` : ""}
      </td></tr>`
    )
    .join("");

  const more =
    params.totalCount > params.projects.length
      ? `<p style="font-size:13px;color:#56696c;">و${params.totalCount - params.projects.length} مشروع تاني في <a href="${escapeHtml(
          params.siteUrl
        )}/dashboard" style="color:#0c6a65;">لوحة التحكم</a>.</p>`
      : "";

  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#f4f7f7;">
  <div dir="rtl" style="max-width:600px;margin:0 auto;padding:24px 16px;font-family:Tahoma,Arial,sans-serif;color:#122427;text-align:right;">
    <h1 style="font-size:20px;margin:0 0 4px;">🎯 ${params.totalCount} مشروع جديد يطابق فلاترك</h1>
    <p style="font-size:13px;color:#56696c;margin:0 0 16px;">${escapeHtml(params.periodLabel)}${
      params.name ? ` · أهلاً ${escapeHtml(params.name)}` : ""
    }</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:10px;padding:0 16px;">${rows}</table>
    ${more}
    <p style="font-size:12px;color:#8a9a9c;margin-top:24px;">بتوصلك الرسالة دي عشان مفعّل ملخص الإيميل في PingLead.
      تقدر توقفه من <a href="${escapeHtml(params.siteUrl)}/settings/notifications" style="color:#8a9a9c;">إعدادات الإشعارات</a>.</p>
  </div></body></html>`;
}
