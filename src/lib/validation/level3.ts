import {
  DOM_TEST_API,
  describeSandboxError,
  initDomSandbox,
  runScript,
} from "./sandbox";
import { GAME_CONFIG } from "../game/config";
import type { ValidationCheck, ValidationResult } from "./types";

function readCounterText(context: ReturnType<typeof initDomSandbox>): string {
  const value = runScript(
    `${DOM_TEST_API}.countText()`,
    context,
    GAME_CONFIG.sandboxTimeoutMs,
  );
  return typeof value === "string" ? value : String(value);
}

function parseCounter(text: string): number | null {
  const match = text.match(/-?\d+/);
  if (!match) {
    return null;
  }
  return Number(match[0]);
}

/** Niveau 3 — bouton #btn qui incrémente #count à chaque clic. */
export function validateLevel3(code: string): ValidationResult {
  const context = initDomSandbox();

  try {
    runScript(code, context, GAME_CONFIG.sandboxTimeoutMs);
    // Tolérance pour l'idiome `window.onload = function () { ... }`.
    runScript(
      "if (typeof globalThis.onload === 'function') { globalThis.onload({ type: 'load', target: globalThis }); }",
      context,
      GAME_CONFIG.sandboxTimeoutMs,
    );
  } catch (error) {
    const detail = describeSandboxError(error);
    return {
      valid: false,
      checks: [
        {
          id: "script",
          label: "Le script s'exécute sans erreur",
          passed: false,
          detail,
        },
      ],
      feedback: detail,
    };
  }

  const checks: ValidationCheck[] = [
    {
      id: "script",
      label: "Le script s'exécute sans erreur",
      passed: true,
    },
  ];

  const initialText = readCounterText(context);
  const initialValue = parseCounter(initialText);
  checks.push({
    id: "initial-value",
    label: "Le compteur démarre à 0",
    passed: initialValue === 0,
    detail: `Affiché au départ : « ${initialText} »`,
  });

  let stopped = false;
  for (let clicks = 1; clicks <= 3; clicks += 1) {
    if (stopped) {
      checks.push({
        id: `click-${clicks}`,
        label: `${clicks} clic${clicks > 1 ? "s" : ""} affiche ${
          clicks === 1 ? "1" : String(clicks)
        }`,
        passed: false,
        detail: "Test non exécuté après une erreur précédente.",
      });
      continue;
    }

    try {
      runScript(
        `${DOM_TEST_API}.click()`,
        context,
        GAME_CONFIG.sandboxTimeoutMs,
      );
      const text = readCounterText(context);
      const value = parseCounter(text);
      checks.push({
        id: `click-${clicks}`,
        label: `${clicks} clic${clicks > 1 ? "s" : ""} affiche ${
          clicks === 1 ? "1" : String(clicks)
        }`,
        passed: value === clicks,
        detail: `Affiché après ${clicks} clic${
          clicks > 1 ? "s" : ""
        } : « ${text} »`,
      });
    } catch (error) {
      stopped = true;
      checks.push({
        id: `click-${clicks}`,
        label: `${clicks} clic${clicks > 1 ? "s" : ""} affiche ${
          clicks === 1 ? "1" : String(clicks)
        }`,
        passed: false,
        detail: describeSandboxError(error),
      });
    }
  }

  const valid = checks.every((check) => check.passed);
  const firstFailure = checks.find((check) => !check.passed);

  return {
    valid,
    checks,
    feedback: valid
      ? "Niveau 3 validé : le compteur réagit correctement au clic."
      : `Pas encore : ${
          firstFailure?.detail ?? firstFailure?.label ?? "un test échoue."
        }`,
  };
}
