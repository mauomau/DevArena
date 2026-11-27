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
const PAGE_ROTATION_MS = 8_000;
const ROWS_PER_PAGE = 8;

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
    order: 'md:order-2',
    card: 'border-2 border-[#D4AF37] bg-[#FFFDF5] shadow-md',
    badge: 'bg-[#FCF8E8] text-[#8A6D14] border-[#D4AF37]/60',
    avatar: 'border-[#D4AF37] bg-[#FCF8E8] text-[#8A6D14]',
    score: 'text-[#9E1B24]',
    bar: 'bg-[#D4AF37] text-slate-950 h-14 sm:h-16',
    label: '1er · Champion',
  },
  2: {
    order: 'md:order-1',
    card: 'border border-slate-300 bg-white shadow-xs',
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    avatar: 'border-slate-300 bg-slate-100 text-slate-700',
    score: 'text-slate-900',
    bar: 'bg-slate-200 text-slate-800 h-10 sm:h-11',
    label: '2e place',
  },
  3: {
    order: 'md:order-3',
    card: 'border border-amber-300 bg-white shadow-xs',
    badge: 'bg-amber-50 text-amber-800 border-amber-300',
    avatar: 'border-amber-300 bg-amber-50 text-amber-800',
    score: 'text-amber-800',
    bar: 'bg-amber-100 text-amber-900 h-8 sm:h-9',
    label: '3e place',
  },
} as const;

function PodiumCard({ entry, place }: { entry: ScoreEntry; place: 1 | 2 | 3 }) {
  const style = PODIUM_STYLES[place];

  return (
    <div
      className={`scoreboard-rise flex min-w-0 flex-1 flex-col justify-end ${style.order}`}
    >
      <div
        className={`overflow-hidden rounded-2xl ${style.card}`}
      >
        <div className="p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${style.badge}`}
            >
              {place === 1 ? (
                <Crown className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Medal className="h-3 w-3" aria-hidden="true" />
              )}
              {style.label}
            </span>

            <span className="font-mono text-[11px] font-semibold text-slate-500">
              {formatDuration(entry.totalTimeSeconds)} · niv. {entry.currentLevel}/5
            </span>
          </div>

          <div className="mt-2.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-mono text-sm font-black ${style.avatar}`}
              >
                {initials(entry.pseudo)}
              </div>
              <div className="min-w-0">
                <p
                  className={`truncate font-black tracking-tight text-slate-900 ${
                    place === 1 ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'
                  }`}
                >
                  {entry.pseudo}
                </p>
                <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {entry.filiere}
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p
                className={`font-mono font-black tabular-nums leading-none ${
                  place === 1 ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'
                } ${style.score}`}
              >
                {entry.score}
              </p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                PTS
              </p>
            </div>
          </div>
        </div>

        <div
          className={`flex items-center justify-center font-mono text-lg font-black ${style.bar}`}
        >
          #{place}
        </div>
      </div>
    </div>
  );
}

function RankingRow({ entry, rank }: { entry: ScoreEntry; rank: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2 shadow-2xs">
      <span className="w-7 shrink-0 text-center font-mono text-sm font-extrabold tabular-nums text-slate-500">
        {rank}
      </span>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs font-bold text-slate-700">
        {initials(entry.pseudo)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-slate-900 sm:text-base">
          {entry.pseudo}
        </p>
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {entry.filiere}
        </p>
      </div>
      <span className="hidden shrink-0 font-mono text-xs text-slate-500 sm:block">
        niv. {entry.currentLevel}/5
      </span>
      <span className="w-12 shrink-0 text-right font-mono text-xs font-semibold tabular-nums text-slate-500">
        {formatDuration(entry.totalTimeSeconds)}
      </span>
      <span className="w-16 shrink-0 text-right font-mono text-lg font-black tabular-nums text-[#9E1B24] sm:text-xl">
        {entry.score}
      </span>
    </div>
  );
}

export default function LeaderboardScreen() {
  const { entries, source, realtime, status, error, lastUpdate, refresh } =
    useLeaderboard();

  const [pageIndex, setPageIndex] = useState(0);

  const top3 = entries.slice(0, 3);
  const podiumOrder: Array<{ entry: ScoreEntry; place: 1 | 2 | 3 }> = [
    top3[1] ? { entry: top3[1], place: 2 } : null,
    top3[0] ? { entry: top3[0], place: 1 } : null,
    top3[2] ? { entry: top3[2], place: 3 } : null,
  ].filter((item): item is { entry: ScoreEntry; place: 1 | 2 | 3 } =>
    Boolean(item),
  );

  const rest = entries.slice(3);
  const totalPages = Math.max(1, Math.ceil(rest.length / ROWS_PER_PAGE));
  const safePageIndex = pageIndex % totalPages;

  useEffect(() => {
    if (totalPages <= 1) return;
    const id = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % totalPages);
    }, PAGE_ROTATION_MS);
    return () => clearInterval(id);
  }, [totalPages]);

  const pageOffset = safePageIndex * ROWS_PER_PAGE;
  const visibleRest = rest.slice(pageOffset, pageOffset + ROWS_PER_PAGE);

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-[#F4F6F9] text-slate-900 lg:h-screen lg:overflow-hidden">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b-2 border-[#9E1B24] bg-white px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-red.png" alt="ESGIS" className="h-8 w-auto sm:h-9" />
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-black tracking-tight text-slate-900 sm:text-xl">
                DEV<span className="text-[#9E1B24]">ARENA</span>
              </h1>
              <span className="hidden rounded border border-[#D4AF37]/60 bg-[#FCF8E8] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#8A6D14] sm:inline">
                {CLUB.shortName}
              </span>
            </div>
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
              Classement officiel · Stand ESGIS
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 sm:flex">
            <Users className="h-3.5 w-3.5 text-[#9E1B24]" />
            <span className="font-mono tabular-nums">{entries.length}</span>{' '}
            participant{entries.length > 1 ? 's' : ''}
          </div>

          <div className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 md:block">
            <LiveClock />
          </div>

          <div
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider ${
              realtime
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-amber-300 bg-amber-50 text-amber-800'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                realtime ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            {realtime ? 'Live' : source === 'supabase' ? 'Sync' : 'Démo'}
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4">
        {error && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-900">
            <span className="flex items-center gap-2 font-semibold">
              <WifiOff className="h-4 w-4 shrink-0" />
              {error}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-lg border border-red-300 bg-white px-3 py-1 font-bold uppercase tracking-wider text-red-800 transition hover:bg-red-100 cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        )}

        {entries.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="rounded-2xl border-2 border-[#D4AF37] bg-[#FCF8E8] p-5">
              <Trophy className="h-12 w-12 text-[#9E1B24]" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                {status === 'loading'
                  ? 'Chargement du classement…'
                  : 'En attente du premier participant'}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                Passe sur les PC du stand {CLUB.shortName}, relève les 5 défis
                et ton score apparaîtra ici en direct.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Top 3 Podium en haut (centré, horizontal) */}
            <section
              aria-label="Podium Top 3"
              className="grid shrink-0 grid-cols-1 items-end gap-3 md:grid-cols-3"
            >
              {podiumOrder.map(({ entry, place }) => (
                <PodiumCard key={entry.id} entry={entry} place={place} />
              ))}
            </section>

            {/* Suite du classement en dessous (rangs 4+, paginé par 8) */}
            {rest.length > 0 && (
              <section
                aria-label="Suite du classement"
                className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white/80 p-3 sm:p-4"
              >
                <div className="mb-2 flex shrink-0 items-center justify-between gap-2 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">
                  <span>
                    Rangs {pageOffset + 4} à {pageOffset + 3 + visibleRest.length}
                  </span>

                  <div className="flex items-center gap-3">
                    {totalPages > 1 && (
                      <span className="font-mono text-[#9E1B24]">
                        Page {safePageIndex + 1}/{totalPages}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Radio className="h-3 w-3" />
                      {source === 'supabase' ? 'Supabase' : 'Mémoire'}
                    </span>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 content-start gap-2 overflow-hidden md:grid-cols-2">
                  {visibleRest.map((entry, index) => (
                    <RankingRow
                      key={entry.id}
                      entry={entry}
                      rank={pageOffset + index + 4}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-200 bg-white px-4 py-2 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-extrabold tracking-tight text-slate-900 sm:text-sm">
            Rejoins le <span className="text-[#9E1B24]">{CLUB.name}</span>
          </p>
          <p className="text-[11px] text-slate-500">
            Ateliers · Projets · Hackathons · Scanne le QR code pour le groupe
            WhatsApp
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden text-right text-[10px] leading-tight text-slate-400 sm:block">
            <p className="font-semibold uppercase tracking-[0.18em]">
              Synchronisation
            </p>
            <p className="font-mono text-[11px] font-semibold text-slate-600">
              {lastUpdate ? lastUpdate.toLocaleTimeString('fr-FR') : '—'}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-1">
            <JoinQrCode size={52} />
          </div>
        </div>
      </footer>
    </div>
  );
}
