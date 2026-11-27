"use client";

import { useState } from "react";
import {
  ArrowRight,
  Download,
  GraduationCap,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { GAME_CONFIG } from "@/lib/game/config";
import { FILIERES, NIVEAUX_ETUDE } from "@/lib/game/player";
import { LEVELS } from "@/lib/levels";

interface IntroScreenProps {
  onStart: (
    pseudo: string,
    filiere: string,
    niveau: string,
    pin: string,
  ) => Promise<void> | void;
  isStarting?: boolean;
  startError?: string | null;
}

const FILIERE_LABELS: Record<(typeof FILIERES)[number], string> = {
  IRT: "IRT : Informatique, Réseaux & Télécoms",
  "Génie Logiciel": "Génie Logiciel",
  "Gestion / Finance": "Gestion / Finance / Marketing",
  Autre: "Autre filière / Invité",
};

export default function IntroScreen({
  onStart,
  isStarting = false,
  startError = null,
}: IntroScreenProps) {
  const [pseudo, setPseudo] = useState("");
  const [filiere, setFiliere] = useState<string>(FILIERES[0]);
  const [niveau, setNiveau] = useState<string>(NIVEAUX_ETUDE[0]);
  const [pin, setPin] = useState("");

  // Outils stand discrets (uniquement accessibles derrière le cookie stand_auth)
  const [showStandTools, setShowStandTools] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isStarting) return;
    if (pseudo.trim().length < 2) return;
    if (!/^\d{4}$/.test(pin.trim())) return;
    void onStart(pseudo.trim(), filiere, niveau, pin.trim());
  }

  async function handleResetScores() {
    if (resetConfirm.trim().toUpperCase() !== "RESET" || isResetting) return;
    setIsResetting(true);
    setAdminStatus(null);

    try {
      const response = await fetch("/api/admin/scores", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET_ALL_SCORES" }),
      });
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.error || "Réinitialisation impossible.");
      }

      setResetConfirm("");
      setAdminStatus("Classement et sessions de test réinitialisés.");
    } catch (error) {
      setAdminStatus(
        error instanceof Error ? error.message : "Erreur lors du reset.",
      );
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <header className="bg-white border-b-4 border-[#9E1B24] px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo-red.png"
              alt="Logo ESGIS"
              className="h-10 w-auto object-contain shrink-0"
            />

            <div
              className="h-7 w-px bg-slate-200 hidden sm:block"
              aria-hidden="true"
            />

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
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="bg-[#9E1B24] p-6 text-white text-center relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-[#FCF8E8] text-xs font-semibold mb-3">
              <GraduationCap className="w-4 h-4 text-[#D4AF37]" />
              Défi Chrono • {LEVELS.length} Niveaux
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight">
              DevArena
            </h1>

            <p className="text-red-100 text-sm mt-1">
              Code vite, marque un maximum de points et entre dans le Top 3 !
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label
                htmlFor="player-pseudo"
                className="block text-sm font-bold text-slate-700 mb-1.5"
              >
                Ton Pseudo <span className="text-[#9E1B24]">*</span>
              </label>

              <input
                id="player-pseudo"
                type="text"
                required
                minLength={2}
                maxLength={20}
                placeholder="Ex: Achille_Dev"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                disabled={isStarting}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#9E1B24] focus:ring-2 focus:ring-[#9E1B24]/20 transition disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label
                  htmlFor="player-filiere"
                  className="block text-sm font-bold text-slate-700 mb-1.5"
                >
                  Ta Filière
                </label>

                <select
                  id="player-filiere"
                  value={filiere}
                  onChange={(e) => setFiliere(e.target.value)}
                  disabled={isStarting}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#9E1B24] disabled:opacity-60"
                >
                  {FILIERES.map((option) => (
                    <option key={option} value={option}>
                      {FILIERE_LABELS[option]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="player-niveau"
                  className="block text-sm font-bold text-slate-700 mb-1.5"
                >
                  Niveau
                </label>

                <select
                  id="player-niveau"
                  value={niveau}
                  onChange={(e) => setNiveau(e.target.value)}
                  disabled={isStarting}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#9E1B24] disabled:opacity-60"
                >
                  {NIVEAUX_ETUDE.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="player-pin"
                className="flex items-center gap-1.5 text-sm font-bold text-slate-700 mb-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#9E1B24]" />
                Code PIN personnel (4 chiffres){" "}
                <span className="text-[#9E1B24]">*</span>
              </label>

              <input
                id="player-pin"
                type="password"
                inputMode="numeric"
                pattern="\d{4}"
                required
                minLength={4}
                maxLength={4}
                placeholder="Ex: 2026"
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                disabled={isStarting}
                autoComplete="off"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 tracking-[0.35em] font-mono focus:outline-none focus:border-[#9E1B24] focus:ring-2 focus:ring-[#9E1B24]/20 transition disabled:opacity-60"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Protège ton pseudo contre l’usurpation (garde le même code si tu
                rejoues).
              </p>
            </div>

            <div className="bg-[#FCF8E8] border border-[#D4AF37]/40 rounded-xl p-3.5 text-xs text-slate-700 space-y-1">
              <p className="font-bold text-[#9E1B24]">Règles du jeu :</p>

              <p>
                • Bonus rapidité :{" "}
                <strong>+{GAME_CONFIG.speedBonusPerSecond} pts</strong> par
                seconde restante.
              </p>

              <p>
                • Indice disponible en cas de blocage (
                <strong>-{GAME_CONFIG.hintPenalty} pts</strong>).
              </p>
            </div>

            <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#9E1B24] mt-0.5" />
              <span>
                Ton pseudo, ta filière, ton niveau et ton score seront affichés
                publiquement sur l’écran du classement.
              </span>
            </p>

            {startError && (
              <div
                role="alert"
                className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-900"
              >
                {startError}
              </div>
            )}

            <button
              type="submit"
              disabled={isStarting}
              className="w-full py-3.5 px-6 rounded-xl font-extrabold text-slate-950 bg-gradient-to-r from-[#D4AF37] via-[#E5C158] to-[#D4AF37] hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Démarrage…
                </>
              ) : (
                <>
                  Démarrer le challenge
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      <footer className="text-center py-4 px-4 text-xs text-slate-400 space-y-3">
        <div>
          Club Dev ESGIS Bénin • Édition 2026{" "}
          <button
            type="button"
            onClick={() => setShowStandTools((prev) => !prev)}
            className="ml-2 underline hover:text-slate-600 cursor-pointer"
          >
            Outils stand
          </button>
        </div>

        {showStandTools && (
          <div className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 text-left text-slate-700 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-900">
                Administration stand
              </span>
              <a
                href="/api/admin/scores"
                download
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <Download className="w-3.5 h-3.5" />
                Exporter CSV
              </a>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Tape RESET pour vider"
                value={resetConfirm}
                onChange={(e) => setResetConfirm(e.target.value)}
                aria-label="Confirmation de réinitialisation"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900"
              />
              <button
                type="button"
                disabled={
                  resetConfirm.trim().toUpperCase() !== "RESET" || isResetting
                }
                onClick={() => void handleResetScores()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E1B24] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Vider scores
              </button>
            </div>

            {adminStatus && (
              <p className="text-[11px] font-semibold text-slate-700">
                {adminStatus}
              </p>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}
