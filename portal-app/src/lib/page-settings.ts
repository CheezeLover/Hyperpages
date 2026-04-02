/**
 * Page settings store — PostgreSQL backed.
 *
 * Each page (active flag, icon, project, order, creator) is stored as a JSONB row.
 * Access is controlled at the project level — pages do not have their own email list.
 * An in-memory cache per instance avoids redundant DB round-trips on reads.
 */

import { sql, ensureSchema } from "./db";
import { canUserViewProject, type Project } from "./project-settings";

export interface PageSettings {
  active?: boolean;
  projectId?: string;
  order?: number;
  icon?: string;
  iconColor?: string;
  createdBy?: string;
}

export interface PageMetadata extends PageSettings {
  name: string;
  hasBackend: boolean;
}

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

    // Migrate legacy projectIds array → single projectId (take first entry)
    if (!raw.projectId && Array.isArray(raw.projectIds) && (raw.projectIds as string[]).length > 0) {
      raw.projectId = (raw.projectIds as string[])[0];
    }

    result[row.name] = raw as unknown as PageSettings;
  }
  _cache = result;
  return result;
}

export async function getPageSettings(name: string): Promise<PageSettings> {
  const all = await getAllPageSettings();
  return all[name] ?? { active: true, order: 0 };
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
  guestProjectIds: string[] = [],
): Promise<boolean> {
  const settings = await getPageSettings(name);
  if (settings.active === false) return false;
  if (isAdmin) return true;
  // Creator always has access to their own page
  if (settings.createdBy && settings.createdBy === email) return true;
  // Access is granted through the page's project
  if (settings.projectId) {
    const project = projects.find((p) => p.id === settings.projectId);
    if (project) return canUserViewProject(project, email, isAdmin, guestProjectIds);
  }
  return false;
}
