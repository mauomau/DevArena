import { findElementContents, htmlToText } from "./html";
import type { ValidationCheck, ValidationResult } from "./types";

const EXPECTED_TITLE = "Hello ESGIS";

/** Niveau 1 — un <h1> dont le texte visible est exactement « Hello ESGIS ». */
export function validateLevel1(code: string): ValidationResult {
  const titles = findElementContents(code, "h1").map(htmlToText);
  const matchingTitle = titles.find((title) => title === EXPECTED_TITLE);

  const check: ValidationCheck = {
    id: "title",
    label: `Un titre <h1> affichant exactement « ${EXPECTED_TITLE} »`,
    passed: matchingTitle !== undefined,
  };

  if (titles.length === 0) {
    check.detail =
      "Aucune balise <h1> détectée. Ajoute un titre principal avec <h1>...</h1>.";
  } else if (matchingTitle !== undefined) {
    check.detail = `Titre détecté : « ${matchingTitle} »`;
  } else {
    check.detail = `Titre détecté : « ${titles[0]} ». Le texte doit être exactement « ${EXPECTED_TITLE} » (majuscules comprises).`;
  }

  return {
    valid: check.passed,
    checks: [check],
    feedback: check.passed
      ? "Niveau 1 validé : le titre s'affiche correctement."
      : check.detail ?? "Le titre attendu est introuvable.",
  };
}
