/**
 * Project settings store — PostgreSQL backed.
 *
 * Projects group pages and provide email-based access control.
 * An in-memory cache per instance avoids redundant DB round-trips on reads.
 */

import { sql, ensureSchema } from "./db";
import { randomUUID } from "crypto";

export interface Project {
  id: string;
  name: string;
  icon?: string;
  iconColor?: string;
  allowedEmails: string[];
  createdBy: string;
  /** Set once at creation; permanently disables guest invite codes. */
  secure: boolean;
}

// Per-instance cache; null = not loaded yet
let _cache: Project[] | null = null;

export function invalidateProjectCache(): void {
  _cache = null;
}

export async function getAllProjects(): Promise<Project[]> {
  if (_cache !== null) return _cache;
  await ensureSchema();
  const rows = await sql<{
    id: string;
    name: string;
    icon: string | null;
    icon_color: string | null;
    allowed_emails: string[];
    created_by: string;
    secure: boolean;
  }[]>`SELECT id, name, icon, icon_color, allowed_emails, created_by, secure FROM hyperset_projects ORDER BY name`;
  _cache = rows.map((r) => ({
    id: r.id,
    name: r.name,
    icon: r.icon ?? undefined,
    iconColor: r.icon_color ?? undefined,
    allowedEmails: r.allowed_emails,
    createdBy: r.created_by,
    secure: r.secure ?? false,
  }));
  return _cache;
}

export async function getProject(id: string): Promise<Project | null> {
  const all = await getAllProjects();
  return all.find((p) => p.id === id) ?? null;
}

export async function createProject(data: Omit<Project, "id">): Promise<Project> {
  await ensureSchema();
  const id = randomUUID();
  await sql`
    INSERT INTO hyperset_projects (id, name, icon, icon_color, allowed_emails, created_by, secure)
    VALUES (
      ${id}, ${data.name},
      ${data.icon ?? null}, ${data.iconColor ?? null},
      ${data.allowedEmails}, ${data.createdBy},
      ${data.secure ?? false}
    )
  `;
  // Defensive: purge any stale access codes that might reference this project id.
  // Under normal operation there are none (the project is brand-new), but this
  // prevents a hypothetical id-reuse or race condition from granting guest access
  // to a secure project.
  if (data.secure) {
    await sql`DELETE FROM hyperset_access_codes WHERE project_id = ${id}`;
  }
  invalidateProjectCache();
  return { id, ...data };
}

export async function updateProject(
  id: string,
  patch: Partial<Omit<Project, "id" | "createdBy" | "secure">>,
): Promise<void> {
  await ensureSchema();
  const proj = await getProject(id);
  if (!proj) throw new Error(`Project ${id} not found`);
  const merged = {
    name: patch.name ?? proj.name,
    icon: patch.icon !== undefined ? patch.icon : proj.icon,
    iconColor: patch.iconColor !== undefined ? patch.iconColor : proj.iconColor,
    allowedEmails: patch.allowedEmails ?? proj.allowedEmails,
  };
  await sql`
    UPDATE hyperset_projects SET
      name           = ${merged.name},
      icon           = ${merged.icon ?? null},
      icon_color     = ${merged.iconColor ?? null},
      allowed_emails = ${merged.allowedEmails}
    WHERE id = ${id}
  `;
  invalidateProjectCache();
}

export async function deleteProject(id: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM hyperset_projects WHERE id = ${id}`;
  invalidateProjectCache();
}

/**
 * Returns true if a user (by email) can see the given project.
 * isAdmin sees all; createdBy always sees it; email in allowedEmails sees it.
 * Secure projects never grant access via guest JWT tokens.
 */
export function canUserViewProject(
  project: Project,
  email: string,
  isAdmin: boolean,
  guestProjectIds: string[] = [],
): boolean {
  if (isAdmin) return true;
  if (project.createdBy === email) return true;
  if (project.allowedEmails.includes(email)) return true;
  // Guest JWT tokens (from invite codes) are blocked entirely for secure projects.
  if (project.secure) return false;
  return guestProjectIds.includes(project.id);
}
