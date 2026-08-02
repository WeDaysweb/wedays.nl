type LeadBody = {
  type?: string;
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  service?: string;
  message?: string;
  honeypot?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_TO = "info@wedays.nl";
const DEFAULT_SCAN_TO = "leadscan@wedays.nl";
const DEFAULT_FROM = "WeDays Website <meldingen@wedays.nl>";

export async function onRequestPost(context: any) {
  let body: LeadBody;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: "Ongeldige aanvraag." }, 400);
  }

  if (body.honeypot) return json({ success: true });

  const lead = {
    type: clean(body.type || "contact", 40),
    name: clean(body.name, 200),
    company: clean(body.company, 200),
    email: clean(body.email, 200).toLowerCase(),
    phone: clean(body.phone, 80),
    website: clean(body.website, 300),
    service: clean(body.service, 120),
    message: clean(body.message, 3000),
  };

  const isScan = lead.type.startsWith("website-scan");
  const isScanStarted = lead.type === "website-scan-started";

  if (!isScanStarted && !isValidEmail(lead.email)) {
    return json({ error: "Vul een geldig e-mailadres in." }, 400);
  }
  if (isScan && !lead.website) {
    return json({ error: "De website-URL ontbreekt." }, 400);
  }
  if (!isScan && !lead.name && !lead.message) {
    return json({ error: "Vul je naam en een kort bericht in." }, 400);
  }

  // A successful scan is registered server-side by /api/scan. Older cached
  // browser scripts may still call this endpoint, so acknowledge without
  // sending a duplicate notification.
  if (isScanStarted) {
    return json({ success: true, message: "De website is geregistreerd." });
  }

  const apiKey = context.env.RESEND_API_KEY;
  if (!apiKey) {
    return json({ error: "E-mailmeldingen zijn nog niet geconfigureerd." }, 503);
  }

  const recipient = clean(
    isScan
      ? context.env.LEAD_SCAN_TO_EMAIL || DEFAULT_SCAN_TO
      : context.env.LEAD_TO_EMAIL || DEFAULT_TO,
    200
  );
  const sender = clean(context.env.LEAD_FROM_EMAIL || DEFAULT_FROM, 240);
  const subject = isScanStarted
    ? `Nieuwe website gescand: ${websiteLabel(lead.website)}`
    : isScan
      ? `OPVOLGEN — Website Scan: ${websiteLabel(lead.website)}`
      : `Nieuwe contactaanvraag${lead.name ? ` van ${lead.name}` : ""}`;
  const rows = [
    ["Type", isScanStarted ? "Website gescand" : isScan ? "Website Scan — contact aangevraagd" : "Contactaanvraag"],
    ["Opvolging", isScanStarted ? "Nog geen contact aangevraagd" : isScan ? "Contact aangevraagd — bellen of mailen" : ""],
    ["Naam", lead.name],
    ["Bedrijf", lead.company],
    ["E-mail", lead.email],
    ["Telefoon", lead.phone],
    ["Website", lead.website],
    ["Dienst", lead.service],
    ["Bericht", lead.message],
  ].filter(([, value]) => value);

  const emailResponse = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `wedays-lead/${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      from: sender,
      to: [recipient],
      ...(isValidEmail(lead.email) ? { reply_to: lead.email } : {}),
      subject,
      text: rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
      html: renderEmail(rows),
    }),
  });

  if (!emailResponse.ok) {
    console.error("Resend lead delivery failed", emailResponse.status, await emailResponse.text());
    return json({ error: "De aanvraag kon niet worden verzonden. Probeer het later opnieuw." }, 502);
  }

  return json({
    success: true,
    message: isScanStarted
      ? "De website is geregistreerd."
      : isScan
        ? "Je aanvraag is ontvangen."
        : "Je contactaanvraag is ontvangen.",
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function clean(value: unknown, maxLength: number) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLength);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function websiteLabel(value: string) {
  return value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .slice(0, 120) || "onbekende website";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderEmail(rows: string[][]) {
  const content = rows.map(([label, value]) =>
    `<tr><th style="padding:10px 14px;text-align:left;vertical-align:top;color:#475569;border-bottom:1px solid #e2e8f0">${escapeHtml(label)}</th><td style="padding:10px 14px;color:#0f172a;border-bottom:1px solid #e2e8f0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
  ).join("");
  return `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto"><h1 style="font-size:22px;color:#0b1120">Nieuwe lead via wedays.nl</h1><table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0">${content}</table><p style="color:#64748b;font-size:12px">Verzonden via het beveiligde formulier op wedays.nl.</p></div>`;
}

function json(data: Record<string, unknown>, status = 200) {
  return Response.json(data, { status, headers: corsHeaders() });
}

function corsHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
