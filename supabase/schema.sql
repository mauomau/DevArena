-- =============================================================================
-- DevArena — schéma Supabase
-- À exécuter dans Supabase > SQL Editor (idempotent : peut être ré-exécuté).
-- =============================================================================

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  pseudo text not null check (char_length(pseudo) between 2 and 20),
  filiere text not null,
  score integer not null default 0 check (score >= 0 and score <= 2000),
  current_level integer not null default 1 check (current_level between 1 and 5),
  total_time_seconds integer not null default 0 check (total_time_seconds >= 0),
  updated_at timestamptz not null default now()
);

-- Un joueur = une ligne. L'unicité est insensible à la casse.
create unique index if not exists scores_pseudo_key
  on public.scores (lower(pseudo));

-- Tri du leaderboard : meilleur score, puis temps le plus court.
create index if not exists scores_ranking_idx
  on public.scores (score desc, total_time_seconds asc);

-- -----------------------------------------------------------------------------
-- Identités protégées par PIN (anti-usurpation des pseudos)
-- -----------------------------------------------------------------------------
create table if not exists public.player_identities (
  pseudo_key text primary key,
  pseudo text not null check (char_length(pseudo) between 2 and 20),
  pin_hash text not null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Sessions de jeu côté serveur (chrono par horodatage + anti-triche)
-- -----------------------------------------------------------------------------
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  pseudo text not null check (char_length(pseudo) between 2 and 20),
  filiere text not null,
  current_level integer not null default 1 check (current_level between 1 and 5),
  started_at timestamptz not null default now(),
  level_started_at timestamptz not null default now(),
  finished_at timestamptz,
  score integer not null default 0 check (score >= 0 and score <= 2000),
  levels_validated integer not null default 0 check (levels_validated between 0 and 5),
  status text not null default 'active' check (status in ('active', 'finished')),
  score_saved boolean not null default false
);

create table if not exists public.session_level_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  level_id integer not null check (level_id between 1 and 5),
  started_at timestamptz not null,
  timer_started_at timestamptz not null,
  completed_at timestamptz,
  hint_used boolean not null default false,
  hint_used_at timestamptz,
  valid boolean not null default false,
  skipped boolean not null default false,
  points_awarded integer not null default 0 check (points_awarded >= 0),
  elapsed_seconds integer not null default 0 check (elapsed_seconds >= 0),
  unique (session_id, level_id)
);

create index if not exists session_level_results_session_idx
  on public.session_level_results (session_id, level_id);

-- -----------------------------------------------------------------------------
-- Écriture atomique du meilleur score + calcul du rang exact en base
-- -----------------------------------------------------------------------------
create or replace function public.upsert_best_score(
  p_pseudo text,
  p_filiere text,
  p_score integer,
  p_current_level integer,
  p_total_time_seconds integer
)
returns table (
  id uuid,
  pseudo text,
  filiere text,
  score integer,
  current_level integer,
  total_time_seconds integer,
  updated_at timestamptz,
  improved boolean,
  rank bigint,
  total_players bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.scores%rowtype;
  v_improved boolean := false;
  v_rank bigint;
  v_total bigint;
begin
  insert into public.scores (
    pseudo,
    filiere,
    score,
    current_level,
    total_time_seconds,
    updated_at
  )
  values (
    p_pseudo,
    p_filiere,
    p_score,
    p_current_level,
    p_total_time_seconds,
    now()
  )
  on conflict ((lower(pseudo))) do update
    set pseudo = excluded.pseudo,
        filiere = excluded.filiere,
        score = excluded.score,
        current_level = excluded.current_level,
        total_time_seconds = excluded.total_time_seconds,
        updated_at = now()
    where excluded.score > public.scores.score
       or (
         excluded.score = public.scores.score
         and excluded.total_time_seconds < public.scores.total_time_seconds
       )
  returning * into v_row;

  if found then
    v_improved := true;
  else
    select *
      into v_row
      from public.scores s
     where lower(s.pseudo) = lower(p_pseudo);
    v_improved := false;
  end if;

  select count(*) into v_total from public.scores;

  select count(*) + 1
    into v_rank
    from public.scores s
   where s.score > v_row.score
      or (
        s.score = v_row.score
        and s.total_time_seconds < v_row.total_time_seconds
      )
      or (
        s.score = v_row.score
        and s.total_time_seconds = v_row.total_time_seconds
        and lower(s.pseudo) < lower(v_row.pseudo)
      );

  return query
  select
    v_row.id,
    v_row.pseudo,
    v_row.filiere,
    v_row.score,
    v_row.current_level,
    v_row.total_time_seconds,
    v_row.updated_at,
    v_improved,
    v_rank,
    v_total;
end;
$$;

revoke all on function public.upsert_best_score(text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.upsert_best_score(text, text, integer, integer, integer)
  to service_role;

-- -----------------------------------------------------------------------------
-- Sécurité : lecture publique sur `scores` uniquement ; sessions et écritures
-- strictement réservées à la clé service role côté serveur.
-- -----------------------------------------------------------------------------
alter table public.scores enable row level security;
alter table public.player_identities enable row level security;
alter table public.game_sessions enable row level security;
alter table public.session_level_results enable row level security;

drop policy if exists "Lecture publique des scores" on public.scores;
create policy "Lecture publique des scores"
  on public.scores
  for select
  using (true);

-- -----------------------------------------------------------------------------
-- Temps réel : le leaderboard s'abonne aux changements de la table `scores`.
-- -----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.scores;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
