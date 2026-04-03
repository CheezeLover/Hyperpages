/**
 * PostgreSQL client shared across all server-side modules.
 *
 * Connection string is read from PORTAL_DATABASE_URL (set in compose).
 * The global singleton avoids creating a new pool on every Next.js hot-reload
 * in development.
 *
 * Schema migrations run once on first use — CREATE TABLE IF NOT EXISTS is
 * idempotent so multiple instances starting in parallel is safe.
 */

import postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __pgSql: SqlClient | undefined;
}

// No module-level throw: `next build` imports every route without production
// env vars. Throwing here crashes the build. Instead we export checkDbConfig()
// which is called at request time (health probe, ensureSchema). The pod health
// probe runs immediately on startup so misconfiguration is caught within seconds.

/**
 * Validate the DB config at request/startup time.
 * Call this in any route or startup function that needs a clear error message
 * rather than a raw postgres connection failure.
 */
export function checkDbConfig(): void {
  const url = process.env.PORTAL_DATABASE_URL;
  if (!url) {
    throw new Error(
      "[db] PORTAL_DATABASE_URL is not set. " +
        "Set it to the full PostgreSQL connection string.",
    );
  }
  if (url.includes("portal:portal@")) {
    throw new Error(
      "[db] PORTAL_DATABASE_URL uses the default weak credentials (portal:portal). " +
        "Set PORTAL_DATABASE_PASSWORD in your .env file.",
    );
  }
}

// The client is created eagerly so the connection pool is ready on first query.
// If PORTAL_DATABASE_URL is unset the pool creation succeeds but the first
// query will fail — checkDbConfig() (called from /api/health) gives the clear
// error message before that happens.
const _dbPoolMax = parseInt(process.env.DB_POOL_MAX ?? "10", 10);
export const sql: SqlClient =
  globalThis.__pgSql ??
  postgres(process.env.PORTAL_DATABASE_URL ?? "", {
    max: Number.isFinite(_dbPoolMax) && _dbPoolMax > 0 ? _dbPoolMax : 10,
    // Include public in the search_path so that objects installed there by the
    // superuser (e.g. the pgvector `vector` type) are visible to the portal role,
    // which only owns the `portal` schema.
    connection: { search_path: '"$user", public' },
  });

if (process.env.NODE_ENV !== "production") globalThis.__pgSql = sql;

// ── Schema migration ─────────────────────────────────────────────────────────
// Runs once per process; subsequent calls return the cached promise.
let _schemaInit: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (_schemaInit) return _schemaInit;
  _schemaInit = _runMigrations().catch((err) => {
    _schemaInit = null; // allow retry on transient failures
    throw err;
  });
  return _schemaInit;
}

async function _runMigrations(): Promise<void> {
  checkDbConfig();

  await sql`
    CREATE TABLE IF NOT EXISTS hyperset_page_settings (
      name     TEXT PRIMARY KEY,
      settings JSONB NOT NULL
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS hyperset_projects (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      icon           TEXT,
      icon_color     TEXT,
      allowed_emails TEXT[] NOT NULL DEFAULT '{}',
      created_by     TEXT NOT NULL
    )
  `;

  await sql`
    ALTER TABLE hyperset_projects
    ADD COLUMN IF NOT EXISTS read_only_emails TEXT[] NOT NULL DEFAULT '{}'
  `;

  await sql`
    ALTER TABLE hyperset_projects
    ADD COLUMN IF NOT EXISTS secure BOOLEAN NOT NULL DEFAULT FALSE
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS hyperset_access_codes (
      id          TEXT        PRIMARY KEY,
      project_id  TEXT        NOT NULL,
      code_hash   TEXT        NOT NULL UNIQUE,
      created_by  TEXT        NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS hyperset_access_codes_project_idx
    ON hyperset_access_codes (project_id)
  `;

  // ── Secure flag immutability ────────────────────────────────────────────────
  // Prevent the `secure` column from ever being set back to false once true.
  // This is enforced at the DB level so no application path can bypass it.
  await sql`
    CREATE OR REPLACE FUNCTION hyperset_prevent_secure_downgrade()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
    BEGIN
      IF OLD.secure = TRUE AND NEW.secure = FALSE THEN
        RAISE EXCEPTION 'secure flag cannot be unset on project %', OLD.id
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN NEW;
    END;
    $$
  `;

  await sql`
    DROP TRIGGER IF EXISTS hyperset_projects_secure_immutable ON hyperset_projects
  `;

  await sql`
    CREATE TRIGGER hyperset_projects_secure_immutable
    BEFORE UPDATE ON hyperset_projects
    FOR EACH ROW EXECUTE FUNCTION hyperset_prevent_secure_downgrade()
  `;

  // ── Project invitations ─────────────────────────────────────────────────────
  // Signed invitation tokens for secure projects. An email is only added to
  // allowed_emails after the recipient accepts by visiting the invite URL.
  await sql`
    CREATE TABLE IF NOT EXISTS hyperset_project_invitations (
      id          TEXT        PRIMARY KEY,
      project_id  TEXT        NOT NULL REFERENCES hyperset_projects(id) ON DELETE CASCADE,
      email       TEXT        NOT NULL,
      token_hash  TEXT        NOT NULL UNIQUE,
      invited_by  TEXT        NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS hyperset_invitations_project_idx
    ON hyperset_project_invitations (project_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS hyperset_invitations_token_idx
    ON hyperset_project_invitations (token_hash)
  `;

  console.log("[db] Schema ready");
}
