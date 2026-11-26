import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canSkip,
  comparePlayers,
  computeLevelScore,
  MAX_TOTAL_SCORE,
  rankPlayers,
} from "../src/lib/scoring";

test("niveau 1 : base + bonus avec chrono plein", () => {
  assert.deepEqual(computeLevelScore(1, { remainingSeconds: 45 }), {
    basePoints: 100,
    speedBonus: 90,
    hintPenalty: 0,
    totalPoints: 190,
  });
});

test("le bonus de rapidité vaut 2 points par seconde restante", () => {
  assert.equal(
    computeLevelScore(5, { remainingSeconds: 30 }).totalPoints,
    300 + 60,
  );
});

test("les secondes sont arrondies vers le bas", () => {
  assert.deepEqual(computeLevelScore(2, { remainingSeconds: 32.9 }), {
    basePoints: 150,
    speedBonus: 64,
    hintPenalty: 0,
    totalPoints: 214,
  });
});

test("un indice retire 30 points une seule fois", () => {
  assert.deepEqual(
    computeLevelScore(1, { remainingSeconds: 45, hintUsed: true }),
    {
      basePoints: 100,
      speedBonus: 90,
      hintPenalty: 30,
      totalPoints: 160,
    },
  );
});

test("le score d'un niveau ne descend jamais sous zéro", () => {
  assert.equal(
    computeLevelScore(1, { remainingSeconds: 0, hintUsed: true }).totalPoints,
    70,
  );
});

test("un niveau passé rapporte toujours 0 point", () => {
  assert.deepEqual(
    computeLevelScore(5, {
      remainingSeconds: 120,
      hintUsed: true,
      skipped: true,
    }),
    {
      basePoints: 0,
      speedBonus: 0,
      hintPenalty: 0,
      totalPoints: 0,
    },
  );
});

test("le temps restant est borné à la durée du niveau", () => {
  assert.equal(
    computeLevelScore(1, { remainingSeconds: 999 }).totalPoints,
    190,
  );
  assert.equal(
    computeLevelScore(1, { remainingSeconds: -12 }).totalPoints,
    100,
  );
});

test("un temps restant non fini est refusé", () => {
  assert.throws(
    () => computeLevelScore(1, { remainingSeconds: Number.NaN }),
    RangeError,
  );
  assert.throws(
    () => computeLevelScore(1, { remainingSeconds: Infinity }),
    RangeError,
  );
});

test("le score maximal théorique est de 1810 points", () => {
  assert.equal(MAX_TOTAL_SCORE, 1810);
  assert.ok(MAX_TOTAL_SCORE <= 2000);
});

test("le bouton Passer se débloque après 30 secondes écoulées", () => {
  const level3Duration = 90;
  assert.equal(canSkip(3, level3Duration - 29), false);
  assert.equal(canSkip(3, level3Duration - 30), true);
  assert.equal(canSkip(3, 0), true);
});

test("le classement départage par score puis temps total", () => {
  const players = [
    { pseudo: "Amina", score: 200, totalTimeSeconds: 100 },
    { pseudo: "Boris", score: 300, totalTimeSeconds: 150 },
    { pseudo: "Chloé", score: 300, totalTimeSeconds: 120 },
    { pseudo: "David", score: 300, totalTimeSeconds: 120 },
  ];

  assert.deepEqual(
    rankPlayers(players).map((player) => player.pseudo),
    ["Chloé", "David", "Boris", "Amina"],
  );
});

test("comparePlayers ne modifie pas les entrées", () => {
  const a = { pseudo: "A", score: 10, totalTimeSeconds: 20 };
  const b = { pseudo: "B", score: 20, totalTimeSeconds: 10 };
  assert.equal(comparePlayers(a, b) > 0, true);
  assert.equal(a.score, 10);
  assert.equal(b.score, 20);
});
