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

function encodeBase64(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

async function getCurrentFileSha(env: any, path: string) {
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

  if (!response.ok) throw new Error("Kan huidige GitHub-bestand niet ophalen.");
  const data: any = await response.json();
  return data.sha;
}

export async function onRequestPost(context: any) {
  const { request, env } = context;
  const adminPassword = request.headers.get("X-Admin-Password");

  if (!env.ADMIN_PASSWORD || adminPassword !== env.ADMIN_PASSWORD) {
    return unauthorized();
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const { path, content } = body;

  if (!path || !isAllowedFile(path)) {
    return Response.json({ error: "Dit bestand mag niet worden aangepast." }, { status: 400 });
  }

  if (typeof content !== "object" || content === null) {
    return Response.json({ error: "Content moet geldige JSON zijn." }, { status: 400 });
  }

  const owner = env.GITHUB_OWNER;
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "main";

  const formattedContent = JSON.stringify(content, null, 2) + "\n";
  const encodedContent = encodeBase64(formattedContent);
  let sha: string;
  try {
    sha = await getCurrentFileSha(env, path);
  } catch {
    return Response.json({ error: "Huidige content kon niet worden opgehaald. Controleer GitHub instellingen." }, { status: 500 });
  }
  const githubUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

  const response = await fetch(githubUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "WeDays-Admin"
    },
    body: JSON.stringify({
      message: `Update website content: ${path}`,
      content: encodedContent,
      sha,
      branch
    })
  });

  if (!response.ok) {
    return Response.json({ error: "Opslaan naar GitHub mislukt. Controleer GITHUB_TOKEN, eigenaar, repo en branch." }, { status: 500 });
  }

  return Response.json({ success: true, message: "Content opgeslagen in GitHub." });
}
