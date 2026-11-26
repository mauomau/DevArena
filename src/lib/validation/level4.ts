import { runFunctionTests } from "./sandbox";
import type { ValidationResult } from "./types";

/** Niveau 4 — corriger les deux bugs de compterVoyelles. */
export function validateLevel4(code: string): ValidationResult {
  const report = runFunctionTests(code, "compterVoyelles", [
    { label: 'compterVoyelles("Bonjour")', args: ["Bonjour"], expected: 3 },
    { label: 'compterVoyelles("ESGIS")', args: ["ESGIS"], expected: 2 },
    { label: 'compterVoyelles("rythme")', args: ["rythme"], expected: 2 },
    { label: 'compterVoyelles("AEIOUY")', args: ["AEIOUY"], expected: 6 },
    { label: 'compterVoyelles("")', args: [""], expected: 0 },
    {
      label: 'compterVoyelles("Le Club Dev")',
      args: ["Le Club Dev"],
      expected: 3,
    },
  ]);

  const valid = report.checks.every((check) => check.passed);
  const firstFailure = report.checks.find((check) => !check.passed);

  return {
    valid,
    checks: report.checks,
    feedback: valid
      ? "Niveau 4 validé : les deux bugs sont corrigés."
      : report.fatalError ??
        `Pas encore : ${firstFailure?.label ?? "un test échoue"}. ${
          firstFailure?.detail ?? ""
        }`.trim(),
  };
}
