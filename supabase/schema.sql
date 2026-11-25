-- =============================================================================
-- DevArena — schéma Supabase
-- À exécuter dans Supabase > SQL Editor (une seule fois).
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
-- Sécurité : lecture publique, écriture réservée à la clé service role.
-- Aucune policy INSERT/UPDATE/DELETE n'est créée : les clients anon ne
-- peuvent pas écrire. L'API Next.js utilise SUPABASE_SERVICE_ROLE_KEY.
-- -----------------------------------------------------------------------------
alter table public.scores enable row level security;

drop policy if exists "Lecture publique des scores" on public.scores;
create policy "Lecture publique des scores"
  on public.scores
  for select
  using (true);

-- -----------------------------------------------------------------------------
-- Temps réel : le leaderboard s'abonne aux changements de la table.
-- -----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.scores;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
