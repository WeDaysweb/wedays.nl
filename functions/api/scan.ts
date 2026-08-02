const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_SCAN_TO = "leadscan@wedays.nl";
const DEFAULT_FROM = "WeDays Website <meldingen@wedays.nl>";

export async function onRequestPost(context: any) {
  const { request } = context;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400, headers: corsHeaders() });
  }

  let url: string = String(body?.url || "").trim();
  if (!url) return Response.json({ error: "URL vereist." }, { status: 400, headers: corsHeaders() });
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Response.json({ error: "Vul een geldige URL in, bijvoorbeeld https://voorbeeld.nl." }, { status: 400, headers: corsHeaders() });
  }

  if (!/^https?:$/.test(parsed.protocol) || isBlockedHost(parsed.hostname)) {
    return Response.json({ error: "Deze URL kan niet worden gescand." }, { status: 400, headers: corsHeaders() });
  }

  const startTime = Date.now();
  const primary = await fetchWebsite(parsed.toString(), 12000);
  let scan = primary;

  if (!scan.loaded && parsed.protocol === "https:") {
    const httpUrl = new URL(parsed.toString());
    httpUrl.protocol = "http:";
    scan = await fetchWebsite(httpUrl.toString(), 10000);
  }

  if (!scan.loaded) {
    return Response.json({
      error: "Website kon niet worden bereikt. Controleer de URL of probeer het later opnieuw.",
      status: scan.status || 0,
    }, { status: 200, headers: corsHeaders() });
  }

  const loadTime = Math.max(1, Date.now() - startTime);
  const css = await fetchSmallStylesheets(scan.html, scan.finalUrl || parsed.toString());
  const result = analyzeHtml(scan.html, css, scan.finalUrl || parsed.toString(), (scan.finalUrl || parsed.toString()).startsWith("https://"), scan.status, loadTime, scan.bytes);
  const notificationSent = await sendScanNotification(context.env, result.url);

  return Response.json({ ...result, notificationSent }, { headers: corsHeaders() });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

async function sendScanNotification(env: any, website: string) {
  const apiKey = String(env?.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    console.error("Website Scan notification skipped: RESEND_API_KEY is missing");
    return false;
  }

  const recipient = cleanHeader(env?.LEAD_SCAN_TO_EMAIL || DEFAULT_SCAN_TO, 200);
  const sender = cleanHeader(env?.LEAD_FROM_EMAIL || DEFAULT_FROM, 240);
  const label = websiteLabel(website);
  const safeWebsite = escapeHtml(website);

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `wedays-scan/${crypto.randomUUID()}`,
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        subject: `Nieuwe website gescand: ${label}`,
        text: `Type: Website gescand\nOpvolging: Nog geen contact aangevraagd\nWebsite: ${website}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto"><h1 style="font-size:22px;color:#0b1120">Nieuwe Website Scan</h1><table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0"><tr><th style="padding:10px 14px;text-align:left;color:#475569">Website</th><td style="padding:10px 14px;color:#0f172a">${safeWebsite}</td></tr><tr><th style="padding:10px 14px;text-align:left;color:#475569">Opvolging</th><td style="padding:10px 14px;color:#0f172a">Nog geen contact aangevraagd</td></tr></table><p style="color:#64748b;font-size:12px">Automatisch geregistreerd via de Website Scan op wedays.nl.</p></div>`,
      }),
    });

    if (!response.ok) {
      console.error("Website Scan notification failed", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Website Scan notification failed", error);
    return false;
  }
}

function cleanHeader(value: unknown, maxLength: number) {
  return String(value || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLength);
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

function corsHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) || host === "0.0.0.0" || host === "::1";
}

async function fetchWebsite(url: string, timeoutMs: number) {
  const started = Date.now();
  let timeout: any;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WeDays-Scanner/2.0; +https://wedays.nl)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "nl,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const status = res.status;
    const contentType = res.headers.get("content-type") || "";
    if (status < 200 || status >= 400) return { loaded: false, html: "", status, finalUrl: res.url, bytes: 0, loadTime: Date.now() - started };
    if (contentType && !/text\/html|application\/xhtml\+xml/i.test(contentType)) return { loaded: false, html: "", status, finalUrl: res.url, bytes: 0, loadTime: Date.now() - started };

    const { text, bytes } = await readLimitedText(res, 750_000);
    return { loaded: true, html: text, status, finalUrl: res.url, bytes, loadTime: Date.now() - started };
  } catch {
    if (timeout) clearTimeout(timeout);
    return { loaded: false, html: "", status: 0, finalUrl: url, bytes: 0, loadTime: Date.now() - started };
  }
}

async function readLimitedText(res: Response, limit: number) {
  const reader = res.body?.getReader();
  if (!reader) {
    const text = await res.text();
    return { text: text.slice(0, limit), bytes: text.length };
  }
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done || totalBytes >= limit) break;
    if (value) {
      const take = Math.min(value.length, limit - totalBytes);
      chunks.push(value.slice(0, take));
      totalBytes += take;
    }
  }
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; }
  return { text: new TextDecoder("utf-8", { fatal: false }).decode(combined), bytes: totalBytes };
}

async function fetchSmallStylesheets(html: string, pageUrl: string) {
  const links = [...html.matchAll(/<link[^>]+rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi)]
    .map((m) => m[0].match(/href=["']([^"']+)["']/i)?.[1])
    .filter(Boolean)
    .slice(0, 4) as string[];
  const out: string[] = [];
  for (const href of links) {
    try {
      const absolute = new URL(href, pageUrl);
      if (!/^https?:$/.test(absolute.protocol) || isBlockedHost(absolute.hostname)) continue;
      const res = await fetch(absolute.toString(), { headers: { "User-Agent": "WeDays-Scanner/2.0" } });
      if (!res.ok) continue;
      const { text } = await readLimitedText(res, 150_000);
      out.push(text);
    } catch {}
  }
  return out.join("\n");
}

function stripTags(value: string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function analyzeHtml(html: string, css: string, url: string, isHttps: boolean, status: number, loadTime: number, bytes: number) {
  const combinedCss = html + "\n" + css;

  const title = stripTags(html.match(/<title[^>]*>([\s\S]{0,250}?)<\/title>/i)?.[1] ?? "");
  const metaDesc = (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,350})["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']{0,350})["'][^>]+name=["']description["']/i)?.[1] ?? "").trim();
  const h1Matches = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1])).filter(Boolean);
  const canonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const ogTitle = /<meta[^>]+property=["']og:title["']/i.test(html);
  const h2Count = (html.match(/<h2[^>]*>/gi) ?? []).length;

  let seoScore = 0;
  const seoGood: string[] = [];
  const seoBad: string[] = [];
  if (title) { seoScore += 2; seoGood.push(`Paginatitel gevonden: "${title.slice(0, 55)}${title.length > 55 ? "…" : ""}"`); } else seoBad.push("Geen paginatitel gevonden, belangrijk voor Google.");
  if (title.length >= 30 && title.length <= 65) { seoScore += 1; seoGood.push("Titellengte is goed."); } else if (title) seoBad.push(`Titellengte is ${title.length < 30 ? "te kort" : "te lang"} (${title.length} tekens).`);
  if (metaDesc) { seoScore += 2; seoGood.push("Meta-omschrijving aanwezig."); } else seoBad.push("Geen meta-omschrijving gevonden.");
  if (metaDesc.length >= 110 && metaDesc.length <= 170) { seoScore += 1; seoGood.push("Meta-omschrijving heeft een goede lengte."); } else if (metaDesc) seoBad.push(`Meta-omschrijving is ${metaDesc.length < 110 ? "te kort" : "te lang"} (${metaDesc.length} tekens).`);
  if (h1Matches.length === 1) { seoScore += 2; seoGood.push(`Eén H1-kop gevonden: "${h1Matches[0].slice(0, 45)}${h1Matches[0].length > 45 ? "…" : ""}"`); } else if (h1Matches.length > 1) { seoScore += 1; seoBad.push(`${h1Matches.length} H1-koppen gevonden, liever één hoofd-H1.`); } else seoBad.push("Geen H1-kop gevonden.");
  if (canonical) { seoScore += 1; seoGood.push("Canonical URL aanwezig."); } else seoBad.push("Geen canonical URL gevonden.");
  if (ogTitle) { seoScore += 1; seoGood.push("Open Graph meta aanwezig."); } else seoBad.push("Geen Open Graph titel gevonden.");
  if (h2Count > 0) seoGood.push(`${h2Count} H2-koppen gevonden.`);
  seoScore = Math.min(10, seoScore);

  const viewportContent = html.match(/<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? "";
  const hasViewport = Boolean(viewportContent);
  const hasWidthDevice = /width\s*=\s*device-width/i.test(viewportContent);
  const hasInitScale = /initial-scale\s*=\s*1/i.test(viewportContent);
  const imgTotal = (html.match(/<img\b[^>]*>/gi) ?? []).length;
  const imgWithAlt = (html.match(/<img\b[^>]*alt=["'][^"']+["'][^>]*>/gi) ?? []).length;
  const hasMediaQuery = /@media\b/i.test(combinedCss);
  const hasFlexOrGrid = /\b(display\s*:\s*(flex|grid)|grid-template|flex-wrap)\b/i.test(combinedCss);

  let mobileScore = 0;
  const mobileGood: string[] = [];
  const mobileBad: string[] = [];
  if (hasViewport) { mobileScore += 3; mobileGood.push("Viewport meta-tag aanwezig."); } else mobileBad.push("Geen viewport meta-tag gevonden.");
  if (hasWidthDevice) { mobileScore += 2; mobileGood.push("Viewport staat op device-width."); } else if (hasViewport) mobileBad.push("Viewport mist width=device-width.");
  if (hasInitScale) { mobileScore += 1; mobileGood.push("Initial-scale staat goed."); }
  if (imgTotal === 0) { mobileScore += 1; mobileGood.push("Geen zware HTML-afbeeldingen gevonden."); } else if (imgWithAlt / imgTotal >= 0.8) { mobileScore += 2; mobileGood.push(`${imgWithAlt} van ${imgTotal} afbeeldingen hebben alt-tekst.`); } else { mobileScore += Math.round((imgWithAlt / Math.max(1, imgTotal)) * 2); mobileBad.push(`Slechts ${imgWithAlt} van ${imgTotal} afbeeldingen hebben alt-tekst.`); }
  if (hasMediaQuery || hasFlexOrGrid) { mobileScore += 2; mobileGood.push("Responsieve CSS gevonden."); } else mobileBad.push("Geen duidelijke responsieve CSS gevonden.");
  mobileScore = Math.min(10, Math.round(mobileScore));

  const formCount = (html.match(/<form\b[^>]*>/gi) ?? []).length;
  const realEmails = (html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? []).filter((e) => !/example|test@|user@/i.test(e));
  const phoneMatches = html.match(/(\+31|0)\s*[\d\s\-.]{7,15}/g) ?? [];
  const btnCount = (html.match(/<(?:button|a)[^>]+(?:class=["'][^"']*(btn|button|cta)[^"']*["']|type=["']submit["'])[^>]*>/gi) ?? []).length;
  const hasCta = /contact|aanvr|offerte|afspraak|bestel|koop|download|demo|probeer|start|bel|mail|plan|inschrijv/i.test(html);
  let convScore = 0;
  const convGood: string[] = [];
  const convBad: string[] = [];
  if (formCount > 0) { convScore += 3; convGood.push(`${formCount} formulier${formCount > 1 ? "en" : ""} gevonden.`); } else convBad.push("Geen formulier gevonden.");
  if (realEmails.length > 0) { convScore += 2; convGood.push("E-mailadres zichtbaar op de pagina."); } else convBad.push("Geen zichtbaar e-mailadres gevonden.");
  if (phoneMatches.length > 0) { convScore += 2; convGood.push("Telefoonnummer gevonden."); } else convBad.push("Geen telefoonnummer zichtbaar.");
  if (btnCount > 0) { convScore += 2; convGood.push(`${btnCount} call-to-action element${btnCount > 1 ? "en" : ""} gevonden.`); } else convBad.push("Geen duidelijke CTA-knoppen gevonden.");
  if (hasCta) { convScore += 1; convGood.push("Actiegericht taalgebruik gevonden."); }
  convScore = Math.min(10, convScore);

  let speedScore = 0;
  const speedGood: string[] = [];
  const speedBad: string[] = [];
  if (loadTime <= 900) { speedScore += 6; speedGood.push(`Zeer snelle respons: ${loadTime}ms.`); }
  else if (loadTime <= 1800) { speedScore += 5; speedGood.push(`Snelle respons: ${loadTime}ms.`); }
  else if (loadTime <= 3000) { speedScore += 3; speedBad.push(`Laadtijd kan sneller: ${loadTime}ms.`); }
  else { speedScore += 1; speedBad.push(`Trage respons: ${loadTime}ms.`); }
  if (bytes <= 180_000) { speedScore += 2; speedGood.push("HTML-pagina is licht."); }
  else if (bytes <= 500_000) { speedScore += 1; speedGood.push("HTML-grootte is acceptabel."); }
  else speedBad.push("HTML-pagina is groot; optimalisatie is verstandig.");
  if (/loading=["']lazy["']/i.test(html)) { speedScore += 1; speedGood.push("Lazy loading voor afbeeldingen gevonden."); }
  else if ((html.match(/<img\b/gi) ?? []).length > 2) speedBad.push("Geen lazy loading gevonden bij meerdere afbeeldingen.");
  if (/preconnect|preload/i.test(html)) { speedScore += 1; speedGood.push("Preload/preconnect optimalisatie gevonden."); }
  speedScore = Math.max(0, Math.min(10, Math.round(speedScore)));

  const hasFavicon = /<link[^>]+rel=["'][^"']*(icon|shortcut)[^"']*["']/i.test(html);
  const hasCustomFont = /fonts\.googleapis\.com|fonts\.gstatic\.com|typekit|font-face/i.test(combinedCss);
  const hasStructuredData = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
  const hasSocialMeta = /<meta[^>]+(?:property=["']og:|name=["']twitter:)/i.test(html);
  let designScore = 1;
  const designGood: string[] = ["Website laadt succesvol."];
  const designBad: string[] = [];
  if (isHttps) { designScore += 2; designGood.push("HTTPS / SSL is actief."); } else designBad.push("Geen HTTPS. Dit breekt vertrouwen.");
  if (hasFavicon) { designScore += 1; designGood.push("Favicon aanwezig."); } else designBad.push("Geen favicon gevonden.");
  if (hasCustomFont) { designScore += 2; designGood.push("Professionele typografie/custom font gevonden."); } else designBad.push("Geen custom font gevonden.");
  if (hasStructuredData) { designScore += 2; designGood.push("Schema.org data aanwezig."); } else designBad.push("Geen Schema.org data gevonden.");
  if (hasSocialMeta) { designScore += 1; designGood.push("Social media meta-tags aanwezig."); } else designBad.push("Geen social media meta-tags gevonden.");
  designScore = Math.max(0, Math.min(10, Math.round(designScore)));

  const overall = Math.round(((seoScore + mobileScore + convScore + speedScore + designScore) / 5) * 10) / 10;
  return {
    url,
    loaded: true,
    overall,
    scores: {
      seo: Math.round(seoScore * 10) / 10,
      mobiel: mobileScore,
      conversie: convScore,
      snelheid: speedScore,
      uitstraling: designScore,
    },
    findings: {
      seo: { good: seoGood, bad: seoBad },
      mobiel: { good: mobileGood, bad: mobileBad },
      conversie: { good: convGood, bad: convBad },
      snelheid: { good: speedGood, bad: speedBad },
      uitstraling: { good: designGood, bad: designBad },
    },
    meta: { title, loadTime, isHttps, status, bytes },
  };
}
