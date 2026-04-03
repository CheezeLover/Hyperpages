import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getAllProjects, canUserViewProject } from "@/lib/project-settings";
import { getPendingInvitations, deleteInvitation } from "@/lib/invitations";
import { checkRateLimit } from "@/lib/utils";

const _rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function requireAuth(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

/** GET /api/admin/invitations?projectId=X — list pending invitations for a project */
export async function GET(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const user = getUserFromRequest(request);
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const projects = await getAllProjects();
  const project = projects.find((p) => p.id === projectId);
  if (!project || !canUserViewProject(project, user.email, user.isAdmin)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only project managers can view invitations
  if (!user.isAdmin && project.createdBy !== user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invitations = await getPendingInvitations(projectId);
  return NextResponse.json({
    invitations: invitations.map((inv) => ({
      id: inv.id,
      email: inv.email,
      invitedBy: inv.invitedBy,
      createdAt: inv.createdAt.toISOString(),
      expiresAt: inv.expiresAt.toISOString(),
    })),
  });
}

/** DELETE /api/admin/invitations — revoke a pending invitation by id */
export async function DELETE(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const user = getUserFromRequest(request);
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json() as { id?: string; projectId?: string };
    if (!body.id || !body.projectId) {
      return NextResponse.json({ error: "id and projectId are required" }, { status: 400 });
    }

    const projects = await getAllProjects();
    const project = projects.find((p) => p.id === body.projectId);
    if (!project || (!user.isAdmin && project.createdBy !== user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteInvitation(body.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/invitations] Failed to revoke invitation:", e);
    return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 });
  }
}
