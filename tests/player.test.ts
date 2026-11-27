import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bestEntryPerPseudo,
  isBetterScore,
  isBlockedPseudo,
  normalizePseudo,
  parsePlayerRegistration,
  parseScoreSubmission,
  pseudoKey,
  type ScoreEntry,
} from "../src/lib/game/player";

const validSubmission = {
  pseudo: "Achille_Dev",
  filiere: "IRT",
  score: 750,
  currentLevel: 4,
  totalTimeSeconds: 180,
};

test("accepte une soumission valide et normalise le pseudo", () => {
  const result = parseScoreSubmission({
    ...validSubmission,
    pseudo: "  Achille   Dev  ",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.pseudo, "Achille Dev");
  assert.equal(result.value.filiere, "IRT");
  assert.equal(result.value.score, 750);
});

test("refuse un pseudo trop court ou trop long", () => {
  assert.equal(parseScoreSubmission({ ...validSubmission, pseudo: "A" }).ok, false);
  assert.equal(
    parseScoreSubmission({ ...validSubmission, pseudo: "a".repeat(21) }).ok,
    false,
  );
});

test("refuse un pseudo avec des caractères spéciaux", () => {
  assert.equal(
    parseScoreSubmission({ ...validSubmission, pseudo: "<script>" }).ok,
    false,
  );
});

test("refuse une filière inconnue", () => {
  const result = parseScoreSubmission({
    ...validSubmission,
    filiere: "Hacker",
  });
  assert.equal(result.ok, false);
});

test("refuse un score hors bornes ou non entier", () => {
  assert.equal(
    parseScoreSubmission({ ...validSubmission, score: -1 }).ok,
    false,
  );
  assert.equal(
    parseScoreSubmission({ ...validSubmission, score: 2000 }).ok,
    false,
  );
  assert.equal(
    parseScoreSubmission({ ...validSubmission, score: 12.5 }).ok,
    false,
  );
});

test("refuse un niveau ou un temps invalide", () => {
  assert.equal(
    parseScoreSubmission({ ...validSubmission, currentLevel: 0 }).ok,
    false,
  );
  assert.equal(
    parseScoreSubmission({ ...validSubmission, currentLevel: 6 }).ok,
    false,
  );
  assert.equal(
    parseScoreSubmission({ ...validSubmission, totalTimeSeconds: -3 }).ok,
    false,
  );
});

test("le pseudo est comparé sans tenir compte de la casse", () => {
  assert.equal(pseudoKey("  Achille   Dev "), pseudoKey("achille dev"));
  assert.equal(normalizePseudo("  Achille   Dev "), "Achille Dev");
});

test("le départage conserve le meilleur score puis le temps le plus court", () => {
  assert.equal(isBetterScore({ score: 700, totalTimeSeconds: 200 }, { score: 700, totalTimeSeconds: 180 }), false);
  assert.equal(isBetterScore({ score: 800, totalTimeSeconds: 300 }, { score: 700, totalTimeSeconds: 100 }), true);
  assert.equal(isBetterScore({ score: 700, totalTimeSeconds: 120 }, { score: 700, totalTimeSeconds: 180 }), true);
});

function entry(pseudo: string, score: number, totalTimeSeconds: number): ScoreEntry {
  return {
    id: `${pseudo}-${score}`,
    pseudo,
    filiere: "IRT",
    score,
    currentLevel: 5,
    totalTimeSeconds,
    updatedAt: new Date(0).toISOString(),
  };
}

test("bestEntryPerPseudo ne garde qu'une performance par joueur", () => {
  const entries = [
    entry("Achille", 500, 200),
    entry("achille", 500, 150),
    entry("Achille", 400, 100),
    entry("Béatrice", 600, 300),
  ];

  const best = bestEntryPerPseudo(entries);
  assert.equal(best.length, 2);

  const achille = best.find((candidate) => pseudoKey(candidate.pseudo) === "achille");
  assert.equal(achille?.totalTimeSeconds, 150);
});

test("parsePlayerRegistration valide filière, niveau L1-M2 et PIN à 4 chiffres", () => {
  const valid = parsePlayerRegistration({
    pseudo: "Achille_Dev",
    filiere: "IRT",
    niveau: "L2",
    pin: "2026",
  });
  assert.equal(valid.ok, true);
  if (!valid.ok) return;
  assert.equal(valid.value.filiereDisplay, "IRT • L2");

  const badNiveau = parsePlayerRegistration({
    pseudo: "Achille_Dev",
    filiere: "IRT",
    niveau: "Doctorat",
    pin: "2026",
  });
  assert.equal(badNiveau.ok, false);

  const badPin = parsePlayerRegistration({
    pseudo: "Achille_Dev",
    filiere: "IRT",
    niveau: "L2",
    pin: "12ab",
  });
  assert.equal(badPin.ok, false);
});

test("bloque les pseudos réservés ou offensants", () => {
  for (const blocked of ["Admin", "ESGIS", "ESLIS", "Test", "admin_esgis", "Merde"]) {
    assert.equal(isBlockedPseudo(blocked), true, `Aurait dû bloquer ${blocked}`);
  }
  assert.equal(isBlockedPseudo("Achille_Dev"), false);
});
