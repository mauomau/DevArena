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
 * - Si Supabase est configuré (URL + service role), les écritures passent par
 *   la fonction RPC atomique `upsert_best_score` (PostgreSQL `ON CONFLICT` +
 *   calcul du rang exact en base, sans limite arbitraire à 500 joueurs).
 * - Sinon, un store mémoire permet de tester tout le parcours en local
 *   (session → API → leaderboard) sans aucune clé. ⚠️ Ce mode n'est PAS
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

interface UpsertBestScoreRow extends ScoreRow {
  improved: boolean;
  rank: number | string;
  total_players: number | string;
}

const SCORE_COLUMNS =
  "id, pseudo, filiere, score, current_level, total_time_seconds, updated_at";

const PAGE_SIZE = 1000;

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

/**
 * Classement courant, trié (score décroissant puis temps croissant).
 * Pagine par tranches de 1000 lignes dans l'ordre officiel afin de ne jamais
 * tronquer silencieusement les meilleurs scores.
 */
export async function listScores(): Promise<LeaderboardSnapshot> {
  const admin = getSupabaseAdmin();

  if (!admin) {
    return {
      entries: sortEntries([...memoryScores.values()]),
      source: "memory",
    };
  }

  const allRows: ScoreRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("scores")
      .select(SCORE_COLUMNS)
      .order("score", { ascending: false })
      .order("total_time_seconds", { ascending: true })
      .order("pseudo", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw supabaseError(error.message);

    const page = (data ?? []) as ScoreRow[];
    allRows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
    offset += PAGE_SIZE;
  }

  return {
    entries: sortEntries(allRows.map(mapRow)),
    source: "supabase",
  };
}

/**
 * Enregistre la performance d'un joueur de façon atomique.
 * Un joueur n'a qu'une ligne : seule sa meilleure performance est conservée.
 */
export async function saveScore(
  submission: ScoreSubmission,
): Promise<SaveScoreResult> {
  const admin = getSupabaseAdmin();

  if (!admin) {
    return saveInMemory(submission);
  }

  const { data, error } = await admin.rpc("upsert_best_score", {
    p_pseudo: submission.pseudo,
    p_filiere: submission.filiere,
    p_score: submission.score,
    p_current_level: submission.currentLevel,
    p_total_time_seconds: submission.totalTimeSeconds,
  });

  if (error) throw supabaseError(error.message);

  const rawRow = Array.isArray(data)
    ? (data[0] as UpsertBestScoreRow | undefined)
    : (data as UpsertBestScoreRow | null);

  if (!rawRow) {
    throw new Error("Score enregistré mais introuvable dans le classement.");
  }

  const snapshot = await listScores();

  return {
    ...snapshot,
    entry: mapRow(rawRow),
    improved: Boolean(rawRow.improved),
    rank: Number(rawRow.rank),
    totalPlayers: Number(rawRow.total_players),
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

export async function clearAllScores(): Promise<void> {
  memoryScores.clear();
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const { error } = await admin
    .from("scores")
    .delete()
    .not("id", "is", null);

  if (error) throw supabaseError(error.message);
}

export function resetMemoryScoresForTests(): void {
  memoryScores.clear();
}
