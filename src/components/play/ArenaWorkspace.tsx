"use client";

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

  onCodeChange: (code: string) => void;
  onUseHint: () => void;
  onSubmit: () => void;
  onSkip: () => void;
}

export default function ArenaWorkspace({
  currentLevel,
  levelIndex,
  code,
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
  onCodeChange,
  onUseHint,
  onSubmit,
  onSkip,
}: ArenaWorkspaceProps) {
  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      <ArenaHeader
        currentLevelId={currentLevel.id}
        levelIndex={levelIndex}
        remainingSeconds={remainingSeconds}
        score={score}
        hintUsed={hintUsed}
      />

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        <ChallengePanel
          level={{
            theme: currentLevel.theme,
            basePoints: currentLevel.basePoints,
            title: currentLevel.title,
            statement: currentLevel.statement,
            hint: currentLevel.hint,
          }}
          hintUsed={hintUsed}
          isTimeUp={isTimeUp}
          isSubmitting={isSubmitting}
          isSuccess={isSuccess}
          canSkip={canSkip}
          skipRemainingSeconds={skipRemainingSeconds}
          error={error}
          validation={validation}
          onUseHint={onUseHint}
          onSubmit={onSubmit}
          onSkip={onSkip}
        />

        <section className="lg:col-span-4 border-r border-slate-200 overflow-hidden">
          <CodeEditor
            value={code}
            onChange={onCodeChange}
            levelId={currentLevel.id}
          />
        </section>

        <section className="lg:col-span-4 overflow-hidden">
          <LivePreview code={code} levelId={currentLevel.id} />
        </section>
      </main>
    </div>
  );
}