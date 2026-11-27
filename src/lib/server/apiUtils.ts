import type { ApiErrorResponse } from "../game/contracts";
import type { RateLimitResult } from "./rateLimit";

export function jsonError(
  message: string,
  status = 400,
  headers?: HeadersInit,
): Response {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status, headers });
}

export async function parseJsonBody(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  try {
    const value: unknown = await request.json();
    return { ok: true, value };
  } catch {
    return { ok: false, response: jsonError("JSON invalide.", 400) };
  }
}

export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.max(1, result.retryAfterSeconds);
  return jsonError(
    `Trop de requêtes. Réessaie dans ${retryAfter} seconde(s).`,
    429,
    { "Retry-After": String(retryAfter) },
  );
}

export interface SessionAuthPayload {
  sessionId: string;
  sessionToken: string;
}

export function parseSessionAuth(
  body: Record<string, unknown>,
): { ok: true; value: SessionAuthPayload } | { ok: false; error: string } {
  if (typeof body.sessionId !== "string" || body.sessionId.trim().length === 0) {
    return { ok: false, error: "Identifiant de session manquant." };
  }
  if (
    typeof body.sessionToken !== "string" ||
    body.sessionToken.trim().length === 0
  ) {
    return { ok: false, error: "Jeton de session manquant." };
  }

  return {
    ok: true,
    value: {
      sessionId: body.sessionId.trim(),
      sessionToken: body.sessionToken.trim(),
    },
  };
}
