import type { LevelId } from "../levels";
import type { ScoreBreakdown } from "../scoring";
import type { ValidationCheck } from "../validation/types";
import type { NiveauEtude, ScoreEntry } from "./player";

/**
 * Contrat public entre l'écran joueur et les APIs serveur.
 * Le client peut importer ces types sans embarquer de logique de validation.
 */

export interface CreateSessionRequest {
  pseudo: string;
  filiere: string;
  niveau: string;
  pin: string;
}

export interface CreateSessionResponse {
  sessionId: string;
  sessionToken: string;
  pseudo: string;
  filiere: string;
  niveau: NiveauEtude;
  currentLevel: LevelId;
  startedAt: string;
  levelStartedAt: string;
  timerStartedAt: string;
  readingWindowSeconds: number;
  levelDurationSeconds: number;
  serverNow: string;
}

export interface StartLevelRequest {
  sessionId: string;
  sessionToken: string;
  levelId: LevelId;
}

export interface StartLevelResponse {
  levelId: LevelId;
  timerStartedAt: string;
  serverNow: string;
}

export interface RevealHintRequest {
  sessionId: string;
  sessionToken: string;
  levelId: LevelId;
}

export interface RevealHintResponse {
  levelId: LevelId;
  hintUsed: true;
}

export interface ValidateRequest {
  sessionId: string;
  sessionToken: string;
  levelId: LevelId;
  code: string;
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
  /** Cumul de points de la session côté serveur. */
  totalScore: number;
  /** Nombre de niveaux validés (hors passages) dans cette session. */
  levelsValidated: number;
  /** Temps total écoulé depuis le début de la session (en secondes). */
  totalTimeSeconds: number;
  /** Secondes restantes calculées côté serveur au moment de la requête. */
  remainingSeconds: number;
  /** Horodatage de début du niveau suivant (ISO), ou null. */
  nextLevelStartedAt: string | null;
  /** Horodatage de départ du chrono du niveau suivant (après lecture), ou null. */
  nextLevelTimerStartedAt: string | null;
  /** Horodatage courant du serveur (ISO). */
  serverNow: string;
  /** `true` si la partie est terminée après cette soumission. */
  finished: boolean;
}

export interface SubmitScoreRequest {
  sessionId: string;
  sessionToken: string;
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
