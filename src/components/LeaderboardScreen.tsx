'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Crown,
  Medal,
  Radio,
  Trophy,
  Users,
  WifiOff,
} from 'lucide-react';
import JoinQrCode from '@/components/JoinQrCode';
import { CLUB } from '@/lib/game/config';
import type { ScoreEntry } from '@/lib/game/player';
import { getSupabaseBrowserClient } from '@/lib/supabase';

interface LeaderboardPayload {
  entries?: ScoreEntry[];
  source?: 'supabase' | 'memory';
  realtime?: boolean;
  error?: string;
}

type Status = 'loading' | 'ready' | 'error';

const REFRESH_INTERVAL_MS = 5_000;

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function initials(pseudo: string): string {
  return pseudo
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="font-mono tabular-nums">
      {now ? now.toLocaleTimeString('fr-FR') : '--:--:--'}
    </span>
  );
}

/** Hook de chargement + abonnement temps réel au classement. */
function useLeaderboard() {
  const [entries, setEntries] = useState<ScoreEntry[]>([]);
  const [source, setSource] = useState<'supabase' | 'memory'>('memory');
  const [realtime, setRealtime] = useState(false);
  const [channelLive, setChannelLive] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const response = await fetch('/api/scores', { cache: 'no-store' });
      const data = (await response.json().catch(() => null)) as
        | LeaderboardPayload
        | null;

      if (!response.ok || !data) {
        throw new Error(data?.error ?? 'Impossible de charger le classement.');
      }

      setEntries(data.entries ?? []);
      setSource(data.source ?? 'memory');
      setRealtime(Boolean(data.realtime));
      setStatus('ready');
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      setStatus('error');
      setError(
        err instanceof Error ? err.message : 'Impossible de charger le classement.',
      );
    } finally {
      inFlight.current = false;
    }
  }, []);

  // Chargement initial + sondage de secours (fonctionne sans Supabase).
  useEffect(() => {
    // Synchronisation avec une source externe : le setState a lieu après le
    // fetch, jamais pendant le rendu.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const id = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Abonnement Realtime : mise à jour instantanée quand Supabase est branché.
  useEffect(() => {
    if (!realtime) return;

    const client = getSupabaseBrowserClient();
    if (!client) return;

    const channel = client
      .channel('devarena-scores')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scores' },
        () => {
          void refresh();
        },
      )
      .subscribe((state) => {
        setChannelLive(state === 'SUBSCRIBED');
      });

    return () => {
      setChannelLive(false);
      void client.removeChannel(channel);
    };
  }, [realtime, refresh]);

  return {
    entries,
    source,
    realtime: realtime && channelLive,
    status,
    error,
    lastUpdate,
    refresh,
  };
}

const PODIUM_STYLES = {
  1: {
    card: 'border-esgis-gold/60 bg-gradient-to-b from-esgis-gold/25 via-esgis-gold/10 to-transparent shadow-[0_0_80px_-20px_rgba(212,175,55,0.8)]',
    accent: 'text-[#F5D77A]',
    height: 'h-[clamp(9rem,22vh,15rem)]',
    avatar: 'border-esgis-gold/70 bg-esgis-gold/15 text-[#F5D77A]',
    label: 'CHAMPION',
  },
  2: {
    card: 'border-slate-300/40 bg-gradient-to-b from-slate-300/15 via-slate-300/5 to-transparent',
    accent: 'text-slate-200',
    height: 'h-[clamp(6.5rem,16vh,11rem)]',
    avatar: 'border-slate-300/50 bg-slate-300/10 text-slate-200',
    label: '2e PLACE',
  },
  3: {
    card: 'border-amber-700/60 bg-gradient-to-b from-amber-700/25 via-amber-700/10 to-transparent',
    accent: 'text-amber-400',
    height: 'h-[clamp(5.5rem,14vh,9.5rem)]',
    avatar: 'border-amber-600/60 bg-amber-700/15 text-amber-300',
    label: '3e PLACE',
  },
} as const;

function PodiumCard({ entry, place }: { entry: ScoreEntry; place: 1 | 2 | 3 }) {
  const style = PODIUM_STYLES[place];

  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-end justify-end ${
        place === 1 ? 'order-2' : place === 2 ? 'order-1' : 'order-3'
      }`}
    >
      <div className="mb-4 w-full min-w-0 px-1 text-center scoreboard-rise">
        <div
          className={`mx-auto mb-2 flex items-center justify-center rounded-full border-2 font-black ${
            style.avatar
          } ${place === 1 ? 'h-20 w-20 text-2xl' : 'h-14 w-14 text-lg'}`}
        >
          {initials(entry.pseudo)}
        </div>
        <p
          className={`mx-auto max-w-[18ch] truncate font-extrabold tracking-tight ${
            place === 1 ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl'
          }`}
        >
          {entry.pseudo}
        </p>
        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {entry.filiere}
        </p>
        <p className={`mt-1 font-mono text-3xl font-black tabular-nums sm:text-4xl ${style.accent}`}>
          {entry.score}
          <span className="ml-1 text-xs font-bold text-slate-400">PTS</span>
        </p>
      </div>

      <div
        className={`flex w-full flex-col items-center justify-center gap-1 rounded-t-2xl border border-b-0 ${style.card} ${style.height}`}
      >
        {place === 1 ? (
          <Crown className="h-8 w-8 text-esgis-gold" aria-hidden="true" />
        ) : (
          <Medal className="h-6 w-6 text-slate-400" aria-hidden="true" />
        )}
        <span className={`font-mono text-4xl font-black leading-none ${style.accent}`}>
          {place}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          {style.label}
        </span>
        <span className="mt-1 font-mono text-xs text-slate-400">
          {formatDuration(entry.totalTimeSeconds)} · niv. {entry.currentLevel}/5
        </span>
      </div>
    </div>
  );
}

function RankingRow({ entry, rank }: { entry: ScoreEntry; rank: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3 transition-colors hover:bg-white/[0.06] sm:gap-4 sm:px-4">
      <span className="w-8 shrink-0 text-center font-mono text-lg font-bold tabular-nums text-slate-500">
        {rank}
      </span>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-bold text-slate-300">
        {initials(entry.pseudo)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-slate-100">{entry.pseudo}</p>
        <p className="truncate text-[10px] uppercase tracking-wider text-slate-500">
          {entry.filiere}
        </p>
      </div>
      <span className="hidden shrink-0 font-mono text-xs text-slate-500 sm:block">
        niv. {entry.currentLevel}/5
      </span>
      <span className="w-14 shrink-0 text-right font-mono text-xs text-slate-400">
        {formatDuration(entry.totalTimeSeconds)}
      </span>
      <span className="w-16 shrink-0 text-right font-mono text-xl font-black tabular-nums text-[#F5D77A] sm:w-20 sm:text-2xl">
        {entry.score}
      </span>
    </div>
  );
}

export default function LeaderboardScreen() {
  const { entries, source, realtime, status, error, lastUpdate, refresh } =
    useLeaderboard();

  const top3 = entries.slice(0, 3);
  const podium = [top3[1], top3[0], top3[2]].filter(
    (entry): entry is ScoreEntry => Boolean(entry),
  );
  const rest = entries.slice(3, 12);

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#05080f] text-slate-100 lg:h-screen">
      {/* Fond : halos + grille technique */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(158,27,36,0.35),transparent_60%),radial-gradient(ellipse_at_90%_110%,rgba(212,175,55,0.16),transparent_55%)]"
      />
      <div aria-hidden="true" className="arena-grid pointer-events-none absolute inset-0" />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="rounded-xl bg-white p-1.5 shadow-lg shadow-black/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-red.png" alt="ESGIS" className="h-8 w-auto sm:h-10" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">
                DEV<span className="text-esgis-gold">ARENA</span>
              </h1>
              <span className="hidden rounded-md border border-esgis-gold/40 bg-esgis-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#F5D77A] sm:inline">
                {CLUB.shortName}
              </span>
            </div>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400 sm:text-xs">
              Classement en direct
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 sm:flex">
            <Users className="h-3.5 w-3.5 text-esgis-gold" />
            {entries.length} joueur{entries.length > 1 ? 's' : ''}
          </div>

          <div className="hidden text-right md:block">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Heure locale
            </p>
            <p className="text-lg font-bold text-slate-200">
              <LiveClock />
            </p>
          </div>

          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider ${
              realtime
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
                : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${
                  realtime ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  realtime ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
            </span>
            {realtime ? 'Live' : source === 'supabase' ? 'Sync' : 'Démo'}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col justify-center gap-5 px-4 py-4 sm:px-6 sm:py-5">
        {error && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-200">
            <span className="flex items-center gap-2">
              <WifiOff className="h-4 w-4 shrink-0" />
              {error}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-red-300/30 px-3 py-1 font-bold uppercase tracking-wider transition hover:bg-red-500/20"
            >
              Réessayer
            </button>
          </div>
        )}

        {entries.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 text-center">
            <div className="rounded-full border border-esgis-gold/30 bg-esgis-gold/10 p-6">
              <Trophy className="h-14 w-14 text-esgis-gold" />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                {status === 'loading'
                  ? 'Chargement du classement…'
                  : 'Le classement attend son premier héros'}
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
                Passe sur le stand, code les 5 niveaux et ton score apparaîtra ici
                instantanément.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
              <div className="rounded-xl bg-white p-2">
                <JoinQrCode size={96} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Rejoins le {CLUB.name}</p>
                <p className="text-xs text-slate-400">
                  Scanne le QR code avec ton téléphone
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Podium Top 3 */}
            <section
              aria-label="Podium"
              className="flex shrink-0 items-end justify-center gap-2 pt-2 sm:gap-4"
            >
              {podium.map((entry) => {
                const place = (entries.indexOf(entry) + 1) as 1 | 2 | 3;
                return <PodiumCard key={entry.id} entry={entry} place={place} />;
              })}
            </section>

            {/* Rangs 4 et suivants */}
            {rest.length > 0 && (
              <section aria-label="Suite du classement" className="min-h-0">
                <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                  <span>Suite du classement</span>
                  <span className="flex items-center gap-1.5">
                    <Radio className="h-3 w-3" />
                    {source === 'supabase' ? 'Supabase' : 'Stockage mémoire'}
                  </span>
                </div>
                <div className="grid gap-2 overflow-hidden lg:grid-cols-2">
                  {rest.map((entry, index) => (
                    <RankingRow key={entry.id} entry={entry} rank={index + 4} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-t border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-sm font-extrabold tracking-tight sm:text-base">
            Rejoins le <span className="text-esgis-gold">{CLUB.name}</span>
          </p>
          <p className="text-[11px] text-slate-400">
            Ateliers · Projets · Hackathons · Communauté
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right text-[10px] leading-tight text-slate-500 sm:block">
            <p className="font-semibold uppercase tracking-[0.18em]">
              Dernière mise à jour
            </p>
            <p className="font-mono text-[11px] text-slate-300">
              {lastUpdate ? lastUpdate.toLocaleTimeString('fr-FR') : '—'}
            </p>
          </div>
          <div className="rounded-lg bg-white p-1.5">
            <JoinQrCode size={88} />
          </div>
        </div>
      </footer>
    </div>
  );
}
