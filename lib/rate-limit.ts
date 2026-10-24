export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type Bucket = { count: number; resetAt: number };

const globalRateLimit = globalThis as typeof globalThis & {
  __morrowRateBuckets?: Map<string, Bucket>;
};

function buckets(): Map<string, Bucket> {
  if (!globalRateLimit.__morrowRateBuckets) {
    globalRateLimit.__morrowRateBuckets = new Map();
  }
  return globalRateLimit.__morrowRateBuckets;
}

export function rateLimit(
  request: Request,
  action: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "local";
  const key = `${action}:${ip}`;
  const now = Date.now();
  const bucket = buckets().get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets().set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    };
  }
  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
