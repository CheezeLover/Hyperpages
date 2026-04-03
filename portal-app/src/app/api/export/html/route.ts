/**
 * GET /api/export/html?projectId=<id>
 *
 * Returns a single .html file containing all active project pages in order,
 * each in a full-viewport iframe. No external libraries, no print dialog.
 */
import { type NextRequest } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getAllPageSettings } from "@/lib/page-settings";
import { getAllProjects, canUserViewProject } from "@/lib/project-settings";
import fs from "fs";
import path from "path";

const PAGES_DIR = process.env.PAGES_DIR ?? path.join(process.cwd(), "pages");
const PAGES_PUBLIC_URL = (
  process.env.PAGES_PUBLIC_URL ??
  `https://pages.${process.env.HYPERSET_DOMAIN ?? "hyperset.internal"}`
).replace(/\/$/, "");

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user.email) return new Response("Unauthorized", { status: 401 });

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) return new Response("Missing projectId", { status: 400 });

  const allProjects = await getAllProjects();
  const project = allProjects.find((p) => p.id === projectId);
  if (!project || !canUserViewProject(project, user.email, user.isAdmin, user.guestProjectIds)) {
    return new Response("Forbidden", { status: 403 });
  }

  const allSettings = await getAllPageSettings();
  const pageNames = Object.entries(allSettings)
    .filter(([, s]) => s.projectId === projectId && s.active !== false)
    .sort(([, a], [, b]) => (a.order ?? 0) - (b.order ?? 0))
    .map(([name]) => name);

  if (pageNames.length === 0)
    return new Response("No pages in project", { status: 404 });

  // Each page is inlined via srcdoc with a <base> tag so its relative assets
  // (CSS, images, JS) still resolve against the live pages service.
  const sections = pageNames.map((name) => {
    const htmlPath = path.join(PAGES_DIR, name, "index.html");
    let raw = "";
    try { raw = fs.readFileSync(htmlPath, "utf-8"); } catch { return ""; }

    // Inject <base> before any existing <head> content so relative URLs resolve
    const base = `${PAGES_PUBLIC_URL}/${name}/`;
    const withBase = raw.includes("<base")
      ? raw
      : raw.replace(/(<head[^>]*>)/i, `$1<base href="${base}">`);

    // srcdoc requires " to be &quot; (& → &amp; first)
    const srcdoc = withBase.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

    return `<section><iframe srcdoc="${srcdoc}" sandbox="allow-scripts allow-same-origin" title="${name}"></iframe></section>`;
  }).filter(Boolean).join("\n");

  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Export</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#111}
section{width:100vw;height:100vh;overflow:hidden}
iframe{width:100%;height:100%;border:none;display:block}
</style>
</head>
<body>
${sections}
</body>
</html>`;

  return new Response(doc, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": 'attachment; filename="export.html"',
      "Cache-Control": "no-store",
    },
  });
}
