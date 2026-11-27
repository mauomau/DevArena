import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { POST as createSessionPost } from "../src/app/api/sessions/route";
import { POST as revealHintPost } from "../src/app/api/sessions/hint/route";
import { POST as startLevelPost } from "../src/app/api/sessions/start-level/route";
import { POST as validatePost } from "../src/app/api/validate/route";
import { GAME_CONFIG } from "../src/lib/game/config";
import type {
  CreateSessionResponse,
  ValidateResponse,
} from "../src/lib/game/contracts";
import { resetRateLimitsForTests } from "../src/lib/server/rateLimit";
import {
  resetMemorySessionsForTests,
  shiftMemorySessionTimeForTests,
} from "../src/lib/server/sessionStore";

// Force le store mémoire : les tests ne doivent jamais toucher un vrai Supabase.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const VALID_SOLUTIONS: Record<number, string> = {
  1: "<h1>Hello ESGIS</h1>",
  2: "#cta { background-color: #0B6E4F; color: #fff; padding: 12px; border-radius: 8px; font-weight: bold; }",
  3: 'document.getElementById("btn").addEventListener("click", () => { const c = document.getElementById("count"); c.textContent = Number(c.textContent) + 1; });',
  4: 'function compterVoyelles(texte) { const v = "aeiouy"; let total = 0; for (let i = 0; i < texte.length; i++) { if (v.includes(texte[i].toLowerCase())) total += 1; } return total; }',
  5: 'function estPalindrome(texte) { const p = texte.toLowerCase().replaceAll(" ", ""); return p === [...p].reverse().join(""); }',
};

async function startSession(
  pseudo = "JoueurApi",
  filiere = "IRT",
  niveau = "L2",
  pin = "2026",
): Promise<CreateSessionResponse> {
  const res = await createSessionPost(
    new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pseudo, filiere, niveau, pin }),
    }),
  );
  assert.equal(res.status, 201);
  return (await res.json()) as CreateSessionResponse;
}

function callValidate(body: unknown, ip = "10.0.0.1"): Promise<Response> {
  return validatePost(
    new Request("http://localhost/api/validate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  resetMemorySessionsForTests();
  resetRateLimitsForTests();
});

const READING_MS = GAME_CONFIG.readingWindowSeconds * 1000;

test("un niveau 1 correct renvoie les points calculés par le serveur et le niveau suivant", async () => {
  const session = await startSession();
  // Simule 12s de lecture + 15s de code (il reste ~30 secondes sur 45)
  shiftMemorySessionTimeForTests(session.sessionId, READING_MS + 15_000);

  const response = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 1,
    code: VALID_SOLUTIONS[1],
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as ValidateResponse;
  assert.equal(body.valid, true);
  assert.equal(body.skipped, false);
  assert.ok(body.breakdown.basePoints === 100);
  assert.ok(body.breakdown.speedBonus >= 58 && body.breakdown.speedBonus <= 60);
  assert.equal(body.pointsAwarded, body.totalScore);
  assert.equal(body.levelsValidated, 1);
  assert.equal(body.nextLevel, 2);
  assert.equal(body.finished, false);
  assert.ok(body.nextLevelStartedAt);
  assert.ok(body.nextLevelTimerStartedAt);
});

test("le chrono reste en pause pendant la lecture et démarre immédiatement avec /api/sessions/start-level", async () => {
  const session = await startSession();
  // Après 8s de lecture (< 12s), le chrono n'a pas encore commencé
  shiftMemorySessionTimeForTests(session.sessionId, 8_000);

  const startNowRes = await startLevelPost(
    new Request("http://localhost/api/sessions/start-level", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        sessionToken: session.sessionToken,
        levelId: 1,
      }),
    }),
  );
  assert.equal(startNowRes.status, 200);

  // Maintenant 20s s'écoulent : seulement 20s consommées sur 45 -> 25s restantes
  shiftMemorySessionTimeForTests(session.sessionId, 20_000);
  const res = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 1,
    code: VALID_SOLUTIONS[1],
  });
  const body = (await res.json()) as ValidateResponse;
  assert.equal(body.valid, true);
  assert.ok(body.breakdown.speedBonus >= 48 && body.breakdown.speedBonus <= 50);
});

test("le client ne peut pas manipuler le temps restant ni le score", async () => {
  const session = await startSession();
  shiftMemorySessionTimeForTests(session.sessionId, READING_MS + 40_000);

  const response = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 1,
    code: VALID_SOLUTIONS[1],
    remainingSeconds: 999,
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as ValidateResponse;
  assert.equal(body.valid, true);
  // 45 - 40 = 5s restantes -> bonus <= 10 pts (jamais 999 * 2)
  assert.ok(body.breakdown.speedBonus <= 10);
});

test("un code incorrect renvoie 0 point et permet de réessayer", async () => {
  const session = await startSession();
  const response = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 1,
    code: "<h1>hello esgis</h1>",
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as ValidateResponse;
  assert.equal(body.valid, false);
  assert.equal(body.pointsAwarded, 0);
  assert.equal(body.nextLevel, null);
  assert.ok(body.checks.length > 0);
});

test("l'indice enregistré côté serveur applique la pénalité de 30 points même si hintUsed=false est envoyé", async () => {
  const session = await startSession();
  await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 1,
    code: VALID_SOLUTIONS[1],
  });

  const hintRes = await revealHintPost(
    new Request("http://localhost/api/sessions/hint", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        sessionToken: session.sessionToken,
        levelId: 2,
      }),
    }),
  );
  assert.equal(hintRes.status, 200);

  const response = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 2,
    code: VALID_SOLUTIONS[2],
    hintUsed: false,
  });

  const body = (await response.json()) as ValidateResponse;
  assert.equal(body.valid, true);
  assert.equal(body.breakdown.basePoints, 150);
  assert.equal(body.breakdown.hintPenalty, 30);
});

test("la validation d'un niveau dans le désordre ou en double est refusée (409)", async () => {
  const session = await startSession();

  const outOfOrder = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 2,
    code: VALID_SOLUTIONS[2],
  });
  assert.equal(outOfOrder.status, 409);

  const first = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 1,
    code: VALID_SOLUTIONS[1],
  });
  assert.equal(first.status, 200);

  const duplicate = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 1,
    code: VALID_SOLUTIONS[1],
  });
  assert.equal(duplicate.status, 409);
});

test("le niveau 5 terminé clôture la session", async () => {
  const session = await startSession();
  for (const levelId of [1, 2, 3, 4] as const) {
    const res = await callValidate({
      sessionId: session.sessionId,
      sessionToken: session.sessionToken,
      levelId,
      code: VALID_SOLUTIONS[levelId],
    });
    assert.equal(res.status, 200);
  }

  const res5 = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 5,
    code: VALID_SOLUTIONS[5],
  });

  assert.equal(res5.status, 200);
  const body = (await res5.json()) as ValidateResponse;
  assert.equal(body.valid, true);
  assert.equal(body.nextLevel, null);
  assert.equal(body.finished, true);
  assert.equal(body.levelsValidated, 5);
});

test("passer un niveau avant 30 secondes est refusé", async () => {
  const session = await startSession();
  const response = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 1,
    code: "",
    skipped: true,
  });

  assert.equal(response.status, 400);
});

test("passer un niveau après 30 secondes rapporte 0 point", async () => {
  const session = await startSession();
  shiftMemorySessionTimeForTests(session.sessionId, READING_MS + 35_000);

  const response = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 1,
    code: "",
    skipped: true,
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as ValidateResponse;
  assert.equal(body.valid, false);
  assert.equal(body.skipped, true);
  assert.equal(body.pointsAwarded, 0);
  assert.equal(body.nextLevel, 2);
});

test("une validation après expiration du chrono (hors grâce) est refusée", async () => {
  const session = await startSession();
  shiftMemorySessionTimeForTests(session.sessionId, READING_MS + 55_000);

  const response = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 1,
    code: VALID_SOLUTIONS[1],
  });

  assert.equal(response.status, 400);
});

test("une session sans jeton valide renvoie 401", async () => {
  const session = await startSession();

  const missingAuth = await callValidate({
    levelId: 1,
    code: VALID_SOLUTIONS[1],
  });
  assert.equal(missingAuth.status, 401);

  const wrongToken = await callValidate({
    sessionId: session.sessionId,
    sessionToken: "mauvais-jeton",
    levelId: 1,
    code: VALID_SOLUTIONS[1],
  });
  assert.equal(wrongToken.status, 401);
});

test("un identifiant de niveau invalide renvoie 400", async () => {
  const session = await startSession();
  const response = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 6,
    code: VALID_SOLUTIONS[1],
  });
  assert.equal(response.status, 400);
});

test("un JSON invalide renvoie 400", async () => {
  const response = await validatePost(
    new Request("http://localhost/api/validate", {
      method: "POST",
      body: "{ceci n'est pas du json",
    }),
  );
  assert.equal(response.status, 400);
});

test("un code trop long est refusé avant la sandbox", async () => {
  const session = await startSession();
  const response = await callValidate({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
    levelId: 1,
    code: "a".repeat(25_000),
  });
  assert.equal(response.status, 400);
});

test("le rate limiting bloque les rafales sur /api/validate (429)", async () => {
  const session = await startSession();

  let lastStatus = 200;
  for (let i = 0; i < 30; i += 1) {
    const res = await callValidate(
      {
        sessionId: session.sessionId,
        sessionToken: session.sessionToken,
        levelId: 1,
        code: "<h1>faux</h1>",
      },
      "192.0.2.99",
    );
    lastStatus = res.status;
    if (lastStatus === 429) {
      assert.ok(res.headers.get("Retry-After"));
      break;
    }
  }

  assert.equal(lastStatus, 429);
});

test("le code PIN protège le pseudo contre l'usurpation tout en autorisant le titulaire", async () => {
  await startSession("Achille_Dev", "IRT", "L2", "2026");

  const wrongPin = await createSessionPost(
    new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pseudo: "achille_dev",
        filiere: "IRT",
        niveau: "L2",
        pin: "9999",
      }),
    }),
  );
  assert.equal(wrongPin.status, 409);

  const samePin = await startSession("achille_dev", "IRT", "L2", "2026");
  assert.ok(samePin.sessionId);
  assert.equal(samePin.filiere, "IRT • L2");
});

test("un pseudo réservé (Admin, ESGIS, TEST) est refusé au démarrage", async () => {
  const res = await createSessionPost(
    new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pseudo: "Admin",
        filiere: "IRT",
        niveau: "L1",
        pin: "1234",
      }),
    }),
  );
  assert.equal(res.status, 400);
});
