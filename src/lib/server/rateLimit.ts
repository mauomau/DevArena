/**
 * Limitation de débit (rate limiting) en mémoire par fenêtre glissante fixe.
 *
 * Protège les endpoints publics contre les rafales abusives et le spam de la
 * sandbox `node:vm`. Les limites IP restent suffisamment larges pour supporter
 * plusieurs participants derrière le même Wi-Fi sur un stand.
 */

export interface RateLimitRule {
  bucket: string;
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface CounterEntry {
  count: number;
  resetAt: number;
}

declare global {
  var __devarenaRateLimits: Map<string, CounterEntry> | undefined;
}

const rateLimitStore: Map<string, CounterEntry> =
  (globalThis.__devarenaRateLimits ??= new Map<string, CounterEntry>());

const MAX_STORE_ENTRIES = 10_000;

export const RATE_LIMITS = {
  createSessionIp: { bucket: "session:create:ip", limit: 60, windowMs: 60_000 },
  startLevelSession: { bucket: "session:start-level:id", limit: 30, windowMs: 60_000 },
  startLevelIp: { bucket: "session:start-level:ip", limit: 120, windowMs: 60_000 },
  revealHintSession: { bucket: "session:hint:id", limit: 20, windowMs: 60_000 },
  revealHintIp: { bucket: "session:hint:ip", limit: 120, windowMs: 60_000 },
  validateSession: { bucket: "validate:session", limit: 25, windowMs: 60_000 },
  validateIp: { bucket: "validate:ip", limit: 120, windowMs: 60_000 },
  saveScoreSession: { bucket: "scores:post:session", limit: 20, windowMs: 60_000 },
  saveScoreIp: { bucket: "scores:post:ip", limit: 60, windowMs: 60_000 },
  listScoresIp: { bucket: "scores:get:ip", limit: 120, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>;

function pruneExpired(now: number): void {
  if (rateLimitStore.size < MAX_STORE_ENTRIES) return;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "local";
}

export function consumeRateLimit(
  rule: RateLimitRule,
  subject: string,
  now = Date.now(),
): RateLimitResult {
  pruneExpired(now);

  const key = `${rule.bucket}:${subject}`;
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + rule.windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, rule.limit - 1),
      retryAfterSeconds: Math.ceil(rule.windowMs / 1000),
    };
  }

  if (existing.count >= rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, rule.limit - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

export function resetRateLimitsForTests(): void {
  rateLimitStore.clear();
}
