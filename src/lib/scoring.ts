import { GAME_CONFIG } from "./game/config";
import { getLevel, LEVELS, type LevelId } from "./levels";

/**
 * Détail des points attribués pour un niveau.
 * Tous les champs sont des entiers (les secondes sont arrondies vers le bas).
 */
export interface ScoreBreakdown {
  basePoints: number;
  speedBonus: number;
  hintPenalty: number;
  totalPoints: number;
}

export interface LevelScoreInput {
  /** Secondes restantes au chrono au moment de la validation. */
  remainingSeconds: number;
  /** L'indice a-t-il été débloqué sur ce niveau ? */
  hintUsed?: boolean;
  /** Le joueur a-t-il passé le niveau ? */
  skipped?: boolean;
}

export interface RankedPlayer {
  pseudo: string;
  score: number;
  totalTimeSeconds: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function assertRemainingSeconds(value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError("remainingSeconds doit être un nombre fini.");
  }
}

/**
 * Calcule le score d'un niveau.
 *
 * Règles :
 * - points de base du niveau ;
 * - +2 pts par seconde restante (arrondie à l'entier inférieur) ;
 * - -30 pts si l'indice a été utilisé ;
 * - 0 pt si le niveau est passé, quelles que soient les autres options ;
 * - le total d'un niveau ne peut jamais être négatif.
 */
export function computeLevelScore(
  levelId: LevelId,
  input: LevelScoreInput,
): ScoreBreakdown {
  const level = getLevel(levelId);
  assertRemainingSeconds(input.remainingSeconds);

  if (input.skipped) {
    return {
      basePoints: 0,
      speedBonus: 0,
      hintPenalty: 0,
      totalPoints: 0,
    };
  }

  const remainingSeconds = clamp(
    Math.floor(input.remainingSeconds),
    0,
    level.durationSeconds,
  );
  const speedBonus = remainingSeconds * GAME_CONFIG.speedBonusPerSecond;
  const hintPenalty = input.hintUsed ? GAME_CONFIG.hintPenalty : 0;
  const totalPoints = Math.max(
    0,
    level.basePoints + speedBonus - hintPenalty,
  );

  return {
    basePoints: level.basePoints,
    speedBonus,
    hintPenalty,
    totalPoints,
  };
}

/**
 * Le bouton « Passer » est disponible une fois que le joueur a consommé
 * au moins 30 secondes sur le niveau.
 */
export function canSkip(
  levelId: LevelId,
  remainingSeconds: number,
): boolean {
  const level = getLevel(levelId);
  assertRemainingSeconds(remainingSeconds);
  const remaining = clamp(remainingSeconds, 0, level.durationSeconds);
  const elapsed = level.durationSeconds - remaining;
  return elapsed >= GAME_CONFIG.skipAvailableAfterSeconds;
}

/**
 * Classement : score décroissant, puis temps total croissant (départage),
 * puis pseudo pour garantir un ordre stable.
 */
export function comparePlayers(a: RankedPlayer, b: RankedPlayer): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  if (a.totalTimeSeconds !== b.totalTimeSeconds) {
    return a.totalTimeSeconds - b.totalTimeSeconds;
  }
  return a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" });
}

/** Retourne une copie triée, sans modifier le tableau d'origine. */
export function rankPlayers<T extends RankedPlayer>(
  players: readonly T[],
): T[] {
  return [...players].sort(comparePlayers);
}

/**
 * Score maximal théorique : tous les niveaux validés avec le chrono plein,
 * sans indice. 1000 pts de base + 810 pts de bonus = 1810 pts.
 */
export const MAX_TOTAL_SCORE = LEVELS.reduce(
  (total, level) =>
    total +
    level.basePoints +
    level.durationSeconds * GAME_CONFIG.speedBonusPerSecond,
  0,
);
