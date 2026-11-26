import type {
  ApiErrorResponse,
  LeaderboardResponse,
  SubmitScoreResponse,
} from "../../../lib/game/contracts";
import { parseScoreSubmission } from "../../../lib/game/player";
import { listScores, saveScore } from "../../../lib/server/scoreStore";
import { hasSupabaseBrowserConfig } from "../../../lib/supabase";

/**
 * API du classement.
 *
 * - `GET  /api/scores` : classement complet (projecteur).
 * - `POST /api/scores` : enregistre la performance de fin de partie.
 *
 * Les écritures passent par la clé service role côté serveur : la table est
 * en lecture seule pour les clients (RLS).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status = 400): Response {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status });
}

export async function GET(): Promise<Response> {
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
    return errorResponse(
      error instanceof Error ? error.message : "Lecture du classement impossible.",
      500,
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("JSON invalide.");
  }

  const parsed = parseScoreSubmission(rawBody);
  if (!parsed.ok) {
    return errorResponse(parsed.error);
  }

  try {
    const result = await saveScore(parsed.value);
    const body: SubmitScoreResponse = {
      entry: result.entry,
      improved: result.improved,
      rank: result.rank,
      totalPlayers: result.totalPlayers,
      source: result.source,
    };
    return Response.json(body);
  } catch (error) {
    console.error("[api/scores] écriture impossible", error);
    return errorResponse(
      error instanceof Error ? error.message : "Enregistrement du score impossible.",
      500,
    );
  }
}
