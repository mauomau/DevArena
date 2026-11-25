"use client";

import { Clock, Trophy } from "lucide-react";
import { LEVELS } from "@/lib/levels";
import { GAME_CONFIG } from "@/lib/game/config";
import { MAX_TOTAL_SCORE } from "@/lib/scoring";

interface ArenaHeaderProps {
  currentLevelId: number;
  levelIndex: number;
  remainingSeconds: number;
  score: number;
  hintUsed: boolean;
}

export default function ArenaHeader({
  currentLevelId,
  levelIndex,
  remainingSeconds,
  score,
  hintUsed,
}: ArenaHeaderProps) {
  return (
    <header className="h-16 bg-white border-b-2 border-[#9E1B24] px-4 lg:px-6 flex items-center justify-between shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="font-black text-lg text-[#9E1B24] tracking-tight">
          ESGIS • DevArena
        </span>

        <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FDF2F3] text-[#9E1B24] border border-[#9E1B24]/20">
          Niveau {currentLevelId} / {LEVELS.length}
        </span>
      </div>

      <div className="hidden md:flex items-center gap-2">
        {LEVELS.map((lvl, idx) => (
          <div
            key={lvl.id}
            className={`h-2.5 w-10 rounded-full transition-all ${
              idx < levelIndex
                ? "bg-emerald-500"
                : idx === levelIndex
                  ? "bg-[#9E1B24]"
                  : "bg-slate-200"
            }`}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-sm border ${
            remainingSeconds <= 10
              ? "bg-red-50 text-red-600 border-red-300 animate-pulse"
              : "bg-slate-100 text-slate-800 border-slate-200"
          }`}
        >
          <Clock className="w-4 h-4 text-[#9E1B24]" />
          {remainingSeconds}s
        </div>

        <div
          title={`Score actuel (max théorique : ${MAX_TOTAL_SCORE} pts)`}
          className="px-3.5 py-1.5 rounded-lg bg-[#FCF8E8] border border-[#D4AF37] font-extrabold text-sm text-slate-900 flex items-center gap-1.5"
        >
          <Trophy className="w-4 h-4 text-[#B59224]" />

          <span>{score} pts</span>

          {hintUsed && (
            <span className="text-[11px] font-bold text-[#9E1B24]">
              (-{GAME_CONFIG.hintPenalty} sur ce niveau)
            </span>
          )}
        </div>
      </div>
    </header>
  );
}