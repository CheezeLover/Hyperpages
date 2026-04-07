import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, type HypersetUser } from "@/lib/auth";
import {
  getAllProjects,
  createProject,
  updateProject,
  deleteProject,
  canUserViewProject,
  type Project,
} from "@/lib/project-settings";
import { checkRateLimit } from "@/lib/utils";

const _rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function requireAuth(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

/** Full management: creator and admins only (rename, change membership, delete). */
function canManageProject(project: Project, user: HypersetUser): boolean {
  return user.isAdmin || project.createdBy === user.email;
}

/** Edit access: all members can rename/re-icon the project and manage pages. */
function canEditProject(project: Project, user: HypersetUser): boolean {
  return user.isAdmin || project.createdBy === user.email || project.allowedEmails.includes(user.email);
}

function validateSecureDomain(creatorEmail: string, memberEmails: string[]): string | null {
  const domain = creatorEmail.split("@")[1]?.toLowerCase();
  const offending = memberEmails.filter((e) => e.split("@")[1]?.toLowerCase() !== domain);
  return offending.length > 0 ? `Secure projects only allow members from the @${domain} domain.` : null;
}

/** GET /api/admin/projects — list projects visible to the caller */
export async function GET(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const user = getUserFromRequest(request);
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const all = await getAllProjects();
  const visible = all.filter((p) => canUserViewProject(p, user.email, user.isAdmin, user.guestProjectIds));
  return NextResponse.json({ projects: visible });
}

/** POST /api/admin/projects — create a new project */
export async function POST(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const user = getUserFromRequest(request);
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json() as {
      name?: string;
      icon?: string;
      iconColor?: string;
      allowedEmails?: string[];
      secure?: boolean;
    };

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    // Ensure the creator is always in allowedEmails
    const allowedEmails = Array.isArray(body.allowedEmails) ? body.allowedEmails : [];
    if (!allowedEmails.includes(user.email)) {
      allowedEmails.push(user.email);
    }

    // Secure projects: all member emails must share the creator's domain
    if (body.secure === true) {
      const err = validateSecureDomain(user.email, allowedEmails);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    const project = await createProject({
      name,
      icon: body.icon?.trim() || undefined,
      iconColor: body.iconColor?.trim() || undefined,
      allowedEmails,
      createdBy: user.email,
      secure: body.secure === true,
    });

    return NextResponse.json({ ok: true, project });
  } catch (e) {
    console.error("[admin/projects] Failed to create project:", e);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

/** PATCH /api/admin/projects — update a project (creator or admin) */
export async function PATCH(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const user = getUserFromRequest(request);
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json() as {
      id?: string;
      name?: string;
      icon?: string;
      iconColor?: string;
      allowedEmails?: string[];
    };

    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Project id is required" }, { status: 400 });
    }

    const all = await getAllProjects();
    const project = all.find((p) => p.id === id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!canEditProject(project, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only the creator and admins may change project membership
    let updatedEmails: string[] | undefined = canManageProject(project, user) && Array.isArray(body.allowedEmails)
      ? [...body.allowedEmails]
      : undefined;
    // Protect creator: ensure their email is never removed from the list
    if (updatedEmails !== undefined && project.createdBy && !updatedEmails.includes(project.createdBy)) {
      updatedEmails.push(project.createdBy);
    }

    // Secure projects: all member emails must share the creator's domain
    if (project.secure && updatedEmails !== undefined) {
      const err = validateSecureDomain(project.createdBy, updatedEmails);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    await updateProject(id, {
      name: body.name?.trim(),
      icon: body.icon !== undefined ? (body.icon.trim() || undefined) : undefined,
      iconColor: body.iconColor !== undefined ? (body.iconColor.trim() || undefined) : undefined,
      allowedEmails: updatedEmails,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/projects] Failed to update project:", e);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

/** DELETE /api/admin/projects — delete a project (creator or admin) */
export async function DELETE(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const user = getUserFromRequest(request);
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json() as { id?: string };
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Project id is required" }, { status: 400 });
    }

    const all = await getAllProjects();
    const project = all.find((p) => p.id === id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!canManageProject(project, user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/projects] Failed to delete project:", e);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
