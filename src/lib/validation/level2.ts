import { ESGIS_BRAND } from "../game/config";
import {
  borderRadiusPasses,
  collectButtonStyles,
  fontWeightPasses,
  normalizeColor,
  parseBoxLengths,
  parseLength,
  splitCssAndHtml,
} from "./css";
import type { ValidationCheck, ValidationResult } from "./types";

const GREEN = normalizeColor(ESGIS_BRAND.green) ?? "#0b6e4f";
const WHITE = normalizeColor(ESGIS_BRAND.white) ?? "#ffffff";

function getPadding(
  styles: ReadonlyMap<string, string>,
): [number, number, number, number] | null {
  let sides: number[] | null = null;

  const shorthand = styles.get("padding");
  if (shorthand !== undefined) {
    sides = parseBoxLengths(shorthand);
    if (!sides) {
      return null;
    }
  }

  const individual: Array<["padding-top" | "padding-right" | "padding-bottom" | "padding-left", number]> = [
    ["padding-top", 0],
    ["padding-right", 1],
    ["padding-bottom", 2],
    ["padding-left", 3],
  ];

  for (const [property, index] of individual) {
    const value = styles.get(property);
    if (value === undefined) {
      continue;
    }
    const pixels = parseLength(value);
    if (pixels === null) {
      return null;
    }
    if (!sides) {
      sides = [0, 0, 0, 0];
    }
    sides[index] = pixels;
  }

  if (!sides || sides.length !== 4) {
    return null;
  }
  return [sides[0] ?? 0, sides[1] ?? 0, sides[2] ?? 0, sides[3] ?? 0];
}

function getBorderRadius(
  styles: ReadonlyMap<string, string>,
): { passes: boolean; detected: string | null } {
  const shorthand = styles.get("border-radius");
  if (shorthand !== undefined) {
    return { passes: borderRadiusPasses(shorthand), detected: shorthand };
  }

  const corners = [
    styles.get("border-top-left-radius"),
    styles.get("border-top-right-radius"),
    styles.get("border-bottom-right-radius"),
    styles.get("border-bottom-left-radius"),
  ];
  const defined = corners.filter((value): value is string => value !== undefined);
  if (defined.length === 0) {
    return { passes: false, detected: null };
  }
  return {
    passes:
      defined.length === 4 &&
      defined.every((value) => borderRadiusPasses(value)),
    detected: defined.join(" / "),
  };
}

function getFontWeight(styles: ReadonlyMap<string, string>): {
  passes: boolean;
  detected: string | null;
} {
  const weight = styles.get("font-weight");
  if (weight !== undefined) {
    return { passes: fontWeightPasses(weight), detected: weight };
  }

  const font = styles.get("font");
  if (font !== undefined) {
    const passes = /(^|\s)(bold|bolder|[6-9]00)(\s|$)/i.test(font);
    return { passes, detected: font };
  }

  return { passes: false, detected: null };
}

/** Niveau 2 — bouton #cta stylisé aux couleurs ESGIS. */
export function validateLevel2(code: string): ValidationResult {
  const { css, html } = splitCssAndHtml(code);
  const styles = collectButtonStyles(css, html);

  const background = styles.get("background-color") ?? null;
  const textColor = normalizeColor(styles.get("color") ?? "");
  const padding = getPadding(styles);
  const radius = getBorderRadius(styles);
  const fontWeight = getFontWeight(styles);

  const backgroundOk = background === GREEN;
  const textOk = textColor === WHITE;
  const paddingOk =
    padding !== null && padding.every((value) => value >= 12);
  const radiusOk = radius.passes;

  const checks: ValidationCheck[] = [
    {
      id: "background",
      label: `Fond vert ESGIS (${ESGIS_BRAND.green})`,
      passed: backgroundOk,
      detail: background
        ? `Couleur de fond détectée : ${background}`
        : "Aucune couleur de fond détectée sur le bouton.",
    },
    {
      id: "text-color",
      label: `Texte blanc (${ESGIS_BRAND.white})`,
      passed: textOk,
      detail: textColor
        ? `Couleur de texte détectée : ${textColor}`
        : "Aucune couleur de texte détectée.",
    },
    {
      id: "padding",
      label: "Padding d'au moins 12px",
      passed: paddingOk,
      detail: padding
        ? `Padding détecté (haut/droite/bas/gauche) : ${padding.join(
            "px / ",
          )}px`
        : "Aucun padding exploitable détecté.",
    },
    {
      id: "radius",
      label: "Coins arrondis d'au moins 8px",
      passed: radiusOk,
      detail: radius.detected
        ? `Valeur détectée : ${radius.detected}`
        : "Aucun border-radius détecté.",
    },
    {
      id: "font-weight",
      label: "Texte en gras",
      passed: fontWeight.passes,
      detail: fontWeight.detected
        ? `Valeur détectée : ${fontWeight.detected}`
        : "Aucune graisse de police détectée.",
    },
  ];

  const valid = checks.every((check) => check.passed);
  const missing = checks.filter((check) => !check.passed);

  return {
    valid,
    checks,
    feedback: valid
      ? "Niveau 2 validé : le bouton respecte la charte ESGIS."
      : `Il reste ${missing.length} exigence${
          missing.length > 1 ? "s" : ""
        } : ${missing.map((check) => check.label).join(" ; ")}.`,
  };
}
