import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  Code2,
  Lightbulb,
  Medal,
  SkipForward,
  Sparkles,
  Trophy,
} from 'lucide-react';
import JoinQrCode from '@/components/JoinQrCode';
import { CLUB, GAME_CONFIG } from '@/lib/game/config';
import { LEVELS, TOTAL_BASE_POINTS } from '@/lib/levels';
import { MAX_TOTAL_SCORE } from '@/lib/scoring';

const TOTAL_DURATION_SECONDS = LEVELS.reduce(
  (total, level) => total + level.durationSeconds,
  0,
);

const TOTAL_DURATION_LABEL = `${Math.floor(TOTAL_DURATION_SECONDS / 60)}:${String(
  TOTAL_DURATION_SECONDS % 60,
).padStart(2, '0')}`;

const RULES = [
  {
    icon: Trophy,
    title: 'Points par niveau',
    text: `De ${LEVELS[0].basePoints} à ${LEVELS[LEVELS.length - 1].basePoints} pts selon la difficulté, soit ${TOTAL_BASE_POINTS} pts de base.`,
  },
  {
    icon: Clock,
    title: 'Bonus de rapidité',
    text: `+${GAME_CONFIG.speedBonusPerSecond} pts par seconde restante au chrono. La vitesse fait la différence.`,
  },
  {
    icon: Lightbulb,
    title: 'Indice',
    text: `Bloqué ? Débloque une aide, avec une pénalité de ${GAME_CONFIG.hintPenalty} pts sur le niveau.`,
  },
  {
    icon: SkipForward,
    title: 'Passer',
    text: `Disponible après ${GAME_CONFIG.skipAvailableAfterSeconds}s. Le niveau rapporte 0 pt, mais tu continues l'aventure.`,
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b-4 border-[#9E1B24] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-red.png" alt="Logo ESGIS" className="h-10 w-auto" />
            <div className="hidden h-7 w-px bg-slate-200 sm:block" />
            <span className="hidden rounded-md border border-[#D4AF37]/60 bg-[#FCF8E8] px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[#947618] sm:inline">
              {CLUB.shortName}
            </span>
          </div>

          <nav className="flex items-center gap-2 text-sm font-semibold">
            <Link
              href="/leaderboard"
              className="hidden rounded-lg px-3 py-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:inline"
            >
              Classement
            </Link>
            <Link
              href="/play"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E1B24] px-4 py-2 font-bold text-white shadow-sm transition hover:bg-[#7A1219]"
            >
              Jouer <ArrowRight className="h-4 w-4" />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden bg-[#0B1220] text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(158,27,36,0.55),transparent_55%),radial-gradient(ellipse_at_90%_100%,rgba(212,175,55,0.22),transparent_55%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:52px_52px] [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_75%)]"
          />

          <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#F5D77A]">
                <Sparkles className="h-3.5 w-3.5" />
                Journée d’intégration des clubs · ESGIS Bénin
              </span>

              <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                Code. Marque.
                <br />
                <span className="bg-gradient-to-r from-[#F5D77A] via-[#D4AF37] to-[#F5D77A] bg-clip-text text-transparent">
                  Rejoins le Club Dev.
                </span>
              </h1>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                Cinq défis chronométrés, un éditeur de code intégré, un
                classement projeté en direct. Montre ce que tu sais faire et
                entre dans le Top 3.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/play"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C158] to-[#D4AF37] px-6 py-3.5 text-base font-extrabold text-slate-950 shadow-lg shadow-black/30 transition hover:brightness-105"
                >
                  Entrer dans l’arène <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="/leaderboard"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-base font-bold text-white backdrop-blur transition hover:bg-white/10"
                >
                  <Trophy className="h-5 w-5 text-[#D4AF37]" />
                  Voir le classement
                </Link>
              </div>

              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3">
                {[
                  { label: 'Niveaux', value: `${LEVELS.length}` },
                  { label: 'Chrono total', value: TOTAL_DURATION_LABEL },
                  { label: 'Points max', value: `${MAX_TOTAL_SCORE}` },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                  >
                    <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      {stat.label}
                    </dt>
                    <dd className="mt-0.5 font-mono text-2xl font-black text-[#F5D77A]">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Carte "parcours" */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/30 backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                  Le parcours
                </p>
                <Code2 className="h-4 w-4 text-[#D4AF37]" />
              </div>

              <ol className="mt-4 space-y-2">
                {LEVELS.map((level) => (
                  <li
                    key={level.id}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#9E1B24]/30 font-mono text-xs font-bold text-[#F5D77A]">
                      {level.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{level.title}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">
                        {level.theme} · {level.durationSeconds}s
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-bold text-slate-300">
                      {level.basePoints}
                      <span className="ml-0.5 text-[10px] text-slate-500">pts</span>
                    </span>
                  </li>
                ))}
              </ol>

              <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
                <Medal className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />
                Égalité ? Le temps total le plus court l’emporte.
              </p>
            </div>
          </div>
        </section>

        {/* RÈGLES */}
        <section className="mx-auto max-w-6xl px-5 py-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9E1B24]">
                Système de scoring
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                Simple à comprendre, difficile à maîtriser
              </h2>
            </div>
            <p className="max-w-sm text-sm text-slate-500">
              Chaque seconde compte : un niveau validé vite vaut plus cher qu’un
              niveau validé lentement.
            </p>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {RULES.map((rule) => (
              <div
                key={rule.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#9E1B24]/15 bg-[#FDF2F3] text-[#9E1B24]">
                  <rule.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-3 text-sm font-extrabold text-slate-900">
                  {rule.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {rule.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* REJOINDRE */}
        <section className="border-y border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 px-5 py-12 md:flex-row md:justify-between">
            <div className="max-w-xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#9E1B24]">
                Après la partie
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                Ton score tombe, le Club Dev t’attend.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Scanne le QR code pour rejoindre le groupe WhatsApp : ateliers,
                projets open source, hackathons et entraide toute l’année.
              </p>
              <Link
                href="/play"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#9E1B24] px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-[#7A1219]"
              >
                Tester le défi <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-[#D4AF37] bg-[#FCF8E8] p-5 text-center">
              <div className="rounded-xl bg-white p-3 shadow-sm">
                <JoinQrCode size={168} />
              </div>
              <p className="text-sm font-extrabold text-slate-900">
                Groupe WhatsApp du {CLUB.name}
              </p>
              <p className="text-[11px] text-slate-500">
                Ouvre l’appareil photo de ton téléphone
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-slate-500 sm:flex-row">
        <p>
          © {new Date().getFullYear()} {CLUB.name} — Projet open source
        </p>
        <div className="flex items-center gap-4 font-semibold">
          <Link href="/play" className="transition hover:text-[#9E1B24]">
            Jouer
          </Link>
          <Link href="/leaderboard" className="transition hover:text-[#9E1B24]">
            Classement
          </Link>
        </div>
      </footer>
    </div>
  );
}
