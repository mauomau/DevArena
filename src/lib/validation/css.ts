import { extractStyleBlocks, findElements, getAttribute } from "./html";

export interface CssDeclaration {
  property: string;
  value: string;
  important: boolean;
}

export interface CssRule {
  selector: string;
  declarations: CssDeclaration[];
}

const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  gray: "#808080",
  grey: "#808080",
};

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Découpe en respectant les chaînes et les parenthèses (url(...), rgb(...)). */
function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: string | null = null;
  let parentheses = 0;

  for (const char of input) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") {
      parentheses += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      parentheses = Math.max(0, parentheses - 1);
      current += char;
      continue;
    }
    if (char === separator && parentheses === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

export function parseDeclarations(body: string): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  for (const chunk of splitTopLevel(body, ";")) {
    const colonIndex = chunk.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const property = chunk.slice(0, colonIndex).trim().toLowerCase();
    let value = chunk.slice(colonIndex + 1).trim();
    if (!property || !value) {
      continue;
    }
    let important = false;
    if (/!\s*important\s*$/i.test(value)) {
      important = true;
      value = value.replace(/!\s*important\s*$/i, "").trim();
    }
    declarations.push({ property, value, important });
  }
  return declarations;
}

/**
 * Parseur CSS volontairement simple : il récupère les blocs de déclarations
 * (y compris ceux imbriqués dans @media/@supports) sans dépendance externe.
 */
export function parseCssRules(css: string): CssRule[] {
  const clean = stripCssComments(css);
  const rules: CssRule[] = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;

  for (const match of clean.matchAll(pattern)) {
    const selectorText = (match[1] ?? "").replace(/\s+/g, " ").trim();
    if (!selectorText || selectorText.startsWith("@")) {
      continue;
    }
    const declarations = parseDeclarations(match[2] ?? "");
    if (declarations.length === 0) {
      continue;
    }
    for (const selector of selectorText.split(",")) {
      const trimmed = selector.trim();
      if (trimmed) {
        rules.push({ selector: trimmed, declarations });
      }
    }
  }
  return rules;
}

function selectorTargetsButton(selector: string): boolean {
  if (
    /::|:(?:hover|focus|active|visited|focus-visible|focus-within|disabled|checked|target)\b|:not\(|:has\(/i.test(
      selector,
    )
  ) {
    return false;
  }

  const value = selector.toLowerCase().replace(/\s+/g, " ").trim();
  if (!value) {
    return false;
  }
  if (/(^|[\s>+~,(])button(?=[\s>+~.#:,[\]]|$)/.test(value)) {
    return true;
  }
  if (/#cta(?![\w-])/.test(value)) {
    return true;
  }
  if (/\.btn(?![\w-])/.test(value)) {
    return true;
  }
  return false;
}

function applyDeclarations(
  styles: Map<string, string>,
  declarations: readonly CssDeclaration[],
): void {
  for (const declaration of declarations) {
    const { property } = declaration;
    const value = declaration.value.trim();

    if (property === "background" || property === "background-color") {
      const color = normalizeColor(value);
      if (color) {
        styles.set("background-color", color);
      } else if (value.toLowerCase() === "transparent") {
        styles.set("background-color", "transparent");
      } else if (property === "background") {
        // Un shorthand `background` sans couleur réinitialise le fond.
        styles.delete("background-color");
      } else {
        styles.set("background-color", value.toLowerCase());
      }
      continue;
    }

    styles.set(property, value);
  }
}

/**
 * Styles finaux du bouton : règles CSS ciblant `button`, `#cta` ou `.btn`,
 * puis attribut `style` inline (prioritaire).
 */
export function collectButtonStyles(
  css: string,
  html?: string,
): Map<string, string> {
  const styles = new Map<string, string>();

  for (const rule of parseCssRules(css)) {
    if (selectorTargetsButton(rule.selector)) {
      applyDeclarations(styles, rule.declarations);
    }
  }

  if (html) {
    const buttons = findElements(html, "button");
    const target =
      buttons.find(
        (button) => getAttribute(button.attributes, "id") === "cta",
      ) ??
      buttons.find((button) =>
        (getAttribute(button.attributes, "class") ?? "")
          .split(/\s+/)
          .includes("btn"),
      ) ??
      (buttons.length === 1 ? buttons[0] : undefined);

    if (target) {
      const inlineStyle = getAttribute(target.attributes, "style");
      if (inlineStyle) {
        applyDeclarations(styles, parseDeclarations(inlineStyle));
      }
    }
  }

  return styles;
}

/**
 * Normalise une couleur CSS en `#rrggbb` (hex, rgb/rgba ou nom simple).
 * Retourne null si aucune couleur exploitable n'est trouvée.
 */
export function normalizeColor(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (!value) {
    return null;
  }

  const hex = value.match(/#([0-9a-f]{3,8})\b/);
  if (hex) {
    let digits = hex[1] ?? "";
    if (digits.length === 3 || digits.length === 4) {
      digits = digits
        .split("")
        .map((digit) => digit + digit)
        .join("");
    }
    if (digits.length === 8) {
      digits = digits.slice(0, 6);
    }
    if (digits.length === 6) {
      return `#${digits}`;
    }
  }

  const rgb = value.match(
    /rgba?\(\s*(\d{1,3})\s*(?:,|\s)\s*(\d{1,3})\s*(?:,|\s)\s*(\d{1,3})/,
  );
  if (rgb) {
    const channels = [rgb[1], rgb[2], rgb[3]].map((channel) =>
      Math.min(255, Number(channel)),
    );
    return `#${channels
      .map((channel) => channel.toString(16).padStart(2, "0"))
      .join("")}`;
  }

  const named = value.match(/\b([a-z]+)\b/g);
  if (named) {
    for (const name of named) {
      const color = NAMED_COLORS[name];
      if (color) {
        return color;
      }
    }
  }

  return null;
}

/** Convertit une longueur CSS en pixels (px, rem ou em). */
export function parseLength(input: string): number | null {
  const value = input.trim().toLowerCase();
  if (value === "0") {
    return 0;
  }
  const match = value.match(/^(-?\d*\.?\d+)(px|r?em)$/);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return null;
  }
  return match[2] === "rem" || match[2] === "em" ? amount * 16 : amount;
}

/**
 * Padding/margin shorthand → [haut, droite, bas, gauche] en pixels.
 * Les valeurs en % ou em/calc() ne sont pas évaluables : null.
 */
export function parseBoxLengths(input: string): number[] | null {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 1 || tokens.length > 4) {
    return null;
  }
  const parsed = tokens.map(parseLength);
  if (parsed.some((value) => value === null)) {
    return null;
  }
  const [top, right = top, bottom = top, left = right] =
    parsed as number[];
  return [top, right, bottom, left];
}

export function borderRadiusPasses(
  input: string,
  minimumPx = 8,
): boolean {
  const horizontal = input.split("/")[0]?.trim() ?? "";
  if (!horizontal) {
    return false;
  }
  const tokens = horizontal.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return false;
  }
  return tokens.every((token) => {
    if (token.endsWith("%")) {
      const percent = Number.parseFloat(token);
      return Number.isFinite(percent) && percent > 0;
    }
    const pixels = parseLength(token);
    return pixels !== null && pixels >= minimumPx;
  });
}

export function fontWeightPasses(input: string): boolean {
  const value = input.trim().toLowerCase();
  if (value === "bold" || value === "bolder") {
    return true;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 600;
}

export function splitCssAndHtml(code: string): {
  css: string;
  html: string;
} {
  const styleBlocks = extractStyleBlocks(code);
  if (styleBlocks.length > 0) {
    return { css: styleBlocks.join("\n"), html: code };
  }
  if (/<[a-z!/][^>]*>/i.test(code)) {
    return { css: "", html: code };
  }
  return { css: code, html: "" };
}
