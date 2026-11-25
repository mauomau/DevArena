import {
  bestEntryPerPseudo,
  isBetterScore,
  pseudoKey,
  type ScoreEntry,
  type ScoreSubmission,
} from "../game/player";
import { rankPlayers } from "../scoring";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Persistance des scores.
 *
 * - Si Supabase est configuré (URL + service role), les scores vivent dans la
 *   table `scores` et le leaderboard est alimenté par Realtime.
 * - Sinon, un store mémoire permet de tester tout le parcours en local
 *   (joueur → API → leaderboard) sans aucune clé. ⚠️ Ce mode n'est PAS
 *   persistant : il est remis à zéro à chaque redémarrage / instance
 *   serverless. Il ne doit servir qu'aux démos et aux tests.
 */

export type ScoreSource = "supabase" | "memory";

export interface LeaderboardSnapshot {
  entries: ScoreEntry[];
  source: ScoreSource;
}

export interface SaveScoreResult extends LeaderboardSnapshot {
  entry: ScoreEntry;
  /** Le score soumis est-il meilleur que la performance précédente du joueur ? */
  improved: boolean;
  /** Position 1-based dans le classement. */
  rank: number;
  totalPlayers: number;
}

interface ScoreRow {
  id: string;
  pseudo: string;
  filiere: string;
  score: number;
  current_level: number;
  total_time_seconds: number;
  updated_at: string;
}

const SCORE_COLUMNS =
  "id, pseudo, filiere, score, current_level, total_time_seconds, updated_at";

const MAX_ROWS = 500;

declare global {
  var __devarenaScoreMemory: Map<string, ScoreEntry> | undefined;
}

/** Store mémoire partagé entre les rechargements à chaud de Next.js. */
const memoryScores: Map<string, ScoreEntry> =
  (globalThis.__devarenaScoreMemory ??= new Map<string, ScoreEntry>());

function mapRow(row: ScoreRow): ScoreEntry {
  return {
    id: row.id,
    pseudo: row.pseudo,
    filiere: row.filiere,
    score: row.score,
    currentLevel: row.current_level,
    totalTimeSeconds: row.total_time_seconds,
    updatedAt: row.updated_at,
  };
}

function sortEntries(entries: readonly ScoreEntry[]): ScoreEntry[] {
  return rankPlayers(bestEntryPerPseudo(entries));
}

function supabaseError(message: string): Error {
  return new Error(
    `Supabase : ${message}. Vérifie que supabase/schema.sql a bien été exécuté.`,
  );
}

function rankOf(entries: readonly ScoreEntry[], pseudo: string): number {
  const key = pseudoKey(pseudo);
  return entries.findIndex((entry) => pseudoKey(entry.pseudo) === key) + 1;
}

/** Classement courant, trié (score décroissant puis temps croissant). */
export async function listScores(): Promise<LeaderboardSnapshot> {
  const admin = getSupabaseAdmin();

  if (!admin) {
    return {
      entries: sortEntries([...memoryScores.values()]),
      source: "memory",
    };
  }

  const { data, error } = await admin
    .from("scores")
    .select(SCORE_COLUMNS)
    .limit(MAX_ROWS);

  if (error) throw supabaseError(error.message);

  return {
    entries: sortEntries(((data ?? []) as ScoreRow[]).map(mapRow)),
    source: "supabase",
  };
}

/**
 * Enregistre la performance d'un joueur.
 * Un joueur n'a qu'une ligne : seule sa meilleure performance est conservée.
 */
export async function saveScore(
  submission: ScoreSubmission,
): Promise<SaveScoreResult> {
  const admin = getSupabaseAdmin();

  if (!admin) {
    return saveInMemory(submission);
  }

  const { data, error } = await admin
    .from("scores")
    .select(SCORE_COLUMNS)
    .limit(MAX_ROWS);

  if (error) throw supabaseError(error.message);

  const rows = (data ?? []) as ScoreRow[];
  const existing = rows.find(
    (row) => pseudoKey(row.pseudo) === pseudoKey(submission.pseudo),
  );

  let improved = true;

  if (existing && !isBetterScore(submission, mapRow(existing))) {
    improved = false;
  } else {
    const payload = {
      pseudo: submission.pseudo,
      filiere: submission.filiere,
      score: submission.score,
      current_level: submission.currentLevel,
      total_time_seconds: submission.totalTimeSeconds,
      updated_at: new Date().toISOString(),
    };

    const { error: writeError } = existing
      ? await admin.from("scores").update(payload).eq("id", existing.id)
      : await admin.from("scores").insert(payload);

    if (writeError) throw supabaseError(writeError.message);
  }

  const snapshot = await listScores();
  const entry = snapshot.entries.find(
    (candidate) => pseudoKey(candidate.pseudo) === pseudoKey(submission.pseudo),
  );

  if (!entry) {
    throw new Error("Score enregistré mais introuvable dans le classement.");
  }

  return {
    ...snapshot,
    entry,
    improved,
    rank: rankOf(snapshot.entries, submission.pseudo),
    totalPlayers: snapshot.entries.length,
  };
}

function saveInMemory(submission: ScoreSubmission): SaveScoreResult {
  const key = pseudoKey(submission.pseudo);
  const existing = memoryScores.get(key);
  const improved = !existing || isBetterScore(submission, existing);

  if (improved) {
    memoryScores.set(key, {
      id: existing?.id ?? crypto.randomUUID(),
      pseudo: submission.pseudo,
      filiere: submission.filiere,
      score: submission.score,
      currentLevel: submission.currentLevel,
      totalTimeSeconds: submission.totalTimeSeconds,
      updatedAt: new Date().toISOString(),
    });
  }

  const entries = sortEntries([...memoryScores.values()]);
  const entry = entries.find((candidate) => pseudoKey(candidate.pseudo) === key);

  if (!entry) {
    throw new Error("Impossible de relire le score qui vient d'être enregistré.");
  }

  return {
    entries,
    source: "memory",
    entry,
    improved,
    rank: rankOf(entries, submission.pseudo),
    totalPlayers: entries.length,
  };
}
