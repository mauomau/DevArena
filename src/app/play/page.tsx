"use client";

import IntroScreen from "@/components/play/IntroScreen";
import ArenaWorkspace from "@/components/play/ArenaWorkspace";
import FinishedScreen from "@/components/play/FinishedScreen";

import { useGameSession } from "@/lib/hooks/useGameSession";

export default function PlayPage() {
  const game = useGameSession();

  // Accueil
  if (game.step === "intro") {
    return <IntroScreen onStart={game.startGame} />;
  }

  // Fin de partie
  if (game.step === "finished") {
    return (
      <FinishedScreen
        pseudo={game.player.pseudo}
        score={game.score}
        totalTimeSpent={game.totalTimeSpent}
        levelsValidated={game.levelsValidated}
        totalLevels={game.totalLevels}
        saveStatus={game.saveStatus}
        saveError={game.saveError}
        rank={game.finalRank}
        totalPlayers={game.finalTotalPlayers}
        onRetrySave={game.retrySave}
        onReset={game.resetGame}
      />
    );
  }

  // Partie en cours
  if (!game.currentLevel) {
    return null;
  }

  return (
    <ArenaWorkspace
      currentLevel={game.currentLevel}
      levelIndex={game.levelIndex}
      code={game.code}
      remainingSeconds={game.remainingSeconds}
      skipRemainingSeconds={game.skipRemainingSeconds}
      canSkip={game.canSkip}
      isTimeUp={game.isTimeUp}
      isSuccess={game.isSuccess}
      score={game.score}
      hintUsed={game.hintUsed}
      validation={game.validation}
      isSubmitting={game.isSubmitting}
      error={game.error}
      onCodeChange={game.updateCode}
      onUseHint={game.revealHint}
      onSubmit={() => game.submitAttempt(false)}
      onSkip={game.skipLevel}
    />
  );
}