import type { LevelId } from "../levels";
import type { ScoreBreakdown } from "../scoring";
import type { ValidationCheck } from "../validation/types";
import type { ScoreEntry } from "./player";

/**
 * Contrat public entre l'écran joueur et `POST /api/validate`.
 * Le client peut importer ces types sans embarquer de logique de validation.
 */
export interface ValidateRequest {
  levelId: LevelId;
  code: string;
  /**
   * Secondes restantes au chrono.
   *
   * ⚠️ En production, cette valeur devra être recalculée côté serveur à
   * partir de la session Supabase (heure de début du niveau) plutôt que
   * reçue telle quelle. Voir `docs/validation-engine.md`.
   */
  remainingSeconds: number;
  hintUsed?: boolean;
  skipped?: boolean;
}

export interface ValidateResponse {
  levelId: LevelId;
  /** Le code soumis est-il correct ? */
  valid: boolean;
  /** Le niveau a-t-il été passé (0 point) ? */
  skipped: boolean;
  /** Nombre de points effectivement crédités par cette soumission. */
  pointsAwarded: number;
  breakdown: ScoreBreakdown;
  feedback: string;
  checks: ValidationCheck[];
  /** Niveau suivant à proposer, ou null si la partie est terminée / bloquée. */
  nextLevel: LevelId | null;
}

export interface ApiErrorResponse {
  error: string;
}

/** Réponse de `GET /api/scores` (écran projecteur). */
export interface LeaderboardResponse {
  entries: ScoreEntry[];
  source: "supabase" | "memory";
  /** `true` si le client peut s'abonner à Supabase Realtime. */
  realtime: boolean;
}

/** Réponse de `POST /api/scores` (fin de partie). */
export interface SubmitScoreResponse {
  entry: ScoreEntry;
  improved: boolean;
  rank: number;
  totalPlayers: number;
  source: "supabase" | "memory";
}
