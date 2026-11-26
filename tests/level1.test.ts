import assert from "node:assert/strict";
import { test } from "node:test";
import { validateLevel1 } from "../src/lib/validation/level1";

test("un h1 exact valide le niveau 1", () => {
  const result = validateLevel1("<h1>Hello ESGIS</h1>");
  assert.equal(result.valid, true);
  assert.equal(result.checks[0]?.passed, true);
});

test("les espaces, retours à la ligne et balises internes sont tolérés", () => {
  assert.equal(
    validateLevel1("<h1 class='titre'>\n  Hello   <span>ESGIS</span>\n</h1>")
      .valid,
    true,
  );
  assert.equal(
    validateLevel1("<h1>Hello&nbsp;ESGIS</h1>").valid,
    true,
  );
});

test("la casse est respectée", () => {
  assert.equal(validateLevel1("<h1>hello esgis</h1>").valid, false);
  assert.equal(validateLevel1("<h1>HELLO ESGIS</h1>").valid, false);
});

test("un h2 ne suffit pas", () => {
  const result = validateLevel1("<h2>Hello ESGIS</h2>");
  assert.equal(result.valid, false);
  assert.match(result.feedback, /<h1>/);
});

test("un h1 commenté ne valide pas", () => {
  const result = validateLevel1("<!-- <h1>Hello ESGIS</h1> -->");
  assert.equal(result.valid, false);
});

test("un h1 correct parmi plusieurs suffit", () => {
  assert.equal(
    validateLevel1(
      "<h1>Bienvenue</h1><h2>Club</h2><h1>Hello ESGIS</h1>",
    ).valid,
    true,
  );
});

test("un texte proche mais incorrect donne un retour précis", () => {
  const result = validateLevel1("<h1>Hello ESGIS !</h1>");
  assert.equal(result.valid, false);
  assert.match(result.feedback, /Hello ESGIS/);
});
