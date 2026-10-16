import "server-only";
import { getTranslations } from "next-intl/server";
import { isLocale } from "@/i18n/config";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Optional email to the photographer when a client sends a selection, via
 * Resend (free tier: 100 emails/day). Does nothing unless RESEND_API_KEY is set.
 */
export async function notifySelectionSubmitted(input: {
  ownerId: string;
  albumId: string;
  albumTitle: string;
  clientName: string;
  note: string | null;
  count: number;
  origin: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const admin = createAdminClient();
  const { data: owner } = await admin.from("users").select("email").eq("id", input.ownerId).maybeSingle();
  const to = process.env.NOTIFY_EMAIL || owner?.email;
  if (!to) return;

  const locale = isLocale(process.env.NOTIFY_LOCALE ?? "") ? (process.env.NOTIFY_LOCALE as string) : "vi";
  const t = await getTranslations({ locale, namespace: "email" });
  const link = `${input.origin.replace(/\/+$/, "")}/dashboard/albums/${input.albumId}/selections`;
  const values = { name: input.clientName, title: input.albumTitle, count: input.count };

  const subject = t("subject", values);
  const lines = [t("body", values), input.note ? `${t("note")}: ${input.note}` : null, `${t("open")}: ${link}`].filter(Boolean);
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1f2430">
      <p>${escapeHtml(t("body", values))}</p>
      ${input.note ? `<p><strong>${escapeHtml(t("note"))}:</strong><br>${escapeHtml(input.note).replace(/\n/g, "<br>")}</p>` : ""}
      <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#1f2a44;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">${escapeHtml(t("open"))}</a></p>
    </div>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || "Framefolio <onboarding@resend.dev>",
      to: [to],
      subject,
      text: lines.join("\n\n"),
      html,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) console.error("[notify] Resend responded", response.status, await response.text().catch(() => ""));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
