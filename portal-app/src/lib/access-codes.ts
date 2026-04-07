/**
 * Access codes — short-lived invite codes that give read-only guest access
 * to a specific project without requiring SSO.
 *
 * Flow:
 *  1. Admin generates a code → plaintext shown once, SHA-256 hash stored in DB.
 *  2. Guest visits /join/{code} → portal validates hash, issues a Caddy-compatible
 *     HS512 JWT cookie (access_token) containing a project-scoped role, redirects.
 *  3. Caddy validates the cookie on subsequent requests and injects user headers.
 *  4. The portal reads the hyperset/project/{id} role to grant view-only access.
 */

import { createHash, createHmac, randomUUID } from "crypto";
import { sql, ensureSchema } from "./db";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AccessCode {
  id: string;
  projectId: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
}

// ── Code generation ────────────────────────────────────────────────────────────

/**
 * Unicode alphabet drawn from multiple scripts.
 * Homoglyphs that look identical to Latin characters are excluded from each
 * script (e.g. Greek Α/Β/Ε/Ζ/Η/Ι/Κ/Μ/Ν/Ο/Ρ/Τ/Υ/Χ, Cyrillic А/В/Е/К/М/Н/О/Р/С/Т/Х).
 * All characters are printable, non-combining, and safe in percent-encoded URLs.
 */
const CODE_ALPHABET_CHARS: string[] = [
  // Latin — no ambiguous (O≈0, I/L≈1)
  ..."ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
  // Greek uppercase — homoglyphs removed
  ..."ΓΔΘΛΞΠΣΦΨΩ",
  // Cyrillic uppercase — homoglyphs removed
  ..."БВГДЖЗИЙЛПФЦЧШЩЭЮЯ",
  // Armenian uppercase
  ..."ԲԳԴԵԶԷԸԺԻԾԿՀՁՂՃՄՅՆՇՈՉՊՋՌՍՎՏՐՑՒՓՔ",
  // Georgian Mkhedruli (unicase script)
  ..."ბგდვზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ",
  // Hiragana (base 46)
  ..."あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん",
  // Katakana (base 46 — visually distinct from Hiragana)
  ..."アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン",
  // CJK common characters (simple, high-frequency)
  ..."一二三四五六七八九十百千万大小中上下左右火水木金土日月山川",
  // Hangul syllables (common)
  ..."가나다라마바사아자차카타파하",
  // Thai consonants
  ..."กขคงจฉชซดตถทนบปผพฟมยรลวสหอ",
  // Devanagari consonants (standalone, no vowel marks)
  ..."कखगघचछजझटठडढतथदधनपफबभमयरलवशषस",
];

// Deduplicate (safety net) and freeze into a plain array for O(1) index access.
const CODE_CHARS = [...new Set(CODE_ALPHABET_CHARS)];

const CODE_LENGTH = 5;
const CODE_TTL_DAYS = 30;

/**
 * Generates a random CODE_LENGTH-character code drawn uniformly from CODE_CHARS.
 * Uses Uint32 values + rejection sampling so there is zero modulo bias regardless
 * of alphabet size (works for any alphabet up to 2^32 characters).
 */
export function generatePlaintextCode(): string {
  const n = CODE_CHARS.length;
  // Largest multiple of n that fits in uint32 — values >= limit are rejected.
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const result: string[] = [];
  while (result.length < CODE_LENGTH) {
    const buf = new Uint32Array(CODE_LENGTH * 2); // over-generate to minimise loops
    crypto.getRandomValues(buf);
    for (const val of buf) {
      if (result.length >= CODE_LENGTH) break;
      if (val < limit) result.push(CODE_CHARS[val % n]);
    }
  }
  return result.join("");
}

export function hashCode(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

// ── DB operations ──────────────────────────────────────────────────────────────

export async function createAccessCode(
  projectId: string,
  createdBy: string,
  plaintext: string,
): Promise<AccessCode> {
  await ensureSchema();
  const id = randomUUID();
  const codeHash = hashCode(plaintext);
  const expiresAt = new Date(Date.now() + CODE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO hyperset_access_codes (id, project_id, code_hash, created_by, expires_at)
    VALUES (${id}, ${projectId}, ${codeHash}, ${createdBy}, ${expiresAt})
  `;

  return { id, projectId, createdBy, createdAt: new Date(), expiresAt };
}

export async function getAccessCodesByProject(projectId: string): Promise<AccessCode[]> {
  await ensureSchema();
  const rows = await sql<{
    id: string;
    project_id: string;
    created_by: string;
    created_at: Date;
    expires_at: Date;
  }[]>`
    SELECT id, project_id, created_by, created_at, expires_at
    FROM hyperset_access_codes
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    createdBy: r.created_by,
    createdAt: new Date(r.created_at),
    expiresAt: new Date(r.expires_at),
  }));
}

export async function getAccessCodeByHash(codeHash: string): Promise<AccessCode | null> {
  await ensureSchema();
  const rows = await sql<{
    id: string;
    project_id: string;
    created_by: string;
    created_at: Date;
    expires_at: Date;
  }[]>`
    SELECT id, project_id, created_by, created_at, expires_at
    FROM hyperset_access_codes
    WHERE code_hash = ${codeHash}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    projectId: r.project_id,
    createdBy: r.created_by,
    createdAt: new Date(r.created_at),
    expiresAt: new Date(r.expires_at),
  };
}

export async function deleteAccessCode(id: string): Promise<void> {
  await ensureSchema();
  await sql`DELETE FROM hyperset_access_codes WHERE id = ${id}`;
}

// ── JWT issuance ───────────────────────────────────────────────────────────────
//
// Issues a HS512 JWT compatible with caddy-security's authorization policy.
// The token carries the role  hyperset/project/{projectId}  so the portal can
// grant read-only access to that specific project without a DB lookup on every
// request.
//
// Cookie name:  access_token  (caddy-security default)
// Cookie domain: .{HYPERSET_DOMAIN}  (covers both portal and pages subdomains)
//
// IMPORTANT: AUTH_CRYPTO_KEY must be added to the portal container's env so the
// portal can sign tokens with the same key Caddy uses to verify them.

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

export function issueGuestJWT(params: {
  codeId: string;
  projectId: string;
  expiresAt: Date;
  authCryptoKey: string;
}): string {
  const { codeId, projectId, expiresAt, authCryptoKey } = params;
  // caddy-security signs with []byte(keyString) — raw UTF-8 bytes of the hex string,
  // NOT the hex-decoded binary. Pass the string directly so Node uses the same bytes.
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(Buffer.from(JSON.stringify({ alg: "HS512", typ: "JWT" })));
  const payload = base64url(
    Buffer.from(
      JSON.stringify({
        exp: Math.floor(expiresAt.getTime() / 1000),
        iat: now,
        jti: randomUUID(),
        sub: `guest-${codeId}`,
        email: `guest-${codeId}@hyperset.internal`,
        name: "Guest",
        // hyperset/user satisfies "allow roles hyperset/user" in the Caddyfile policy.
        // hyperset/project/{id} lets the portal resolve which project this guest may view.
        roles: ["authp/user", "hyperset/user", `hyperset/project/${projectId}`],
        origin: "hyperset-invite",
      }),
    ),
  );

  const sigInput = `${header}.${payload}`;
  const sig = base64url(createHmac("sha512", authCryptoKey).update(sigInput).digest());
  return `${sigInput}.${sig}`;
}
