import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { GAME_CONFIG } from "../game/config";
import type {
  CreateSessionResponse,
  RevealHintResponse,
  StartLevelResponse,
  SubmitScoreResponse,
  ValidateResponse,
} from "../game/contracts";
import { pseudoKey, type NiveauEtude } from "../game/player";
import { getLevel, isLevelId, LEVELS, type LevelId } from "../levels";
import {
  canSkip,
  computeLevelScore,
  MAX_TOTAL_SCORE,
  type ScoreBreakdown,
} from "../scoring";
import { validateLevel } from "../validation/engine";
import type { ValidationResult } from "../validation/types";
import { clearAllScores, saveScore } from "./scoreStore";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Gestion des sessions de jeu côté serveur.
 *
 * - Protège chaque pseudo par un code PIN à 4 chiffres (anti-usurpation).
 * - Contrôle l'ordre des niveaux, le chrono par horodatage (`started_at` /
 *   `level_started_at`), l'utilisation de l'indice et le cumul des points.
 * - Garantit l'idempotence de la validation par niveau (verrou atomique sur
 *   `completed_at IS NULL` en base ou synchrone en mémoire).
 * - Utilise Supabase (`player_identities`, `game_sessions`,
 *   `session_level_results`) si configuré, avec repli automatique en mémoire.
 */

export class SessionHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "SessionHttpError";
  }
}

interface PlayerIdentityRecord {
  pseudoKey: string;
  pseudo: string;
  pinHash: string;
}

interface GameSessionRecord {
  id: string;
  tokenHash: string;
  pseudo: string;
  filiere: string;
  currentLevel: LevelId;
  startedAt: string;
  levelStartedAt: string;
  finishedAt: string | null;
  score: number;
  levelsValidated: number;
  status: "active" | "finished";
  scoreSaved: boolean;
}

interface LevelAttemptRecord {
  sessionId: string;
  levelId: LevelId;
  startedAt: string;
  timerStartedAt: string;
  completedAt: string | null;
  hintUsed: boolean;
  hintUsedAt: string | null;
  valid: boolean;
  skipped: boolean;
  pointsAwarded: number;
  elapsedSeconds: number;
}

interface MemorySessionBundle {
  session: GameSessionRecord;
  attempts: Map<LevelId, LevelAttemptRecord>;
}

interface SupabaseSessionRow {
  id: string;
  token_hash: string;
  pseudo: string;
  filiere: string;
  current_level: number;
  started_at: string;
  level_started_at: string;
  finished_at: string | null;
  score: number;
  levels_validated: number;
  status: "active" | "finished";
  score_saved: boolean;
}

interface SupabaseAttemptRow {
  session_id: string;
  level_id: number;
  started_at: string;
  timer_started_at: string;
  completed_at: string | null;
  hint_used: boolean;
  hint_used_at: string | null;
  valid: boolean;
  skipped: boolean;
  points_awarded: number;
  elapsed_seconds: number;
}

declare global {
  var __devarenaSessionMemory: Map<string, MemorySessionBundle> | undefined;
  var __devarenaIdentityMemory: Map<string, PlayerIdentityRecord> | undefined;
}

const memorySessions: Map<string, MemorySessionBundle> =
  (globalThis.__devarenaSessionMemory ??= new Map<string, MemorySessionBundle>());

const memoryIdentities: Map<string, PlayerIdentityRecord> =
  (globalThis.__devarenaIdentityMemory ??= new Map<string, PlayerIdentityRecord>());

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokensMatch(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPin(pin: string, storedHash: string): boolean {
  const [salt, expectedHex] = storedHash.split(":");
  if (!salt || !expectedHex) return false;
  const derived = scryptSync(pin, salt, 32);
  const expected = Buffer.from(expectedHex, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

function emptyBreakdown(): ScoreBreakdown {
  return {
    basePoints: 0,
    speedBonus: 0,
    hintPenalty: 0,
    totalPoints: 0,
  };
}

function supabaseSessionError(message: string): Error {
  return new Error(
    `Supabase : ${message}. Vérifie que supabase/schema.sql a bien été exécuté.`,
  );
}

function mapSupabaseSession(row: SupabaseSessionRow): GameSessionRecord {
  if (!isLevelId(row.current_level)) {
    throw new Error(`Niveau de session invalide : ${row.current_level}`);
  }
  return {
    id: row.id,
    tokenHash: row.token_hash,
    pseudo: row.pseudo,
    filiere: row.filiere,
    currentLevel: row.current_level,
    startedAt: row.started_at,
    levelStartedAt: row.level_started_at,
    finishedAt: row.finished_at,
    score: row.score,
    levelsValidated: row.levels_validated,
    status: row.status,
    scoreSaved: row.score_saved,
  };
}

function mapSupabaseAttempt(row: SupabaseAttemptRow): LevelAttemptRecord {
  if (!isLevelId(row.level_id)) {
    throw new Error(`Niveau de tentative invalide : ${row.level_id}`);
  }
  return {
    sessionId: row.session_id,
    levelId: row.level_id,
    startedAt: row.started_at,
    timerStartedAt: row.timer_started_at,
    completedAt: row.completed_at,
    hintUsed: row.hint_used,
    hintUsedAt: row.hint_used_at,
    valid: row.valid,
    skipped: row.skipped,
    pointsAwarded: row.points_awarded,
    elapsedSeconds: row.elapsed_seconds,
  };
}

function computeLevelTiming(
  levelStartedAtIso: string,
  durationSeconds: number,
  nowMs: number,
): { rawElapsedSeconds: number; remainingSeconds: number } {
  const startedAtMs = Date.parse(levelStartedAtIso);
  const rawElapsedSeconds = Math.max(0, (nowMs - startedAtMs) / 1000);
  const remainingSeconds = Math.max(0, durationSeconds - rawElapsedSeconds);
  return { rawElapsedSeconds, remainingSeconds };
}

function computeTotalTimeSeconds(startedAtIso: string, nowMs: number): number {
  return Math.max(0, Math.round((nowMs - Date.parse(startedAtIso)) / 1000));
}

/**
 * Vérifie ou enregistre le code PIN associé à un pseudo pour empêcher toute
 * usurpation d'identité tout en permettant au titulaire de rejouer.
 */
async function assertOrRegisterPlayerPin(
  pseudo: string,
  pin: string,
): Promise<void> {
  const key = pseudoKey(pseudo);
  const admin = getSupabaseAdmin();

  if (!admin) {
    const existing = memoryIdentities.get(key);
    if (!existing) {
      memoryIdentities.set(key, {
        pseudoKey: key,
        pseudo,
        pinHash: hashPin(pin),
      });
      return;
    }

    if (!verifyPin(pin, existing.pinHash)) {
      throw new SessionHttpError(
        409,
        "Ce pseudo est déjà protégé par un autre code PIN. Choisis un autre pseudo ou saisis ton code PIN.",
      );
    }
    return;
  }

  const { data: existing, error: readError } = await admin
    .from("player_identities")
    .select("pseudo_key, pin_hash")
    .eq("pseudo_key", key)
    .maybeSingle();

  if (readError) throw supabaseSessionError(readError.message);

  if (existing) {
    const row = existing as { pseudo_key: string; pin_hash: string };
    if (!verifyPin(pin, row.pin_hash)) {
      throw new SessionHttpError(
        409,
        "Ce pseudo est déjà protégé par un autre code PIN. Choisis un autre pseudo ou saisis ton code PIN.",
      );
    }
    return;
  }

  const { error: insertError } = await admin
    .from("player_identities")
    .insert({
      pseudo_key: key,
      pseudo,
      pin_hash: hashPin(pin),
    });

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: raced, error: reReadError } = await admin
        .from("player_identities")
        .select("pin_hash")
        .eq("pseudo_key", key)
        .maybeSingle();

      if (reReadError) throw supabaseSessionError(reReadError.message);
      if (raced && !verifyPin(pin, (raced as { pin_hash: string }).pin_hash)) {
        throw new SessionHttpError(
          409,
          "Ce pseudo est déjà protégé par un autre code PIN. Choisis un autre pseudo ou saisis ton code PIN.",
        );
      }
      return;
    }
    throw supabaseSessionError(insertError.message);
  }
}

/** Démarre une nouvelle session de jeu côté serveur. */
export async function createGameSession(input: {
  pseudo: string;
  filiereDisplay: string;
  niveau: NiveauEtude;
  pin: string;
}): Promise<CreateSessionResponse> {
  await assertOrRegisterPlayerPin(input.pseudo, input.pin);

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const readingWindowMs = GAME_CONFIG.readingWindowSeconds * 1000;
  const timerStartedAtIso = new Date(nowMs + readingWindowMs).toISOString();
  const firstLevel = LEVELS[0];
  const sessionToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(sessionToken);
  const admin = getSupabaseAdmin();

  if (!admin) {
    const id = crypto.randomUUID();
    const session: GameSessionRecord = {
      id,
      tokenHash,
      pseudo: input.pseudo,
      filiere: input.filiereDisplay,
      currentLevel: firstLevel.id,
      startedAt: nowIso,
      levelStartedAt: timerStartedAtIso,
      finishedAt: null,
      score: 0,
      levelsValidated: 0,
      status: "active",
      scoreSaved: false,
    };
    const attempts = new Map<LevelId, LevelAttemptRecord>([
      [
        firstLevel.id,
        {
          sessionId: id,
          levelId: firstLevel.id,
          startedAt: nowIso,
          timerStartedAt: timerStartedAtIso,
          completedAt: null,
          hintUsed: false,
          hintUsedAt: null,
          valid: false,
          skipped: false,
          pointsAwarded: 0,
          elapsedSeconds: 0,
        },
      ],
    ]);
    memorySessions.set(id, { session, attempts });

    return {
      sessionId: id,
      sessionToken,
      pseudo: session.pseudo,
      filiere: session.filiere,
      niveau: input.niveau,
      currentLevel: firstLevel.id,
      startedAt: nowIso,
      levelStartedAt: nowIso,
      timerStartedAt: timerStartedAtIso,
      readingWindowSeconds: GAME_CONFIG.readingWindowSeconds,
      levelDurationSeconds: firstLevel.durationSeconds,
      serverNow: nowIso,
    };
  }

  const { data: sessionRow, error: insertError } = await admin
    .from("game_sessions")
    .insert({
      token_hash: tokenHash,
      pseudo: input.pseudo,
      filiere: input.filiereDisplay,
      current_level: firstLevel.id,
      started_at: nowIso,
      level_started_at: timerStartedAtIso,
      score: 0,
      levels_validated: 0,
      status: "active",
      score_saved: false,
    })
    .select("*")
    .single();

  if (insertError || !sessionRow) {
    throw supabaseSessionError(
      insertError?.message ?? "Impossible de créer la session.",
    );
  }

  const session = mapSupabaseSession(sessionRow as SupabaseSessionRow);

  const { error: attemptError } = await admin
    .from("session_level_results")
    .insert({
      session_id: session.id,
      level_id: firstLevel.id,
      started_at: nowIso,
      timer_started_at: timerStartedAtIso,
      hint_used: false,
    });

  if (attemptError) {
    throw supabaseSessionError(attemptError.message);
  }

  return {
    sessionId: session.id,
    sessionToken,
    pseudo: session.pseudo,
    filiere: session.filiere,
    niveau: input.niveau,
    currentLevel: firstLevel.id,
    startedAt: session.startedAt,
    levelStartedAt: nowIso,
    timerStartedAt: timerStartedAtIso,
    readingWindowSeconds: GAME_CONFIG.readingWindowSeconds,
    levelDurationSeconds: firstLevel.durationSeconds,
    serverNow: nowIso,
  };
}

async function loadAuthenticatedSession(
  sessionId: string,
  sessionToken: string,
): Promise<GameSessionRecord> {
  const admin = getSupabaseAdmin();

  if (!admin) {
    const bundle = memorySessions.get(sessionId);
    if (!bundle || !tokensMatch(sessionToken, bundle.session.tokenHash)) {
      throw new SessionHttpError(401, "Session invalide ou expirée.");
    }
    return bundle.session;
  }

  const { data, error } = await admin
    .from("game_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    if (error.code === "22P02") {
      throw new SessionHttpError(401, "Session invalide ou expirée.");
    }
    throw supabaseSessionError(error.message);
  }

  if (!data) {
    throw new SessionHttpError(401, "Session invalide ou expirée.");
  }

  const session = mapSupabaseSession(data as SupabaseSessionRow);
  if (!tokensMatch(sessionToken, session.tokenHash)) {
    throw new SessionHttpError(401, "Session invalide ou expirée.");
  }

  return session;
}

async function loadLevelAttempt(
  sessionId: string,
  levelId: LevelId,
): Promise<LevelAttemptRecord> {
  const admin = getSupabaseAdmin();

  if (!admin) {
    const bundle = memorySessions.get(sessionId);
    const attempt = bundle?.attempts.get(levelId);
    if (!attempt) {
      throw new SessionHttpError(
        409,
        "Ce niveau n'est pas initialisé pour cette session.",
      );
    }
    return attempt;
  }

  const { data, error } = await admin
    .from("session_level_results")
    .select("*")
    .eq("session_id", sessionId)
    .eq("level_id", levelId)
    .maybeSingle();

  if (error) throw supabaseSessionError(error.message);
  if (!data) {
    throw new SessionHttpError(
      409,
      "Ce niveau n'est pas initialisé pour cette session.",
    );
  }

  return mapSupabaseAttempt(data as SupabaseAttemptRow);
}

/**
 * Démarre immédiatement le chrono du niveau en cours (avant l'expiration de la
 * fenêtre de lecture). Ne peut jamais repousser `timer_started_at` dans le futur.
 */
export async function startLevelTimer(input: {
  sessionId: string;
  sessionToken: string;
  levelId: LevelId;
}): Promise<StartLevelResponse> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const session = await loadAuthenticatedSession(
    input.sessionId,
    input.sessionToken,
  );

  if (session.status !== "active") {
    throw new SessionHttpError(409, "Cette partie est déjà terminée.");
  }
  if (session.currentLevel !== input.levelId) {
    throw new SessionHttpError(
      409,
      "Ce niveau n'est pas le niveau actif de la session.",
    );
  }

  const attempt = await loadLevelAttempt(session.id, input.levelId);
  if (attempt.completedAt !== null) {
    throw new SessionHttpError(409, "Ce niveau est déjà terminé.");
  }

  const timerMs = Date.parse(attempt.timerStartedAt);
  if (nowMs >= timerMs) {
    return {
      levelId: input.levelId,
      timerStartedAt: attempt.timerStartedAt,
      serverNow: nowIso,
    };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    attempt.timerStartedAt = nowIso;
    session.levelStartedAt = nowIso;
    return {
      levelId: input.levelId,
      timerStartedAt: nowIso,
      serverNow: nowIso,
    };
  }

  const { data: updatedRows, error: attemptError } = await admin
    .from("session_level_results")
    .update({ timer_started_at: nowIso })
    .eq("session_id", session.id)
    .eq("level_id", input.levelId)
    .is("completed_at", null)
    .gt("timer_started_at", nowIso)
    .select("timer_started_at");

  if (attemptError) throw supabaseSessionError(attemptError.message);

  if (updatedRows && updatedRows.length > 0) {
    await admin
      .from("game_sessions")
      .update({ level_started_at: nowIso })
      .eq("id", session.id);

    return {
      levelId: input.levelId,
      timerStartedAt: (updatedRows[0] as { timer_started_at: string })
        .timer_started_at,
      serverNow: nowIso,
    };
  }

  return {
    levelId: input.levelId,
    timerStartedAt: attempt.timerStartedAt,
    serverNow: nowIso,
  };
}

/** Enregistre côté serveur que l'indice a été révélé sur le niveau courant. */
export async function revealSessionHint(input: {
  sessionId: string;
  sessionToken: string;
  levelId: LevelId;
}): Promise<RevealHintResponse> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const session = await loadAuthenticatedSession(
    input.sessionId,
    input.sessionToken,
  );

  if (session.status !== "active") {
    throw new SessionHttpError(409, "Cette partie est déjà terminée.");
  }
  if (session.currentLevel !== input.levelId) {
    throw new SessionHttpError(
      409,
      "L'indice ne peut être débloqué que sur le niveau en cours.",
    );
  }

  const attempt = await loadLevelAttempt(session.id, input.levelId);
  if (attempt.completedAt !== null) {
    throw new SessionHttpError(409, "Ce niveau est déjà terminé.");
  }

  const level = getLevel(input.levelId);
  const { rawElapsedSeconds } = computeLevelTiming(
    attempt.startedAt,
    level.durationSeconds,
    nowMs,
  );
  if (rawElapsedSeconds >= level.durationSeconds) {
    throw new SessionHttpError(400, "Temps écoulé pour ce niveau.");
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    attempt.hintUsed = true;
    attempt.hintUsedAt ??= nowIso;
    return { levelId: input.levelId, hintUsed: true };
  }

  const { error } = await admin
    .from("session_level_results")
    .update({
      hint_used: true,
      hint_used_at: attempt.hintUsedAt ?? nowIso,
    })
    .eq("session_id", session.id)
    .eq("level_id", input.levelId)
    .is("completed_at", null);

  if (error) throw supabaseSessionError(error.message);

  return { levelId: input.levelId, hintUsed: true };
}

/**
 * Valide (ou passe) le niveau courant d'une session et calcule les points
 * uniquement à partir des horodatages serveur.
 */
export async function validateSessionAttempt(input: {
  sessionId: string;
  sessionToken: string;
  levelId: LevelId;
  code: string;
  hintUsed?: boolean;
  skipped?: boolean;
}): Promise<ValidateResponse> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const session = await loadAuthenticatedSession(
    input.sessionId,
    input.sessionToken,
  );

  if (session.status !== "active") {
    throw new SessionHttpError(409, "Cette partie est déjà terminée.");
  }
  if (session.currentLevel !== input.levelId) {
    throw new SessionHttpError(
      409,
      "Ce niveau n'est pas le niveau actif de la session.",
    );
  }

  const attempt = await loadLevelAttempt(session.id, input.levelId);
  if (attempt.completedAt !== null) {
    throw new SessionHttpError(409, "Ce niveau a déjà été validé.");
  }

  const level = getLevel(input.levelId);
  const { rawElapsedSeconds, remainingSeconds } = computeLevelTiming(
    attempt.timerStartedAt,
    level.durationSeconds,
    nowMs,
  );
  const skipped = input.skipped === true;

  if (skipped && !canSkip(input.levelId, remainingSeconds)) {
    throw new SessionHttpError(
      400,
      `Le bouton « Passer » n'est disponible qu'après ${GAME_CONFIG.skipAvailableAfterSeconds} secondes.`,
    );
  }

  if (
    !skipped &&
    rawElapsedSeconds > level.durationSeconds + GAME_CONFIG.submissionGraceSeconds
  ) {
    throw new SessionHttpError(
      400,
      "Temps écoulé pour ce niveau : utilise « Passer ».",
    );
  }

  const effectiveHintUsed = attempt.hintUsed || input.hintUsed === true;
  const admin = getSupabaseAdmin();

  if (input.hintUsed === true && !attempt.hintUsed) {
    if (!admin) {
      attempt.hintUsed = true;
      attempt.hintUsedAt ??= nowIso;
    } else {
      await admin
        .from("session_level_results")
        .update({ hint_used: true, hint_used_at: nowIso })
        .eq("session_id", session.id)
        .eq("level_id", input.levelId)
        .is("completed_at", null);
    }
  }

  let validation: ValidationResult;
  if (skipped) {
    validation = {
      valid: false,
      checks: [],
      feedback: "Niveau passé : 0 point attribué.",
    };
  } else {
    validation = validateLevel(input.levelId, input.code);
  }

  const completed = validation.valid || skipped;
  const totalTimeSoFar = computeTotalTimeSeconds(session.startedAt, nowMs);

  if (!completed) {
    return {
      levelId: input.levelId,
      valid: false,
      skipped: false,
      pointsAwarded: 0,
      breakdown: emptyBreakdown(),
      feedback: validation.feedback,
      checks: validation.checks,
      nextLevel: null,
      totalScore: session.score,
      levelsValidated: session.levelsValidated,
      totalTimeSeconds: totalTimeSoFar,
      remainingSeconds: Math.floor(remainingSeconds),
      nextLevelStartedAt: null,
      nextLevelTimerStartedAt: null,
      serverNow: nowIso,
      finished: false,
    };
  }

  const breakdown = validation.valid
    ? computeLevelScore(input.levelId, {
        remainingSeconds,
        hintUsed: effectiveHintUsed,
        skipped: false,
      })
    : emptyBreakdown();

  const candidateNext = input.levelId + 1;
  const hasNext = isLevelId(candidateNext);
  const nextLevel: LevelId | null = hasNext ? candidateNext : null;
  const finished = !hasNext;
  const readingWindowMs = GAME_CONFIG.readingWindowSeconds * 1000;
  const nextLevelStartedAt = hasNext
    ? new Date(nowMs + GAME_CONFIG.nextLevelDelayMs).toISOString()
    : null;
  const nextLevelTimerStartedAt = hasNext
    ? new Date(
        nowMs + GAME_CONFIG.nextLevelDelayMs + readingWindowMs,
      ).toISOString()
    : null;
  const newTotalScore = Math.min(
    MAX_TOTAL_SCORE,
    session.score + breakdown.totalPoints,
  );
  const newLevelsValidated =
    session.levelsValidated + (validation.valid ? 1 : 0);
  const newCurrentLevel: LevelId = nextLevel ?? input.levelId;
  const elapsedRounded = Math.max(0, Math.round(rawElapsedSeconds));

  if (!admin) {
    const bundle = memorySessions.get(session.id);
    const currentAttempt = bundle?.attempts.get(input.levelId);
    if (!bundle || !currentAttempt || currentAttempt.completedAt !== null) {
      throw new SessionHttpError(409, "Ce niveau a déjà été validé.");
    }

    currentAttempt.completedAt = nowIso;
    currentAttempt.hintUsed = effectiveHintUsed;
    currentAttempt.valid = validation.valid;
    currentAttempt.skipped = skipped;
    currentAttempt.pointsAwarded = breakdown.totalPoints;
    currentAttempt.elapsedSeconds = elapsedRounded;

    bundle.session.score = newTotalScore;
    bundle.session.levelsValidated = newLevelsValidated;
    bundle.session.currentLevel = newCurrentLevel;
    if (nextLevel && nextLevelStartedAt && nextLevelTimerStartedAt) {
      bundle.session.levelStartedAt = nextLevelTimerStartedAt;
      bundle.attempts.set(nextLevel, {
        sessionId: session.id,
        levelId: nextLevel,
        startedAt: nextLevelStartedAt,
        timerStartedAt: nextLevelTimerStartedAt,
        completedAt: null,
        hintUsed: false,
        hintUsedAt: null,
        valid: false,
        skipped: false,
        pointsAwarded: 0,
        elapsedSeconds: 0,
      });
    } else {
      bundle.session.status = "finished";
      bundle.session.finishedAt = nowIso;
    }
  } else {
    // Verrou atomique : un seul appel peut passer `completed_at` de NULL à nowIso.
    const { data: lockedRows, error: lockError } = await admin
      .from("session_level_results")
      .update({
        completed_at: nowIso,
        hint_used: effectiveHintUsed,
        valid: validation.valid,
        skipped,
        points_awarded: breakdown.totalPoints,
        elapsed_seconds: elapsedRounded,
      })
      .eq("session_id", session.id)
      .eq("level_id", input.levelId)
      .is("completed_at", null)
      .select("id");

    if (lockError) throw supabaseSessionError(lockError.message);
    if (!lockedRows || lockedRows.length === 0) {
      throw new SessionHttpError(409, "Ce niveau a déjà été validé.");
    }

    const { error: sessionUpdateError } = await admin
      .from("game_sessions")
      .update({
        score: newTotalScore,
        levels_validated: newLevelsValidated,
        current_level: newCurrentLevel,
        level_started_at: nextLevelTimerStartedAt ?? session.levelStartedAt,
        status: finished ? "finished" : "active",
        finished_at: finished ? nowIso : null,
      })
      .eq("id", session.id);

    if (sessionUpdateError) throw supabaseSessionError(sessionUpdateError.message);

    if (nextLevel && nextLevelStartedAt && nextLevelTimerStartedAt) {
      const { error: nextAttemptError } = await admin
        .from("session_level_results")
        .insert({
          session_id: session.id,
          level_id: nextLevel,
          started_at: nextLevelStartedAt,
          timer_started_at: nextLevelTimerStartedAt,
          hint_used: false,
        });

      if (nextAttemptError) throw supabaseSessionError(nextAttemptError.message);
    }
  }

  return {
    levelId: input.levelId,
    valid: validation.valid,
    skipped,
    pointsAwarded: breakdown.totalPoints,
    breakdown,
    feedback: validation.feedback,
    checks: validation.checks,
    nextLevel,
    totalScore: newTotalScore,
    levelsValidated: newLevelsValidated,
    totalTimeSeconds: totalTimeSoFar,
    remainingSeconds: Math.floor(remainingSeconds),
    nextLevelStartedAt,
    nextLevelTimerStartedAt,
    serverNow: nowIso,
    finished,
  };
}

/**
 * Enregistre au classement le score calculé par le serveur pour une session
 * terminée. Aucune valeur chiffrée n'est lue depuis le client.
 */
export async function saveFinishedSessionScore(input: {
  sessionId: string;
  sessionToken: string;
}): Promise<SubmitScoreResponse> {
  const session = await loadAuthenticatedSession(
    input.sessionId,
    input.sessionToken,
  );

  if (session.status !== "finished" || !session.finishedAt) {
    throw new SessionHttpError(
      400,
      "La partie doit être terminée avant d'enregistrer le score.",
    );
  }

  const totalTimeSeconds = computeTotalTimeSeconds(
    session.startedAt,
    Date.parse(session.finishedAt),
  );

  const result = await saveScore({
    pseudo: session.pseudo,
    filiere: session.filiere,
    score: session.score,
    currentLevel: session.currentLevel,
    totalTimeSeconds,
  });

  const admin = getSupabaseAdmin();
  if (!admin) {
    session.scoreSaved = true;
  } else if (!session.scoreSaved) {
    const { error } = await admin
      .from("game_sessions")
      .update({ score_saved: true })
      .eq("id", session.id);

    if (error) throw supabaseSessionError(error.message);
  }

  return {
    entry: result.entry,
    improved: result.improved,
    rank: result.rank,
    totalPlayers: result.totalPlayers,
    source: result.source,
  };
}

/**
 * Vide toutes les données de compétition (scores, sessions, tentatives et
 * identités PIN) avant le début de l'événement ou après des tests.
 */
export async function resetAllCompetitionData(): Promise<void> {
  memorySessions.clear();
  memoryIdentities.clear();
  await clearAllScores();

  const admin = getSupabaseAdmin();
  if (!admin) return;

  const { error: sessionsError } = await admin
    .from("game_sessions")
    .delete()
    .not("id", "is", null);
  if (sessionsError) throw supabaseSessionError(sessionsError.message);

  const { error: identitiesError } = await admin
    .from("player_identities")
    .delete()
    .not("pseudo_key", "is", null);
  if (identitiesError) throw supabaseSessionError(identitiesError.message);
}

/**
 * Utilitaire réservé aux tests : décale dans le passé les horodatages d'une
 * session mémoire pour tester les délais (30 s avant « Passer », timeout)
 * sans attendre en temps réel.
 */
export function shiftMemorySessionTimeForTests(
  sessionId: string,
  elapsedMs: number,
): void {
  const bundle = memorySessions.get(sessionId);
  if (!bundle) {
    throw new Error(`Session mémoire introuvable : ${sessionId}`);
  }

  bundle.session.startedAt = new Date(
    Date.parse(bundle.session.startedAt) - elapsedMs,
  ).toISOString();
  bundle.session.levelStartedAt = new Date(
    Date.parse(bundle.session.levelStartedAt) - elapsedMs,
  ).toISOString();

  for (const attempt of bundle.attempts.values()) {
    attempt.startedAt = new Date(
      Date.parse(attempt.startedAt) - elapsedMs,
    ).toISOString();
    attempt.timerStartedAt = new Date(
      Date.parse(attempt.timerStartedAt) - elapsedMs,
    ).toISOString();
  }
}

export function resetMemorySessionsForTests(): void {
  memorySessions.clear();
  memoryIdentities.clear();
}
