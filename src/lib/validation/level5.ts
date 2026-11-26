import { runFunctionTests } from "./sandbox";
import type { ValidationResult } from "./types";

/** Niveau 5 — détection de palindrome (espaces et casse ignorés). */
export function validateLevel5(code: string): ValidationResult {
  const report = runFunctionTests(code, "estPalindrome", [
    { label: 'estPalindrome("Laval")', args: ["Laval"], expected: true },
    {
      label: 'estPalindrome("Elu par cette crapule")',
      args: ["Elu par cette crapule"],
      expected: true,
    },
    {
      label: 'estPalindrome("Dev Arena")',
      args: ["Dev Arena"],
      expected: false,
    },
    { label: 'estPalindrome("Été")', args: ["Été"], expected: true },
    { label: 'estPalindrome("A")', args: ["A"], expected: true },
    { label: 'estPalindrome("")', args: [""], expected: true },
    { label: 'estPalindrome("Esgis")', args: ["Esgis"], expected: false },
  ]);

  const valid = report.checks.every((check) => check.passed);
  const firstFailure = report.checks.find((check) => !check.passed);

  return {
    valid,
    checks: report.checks,
    feedback: valid
      ? "Niveau 5 validé : le boss final est vaincu !"
      : report.fatalError ??
        `Pas encore : ${firstFailure?.label ?? "un test échoue"}. ${
          firstFailure?.detail ?? ""
        }`.trim(),
  };
}
