import { type NextRequest, NextResponse } from "next/server";
import { getAccessCodeByHash, hashCode, issueGuestJWT } from "@/lib/access-codes";
import { getProject } from "@/lib/project-settings";
import { checkRateLimit } from "@/lib/utils";

// Strict rate limit: 10 attempts per 15 minutes per IP.
// This endpoint is unauthenticated, so IP is the only available key.
// Without this limit, the 5-char / 32-alphabet code space (~33M) is
// exhaustible by brute-force in a matter of hours.
const _joinRateLimitMap = new Map<string, number[]>();
const JOIN_RATE_LIMIT = 10;
const JOIN_RATE_WINDOW = 15 * 60_000; // 15 minutes

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const domain = (process.env.HYPERSET_DOMAIN || "").trim() || "hyperset.internal";
  const externalOrigin = `https://${domain}`;
  const errorUrl = new URL("/join", externalOrigin);

  const ip = getClientIp(_request);
  if (!checkRateLimit(_joinRateLimitMap, JOIN_RATE_LIMIT, JOIN_RATE_WINDOW, ip)) {
    errorUrl.searchParams.set("error", "rate_limited");
    return NextResponse.redirect(errorUrl);
  }

  if (!code || [...code].length !== 5) {
    errorUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(errorUrl);
  }

  // 1. Look up the code by hash
  const codeHash = hashCode(code);
  const record = await getAccessCodeByHash(codeHash).catch(() => null);

  if (!record) {
    errorUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(errorUrl);
  }

  if (record.expiresAt < new Date()) {
    errorUrl.searchParams.set("error", "expired");
    return NextResponse.redirect(errorUrl);
  }

  // 2. Resolve the project
  const project = await getProject(record.projectId).catch(() => null);
  if (!project) {
    errorUrl.searchParams.set("error", "invalid");
    return NextResponse.redirect(errorUrl);
  }

  // Secure projects never accept guest tokens — reject even if a code somehow
  // exists (e.g. created before the project was flagged secure, or a race).
  if (project.secure) {
    errorUrl.searchParams.set("error", "forbidden");
    return NextResponse.redirect(errorUrl);
  }

  // 3. Issue a Caddy-compatible JWT and set it as the access_token cookie
  const authCryptoKey = process.env.AUTH_CRYPTO_KEY;

  if (!authCryptoKey) {
    console.error("[join] AUTH_CRYPTO_KEY is not set — cannot issue guest JWT");
    errorUrl.searchParams.set("error", "config");
    return NextResponse.redirect(errorUrl);
  }

  const token = issueGuestJWT({
    codeId: record.id,
    projectId: project.id,
    expiresAt: record.expiresAt,
    authCryptoKey,
  });

  // 4. Redirect to the project page with the cookie set
  const dest = new URL(`/${encodeURIComponent(project.name)}`, externalOrigin);
  const response = NextResponse.redirect(dest);

  response.cookies.set("access_token", token, {
    domain: `.${domain}`,
    path: "/",
    expires: record.expiresAt,
    secure: true,
    httpOnly: true,
    sameSite: "lax",
  });

  return response;
}
