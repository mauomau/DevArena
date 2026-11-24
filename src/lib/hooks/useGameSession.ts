"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LEVELS } from "../levels";
import type { LevelId } from "../levels";
import { GAME_CONFIG } from "../game/config";
import { MAX_TOTAL_SCORE } from "../scoring";

import type {
  ValidateRequest,
  ValidateResponse,
  ApiErrorResponse,
} from "../game/contracts";

type GameStep = "intro" | "playing" | "finished";

interface PlayerInfo {
  pseudo: string;
  filiere: string;
}

interface GameSessionState {
  step: GameStep;
  player: PlayerInfo;
  levelIndex: number;
  code: string;
  remainingSeconds: number;
  score: number;
  hintUsed: boolean;
  validation: ValidateResponse | null;
  isSubmitting: boolean;
  error: string | null;
  totalTimeSpent: number;
}

// Source unique du délai avant « Passer » (même valeur que l'API : 30 s)
const SKIP_DELAY_SECONDS = GAME_CONFIG.skipAvailableAfterSeconds;

// Délai d'affichage du message de succès avant le niveau suivant
const NEXT_LEVEL_DELAY_MS = 1800;

const initialState: GameSessionState = {
  step: "intro",
  player: {
    pseudo: "",
    filiere: "",
  },
  levelIndex: 0,
  code: "",
  remainingSeconds: 0,
  score: 0,
  hintUsed: false,
  validation: null,
  isSubmitting: false,
  error: null,
  totalTimeSpent: 0,
};

// Niveau réussi ou passé : le joueur attend le niveau suivant
const isSuccessful = (validation: ValidateResponse | null): boolean =>
  validation !== null && (validation.valid || validation.skipped);

export function useGameSession() {
  const [state, setState] = useState<GameSessionState>(initialState);

  // Verrou synchrone : empêche un double-clic de créditer deux fois le même niveau
  const submitLockRef = useRef(false);
  const nextLevelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
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
    [state.levelIndex]
  );

  const isLastLevel = state.levelIndex === LEVELS.length - 1;
  const isSuccess = isSuccessful(state.validation);
  const isTimeUp = state.step === "playing" && state.remainingSeconds <= 0;

  // Temps écoulé sur le niveau actuel (repart à zéro au niveau suivant)
  const levelDuration = currentLevel?.durationSeconds ?? 0;

  const elapsedSeconds = Math.max(0, levelDuration - state.remainingSeconds);

  const skipRemainingSeconds = Math.max(0, SKIP_DELAY_SECONDS - elapsedSeconds);

  const canSkip =
    state.step === "playing" &&
    skipRemainingSeconds === 0 &&
    !state.isSubmitting &&
    !isSuccess;

  // --------------------------------------------------
  // Démarrage
  // --------------------------------------------------

  const startGame = useCallback(
    (pseudo: string, filiere: string) => {
      const firstLevel = LEVELS[0];

      clearNextLevelTimeout();
      submitLockRef.current = false;

      setState({
        ...initialState,
        step: "playing",
        player: {
          pseudo: pseudo.trim(),
          filiere: filiere.trim(),
        },
        code: firstLevel.starterCode,
        remainingSeconds: firstLevel.durationSeconds,
      });
    },
    [clearNextLevelTimeout]
  );

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
  // Indice (nommé revealHint : un nom en « use... » est pris pour un hook par ESLint)
  // --------------------------------------------------

  const revealHint = useCallback(() => {
    setState((prev) => {
      if (
        prev.hintUsed ||
        prev.isSubmitting ||
        prev.remainingSeconds <= 0 ||
        isSuccessful(prev.validation)
      ) {
        return prev;
      }

      return { ...prev, hintUsed: true };
    });
  }, []);

  // --------------------------------------------------
  // Chronomètres (un seul intervalle, relancé uniquement si `step` change)
  //  - remainingSeconds : décompte du niveau, en pause pendant la validation
  //    et après un succès
  //  - totalTimeSpent   : continue de courir pendant la validation, donc il peut
  //    être légèrement supérieur à la somme des temps de niveau
  // --------------------------------------------------

  useEffect(() => {
    if (state.step !== "playing") return;

    const interval = setInterval(() => {
      setState((prev) => {
        if (prev.step !== "playing") return prev;

        const levelPaused =
          prev.isSubmitting || isSuccessful(prev.validation);

        return {
          ...prev,
          totalTimeSpent: prev.totalTimeSpent + 1,
          remainingSeconds: levelPaused
            ? prev.remainingSeconds
            : Math.max(0, prev.remainingSeconds - 1),
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.step]);

  // --------------------------------------------------
  // Validation
  // --------------------------------------------------

  const submitAttempt = useCallback(
    async (skipped = false) => {
      if (!currentLevel) return;
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
        levelId: currentLevel.id as LevelId,
        code: state.code,
        remainingSeconds: state.remainingSeconds,
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

        // Le backend est la seule source de vérité pour les points
        if (succeeded && !result.skipped && !Number.isFinite(result.pointsAwarded)) {
          throw new Error("Réponse invalide du serveur (points manquants).");
        }

        const awarded = result.skipped
          ? 0
          : Math.max(0, Math.floor(result.pointsAwarded));

        setState((prev) => ({
          ...prev,
          validation: result,
          score: Math.min(MAX_TOTAL_SCORE, prev.score + awarded),
          isSubmitting: false,
        }));

        // Échec : le joueur reste sur le niveau et peut réessayer.
        if (!succeeded) {
          submitLockRef.current = false;
          return;
        }

        // Réussite ou passage : le verrou reste actif jusqu'au changement de niveau.
        const nextIndex =
          result.nextLevel === null
            ? -1
            : LEVELS.findIndex((level) => level.id === result.nextLevel);

        nextLevelTimeoutRef.current = setTimeout(() => {
          nextLevelTimeoutRef.current = null;

          if (nextIndex !== -1 && nextIndex !== levelIndexAtClick) {
            const nextLevel = LEVELS[nextIndex];

            setState((prev) => ({
              ...prev,
              levelIndex: nextIndex,
              code: nextLevel.starterCode,
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
    ]
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
    isLastLevel,

    startGame,
    updateCode,
    revealHint,
    submitAttempt,
    skipLevel,
    resetGame,
  };
}