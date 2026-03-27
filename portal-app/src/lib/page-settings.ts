/**
 * Page settings store — PostgreSQL backed.
 *
 * Each page (active flag, allowed emails, icon, projects, order) is stored as a JSONB row.
 * An in-memory cache per instance avoids redundant DB round-trips on reads.
 * Writes invalidate only the updated entry so other entries stay cached.
 */

import { sql, ensureSchema } from "./db";
import { canUserViewProject, type Project } from "./project-settings";

export interface PageSettings {
  active: boolean;
  allowedEmails: string[];
  projectIds?: string[];   // a page can belong to multiple projects
  order?: number;
  icon?: string;
  iconColor?: string;
}

export interface PageMetadata extends PageSettings {
  name: string;
  hasBackend: boolean;
}

// Per-instance cache; null = not loaded yet
let _cache: Record<string, PageSettings> | null = null;

export async function getAllPageSettings(): Promise<Record<string, PageSettings>> {
  if (_cache !== null) return _cache;
  await ensureSchema();
  const rows = await sql<{ name: string; settings: unknown }[]>`
    SELECT name, settings FROM hyperset_page_settings
  `;
  const result: Record<string, PageSettings> = {};
  for (const row of rows) {
    const raw: Record<string, unknown> =
      typeof row.settings === "string"
        ? (JSON.parse(row.settings) as Record<string, unknown>)
        : (row.settings as Record<string, unknown>);

    // Migrate legacy single projectId → projectIds array
    if (!raw.projectIds && raw.projectId) {
      raw.projectIds = [raw.projectId as string];
    }

    result[row.name] = raw as PageSettings;
  }
  _cache = result;
  return result;
}

export async function getPageSettings(name: string): Promise<PageSettings> {
  const all = await getAllPageSettings();
  return all[name] ?? { active: true, allowedEmails: [], projectIds: [], order: 0 };
}

export async function setPageSettings(name: string, settings: PageSettings): Promise<void> {
  await ensureSchema();
  await sql`
    INSERT INTO hyperset_page_settings (name, settings)
    VALUES (${name}, ${JSON.stringify(settings)}::jsonb)
    ON CONFLICT (name) DO UPDATE SET settings = EXCLUDED.settings
  `;
  if (_cache) _cache[name] = settings;
}

export async function deletePageSettings(name: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM hyperset_page_settings WHERE name = ${name}`;
  if (_cache) delete _cache[name];
}

export async function canUserViewPage(
  name: string,
  email: string,
  isAdmin: boolean,
  projects: Project[],
): Promise<boolean> {
  const settings = await getPageSettings(name);
  if (!settings.active) return false;

  const projectIds = settings.projectIds ?? [];
  if (projectIds.length > 0) {
    // User can view if they have access to ANY of the page's projects
    return projectIds.some((pid) => {
      const project = projects.find((p) => p.id === pid);
      if (!project) return false;
      return canUserViewProject(project, email, isAdmin);
    });
  }

  // Standalone page (no projects) — check page-level allowedEmails
  if (settings.allowedEmails.length === 0) return true;
  return settings.allowedEmails.includes(email);
}
