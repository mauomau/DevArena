"use client";

import { Play } from "lucide-react";

import ArenaHeader from "./ArenaHeader";
import ChallengePanel from "./ChallengePanel";

import CodeEditor from "@/components/CodeEditor";
import LivePreview from "@/components/LivePreview";

import type { LEVELS } from "@/lib/levels";
import type { ValidateResponse } from "@/lib/game/contracts";

type Level = (typeof LEVELS)[number];

interface ArenaWorkspaceProps {
  currentLevel: Level;
  levelIndex: number;
  code: string;
  readingSeconds: number;
  isReading: boolean;
  remainingSeconds: number;
  skipRemainingSeconds: number;
  score: number;
  hintUsed: boolean;
  isTimeUp: boolean;
  isSubmitting: boolean;
  isSuccess: boolean;
  canSkip: boolean;
  error: string | null;
  validation: ValidateResponse | null;

  onStartLevelNow: () => void;
  onCodeChange: (code: string) => void;
  onUseHint: () => void;
  onSubmit: () => void;
  onSkip: () => void;
}

export default function ArenaWorkspace({
  currentLevel,
  levelIndex,
  code,
  readingSeconds,
  isReading,
  remainingSeconds,
  skipRemainingSeconds,
  score,
  hintUsed,
  isTimeUp,
  isSubmitting,
  isSuccess,
  canSkip,
  error,
  validation,
  onStartLevelNow,
  onCodeChange,
  onUseHint,
  onSubmit,
  onSkip,
}: ArenaWorkspaceProps) {
  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-slate-50 text-slate-900 lg:overflow-hidden">
      <ArenaHeader
        currentLevelId={currentLevel.id}
        levelIndex={levelIndex}
        remainingSeconds={remainingSeconds}
        readingSeconds={readingSeconds}
        isReading={isReading}
        score={score}
        hintUsed={hintUsed}
      />

      <main className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 lg:overflow-hidden">
        <ChallengePanel
          level={{
            theme: currentLevel.theme,
            basePoints: currentLevel.basePoints,
            title: currentLevel.title,
            statement: currentLevel.statement,
            hint: currentLevel.hint,
          }}
          hintUsed={hintUsed}
          isReading={isReading}
          readingSeconds={readingSeconds}
          isTimeUp={isTimeUp}
          isSubmitting={isSubmitting}
          isSuccess={isSuccess}
          canSkip={canSkip}
          skipRemainingSeconds={skipRemainingSeconds}
          error={error}
          validation={validation}
          onStartLevelNow={onStartLevelNow}
          onUseHint={onUseHint}
          onSubmit={onSubmit}
          onSkip={onSkip}
        />

        <section className="relative lg:col-span-4 min-h-[340px] lg:min-h-0 border-t lg:border-t-0 lg:border-r border-slate-200 overflow-hidden">
          <CodeEditor
            value={code}
            onChange={onCodeChange}
            levelId={currentLevel.id}
          />

          {isReading && (
            <div className="absolute inset-0 z-10 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-center text-white gap-4">
              <p className="text-xs font-mono uppercase tracking-widest text-[#F5D77A]">
                Temps de lecture · {readingSeconds}s
              </p>
              <p className="text-sm font-semibold text-slate-200 max-w-xs leading-relaxed">
                Lis l’énoncé à gauche : le chrono de{" "}
                <strong className="text-white">
                  {currentLevel.durationSeconds}s
                </strong>{" "}
                n’a pas encore commencé.
              </p>
              <button
                type="button"
                onClick={onStartLevelNow}
                className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] hover:brightness-105 text-slate-950 font-extrabold text-sm px-5 py-3 shadow-lg transition cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Lancer le chrono maintenant
              </button>
            </div>
          )}
        </section>

        <section className="lg:col-span-4 min-h-[280px] lg:min-h-0 border-t lg:border-t-0 border-slate-200 overflow-hidden">
          <LivePreview code={code} levelId={currentLevel.id} />
        </section>
      </main>
    </div>
  );
}
