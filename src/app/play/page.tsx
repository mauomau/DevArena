'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import CodeEditor from '@/components/CodeEditor';
import LivePreview from '@/components/LivePreview';
import { LEVELS } from '@/lib/levels';


interface CheckResult {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

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
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);

  // Calcul du temps écoulé sur le niveau actuel (Skip autorisé après 30s)
  const elapsedSeconds = currentLevel.durationSeconds - remainingSeconds;
  const canSkip = elapsedSeconds >= 30;

  // Chronomètre dégressif
  useEffect(() => {
    if (step !== 'playing' || isValidating || isSuccess === true) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      setTotalTimeSpent((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [step, isValidating, isSuccess, levelIndex]);

  // Initialiser un niveau donné
  const loadLevel = (index: number) => {
    const lvl = LEVELS[index];
    setLevelIndex(index);
    setCode(lvl.starterCode);
    setRemainingSeconds(lvl.durationSeconds);
    setHintUsed(false);
    setFeedback(null);
    setChecks([]);
    setIsSuccess(null);
  };

  // Démarrer la partie
  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (pseudo.trim().length < 2) return;
    setScore(0);
    setTotalTimeSpent(0);
    loadLevel(0);
    setStep('playing');
  };

  // Débloquer l'indice (-30 pts)
  const handleRevealHint = () => {
    if (!hintUsed) {
      setHintUsed(true);
    }
  };

  // Appel à l'API du Pôle 2 : POST /api/validate
  const submitAttempt = async (skipped = false) => {
    setIsValidating(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          levelId: currentLevel.id,
          code,
          remainingSeconds,
          hintUsed,
          skipped,
          pseudo,
          filiere,
          totalTimeSeconds: totalTimeSpent,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setIsSuccess(false);
        setFeedback(data.error || 'Erreur lors de la validation.');
        setIsValidating(false);
        return;
      }

      setChecks(data.checks || []);
      setFeedback(data.feedback);

      if (data.valid || data.skipped) {
        setIsSuccess(true);
        const awarded = data.pointsAwarded ?? 0;
        setScore((prev) => prev + awarded);

        // Passage automatique au niveau suivant après 1.8 seconde
        setTimeout(() => {
          if (levelIndex + 1 < LEVELS.length) {
            loadLevel(levelIndex + 1);
          } else {
            setStep('finished');
          }
          setIsValidating(false);
        }, 1800);
      } else {
        setIsSuccess(false);
        setIsValidating(false);
      }
    } catch {
      setIsSuccess(false);
      setFeedback('Impossible de joindre le serveur de validation.');
      setIsValidating(false);
    }
  };

  // Réinitialiser pour le joueur suivant sur le stand
  const handleResetGame = () => {
    setPseudo('');
    setScore(0);
    setTotalTimeSpent(0);
    setStep('intro');
  };

  // =========================================================================
  // ÉCRAN 1 : ACCUEIL & INSCRIPTION (Charte ESGIS : Blanc, Rouge #9E1B24, Or #D4AF37)
  // =========================================================================
  if (step === 'intro') {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
        {/* Bandeau supérieur institutionnel */}
        <header className="bg-white border-b-4 border-[#9E1B24] px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
           <div className="flex items-center gap-3.5">
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

        {/* Carte centrale d'inscription */}
        <main className="flex-1 flex items-center justify-center p-4">
          <form
            onSubmit={handleStart}
            className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden"
          >
            {/* En-tête de carte */}
            <div className="bg-[#9E1B24] p-6 text-white text-center relative">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-[#FCF8E8] text-xs font-semibold mb-3">
                <GraduationCap className="w-4 h-4 text-[#D4AF37]" />
                Défi Chrono • 5 Niveaux
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">DevArena</h1>
              <p className="text-red-100 text-sm mt-1">
                Code vite, marque un maximum de points et entre dans le Top 3 !
              </p>
            </div>

            {/* Champs du formulaire */}
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
                  <option value="IRT">IRT (Informatique, Réseaux & Télécoms)</option>
                  <option value="Génie Logiciel">Génie Logiciel</option>
                  <option value="Gestion / Finance">Gestion / Finance / Marketing</option>
                  <option value="Autre">Autre filière / Invité</option>
                </select>
              </div>

              {/* Rappel barème */}
              <div className="bg-[#FCF8E8] border border-[#D4AF37]/40 rounded-xl p-3.5 text-xs text-slate-700 space-y-1">
                <p className="font-bold text-[#9E1B24]">Règles du jeu :</p>
                <p>• Bonus rapidité : <strong>+2 pts</strong> par seconde restante.</p>
                <p>• Indice disponible en cas de blocage (<strong>-30 pts</strong>).</p>
              </div>

              {/* Bouton CTA Or métallisé */}
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
            <h2 className="text-2xl font-extrabold">Félicitations, {pseudo} !</h2>
            <p className="text-red-100 text-xs mt-1">
              Ton score est affiché en direct sur le vidéoprojecteur.
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Carte Score */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-around">
              <div>
                <span className="text-xs uppercase font-bold text-slate-400">Score Final</span>
                <p className="text-3xl font-black text-[#9E1B24]">{score} pts</p>
              </div>
              <div className="h-10 w-px bg-slate-200"></div>
              <div>
                <span className="text-xs uppercase font-bold text-slate-400">Temps Total</span>
                <p className="text-xl font-bold text-slate-700">{totalTimeSpent}s</p>
              </div>
            </div>

            {/* QR Code WhatsApp */}
            <div className="bg-[#FCF8E8] border-2 border-[#D4AF37] rounded-2xl p-5 space-y-3">
              <p className="text-sm font-bold text-slate-800">
                Rejoins le groupe WhatsApp du <span className="text-[#9E1B24]">Club Dev ESGIS</span>
              </p>
              <div className="bg-white p-3 rounded-xl inline-block shadow-sm">
                <QRCodeSVG
                  value="lien_whatsapp_club"
                  size={150}
                  fgColor="#9E1B24"
                />
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
      {/* Barre supérieure (HUD) */}
      <header className="h-16 bg-white border-b-2 border-[#9E1B24] px-4 lg:px-6 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="font-black text-lg text-[#9E1B24] tracking-tight">ESGIS • DevArena</span>
          <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FDF2F3] text-[#9E1B24] border border-[#9E1B24]/20">
            Niveau {currentLevel.id} / {LEVELS.length}
          </span>
        </div>

        {/* Barre de progression des niveaux */}
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

        {/* Chrono & Score */}
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

          <div className="px-3.5 py-1.5 rounded-lg bg-[#FCF8E8] border border-[#D4AF37] font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-[#B59224]" />
            {score} pts
          </div>
        </div>
      </header>

      {/* Espace principal scindé en 3 colonnes */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* COLONNE 1 : Consigne, Indice, Checks & Boutons d'action (4 cols) */}
        <section className="lg:col-span-4 bg-white border-r border-slate-200 p-5 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            {/* Badge thème + points */}
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-[#FDF2F3] text-[#9E1B24]">
                {currentLevel.theme}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                Base : {currentLevel.basePoints} pts
              </span>
            </div>

            {/* Titre & Énoncé */}
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">{currentLevel.title}</h2>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                {currentLevel.statement}
              </p>
            </div>

            {/* Section Indice (-30 pts) */}
            <div>
              {!hintUsed ? (
                <button
                  type="button"
                  onClick={handleRevealHint}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#FCF8E8] hover:bg-[#D4AF37]/20 text-[#947618] border border-[#D4AF37]/50 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Lightbulb className="w-4 h-4 text-[#B59224]" />
                  Afficher un indice (-30 pts)
                </button>
              ) : (
                <div className="p-3.5 rounded-xl bg-[#FCF8E8] border border-[#D4AF37] text-xs text-slate-800 space-y-1">
                  <p className="font-bold text-[#947618] flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4" /> Indice débloqué (-30 pts) :
                  </p>
                  <p className="leading-relaxed">{currentLevel.hint}</p>
                </div>
              )}
            </div>

            {/* Résultat de la validation (Feedback & Checks détaillés) */}
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

                {checks.length > 0 && (
                  <ul className="space-y-1 pt-1 border-t border-black/10">
                    {checks.map((chk) => (
                      <li key={chk.id} className="flex items-start gap-1.5">
                        <span>{chk.passed ? '✅' : '❌'}</span>
                        <span>{chk.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Boutons Valider & Passer */}
          <div className="pt-5 space-y-2.5 border-t border-slate-100 mt-4">
            <button
              type="button"
              disabled={isValidating || isSuccess === true}
              onClick={() => submitAttempt(false)}
              className="w-full py-3.5 px-4 rounded-xl bg-[#9E1B24] hover:bg-[#7A1219] disabled:opacity-50 text-white font-extrabold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              {isValidating ? 'Vérification en cours...' : 'Valider mon code'}
            </button>

            <button
              type="button"
              disabled={!canSkip || isValidating || isSuccess === true}
              onClick={() => submitAttempt(true)}
              title={!canSkip ? `Disponible après 30 secondes (${30 - elapsedSeconds}s restantes)` : 'Passer ce niveau (0 pt)'}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-40 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <SkipForward className="w-3.5 h-3.5" />
              {canSkip
                ? 'Passer ce niveau (0 pt)'
                : `Passer disponible dans ${30 - elapsedSeconds}s`}
            </button>
          </div>
        </section>

        {/* COLONNE 2 : Éditeur CodeMirror (4 cols) */}
        <section className="lg:col-span-4 border-r border-slate-200 overflow-hidden">
          <CodeEditor value={code} onChange={setCode} levelId={currentLevel.id} />
        </section>

        {/* COLONNE 3 : Aperçu en direct (4 cols) */}
        <section className="lg:col-span-4 overflow-hidden">
          <LivePreview code={code} levelId={currentLevel.id} />
        </section>
      </main>
    </div>
  );
}