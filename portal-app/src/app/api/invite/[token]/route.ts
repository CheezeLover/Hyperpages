import { type NextRequest, NextResponse } from "next/server";
import { getInvitationByToken, markInvitationAccepted } from "@/lib/invitations";
import { getProject, updateProject } from "@/lib/project-settings";
import { getCurrentUser } from "@/lib/auth";

/**
 * GET /api/invite/{token}
 *
 * Accepts a project invitation. The visitor must be authenticated (Caddy
 * injects x-token-user-email). The email in the JWT must match the email
 * the invitation was issued for, so the token cannot be forwarded to grant
 * a different person access.
 *
 * On success: adds email to project.allowedEmails and redirects to the project.
 * On failure: redirects to /join?error=... with a descriptive code.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const domain = (process.env.HYPERSET_DOMAIN || "").trim() || "hyperset.internal";
  const externalOrigin = `https://${domain}`;
  const errorUrl = new URL("/join", externalOrigin);

  if (!token || token.length < 32) {
    errorUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(errorUrl);
  }

  // 1. Look up the invitation
  const invitation = await getInvitationByToken(token).catch(() => null);
  if (!invitation) {
    errorUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(errorUrl);
  }

  if (invitation.expiresAt < new Date()) {
    errorUrl.searchParams.set("error", "expired");
    return NextResponse.redirect(errorUrl);
  }

  if (invitation.acceptedAt !== null) {
    errorUrl.searchParams.set("error", "already_accepted");
    return NextResponse.redirect(errorUrl);
  }

  // 2. Verify the caller's authenticated email matches the invitation
  const user = await getCurrentUser().catch(() => null);
  if (!user?.email) {
    // Not authenticated — Caddy should have blocked unauthenticated requests,
    // but guard here for direct Next.js port access.
    errorUrl.searchParams.set("error", "unauthenticated");
    return NextResponse.redirect(errorUrl);
  }

  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    errorUrl.searchParams.set("error", "email_mismatch");
    return NextResponse.redirect(errorUrl);
  }

  // 3. Resolve the project
  const project = await getProject(invitation.projectId).catch(() => null);
  if (!project) {
    errorUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(errorUrl);
  }

  // 4. Add the email to allowedEmails (idempotent) and mark invitation accepted
  if (!project.allowedEmails.map((e) => e.toLowerCase()).includes(invitation.email.toLowerCase())) {
    await updateProject(project.id, {
      allowedEmails: [...project.allowedEmails, invitation.email],
    });
  }
  await markInvitationAccepted(invitation.id);

  // 5. Redirect to the project page
  const dest = new URL(`/${encodeURIComponent(project.name)}`, externalOrigin);
  return NextResponse.redirect(dest);
}
