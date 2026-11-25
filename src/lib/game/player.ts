import { LEVELS } from "../levels";
import { MAX_TOTAL_SCORE } from "../scoring";

/**
 * Filières proposées à l'inscription et stockées dans la table `scores`.
 * La liste est fermée pour garder un classement lisible sur le projecteur.
 */
export const FILIERES = [
  "IRT",
  "Génie Logiciel",
  "Gestion / Finance",
  "Autre",
] as const;

export type Filiere = (typeof FILIERES)[number];

/** Une ligne du classement, telle que renvoyée par `GET /api/scores`. */
export interface ScoreEntry {
  id: string;
  pseudo: string;
  filiere: string;
  score: number;
  /** Dernier niveau atteint (1 à 5). */
  currentLevel: number;
  totalTimeSeconds: number;
  /** Date ISO de la dernière mise à jour. */
  updatedAt: string;
}

/** Charge utile acceptée par `POST /api/scores`. */
export interface ScoreSubmission {
  pseudo: string;
  filiere: Filiere;
  score: number;
  currentLevel: number;
  totalTimeSeconds: number;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export const PSEUDO_MIN_LENGTH = 2;
export const PSEUDO_MAX_LENGTH = 20;

/**
 * Lettres (accents inclus), chiffres, espaces, point, tiret, apostrophe et
 * underscore. Le pseudo ne peut pas commencer par un séparateur.
 */
const PSEUDO_PATTERN =
  /^[\p{L}\p{N}][\p{L}\p{N} _.'’-]{1,19}$/u;

/** Durée maximale plausible d'une partie (somme des chronos + marge). */
const MAX_TOTAL_TIME_SECONDS = 3600;

/** Normalise un pseudo : espaces multiples réduits, bords retirés. */
export function normalizePseudo(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);
}

/**
 * Valide et normalise le corps de `POST /api/scores`.
 * Ne fait jamais confiance au client : bornes, types et liste fermée.
 */
export function parseScoreSubmission(
  value: unknown,
): ParseResult<ScoreSubmission> {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "Corps de requête invalide : un objet JSON est attendu." };
  }

  const body = value as Record<string, unknown>;

  if (typeof body.pseudo !== "string") {
    return { ok: false, error: "Le pseudo est requis." };
  }

  const pseudo = normalizePseudo(body.pseudo);
  if (pseudo.length < PSEUDO_MIN_LENGTH || pseudo.length > PSEUDO_MAX_LENGTH) {
    return {
      ok: false,
      error: `Le pseudo doit contenir entre ${PSEUDO_MIN_LENGTH} et ${PSEUDO_MAX_LENGTH} caractères.`,
    };
  }
  if (!PSEUDO_PATTERN.test(pseudo)) {
    return {
      ok: false,
      error: "Le pseudo ne peut contenir que des lettres, chiffres, espaces, points, tirets ou underscores.",
    };
  }

  if (typeof body.filiere !== "string" || !FILIERES.includes(body.filiere as Filiere)) {
    return {
      ok: false,
      error: `La filière doit être l'une des suivantes : ${FILIERES.join(", ")}.`,
    };
  }

  if (!isFiniteInteger(body.score) || body.score < 0 || body.score > MAX_TOTAL_SCORE) {
    return {
      ok: false,
      error: `Le score doit être un entier entre 0 et ${MAX_TOTAL_SCORE}.`,
    };
  }

  if (
    !isFiniteInteger(body.currentLevel) ||
    body.currentLevel < 1 ||
    body.currentLevel > LEVELS.length
  ) {
    return {
      ok: false,
      error: `Le niveau atteint doit être un entier entre 1 et ${LEVELS.length}.`,
    };
  }

  if (
    !isFiniteInteger(body.totalTimeSeconds) ||
    body.totalTimeSeconds < 0 ||
    body.totalTimeSeconds > MAX_TOTAL_TIME_SECONDS
  ) {
    return {
      ok: false,
      error: `Le temps total doit être un entier entre 0 et ${MAX_TOTAL_TIME_SECONDS} secondes.`,
    };
  }

  return {
    ok: true,
    value: {
      pseudo,
      filiere: body.filiere as Filiere,
      score: body.score,
      currentLevel: body.currentLevel,
      totalTimeSeconds: body.totalTimeSeconds,
    },
  };
}

/** Clé de dédoublonnage : un joueur = un pseudo, quelle que soit la casse. */
export function pseudoKey(pseudo: string): string {
  return normalizePseudo(pseudo).toLocaleLowerCase("fr");
}

/**
 * Ne garde que la meilleure performance par pseudo.
 * Un score plus élevé gagne ; à score égal, le temps total le plus court gagne.
 */
export function bestEntryPerPseudo(entries: readonly ScoreEntry[]): ScoreEntry[] {
  const best = new Map<string, ScoreEntry>();

  for (const entry of entries) {
    const key = pseudoKey(entry.pseudo);
    const current = best.get(key);
    if (
      !current ||
      entry.score > current.score ||
      (entry.score === current.score &&
        entry.totalTimeSeconds < current.totalTimeSeconds)
    ) {
      best.set(key, entry);
    }
  }

  return [...best.values()];
}

/** Vrai si `candidate` est une meilleure performance que `current`. */
export function isBetterScore(
  candidate: Pick<ScoreEntry, "score" | "totalTimeSeconds">,
  current: Pick<ScoreEntry, "score" | "totalTimeSeconds">,
): boolean {
  return (
    candidate.score > current.score ||
    (candidate.score === current.score &&
      candidate.totalTimeSeconds < current.totalTimeSeconds)
  );
}
