import assert from "node:assert/strict";
import { test } from "node:test";
import { GAME_CONFIG } from "../src/lib/game/config";
import {
  getLevel,
  isLevelId,
  LEVEL_IDS,
  LEVELS,
  TOTAL_BASE_POINTS,
} from "../src/lib/levels";
import { MAX_TOTAL_SCORE } from "../src/lib/scoring";
import { validateLevel } from "../src/lib/validation/engine";

test("les 5 niveaux sont définis dans l'ordre", () => {
  assert.deepEqual(
    LEVELS.map((level) => level.id),
    [...LEVEL_IDS],
  );
  assert.equal(TOTAL_BASE_POINTS, 1000);
  assert.equal(
    LEVELS.reduce((total, level) => total + level.durationSeconds, 0),
    405,
  );
});

test("chaque niveau expose un énoncé, un indice et un code de départ", () => {
  for (const level of LEVELS) {
    assert.ok(level.statement.length > 20, `énoncé du niveau ${level.id}`);
    assert.ok(level.hint.length > 0, `indice du niveau ${level.id}`);
    assert.ok(level.starterCode.length > 0, `code de départ ${level.id}`);
  }
});

test("TOTAL_BASE_POINTS et MAX_TOTAL_SCORE sont cohérents", () => {
  assert.equal(MAX_TOTAL_SCORE, 1810);
  assert.ok(MAX_TOTAL_SCORE <= GAME_CONFIG.maxScore);
});

test("les codes de départ ne valident jamais leur niveau", () => {
  for (const level of LEVELS) {
    const result = validateLevel(level.id, level.starterCode);
    assert.equal(
      result.valid,
      false,
      `le code de départ du niveau ${level.id} ne doit pas valider`,
    );
  }
});

test("un code vide est refusé avec un message clair", () => {
  const result = validateLevel(1, "   \n  ");
  assert.equal(result.valid, false);
  assert.match(result.feedback, /vide/i);
});

test("un code trop long est refusé", () => {
  const result = validateLevel(
    1,
    "a".repeat(GAME_CONFIG.maxCodeLength + 1),
  );
  assert.equal(result.valid, false);
  assert.match(result.feedback, /trop long/i);
});

test("getLevel et isLevelId protègent les identifiants", () => {
  assert.equal(getLevel(1).title, "Le Déclic");
  assert.throws(() => getLevel(6 as never), RangeError);
  assert.equal(isLevelId(1), true);
  assert.equal(isLevelId(0), false);
  assert.equal(isLevelId("1"), false);
});
