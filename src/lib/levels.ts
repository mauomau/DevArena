/**
 * Définition PUBLIQUE des niveaux.
 *
 * Ce fichier peut être importé sans risque côté client : il ne contient
 * aucune solution ni aucun test caché. Les règles de validation vivent dans
 * `src/lib/validation/` et ne doivent être exécutées que côté serveur.
 */

export const LEVEL_IDS = [1, 2, 3, 4, 5] as const;

export type LevelId = (typeof LEVEL_IDS)[number];

export type LevelLanguage = "html" | "css" | "javascript";

export interface PublicLevel {
  id: LevelId;
  title: string;
  theme: string;
  /** Durée du chrono, en secondes. */
  durationSeconds: number;
  /** Points attribués hors bonus de rapidité et hors pénalité d'indice. */
  basePoints: number;
  language: LevelLanguage;
  statement: string;
  starterCode: string;
  hint: string;
  /**
   * HTML fixe utilisé par l'aperçu live pour les niveaux où le joueur
   * n'édite que le CSS ou le JavaScript.
   */
  previewHtml?: string;
}

export const LEVELS: readonly PublicLevel[] = [
  {
    id: 1,
    title: "Le Déclic",
    theme: "HTML",
    durationSeconds: 45,
    basePoints: 100,
    language: "html",
    statement:
      "Affiche un titre principal (balise <h1>) dont le texte est exactement « Hello ESGIS ». " +
      "Respecte les majuscules et l'orthographe.",
    starterCode: "<!-- Écris ton code HTML ici -->\n",
    hint: "Utilise simplement : <h1>Hello ESGIS</h1>",
  },
  {
    id: 2,
    title: "Le Styliste",
    theme: "CSS",
    durationSeconds: 60,
    basePoints: 150,
    language: "css",
    statement:
      "Donne au bouton #cta les couleurs de l'ESGIS : fond vert #0B6E4F, texte blanc, " +
      "padding d'au moins 12px, coins arrondis d'au moins 8px et texte en gras.",
    starterCode:
      "/* Style le bouton #cta aux couleurs de l'ESGIS */\n" +
      "#cta {\n  /* À toi de jouer */\n}\n",
    hint:
      "#cta {\n" +
      "  background-color: #0B6E4F;\n" +
      "  color: #FFFFFF;\n" +
      "  padding: 12px 20px;\n" +
      "  border-radius: 8px;\n" +
      "  font-weight: bold;\n" +
      "}",
    previewHtml: '<button id="cta">Rejoindre le Club Dev</button>',
  },
  {
    id: 3,
    title: "L'Interactif",
    theme: "JavaScript (DOM)",
    durationSeconds: 90,
    basePoints: 200,
    language: "javascript",
    statement:
      "Chaque clic sur le bouton #btn doit augmenter de 1 le nombre affiché dans #count. " +
      "Le compteur démarre à 0. Le HTML est déjà fourni dans l'aperçu.",
    starterCode:
      "// HTML fourni :\n" +
      '// <button id="btn">+1</button> <p id="count">0</p>\n' +
      "// Écoute le clic sur le bouton et incrémente le compteur.\n",
    hint:
      'const bouton = document.getElementById("btn");\n' +
      'const compteur = document.getElementById("count");\n\n' +
      'bouton.addEventListener("click", () => {\n' +
      '  compteur.textContent = Number(compteur.textContent) + 1;\n' +
      "});",
    previewHtml: '<button id="btn">+1</button>\n<p id="count">0</p>',
  },
  {
    id: 4,
    title: "Bug Hunter",
    theme: "Debug",
    durationSeconds: 90,
    basePoints: 250,
    language: "javascript",
    statement:
      "La fonction compterVoyelles(texte) doit renvoyer le nombre de voyelles (a, e, i, o, u, y) " +
      "d'un texte, sans tenir compte de la casse. Deux erreurs se sont glissées dans le script : " +
      "corrige-les sans changer son nom.",
    starterCode:
      "// Compte les voyelles (a, e, i, o, u, y) d'un texte.\n" +
      "// Attention : deux erreurs se sont glissées dans ce script !\n" +
      "function compterVoyelles(texte) {\n" +
      '  const voyelles = "aeiouy";\n' +
      "  let total = 0;\n\n" +
      "  for (let i = 0; i < texte.length - 1; i++) {\n" +
      "    if (voyelles.includes(texte[i])) {\n" +
      "      total += 1;\n" +
      "    }\n" +
      "  }\n\n" +
      "  return total;\n" +
      "}\n",
    hint:
      "Deux pistes : la boucle oublie le dernier caractère (pense à texte.length), " +
      "et les majuscules ne sont jamais converties en minuscules (toLowerCase).",
  },
  {
    id: 5,
    title: "Le Boss Final",
    theme: "Algo",
    durationSeconds: 120,
    basePoints: 300,
    language: "javascript",
    statement:
      "Écris la fonction estPalindrome(texte) qui renvoie true si le texte se lit de la même façon " +
      "dans les deux sens, et false sinon. Ignore les espaces et la casse. " +
      "Une chaîne vide est considérée comme un palindrome.",
    starterCode:
      "// Retourne true si texte est un palindrome, false sinon.\n" +
      "// Ignore les espaces et la casse.\n" +
      "function estPalindrome(texte) {\n" +
      "  return false;\n" +
      "}\n",
    hint:
      'Nettoie le texte puis compare-le à son inverse :\n' +
      'const propre = texte.toLowerCase().replaceAll(" ", "");\n' +
      "return propre === [...propre].reverse().join(\"\");",
  },
];

export function isLevelId(value: unknown): value is LevelId {
  return (
    typeof value === "number" &&
    (LEVEL_IDS as readonly number[]).includes(value)
  );
}

export function getLevel(id: LevelId): PublicLevel {
  const level = LEVELS.find((candidate) => candidate.id === id);
  if (!level) {
    throw new RangeError(`Niveau inconnu : ${id}`);
  }
  return level;
}

/** Somme des points de base des 5 niveaux (1000 pts). */
export const TOTAL_BASE_POINTS = LEVELS.reduce(
  (total, level) => total + level.basePoints,
  0,
);
