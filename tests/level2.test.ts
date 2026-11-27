import assert from "node:assert/strict";
import { test } from "node:test";
import { validateLevel2 } from "../src/lib/validation/level2";

const VALID_CSS = `
#cta {
  background-color: #0B6E4F;
  color: #FFFFFF;
  padding: 12px 20px;
  border-radius: 8px;
  font-weight: bold;
}
`;

test("une feuille de style complète valide le niveau 2", () => {
  const result = validateLevel2(VALID_CSS);
  assert.equal(result.valid, true);
  assert.equal(result.checks.length, 5);
});

test("les couleurs rgb, les rem, les em et les sélecteurs multiples sont acceptés", () => {
  const result = validateLevel2(`
    button, .autre {
      background: rgb(11, 110, 79) url(fond.png);
      color: rgb(255, 255, 255);
      padding: 0.75rem;
      border-radius: 0.5rem;
      font-weight: 700;
    }
  `);
  assert.equal(result.valid, true);

  const emResult = validateLevel2(`
    #cta {
      background-color: #0B6E4F;
      color: white;
      padding: 1em;
      border-radius: 0.5em;
      font-weight: bold;
    }
  `);
  assert.equal(emResult.valid, true);
});

test("un style inline sur le bouton #cta est accepté", () => {
  const result = validateLevel2(
    '<button id="cta" style="background:#0B6E4F;color:#fff;padding:16px;border-radius:50%;font-weight:600">Go</button>',
  );
  assert.equal(result.valid, true);
});

test("un bloc <style> dans du HTML est accepté", () => {
  const result = validateLevel2(`
    <style>${VALID_CSS}</style>
    <button id="cta">Rejoindre</button>
  `);
  assert.equal(result.valid, true);
});

test("l'absence de gras est signalée", () => {
  const result = validateLevel2(`
    #cta {
      background-color: #0B6E4F;
      color: white;
      padding: 12px;
      border-radius: 8px;
    }
  `);
  assert.equal(result.valid, false);
  assert.ok(
    result.checks.some(
      (check) => check.id === "font-weight" && !check.passed,
    ),
  );
  assert.match(result.feedback, /gras/i);
});

test("un padding insuffisant sur un axe échoue", () => {
  const result = validateLevel2(`
    #cta {
      background-color: #0B6E4F;
      color: #fff;
      padding: 8px 20px;
      border-radius: 8px;
      font-weight: bold;
    }
  `);
  assert.equal(result.valid, false);
  assert.match(result.feedback, /Padding/i);
});

test("un rayon inférieur à 8px échoue", () => {
  const result = validateLevel2(`
    #cta {
      background-color: #0B6E4F;
      color: #fff;
      padding: 12px;
      border-radius: 4px;
      font-weight: bold;
    }
  `);
  assert.equal(result.valid, false);
});

test("une règle limitée à :hover ne compte pas pour l'état de base", () => {
  const result = validateLevel2(`
    #cta:hover {
      background-color: #0B6E4F;
      color: #fff;
      padding: 12px;
      border-radius: 8px;
      font-weight: bold;
    }
  `);
  assert.equal(result.valid, false);
});

test("un sélecteur qui ne cible pas le bouton est ignoré", () => {
  const result = validateLevel2(`
    .autre {
      background-color: #0B6E4F;
      color: #fff;
      padding: 12px;
      border-radius: 8px;
      font-weight: bold;
    }
  `);
  assert.equal(result.valid, false);
});

test("une couleur de fond proche mais incorrecte échoue", () => {
  const result = validateLevel2(`
    #cta {
      background-color: green;
      color: #fff;
      padding: 12px;
      border-radius: 8px;
      font-weight: bold;
    }
  `);
  assert.equal(result.valid, false);
});

test("les propriétés de padding individuelles sont prises en compte", () => {
  const result = validateLevel2(`
    #cta {
      background-color: #0B6E4F;
      color: #fff;
      padding-top: 12px;
      padding-right: 12px;
      padding-bottom: 12px;
      padding-left: 12px;
      border-radius: 8px;
      font-weight: bold;
    }
  `);
  assert.equal(result.valid, true);
});

test("!important est toléré", () => {
  const result = validateLevel2(`
    #cta {
      background-color: #0B6E4F !important;
      color: #fff;
      padding: 12px !important;
      border-radius: 8px;
      font-weight: bold;
    }
  `);
  assert.equal(result.valid, true);
});
