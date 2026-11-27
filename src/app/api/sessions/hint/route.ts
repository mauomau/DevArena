import { isLevelId } from "../../../../lib/levels";
import {
  jsonError,
  parseJsonBody,
  parseSessionAuth,
  rateLimitResponse,
} from "../../../../lib/server/apiUtils";
import {
  consumeRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "../../../../lib/server/rateLimit";
import {
  revealSessionHint,
  SessionHttpError,
} from "../../../../lib/server/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/sessions/hint
 *
 * Enregistre côté serveur l'ouverture de l'indice pour le niveau courant, afin
 * que la pénalité de 30 points ne puisse pas être contournée au moment de
 * valider.
 */
export async function POST(request: Request): Promise<Response> {
  const ipLimit = consumeRateLimit(
    RATE_LIMITS.revealHintIp,
    getClientIp(request),
  );
  if (!ipLimit.allowed) {
    return rateLimitResponse(ipLimit);
  }

  const parsedJson = await parseJsonBody(request);
  if (!parsedJson.ok) {
    return parsedJson.response;
  }

  if (typeof parsedJson.value !== "object" || parsedJson.value === null) {
    return jsonError("Corps de requête invalide : un objet JSON est attendu.");
  }

  const body = parsedJson.value as Record<string, unknown>;
  const auth = parseSessionAuth(body);
  if (!auth.ok) {
    return jsonError(auth.error, 401);
  }

  if (!isLevelId(body.levelId)) {
    return jsonError("Le champ levelId doit être un niveau valide (1 à 5).");
  }

  const sessionLimit = consumeRateLimit(
    RATE_LIMITS.revealHintSession,
    auth.value.sessionId,
  );
  if (!sessionLimit.allowed) {
    return rateLimitResponse(sessionLimit);
  }

  try {
    const result = await revealSessionHint({
      sessionId: auth.value.sessionId,
      sessionToken: auth.value.sessionToken,
      levelId: body.levelId,
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof SessionHttpError) {
      return jsonError(error.message, error.status);
    }
    console.error("[api/sessions/hint] erreur inattendue", error);
    return jsonError("Erreur interne lors de l'activation de l'indice.", 500);
  }
}
