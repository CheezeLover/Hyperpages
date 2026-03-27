import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, type HypersetUser } from "@/lib/auth";
import { getAllPageSettings, setPageSettings, deletePageSettings, getPageSettings, type PageSettings } from "@/lib/page-settings";
import { getAllProjects } from "@/lib/project-settings";
import fs from "fs";
import path from "path";

const PAGES_DIR = process.env.PAGES_DIR ?? path.join(process.cwd(), "pages");

import { checkRateLimit } from "@/lib/utils";

const _rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function requireAuth(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

async function canManagePage(pageName: string, user: HypersetUser): Promise<boolean> {
  if (user.isAdmin) return true;
  const settings = await getPageSettings(pageName);
  if (settings.createdBy === user.email) return true;
  const projectIds = settings.projectIds ?? [];
  if (projectIds.length === 0) return false;
  const allProjects = await getAllProjects();
  return projectIds.some((pid) => {
    const project = allProjects.find((p) => p.id === pid);
    return project?.createdBy === user.email;
  });
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
          pages.push({
            name: entry.name,
            hasBackend: fs.existsSync(backendPath),
          });
        }
      }
    }
  } catch (e) {
    console.error("[admin/pages] Failed to scan pages directory:", e);
  }
  return pages.sort((a, b) => a.name.localeCompare(b.name));
}

/** GET /api/admin/pages — list all pages with their metadata (any authenticated user) */
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
    allowedEmails: settings[p.name]?.allowedEmails ?? [],
    projectIds: settings[p.name]?.projectIds ?? [],
    order: settings[p.name]?.order ?? 0,
    icon: settings[p.name]?.icon,
    iconColor: settings[p.name]?.iconColor,
    createdBy: settings[p.name]?.createdBy,
    projectOverrides: settings[p.name]?.projectOverrides ?? {},
  }));

  return NextResponse.json({ pages: pagesWithMeta });
}

/** POST /api/admin/pages — upload a new page */
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

    // projectIds sent as JSON array string
    let projectIds: string[] = [];
    const projectIdsRaw = formData.get("projectIds")?.toString();
    if (projectIdsRaw) {
      try { projectIds = JSON.parse(projectIdsRaw) as string[]; } catch { /* ignore */ }
    }

    if (!name) {
      return NextResponse.json({ error: "Page name is required" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json({ error: "Page name must contain only letters, numbers, underscores and hyphens" }, { status: 400 });
    }
    if (!htmlFile) {
      return NextResponse.json({ error: "HTML file is required" }, { status: 400 });
    }

    // Authorization: must be creator of at least one target project, or isAdmin for unassigned
    if (projectIds.length > 0) {
      const allProjects = await getAllProjects();
      const canUpload = projectIds.every((pid) => {
        const project = allProjects.find((p) => p.id === pid);
        if (!project) return false;
        return user.isAdmin || project.createdBy === user.email;
      });
      if (!canUpload) {
        return NextResponse.json({ error: "Forbidden: you can only add pages to your own projects" }, { status: 403 });
      }
    } else if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden: only admins can add unassigned pages" }, { status: 403 });
    }

    const pageDir = path.join(PAGES_DIR, name);
    if (fs.existsSync(pageDir)) {
      return NextResponse.json({ error: `Page "${name}" already exists` }, { status: 400 });
    }

    fs.mkdirSync(pageDir, { recursive: true });
    const htmlBuffer = Buffer.from(await htmlFile.arrayBuffer());
    fs.writeFileSync(path.join(pageDir, "index.html"), htmlBuffer);

    if (backendFile && backendFile.size > 0) {
      const backendBuffer = Buffer.from(await backendFile.arrayBuffer());
      fs.writeFileSync(path.join(pageDir, "backend.py"), backendBuffer);
    }

    // Creator is always added to allowedEmails
    const creatorEmail = user.email;
    const pageAllowedEmails = creatorEmail ? [creatorEmail] : [];
    await setPageSettings(name, { active: true, allowedEmails: pageAllowedEmails, projectIds, order: 0, icon, iconColor, createdBy: creatorEmail, projectOverrides: {} });

    return NextResponse.json({
      ok: true,
      page: { name, hasBackend: !!backendFile && backendFile.size > 0, active: true, allowedEmails: pageAllowedEmails, projectIds, order: 0, icon, iconColor, createdBy: creatorEmail, projectOverrides: {} }
    });
  } catch (e) {
    console.error("[admin/pages] Failed to upload page:", e);
    return NextResponse.json({ error: "Failed to upload page" }, { status: 500 });
  }
}

/** PUT /api/admin/pages — update page files */
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

/** PATCH /api/admin/pages — update page settings */
export async function PATCH(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const user = getUserFromRequest(request);
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { name, active, allowedEmails, projectIds, order, icon, iconColor, projectId } = body as {
      name: string;
      active?: boolean;
      allowedEmails?: string[];
      projectIds?: string[];
      order?: number;
      icon?: string;
      iconColor?: string;
      /** When set, active/order are written as per-project overrides instead of global fields. */
      projectId?: string;
    };

    if (!name) return NextResponse.json({ error: "Page name is required" }, { status: 400 });

    const pageDir = path.join(PAGES_DIR, name);
    if (!fs.existsSync(path.join(pageDir, "index.html"))) {
      return NextResponse.json({ error: `Page "${name}" not found` }, { status: 404 });
    }
    if (!await canManagePage(name, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const current = (await getAllPageSettings())[name] ?? { active: true, allowedEmails: [], projectIds: [], projectOverrides: {} };
    const finalEmails = allowedEmails !== undefined ? [...allowedEmails] : [...(current.allowedEmails ?? [])];
    // Protect creator: ensure their email is never removed from the list
    if (current.createdBy && !finalEmails.includes(current.createdBy)) {
      finalEmails.push(current.createdBy);
    }

    const currentOverrides = current.projectOverrides ?? {};
    let nextOverrides = currentOverrides;
    if (projectId !== undefined && (active !== undefined || order !== undefined)) {
      // Per-project active/order override
      const cur = currentOverrides[projectId] ?? { active: true, order: 0 };
      nextOverrides = {
        ...currentOverrides,
        [projectId]: {
          active: active !== undefined ? active : cur.active,
          order: order !== undefined ? order : cur.order,
        },
      };
    }

    const updated: PageSettings = {
      active: projectId !== undefined ? (current.active ?? true) : (active !== undefined ? active : (current.active ?? true)),
      allowedEmails: finalEmails,
      projectIds: projectIds !== undefined ? projectIds : (current.projectIds ?? []),
      order: projectId !== undefined ? (current.order ?? 0) : (order !== undefined ? order : (current.order ?? 0)),
      icon: icon !== undefined ? icon : current.icon,
      iconColor: iconColor !== undefined ? iconColor : current.iconColor,
      createdBy: current.createdBy,
      projectOverrides: nextOverrides,
    };

    await setPageSettings(name, updated);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/pages] Failed to update page:", e);
    return NextResponse.json({ error: "Failed to update page" }, { status: 500 });
  }
}

/** DELETE /api/admin/pages — delete a page */
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
