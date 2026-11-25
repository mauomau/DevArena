"use client";

import {
  CheckCircle2,
  Loader2,
  RotateCcw,
  Trophy,
} from "lucide-react";

import JoinQrCode from "@/components/JoinQrCode";
import { MAX_TOTAL_SCORE } from "@/lib/scoring";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface FinishedScreenProps {
  pseudo: string;
  score: number;
  totalTimeSpent: number;
  levelsValidated: number;
  totalLevels: number;
  saveStatus: SaveStatus;
  saveError: string | null;
  rank: number | null;
  totalPlayers: number | null;
  onRetrySave: () => void;
  onReset: () => void;
}

export default function FinishedScreen({
  pseudo,
  score,
  totalTimeSpent,
  levelsValidated,
  totalLevels,
  saveStatus,
  saveError,
  rank,
  totalPlayers,
  onRetrySave,
  onReset,
}: FinishedScreenProps) {
  const rankLabel = rank === null ? null : rank === 1 ? "1er" : `${rank}e`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-center">
        <div className="bg-[#9E1B24] p-6 text-white">
          <div className="w-16 h-16 rounded-full bg-white/15 mx-auto flex items-center justify-center mb-3 border-2 border-[#D4AF37]">
            <Trophy className="w-8 h-8 text-[#D4AF37]" />
          </div>

          <h2 className="text-2xl font-extrabold">
            {score > 0 ? `Bien joué, ${pseudo} !` : `Merci, ${pseudo} !`}
          </h2>

          <p className="text-red-100 text-xs mt-1 text-balance">
            Ton score part au classement projeté en direct sur le
            vidéoprojecteur.
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Score
              </span>

              <p className="text-2xl font-black text-[#9E1B24]">{score}</p>

              <p className="text-[10px] text-slate-400">
                / {MAX_TOTAL_SCORE} pts
              </p>
            </div>

            <div className="border-x border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Temps
              </span>

              <p className="text-2xl font-black text-slate-700">
                {totalTimeSpent}s
              </p>

              <p className="text-[10px] text-slate-400">au total</p>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Validés
              </span>

              <p className="text-2xl font-black text-slate-700">
                {levelsValidated}/{totalLevels}
              </p>

              <p className="text-[10px] text-slate-400">niveaux</p>
            </div>
          </div>

          {saveStatus === "saving" && (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Enregistrement au classement…
            </div>
          )}

          {saveStatus === "saved" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
              <p className="font-extrabold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Score enregistré !
              </p>

              {rankLabel !== null && totalPlayers !== null && (
                <p className="mt-1 text-center">
                  Tu es <strong>{rankLabel}</strong> sur{" "}
                  <strong>{totalPlayers}</strong> joueur
                  {totalPlayers > 1 ? "s" : ""} au classement.
                </p>
              )}
            </div>
          )}

          {saveStatus === "error" && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900 space-y-2">
              <p className="font-extrabold">Score non enregistré</p>

              {saveError && <p className="text-[11px]">{saveError}</p>}

              <button
                type="button"
                onClick={onRetrySave}
                className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 font-bold text-red-800 transition hover:bg-red-100 cursor-pointer"
              >
                Réessayer
              </button>
            </div>
          )}

          <div className="bg-[#FCF8E8] border-2 border-[#D4AF37] rounded-2xl p-5 space-y-3">
            <p className="text-sm font-bold text-slate-800">
              Rejoins le groupe WhatsApp du{" "}
              <span className="text-[#9E1B24]">Club Dev ESGIS</span>
            </p>

            <div className="bg-white p-3 rounded-xl inline-block shadow-sm">
              <JoinQrCode size={150} />
            </div>

            <p className="text-xs text-slate-600">
              Scanne ce code avec ton téléphone pour accéder aux ateliers,
              projets et hackathons !
            </p>
          </div>

          <button
            onClick={onReset}
            className="w-full py-3 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Joueur suivant
          </button>
        </div>
      </div>
    </div>
  );
}
