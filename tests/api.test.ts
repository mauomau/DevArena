import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../src/app/api/validate/route";
import type { ValidateResponse } from "../src/lib/game/contracts";

function call(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/validate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

test("un niveau 1 correct renvoie les points et le niveau suivant", async () => {
  const response = await call({
    levelId: 1,
    code: "<h1>Hello ESGIS</h1>",
    remainingSeconds: 30,
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as ValidateResponse;
  assert.equal(body.valid, true);
  assert.equal(body.skipped, false);
  assert.equal(body.pointsAwarded, 160);
  assert.deepEqual(body.breakdown, {
    basePoints: 100,
    speedBonus: 60,
    hintPenalty: 0,
    totalPoints: 160,
  });
  assert.equal(body.nextLevel, 2);
});

test("un code incorrect renvoie 0 point et permet de réessayer", async () => {
  const response = await call({
    levelId: 1,
    code: "<h1>hello esgis</h1>",
    remainingSeconds: 30,
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as ValidateResponse;
  assert.equal(body.valid, false);
  assert.equal(body.pointsAwarded, 0);
  assert.equal(body.nextLevel, null);
  assert.ok(body.checks.length > 0);
});

test("l'indice applique la pénalité de 30 points", async () => {
  const response = await call({
    levelId: 2,
    code: `#cta { background-color: #0B6E4F; color: #fff; padding: 12px; border-radius: 8px; font-weight: bold; }`,
    remainingSeconds: 60,
    hintUsed: true,
  });

  const body = (await response.json()) as ValidateResponse;
  assert.equal(body.valid, true);
  assert.equal(body.breakdown.basePoints, 150);
  assert.equal(body.breakdown.speedBonus, 120);
  assert.equal(body.breakdown.hintPenalty, 30);
  assert.equal(body.pointsAwarded, 240);
});

test("le niveau 5 terminé n'a pas de niveau suivant", async () => {
  const response = await call({
    levelId: 5,
    code: `
      function estPalindrome(texte) {
        const propre = texte.toLowerCase().replaceAll(" ", "");
        return propre === [...propre].reverse().join("");
      }
    `,
    remainingSeconds: 10,
  });

  const body = (await response.json()) as ValidateResponse;
  assert.equal(body.valid, true);
  assert.equal(body.nextLevel, null);
  assert.equal(body.pointsAwarded, 320);
});

test("passer un niveau avant 30 secondes est refusé", async () => {
  const response = await call({
    levelId: 1,
    code: "",
    remainingSeconds: 30,
    skipped: true,
  });

  assert.equal(response.status, 400);
});

test("passer un niveau après 30 secondes rapporte 0 point", async () => {
  const response = await call({
    levelId: 1,
    code: "",
    remainingSeconds: 10,
    skipped: true,
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as ValidateResponse;
  assert.equal(body.valid, false);
  assert.equal(body.skipped, true);
  assert.equal(body.pointsAwarded, 0);
  assert.equal(body.nextLevel, 2);
});

test("un identifiant de niveau invalide renvoie 400", async () => {
  const response = await call({
    levelId: 6,
    code: "<h1>Hello ESGIS</h1>",
    remainingSeconds: 10,
  });
  assert.equal(response.status, 400);
});

test("un temps restant négatif renvoie 400", async () => {
  const response = await call({
    levelId: 1,
    code: "<h1>Hello ESGIS</h1>",
    remainingSeconds: -1,
  });
  assert.equal(response.status, 400);
});

test("un JSON invalide renvoie 400", async () => {
  const response = await POST(
    new Request("http://localhost/api/validate", {
      method: "POST",
      body: "{ceci n'est pas du json",
    }),
  );
  assert.equal(response.status, 400);
});

test("un code trop long est refusé avant la sandbox", async () => {
  const response = await call({
    levelId: 1,
    code: "a".repeat(25_000),
    remainingSeconds: 10,
  });
  assert.equal(response.status, 400);
});
