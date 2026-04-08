import { type NextRequest, NextResponse } from "next/server";
import { getAccessCodeByHash, hashCode, issueGuestJWT } from "@/lib/access-codes";
import { getProject } from "@/lib/project-settings";
import { checkRateLimit } from "@/lib/utils";

// IP-based rate limit: configurable via JOIN_RATE_LIMIT_RPM, default 100 per minute per IP.
const joinRateLimitMap = new Map<string, number[]>();
const JOIN_RATE_LIMIT = parseInt(process.env.JOIN_RATE_LIMIT_RPM ?? "100", 10);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(joinRateLimitMap, JOIN_RATE_LIMIT, 60 * 1000, ip)) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  const { code } = await params;
  const domain = (process.env.HYPERSET_DOMAIN || "").trim() || "hyperset.internal";
  const externalOrigin = `https://${domain}`;
  const errorUrl = new URL("/join", externalOrigin);

  if (!code || code.length !== 5) {
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
