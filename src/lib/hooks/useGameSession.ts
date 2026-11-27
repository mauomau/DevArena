"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LEVELS } from "../levels";
import type { LevelId } from "../levels";
import { GAME_CONFIG } from "../game/config";
import { gameSounds } from "../sound";

import type {
  ApiErrorResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  RevealHintRequest,
  StartLevelRequest,
  StartLevelResponse,
  SubmitScoreRequest,
  SubmitScoreResponse,
  ValidateRequest,
  ValidateResponse,
} from "../game/contracts";

type GameStep = "intro" | "playing" | "finished";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface PlayerInfo {
  pseudo: string;
  filiere: string;
}

interface SessionAuth {
  sessionId: string;
  sessionToken: string;
}

interface GameSessionState {
  step: GameStep;
  player: PlayerInfo;
  levelIndex: number;
  code: string;
  readingSeconds: number;
  remainingSeconds: number;
  score: number;
  hintUsed: boolean;
  validation: ValidateResponse | null;
  isSubmitting: boolean;
  error: string | null;
  totalTimeSpent: number;
  levelsValidated: number;
}

// Source unique du délai avant « Passer » (même valeur que l'API : 30 s)
const SKIP_DELAY_SECONDS = GAME_CONFIG.skipAvailableAfterSeconds;

// Délai d'affichage du message de succès avant le niveau suivant
const NEXT_LEVEL_DELAY_MS = GAME_CONFIG.nextLevelDelayMs;

// Fréquence de rafraîchissement de l'affichage du chrono (calculé par horodatage)
const TIMER_TICK_MS = 250;

const initialState: GameSessionState = {
  step: "intro",
  player: {
    pseudo: "",
    filiere: "",
  },
  levelIndex: 0,
  code: "",
  readingSeconds: 0,
  remainingSeconds: 0,
  score: 0,
  hintUsed: false,
  validation: null,
  isSubmitting: false,
  error: null,
  totalTimeSpent: 0,
  levelsValidated: 0,
};

// Niveau réussi ou passé : le joueur attend le niveau suivant
const isSuccessful = (validation: ValidateResponse | null): boolean =>
  validation !== null && (validation.valid || validation.skipped);

function computeClockOffsetMs(serverNowIso: string): number {
  const serverMs = Date.parse(serverNowIso);
  if (!Number.isFinite(serverMs)) return 0;
  return Date.now() - serverMs;
}

export function useGameSession() {
  const [state, setState] = useState<GameSessionState>(initialState);

  // Démarrage de session
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Enregistrement au classement (fin de partie)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finalRank, setFinalRank] = useState<number | null>(null);
  const [finalTotalPlayers, setFinalTotalPlayers] = useState<number | null>(
    null,
  );

  const sessionAuthRef = useRef<SessionAuth | null>(null);
  const clockOffsetMsRef = useRef(0);
  const gameStartedAtMsRef = useRef(0);
  const levelStartedAtMsRef = useRef(0);

  const scoreSavedRef = useRef(false);
  const hintLockRef = useRef(false);
  const submitLockRef = useRef(false);
  const nextLevelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearNextLevelTimeout = useCallback(() => {
    if (nextLevelTimeoutRef.current) {
      clearTimeout(nextLevelTimeoutRef.current);
      nextLevelTimeoutRef.current = null;
    }
  }, []);

  // Nettoyage au démontage de la page
  useEffect(() => clearNextLevelTimeout, [clearNextLevelTimeout]);

  const currentLevel = useMemo(
    () => LEVELS[state.levelIndex],
    [state.levelIndex],
  );

  const isLastLevel = state.levelIndex === LEVELS.length - 1;
  const isSuccess = isSuccessful(state.validation);
  const isReading = state.step === "playing" && state.readingSeconds > 0;
  const isTimeUp =
    state.step === "playing" && !isReading && state.remainingSeconds <= 0;

  // Temps écoulé sur le niveau actuel (repart à zéro au niveau suivant)
  const levelDuration = currentLevel?.durationSeconds ?? 0;
  const elapsedSeconds = Math.max(0, levelDuration - state.remainingSeconds);
  const skipRemainingSeconds = Math.max(0, SKIP_DELAY_SECONDS - elapsedSeconds);

  const canSkip =
    state.step === "playing" &&
    !isReading &&
    skipRemainingSeconds === 0 &&
    !state.isSubmitting &&
    !isSuccess;

  // --------------------------------------------------
  // Démarrage (crée la session côté serveur)
  // --------------------------------------------------

  const startGame = useCallback(
    async (pseudo: string, filiere: string, niveau: string, pin: string) => {
      if (isStarting) return;

      setIsStarting(true);
      setStartError(null);

      try {
        const payload: CreateSessionRequest = {
          pseudo: pseudo.trim(),
          filiere: filiere.trim(),
          niveau: niveau.trim(),
          pin: pin.trim(),
        };

        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = (await response.json().catch(() => null)) as
          | CreateSessionResponse
          | ApiErrorResponse
          | null;

        if (!response.ok || !data || !("sessionId" in data)) {
          const apiError = data as ApiErrorResponse | null;
          throw new Error(
            apiError?.error || "Impossible de démarrer la partie.",
          );
        }

        const firstLevel = LEVELS[0];
        const offsetMs = computeClockOffsetMs(data.serverNow);

        clearNextLevelTimeout();
        submitLockRef.current = false;
        hintLockRef.current = false;
        scoreSavedRef.current = false;

        sessionAuthRef.current = {
          sessionId: data.sessionId,
          sessionToken: data.sessionToken,
        };
        clockOffsetMsRef.current = offsetMs;
        gameStartedAtMsRef.current = Date.parse(data.startedAt) + offsetMs;
        levelStartedAtMsRef.current =
          Date.parse(data.timerStartedAt) + offsetMs;

        setSaveStatus("idle");
        setSaveError(null);
        setFinalRank(null);
        setFinalTotalPlayers(null);

        setState({
          ...initialState,
          step: "playing",
          player: {
            pseudo: data.pseudo,
            filiere: data.filiere,
          },
          code: firstLevel.starterCode,
          readingSeconds: data.readingWindowSeconds,
          remainingSeconds: firstLevel.durationSeconds,
        });
        gameSounds.start();
      } catch (error) {
        setStartError(
          error instanceof Error
            ? error.message
            : "Impossible de contacter le serveur.",
        );
      } finally {
        setIsStarting(false);
      }
    },
    [clearNextLevelTimeout, isStarting],
  );

  // --------------------------------------------------
  // Enregistrement du score final dans le classement
  // --------------------------------------------------

  const submitScore = useCallback(async () => {
    const auth = sessionAuthRef.current;
    if (!auth) {
      setSaveError("Session introuvable pour enregistrer le score.");
      setSaveStatus("error");
      return;
    }

    setSaveStatus("saving");
    setSaveError(null);

    try {
      const payload: SubmitScoreRequest = {
        sessionId: auth.sessionId,
        sessionToken: auth.sessionToken,
      };

      const response = await fetch("/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as
        | (Partial<SubmitScoreResponse> & ApiErrorResponse)
        | null;

      if (!response.ok || !data) {
        throw new Error(
          data?.error || "Enregistrement du score impossible.",
        );
      }

      if (data.entry) {
        setState((prev) => ({
          ...prev,
          score: data.entry?.score ?? prev.score,
        }));
      }
      setFinalRank(typeof data.rank === "number" ? data.rank : null);
      setFinalTotalPlayers(
        typeof data.totalPlayers === "number" ? data.totalPlayers : null,
      );
      setSaveStatus("saved");
    } catch (error) {
      // Autorise le bouton « Réessayer ».
      scoreSavedRef.current = false;
      setSaveError(
        error instanceof Error
          ? error.message
          : "Enregistrement du score impossible.",
      );
      setSaveStatus("error");
    }
  }, []);

  // Fin de partie : une seule soumission automatique par partie.
  useEffect(() => {
    if (state.step !== "finished" || scoreSavedRef.current) return;

    scoreSavedRef.current = true;
    void submitScore();
  }, [state.step, submitScore]);

  const retrySave = useCallback(() => {
    scoreSavedRef.current = true;
    void submitScore();
  }, [submitScore]);

  // --------------------------------------------------
  // Mise à jour du code
  // --------------------------------------------------

  const updateCode = useCallback((newCode: string) => {
    setState((prev) => ({
      ...prev,
      code: newCode,
    }));
  }, []);

  // --------------------------------------------------
  // Indice (enregistré côté serveur pour garantir la pénalité)
  // --------------------------------------------------

  const revealHint = useCallback(async () => {
    const auth = sessionAuthRef.current;
    if (!auth || !currentLevel) return;
    if (
      hintLockRef.current ||
      state.hintUsed ||
      state.isSubmitting ||
      state.remainingSeconds <= 0 ||
      isSuccess
    ) {
      return;
    }

    hintLockRef.current = true;

    try {
      const payload: RevealHintRequest = {
        sessionId: auth.sessionId,
        sessionToken: auth.sessionToken,
        levelId: currentLevel.id as LevelId,
      };

      const response = await fetch("/api/sessions/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as
        | ApiErrorResponse
        | { hintUsed?: boolean }
        | null;

      if (!response.ok) {
        const message =
          data && "error" in data && typeof data.error === "string"
            ? data.error
            : "Impossible d'afficher l'indice.";
        throw new Error(message);
      }

      setState((prev) => ({
        ...prev,
        hintUsed: true,
        error: null,
      }));
      gameSounds.hint();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'afficher l'indice.",
      }));
    } finally {
      hintLockRef.current = false;
    }
  }, [
    currentLevel,
    isSuccess,
    state.hintUsed,
    state.isSubmitting,
    state.remainingSeconds,
  ]);

  // --------------------------------------------------
  // Démarrer le chrono immédiatement après lecture de l'énoncé
  // --------------------------------------------------

  const startLevelNow = useCallback(async () => {
    const auth = sessionAuthRef.current;
    if (!auth || !currentLevel) return;
    if (state.readingSeconds <= 0) return;

    // Mise à jour immédiate côté UI pour zéro latence ressentie
    const localNowMs = Date.now();
    levelStartedAtMsRef.current = localNowMs;
    setState((prev) => ({
      ...prev,
      readingSeconds: 0,
      remainingSeconds: currentLevel.durationSeconds,
    }));
    gameSounds.start();

    try {
      const payload: StartLevelRequest = {
        sessionId: auth.sessionId,
        sessionToken: auth.sessionToken,
        levelId: currentLevel.id as LevelId,
      };
      const response = await fetch("/api/sessions/start-level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) return;
      const data = (await response.json().catch(() => null)) as
        | StartLevelResponse
        | null;
      if (data?.timerStartedAt && data?.serverNow) {
        const offsetMs = computeClockOffsetMs(data.serverNow);
        clockOffsetMsRef.current = offsetMs;
        levelStartedAtMsRef.current =
          Date.parse(data.timerStartedAt) + offsetMs;
      }
    } catch {
      // Le fallback local reste cohérent ; l'API recalcule toujours côté serveur
    }
  }, [currentLevel, state.readingSeconds]);

  // --------------------------------------------------
  // Chronomètres basés sur les horodatages serveur (zéro dérive)
  //  - readingSeconds   : temps de lecture avant le départ du chrono niveau
  //  - remainingSeconds : figé pendant la lecture, la validation et après succès
  //  - totalTimeSpent   : calculé depuis gameStartedAtMsRef
  // --------------------------------------------------

  useEffect(() => {
    if (state.step !== "playing") return;

    const interval = setInterval(() => {
      const nowMs = Date.now();

      setState((prev) => {
        if (prev.step !== "playing") return prev;

        const level = LEVELS[prev.levelIndex];
        const duration = level?.durationSeconds ?? 0;
        const levelPaused =
          prev.isSubmitting || isSuccessful(prev.validation);

        const nextTotalTimeSpent = Math.max(
          0,
          Math.floor((nowMs - gameStartedAtMsRef.current) / 1000),
        );

        const nextReadingSeconds = levelPaused
          ? 0
          : Math.max(
              0,
              Math.ceil((levelStartedAtMsRef.current - nowMs) / 1000),
            );

        const elapsedOnLevel = Math.max(
          0,
          (nowMs - levelStartedAtMsRef.current) / 1000,
        );
        const nextRemainingSeconds =
          nextReadingSeconds > 0
            ? duration
            : levelPaused
              ? prev.remainingSeconds
              : Math.max(0, Math.ceil(duration - elapsedOnLevel));

        if (
          nextTotalTimeSpent === prev.totalTimeSpent &&
          nextRemainingSeconds === prev.remainingSeconds &&
          nextReadingSeconds === prev.readingSeconds
        ) {
          return prev;
        }

        if (
          nextReadingSeconds === 0 &&
          !levelPaused &&
          nextRemainingSeconds < prev.remainingSeconds &&
          nextRemainingSeconds > 0 &&
          nextRemainingSeconds <= 5
        ) {
          gameSounds.tick();
        }

        return {
          ...prev,
          totalTimeSpent: nextTotalTimeSpent,
          readingSeconds: nextReadingSeconds,
          remainingSeconds: nextRemainingSeconds,
        };
      });
    }, TIMER_TICK_MS);

    return () => clearInterval(interval);
  }, [state.step]);

  // --------------------------------------------------
  // Validation
  // --------------------------------------------------

  const submitAttempt = useCallback(
    async (skipped = false) => {
      const auth = sessionAuthRef.current;
      if (!currentLevel || !auth) return;
      if (submitLockRef.current) return;
      if (state.isSubmitting) return;

      // « Valider » impossible quand le temps est écoulé (« Passer » reste permis)
      if (!skipped && state.remainingSeconds <= 0) return;

      submitLockRef.current = true;

      const levelIndexAtClick = state.levelIndex;

      setState((prev) => ({
        ...prev,
        isSubmitting: true,
        error: null,
        validation: null,
      }));

      const payload: ValidateRequest = {
        sessionId: auth.sessionId,
        sessionToken: auth.sessionToken,
        levelId: currentLevel.id as LevelId,
        code: state.code,
        hintUsed: state.hintUsed,
        skipped,
      };

      try {
        const response = await fetch("/api/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = (await response.json().catch(() => null)) as
          | ValidateResponse
          | ApiErrorResponse
          | null;

        if (!response.ok || !data) {
          const apiError = data as ApiErrorResponse | null;
          throw new Error(apiError?.error || "Une erreur est survenue.");
        }

        const result = data as ValidateResponse;
        const succeeded = result.valid || result.skipped;
        const offsetMs = computeClockOffsetMs(result.serverNow);
        clockOffsetMsRef.current = offsetMs;

        setState((prev) => ({
          ...prev,
          validation: result,
          score: result.totalScore,
          levelsValidated: result.levelsValidated,
          totalTimeSpent: result.totalTimeSeconds,
          remainingSeconds: succeeded
            ? result.remainingSeconds
            : Math.min(prev.remainingSeconds, result.remainingSeconds),
          isSubmitting: false,
        }));

        // Échec : le joueur reste sur le niveau et peut réessayer.
        if (!succeeded) {
          gameSounds.error();
          submitLockRef.current = false;
          return;
        }

        if (result.skipped) {
          gameSounds.skip();
        } else {
          gameSounds.success();
        }

        // Réussite ou passage : le verrou reste actif jusqu'au changement de niveau.
        const nextIndex =
          result.nextLevel === null
            ? -1
            : LEVELS.findIndex((level) => level.id === result.nextLevel);

        nextLevelTimeoutRef.current = setTimeout(() => {
          nextLevelTimeoutRef.current = null;

          if (
            nextIndex !== -1 &&
            nextIndex !== levelIndexAtClick &&
            !result.finished
          ) {
            const nextLevel = LEVELS[nextIndex];
            const timerTargetIso =
              result.nextLevelTimerStartedAt ?? result.nextLevelStartedAt;
            if (timerTargetIso) {
              levelStartedAtMsRef.current =
                Date.parse(timerTargetIso) + clockOffsetMsRef.current;
            } else {
              levelStartedAtMsRef.current =
                Date.now() + GAME_CONFIG.readingWindowSeconds * 1000;
            }

            setState((prev) => ({
              ...prev,
              levelIndex: nextIndex,
              code: nextLevel.starterCode,
              readingSeconds: GAME_CONFIG.readingWindowSeconds,
              remainingSeconds: nextLevel.durationSeconds,
              hintUsed: false,
              validation: null,
              isSubmitting: false,
              error: null,
            }));
          } else {
            // Aucun niveau suivant : fin de partie.
            setState((prev) => ({
              ...prev,
              step: "finished",
              totalTimeSpent: result.totalTimeSeconds,
              isSubmitting: false,
            }));
          }

          submitLockRef.current = false;
        }, NEXT_LEVEL_DELAY_MS);
      } catch (error) {
        submitLockRef.current = false;

        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          error:
            error instanceof Error
              ? error.message
              : "Impossible de contacter le serveur.",
        }));
      }
    },
    [
      currentLevel,
      state.code,
      state.levelIndex,
      state.remainingSeconds,
      state.hintUsed,
      state.isSubmitting,
    ],
  );

  // --------------------------------------------------
  // Passage manuel
  // --------------------------------------------------

  const skipLevel = useCallback(async () => {
    if (!currentLevel || state.isSubmitting) return;

    // Protection de l'interface (l'API vérifie aussi cette règle).
    if (skipRemainingSeconds > 0) {
      setState((prev) => ({
        ...prev,
        error: `Tu dois attendre encore ${skipRemainingSeconds} seconde(s) avant de passer ce niveau.`,
      }));

      return;
    }

    await submitAttempt(true);
  }, [
    currentLevel,
    state.isSubmitting,
    skipRemainingSeconds,
    submitAttempt,
  ]);

  // --------------------------------------------------
  // Recommencer
  // --------------------------------------------------

  const resetGame = useCallback(() => {
    clearNextLevelTimeout();
    submitLockRef.current = false;
    hintLockRef.current = false;
    scoreSavedRef.current = false;
    sessionAuthRef.current = null;
    clockOffsetMsRef.current = 0;
    gameStartedAtMsRef.current = 0;
    levelStartedAtMsRef.current = 0;

    setIsStarting(false);
    setStartError(null);
    setSaveStatus("idle");
    setSaveError(null);
    setFinalRank(null);
    setFinalTotalPlayers(null);
    setState(initialState);
  }, [clearNextLevelTimeout]);

  // --------------------------------------------------
  // Valeurs exposées
  // --------------------------------------------------

  return {
    step: state.step,
    player: state.player,
    currentLevel,
    levelIndex: state.levelIndex,
    totalLevels: LEVELS.length,
    code: state.code,
    readingSeconds: state.readingSeconds,
    isReading,
    remainingSeconds: state.remainingSeconds,
    elapsedSeconds,
    skipRemainingSeconds,
    canSkip,
    isTimeUp,
    isSuccess,
    score: state.score,
    hintUsed: state.hintUsed,
    validation: state.validation,
    isSubmitting: state.isSubmitting,
    error: state.error,
    totalTimeSpent: state.totalTimeSpent,
    levelsValidated: state.levelsValidated,
    isLastLevel,

    isStarting,
    startError,
    saveStatus,
    saveError,
    finalRank,
    finalTotalPlayers,

    startGame,
    startLevelNow,
    updateCode,
    revealHint,
    submitAttempt,
    skipLevel,
    resetGame,
    retrySave,
  };
}
