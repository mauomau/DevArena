import { LEVELS } from "../levels";
import { MAX_TOTAL_SCORE } from "../scoring";

/**
 * Filières et niveaux d'étude proposés à l'inscription.
 * Les listes sont fermées pour garder un classement lisible sur le projecteur.
 */
export const FILIERES = [
  "IRT",
  "Génie Logiciel",
  "Gestion / Finance",
  "Autre",
] as const;

export type Filiere = (typeof FILIERES)[number];

export const NIVEAUX_ETUDE = [
  "L1",
  "L2",
  "L3",
  "M1",
  "M2",
  "Autre",
] as const;

export type NiveauEtude = (typeof NIVEAUX_ETUDE)[number];

/** Identité d'un joueur validée au démarrage de session. */
export interface PlayerRegistration {
  pseudo: string;
  filiere: Filiere;
  niveau: NiveauEtude;
  /** Libellé affiché sur le classement (ex: `IRT • L2`). */
  filiereDisplay: string;
  /** Code PIN personnel à 4 chiffres (anti-usurpation). */
  pin: string;
}

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

/** Charge utile normalisée pour l'enregistrement d'un score. */
export interface ScoreSubmission {
  pseudo: string;
  filiere: string;
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

const PIN_PATTERN = /^\d{4}$/;

/** Durée maximale plausible d'une partie (somme des chronos + marge). */
const MAX_TOTAL_TIME_SECONDS = 3600;

/**
 * Noms réservés (risque de confusion pendant le présentiel) et termes
 * offensants bloqués avant toute création de session.
 */
const RESERVED_OR_BLOCKED_WORDS = new Set([
  "admin",
  "administrateur",
  "administrator",
  "root",
  "staff",
  "moderator",
  "moderateur",
  "support",
  "system",
  "systeme",
  "esgis",
  "eslis",
  "clubdev",
  "devarena",
  "test",
  "tester",
  "con",
  "connard",
  "connasse",
  "salope",
  "pute",
  "putain",
  "merde",
  "encule",
  "fdp",
  "ntm",
  "fuck",
  "shit",
  "bitch",
  "asshole",
]);

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Vérifie si un pseudo correspond à un nom réservé (Admin, ESGIS, Test…) ou
 * contient un terme offensant.
 */
export function isBlockedPseudo(pseudo: string): boolean {
  const clean = stripAccents(normalizePseudo(pseudo)).toLowerCase();
  const compact = clean.replace(/[^a-z0-9]/g, "");
  if (RESERVED_OR_BLOCKED_WORDS.has(compact)) {
    return true;
  }

  const tokens = clean.split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.some((token) => RESERVED_OR_BLOCKED_WORDS.has(token));
}

export function formatFiliereLabel(
  filiere: Filiere,
  niveau: NiveauEtude,
): string {
  return `${filiere} • ${niveau}`;
}

function isAllowedFiliereLabel(value: string): boolean {
  if (FILIERES.includes(value as Filiere)) return true;
  const parts = value.split(" • ");
  if (parts.length !== 2) return false;
  return (
    FILIERES.includes(parts[0] as Filiere) &&
    NIVEAUX_ETUDE.includes(parts[1] as NiveauEtude)
  );
}

/** Normalise un pseudo : espaces multiples réduits, bords retirés. */
export function normalizePseudo(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value);
}

function validatePseudo(rawPseudo: unknown): ParseResult<string> {
  if (typeof rawPseudo !== "string") {
    return { ok: false, error: "Le pseudo est requis." };
  }

  const pseudo = normalizePseudo(rawPseudo);
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
  if (isBlockedPseudo(pseudo)) {
    return {
      ok: false,
      error: "Ce pseudo est réservé ou non autorisé. Choisis-en un autre.",
    };
  }

  return { ok: true, value: pseudo };
}

/**
 * Valide et normalise les données d'inscription (`pseudo`, `filiere`, `niveau`, `pin`).
 * Utilisé à la création de session (`POST /api/sessions`).
 */
export function parsePlayerRegistration(
  value: unknown,
): ParseResult<PlayerRegistration> {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "Corps de requête invalide : un objet JSON est attendu." };
  }

  const body = value as Record<string, unknown>;
  const pseudoResult = validatePseudo(body.pseudo);
  if (!pseudoResult.ok) {
    return pseudoResult;
  }

  if (typeof body.filiere !== "string" || !FILIERES.includes(body.filiere as Filiere)) {
    return {
      ok: false,
      error: `La filière doit être l'une des suivantes : ${FILIERES.join(", ")}.`,
    };
  }

  if (typeof body.niveau !== "string" || !NIVEAUX_ETUDE.includes(body.niveau as NiveauEtude)) {
    return {
      ok: false,
      error: `Le niveau doit être l'un des suivants : ${NIVEAUX_ETUDE.join(", ")}.`,
    };
  }

  if (typeof body.pin !== "string" || !PIN_PATTERN.test(body.pin.trim())) {
    return {
      ok: false,
      error: "Le code PIN personnel doit contenir exactement 4 chiffres.",
    };
  }

  const filiere = body.filiere as Filiere;
  const niveau = body.niveau as NiveauEtude;

  return {
    ok: true,
    value: {
      pseudo: pseudoResult.value,
      filiere,
      niveau,
      filiereDisplay: formatFiliereLabel(filiere, niveau),
      pin: body.pin.trim(),
    },
  };
}

/**
 * Valide et normalise un score complet.
 * Ne fait jamais confiance au client : bornes, types et liste fermée.
 */
export function parseScoreSubmission(
  value: unknown,
): ParseResult<ScoreSubmission> {
  if (typeof value !== "object" || value === null) {
    return { ok: false, error: "Corps de requête invalide : un objet JSON est attendu." };
  }

  const body = value as Record<string, unknown>;
  const pseudoResult = validatePseudo(body.pseudo);
  if (!pseudoResult.ok) {
    return pseudoResult;
  }

  if (typeof body.filiere !== "string" || !isAllowedFiliereLabel(body.filiere)) {
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
      pseudo: pseudoResult.value,
      filiere: body.filiere,
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
