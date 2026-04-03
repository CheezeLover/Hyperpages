import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, type HypersetUser } from "@/lib/auth";
import { getAllPageSettings, setPageSettings, deletePageSettings, getPageSettings } from "@/lib/page-settings";
import { getAllProjects } from "@/lib/project-settings";
import fs from "fs";
import path from "path";
import { checkRateLimit } from "@/lib/utils";

const PAGES_DIR = process.env.PAGES_DIR ?? path.join(process.cwd(), "pages");

const _rateLimitMap = new Map<string, number[]>();
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
  return project?.createdBy === user.email;
}

function scanPagesDir(): { name: string; hasBackend: boolean }[] {
  const pages: { name: string; hasBackend: boolean }[] = [];
  try {
    if (!fs.existsSync(PAGES_DIR)) return pages;
    const entries = fs.readdirSync(PAGES_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const indexPath = path.join(PAGES_DIR, entry.name, "index.html");
        const backendPath = path.join(PAGES_DIR, entry.name, "backend.py");
        if (fs.existsSync(indexPath)) {
          pages.push({ name: entry.name, hasBackend: fs.existsSync(backendPath) });
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
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const pages = scanPagesDir();
  const settings = await getAllPageSettings();

  const pagesWithMeta = pages.map((p) => ({
    name: p.name,
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
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, user.email)) {
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
    if (!user.isAdmin && project.createdBy !== user.email) {
      return NextResponse.json({ error: "Forbidden: you can only add pages to your own projects" }, { status: 403 });
    }

    const pageDir = path.join(PAGES_DIR, name);
    if (fs.existsSync(pageDir)) {
      return NextResponse.json({ error: `Page "${name}" already exists` }, { status: 400 });
    }

    fs.mkdirSync(pageDir, { recursive: true });
    fs.writeFileSync(path.join(pageDir, "index.html"), Buffer.from(await htmlFile.arrayBuffer()));
    if (backendFile && backendFile.size > 0) {
      fs.writeFileSync(path.join(pageDir, "backend.py"), Buffer.from(await backendFile.arrayBuffer()));
    }

    const creatorEmail = user.email;
    await setPageSettings(name, { active: true, projectId, order: 0, icon, iconColor, createdBy: creatorEmail });

    return NextResponse.json({
      ok: true,
      page: { name, hasBackend: !!backendFile && backendFile.size > 0, active: true, projectId, order: 0, icon, iconColor, createdBy: creatorEmail }
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
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, user.email)) {
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

    const pageDir = path.join(PAGES_DIR, name);
    if (!fs.existsSync(path.join(pageDir, "index.html"))) {
      return NextResponse.json({ error: `Page "${name}" not found` }, { status: 404 });
    }
    if (!await canManagePage(name, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (htmlFile && htmlFile.size > 0) {
      fs.writeFileSync(path.join(pageDir, "index.html"), Buffer.from(await htmlFile.arrayBuffer()));
    }
    if (backendFile && backendFile.size > 0) {
      fs.writeFileSync(path.join(pageDir, "backend.py"), Buffer.from(await backendFile.arrayBuffer()));
    } else if (formData.get("removeBackend") === "true") {
      const backendPath = path.join(pageDir, "backend.py");
      if (fs.existsSync(backendPath)) fs.unlinkSync(backendPath);
    }

    return NextResponse.json({ ok: true, hasBackend: fs.existsSync(path.join(pageDir, "backend.py")) });
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
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, user.email)) {
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

    if (!fs.existsSync(path.join(PAGES_DIR, name, "index.html"))) {
      return NextResponse.json({ error: `Page "${name}" not found` }, { status: 404 });
    }
    if (!await canManagePage(name, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Rename: move filesystem directory + migrate settings ─────────────────
    const targetName = (newName?.trim() && newName.trim() !== name) ? newName.trim() : null;
    if (targetName !== null) {
      if (!/^[a-zA-Z0-9_-]+$/.test(targetName)) {
        return NextResponse.json({ error: "Page name must contain only letters, numbers, underscores and hyphens" }, { status: 400 });
      }
      const newDir = path.join(PAGES_DIR, targetName);
      if (fs.existsSync(newDir)) {
        return NextResponse.json({ error: `A page named "${targetName}" already exists` }, { status: 409 });
      }
      fs.renameSync(path.join(PAGES_DIR, name), newDir);
    }

    const finalName = targetName ?? name;
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
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { name } = body as { name: string };

    if (!name) return NextResponse.json({ error: "Page name is required" }, { status: 400 });

    const pageDir = path.join(PAGES_DIR, name);
    if (!fs.existsSync(path.join(pageDir, "index.html"))) {
      return NextResponse.json({ error: `Page "${name}" not found` }, { status: 404 });
    }
    if (!await canManagePage(name, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    fs.rmSync(pageDir, { recursive: true, force: true });
    await deletePageSettings(name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/pages] Failed to delete page:", e);
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
  }
}
