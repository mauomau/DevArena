'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Lightbulb,
  Clock,
  Trophy,
  CheckCircle2,
  XCircle,
  SkipForward,
  ArrowRight,
  RotateCcw,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import CodeEditor from '@/components/CodeEditor';
import JoinQrCode from '@/components/JoinQrCode';
import LivePreview from '@/components/LivePreview';
import { GAME_CONFIG } from '@/lib/game/config';
import type { SubmitScoreResponse } from '@/lib/game/contracts';
import { LEVELS } from '@/lib/levels';
import { MAX_TOTAL_SCORE } from '@/lib/scoring';

interface CheckResult {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

interface Breakdown {
  basePoints: number;
  speedBonus: number;
  hintPenalty: number;
  totalPoints: number;
}

// Réponse 200 de POST /api/validate (voir README de l'API)
interface ValidateResponse {
  levelId: number;
  valid: boolean;
  skipped: boolean;
  pointsAwarded: number;
  breakdown?: Breakdown;
  feedback: string;
  checks: CheckResult[];
  nextLevel: number | null;
}

// Corps possible d'une erreur (400 / 500)
type ValidateErrorBody = { error?: string; message?: string };

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function PlayPage() {
  // État global de la session
  const [step, setStep] = useState<'intro' | 'playing' | 'finished'>('intro');
  const [pseudo, setPseudo] = useState('');
  const [filiere, setFiliere] = useState('IRT');

  // Progression des niveaux
  const [levelIndex, setLevelIndex] = useState(0);
  const currentLevel = LEVELS[levelIndex];

  // État de l'éditeur et du chrono
  const [code, setCode] = useState(LEVELS[0].starterCode);
  const [remainingSeconds, setRemainingSeconds] = useState(LEVELS[0].durationSeconds);
  const [totalTimeSpent, setTotalTimeSpent] = useState(0);

  // Score, indices et retour serveur
  const [score, setScore] = useState(0);
  const [hintUsed, setHintUsed] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  // Points réellement crédités sur le dernier niveau validé (pour affichage clair)
  const [lastAwarded, setLastAwarded] = useState<number | null>(null);

  // Fin de partie : niveau atteint et enregistrement au classement
  const [highestLevel, setHighestLevel] = useState(0);
  const [levelsValidated, setLevelsValidated] = useState(0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finalRank, setFinalRank] = useState<number | null>(null);
  const [finalTotalPlayers, setFinalTotalPlayers] = useState<number | null>(null);

  // Verrou synchrone : empêche un double-clic de créditer deux fois le même niveau
  const submitLockRef = useRef(false);
  // Empêche d'enregistrer deux fois le score final
  const scoreSavedRef = useRef(false);
  // Timer du passage automatique au niveau suivant (nettoyé au démontage / reset)
  const nextLevelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dernière valeur du temps total, lisible dans les callbacks asynchrones
  const totalTimeSpentRef = useRef(0);

  // Calcul du temps écoulé sur le niveau actuel (Skip autorisé après le délai configuré)
  const elapsedSeconds = currentLevel.durationSeconds - remainingSeconds;
  const canSkip = elapsedSeconds >= GAME_CONFIG.skipAvailableAfterSeconds;
  const isTimeUp = remainingSeconds <= 0;
  const rankLabel =
    finalRank === null ? null : finalRank === 1 ? '1er' : `${finalRank}e`;

  // Chronomètre dégressif du niveau : en pause pendant la validation et après un succès
  useEffect(() => {
    if (step !== 'playing' || isValidating || isSuccess === true) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [step, isValidating, isSuccess, levelIndex]);

  // Temps total de la partie : continue de courir pendant les états de validation
  // (requête en cours, délai de 1,8 s avant le niveau suivant). Il peut donc être
  // légèrement supérieur à la somme des temps de niveau. Dépend uniquement de `step`
  // pour que l'intervalle ne soit pas relancé à chaque validation.
  useEffect(() => {
    if (step !== 'playing') return;

    const totalTimer = setInterval(() => {
      setTotalTimeSpent((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(totalTimer);
  }, [step]);

  // Miroir du temps total pour les callbacks qui capturent une ancienne closure.
  useEffect(() => {
    totalTimeSpentRef.current = totalTimeSpent;
  }, [totalTimeSpent]);

  // Nettoyage du timeout au démontage
  useEffect(() => {
    return () => {
      if (nextLevelTimeoutRef.current) clearTimeout(nextLevelTimeoutRef.current);
    };
  }, []);

  // Initialiser un niveau donné
  const loadLevel = (index: number) => {
    const lvl = LEVELS[index];
    setLevelIndex(index);
    setCode(lvl.starterCode);
    setRemainingSeconds(lvl.durationSeconds);
    setHintUsed(false);
    setFeedback(null);
    setChecks([]);
    setBreakdown(null);
    setIsSuccess(null);
    setLastAwarded(null);
  };

  // Démarrer la partie
  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (pseudo.trim().length < 2) return;
    submitLockRef.current = false;
    scoreSavedRef.current = false;
    totalTimeSpentRef.current = 0;
    setScore(0);
    setTotalTimeSpent(0);
    setLastAwarded(null);
    setHighestLevel(0);
    setLevelsValidated(0);
    setSaveStatus('idle');
    setSaveError(null);
    setFinalRank(null);
    setFinalTotalPlayers(null);
    loadLevel(0);
    setStep('playing');
  };

  // Débloquer l'indice
  const handleRevealHint = () => {
    if (!hintUsed && !isTimeUp) {
      setHintUsed(true);
    }
  };

  /**
   * Enregistre la performance finale dans `scores` (Supabase) via
   * `POST /api/scores`. Le score affiché provient déjà du serveur de
   * validation : le client ne fait que transmettre le total.
   */
  const persistScore = async (finalScore: number, lastLevel: number) => {
    if (scoreSavedRef.current) return;
    scoreSavedRef.current = true;
    setSaveStatus('saving');
    setSaveError(null);

    try {
      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pseudo: pseudo.trim(),
          filiere,
          score: finalScore,
          currentLevel: Math.max(1, lastLevel),
          totalTimeSeconds: totalTimeSpentRef.current,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | (Partial<SubmitScoreResponse> & ValidateErrorBody)
        | null;

      if (!response.ok || !data) {
        throw new Error(
          data?.error || data?.message || 'Enregistrement du score impossible.',
        );
      }

      setFinalRank(typeof data.rank === 'number' ? data.rank : null);
      setFinalTotalPlayers(
        typeof data.totalPlayers === 'number' ? data.totalPlayers : null,
      );
      setSaveStatus('saved');
    } catch (err) {
      console.error('[DevArena] Enregistrement du score impossible', err);
      // Autorise le bouton « Réessayer ».
      scoreSavedRef.current = false;
      setSaveError(
        err instanceof Error ? err.message : 'Enregistrement du score impossible.',
      );
      setSaveStatus('error');
    }
  };

  // Appel à l'API du Pôle 2 : POST /api/validate
  const submitAttempt = async (skipped = false) => {
    if (submitLockRef.current || (!skipped && isTimeUp)) return;
    submitLockRef.current = true;

    setIsValidating(true);
    // On efface TOUT le retour précédent pour ne pas mélanger anciens et nouveaux résultats
    setFeedback(null);
    setChecks([]);
    setBreakdown(null);
    setLastAwarded(null);

    // Capture des valeurs AU MOMENT du clic (évite les closures périmées)
    const levelIdAtClick = currentLevel.id;
    const codeAtClick = code;
    const remainingAtClick = remainingSeconds;
    const hintUsedAtClick = hintUsed;
    const levelIndexAtClick = levelIndex;

    const releaseLock = () => {
      submitLockRef.current = false;
      setIsValidating(false);
    };

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          levelId: levelIdAtClick,
          code: codeAtClick,
          remainingSeconds: remainingAtClick,
          hintUsed: hintUsedAtClick,
          skipped,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | (Partial<ValidateResponse> & ValidateErrorBody)
        | null;

      if (!response.ok || !data) {
        setIsSuccess(false);
        setFeedback(data?.error || data?.message || 'Erreur lors de la validation.');
        releaseLock();
        return;
      }

      setChecks(data.checks ?? []);
      setFeedback(data.feedback ?? null);
      setBreakdown(data.breakdown ?? null);

      if (data.valid || data.skipped) {
        // Le backend est la seule source de vérité pour les points :
        // aucun recalcul ni estimation côté client.
        let awarded = 0;
        if (!data.skipped) {
          const serverPoints = data.pointsAwarded ?? data.breakdown?.totalPoints;
          if (typeof serverPoints !== 'number' || !Number.isFinite(serverPoints)) {
            console.error('[DevArena] Réponse invalide : pointsAwarded / breakdown.totalPoints absent', data);
            setIsSuccess(false);
            setBreakdown(null);
            setFeedback('Réponse invalide du serveur (points manquants). Réessaie.');
            releaseLock();
            return;
          }
          awarded = Math.max(0, Math.floor(serverPoints));
        }

        setIsSuccess(true);
        setLastAwarded(awarded);

        const nextScore = Math.min(
          MAX_TOTAL_SCORE,
          Math.max(0, score + awarded),
        );
        setScore(nextScore);
        setHighestLevel((previous) => Math.max(previous, levelIdAtClick));
        if (data.valid) {
          setLevelsValidated((previous) => previous + 1);
        }

        nextLevelTimeoutRef.current = setTimeout(() => {
          if (levelIndexAtClick + 1 < LEVELS.length) {
            loadLevel(levelIndexAtClick + 1);
          } else {
            setStep('finished');
            void persistScore(nextScore, levelIdAtClick);
          }
          releaseLock();
        }, 1800);
      } else {
        setIsSuccess(false);
        setLastAwarded(0);
        releaseLock();
      }
    } catch (err) {
      console.error('[DevArena] Erreur réseau /api/validate', err);
      setIsSuccess(false);
      setFeedback('Impossible de joindre le serveur de validation.');
      releaseLock();
    }
  };

  // Réinitialiser pour le joueur suivant sur le stand
  const handleResetGame = () => {
    if (nextLevelTimeoutRef.current) clearTimeout(nextLevelTimeoutRef.current);
    submitLockRef.current = false;
    scoreSavedRef.current = false;
    totalTimeSpentRef.current = 0;
    setIsValidating(false);
    setPseudo('');
    setScore(0);
    setTotalTimeSpent(0);
    setLastAwarded(null);
    setHighestLevel(0);
    setLevelsValidated(0);
    setSaveStatus('idle');
    setSaveError(null);
    setFinalRank(null);
    setFinalTotalPlayers(null);
    setStep('intro');
  };

  // =========================================================================
  // ÉCRAN 1 : ACCUEIL & INSCRIPTION (Charte ESGIS : Blanc, Rouge #9E1B24, Or #D4AF37)
  // =========================================================================
  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
        <header className="bg-white border-b-4 border-[#9E1B24] px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo-red.png"
                alt="Logo ESGIS"
                className="h-10 w-auto object-contain shrink-0"
              />
              <div className="h-7 w-px bg-slate-200 hidden sm:block" aria-hidden="true" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-md bg-[#FCF8E8] text-[#947618] border border-[#D4AF37]/60">
                  Club Dev
                </span>
              </div>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500 hidden sm:inline">
            Journée d’intégration des Clubs
          </span>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <form
            onSubmit={handleStart}
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden"
          >
            <div className="bg-[#9E1B24] p-6 text-white text-center relative">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-[#FCF8E8] text-xs font-semibold mb-3">
                <GraduationCap className="w-4 h-4 text-[#D4AF37]" />
                Défi Chrono • {LEVELS.length} Niveaux
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">DevArena</h1>
              <p className="text-red-100 text-sm mt-1 text-balance">
                Code vite, marque un maximum de points et entre dans le Top 3 !
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Ton Pseudo <span className="text-[#9E1B24]">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={20}
                  placeholder="Ex: Achille_Dev"
                  value={pseudo}
                  onChange={(e) => setPseudo(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#9E1B24] focus:ring-2 focus:ring-[#9E1B24]/20 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  Ta Filière
                </label>
                <select
                  value={filiere}
                  onChange={(e) => setFiliere(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#9E1B24]"
                >
                  <option value="IRT">IRT : Informatique, Réseaux & Télécoms</option>
                  <option value="Génie Logiciel">Génie Logiciel</option>
                  <option value="Gestion / Finance">Gestion / Finance / Marketing</option>
                  <option value="Autre">Autre filière / Invité</option>
                </select>
              </div>

              <div className="bg-[#FCF8E8] border border-[#D4AF37]/40 rounded-xl p-3.5 text-xs text-slate-700 space-y-1">
                <p className="font-bold text-[#9E1B24]">Règles du jeu :</p>
                <p>
                  • Bonus rapidité : <strong>+{GAME_CONFIG.speedBonusPerSecond} pts</strong> par seconde restante.
                </p>
                <p>
                  • Indice disponible en cas de blocage (<strong>-{GAME_CONFIG.hintPenalty} pts</strong>).
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-xl font-extrabold text-slate-950 bg-gradient-to-r from-[#D4AF37] via-[#E5C158] to-[#D4AF37] hover:brightness-105 shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                Démarrer le challenge <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </form>
        </main>

        <footer className="text-center py-4 text-xs text-slate-400">
          Club Dev ESGIS Bénin • Édition 2026
        </footer>
      </div>
    );
  }

  // =========================================================================
  // ÉCRAN 3 : FIN DE PARTIE + SCORE + QR CODE WHATSAPP
  // =========================================================================
  if (step === 'finished') {
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
            <p className="text-red-100 text-xs mt-1">
              Ton score part au classement projeté en direct sur le vidéoprojecteur.
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Score</span>
                <p className="text-2xl font-black text-[#9E1B24]">{score}</p>
                <p className="text-[10px] text-slate-400">/ {MAX_TOTAL_SCORE} pts</p>
              </div>
              <div className="border-x border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Temps</span>
                <p className="text-2xl font-black text-slate-700">{totalTimeSpent}s</p>
                <p className="text-[10px] text-slate-400">au total</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Validés</span>
                <p className="text-2xl font-black text-slate-700">
                  {levelsValidated}/{LEVELS.length}
                </p>
                <p className="text-[10px] text-slate-400">niveaux</p>
              </div>
            </div>

            {saveStatus === 'saving' && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Enregistrement au classement…
              </div>
            )}

            {saveStatus === 'saved' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
                <p className="font-extrabold flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Score enregistré !
                </p>
                {rankLabel !== null && finalTotalPlayers !== null && (
                  <p className="mt-1 text-center">
                    Tu es <strong>{rankLabel}</strong> sur{' '}
                    <strong>{finalTotalPlayers}</strong> joueur
                    {finalTotalPlayers > 1 ? 's' : ''} au classement.
                  </p>
                )}
              </div>
            )}

            {saveStatus === 'error' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900 space-y-2">
                <p className="font-extrabold">Score non enregistré</p>
                {saveError && <p className="text-[11px]">{saveError}</p>}
                <button
                  type="button"
                  onClick={() => void persistScore(score, Math.max(1, highestLevel))}
                  className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 font-bold text-red-800 transition hover:bg-red-100"
                >
                  Réessayer
                </button>
              </div>
            )}

            <div className="bg-[#FCF8E8] border-2 border-[#D4AF37] rounded-2xl p-5 space-y-3">
              <p className="text-sm font-bold text-slate-800">
                Rejoins le groupe WhatsApp du <span className="text-[#9E1B24]">Club Dev ESGIS</span>
              </p>
              <div className="bg-white p-3 rounded-xl inline-block shadow-sm">
                <JoinQrCode size={150} />
              </div>
              <p className="text-xs text-slate-600">
                Scanne ce code avec ton téléphone pour accéder aux ateliers, projets et hackathons !
              </p>
            </div>

            <button
              onClick={handleResetGame}
              className="w-full py-3 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Joueur suivant
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ÉCRAN 2 : ARÈNE DE CODE SCINDÉE (Consigne | Éditeur | Aperçu Live)
  // =========================================================================
  return (
    <div className="h-screen flex flex-col bg-slate-50 text-slate-900 overflow-hidden">
      <header className="h-16 bg-white border-b-2 border-[#9E1B24] px-4 lg:px-6 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="font-black text-lg text-[#9E1B24] tracking-tight">ESGIS • DevArena</span>
          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FDF2F3] text-[#9E1B24] border border-[#9E1B24]/20">
            Niveau {currentLevel.id} / {LEVELS.length}
          </span>
        </div>

        <div className="hidden md:flex items-center gap-2">
          {LEVELS.map((lvl, idx) => (
            <div
              key={lvl.id}
              className={`h-2.5 w-10 rounded-full transition-all ${
                idx < levelIndex
                  ? 'bg-emerald-500'
                  : idx === levelIndex
                  ? 'bg-[#9E1B24]'
                  : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono font-bold text-sm border ${
              remainingSeconds <= 10
                ? 'bg-red-50 text-red-600 border-red-300 animate-pulse'
                : 'bg-slate-100 text-slate-800 border-slate-200'
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

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        <section className="lg:col-span-4 bg-white border-r border-slate-200 p-5 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-[#FDF2F3] text-[#9E1B24]">
                {currentLevel.theme}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Base : {currentLevel.basePoints} pts
              </span>
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{currentLevel.title}</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                {currentLevel.statement}
              </p>
            </div>

            <div>
              {!hintUsed ? (
                <button
                  type="button"
                  disabled={isTimeUp || isValidating || isSuccess === true}
                  onClick={handleRevealHint}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#FCF8E8] hover:bg-[#D4AF37]/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#FCF8E8] text-[#947618] border border-[#D4AF37]/50 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Lightbulb className="w-4 h-4 text-[#B59224]" />
                  {isTimeUp
                    ? 'Temps écoulé'
                    : `Afficher un indice (-${GAME_CONFIG.hintPenalty} pts)`}
                </button>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#FCF8E8] border border-[#D4AF37] text-xs text-slate-800 space-y-1">
                  <p className="font-bold text-[#947618] flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4" /> Indice débloqué (-{GAME_CONFIG.hintPenalty} pts) :
                  </p>
                  <p className="leading-relaxed">{currentLevel.hint}</p>
                </div>
              )}
            </div>

            {feedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                  isSuccess
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-red-50 border-red-300 text-red-900'
                }`}
              >
                <p className="font-bold flex items-center gap-1.5">
                  {isSuccess ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  {feedback}
                </p>

                {isSuccess && (
                  <div className="font-semibold space-y-0.5">
                    {lastAwarded !== null && (
                      <p className="text-base">
                        +{lastAwarded} pts crédités
                      </p>
                    )}
                    {breakdown && (
                      <p className="font-normal text-emerald-800">
                        (base {breakdown.basePoints} + rapidité {breakdown.speedBonus}
                        {breakdown.hintPenalty > 0 ? ` − indice ${breakdown.hintPenalty}` : ''})
                      </p>
                    )}
                  </div>
                )}

                {checks.length > 0 && (
                  <ul className="space-y-1 pt-1 border-t border-black/10">
                    {checks.map((chk) => (
                      <li key={chk.id} className="flex items-start gap-1.5">
                        <span>{chk.passed ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    ) : (
                                      <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                                    )}
                        </span>
                        <span>
                          {chk.label}
                          {!chk.passed && chk.detail ? (
                            <span className="block text-[11px] opacity-80">{chk.detail}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="pt-5 space-y-2.5 border-t border-slate-100 mt-4">
            <button
              type="button"
              disabled={isTimeUp || isValidating || isSuccess === true}
              onClick={() => submitAttempt(false)}
              className="w-full py-3.5 px-4 rounded-xl bg-[#9E1B24] hover:bg-[#7A1219] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#9E1B24] text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              {isTimeUp
                ? 'Temps écoulé'
                : isValidating
                ? 'Vérification en cours...'
                : 'Valider mon code'}
            </button>

            <button
              type="button"
              disabled={!canSkip || isValidating || isSuccess === true}
              onClick={() => submitAttempt(true)}
              title={
                !canSkip
                  ? `Disponible après ${GAME_CONFIG.skipAvailableAfterSeconds} secondes (${GAME_CONFIG.skipAvailableAfterSeconds - elapsedSeconds}s restantes)`
                  : 'Passer ce niveau (0 pt)'
              }
              className="w-full py-2 px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
              {canSkip
                ? 'Passer ce niveau (0 pt)'
                : `Passer disponible dans ${GAME_CONFIG.skipAvailableAfterSeconds - elapsedSeconds}s`}
            </button>
          </div>
        </section>

        <section className="lg:col-span-4 border-r border-slate-200 overflow-hidden">
          <CodeEditor value={code} onChange={setCode} levelId={currentLevel.id} />
        </section>

        <section className="lg:col-span-4 overflow-hidden">
          <LivePreview code={code} levelId={currentLevel.id} />
        </section>
      </main>
    </div>
  );
}