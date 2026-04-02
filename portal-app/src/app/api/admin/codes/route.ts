import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getAllProjects, canUserViewProject } from "@/lib/project-settings";
import {
  createAccessCode,
  getAccessCodesByProject,
  deleteAccessCode,
  generatePlaintextCode,
} from "@/lib/access-codes";
import { checkRateLimit } from "@/lib/utils";

const _rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;

function requireAuth(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}

/** GET /api/admin/codes?projectId=X — list codes for a project */
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

  // Only project managers can view codes
  if (!user.isAdmin && project.createdBy !== user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const codes = await getAccessCodesByProject(projectId);
  return NextResponse.json({
    codes: codes.map((c) => ({
      id: c.id,
      projectId: c.projectId,
      createdBy: c.createdBy,
      createdAt: c.createdAt.toISOString(),
      expiresAt: c.expiresAt.toISOString(),
    })),
  });
}

/** POST /api/admin/codes — generate a new code for a project */
export async function POST(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const user = getUserFromRequest(request);
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json() as { projectId?: string };
    const { projectId } = body;
    if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

    const projects = await getAllProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Only admins and project creators can generate codes
    if (!user.isAdmin && project.createdBy !== user.email) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const plaintext = generatePlaintextCode();
    const record = await createAccessCode(projectId, user.email, plaintext);

    return NextResponse.json({
      ok: true,
      // Plaintext code — shown ONCE; never returned again after this response
      code: plaintext,
      id: record.id,
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
    });
  } catch (e) {
    console.error("[admin/codes] Failed to create code:", e);
    return NextResponse.json({ error: "Failed to create code" }, { status: 500 });
  }
}

/** DELETE /api/admin/codes — revoke a code by id */
export async function DELETE(request: NextRequest) {
  const denied = requireAuth(request);
  if (denied) return denied;

  const user = getUserFromRequest(request);
  if (!checkRateLimit(_rateLimitMap, RATE_LIMIT, RATE_WINDOW, user.email)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const body = await request.json() as { id?: string };
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    // Resolve the code's project to check permissions
    const projects = await getAllProjects();
    const codes = await Promise.all(
      projects.map((p) => getAccessCodesByProject(p.id))
    );
    const flat = codes.flat();
    const target = flat.find((c) => c.id === body.id);
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const project = projects.find((p) => p.id === target.projectId);
    if (!project || (!user.isAdmin && project.createdBy !== user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await deleteAccessCode(body.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/codes] Failed to delete code:", e);
    return NextResponse.json({ error: "Failed to delete code" }, { status: 500 });
  }
}
