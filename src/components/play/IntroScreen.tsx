"use client";

import { useState } from "react";
import { ArrowRight, GraduationCap } from "lucide-react";
import { GAME_CONFIG } from "@/lib/game/config";
import { LEVELS } from "@/lib/levels";

interface IntroScreenProps {
  onStart: (pseudo: string, filiere: string) => void;
}

export default function IntroScreen({ onStart }: IntroScreenProps) {
  const [pseudo, setPseudo] = useState("");
  const [filiere, setFiliere] = useState("IRT");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // minLength du champ compte les espaces : on revérifie après trim
    if (pseudo.trim().length < 2) return;
    onStart(pseudo.trim(), filiere);
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
                <option value="IRT">
                  IRT : Informatique, Réseaux & Télécoms
                </option>
                <option value="Génie Logiciel">Génie Logiciel</option>
                <option value="Gestion / Finance">
                  Gestion / Finance / Marketing
                </option>
                <option value="Autre">Autre filière / Invité</option>
              </select>
            </div>

            <div className="bg-[#FCF8E8] border border-[#D4AF37]/40 rounded-xl p-3.5 text-xs text-slate-700 space-y-1">
              <p className="font-bold text-[#9E1B24]">Règles du jeu :</p>

              <p>
                • Bonus rapidité :{" "}
                <strong>
                  +{GAME_CONFIG.speedBonusPerSecond} pts
                </strong>{" "}
                par seconde restante.
              </p>

              <p>
                • Indice disponible en cas de blocage (
                <strong>-{GAME_CONFIG.hintPenalty} pts</strong>).
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded-xl font-extrabold text-slate-950 bg-gradient-to-r from-[#D4AF37] via-[#E5C158] to-[#D4AF37] hover:brightness-105 shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              Démarrer le challenge
              <ArrowRight className="w-5 h-5" />
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