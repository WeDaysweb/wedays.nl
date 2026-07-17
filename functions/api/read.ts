const ALLOWED_FILES = [
  "src/data/homepage.json",
  "src/data/packages.json",
  "src/data/contact.json",
  "src/data/seo.json",
  "src/data/services.json",
  "src/data/blog.json",
  "public/site-text.json"
];

function isAllowedFile(path: string) {
  return ALLOWED_FILES.includes(path);
}

function unauthorized() {
  return Response.json({ error: "Niet toegestaan. Controleer het admin wachtwoord." }, { status: 401 });
}

export async function onRequestGet(context: any) {
  const { request, env } = context;
  const adminPassword = request.headers.get("X-Admin-Password");

  if (!env.ADMIN_PASSWORD || adminPassword !== env.ADMIN_PASSWORD) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  if (!path || !isAllowedFile(path)) {
    return Response.json({ error: "Dit bestand mag niet worden aangepast." }, { status: 400 });
  }

  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "main";
  const githubUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;

  const response = await fetch(githubUrl, {
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "WeDays-Admin"
    }
  });

  if (!response.ok) {
    return Response.json({ error: "Bestand kon niet uit GitHub worden geladen." }, { status: 500 });
  }

  const data: any = await response.json();
  const decoded = decodeBase64Utf8(data.content);
  const content = JSON.parse(decoded);

  return Response.json({ path, content });
}

function decodeBase64Utf8(input: string) {
  const binary = atob(String(input || "").replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
