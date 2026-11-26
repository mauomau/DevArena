import { GAME_CONFIG } from "../game/config";
import { getLevel, type LevelId } from "../levels";
import { validateLevel1 } from "./level1";
import { validateLevel2 } from "./level2";
import { validateLevel3 } from "./level3";
import { validateLevel4 } from "./level4";
import { validateLevel5 } from "./level5";
import type { ValidationResult } from "./types";

type LevelValidator = (code: string) => ValidationResult;

const VALIDATORS: Record<LevelId, LevelValidator> = {
  1: validateLevel1,
  2: validateLevel2,
  3: validateLevel3,
  4: validateLevel4,
  5: validateLevel5,
};

/**
 * Point d'entrée serveur du moteur de validation.
 * Ne jamais importer ce module depuis un composant client : les tests
 * cachés et les détails d'implémentation doivent rester côté serveur.
 */
export function validateLevel(
  levelId: LevelId,
  code: unknown,
): ValidationResult {
  getLevel(levelId);

  if (typeof code !== "string") {
    return {
      valid: false,
      checks: [],
      feedback: "Le code envoyé est invalide.",
    };
  }
  if (code.length > GAME_CONFIG.maxCodeLength) {
    return {
      valid: false,
      checks: [],
      feedback: `Code trop long (maximum ${GAME_CONFIG.maxCodeLength} caractères).`,
    };
  }
  if (code.trim().length === 0) {
    return {
      valid: false,
      checks: [],
      feedback: "Ton éditeur est vide. Écris du code avant de valider.",
    };
  }

  return VALIDATORS[levelId](code);
}
