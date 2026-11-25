/**
 * Constantes partagées du jeu.
 *
 * Ces valeurs sont publiques : elles peuvent être importées côté client
 * (affichage du chrono, du barème, etc.) sans révéler les solutions.
 */
export const GAME_CONFIG = {
  /** +2 points par seconde restante au moment de la validation. */
  speedBonusPerSecond: 2,
  /** Pénalité appliquée une seule fois par niveau si l'indice est utilisé. */
  hintPenalty: 30,
  /** Le bouton « Passer » devient disponible après 30 secondes écoulées. */
  skipAvailableAfterSeconds: 30,
  /** Plafond de sécurité pour la contrainte SQL `score <= 2000`. */
  maxScore: 2000,
  /** Taille maximale du code accepté par l'API (anti-abus). */
  maxCodeLength: 20_000,
  /** Budget d'exécution du code joueur dans la sandbox (par test). */
  sandboxTimeoutMs: 500,
} as const;

/**
 * Couleurs de la charte ESGIS utilisées par le niveau 2.
 * À ajuster ici si la charte officielle évolue : le barème et les tests
 * suivent automatiquement.
 */
export const ESGIS_BRAND = {
  green: "#0B6E4F",
  yellow: "#F2C94C",
  white: "#FFFFFF",
} as const;

/**
 * Informations publiques du club.
 *
 * `whatsappUrl` est lue depuis `NEXT_PUBLIC_WHATSAPP_GROUP_URL` : elle est
 * injectée au build, donc modifiable sans toucher au code. Si la variable
 * n'est pas définie, les QR codes affichent un message de configuration au
 * lieu d'un lien mort.
 */
export const CLUB = {
  name: "Club Dev ESGIS Bénin",
  shortName: "Club Dev",
  whatsappUrl: process.env.NEXT_PUBLIC_WHATSAPP_GROUP_URL ?? "",
} as const;
