"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { ValidateResponse } from "@/lib/game/contracts";

interface ValidationFeedbackProps {
  validation: ValidateResponse | null;
}

export default function ValidationFeedback({
  validation,
}: ValidationFeedbackProps) {
  if (!validation) return null;

  // Un niveau passé (skipped) n'est pas un échec : on l'affiche en neutre/succès
  const isSuccess = validation.valid || validation.skipped;

  return (
    <div
      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
        isSuccess
          ? "bg-emerald-50 border-emerald-300 text-emerald-900"
          : "bg-red-50 border-red-300 text-red-900"
      }`}
    >
      <p className="font-bold flex items-center gap-1.5">
        {isSuccess ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
        )}

        {validation.feedback}
      </p>

      {validation.skipped && (
        <p className="font-semibold text-base">Niveau passé : 0 pt</p>
      )}

      {validation.valid && !validation.skipped && (
        <div className="font-semibold space-y-0.5">
          <p className="text-base">+{validation.pointsAwarded} pts crédités</p>

          {validation.breakdown && (
            <p className="font-normal text-emerald-800">
              (base {validation.breakdown.basePoints} + rapidité{" "}
              {validation.breakdown.speedBonus}
              {validation.breakdown.hintPenalty > 0
                ? ` − indice ${validation.breakdown.hintPenalty}`
                : ""}
              )
            </p>
          )}
        </div>
      )}

      {validation.checks.length > 0 && (
        <ul className="space-y-1 pt-1 border-t border-black/10">
          {validation.checks.map((check) => (
            <li key={check.id} className="flex items-start gap-1.5">
              {check.passed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}

              <span>
                {check.label}

                {!check.passed && check.detail && (
                  <span className="block text-[11px] opacity-80">
                    {check.detail}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}