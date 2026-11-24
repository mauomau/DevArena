"use client";

import { RotateCcw, Trophy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { MAX_TOTAL_SCORE } from "@/lib/scoring";

const WHATSAPP_GROUP_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL ?? "";

interface FinishedScreenProps {
  pseudo: string;
  score: number;
  totalTimeSpent: number;
  onReset: () => void;
}

export default function FinishedScreen({
  pseudo,
  score,
  totalTimeSpent,
  onReset,
}: FinishedScreenProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden text-center">
        <div className="bg-[#9E1B24] p-6 text-white">
          <div className="w-16 h-16 rounded-full bg-white/15 mx-auto flex items-center justify-center mb-3 border-2 border-[#D4AF37]">
            <Trophy className="w-8 h-8 text-[#D4AF37]" />
          </div>

          <h2 className="text-2xl font-extrabold">
            Félicitations, {pseudo} !
          </h2>

          <p className="text-red-100 text-xs mt-1">
            Ton score est affiché en direct sur le vidéoprojecteur.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-around">
            <div>
              <span className="text-xs uppercase font-bold text-slate-400">
                Score Final
              </span>

              <p className="text-3xl font-black text-[#9E1B24]">
                {score} pts
              </p>

              <p className="text-[11px] text-slate-400 mt-0.5">
                Max théorique : {MAX_TOTAL_SCORE} pts
              </p>
            </div>

            <div className="h-10 w-px bg-slate-200" />

            <div>
              <span className="text-xs uppercase font-bold text-slate-400">
                Temps Total
              </span>

              <p className="text-xl font-bold text-slate-700">
                {totalTimeSpent}s
              </p>
            </div>
          </div>

          {WHATSAPP_GROUP_URL && (
            <div className="bg-[#FCF8E8] border-2 border-[#D4AF37] rounded-2xl p-5 space-y-3">
              <p className="text-sm font-bold text-slate-800">
                Rejoins le groupe WhatsApp du{" "}
                <span className="text-[#9E1B24]">
                  Club Dev ESGIS
                </span>
              </p>

              <div className="bg-white p-3 rounded-xl inline-block shadow-sm">
                <QRCodeSVG
                  value={WHATSAPP_GROUP_URL}
                  size={150}
                  fgColor="#9E1B24"
                />
              </div>

              <p className="text-xs text-slate-600">
                Scanne ce code avec ton téléphone pour accéder aux ateliers,
                projets et hackathons !
              </p>
            </div>
          )}

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