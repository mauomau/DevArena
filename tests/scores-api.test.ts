import assert from "node:assert/strict";
import { test } from "node:test";
import { GET, POST } from "../src/app/api/scores/route";
import type {
  LeaderboardResponse,
  SubmitScoreResponse,
} from "../src/lib/game/contracts";

// Force le store mémoire : les tests ne doivent jamais toucher un vrai Supabase.
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const PSEUDO = `Test${Date.now().toString().slice(-8)}`;

function submit(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const baseSubmission = {
  pseudo: PSEUDO,
  filiere: "IRT",
  score: 500,
  currentLevel: 3,
  totalTimeSeconds: 120,
};

test("un score valide est enregistré et classé", async () => {
  const response = await submit(baseSubmission);
  assert.equal(response.status, 200);

  const body = (await response.json()) as SubmitScoreResponse;
  assert.equal(body.entry.pseudo, PSEUDO);
  assert.equal(body.entry.score, 500);
  assert.equal(body.entry.currentLevel, 3);
  assert.equal(body.entry.totalTimeSeconds, 120);
  assert.equal(body.improved, true);
  assert.equal(body.source, "memory");
  assert.ok(body.rank >= 1);
  assert.ok(body.totalPlayers >= 1);
});

test("GET renvoie le classement et le mode de stockage", async () => {
  const response = await GET();
  assert.equal(response.status, 200);

  const body = (await response.json()) as LeaderboardResponse;
  assert.equal(body.source, "memory");
  assert.equal(body.realtime, false);

  const player = body.entries.find((entry) => entry.pseudo === PSEUDO);
  assert.ok(player);
  assert.equal(player.score, 500);
});

test("un moins bon score ne remplace pas la meilleure performance", async () => {
  const response = await submit({ ...baseSubmission, score: 300 });
  const body = (await response.json()) as SubmitScoreResponse;

  assert.equal(body.improved, false);
  assert.equal(body.entry.score, 500);
});

test("un meilleur score remplace l'ancienne performance", async () => {
  const response = await submit({
    ...baseSubmission,
    score: 700,
    currentLevel: 5,
    totalTimeSeconds: 90,
  });
  const body = (await response.json()) as SubmitScoreResponse;

  assert.equal(body.improved, true);
  assert.equal(body.entry.score, 700);
  assert.equal(body.entry.currentLevel, 5);
  assert.equal(body.entry.totalTimeSeconds, 90);
});

test("le pseudo est dédoublonné sans tenir compte de la casse", async () => {
  const response = await submit({
    ...baseSubmission,
    pseudo: PSEUDO.toLowerCase(),
    score: 600,
  });
  const body = (await response.json()) as SubmitScoreResponse;

  assert.equal(body.improved, false);
  assert.equal(body.entry.score, 700);
  assert.equal(body.totalPlayers, 1);
});

test("un score hors bornes est refusé", async () => {
  const response = await submit({ ...baseSubmission, score: 9999 });
  assert.equal(response.status, 400);
});

test("un pseudo invalide est refusé", async () => {
  const response = await submit({ ...baseSubmission, pseudo: "x" });
  assert.equal(response.status, 400);
});

test("une filière inconnue est refusée", async () => {
  const response = await submit({ ...baseSubmission, filiere: "Hacker" });
  assert.equal(response.status, 400);
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
