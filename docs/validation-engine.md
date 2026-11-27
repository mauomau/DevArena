# Moteur de validation & scoring

Ce module valide le code d'un joueur **côté serveur** et calcule les points du
niveau.I est consommé
via `POST /api/validate` et par le leaderboard via les helpers de classement.

## Fichiers

```text
src/
├── lib/
│   ├── levels.ts                  # Données PUBLIQUES des 5 niveaux (sans solutions)
│   ├── scoring.ts                 # Calcul des points, bonus, pénalité, classement
│   ├── game/
│   │   ├── config.ts              # Barème, durées, couleurs ESGIS, limites
│   │   └── contracts.ts           # Types requête/réponse de l'API
│   └── validation/
│       ├── engine.ts              # Point d'entrée validateLevel()
│       ├── level1.ts ... level5.ts# Règles et tests cachés par niveau
│       ├── html.ts / css.ts       # Parseurs HTML/CSS sans dépendance
│       └── sandbox.ts             # Exécution JS isolée (node:vm) + mini-DOM
└── app/api/validate/route.ts      # POST /api/validate
```

## Niveaux

| Niveau | Vérification automatique |
| :--- | :--- |
| 1. HTML | présence d'un `<h1>` dont le texte visible vaut exactement `Hello ESGIS` |
| 2. CSS | `#cta` : fond `#0B6E4F`, texte blanc, padding ≥ 12px, rayon ≥ 8px, gras |
| 3. JS DOM | clics successifs sur `#btn` → `#count` affiche 1, 2 puis 3 |
| 4. Debug | `compterVoyelles` passe 6 tests cachés (casse + dernière lettre) |
| 5. Algo | `estPalindrome` passe 7 tests cachés (espaces + casse) |

Les énoncés, codes de départ et indices sont dans `src/lib/levels.ts`. Les
solutions n'y figurent jamais : elles restent dans `src/lib/validation/`.

## API

### `POST /api/validate`

Runtime Node.js obligatoire (`node:vm`).

```json
{
  "sessionId": "…",
  "sessionToken": "…",
  "levelId": 1,
  "code": "<h1>Hello ESGIS</h1>",
  "hintUsed": false,
  "skipped": false
}
```

Réponse `200` :

```json
{
  "levelId": 1,
  "valid": true,
  "skipped": false,
  "pointsAwarded": 164,
  "breakdown": {
    "basePoints": 100,
    "speedBonus": 64,
    "hintPenalty": 0,
    "totalPoints": 164
  },
  "feedback": "Niveau 1 validé : le titre s'affiche correctement.",
  "checks": [
    {
      "id": "title",
      "label": "Un titre <h1> affichant exactement « Hello ESGIS »",
      "passed": true,
      "detail": "Titre détecté : « Hello ESGIS »"
    }
  ],
  "nextLevel": 2,
  "totalScore": 164,
  "levelsValidated": 1,
  "totalTimeSeconds": 13,
  "remainingSeconds": 32,
  "nextLevelStartedAt": "2026-11-27T00:00:14.800Z",
  "serverNow": "2026-11-27T00:00:13.000Z",
  "finished": false
}
```

- `valid: false` → 0 point, `nextLevel: null` : le joueur peut réessayer.
- `skipped: true` → 0 point, `nextLevel` avance.
- `nextLevel: null` en cas d'échec, ou après le niveau 5 (`finished: true`).
- `400` pour une requête mal formée, un niveau inconnu, un code trop long
  (> 20 000 caractères), un temps écoulé hors tolérance ou un « Passer » demandé
  avant 30 s écoulées.
- `401` si `sessionId` ou `sessionToken` est manquant ou invalide.
- `409` si le niveau est déjà validé (idempotence) ou hors ordre.
- `429` si le rate limit est dépassé.
- `500` réservé aux erreurs internes inattendues.

## Règles de score

```text
points = points_de_base
       + 2 × secondes_restantes (arrondies à l'entier inférieur)
       - 30 si indice utilisé
       (minimum 0)

niveau passé = 0 point, quelles que soient les options
```

| Niveau | Base | Chrono | Bonus max | Total max |
| :--- | :---: | :---: | :---: | :---: |
| 1 | 100 | 45 s | 90 | 190 |
| 2 | 150 | 75 s | 150 | 300 |
| 3 | 200 | 90 s | 180 | 380 |
| 4 | 250 | 75 s | 150 | 400 |
| 5 | 300 | 120 s | 240 | 540 |
| **Total** | **1000** | **405 s** | **810** | **1810** |

Le classement se fait avec `rankPlayers()` / `comparePlayers()` : score
décroissant, puis `totalTimeSeconds` croissant, puis pseudo. Le plafond SQL
`score <= 2000` du README reste respecté.

## Intégration côté équipe

**Écran joueur (`/play`)** :

1. Créer la session via `POST /api/sessions` puis afficher `level.statement`,
   `level.starterCode` et `level.hint`.
2. Au clic « Afficher un indice », appeler `POST /api/sessions/hint` pour
   enregistrer la pénalité de 30 pts côté serveur.
3. Au clic « Valider », appeler `POST /api/validate` avec `sessionId` et
   `sessionToken` (le serveur calcule le temps restant depuis `started_at`).
4. Afficher `feedback` + `checks` ; n'avancer que si `valid` ou `skipped`.
5. En fin de partie, appeler `POST /api/scores` avec `sessionId` et
   `sessionToken`.

**Base de données & déploiement (pôle 4)** :

- Écrire les sessions et scores avec la clé `SUPABASE_SERVICE_ROLE_KEY`, jamais
  depuis le navigateur.
- **Idempotence** : `session_level_results` porte une contrainte unique
  `(session_id, level_id)` et un verrou atomique sur `completed_at IS NULL`
  refuse (`409`) toute seconde validation du même niveau.
- L'écriture du classement passe par la fonction SQL atomique
  `upsert_best_score()` sans troncature à 500 lignes.

**Sécurité du chrono** :

`remainingSeconds` est recalculé côté serveur à partir de l'horodatage de début
du niveau (`session_level_results.started_at`) et passé à
`computeLevelScore()`. Une tolérance réseau de 2 secondes est appliquée en fin
de chrono (avec bonus rapidité nul).

## Sécurité de la sandbox

- Le code joueur n'a accès ni à `require`, ni à `process`, ni au système de
  fichiers. `new Function` / `eval` sont désactivés (`codeGeneration`).
- Chaque test dispose d'un timeout de 500 ms et la taille du code est limitée.
- `node:vm` **n'est pas une frontière de sécurité parfaite**. `/api/validate`
  est protégé par un rate limiting ; pour un événement public à fort trafic,
  exécuter idéalement la validation dans un worker/conteneur séparé
  (`isolated-vm`, service dédié).
- Le mini-DOM du niveau 3 est volontairement limité au contrat de l'énoncé
  (`getElementById`, `querySelector`, `addEventListener`, `onclick`,
  `textContent`, `innerText`, `innerHTML`, `DOMContentLoaded`). Il ne remplace
  pas un navigateur : les solutions qui reposent sur du CSS ou des timers
  asynchrones ne sont pas garanties.

## Tests

```bash
npm install
npm test          # 101 tests : scoring, 5 niveaux, sessions, PIN, rate limit, API
npm run typecheck
```

Les tests vérifient notamment que **les codes de départ ne valident jamais leur
niveau** et que les corrigés partiels échouent.
