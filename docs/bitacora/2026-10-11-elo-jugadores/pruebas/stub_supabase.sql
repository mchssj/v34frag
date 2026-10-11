create role anon nologin; create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin', true), '') = 'on' $$;
create table public.players (id uuid primary key default gen_random_uuid(), nick text not null, rating numeric, kd numeric, hs numeric, adr numeric, maps int, wins int, losses int, user_id uuid);
create table public.teams (id uuid primary key default gen_random_uuid(), name text not null, tag text, members uuid[] not null default '{}', guests text[] not null default '{}', kind text not null default 'official' check (kind in ('official','pcw')));
create table public.matches (id uuid primary key default gen_random_uuid(), kind text not null default 'official' check (kind in ('official','pcw')), team1 uuid, team2 uuid, score1 int, score2 int, map text, maps jsonb, status text not null default 'upcoming', best_of int not null default 1, winner uuid, starts_at timestamptz, played_at timestamptz);
create table public.match_player_stats (id serial primary key, match_id uuid, steam_id text, team int, kills int, deaths int, assists int, headshots int, damage int, created_at timestamptz default now());
