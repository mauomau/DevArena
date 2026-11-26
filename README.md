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
| 2. Le Styliste | CSS | 60s | 150 pts | Styliser un bouton aux couleurs de l'ESGIS. |
| 3. L'Interactif | JS (DOM) | 90s | 200 pts | Implémenter un bouton compteur (`+1` au clic). |
| 4. Bug Hunter | Debug | 90s | 250 pts | Corriger 2 erreurs cachées dans un script existant. |
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
│   └── schema.sql                # Table scores, RLS, publication Realtime
├── src/
│   ├── app/
│   │   ├── api/validate/route.ts # Validation sécurisée d'un niveau
│   │   ├── api/scores/route.ts   # Lecture / écriture du classement
│   │   ├── page.tsx              # Accueil et présentation du défi
│   │   ├── play/page.tsx         # Arène de code (Éditeur + Preview + Chrono)
│   │   └── leaderboard/page.tsx  # Écran vidéoprojecteur temps réel
│   ├── components/
│   │   ├── CodeEditor.tsx        # Wrapper CodeMirror
│   │   ├── JoinQrCode.tsx        # QR code WhatsApp (client)
│   │   ├── LeaderboardScreen.tsx # Podium + classement + Realtime
│   │   └── LivePreview.tsx       # Sandbox iframe
│   └── lib/
│       ├── levels.ts             # Énoncés et codes de départ publics
│       ├── scoring.ts            # Barème et classement
│       ├── supabase.ts           # Client public (Realtime navigateur)
│       ├── game/
│       │   ├── config.ts         # Barème, durées, club, WhatsApp
│       │   ├── contracts.ts      # Types des API
│       │   └── player.ts         # Validation des scores et dédoublonnage
│       ├── server/
│       │   ├── scoreStore.ts     # Persistance Supabase + fallback mémoire
│       │   └── supabaseAdmin.ts  # Client service role (serveur uniquement)
│       └── validation/           # Moteur de validation des 5 niveaux
├── tests/                        # Tests Node (barème, niveaux, API)
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
[`supabase/schema.sql`](supabase/schema.sql) puis exécute-le. Le script crée la
table `scores`, active la RLS (lecture publique, écriture réservée au serveur)
et ajoute la table à la publication Realtime.

### 4. Lancer le serveur de développement

```bash
npm run dev
```

- `http://localhost:3000` : accueil
- `http://localhost:3000/play` : arène joueur
- `http://localhost:3000/leaderboard` : écran projecteur

### 5. Vérifier le projet

```bash
npm test        # 80+ tests (niveaux, barème, API scores)
npm run typecheck
npm run build
```

## Mode démo sans Supabase

Si les variables Supabase ne sont pas définies, l'application reste
entièrement fonctionnelle en local : les scores sont stockés dans un `Map`
côté serveur et le leaderboard se rafraîchit par sondage toutes les 5 secondes.

/!\ Ce mode n'est **pas persistant** : il est remis à zéro à chaque redémarrage
du serveur et ne fonctionne pas sur Vercel (instances serverless). Il sert
uniquement aux démos et aux tests. Pour l'événement, configure Supabase.

## API

### `POST /api/validate`

Valide le code d'un joueur et calcule les points du niveau.

```json
{
  "levelId": 1,
  "code": "<h1>Hello ESGIS</h1>",
  "remainingSeconds": 32,
  "hintUsed": false,
  "skipped": false
}
```

La réponse contient `valid`, `pointsAwarded`, le détail `breakdown`, les
`checks` et le `nextLevel`. Voir [`docs/validation-engine.md`](docs/validation-engine.md).

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

Enregistre la performance de fin de partie. Un joueur n'a qu'une ligne : seule
sa meilleure performance est conservée (score le plus haut, puis temps le plus
court).

```json
{
  "pseudo": "Achille_Dev",
  "filiere": "IRT",
  "score": 1280,
  "currentLevel": 5,
  "totalTimeSeconds": 212
}
```

Réponse : `{ entry, improved, rank, totalPlayers, source }`.

## Déploiement Vercel

1. Pousse la branche sur GitHub.
2. Sur [Vercel](https://vercel.com), importe le dépôt `mauomau/DevArena`.
3. Ajoute les quatre variables d'environnement de `.env.example` dans
   **Project Settings > Environment Variables**.
4. Déploie. Chaque push sur la branche de production redéploie automatiquement.
5. Exécute `supabase/schema.sql` sur le projet Supabase de production.

## Sécurité et limites connues

- La table `scores` est en lecture seule pour les clients : les écritures
  passent exclusivement par `SUPABASE_SERVICE_ROLE_KEY` côté serveur.
- Le temps restant (`remainingSeconds`) et le score final sont encore transmis
  par le client. Pour un événement sur stand, cela suffit ; avant une mise en
  production publique, il faudra créer une session de partie côté serveur et
  recalculer le chrono et le cumul des points à partir de l'heure de départ.
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
