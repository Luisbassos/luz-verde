const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 60;
const store = new Map<string, number[]>();

export function rateLimit(
  key: string,
  windowMs = DEFAULT_WINDOW_MS,
  limit = DEFAULT_LIMIT,
) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const hits = (store.get(key) || []).filter((ts) => ts > windowStart);
  hits.push(now);
  store.set(key, hits);
  const allowed = hits.length <= limit;
  const retryAfter = allowed ? 0 : Math.ceil((hits[0] + windowMs - now) / 1000);
  return { allowed, retryAfter };
}

export function getClientIp(req: Request) {
  const header = req.headers.get("x-forwarded-for") || "";
  const ip = header.split(",")[0]?.trim();
  return ip || "unknown";
}
