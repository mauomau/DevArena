import { GAME_CONFIG } from "../../../lib/game/config";
import type {
  ApiErrorResponse,
  ValidateRequest,
  ValidateResponse,
} from "../../../lib/game/contracts";
import { isLevelId } from "../../../lib/levels";
import {
  canSkip,
  computeLevelScore,
  type ScoreBreakdown,
} from "../../../lib/scoring";
import { validateLevel } from "../../../lib/validation/engine";
import type { ValidationResult } from "../../../lib/validation/types";

/**
 * La sandbox utilise `node:vm` : ce handler doit tourner sur le runtime
 * Node.js, pas sur Edge.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(
  message: string,
  status = 400,
): Response {
  const body: ApiErrorResponse = { error: message };
  return Response.json(body, { status });
}

function emptyBreakdown(): ScoreBreakdown {
  return {
    basePoints: 0,
    speedBonus: 0,
    hintPenalty: 0,
    totalPoints: 0,
  };
}

function parseBody(value: unknown): ValidateRequest | string {
  if (typeof value !== "object" || value === null) {
    return "Corps de requête invalide : un objet JSON est attendu.";
  }

  const body = value as Record<string, unknown>;

  if (!isLevelId(body.levelId)) {
    return "Le champ levelId doit être un niveau valide (1 à 5).";
  }
  if (typeof body.code !== "string") {
    return "Le champ code est requis et doit être une chaîne de caractères.";
  }
  if (body.code.length > GAME_CONFIG.maxCodeLength) {
    return `Le code dépasse la taille maximale de ${GAME_CONFIG.maxCodeLength} caractères.`;
  }
  if (
    typeof body.remainingSeconds !== "number" ||
    !Number.isFinite(body.remainingSeconds) ||
    body.remainingSeconds < 0
  ) {
    return "Le champ remainingSeconds doit être un nombre positif.";
  }
  if (body.hintUsed !== undefined && typeof body.hintUsed !== "boolean") {
    return "Le champ hintUsed doit être un booléen.";
  }
  if (body.skipped !== undefined && typeof body.skipped !== "boolean") {
    return "Le champ skipped doit être un booléen.";
  }

  return {
    levelId: body.levelId,
    code: body.code,
    remainingSeconds: body.remainingSeconds,
    hintUsed: body.hintUsed === true,
    skipped: body.skipped === true,
  };
}

/**
 * POST /api/validate
 *
 * Valide le code d'un joueur et calcule les points du niveau.
 *
 * ⚠️ Sécurité : `remainingSeconds` est encore fourni par le client.
 * Avant la mise en production, l'écran joueur devra créer une session
 * Supabase et cette route devra recalculer le temps restant à partir de
 * l'heure de début enregistrée côté serveur (voir docs/validation-engine.md).
 */
export async function POST(request: Request): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return errorResponse("JSON invalide.");
  }

  const parsed = parseBody(rawBody);
  if (typeof parsed === "string") {
    return errorResponse(parsed);
  }

  const skipped = parsed.skipped === true;

  if (skipped && !canSkip(parsed.levelId, parsed.remainingSeconds)) {
    return errorResponse(
      `Le bouton « Passer » n'est disponible qu'après ${GAME_CONFIG.skipAvailableAfterSeconds} secondes.`,
    );
  }

  try {
    let validation: ValidationResult;
    if (skipped) {
      validation = {
        valid: false,
        checks: [],
        feedback: "Niveau passé : 0 point attribué.",
      };
    } else {
      validation = validateLevel(parsed.levelId, parsed.code);
    }

    const breakdown = validation.valid
      ? computeLevelScore(parsed.levelId, {
          remainingSeconds: parsed.remainingSeconds,
          hintUsed: parsed.hintUsed === true,
          skipped,
        })
      : emptyBreakdown();

    const completed = validation.valid || skipped;
    const candidateNext = parsed.levelId + 1;
    const nextLevel: ValidateResponse["nextLevel"] =
      completed && isLevelId(candidateNext) ? candidateNext : null;

    const response: ValidateResponse = {
      levelId: parsed.levelId,
      valid: validation.valid,
      skipped,
      pointsAwarded: breakdown.totalPoints,
      breakdown,
      feedback: validation.feedback,
      checks: validation.checks,
      nextLevel,
    };

    return Response.json(response);
  } catch (error) {
    console.error("[api/validate] erreur inattendue", error);
    return errorResponse("Erreur interne lors de la validation.", 500);
  }
}
