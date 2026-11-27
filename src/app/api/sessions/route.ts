import { parsePlayerRegistration } from "../../../lib/game/player";
import {
  jsonError,
  parseJsonBody,
  rateLimitResponse,
} from "../../../lib/server/apiUtils";
import {
  consumeRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "../../../lib/server/rateLimit";
import {
  createGameSession,
  SessionHttpError,
} from "../../../lib/server/sessionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/sessions
 *
 * Crée une session de jeu côté serveur, vérifie ou enregistre le PIN à 4
 * chiffres du pseudo, initialise l'horodatage du niveau 1 et renvoie un jeton
 * secret propre à cette partie.
 */
export async function POST(request: Request): Promise<Response> {
  const ipLimit = consumeRateLimit(
    RATE_LIMITS.createSessionIp,
    getClientIp(request),
  );
  if (!ipLimit.allowed) {
    return rateLimitResponse(ipLimit);
  }

  const parsedJson = await parseJsonBody(request);
  if (!parsedJson.ok) {
    return parsedJson.response;
  }

  const player = parsePlayerRegistration(parsedJson.value);
  if (!player.ok) {
    return jsonError(player.error, 400);
  }

  try {
    const session = await createGameSession({
      pseudo: player.value.pseudo,
      filiereDisplay: player.value.filiereDisplay,
      niveau: player.value.niveau,
      pin: player.value.pin,
    });
    return Response.json(session, { status: 201 });
  } catch (error) {
    if (error instanceof SessionHttpError) {
      return jsonError(error.message, error.status);
    }
    console.error("[api/sessions] création impossible", error);
    return jsonError(
      error instanceof Error
        ? error.message
        : "Impossible de démarrer la session.",
      500,
    );
  }
}
