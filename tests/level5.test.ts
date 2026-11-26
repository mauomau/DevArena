import assert from "node:assert/strict";
import { test } from "node:test";
import { validateLevel5 } from "../src/lib/validation/level5";

const REVERSE = `
function estPalindrome(texte) {
  const propre = texte.toLowerCase().replace(/\\s+/g, "");
  return propre === [...propre].reverse().join("");
}
`;

const TWO_POINTERS = `
function estPalindrome(texte) {
  const propre = texte.toLowerCase().replaceAll(" ", "");
  let gauche = 0;
  let droite = propre.length - 1;
  while (gauche < droite) {
    if (propre[gauche] !== propre[droite]) return false;
    gauche += 1;
    droite -= 1;
  }
  return true;
}
`;

test("une solution par inversion valide le niveau 5", () => {
  const result = validateLevel5(REVERSE);
  assert.equal(result.valid, true);
  assert.ok(result.checks.length >= 8);
});

test("une solution à deux pointeurs valide le niveau 5", () => {
  assert.equal(validateLevel5(TWO_POINTERS).valid, true);
});

test("le code de départ (return false) échoue", () => {
  const result = validateLevel5(`
    function estPalindrome(texte) {
      return false;
    }
  `);
  assert.equal(result.valid, false);
});

test("une fonction qui renvoie toujours true échoue", () => {
  const result = validateLevel5(`
    function estPalindrome(texte) {
      return true;
    }
  `);
  assert.equal(result.valid, false);
});

test("ignorer la casse mais pas les espaces échoue", () => {
  const result = validateLevel5(`
    function estPalindrome(texte) {
      const propre = texte.toLowerCase();
      return propre === [...propre].reverse().join("");
    }
  `);
  assert.equal(result.valid, false);
});

test("une fonction manquante donne un retour explicite", () => {
  const result = validateLevel5("const x = 1;");
  assert.equal(result.valid, false);
  assert.match(result.feedback, /introuvable/i);
});

test("une erreur de syntaxe est signalée", () => {
  const result = validateLevel5("function estPalindrome( {");
  assert.equal(result.valid, false);
  assert.match(result.feedback, /syntaxe/i);
});
