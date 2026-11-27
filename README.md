# DevArena - Club Dev ESGIS Bénin

DevArena est une plateforme open-source de défis de programmation chronométrés
avec classement en temps réel. Conçue pour la journée de lancement des clubs de
l'ESGIS Bénin, elle permet aux étudiants de tester leurs compétences sur stand
pendant que les scores s'affichent en direct sur vidéoprojecteur.

## Fonctionnalités principales

- **Accueil (`/`)** : présentation du défi, du barème et QR code d'invitation au
  groupe WhatsApp du Club Dev.
- **Arène Joueur (`/play`)** : interface scindée avec consigne et chronomètre,
  éditeur de code intégré (coloration syntaxique) et prévisualisation en direct
  (`iframe` isolée).
- **5 Niveaux progressifs** : un parcours rapide (6 min 45 max) allant du HTML
  de base jusqu'à l'algorithmique.
- **Validation côté serveur** : vérification des réponses via une API Route
  Next.js pour empêcher la lecture des solutions dans le code client.
- **Projecteur Temps Réel (`/leaderboard`)** : tableau des scores optimisé pour
  grand écran, podium Top 3, design sombre et mise à jour instantanée via
  Supabase Realtime (avec sondage de secours).
- **Fin de partie** : score final, rang atteint, temps total et QR code vers le
  groupe WhatsApp du Club.

## Structure des niveaux et scoring

| Niveau | Thème | Chrono | Points de base | Objectif |
| :--- | :--- | :---: | :---: | :--- |
| 1. Le Déclic | HTML | 45s | 100 pts | Afficher un titre exact (`Hello ESGIS`). |
| 2. Le Styliste | CSS | 75s | 150 pts | Styliser un bouton aux couleurs de l'ESGIS. |
| 3. L'Interactif | JS (DOM) | 90s | 200 pts | Implémenter un bouton compteur (`+1` au clic). |
| 4. Bug Hunter | Debug | 75s | 250 pts | Corriger 2 erreurs cachées dans un script existant. |
| 5. Le Boss Final | Algo | 120s | 300 pts | Résoudre un mini-problème de logique pure. |

### Règles de calcul des points

- **Bonus de rapidité** : +2 pts par seconde restante au chronomètre lors de la
  validation.
- **Bouton Indice (Hint)** : -30 pts sur le niveau en cours.
- **Bouton Passer (Skip)** : disponible après 30s (0 pt attribué pour le niveau).
- **Départage** : en cas d'égalité de score, le joueur ayant réalisé le temps
  total le plus court est classé devant.
- **Score maximal théorique** : 1 810 pts (1 000 pts de base + 810 pts de bonus).

## Stack technique

- **Framework** : Next.js 16 (App Router) & TypeScript
- **Styling** : Tailwind CSS 4
- **Éditeur de code** : `@uiw/react-codemirror`
- **Base de données & Realtime** : Supabase (PostgreSQL + Realtime)
- **QR codes** : `qrcode.react`
- **Hébergement** : Vercel

## Architecture du projet

```text
devarena/
├── supabase/
│   └── schema.sql                # Tables scores/sessions, RPC atomique, RLS, Realtime
├── src/
│   ├── app/
│   │   ├── api/sessions/route.ts      # Création de session serveur
│   │   ├── api/sessions/hint/route.ts # Enregistrement serveur de l'indice
│   │   ├── api/validate/route.ts      # Validation sécurisée et calcul serveur
│   │   ├── api/scores/route.ts        # Lecture / écriture atomique du classement
│   │   ├── page.tsx                   # Accueil et présentation du défi
│   │   ├── play/page.tsx              # Arène de code (Éditeur + Preview + Chrono)
│   │   └── leaderboard/page.tsx       # Écran vidéoprojecteur temps réel
│   ├── components/
│   │   ├── CodeEditor.tsx        # Wrapper CodeMirror
│   │   ├── JoinQrCode.tsx        # QR code WhatsApp (client)
│   │   ├── LeaderboardScreen.tsx # Podium + classement + Realtime
│   │   ├── LivePreview.tsx       # Sandbox iframe
│   │   └── play/                 # Sous-composants de l'arène joueur
│   └── lib/
│       ├── levels.ts             # Énoncés et codes de départ publics
│       ├── scoring.ts            # Barème et classement
│       ├── supabase.ts           # Client public (Realtime navigateur)
│       ├── game/
│       │   ├── config.ts         # Barème, durées, club, WhatsApp
│       │   ├── contracts.ts      # Types des API
│       │   └── player.ts         # Validation identité/scores et dédoublonnage
│       ├── server/
│       │   ├── apiUtils.ts       # Helpers JSON, auth session et erreurs HTTP
│       │   ├── rateLimit.ts      # Limitation de débit (anti-abus)
│       │   ├── scoreStore.ts     # Persistance Supabase (RPC atomique) + fallback mémoire
│       │   ├── sessionStore.ts   # Sessions, chrono par horodatage et idempotence
│       │   └── supabaseAdmin.ts  # Client service role (serveur uniquement)
│       └── validation/           # Moteur de validation des 5 niveaux
├── tests/                        # Tests Node (barème, niveaux, sessions, API)
└── .env.example                  # Modèle des variables d'environnement
```

> **Moteur de validation (pôle 2)** : les règles de correction, le calcul des
> points et les tests cachés sont documentés dans
> [`docs/validation-engine.md`](docs/validation-engine.md). Lancer `npm test`
> pour vérifier les 5 niveaux et le barème.

## Installation en local

### 1. Cloner le dépôt et installer les dépendances

```bash
git clone git@github.com:mauomau/DevArena.git
cd DevArena
npm install
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-publique-anon
SUPABASE_SERVICE_ROLE_KEY=votre-cle-secrete-service-role
NEXT_PUBLIC_WHATSAPP_GROUP_URL=https://chat.whatsapp.com/votre-lien
```

- `NEXT_PUBLIC_*` est exposé au navigateur (URL Supabase, clé anon, lien
  WhatsApp).
- `SUPABASE_SERVICE_ROLE_KEY` reste **strictement côté serveur**. Elle permet à
  l'API d'écrire dans la table tout en gardant la base en lecture seule pour les
  clients.

### 3. Configurer la base de données Supabase

Ouvre **Supabase > SQL Editor**, colle le contenu de
[`supabase/schema.sql`](supabase/schema.sql) puis exécute-le. Le script crée les
tables `scores`, `game_sessions` et `session_level_results`, la fonction RPC
atomique `upsert_best_score`, active la RLS et ajoute `scores` à la publication
Realtime.

### 4. Lancer le serveur de développement

```bash
npm run dev
```

- `http://localhost:3000` : accueil
- `http://localhost:3000/play` : arène joueur
- `http://localhost:3000/leaderboard` : écran projecteur

### 5. Vérifier le projet

```bash
npm test        # 101 tests (niveaux, barème, sessions, PIN, admin, API)
npm run typecheck
npm run lint
npm run build
```

## Mode démo sans Supabase

Si les variables Supabase ne sont pas définies, l'application reste
entièrement fonctionnelle en local : les sessions et les scores sont stockés en
mémoire côté serveur et le leaderboard se rafraîchit par sondage toutes les 5
secondes.

/!\ Ce mode n'est **pas persistant** : il est remis à zéro à chaque redémarrage
du serveur et ne fonctionne pas sur Vercel (instances serverless). Il sert
uniquement aux démos et aux tests. Pour l'événement, configure Supabase.

## API

### `POST /api/sessions`

Démarre une session côté serveur et initialise l'horodatage du niveau 1 :

```json
{
  "pseudo": "Achille_Dev",
  "filiere": "IRT",
  "niveau": "L2",
  "pin": "2026"
}
```

Réponse `201` : `{ sessionId, sessionToken, pseudo, filiere, niveau, currentLevel, startedAt, levelStartedAt, levelDurationSeconds, serverNow }`.

### `GET / DELETE /api/admin/scores`

Routes réservées aux PC du stand (`stand_auth` / `x-stand-key`) :
- `GET /api/admin/scores` : exporte le classement au format CSV (`devarena-scores-YYYY-MM-DD.csv`).
- `DELETE /api/admin/scores` avec `{ "confirm": "RESET_ALL_SCORES" }` : vide les scores, sessions et PIN de test avant l'événement.

### `POST /api/sessions/start-level`

Démarre immédiatement le chrono du niveau actif (avant l'expiration de la
fenêtre de lecture de 12 s).

### `POST /api/sessions/hint`

Enregistre côté serveur le déblocage de l'indice sur le niveau actif (pénalité
de 30 pts garantie même si le client modifie la requête de validation) :

```json
{
  "sessionId": "…",
  "sessionToken": "…",
  "levelId": 2
}
```

### `POST /api/validate`

Valide le code d'un joueur au sein d'une session authentifiée et calcule les
points du niveau à partir de l'horodatage serveur :

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

La réponse contient `valid`, `pointsAwarded`, le détail `breakdown`, les
`checks`, `nextLevel`, ainsi que l'état serveur (`totalScore`,
`levelsValidated`, `totalTimeSeconds`, `remainingSeconds`, `nextLevelStartedAt`,
`serverNow`, `finished`). Voir [`docs/validation-engine.md`](docs/validation-engine.md).

### `GET /api/scores`

Renvoie le classement trié et le mode de stockage :

```json
{
  "entries": [
    {
      "id": "…",
      "pseudo": "Achille_Dev",
      "filiere": "IRT",
      "score": 1280,
      "currentLevel": 5,
      "totalTimeSeconds": 212,
      "updatedAt": "2026-11-24T20:12:00.000Z"
    }
  ],
  "source": "supabase",
  "realtime": true
}
```

### `POST /api/scores`

Enregistre la performance finale d'une session terminée de façon atomique
(`upsert_best_score`). Aucun score chiffré n'est accepté depuis le client :

```json
{
  "sessionId": "…",
  "sessionToken": "…"
}
```

Réponse : `{ entry, improved, rank, totalPlayers, source }`.

## Déploiement Vercel

1. Pousse la branche sur GitHub.
2. Sur [Vercel](https://vercel.com), importe le dépôt `mauomau/DevArena`.
3. Ajoute les variables d'environnement de `.env.example` dans
   **Project Settings > Environment Variables** (dont `STAND_SECRET_KEY` pour
   verrouiller `/play` et les écritures `/api`).
4. Déploie. Chaque push sur la branche de production redéploie automatiquement.
5. Exécute `supabase/schema.sql` sur le projet Supabase de production.
6. Sur les PC joueurs du stand uniquement, ouvre une fois
   `https://votre-site.vercel.app/play?key=VOTRE_STAND_SECRET_KEY` pour poser
   le cookie `stand_auth` et nettoyer l'URL. `/leaderboard` et `GET /api/scores`
   restent en accès libre pour le vidéoprojecteur.

## Sécurité et limites connues

- La table `scores` est en lecture seule pour les clients ; `game_sessions` et
  `session_level_results` ne sont accessibles que via `SUPABASE_SERVICE_ROLE_KEY`
  côté serveur.
- Le chrono par niveau, l'ordre des niveaux, l'idempotence (un niveau crédité au
  maximum une fois par session), l'indice et le score final sont contrôlés côté
  serveur à partir d'horodatages PostgreSQL/serveur.
- Les routes `/api/sessions`, `/api/sessions/hint`, `/api/validate` et
  `/api/scores` appliquent une limitation de débit (rate limiting) en mémoire ;
  sur un déploiement serverless multi-instances, ce rate limit est par instance
  et peut être complété par un store distribué (ex. Redis/Upstash) ou un WAF.
- Les pseudos restent déclaratifs (pas de compte ou mot de passe par joueur) et
  le dépôt public expose les tests côté serveur : la plateforme est un
  challenge pédagogique automatisé, pas un examen certifié.
- Ne jamais commiter `.env.local` ni exposer la clé service role.

## Contribuer au projet

1. Crée une branche dédiée depuis `main` :
   - `feat/scoreboard`
   - `feat/player-ui`
   - `feat/validation-engine`
2. Assure-toi qu'aucune clé API ou fichier `.env` n'est inclus dans tes commits.
3. Ouvre une Pull Request claire décrivant les modifications apportées.

## Licence

Projet distribué sous licence MIT — Club Dev ESGIS Bénin.
