/**
 * TEMPORARY DIAGNOSTIC ENDPOINT — remove after debugging the 401 issue.
 *
 * GET /api/debug
 * Returns the auth headers that Caddy forwards to the portal so we can
 * verify what caddy-security's inject-headers-with-claims is injecting.
 * The route still goes through Caddy's authorize policy, so only holders
 * of a valid JWT can reach it.
 */
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    // Only expose auth-related and hyperset headers, not every internal header
    if (
      key.startsWith("x-token-") ||
      key.startsWith("x-forwarded-") ||
      key === "host" ||
      key === "cookie"
    ) {
      // Redact the cookie value for safety (just show if present)
      headers[key] = key === "cookie" ? "(present, redacted)" : value;
    }
  });

  return NextResponse.json({ headers }, { status: 200 });
}
