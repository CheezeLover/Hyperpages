import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, type HypersetUser } from "@/lib/auth";
import { getAllPageSettings, setPageSettings, deletePageSettings, getPageSettings } from "@/lib/page-settings";
import { getAllProjects } from "@/lib/project-settings";
import fs from "fs";
import path from "path";
import { checkRateLimit } from "@/lib/utils";

const PAGES_DIR = process.env.PAGES_DIR ?? path.join(process.cwd(), "pages");

const RATE_LIMIT = 60;        // requests per user per window
const RATE_WINDOW = 60_000;   // 1 minute

function requireAuth(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

async function canManagePage(pageName: string, user: HypersetUser): Promise<boolean> {
  if (user.isAdmin) return true;
  const settings = await getPageSettings(pageName);
  if (settings.createdBy === user.email) return true;
  if (!settings.projectId) return false;
  const allProjects = await getAllProjects();
  const project = allProjects.find((p) => p.id === settings.projectId);
  if (!project) return false;
  return project.createdBy === user.email || project.allowedEmails.includes(user.email);
}

/** Resolve the filesystem path for a page name.
 *  Legacy flat pages: "pageName"           → PAGES_DIR/pageName
 *  Project-scoped:    "projectId/pageName" → PAGES_DIR/projectId/pageName
 */
function resolvePageDir(name: string): string {
  return path.join(PAGES_DIR, ...name.split("/"));
}

function isValidPageName(name: string): boolean {
  return name.split("/").every((seg) => /^[a-zA-Z0-9_-]+$/.test(seg));
}

function scanPagesDir(): { name: string; hasBackend: boolean }[] {
  const pages: { name: string; hasBackend: boolean }[] = [];
  try {
    if (!fs.existsSync(PAGES_DIR)) return pages;
    const entries = fs.readdirSync(PAGES_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const topDir = path.join(PAGES_DIR, entry.name);
      if (fs.existsSync(path.join(topDir, "index.html"))) {
        // Legacy flat page
        pages.push({ name: entry.name, hasBackend: fs.existsSync(path.join(topDir, "backend.py")) });
      } else {
        // Project subdirectory — scan pages within
        for (const sub of fs.readdirSync(topDir, { withFileTypes: true })) {
          if (!sub.isDirectory() || sub.name.startsWith(".")) continue;
          const subDir = path.join(topDir, sub.name);
          if (fs.existsSync(path.join(subDir, "index.html"))) {
            pages.push({
              name: `${entry.name}/${sub.name}`,
              hasBackend: fs.existsSync(path.join(subDir, "backend.py")),
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("[admin/pages] Failed to scan pages directory:", e);
  }
  return pages.sort((a, b) => a.name.localeCompare(b.name));
}

/** GET /api/admin/pages */
export async function GET(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const { email } = getUserFromRequest(request);
  if (!checkRateLimit(RATE_LIMIT, RATE_WINDOW, email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const pages = scanPagesDir();
  const settings = await getAllPageSettings();

  const pagesWithMeta = pages.map((p) => ({
    name: p.name,
    displayName: p.name.split("/").pop() ?? p.name,
    hasBackend: p.hasBackend,
    active: settings[p.name]?.active ?? true,
    projectId: settings[p.name]?.projectId,
    order: settings[p.name]?.order ?? 0,
    icon: settings[p.name]?.icon,
    iconColor: settings[p.name]?.iconColor,
    createdBy: settings[p.name]?.createdBy,
  }));

  return NextResponse.json({ pages: pagesWithMeta });
}

/** POST /api/admin/pages — upload a new page; projectId is required */
export async function POST(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const user = getUserFromRequest(request);
  if (!checkRateLimit(RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Content-Type must be multipart/form-data" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const name = formData.get("name")?.toString().trim();
    const htmlFile = formData.get("html") as File | null;
    const backendFile = formData.get("backend") as File | null;
    const icon = formData.get("icon")?.toString().trim() || undefined;
    const iconColor = formData.get("iconColor")?.toString().trim() || undefined;
    const projectId = formData.get("projectId")?.toString().trim();

    if (!name) return NextResponse.json({ error: "Page name is required" }, { status: 400 });
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json({ error: "Page name must contain only letters, numbers, underscores and hyphens" }, { status: 400 });
    }
    if (!htmlFile) return NextResponse.json({ error: "HTML file is required" }, { status: 400 });
    if (!projectId) return NextResponse.json({ error: "A project is required" }, { status: 400 });

    const allProjects = await getAllProjects();
    const project = allProjects.find((p) => p.id === projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 400 });
    if (!user.isAdmin && project.createdBy !== user.email && !project.allowedEmails.includes(user.email)) {
      return NextResponse.json({ error: "Forbidden: you must be a member of the project to add pages" }, { status: 403 });
    }

    // Store pages under a project subdirectory so the same display name can be
    // reused across different projects.  The full internal name (also the URL path)
    // is "{projectId}/{displayName}".
    const fullName = `${projectId}/${name}`;
    const pageDirPath = resolvePageDir(fullName);
    if (fs.existsSync(pageDirPath)) {
      return NextResponse.json({ error: `Page "${name}" already exists in this project` }, { status: 400 });
    }

    fs.mkdirSync(pageDirPath, { recursive: true });
    fs.writeFileSync(path.join(pageDirPath, "index.html"), Buffer.from(await htmlFile.arrayBuffer()));
    if (backendFile && backendFile.size > 0) {
      fs.writeFileSync(path.join(pageDirPath, "backend.py"), Buffer.from(await backendFile.arrayBuffer()));
    }

    const creatorEmail = user.email;
    const hasBackend = !!backendFile && backendFile.size > 0;
    await setPageSettings(fullName, { active: true, projectId, order: 0, icon, iconColor, createdBy: creatorEmail });

    return NextResponse.json({
      ok: true,
      page: { name: fullName, displayName: name, hasBackend, active: true, projectId, order: 0, icon, iconColor, createdBy: creatorEmail }
    });
  } catch (e) {
    console.error("[admin/pages] Failed to upload page:", e);
    return NextResponse.json({ error: "Failed to upload page" }, { status: 500 });
  }
}

/** PUT /api/admin/pages — replace page files */
export async function PUT(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const user = getUserFromRequest(request);
  if (!checkRateLimit(RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Content-Type must be multipart/form-data" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const name = formData.get("name")?.toString().trim();
    const htmlFile = formData.get("html") as File | null;
    const backendFile = formData.get("backend") as File | null;

    if (!name) return NextResponse.json({ error: "Page name is required" }, { status: 400 });
    if (!isValidPageName(name)) return NextResponse.json({ error: "Invalid page name" }, { status: 400 });

    const pageDirPath = resolvePageDir(name);
    if (!fs.existsSync(path.join(pageDirPath, "index.html"))) {
      return NextResponse.json({ error: `Page "${name}" not found` }, { status: 404 });
    }
    if (!await canManagePage(name, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (htmlFile && htmlFile.size > 0) {
      fs.writeFileSync(path.join(pageDirPath, "index.html"), Buffer.from(await htmlFile.arrayBuffer()));
    }
    if (backendFile && backendFile.size > 0) {
      fs.writeFileSync(path.join(pageDirPath, "backend.py"), Buffer.from(await backendFile.arrayBuffer()));
    } else if (formData.get("removeBackend") === "true") {
      const backendPath = path.join(pageDirPath, "backend.py");
      if (fs.existsSync(backendPath)) fs.unlinkSync(backendPath);
    }

    return NextResponse.json({ ok: true, hasBackend: fs.existsSync(path.join(pageDirPath, "backend.py")) });
  } catch (e) {
    console.error("[admin/pages] Failed to update page files:", e);
    return NextResponse.json({ error: "Failed to update page files" }, { status: 500 });
  }
}

/** PATCH /api/admin/pages — update one page's settings, or bulk-reorder pages in one request */
export async function PATCH(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const user = getUserFromRequest(request);
  if (!checkRateLimit(RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json() as Record<string, unknown>;

    // ── Bulk reorder: { orders: [{ name, order }] } ──────────────────────────
    // Replaces N sequential PATCH calls with a single atomic request.
    if (Array.isArray(body.orders)) {
      const orders = body.orders as { name: string; order: number }[];
      const allSettings = await getAllPageSettings();
      // Permission check per page (all cached after the first DB hit)
      for (const { name } of orders) {
        if (!await canManagePage(name, user)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
      await Promise.all(
        orders.map(({ name, order }) => {
          const current = allSettings[name] ?? {};
          return setPageSettings(name, { ...current, order });
        })
      );
      return NextResponse.json({ ok: true });
    }

    // ── Single page update ────────────────────────────────────────────────────
    const { name, newName, active, projectId, order, icon, iconColor } = body as {
      name: string;
      newName?: string;
      active?: boolean;
      projectId?: string;
      order?: number;
      icon?: string;
      iconColor?: string;
    };

    if (!name) return NextResponse.json({ error: "Page name is required" }, { status: 400 });
    if (!isValidPageName(name)) return NextResponse.json({ error: "Invalid page name" }, { status: 400 });

    if (!fs.existsSync(path.join(resolvePageDir(name), "index.html"))) {
      return NextResponse.json({ error: `Page "${name}" not found` }, { status: 404 });
    }
    if (!await canManagePage(name, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Rename: move filesystem directory + migrate settings ─────────────────
    // newName is always the display name (last segment only).
    // The full name preserves the project prefix if present.
    const displayNewName = newName?.trim();
    const parts = name.split("/");
    const currentDisplayName = parts[parts.length - 1];
    const targetName = (displayNewName && displayNewName !== currentDisplayName) ? displayNewName : null;
    let targetFullName: string | null = null;
    if (targetName !== null) {
      if (!/^[a-zA-Z0-9_-]+$/.test(targetName)) {
        return NextResponse.json({ error: "Page name must contain only letters, numbers, underscores and hyphens" }, { status: 400 });
      }
      const prefix = parts.length > 1 ? parts.slice(0, -1).join("/") + "/" : "";
      targetFullName = prefix + targetName;
      const newDirPath = resolvePageDir(targetFullName);
      if (fs.existsSync(newDirPath)) {
        return NextResponse.json({ error: `A page named "${targetName}" already exists` }, { status: 409 });
      }
      fs.renameSync(resolvePageDir(name), newDirPath);
    }

    const finalName = targetFullName ?? name;
    const all = await getAllPageSettings();
    const current = all[name] ?? {};
    const updatedSettings = {
      active: active !== undefined ? active : (current.active ?? true),
      projectId: projectId !== undefined ? projectId : current.projectId,
      order: order !== undefined ? order : (current.order ?? 0),
      icon: icon !== undefined ? icon : current.icon,
      iconColor: iconColor !== undefined ? iconColor : current.iconColor,
      createdBy: current.createdBy,
    };

    if (targetName !== null) {
      // Write under new key, remove old key
      await setPageSettings(finalName, updatedSettings);
      await deletePageSettings(name);
    } else {
      await setPageSettings(finalName, updatedSettings);
    }
    return NextResponse.json({ ok: true, name: finalName });
  } catch (e) {
    console.error("[admin/pages] Failed to update page:", e);
    return NextResponse.json({ error: "Failed to update page" }, { status: 500 });
  }
}

/** DELETE /api/admin/pages */
export async function DELETE(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const user = getUserFromRequest(request);
  if (!checkRateLimit(RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { name } = body as { name: string };

    if (!name) return NextResponse.json({ error: "Page name is required" }, { status: 400 });
    if (!isValidPageName(name)) return NextResponse.json({ error: "Invalid page name" }, { status: 400 });

    const pageDirPath = resolvePageDir(name);
    if (!fs.existsSync(path.join(pageDirPath, "index.html"))) {
      return NextResponse.json({ error: `Page "${name}" not found` }, { status: 404 });
    }
    if (!await canManagePage(name, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    fs.rmSync(pageDirPath, { recursive: true, force: true });
    await deletePageSettings(name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/pages] Failed to delete page:", e);
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
  }
}
