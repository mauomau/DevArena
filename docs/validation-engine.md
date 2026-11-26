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
  "levelId": 1,
  "code": "<h1>Hello ESGIS</h1>",
  "remainingSeconds": 32,
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
  "nextLevel": 2
}
```

- `valid: false` → 0 point, `nextLevel: null` : le joueur peut réessayer.
- `skipped: true` → 0 point, `nextLevel` avance.
- `nextLevel: null` en cas d'échec, ou après le niveau 5.
- `400` pour une requête mal formée, un niveau inconnu, un code trop long
  (> 20 000 caractères) ou un « Passer » demandé avant 30 s écoulées.
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
| 2 | 150 | 60 s | 120 | 270 |
| 3 | 200 | 90 s | 180 | 380 |
| 4 | 250 | 90 s | 180 | 430 |
| 5 | 300 | 120 s | 240 | 540 |
| **Total** | **1000** | **405 s** | **810** | **1810** |

Le classement se fait avec `rankPlayers()` / `comparePlayers()` : score
décroissant, puis `totalTimeSeconds` croissant, puis pseudo. Le plafond SQL
`score <= 2000` du README reste respecté.

## Intégration côté équipe

**Écran joueur (`/play`)** :

1. Afficher `level.statement`, `level.starterCode` et `level.hint`.
2. Au clic « Valider », appeler `/api/validate` avec `remainingSeconds`.
3. Afficher `feedback` + `checks` ; n'avancer que si `valid` ou `skipped`.
4. En cas de `hintUsed`, prévenir que 30 points seront retirés.

**Base de données & déploiement (pôle 4)** :

- Écrire le score avec la clé `SUPABASE_SERVICE_ROLE_KEY`, jamais depuis le
  navigateur.
- **Idempotence** : un même niveau ne doit être crédité qu'une seule fois par
  session. Ajoutez une contrainte unique `(session_id, level_id)` (ou une table
  de complétion) et refusez une seconde validation du même niveau, sinon un
  double-clic peut doubler les points.
- Mettre à jour `current_level` avec `nextLevel` et `total_time_seconds` avec
  le temps réellement passé.

**Sécurité du chrono** :

`remainingSeconds` est aujourd'hui fourni par le client. C'est acceptable pour
la démo, mais un joueur pourrait l'augmenter pour gagner le bonus maximal.
Avant la mise en production, stocker l'heure de début du niveau dans Supabase
et recalculer côté serveur :

```ts
const elapsed = (Date.now() - new Date(attempt.started_at).getTime()) / 1000;
const remainingSeconds = Math.max(0, level.durationSeconds - elapsed);
```

puis passer cette valeur à `computeLevelScore()`.

## Sécurité de la sandbox

- Le code joueur n'a accès ni à `require`, ni à `process`, ni au système de
  fichiers. `new Function` / `eval` sont désactivés (`codeGeneration`).
- Chaque test dispose d'un timeout de 500 ms et la taille du code est limitée.
- `node:vm` **n'est pas une frontière de sécurité parfaite**. Pour un événement
  public à fort trafic : rate-limit sur `/api/validate`, et idéalement exécuter
  la validation dans un worker/conteneur séparé (`isolated-vm`, service dédié).
- Le mini-DOM du niveau 3 est volontairement limité au contrat de l'énoncé
  (`getElementById`, `querySelector`, `addEventListener`, `onclick`,
  `textContent`, `innerText`, `innerHTML`, `DOMContentLoaded`). Il ne remplace
  pas un navigateur : les solutions qui reposent sur du CSS ou des timers
  asynchrones ne sont pas garanties.

## Tests

```bash
npm install
npm test          # 73 tests : scoring, 5 niveaux, cas limites, API
npm run typecheck
```

Les tests vérifient notamment que **les codes de départ ne valident jamais leur
niveau** et que les corrigés partiels échouent.
