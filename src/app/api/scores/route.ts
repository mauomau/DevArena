import type { LeaderboardResponse } from "../../../lib/game/contracts";
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
import { listScores } from "../../../lib/server/scoreStore";
import {
  saveFinishedSessionScore,
  SessionHttpError,
} from "../../../lib/server/sessionStore";
import { hasSupabaseBrowserConfig } from "../../../lib/supabase";

/**
 * API du classement.
 *
 * - `GET  /api/scores` : classement complet (projecteur).
 * - `POST /api/scores` : enregistre au classement le score calculé côté
 *   serveur pour une session terminée (`sessionId` + `sessionToken`).
 *
 * Les écritures passent par la clé service role côté serveur : la table est
 * en lecture seule pour les clients (RLS).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const ipLimit = consumeRateLimit(
    RATE_LIMITS.listScoresIp,
    getClientIp(request),
  );
  if (!ipLimit.allowed) {
    return rateLimitResponse(ipLimit);
  }

  try {
    const snapshot = await listScores();
    const body: LeaderboardResponse = {
      entries: snapshot.entries,
      source: snapshot.source,
      realtime:
        snapshot.source === "supabase" && hasSupabaseBrowserConfig(),
    };
    return Response.json(body);
  } catch (error) {
    console.error("[api/scores] lecture impossible", error);
    return jsonError(
      error instanceof Error ? error.message : "Lecture du classement impossible.",
      500,
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const ipLimit = consumeRateLimit(
    RATE_LIMITS.saveScoreIp,
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

  const auth = parseSessionAuth(parsedJson.value as Record<string, unknown>);
  if (!auth.ok) {
    return jsonError(auth.error, 401);
  }

  const sessionLimit = consumeRateLimit(
    RATE_LIMITS.saveScoreSession,
    auth.value.sessionId,
  );
  if (!sessionLimit.allowed) {
    return rateLimitResponse(sessionLimit);
  }

  try {
    const body = await saveFinishedSessionScore(auth.value);
    return Response.json(body);
  } catch (error) {
    if (error instanceof SessionHttpError) {
      return jsonError(error.message, error.status);
    }
    console.error("[api/scores] écriture impossible", error);
    return jsonError(
      error instanceof Error ? error.message : "Enregistrement du score impossible.",
      500,
    );
  }
}
