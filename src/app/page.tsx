import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  Monitor,
  ShieldCheck,
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

const TOTAL_DURATION_LABEL = `${Math.floor(TOTAL_DURATION_SECONDS / 60)}m ${String(
  TOTAL_DURATION_SECONDS % 60,
).padStart(2, '0')}s`;

const RULES = [
  {
    code: '01',
    title: 'Temps de lecture',
    detail: `${GAME_CONFIG.readingWindowSeconds} s par épreuve avant le départ du chrono, ou démarrage immédiat au clic.`,
  },
  {
    code: '02',
    title: 'Bonus rapidité',
    detail: `+${GAME_CONFIG.speedBonusPerSecond} pts par seconde restante à la validation. La précision paie autant que la vitesse.`,
  },
  {
    code: '03',
    title: 'Indice & passage',
    detail: `Indice à -${GAME_CONFIG.hintPenalty} pts. Option « Passer » (0 pt) débloquée après ${GAME_CONFIG.skipAvailableAfterSeconds} s.`,
  },
  {
    code: '04',
    title: 'Équité stand',
    detail: 'Parties jouées uniquement sur les PC du stand, protégées par code PIN et chrono calculé côté serveur.',
  },
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-900 flex flex-col">
      <header className="border-b-2 border-[#9E1B24] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-red.png" alt="ESGIS" className="h-9 w-auto" />
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="leading-tight">
              <span className="block text-sm font-black tracking-tight text-slate-900">
                DEV<span className="text-[#9E1B24]">ARENA</span>
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {CLUB.name}
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-2 text-xs sm:text-sm font-bold">
            <Link
              href="/play"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Monitor className="h-3.5 w-3.5 text-[#9E1B24]" />
              PC Stand
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#9E1B24] px-3.5 py-2 text-white shadow-xs transition hover:bg-[#7A1219]"
            >
              Classement <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
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

          <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-12 lg:items-start lg:py-16">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 border-l-4 border-[#D4AF37] pl-3 text-xs font-extrabold uppercase tracking-[0.18em] text-[#F5D77A]">
                Journée d’intégration · ESGIS Bénin
              </div>

              <h1 className="text-4xl font-black leading-[1.06] tracking-tight text-white sm:text-5xl">
                Cinq épreuves de code.
                <span className="block text-[#F5D77A]">
                  Un classement projeté en direct.
                </span>
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-slate-300">
                Passe sur le stand du {CLUB.shortName}, résous cinq défis du
                HTML à l’algorithmique sous chronomètre serveur et défends ta
                place sur le podium.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/leaderboard"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-black/30 transition hover:brightness-105"
                >
                  <Trophy className="h-4 w-4" />
                  Voir le classement en direct
                </Link>
                <a
                  href="#rejoindre"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/10"
                >
                  Rejoindre le Club Dev
                </a>
              </div>

              <dl className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                {[
                  { label: 'Épreuves', value: `${LEVELS.length}` },
                  { label: 'Temps de jeu', value: TOTAL_DURATION_LABEL },
                  { label: 'Score max', value: `${MAX_TOTAL_SCORE} pts` },
                  { label: 'Base', value: `${TOTAL_BASE_POINTS} pts` },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 backdrop-blur"
                  >
                    <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      {stat.label}
                    </dt>
                    <dd className="mt-1 font-mono text-xl font-black tabular-nums text-[#F5D77A]">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* PROGRAMME */}
            <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/30 backdrop-blur overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-300">
                  Programme des 5 niveaux
                </span>
                <span className="font-mono text-[11px] font-bold text-[#F5D77A]">
                  +{GAME_CONFIG.readingWindowSeconds}s lecture / niveau
                </span>
              </div>

              <ol className="divide-y divide-white/10">
                {LEVELS.map((level) => (
                  <li
                    key={level.id}
                    className="flex items-center gap-3.5 px-4 py-3"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#9E1B24]/35 font-mono text-xs font-bold text-[#F5D77A]">
                      0{level.id}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-white">
                        {level.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {level.theme} ·{' '}
                        <span className="font-mono">{level.durationSeconds}s</span>
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-slate-200">
                      {level.basePoints}
                      <span className="ml-1 text-[10px] text-slate-500">pts</span>
                    </span>
                  </li>
                ))}
              </ol>

              <div className="flex items-center justify-between border-t border-white/10 bg-black/20 px-4 py-2.5 text-[11px] font-medium text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-[#D4AF37]" />
                  Départage au temps total le plus court
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* RÈGLES */}
        <section className="border-b border-slate-200 bg-[#F4F6F9]">
          <div className="mx-auto max-w-6xl px-5 py-12">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#9E1B24]">
                  Règlement
                </p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                  Comment se jouent les points
                </h2>
              </div>
              <p className="flex items-center gap-2 text-xs font-medium text-slate-600">
                <ShieldCheck className="h-4 w-4 text-[#9E1B24]" />
                Les pseudos, filières, niveaux et scores sont affichés sur
                l’écran public.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {RULES.map((rule) => (
                <div
                  key={rule.code}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-2"
                >
                  <span className="font-mono text-xs font-bold text-[#9E1B24]">
                    {rule.code}
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    {rule.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-600">
                    {rule.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* REJOINDRE */}
        <section id="rejoindre" className="mx-auto max-w-6xl px-5 py-12">
          <div className="flex flex-col items-center justify-between gap-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 md:flex-row">
            <div className="max-w-lg space-y-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#9E1B24]">
                Communauté ESGIS
              </p>
              <h2 className="text-2xl font-black tracking-tight text-slate-900">
                Rejoins le groupe WhatsApp du {CLUB.shortName}
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Ateliers pratiques, projets open source, entraide entre filières
                (L1 à M2) et préparation des prochains hackathons.
              </p>
              <div className="pt-2">
                <Link
                  href="/leaderboard"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#9E1B24] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#7A1219]"
                >
                  Ouvrir le classement projeté <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2.5 rounded-xl border-2 border-[#D4AF37] bg-[#FCF8E8] p-4 text-center">
              <div className="rounded-lg bg-white p-2.5 shadow-xs">
                <JoinQrCode size={144} />
              </div>
              <p className="text-xs font-extrabold text-slate-900">
                Scanne pour rejoindre le groupe
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 text-xs text-slate-500 sm:flex-row">
          <p>
            © {new Date().getFullYear()} {CLUB.name} — DevArena
          </p>
          <div className="flex items-center gap-4 font-semibold">
            <Link href="/leaderboard" className="transition hover:text-[#9E1B24]">
              Classement
            </Link>
            <Link href="/play" className="transition hover:text-[#9E1B24]">
              Accès stand
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
