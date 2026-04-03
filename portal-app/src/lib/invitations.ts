/**
 * Project invitations — signed email confirmation tokens for secure projects.
 *
 * Flow:
 *  1. Admin adds a new email to a secure project → server creates an invitation
 *     record and returns a one-time URL containing the plaintext token.
 *  2. Admin shares the URL with the intended user (manually or by email).
 *  3. User visits /api/invite/{token} → token validated, email added to
 *     allowed_emails, invitation marked accepted.
 *
 * The plaintext token is returned only once (at creation) and is never stored.
 * Only its SHA-256 hash is persisted, matching the pattern used for access codes.
 */

import { createHash, randomBytes } from "crypto";
import { randomUUID } from "crypto";
import { sql, ensureSchema } from "./db";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Invitation {
  id: string;
  projectId: string;
  email: string;
  invitedBy: string;
  createdAt: Date;
  expiresAt: Date;
  acceptedAt: Date | null;
}

// ── Token helpers ──────────────────────────────────────────────────────────────

const INVITATION_TTL_DAYS = 7;

/** Generate a cryptographically random 32-byte hex token (shown once). */
export function generateInviteToken(): string {
  return randomBytes(32).toString("hex");
}

/** SHA-256 of the token — the only value persisted. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── DB operations ──────────────────────────────────────────────────────────────

export async function createInvitation(
  projectId: string,
  email: string,
  invitedBy: string,
  plaintextToken: string,
): Promise<Invitation> {
  await ensureSchema();
  const id = randomUUID();
  const tokenHash = hashInviteToken(plaintextToken);
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const normalizedEmail = email.toLowerCase().trim();

  await sql`
    INSERT INTO hyperset_project_invitations
      (id, project_id, email, token_hash, invited_by, expires_at)
    VALUES
      (${id}, ${projectId}, ${normalizedEmail}, ${tokenHash}, ${invitedBy}, ${expiresAt})
  `;

  return {
    id,
    projectId,
    email: normalizedEmail,
    invitedBy,
    createdAt: new Date(),
    expiresAt,
    acceptedAt: null,
  };
}

export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  await ensureSchema();
  const tokenHash = hashInviteToken(token);
  const rows = await sql<{
    id: string;
    project_id: string;
    email: string;
    invited_by: string;
    created_at: Date;
    expires_at: Date;
    accepted_at: Date | null;
  }[]>`
    SELECT id, project_id, email, invited_by, created_at, expires_at, accepted_at
    FROM hyperset_project_invitations
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    projectId: r.project_id,
    email: r.email,
    invitedBy: r.invited_by,
    createdAt: new Date(r.created_at),
    expiresAt: new Date(r.expires_at),
    acceptedAt: r.accepted_at ? new Date(r.accepted_at) : null,
  };
}

export async function getPendingInvitations(projectId: string): Promise<Invitation[]> {
  await ensureSchema();
  const rows = await sql<{
    id: string;
    email: string;
    invited_by: string;
    created_at: Date;
    expires_at: Date;
  }[]>`
    SELECT id, email, invited_by, created_at, expires_at
    FROM hyperset_project_invitations
    WHERE project_id = ${projectId}
      AND accepted_at IS NULL
      AND expires_at > NOW()
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    projectId,
    email: r.email,
    invitedBy: r.invited_by,
    createdAt: new Date(r.created_at),
    expiresAt: new Date(r.expires_at),
    acceptedAt: null,
  }));
}

export async function markInvitationAccepted(id: string): Promise<void> {
  await sql`
    UPDATE hyperset_project_invitations
    SET accepted_at = NOW()
    WHERE id = ${id}
  `;
}

export async function deleteInvitation(id: string): Promise<void> {
  await sql`DELETE FROM hyperset_project_invitations WHERE id = ${id}`;
}

/** Remove all invitations (pending and accepted) for a project — used on project deletion. */
export async function deleteInvitationsByProject(projectId: string): Promise<void> {
  await sql`DELETE FROM hyperset_project_invitations WHERE project_id = ${projectId}`;
}
