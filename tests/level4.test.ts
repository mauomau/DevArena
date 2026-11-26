import assert from "node:assert/strict";
import { test } from "node:test";
import { getLevel } from "../src/lib/levels";
import { validateLevel4 } from "../src/lib/validation/level4";

const FIXED = `
function compterVoyelles(texte) {
  const voyelles = "aeiouy";
  const normalise = texte.toLowerCase();
  let total = 0;

  for (let i = 0; i < normalise.length; i++) {
    if (voyelles.includes(normalise[i])) {
      total += 1;
    }
  }

  return total;
}
`;

test("la correction des deux bugs valide le niveau 4", () => {
  const result = validateLevel4(FIXED);
  assert.equal(result.valid, true);
  assert.ok(result.checks.length >= 7);
});

test("le code de départ buggé échoue", () => {
  const starter = getLevel(4).starterCode;
  assert.equal(validateLevel4(starter).valid, false);
});

test("corriger seulement la casse ne suffit pas", () => {
  const result = validateLevel4(`
    function compterVoyelles(texte) {
      const voyelles = "aeiouy";
      const normalise = texte.toLowerCase();
      let total = 0;
      for (let i = 0; i < normalise.length - 1; i++) {
        if (voyelles.includes(normalise[i])) total += 1;
      }
      return total;
    }
  `);
  assert.equal(result.valid, false);
});

test("corriger seulement la borne de boucle ne suffit pas", () => {
  const result = validateLevel4(`
    function compterVoyelles(texte) {
      const voyelles = "aeiouy";
      let total = 0;
      for (let i = 0; i < texte.length; i++) {
        if (voyelles.includes(texte[i])) total += 1;
      }
      return total;
    }
  `);
  assert.equal(result.valid, false);
});

test("une fonction fléchée affectée à une const est acceptée", () => {
  const result = validateLevel4(`
    const compterVoyelles = (texte) =>
      [...texte.toLowerCase()].filter((lettre) =>
        "aeiouy".includes(lettre),
      ).length;
  `);
  assert.equal(result.valid, true);
});

test("une fonction manquante donne un retour explicite", () => {
  const result = validateLevel4("const autre = 1;");
  assert.equal(result.valid, false);
  assert.match(result.feedback, /introuvable/i);
});

test("un retour en chaîne de caractères n'est pas accepté", () => {
  const result = validateLevel4(`
    function compterVoyelles(texte) {
      return String([...texte.toLowerCase()].filter((lettre) => "aeiouy".includes(lettre)).length);
    }
  `);
  assert.equal(result.valid, false);
});

test("une erreur de syntaxe est signalée", () => {
  const result = validateLevel4("function compterVoyelles( {");
  assert.equal(result.valid, false);
  assert.match(result.feedback, /syntaxe/i);
});
