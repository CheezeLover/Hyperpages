import { NextResponse } from "next/server";
import { sql, checkDbConfig } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  let ready = true;
  const checks: Record<string, string> = {};

  try {
    checkDbConfig();
    await sql`SELECT 1`;
    checks.postgres = "ok";
  } catch (err) {
    checks.postgres = `error: ${err instanceof Error ? err.message : String(err)}`;
    ready = false;
  }

  return NextResponse.json(
    { ready, service: "portal", checks },
    { status: ready ? 200 : 503 },
  );
}
