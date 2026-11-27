import { GAME_CONFIG } from "../../../lib/game/config";
import type { ValidateRequest } from "../../../lib/game/contracts";
import { isLevelId } from "../../../lib/levels";
import {
  jsonError,
  parseJsonBody,
  parseSessionAuth,
  rateLimitResponse,
} from "../../../lib/server/apiUtils";
import {
  consumeRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "../../../lib/server/rateLimit";
import {
  SessionHttpError,
  validateSessionAttempt,
} from "../../../lib/server/sessionStore";

/**
 * La sandbox utilise `node:vm` : ce handler doit tourner sur le runtime
 * Node.js, pas sur Edge.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBody(
  value: unknown,
): { ok: true; value: ValidateRequest } | { ok: false; error: string; status: number } {
  if (typeof value !== "object" || value === null) {
    return {
      ok: false,
      error: "Corps de requête invalide : un objet JSON est attendu.",
      status: 400,
    };
  }

  const body = value as Record<string, unknown>;
  const auth = parseSessionAuth(body);
  if (!auth.ok) {
    return { ok: false, error: auth.error, status: 401 };
  }

  if (!isLevelId(body.levelId)) {
    return {
      ok: false,
      error: "Le champ levelId doit être un niveau valide (1 à 5).",
      status: 400,
    };
  }
  if (typeof body.code !== "string") {
    return {
      ok: false,
      error: "Le champ code est requis et doit être une chaîne de caractères.",
      status: 400,
    };
  }
  if (body.code.length > GAME_CONFIG.maxCodeLength) {
    return {
      ok: false,
      error: `Le code dépasse la taille maximale de ${GAME_CONFIG.maxCodeLength} caractères.`,
      status: 400,
    };
  }
  if (body.hintUsed !== undefined && typeof body.hintUsed !== "boolean") {
    return {
      ok: false,
      error: "Le champ hintUsed doit être un booléen.",
      status: 400,
    };
  }
  if (body.skipped !== undefined && typeof body.skipped !== "boolean") {
    return {
      ok: false,
      error: "Le champ skipped doit être un booléen.",
      status: 400,
    };
  }

  return {
    ok: true,
    value: {
      sessionId: auth.value.sessionId,
      sessionToken: auth.value.sessionToken,
      levelId: body.levelId,
      code: body.code,
      hintUsed: body.hintUsed === true,
      skipped: body.skipped === true,
    },
  };
}

/**
 * POST /api/validate
 *
 * Valide le code d'un joueur au sein d'une session authentifiée et calcule les
 * points uniquement à partir de l'horodatage serveur du niveau.
 */
export async function POST(request: Request): Promise<Response> {
  const ipLimit = consumeRateLimit(RATE_LIMITS.validateIp, getClientIp(request));
  if (!ipLimit.allowed) {
    return rateLimitResponse(ipLimit);
  }

  const parsedJson = await parseJsonBody(request);
  if (!parsedJson.ok) {
    return parsedJson.response;
  }

  const parsed = parseBody(parsedJson.value);
  if (!parsed.ok) {
    return jsonError(parsed.error, parsed.status);
  }

  const sessionLimit = consumeRateLimit(
    RATE_LIMITS.validateSession,
    parsed.value.sessionId,
  );
  if (!sessionLimit.allowed) {
    return rateLimitResponse(sessionLimit);
  }

  try {
    const response = await validateSessionAttempt(parsed.value);
    return Response.json(response);
  } catch (error) {
    if (error instanceof SessionHttpError) {
      return jsonError(error.message, error.status);
    }
    console.error("[api/validate] erreur inattendue", error);
    return jsonError("Erreur interne lors de la validation.", 500);
  }
}
