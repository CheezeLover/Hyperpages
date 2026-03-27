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

  console.log("[db] Schema ready");
}
