"use client";

import { Lightbulb, Play, SkipForward } from "lucide-react";

import ValidationFeedback from "./ValidationFeedback";
import { GAME_CONFIG } from "@/lib/game/config";
import type { ValidateResponse } from "@/lib/game/contracts";

interface ChallengePanelProps {
  level: {
    theme: string;
    basePoints: number;
    title: string;
    statement: string;
    hint: string;
  };

  hintUsed: boolean;
  isTimeUp: boolean;
  isSubmitting: boolean;
  isSuccess: boolean;
  canSkip: boolean;
  skipRemainingSeconds: number;
  error: string | null;
  validation: ValidateResponse | null;

  onUseHint: () => void;
  onSubmit: () => void;
  onSkip: () => void;
}

export default function ChallengePanel({
  level,
  hintUsed,
  isTimeUp,
  isSubmitting,
  isSuccess,
  canSkip,
  skipRemainingSeconds,
  error,
  validation,
  onUseHint,
  onSubmit,
  onSkip,
}: ChallengePanelProps) {
  const skipDelay = GAME_CONFIG.skipAvailableAfterSeconds;
  const hintPenalty = GAME_CONFIG.hintPenalty;

  // Le délai est écoulé indépendamment de l'état « validation en cours / succès » :
  // on s'en sert pour le texte, alors que `canSkip` ne sert qu'à activer le bouton.
  const skipDelayElapsed = skipRemainingSeconds <= 0;

  return (
    <section className="lg:col-span-4 bg-white border-r border-slate-200 p-5 flex flex-col justify-between overflow-y-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-[#FDF2F3] text-[#9E1B24]">
            {level.theme}
          </span>

          <span className="text-xs font-semibold text-slate-500">
            Base : {level.basePoints} pts
          </span>
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            {level.title}
          </h2>

          <p className="mt-2 text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            {level.statement}
          </p>
        </div>

        <div>
          {!hintUsed ? (
            <button
              type="button"
              disabled={isTimeUp || isSubmitting || isSuccess}
              onClick={onUseHint}
              className="w-full py-2.5 px-3 rounded-xl bg-[#FCF8E8] hover:bg-[#D4AF37]/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#FCF8E8] text-[#947618] border border-[#D4AF37]/50 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Lightbulb className="w-4 h-4 text-[#B59224]" />

              {isTimeUp
                ? "Temps écoulé"
                : `Afficher un indice (-${hintPenalty} pts)`}
            </button>
          ) : (
            <div className="p-3.5 rounded-xl bg-[#FCF8E8] border border-[#D4AF37] text-xs text-slate-800 space-y-1">
              <p className="font-bold text-[#947618] flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4" />
                Indice débloqué (-{hintPenalty} pts) :
              </p>

              <p className="leading-relaxed">{level.hint}</p>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl border border-red-300 bg-red-50 text-red-900 text-xs">
            <p className="font-bold">{error}</p>
          </div>
        )}

        <ValidationFeedback validation={validation} />
      </div>

      <div className="pt-5 space-y-2.5 border-t border-slate-100 mt-4">
        <button
          type="button"
          disabled={isTimeUp || isSubmitting || isSuccess}
          onClick={onSubmit}
          className="w-full py-3.5 px-4 rounded-xl bg-[#9E1B24] hover:bg-[#7A1219] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#9E1B24] text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />

          {isTimeUp
            ? "Temps écoulé"
            : isSubmitting
              ? "Vérification en cours..."
              : "Valider mon code"}
        </button>

        <button
          type="button"
          disabled={!canSkip}
          onClick={onSkip}
          title={
            skipDelayElapsed
              ? "Passer ce niveau (0 pt)"
              : `Disponible après ${skipDelay} secondes de jeu (${skipRemainingSeconds}s restantes)`
          }
          className="w-full py-2 px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <SkipForward className="w-3.5 h-3.5" />

          {skipDelayElapsed
            ? "Passer ce niveau (0 pt)"
            : `Passer disponible dans ${skipRemainingSeconds}s`}
        </button>
      </div>
    </section>
  );
}