import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import {
  DELETE as adminDeleteScores,
  GET as adminExportCsv,
} from "../src/app/api/admin/scores/route";
import { GET, POST } from "../src/app/api/scores/route";
import { POST as createSessionPost } from "../src/app/api/sessions/route";
import { POST as validatePost } from "../src/app/api/validate/route";
import { middleware } from "../src/middleware";
import type {
  CreateSessionResponse,
  LeaderboardResponse,
  SubmitScoreResponse,
  ValidateResponse,
} from "../src/lib/game/contracts";
import { resetRateLimitsForTests } from "../src/lib/server/rateLimit";
import { resetMemoryScoresForTests } from "../src/lib/server/scoreStore";
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

async function playFullSession(options: {
  pseudo: string;
  filiere?: string;
  niveau?: string;
  pin?: string;
  delayPerLevelMs?: number;
  skipAllAfter30s?: boolean;
}): Promise<{ session: CreateSessionResponse; expectedScore: number }> {
  const sessionRes = await createSessionPost(
    new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pseudo: options.pseudo,
        filiere: options.filiere ?? "IRT",
        niveau: options.niveau ?? "L2",
        pin: options.pin ?? "2026",
      }),
    }),
  );
  assert.equal(sessionRes.status, 201);
  const session = (await sessionRes.json()) as CreateSessionResponse;

  let expectedScore = 0;

  for (const levelId of [1, 2, 3, 4, 5] as const) {
    if (options.delayPerLevelMs) {
      shiftMemorySessionTimeForTests(session.sessionId, options.delayPerLevelMs);
    }
    const validateRes = await validatePost(
      new Request("http://localhost/api/validate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: session.sessionId,
          sessionToken: session.sessionToken,
          levelId,
          code: options.skipAllAfter30s ? "" : VALID_SOLUTIONS[levelId],
          skipped: Boolean(options.skipAllAfter30s),
        }),
      }),
    );
    assert.equal(validateRes.status, 200);
    const body = (await validateRes.json()) as ValidateResponse;
    expectedScore = body.totalScore;
  }

  return { session, expectedScore };
}

function submitScore(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  resetMemoryScoresForTests();
  resetMemorySessionsForTests();
  resetRateLimitsForTests();
});

test("une session terminée est enregistrée et classée avec le score serveur", async () => {
  const { session, expectedScore } = await playFullSession({
    pseudo: "Achille_Dev",
  });

  const response = await submitScore({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
  });
  assert.equal(response.status, 200);

  const body = (await response.json()) as SubmitScoreResponse;
  assert.equal(body.entry.pseudo, "Achille_Dev");
  assert.equal(body.entry.score, expectedScore);
  assert.ok(expectedScore >= 1800 && expectedScore <= 1810);
  assert.equal(body.entry.currentLevel, 5);
  assert.equal(body.improved, true);
  assert.equal(body.source, "memory");
  assert.equal(body.rank, 1);
  assert.equal(body.totalPlayers, 1);
});

test("GET renvoie le classement et le mode de stockage", async () => {
  const { session, expectedScore } = await playFullSession({
    pseudo: "Achille_Dev",
  });
  await submitScore({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
  });

  const response = await GET(new Request("http://localhost/api/scores"));
  assert.equal(response.status, 200);

  const body = (await response.json()) as LeaderboardResponse;
  assert.equal(body.source, "memory");
  assert.equal(body.realtime, false);

  const player = body.entries.find((entry) => entry.pseudo === "Achille_Dev");
  assert.ok(player);
  assert.equal(player.score, expectedScore);
});

test("un moins bon score ne remplace pas la meilleure performance et dédoublonne sans casse", async () => {
  const { session: fastSession, expectedScore } = await playFullSession({
    pseudo: "Achille_Dev",
  });
  await submitScore({
    sessionId: fastSession.sessionId,
    sessionToken: fastSession.sessionToken,
  });

  const { session: slowSession } = await playFullSession({
    pseudo: "achille_dev",
    delayPerLevelMs: 47_000,
    skipAllAfter30s: true,
  });
  const response = await submitScore({
    sessionId: slowSession.sessionId,
    sessionToken: slowSession.sessionToken,
  });
  const body = (await response.json()) as SubmitScoreResponse;

  assert.equal(body.improved, false);
  assert.equal(body.entry.score, expectedScore);
  assert.equal(body.totalPlayers, 1);
});

test("un meilleur score remplace l'ancienne performance", async () => {
  const { session: slowSession } = await playFullSession({
    pseudo: "Achille_Dev",
    delayPerLevelMs: 47_000,
    skipAllAfter30s: true,
  });
  await submitScore({
    sessionId: slowSession.sessionId,
    sessionToken: slowSession.sessionToken,
  });

  const { session: fastSession, expectedScore } = await playFullSession({
    pseudo: "Achille_Dev",
  });
  const response = await submitScore({
    sessionId: fastSession.sessionId,
    sessionToken: fastSession.sessionToken,
  });
  const body = (await response.json()) as SubmitScoreResponse;

  assert.equal(body.improved, true);
  assert.equal(body.entry.score, expectedScore);
  assert.equal(body.entry.currentLevel, 5);
});

test("une session non terminée ne peut pas enregistrer de score", async () => {
  const sessionRes = await createSessionPost(
    new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pseudo: "Incomplet",
        filiere: "IRT",
        niveau: "L1",
        pin: "1234",
      }),
    }),
  );
  const session = (await sessionRes.json()) as CreateSessionResponse;

  const response = await submitScore({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
  });
  assert.equal(response.status, 400);
});

test("une soumission brute de score sans session est refusée (401)", async () => {
  const response = await submitScore({
    pseudo: "Tricheur",
    filiere: "IRT",
    score: 1810,
    currentLevel: 5,
    totalTimeSeconds: 1,
  });
  assert.equal(response.status, 401);
});

test("un pseudo invalide ou une filière inconnue est refusé au démarrage de session", async () => {
  const shortPseudo = await createSessionPost(
    new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pseudo: "x",
        filiere: "IRT",
        niveau: "L1",
        pin: "1234",
      }),
    }),
  );
  assert.equal(shortPseudo.status, 400);

  const badFiliere = await createSessionPost(
    new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pseudo: "Valide",
        filiere: "Hacker",
        niveau: "L1",
        pin: "1234",
      }),
    }),
  );
  assert.equal(badFiliere.status, 400);
});

test("un JSON invalide est refusé", async () => {
  const response = await POST(
    new Request("http://localhost/api/scores", {
      method: "POST",
      body: "{pas du json",
    }),
  );
  assert.equal(response.status, 400);
});

test("l'export CSV et la réinitialisation admin fonctionnent", async () => {
  const { session } = await playFullSession({ pseudo: "Achille_Dev" });
  await submitScore({
    sessionId: session.sessionId,
    sessionToken: session.sessionToken,
  });

  const csvRes = await adminExportCsv(
    new Request("http://localhost/api/admin/scores"),
  );
  assert.equal(csvRes.status, 200);
  const csvText = await csvRes.text();
  assert.ok(csvText.includes("Achille_Dev"));
  assert.ok(csvText.includes("IRT • L2"));

  const badReset = await adminDeleteScores(
    new Request("http://localhost/api/admin/scores", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: "NON" }),
    }),
  );
  assert.equal(badReset.status, 400);

  const okReset = await adminDeleteScores(
    new Request("http://localhost/api/admin/scores", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: "RESET_ALL_SCORES" }),
    }),
  );
  assert.equal(okReset.status, 200);

  const afterReset = await GET(new Request("http://localhost/api/scores"));
  const body = (await afterReset.json()) as LeaderboardResponse;
  assert.equal(body.entries.length, 0);
});

test("le middleware verrouille /play et POST /api/* tout en laissant GET /api/scores libre", () => {
  const prevSecret = process.env.STAND_SECRET_KEY;
  process.env.STAND_SECRET_KEY = "stand-test-secret";

  try {
    const blockedPlay = middleware(
      new NextRequest("https://devarena.vercel.app/play"),
    );
    assert.equal(blockedPlay.status, 403);

    const blockedPostScores = middleware(
      new NextRequest("https://devarena.vercel.app/api/scores", {
        method: "POST",
      }),
    );
    assert.equal(blockedPostScores.status, 403);

    const publicLeaderboardApi = middleware(
      new NextRequest("https://devarena.vercel.app/api/scores", {
        method: "GET",
      }),
    );
    assert.equal(publicLeaderboardApi.status, 200);

    const unlockRes = middleware(
      new NextRequest("https://devarena.vercel.app/play?key=stand-test-secret"),
    );
    assert.equal(unlockRes.status, 307);
    assert.equal(
      unlockRes.headers.get("location"),
      "https://devarena.vercel.app/play",
    );
    assert.equal(unlockRes.cookies.get("stand_auth")?.value, "stand-test-secret");
  } finally {
    if (prevSecret === undefined) {
      delete process.env.STAND_SECRET_KEY;
    } else {
      process.env.STAND_SECRET_KEY = prevSecret;
    }
  }
});
