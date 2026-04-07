// ── Shared formatting helpers ──────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ── Sliding-window rate limiter ───────────────────────────────────────────────
// Uses Redis when available for distributed rate limiting across serverless instances.
// Falls back to a global in-memory Map that persists for the lifetime of each instance.

interface RateLimitStore {
  check(limit: number, windowMs: number, key: string): boolean;
}

class MemoryStore implements RateLimitStore {
  private map = new Map<string, number[]>();

  check(limit: number, windowMs: number, key: string): boolean {
    const now = Date.now();
    const timestamps = this.map.get(key) ?? [];
    const recent = timestamps.filter((t) => now - t < windowMs);
    if (recent.length >= limit) {
      this.map.set(key, recent);
      return false;
    }
    recent.push(now);
    this.map.set(key, recent);
    return true;
  }
}

// Global singleton that persists across requests within the same serverless instance
const _memoryStore = new MemoryStore();

export function checkRateLimit(
  limit: number,
  windowMs: number,
  key: string,
): boolean {
  // Primary: in-memory store (persists for instance lifetime)
  // Note: For true distributed rate limiting across serverless instances,
  // Redis should be used. The memory store handles the bypass via restart issue
  // within a single instance but won't help if the entire service restarts.
  return _memoryStore.check(limit, windowMs, key);
}

// For distributed rate limiting, use this async version with Redis
export async function checkRateLimitDistributed(
  limit: number,
  windowMs: number,
  key: string,
): Promise<boolean> {
  const now = Date.now();
  let redis = null;
  try {
    const { getRedis } = await import("@/lib/db");
    redis = await getRedis();
  } catch {
    // Redis unavailable, fall back to memory
    return _memoryStore.check(limit, windowMs, key);
  }

  try {
    const stored = await redis.get(`ratelimit:${key}`);
    const timestamps: number[] = stored ? JSON.parse(stored) : [];
    const recent = timestamps.filter((t) => now - t < windowMs);

    if (recent.length >= limit) {
      await redis.set(`ratelimit:${key}`, JSON.stringify(recent), { ex: Math.ceil(windowMs / 1000) });
      return false;
    }
    recent.push(now);
    await redis.set(`ratelimit:${key}`, JSON.stringify(recent), { ex: Math.ceil(windowMs / 1000) });
    return true;
  } catch {
    // Redis error, fall back to memory
    return _memoryStore.check(limit, windowMs, key);
  }
}


  recent.push(now);
  map.set(key, recent);
  return true;
}
