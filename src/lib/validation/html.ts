const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  laquo: "«",
  raquo: "»",
};

/** Retire les commentaires HTML (un code commenté ne doit pas valider). */
export function stripHtmlComments(html: string): string {
  return html.replace(HTML_COMMENT_RE, "");
}

/** Décode les entités HTML les plus courantes. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity.startsWith("#")) {
        const isHex = entity[1]?.toLowerCase() === "x";
        const code = Number.parseInt(
          entity.slice(isHex ? 2 : 1),
          isHex ? 16 : 10,
        );
        if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) {
          return match;
        }
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    },
  );
}

/**
 * Texte visible d'un fragment HTML : les balises sont remplacées par une
 * espace, les entités sont décodées et les espaces consécutifs compactés
 * (comportement du rendu HTML).
 */
export function htmlToText(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Contenu interne de toutes les balises `tag` (hors commentaires). */
export function findElementContents(html: string, tag: string): string[] {
  const source = stripHtmlComments(html);
  const pattern = new RegExp(
    `<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`,
    "gi",
  );
  const contents: string[] = [];
  for (const match of source.matchAll(pattern)) {
    contents.push(match[1] ?? "");
  }
  return contents;
}

export interface HtmlElement {
  tag: string;
  attributes: string;
  inner: string;
}

/** Liste des éléments `tag`, avec leur chaîne d'attributs brute. */
export function findElements(html: string, tag: string): HtmlElement[] {
  const source = stripHtmlComments(html);
  const pattern = new RegExp(
    `<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}\\s*>`,
    "gi",
  );
  const elements: HtmlElement[] = [];
  for (const match of source.matchAll(pattern)) {
    elements.push({
      tag,
      attributes: match[1] ?? "",
      inner: match[2] ?? "",
    });
  }
  return elements;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Valeur d'un attribut HTML, ou null s'il est absent. */
export function getAttribute(
  attributes: string,
  name: string,
): string | null {
  const pattern = new RegExp(
    `(?:^|\\s)${escapeRegExp(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = attributes.match(pattern);
  if (!match) {
    return null;
  }
  return match[1] ?? match[2] ?? match[3] ?? "";
}

/** Contenu de tous les blocs <style> d'un code HTML. */
export function extractStyleBlocks(code: string): string[] {
  const blocks: string[] = [];
  const pattern = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
  for (const match of code.matchAll(pattern)) {
    blocks.push(match[1] ?? "");
  }
  return blocks;
}
