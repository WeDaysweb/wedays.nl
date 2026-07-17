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

  if (!isValidEmail(lead.email)) {
    return json({ error: "Vul een geldig e-mailadres in." }, 400);
  }
  if (lead.type === "website-scan" && !lead.website) {
    return json({ error: "De website-URL ontbreekt." }, 400);
  }
  if (lead.type !== "website-scan" && !lead.name && !lead.message) {
    return json({ error: "Vul je naam en een kort bericht in." }, 400);
  }

  const apiKey = context.env.RESEND_API_KEY;
  if (!apiKey) {
    return json({ error: "E-mailmeldingen zijn nog niet geconfigureerd." }, 503);
  }

  const recipient = clean(context.env.LEAD_TO_EMAIL || DEFAULT_TO, 200);
  const sender = clean(context.env.LEAD_FROM_EMAIL || DEFAULT_FROM, 240);
  const isScan = lead.type === "website-scan";
  const subject = isScan
    ? `Nieuwe Website Scan lead: ${lead.email}`
    : `Nieuwe contactaanvraag${lead.name ? ` van ${lead.name}` : ""}`;
  const rows = [
    ["Type", isScan ? "Website Scan" : "Contactaanvraag"],
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
      reply_to: lead.email,
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
    message: isScan ? "Je aanvraag is ontvangen." : "Je contactaanvraag is ontvangen.",
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
