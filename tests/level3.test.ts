import assert from "node:assert/strict";
import { test } from "node:test";
import { validateLevel3 } from "../src/lib/validation/level3";

const ADD_EVENT_LISTENER = `
const bouton = document.getElementById("btn");
const compteur = document.getElementById("count");

bouton.addEventListener("click", () => {
  compteur.textContent = Number(compteur.textContent) + 1;
});
`;

const ONCLICK = `
const bouton = document.querySelector("button");
bouton.onclick = function () {
  const compteur = document.querySelector("#count");
  compteur.innerText = parseInt(compteur.innerText, 10) + 1;
};
`;

const VARIABLE_COUNTER = `
let total = 0;
const affichage = document.getElementById("count");
document.getElementById("btn").addEventListener("click", () => {
  total += 1;
  affichage.textContent = String(total);
});
`;

test("une solution addEventListener valide le niveau 3", () => {
  const result = validateLevel3(ADD_EVENT_LISTENER);
  assert.equal(result.valid, true);
  assert.equal(result.checks.length, 5);
});

test("une solution basée sur onclick fonctionne", () => {
  assert.equal(validateLevel3(ONCLICK).valid, true);
});

test("une solution avec une variable compteur fonctionne", () => {
  assert.equal(validateLevel3(VARIABLE_COUNTER).valid, true);
});

test("un listener DOMContentLoaded est exécuté", () => {
  const code = `
    document.addEventListener("DOMContentLoaded", () => {
      const b = document.getElementById("btn");
      const c = document.getElementById("count");
      b.addEventListener("click", () => { c.textContent = Number(c.textContent) + 1; });
    });
  `;
  assert.equal(validateLevel3(code).valid, true);
});

test("window.onload est exécuté", () => {
  const code = `
    window.onload = function () {
      document.getElementById("btn").addEventListener("click", () => {
        const c = document.getElementById("count");
        c.textContent = Number(c.textContent) + 1;
      });
    };
  `;
  assert.equal(validateLevel3(code).valid, true);
});

test("un script vide ne change pas le compteur", () => {
  const result = validateLevel3("// rien");
  assert.equal(result.valid, false);
  assert.ok(
    result.checks.some(
      (check) => check.id === "click-1" && !check.passed,
    ),
  );
});

test("incrémenter de 2 échoue", () => {
  const result = validateLevel3(`
    document.getElementById("btn").addEventListener("click", () => {
      const c = document.getElementById("count");
      c.textContent = Number(c.textContent) + 2;
    });
  `);
  assert.equal(result.valid, false);
});

test("un compteur qui ne démarre pas à 0 échoue", () => {
  const result = validateLevel3(`
    const c = document.getElementById("count");
    c.textContent = "5";
    document.getElementById("btn").addEventListener("click", () => {
      c.textContent = Number(c.textContent) + 1;
    });
  `);
  assert.equal(result.valid, false);
  assert.ok(
    result.checks.some(
      (check) => check.id === "initial-value" && !check.passed,
    ),
  );
});

test("une erreur de syntaxe est signalée sans faire planter l'API", () => {
  const result = validateLevel3("const x = ;");
  assert.equal(result.valid, false);
  assert.match(result.feedback, /syntaxe/i);
});

test("une boucle infinie est coupée par le timeout", () => {
  const result = validateLevel3("while (true) {}");
  assert.equal(result.valid, false);
  assert.match(result.feedback, /Temps d'exécution/i);
});
