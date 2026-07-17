const ALLOWED_FILES = [
  "src/data/homepage.json",
  "src/data/packages.json",
  "src/data/contact.json",
  "src/data/seo.json",
  "src/data/services.json",
  "src/data/blog.json",
  "src/data/media.json",
  "src/data/pageSeo.json",
  "src/data/faq.json",
  "public/site-text.json",
  "src/pages/index.astro",
  "src/pages/diensten.astro",
  "src/pages/pakketten.astro",
  "src/pages/portfolio.astro",
  "src/pages/werkwijze.astro",
  "src/pages/website-scan.astro",
  "src/pages/keuzehulp.astro",
  "src/pages/blog.astro",
  "src/pages/contact.astro",
  "src/pages/privacy.astro",
  "src/pages/voorwaarden.astro",
  "src/pages/over-ons.astro"
];

function isAllowedFile(path: string) { return ALLOWED_FILES.includes(path); }
function unauthorized() { return Response.json({ error: "Niet toegestaan. Controleer het wachtwoord." }, { status: 401 }); }
function decodeBase64Utf8(input: string) {
  const binary = atob(String(input || "").replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const adminPassword = request.headers.get("X-Admin-Password");
  if (!env.ADMIN_PASSWORD || adminPassword !== env.ADMIN_PASSWORD) return unauthorized();

  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (!path || !isAllowedFile(path)) return Response.json({ error: "Dit onderdeel mag niet worden aangepast." }, { status: 400 });

  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "main";
  const githubUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const response = await fetch(githubUrl, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "WeDays-Studio" }
  });
  if (!response.ok) return Response.json({ error: "Content kon niet worden geladen." }, { status: 500 });

  const data: any = await response.json();
  const decoded = decodeBase64Utf8(data.content);
  const content = path.endsWith(".json") ? JSON.parse(decoded) : decoded;
  return Response.json({ path, content });
}
