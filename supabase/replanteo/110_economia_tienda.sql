-- 110: economía de puntos y monedas VIP, tienda e inventario (bitácoras docs/bitacora/2026-11-11-economia-puntos y
-- docs/bitacora/2026-11-11-tienda, Kyan 2026-11-11). Número a confirmar con Daniel.
--
--   1. economy_config (una fila) y economy_rules (una por premio): cuánto da cada cosa en puntos y en monedas VIP,
--      el tope de partidas por día, las ofertas y el descuento de los packs. starts_at: antes no se da nada.
--   2. point_ledger: cada premio, regalo o compra es una fila; el saldo es la suma. Índice único por
--      (cuenta, moneda, origen, ref): reintentar no paga dos veces. No se borra.
--   3. points_award / economy_award: la única forma de anotar premios. Las monedas VIP, solo siendo VIP (vip_at, de
--      la migración de clips VIP). El VIP se sigue dando en Administración › Usuarios (admin_vip_grant).
--   4. Enganches:
--        match_player_stats.elo_after (de null a un valor) → partida, victoria y primera del día (mm y mix), con el
--        tope diario, sin el que abandonó; partida oficial (official) sin tope. Las PCW no dan nada.
--        player_medals → medalla según el metal de su definición; las de temporada (source = 'season'), según
--        el puesto.
--        vip_memberships → bienvenida VIP en monedas.
--        matches (borrado) → lo que dio la partida vuelve con filas negativas (source = 'reversal').
--      El resto (misiones, primeros pasos, nivel, torneo, clip destacado, referidos) queda en economy_rules para
--      que lo llamen sus sistemas con economy_award (service_role).
--   5. Tienda: shop_items (catálogo), user_items (inventario), user_cosmetics (lo puesto), user_wishlist,
--      shop_catalog (precio de hoy), shop_buy, shop_buy_bundle, set_my_cosmetics, wishlist_toggle,
--      my_wallet, my_ledger, my_inventory y player_cosmetics_public.
--   6. Admin: admin_points_grant, admin_economy_set, admin_economy_rule_set, admin_shop_item_update,
--      admin_item_grant, admin_item_revoke y admin_wallets.
-- Reemplaza el modelo de supabase/migrations/20261029180000_tienda.sql, 20261029200000_fondo_miniperfil.sql y
-- 20261029210000_vip_progresion.sql, que nunca se aplicaron en producción: si están (base local), se borran, salvo
-- que tengan datos.
-- Día: hora de Bogotá, como el resto de los topes de la web.
begin;

do $$
begin
  if to_regclass('public.point_ledger') is not null then raise exception 'replanteo 110: ya se aplicó (point_ledger existe)'; end if;
  if to_regclass('public.medal_definitions') is null then raise exception 'replanteo 110: falta la 79 (medallas)'; end if;
  if to_regclass('public.mm_lobby_players') is null then raise exception 'replanteo 110: falta la 48 (matchmaking)'; end if;
  if to_regclass('public.user_items') is not null and exists (select 1 from public.user_items) then
    raise exception 'replanteo 110: user_items del modelo viejo tiene datos; migrarlos a mano antes';
  end if;
end $$;

-- ---------- 0. Fuera el modelo viejo (solo existía en bases locales) ----------
drop view if exists public.player_cosmetics_public, public.shop_catalog;
drop function if exists public.points_mixes_of(uuid), public.points_of(uuid), public.my_points(),
  public.my_points_history(uuid, int), public.vip_coins_mixes_of(uuid), public.vip_coins_of(uuid),
  public.my_vip_coins(), public.my_vip_coins_history(uuid, int), public.shop_weekly(), public.shop_buy(text),
  public.can_use_item(uuid, text), public.set_my_cosmetics(jsonb), public.admin_points_grant(uuid, int, text),
  public.admin_vip_coins_grant(uuid, int, text), public.admin_item_grant(uuid, text, text),
  public.admin_item_revoke(uuid, text, text), public.admin_shop_item_update(text, int, boolean, text, text, int, boolean),
  public.admin_shop_item_vip_price(text, int), public.set_points_config(int, int, numeric, int, int),
  public.set_vip_coins_config(int, int), public.admin_points_overview(), public.was_vip(uuid, timestamptz);
drop table if exists public.user_cosmetics, public.user_items, public.point_grants, public.shop_items, public.points_config;

-- ---------- 1. Configuración ----------
create table public.economy_config (
  id               int primary key default 1 check (id = 1),
  daily_match_cap  int not null default 10 check (daily_match_cap between 0 and 100),
  weekly_count     int not null default 6 check (weekly_count between 0 and 24),
  weekly_discount  int not null default 25 check (weekly_discount between 0 and 90),
  bundle_discount  int not null default 20 check (bundle_discount between 0 and 90),
  starts_at        timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles(id) on delete set null
);
insert into public.economy_config (id) values (1);
comment on table public.economy_config is 'Economía de la tienda: tope diario, ofertas y packs. starts_at: antes no se da nada. Replanteo 110';

-- key: el origen (match, match_win…) o el escalón (medal_oro, season_10, tournament_1).
create table public.economy_rules (
  key        text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  points     int not null default 0 check (points between 0 and 100000),
  vip_coins  int not null default 0 check (vip_coins between 0 and 100000),
  enabled    boolean not null default true,
  sort       int not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
comment on table public.economy_rules is 'Cuánto da cada premio en puntos y en monedas VIP. season_N: hasta el puesto N. Replanteo 110';
insert into public.economy_rules (key, points, vip_coins, enabled, sort) values
  ('match', 10, 10, true, 10), ('match_win', 5, 5, true, 20), ('first_of_day', 10, 10, true, 30),
  ('official', 15, 10, true, 40), ('tournament_1', 500, 250, true, 50), ('tournament_2', 250, 125, true, 60),
  ('medal_bronce', 50, 25, true, 70), ('medal_plata', 100, 50, true, 80), ('medal_oro', 200, 100, true, 90),
  ('medal_platino', 400, 200, true, 100), ('medal_diamante', 800, 400, true, 110),
  ('season_1', 1000, 500, true, 120), ('season_2', 750, 375, true, 130), ('season_3', 500, 250, true, 140),
  ('season_10', 250, 125, true, 150), ('season_20', 100, 50, true, 160),
  ('level_up', 50, 25, true, 170), ('mission', 30, 0, true, 180), ('mission_vip', 0, 50, true, 190),
  ('first_steps', 20, 0, true, 200), ('clip_featured', 50, 25, true, 210),
  ('referral', 100, 50, false, 220), ('vip_welcome', 0, 100, true, 230);

alter table public.economy_config enable row level security;
alter table public.economy_rules enable row level security;
revoke all on public.economy_config, public.economy_rules from anon, authenticated;
grant select on public.economy_config, public.economy_rules to anon, authenticated;
create policy economy_config_read on public.economy_config for select using (true);
create policy economy_rules_read on public.economy_rules for select using (true);

-- ---------- 2. Registro ----------
create table public.point_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  currency   text not null check (currency in ('points', 'vip')),
  amount     int not null check (amount <> 0 and amount between -1000000 and 1000000),
  source     text not null check (source ~ '^[a-z0-9_]{2,40}$'),
  ref        text not null check (char_length(ref) between 1 and 120),
  label      text not null check (char_length(label) between 1 and 200),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);
create unique index point_ledger_once on public.point_ledger (user_id, currency, source, ref);
create index point_ledger_user on public.point_ledger (user_id, created_at desc);
comment on table public.point_ledger is 'Cada premio (+), regalo (±) o compra (−). El saldo es la suma por moneda. No se borra. Replanteo 110';
alter table public.point_ledger enable row level security;
revoke all on public.point_ledger from anon, authenticated;
grant select on public.point_ledger to authenticated;
create policy point_ledger_read on public.point_ledger for select to authenticated using (user_id = auth.uid() or is_admin());

/** Anota una fila. Devuelve false si ya estaba (mismo origen y ref) o si es 0. Interna. */
create function public.points_award(p_user uuid, p_currency text, p_source text, p_ref text, p_amount int,
                                    p_label text, p_by uuid default null) returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_amount, 0) = 0 or p_user is null then return false; end if;
  insert into point_ledger (user_id, currency, amount, source, ref, label, created_by)
  values (p_user, p_currency, p_amount, p_source, p_ref, left(p_label, 200), p_by)
  on conflict (user_id, currency, source, ref) do nothing;
  return found;
end $$;
revoke all on function public.points_award(uuid, text, text, text, int, text, uuid) from public, anon, authenticated;

/**
 * Da el premio de una regla (key) a una cuenta: puntos siempre y monedas VIP si es VIP en p_at.
 * Para los sistemas que todavía no tienen enganche (misiones, nivel, torneo…): service_role.
 */
create function public.economy_award(p_user uuid, p_key text, p_ref text, p_label text, p_at timestamptz default now(),
                                     p_source text default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare r economy_rules; v_pts boolean; v_vip boolean := false; s text := coalesce(p_source, p_key);
begin
  if p_at < (select starts_at from economy_config where id = 1) then return jsonb_build_object('points', 0, 'vip', 0); end if;
  select * into r from economy_rules where key = p_key;
  if not found or not r.enabled then return jsonb_build_object('points', 0, 'vip', 0); end if;
  v_pts := points_award(p_user, 'points', s, p_ref, r.points, p_label);
  if r.vip_coins > 0 and coalesce(vip_at(p_user, p_at), false) then
    v_vip := points_award(p_user, 'vip', s, p_ref, r.vip_coins, p_label);
  end if;
  return jsonb_build_object('points', case when v_pts then r.points else 0 end,
                            'vip', case when v_vip then r.vip_coins else 0 end);
end $$;
revoke all on function public.economy_award(uuid, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.economy_award(uuid, text, text, text, timestamptz, text) to service_role;

create function public.wallet_of(p_user uuid) returns table (points int, vip_coins int)
  language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount) filter (where currency = 'points'), 0)::int,
         coalesce(sum(amount) filter (where currency = 'vip'), 0)::int
    from point_ledger where user_id = p_user $$;
revoke all on function public.wallet_of(uuid) from public, anon, authenticated;

-- Partidas que ya dieron premio hoy (Bogotá).
create function public.matches_awarded_today(p_user uuid) returns int
  language sql stable security definer set search_path = public as $$
  select count(*)::int from point_ledger
   where user_id = p_user and currency = 'points' and source = 'match'
     and (created_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date $$;
revoke all on function public.matches_awarded_today(uuid) from public, anon, authenticated;

-- ---------- 4. Enganches ----------
-- Partida: cuando la fila recibe su ELO. mm y mix con tope diario; official sin tope; pcw nada.
create function public.tg_award_match() returns trigger
  language plpgsql security definer set search_path = public as $$
declare m matches; v_user uuid; v_won boolean; v_label text; v_cap int; v_at timestamptz;
begin
  if new.elo_after is null or (tg_op = 'UPDATE' and old.elo_after is not null) then return new; end if;
  select * into m from matches where id = new.match_id;
  if not found or m.status <> 'finished' or m.kind not in ('mm', 'mix', 'official') then return new; end if;
  select p.user_id into v_user from players p
   where p.id = new.player_id or (new.player_id is null and p.steam_id = new.steam_id) limit 1;
  if v_user is null then return new; end if;
  v_at := coalesce(m.played_at, now());
  if v_at < (select starts_at from economy_config where id = 1) then return new; end if;
  -- El que abandonó la sala del matchmaking no cobra.
  if m.kind = 'mm' and mm_elo_abandoned(m.id, elo_key(new.steam_id)) then return new; end if;
  v_won := m.winner_side is not null and m.winner_side = new.team;
  v_label := case m.kind when 'official' then 'Oficial' when 'mm' then 'Matchmaking' else 'Mix' end
             || coalesce(' · ' || m.map, '');
  if m.kind = 'official' then
    perform economy_award(v_user, 'official', m.id::text, v_label, v_at);
  else
    select daily_match_cap into v_cap from economy_config where id = 1;
    if matches_awarded_today(v_user) >= v_cap then return new; end if;
    if matches_awarded_today(v_user) = 0 then
      perform economy_award(v_user, 'first_of_day', m.id::text, 'Primera del día', v_at);
    end if;
    perform economy_award(v_user, 'match', m.id::text, v_label, v_at);
  end if;
  if v_won then perform economy_award(v_user, 'match_win', m.id::text, v_label, v_at); end if;
  return new;
end $$;
create trigger match_player_stats_award after insert or update of elo_after on public.match_player_stats
  for each row execute function public.tg_award_match();

-- Partida borrada: lo que dio se revierte con una fila negativa (los términos lo prometen). Lo comprado no se toca.
create function public.tg_reverse_match() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into point_ledger (user_id, currency, amount, source, ref, label)
  select l.user_id, l.currency, -l.amount, 'reversal', l.source || ':' || l.ref, 'Partida borrada: ' || l.label
    from point_ledger l
   where l.ref = old.id::text and l.source in ('match', 'match_win', 'first_of_day', 'official')
  on conflict (user_id, currency, source, ref) do nothing;
  return old;
end $$;
create trigger matches_reverse_award before delete on public.matches
  for each row execute function public.tg_reverse_match();

-- Medalla: según el metal; la de temporada, según el puesto.
create function public.tg_award_medal() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_user uuid; d medal_definitions; v_key text;
begin
  select user_id into v_user from players where id = new.player_id;
  if v_user is null then return new; end if;
  if new.source = 'season' then
    if new.rank is null then return new; end if;
    select key into v_key from economy_rules
     where key ~ '^season_[0-9]+$' and enabled and substring(key from 8)::int >= new.rank
     order by substring(key from 8)::int limit 1;
    if v_key is not null then
      perform economy_award(v_user, v_key, new.id::text, 'Temporada · puesto ' || new.rank, now(), 'season');
    end if;
    return new;
  end if;
  select * into d from medal_definitions where id = new.definition_id;
  v_key := 'medal_' || coalesce(d.design->>'metal', 'oro');
  perform economy_award(v_user, v_key, new.id::text, 'Medalla: ' || new.title, now(), 'medal');
  return new;
end $$;
create trigger player_medals_award after insert on public.player_medals
  for each row execute function public.tg_award_medal();

-- Bienvenida VIP: cada alta o renovación (cada fila de vip_memberships).
create function public.tg_award_vip_welcome() returns trigger
  language plpgsql security definer set search_path = public as $$
declare r economy_rules;
begin
  select * into r from economy_rules where key = 'vip_welcome';
  if not found or not r.enabled or new.revoked_at is not null
     or new.starts_at < (select starts_at from economy_config where id = 1) then return new; end if;
  perform points_award(new.user_id, 'vip', 'vip_welcome', new.id::text, r.vip_coins, 'Mes de VIP');
  return new;
end $$;
create trigger vip_memberships_award after insert on public.vip_memberships
  for each row execute function public.tg_award_vip_welcome();

-- ---------- 5. Tienda ----------
create table public.shop_items (
  id          text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  kind        text not null check (kind in ('frame', 'sticker', 'theme', 'name', 'background')),
  name        text not null check (char_length(name) between 1 and 60),
  description text check (char_length(description) <= 200),
  file        text check (char_length(file) <= 120),
  css_class   text check (char_length(css_class) <= 60),
  vip_only    boolean not null default false,
  vip_reward  boolean not null default false,
  animated    boolean not null default false,
  collection  text not null default 'cs' check (collection ~ '^[a-z0-9]{2,20}$'),
  price       int check (price between 1 and 1000000),
  vip_price   int check (vip_price between 1 and 1000000),
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  check ((file is null) <> (css_class is null)),
  check (not vip_only or price is null),
  check (vip_only or vip_price is null),
  check (not vip_reward or (vip_only and vip_price is null))
);
comment on table public.shop_items is 'Catálogo de cosméticos (mismo id que catalogo.json). price en puntos; vip_price en monedas VIP. Replanteo 110';
-- El pack de un artículo: lo que queda del id sin el prefijo del tipo (pais-ar, serie-ninja…).
create function public.shop_theme(p_id text) returns text language sql immutable as $$
  select regexp_replace(p_id, '^(marco|sticker|tema|nombre|fondo)-', '') $$;

create table public.user_items (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  item_id     text not null references public.shop_items(id) on delete cascade,
  source      text not null check (source in ('purchase', 'bundle', 'grant')),
  currency    text check (currency in ('points', 'vip')),
  price_paid  int check (price_paid >= 0),
  granted_by  uuid references public.profiles(id) on delete set null,
  note        text check (char_length(note) <= 200),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create table public.user_cosmetics (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  frame      text references public.shop_items(id) on delete set null,
  theme      text references public.shop_items(id) on delete set null,
  name       text references public.shop_items(id) on delete set null,
  background text references public.shop_items(id) on delete set null,
  stickers   text[] not null default '{}' check (cardinality(stickers) <= 3),
  updated_at timestamptz not null default now()
);
create table public.user_wishlist (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  item_id    text not null references public.shop_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.shop_items enable row level security;
alter table public.user_items enable row level security;
alter table public.user_cosmetics enable row level security;
alter table public.user_wishlist enable row level security;
revoke all on public.shop_items, public.user_items, public.user_cosmetics, public.user_wishlist from anon, authenticated;
grant select on public.shop_items to anon, authenticated;
grant select on public.user_items, public.user_cosmetics, public.user_wishlist to authenticated;
create policy shop_items_read on public.shop_items for select using (true);
create policy user_items_read on public.user_items for select to authenticated using (user_id = auth.uid() or is_admin());
create policy user_cosmetics_read on public.user_cosmetics for select to authenticated using (user_id = auth.uid() or is_admin());
create policy user_wishlist_read on public.user_wishlist for select to authenticated using (user_id = auth.uid());

-- El premio VIP mientras sea VIP; lo demás si lo tiene, y lo VIP solo mientras sea VIP (congelado si no).
create function public.can_use_item(p_user uuid, p_item text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_items i where i.id = p_item
                   and case when i.vip_reward then is_vip(p_user)
                            else exists (select 1 from user_items u where u.user_id = p_user and u.item_id = i.id)
                                 and (not i.vip_only or is_vip(p_user)) end) $$;
revoke all on function public.can_use_item(uuid, text) from public;
grant execute on function public.can_use_item(uuid, text) to anon, authenticated, service_role;

-- Las ofertas de la semana: mezcladas con la semana ISO de Bogotá como semilla.
create function public.shop_weekly() returns setof text
  language sql stable security definer set search_path = public as $$
  select id from shop_items where active and price is not null and not vip_only
   order by md5(id || to_char(now() at time zone 'America/Bogota', 'IYYY-IW'))
   limit (select weekly_count from economy_config where id = 1) $$;
grant execute on function public.shop_weekly() to anon, authenticated, service_role;

create view public.shop_catalog with (security_invoker = false) as
select i.id, i.kind, i.name, i.description, i.file, i.css_class, i.vip_only, i.vip_reward, i.animated, i.collection,
       shop_theme(i.id) as theme, i.price as base_price,
       case when i.price is null then null
            when w.id is not null then greatest(1, round(i.price * (100 - c.weekly_discount) / 100.0)::int)
            else i.price end as price,
       i.vip_price, w.id is not null as weekly,
       (date_trunc('week', now() at time zone 'America/Bogota') + interval '7 days') at time zone 'America/Bogota' as weekly_ends,
       i.sort
  from shop_items i cross join economy_config c left join shop_weekly() w(id) on w.id = i.id
 where i.active and c.id = 1;
comment on view public.shop_catalog is 'Catálogo activo con el precio de hoy (ofertas de la semana incluidas)';
grant select on public.shop_catalog to anon, authenticated;

/** Compra un artículo: lo normal con puntos (precio de hoy), lo VIP con monedas VIP siendo VIP. */
create function public.shop_buy(p_item text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); i shop_items; v_cur text; v_price int; v_bal int;
begin
  if v_uid is null then raise exception 'Iniciá sesión para comprar' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));
  select * into i from shop_items where id = p_item;
  if not found or not i.active then raise exception 'Ese artículo no está en la tienda' using errcode = 'P0002'; end if;
  if i.vip_reward then raise exception 'Ese artículo viene con el VIP: no se compra'; end if;
  if exists (select 1 from user_items where user_id = v_uid and item_id = p_item) then
    raise exception 'Ya lo tenés' using errcode = '23505';
  end if;
  if i.vip_only then
    if not is_vip(v_uid) then raise exception 'Los artículos VIP se compran siendo VIP' using errcode = '42501'; end if;
    v_cur := 'vip'; v_price := i.vip_price;
  else
    v_cur := 'points'; select price into v_price from shop_catalog where id = p_item;
  end if;
  if v_price is null then raise exception 'Ese artículo no está a la venta'; end if;
  select case v_cur when 'vip' then vip_coins else points end into v_bal from wallet_of(v_uid);
  if v_bal < v_price then
    raise exception 'Te faltan % %', v_price - v_bal, case v_cur when 'vip' then 'monedas VIP' else 'puntos' end
     ;
  end if;
  insert into user_items (user_id, item_id, source, currency, price_paid) values (v_uid, p_item, 'purchase', v_cur, v_price);
  perform points_award(v_uid, v_cur, 'purchase', p_item, -v_price, i.name, v_uid);
  return jsonb_build_object('item', p_item, 'currency', v_cur, 'price_paid', v_price, 'balance', v_bal - v_price);
end $$;

/** Compra lo que falta de un pack (shop_theme) con descuento. Todo en una moneda: puntos o, si es VIP, monedas VIP. */
create function public.shop_buy_bundle(p_theme text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_cur text; v_full int; v_price int; v_bal int; v_n int; v_all int; v_vip int;
begin
  if v_uid is null then raise exception 'Iniciá sesión para comprar' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));
  select count(*), count(*) filter (where vip_only) into v_all, v_vip
    from shop_items where active and not vip_reward and shop_theme(id) = p_theme;
  if v_all < 3 or (v_vip > 0 and v_vip < v_all) then raise exception 'Ese pack no existe' using errcode = 'P0002'; end if;
  v_cur := case when v_vip > 0 then 'vip' else 'points' end;
  if v_cur = 'vip' and not is_vip(v_uid) then raise exception 'Los packs VIP se compran siendo VIP' using errcode = '42501'; end if;
  select count(*), sum(case v_cur when 'vip' then vip_price else price end) into v_n, v_full
    from shop_items i where active and not vip_reward and shop_theme(id) = p_theme
     and not exists (select 1 from user_items u where u.user_id = v_uid and u.item_id = i.id);
  if v_n = 0 then raise exception 'Ya tenés todo el pack' using errcode = '23505'; end if;
  if exists (select 1 from shop_items i where active and not vip_reward and shop_theme(id) = p_theme
                and (case v_cur when 'vip' then vip_price else price end) is null
                and not exists (select 1 from user_items u where u.user_id = v_uid and u.item_id = i.id)) then
    raise exception 'Algo del pack no está a la venta';
  end if;
  v_price := round(v_full * (100 - (select bundle_discount from economy_config where id = 1)) / 100.0)::int;
  select case v_cur when 'vip' then vip_coins else points end into v_bal from wallet_of(v_uid);
  if v_bal < v_price then
    raise exception 'Te faltan % %', v_price - v_bal, case v_cur when 'vip' then 'monedas VIP' else 'puntos' end
     ;
  end if;
  -- El precio de cada artículo es su parte del total, para que la suma de user_items dé lo pagado.
  insert into user_items (user_id, item_id, source, currency, price_paid)
  select v_uid, i.id, 'bundle', v_cur,
         round((case v_cur when 'vip' then i.vip_price else i.price end) * v_price::numeric / v_full)::int
    from shop_items i where active and not vip_reward and shop_theme(id) = p_theme
     and not exists (select 1 from user_items u where u.user_id = v_uid and u.item_id = i.id);
  perform points_award(v_uid, v_cur, 'purchase', 'pack-' || p_theme || '-' || extract(epoch from now())::bigint,
                       -v_price, 'Pack ' || p_theme, v_uid);
  return jsonb_build_object('theme', p_theme, 'items', v_n, 'currency', v_cur, 'price_paid', v_price, 'full', v_full,
                            'balance', v_bal - v_price);
end $$;

/** Cambia lo puesto. p_data con frame, theme, name, background (null o "" lo saca) y stickers (hasta 3). */
create function public.set_my_cosmetics(p_data jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r user_cosmetics; k text; v text; st text[];
begin
  if v_uid is null then raise exception 'Iniciá sesión' using errcode = '42501'; end if;
  if jsonb_typeof(p_data) <> 'object' then raise exception 'Datos inválidos'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));
  insert into user_cosmetics (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into r from user_cosmetics where user_id = v_uid;
  foreach k in array array['frame', 'theme', 'name', 'background'] loop
    if p_data ? k then
      v := nullif(p_data ->> k, '');
      if v is not null then
        if not exists (select 1 from shop_items where id = v and kind = k) then
          raise exception 'Ese artículo no es del tipo %', k;
        end if;
        if not can_use_item(v_uid, v) then raise exception 'Todavía no tenés ese artículo' using errcode = '42501'; end if;
      end if;
      case k when 'frame' then r.frame := v; when 'theme' then r.theme := v; when 'name' then r.name := v;
             else r.background := v; end case;
    end if;
  end loop;
  if p_data ? 'stickers' then
    if jsonb_typeof(p_data -> 'stickers') <> 'array' then raise exception 'stickers tiene que ser una lista'; end if;
    select coalesce(array_agg(x order by o), '{}') into st
      from (select distinct on (x) x, o from jsonb_array_elements_text(p_data -> 'stickers') with ordinality t(x, o)
             where x <> '' order by x, o) s;
    if cardinality(st) > 3 then raise exception 'Podés equipar hasta 3 stickers'; end if;
    foreach v in array st loop
      if not exists (select 1 from shop_items where id = v and kind = 'sticker') then
        raise exception 'Ese artículo no es un sticker';
      end if;
      if not can_use_item(v_uid, v) then raise exception 'Todavía no tenés ese sticker' using errcode = '42501'; end if;
    end loop;
    r.stickers := st;
  end if;
  update user_cosmetics set frame = r.frame, theme = r.theme, name = r.name, background = r.background,
         stickers = r.stickers, updated_at = now() where user_id = v_uid;
  return jsonb_build_object('frame', r.frame, 'theme', r.theme, 'name', r.name, 'background', r.background,
                            'stickers', to_jsonb(r.stickers));
end $$;

create function public.wishlist_toggle(p_item text) returns boolean
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Iniciá sesión' using errcode = '42501'; end if;
  if not exists (select 1 from shop_items where id = p_item) then raise exception 'No existe ese artículo' using errcode = 'P0002'; end if;
  delete from user_wishlist where user_id = v_uid and item_id = p_item;
  if found then return false; end if;
  if (select count(*) from user_wishlist where user_id = v_uid) >= 100 then
    raise exception 'La lista de deseos llega hasta 100';
  end if;
  insert into user_wishlist (user_id, item_id) values (v_uid, p_item);
  return true;
end $$;

/** Billetera de la cuenta: saldos, si es VIP (si no, las monedas están congeladas) y partidas con premio hoy. */
create function public.my_wallet() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('points', w.points, 'vip_coins', w.vip_coins, 'vip', is_vip(auth.uid()),
                            'matches_today', matches_awarded_today(auth.uid()),
                            'daily_match_cap', (select daily_match_cap from economy_config where id = 1))
    from wallet_of(auth.uid()) w where auth.uid() is not null $$;

/** Historial: lo más nuevo primero, por moneda (null = las dos), paginado por id. El dueño o un admin. */
create function public.my_ledger(p_user uuid default auth.uid(), p_currency text default null, p_before bigint default null,
                                 p_limit int default 50)
  returns table (id bigint, created_at timestamptz, currency text, amount int, source text, ref text, label text)
  language plpgsql stable security definer set search_path = public as $$
begin
  if p_user is null or (p_user <> auth.uid() and not is_admin()) then
    raise exception 'No podés ver los puntos de otra cuenta' using errcode = '42501';
  end if;
  return query select l.id, l.created_at, l.currency, l.amount, l.source, l.ref, l.label from point_ledger l
   where l.user_id = p_user and (p_currency is null or l.currency = p_currency) and (p_before is null or l.id < p_before)
   order by l.id desc limit least(greatest(coalesce(p_limit, 50), 1), 200);
end $$;

/** Inventario de la cuenta: lo que tiene (más el premio VIP siendo VIP), si lo puede usar y si lo tiene puesto. */
create function public.my_inventory()
  returns table (item_id text, source text, currency text, price_paid int, acquired_at timestamptz, usable boolean,
                 equipped boolean)
  language sql stable security definer set search_path = public as $$
  with c as (select * from user_cosmetics where user_id = auth.uid()),
  mine as (
    select u.item_id, u.source, u.currency, u.price_paid, u.acquired_at from user_items u where u.user_id = auth.uid()
    union all
    select i.id, 'vip', null, null, null from shop_items i where i.vip_reward and is_vip(auth.uid())
  )
  select m.*, can_use_item(auth.uid(), m.item_id),
         coalesce(m.item_id in (c.frame, c.theme, c.name, c.background) or m.item_id = any (c.stickers), false)
    from mine m left join c on true
   where auth.uid() is not null $$;

-- Lo que tiene puesto cada ficha con cuenta, sin lo que no puede usar hoy. Pública: la usan el perfil y el lobby.
create view public.player_cosmetics_public as
select p.id as player_id, c.user_id, is_vip(c.user_id) as vip,
       case when can_use_item(c.user_id, c.frame) then c.frame end as frame,
       case when can_use_item(c.user_id, c.theme) then c.theme end as theme,
       case when can_use_item(c.user_id, c.name) then c.name end as name,
       case when can_use_item(c.user_id, c.background) then c.background end as background,
       coalesce((select array_agg(s order by o) from unnest(c.stickers) with ordinality u(s, o)
                  where can_use_item(c.user_id, s)), '{}') as stickers
  from user_cosmetics c join players p on p.user_id = c.user_id;
grant select on public.player_cosmetics_public to anon, authenticated;

revoke all on function public.shop_buy(text), public.shop_buy_bundle(text), public.set_my_cosmetics(jsonb),
  public.wishlist_toggle(text), public.my_wallet(), public.my_ledger(uuid, text, bigint, int), public.my_inventory()
  from public, anon;
grant execute on function public.shop_buy(text), public.shop_buy_bundle(text), public.set_my_cosmetics(jsonb),
  public.wishlist_toggle(text), public.my_wallet(), public.my_ledger(uuid, text, bigint, int), public.my_inventory()
  to authenticated, service_role;

-- ---------- 6. Admin ----------
create function public.admin_points_grant(p_user uuid, p_currency text, p_amount int, p_reason text) returns bigint
  language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not is_admin() then raise exception 'Solo un administrador puede dar puntos' using errcode = '42501'; end if;
  if p_currency not in ('points', 'vip') then raise exception 'Moneda inválida'; end if;
  if coalesce(p_amount, 0) = 0 then raise exception 'La cantidad no puede ser 0'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then
    raise exception 'El motivo es obligatorio (hasta 200 caracteres)';
  end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No existe ese usuario' using errcode = 'P0002'; end if;
  insert into point_ledger (user_id, currency, amount, source, ref, label, created_by)
  values (p_user, p_currency, p_amount, 'grant', gen_random_uuid()::text, btrim(p_reason), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create function public.admin_economy_set(p_daily_match_cap int, p_weekly_count int, p_weekly_discount int,
                                         p_bundle_discount int) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar la economía' using errcode = '42501'; end if;
  update economy_config set daily_match_cap = p_daily_match_cap, weekly_count = p_weekly_count,
         weekly_discount = p_weekly_discount, bundle_discount = p_bundle_discount, updated_at = now(), updated_by = auth.uid()
   where id = 1;
end $$;

create function public.admin_economy_rule_set(p_key text, p_points int, p_vip_coins int, p_enabled boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar la economía' using errcode = '42501'; end if;
  update economy_rules set points = coalesce(p_points, points), vip_coins = coalesce(p_vip_coins, vip_coins),
         enabled = coalesce(p_enabled, enabled), updated_at = now(), updated_by = auth.uid()
   where key = p_key;
  if not found then raise exception 'No existe esa regla' using errcode = 'P0002'; end if;
end $$;

/** Cambia un artículo. null no toca; p_no_price saca de la venta (precio en puntos o en monedas VIP, según el tipo). */
create function public.admin_shop_item_update(p_item text, p_price int default null, p_active boolean default null,
                                              p_no_price boolean default false) returns void
  language plpgsql security definer set search_path = public as $$
declare i shop_items;
begin
  if not is_admin() then raise exception 'Solo un administrador puede editar la tienda' using errcode = '42501'; end if;
  select * into i from shop_items where id = p_item;
  if not found then raise exception 'No existe ese artículo' using errcode = 'P0002'; end if;
  if p_price is not null and p_price < 1 then raise exception 'El precio tiene que ser mayor a 0'; end if;
  if i.vip_reward and (p_price is not null) then raise exception 'Ese artículo viene con el VIP: no tiene precio'; end if;
  if i.vip_only then
    update shop_items set vip_price = case when p_no_price then null else coalesce(p_price, vip_price) end,
           active = coalesce(p_active, active) where id = p_item;
  else
    update shop_items set price = case when p_no_price then null else coalesce(p_price, price) end,
           active = coalesce(p_active, active) where id = p_item;
  end if;
end $$;

create function public.admin_item_grant(p_user uuid, p_item text, p_note text default null) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede regalar artículos' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No existe ese usuario' using errcode = 'P0002'; end if;
  if not exists (select 1 from shop_items where id = p_item and not vip_reward) then
    raise exception 'Ese artículo no se puede regalar';
  end if;
  insert into user_items (user_id, item_id, source, granted_by, note)
  values (p_user, p_item, 'grant', auth.uid(), nullif(btrim(p_note), '')) on conflict (user_id, item_id) do nothing;
  if not found then raise exception 'Ya lo tiene' using errcode = '23505'; end if;
end $$;

-- Quita un artículo del inventario y de lo puesto. No devuelve nada (para eso, admin_points_grant).
create function public.admin_item_revoke(p_user uuid, p_item text, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede quitar artículos' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then
    raise exception 'El motivo es obligatorio (hasta 200 caracteres)';
  end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || p_user::text));
  delete from user_items where user_id = p_user and item_id = p_item;
  if not found then raise exception 'No tiene ese artículo' using errcode = 'P0002'; end if;
  update user_cosmetics set frame = nullif(frame, p_item), theme = nullif(theme, p_item), name = nullif(name, p_item),
         background = nullif(background, p_item), stickers = array_remove(stickers, p_item), updated_at = now()
   where user_id = p_user;
end $$;

/** Saldos de todas las cuentas con algo en el registro o en el inventario. Solo admins. */
create function public.admin_wallets(p_q text default null, p_limit int default 50, p_offset int default 0)
  returns table (user_id uuid, alias text, player_id uuid, nick text, vip boolean, points int, vip_coins int,
                 earned int, spent int, items int, total bigint)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return query
  with a as (
    select pr.id, pr.tag, pl.id pid, pl.nick
      from profiles pr left join players pl on pl.user_id = pr.id
     where (exists (select 1 from point_ledger l where l.user_id = pr.id) or exists (select 1 from user_items u where u.user_id = pr.id))
       and (p_q is null or pr.tag ilike '%' || p_q || '%' or pl.nick ilike '%' || p_q || '%')
  )
  select a.id, a.tag, a.pid, a.nick, is_vip(a.id), w.points, w.vip_coins,
         (select coalesce(sum(amount), 0)::int from point_ledger l where l.user_id = a.id and l.currency = 'points' and l.amount > 0 and l.source <> 'grant'),
         (select coalesce(-sum(amount), 0)::int from point_ledger l where l.user_id = a.id and l.source = 'purchase'),
         (select count(*)::int from user_items u where u.user_id = a.id),
         count(*) over ()
    from a cross join lateral wallet_of(a.id) w
   order by w.points desc, a.tag
   limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end $$;

revoke all on function public.admin_points_grant(uuid, text, int, text), public.admin_economy_set(int, int, int, int),
  public.admin_economy_rule_set(text, int, int, boolean), public.admin_shop_item_update(text, int, boolean, boolean),
  public.admin_item_grant(uuid, text, text), public.admin_item_revoke(uuid, text, text),
  public.admin_wallets(text, int, int) from public, anon;
grant execute on function public.admin_points_grant(uuid, text, int, text), public.admin_economy_set(int, int, int, int),
  public.admin_economy_rule_set(text, int, int, boolean), public.admin_shop_item_update(text, int, boolean, boolean),
  public.admin_item_grant(uuid, text, text), public.admin_item_revoke(uuid, text, text),
  public.admin_wallets(text, int, int) to authenticated, service_role;

-- ---------- Carga del catálogo ----------
-- Generado con docs/bitacora/2026-11-11-tienda/pruebas/generar_catalogo_110.py desde web/frontend/public/cosmetics/catalogo.json.
-- --- inicio: catálogo generado ---
insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, vip_reward, animated, collection, price, vip_price, sort) values
  ('marco-vip-oro', 'frame', 'Oro VIP', 'Viene con el VIP: marco de oro con corona.', 'marcos/vip-oro.svg', null, true, true, true, 'vip', null, null, 10),
  ('marco-mira', 'frame', 'Mira', 'Esquinas tácticas y mira que respira.', 'marcos/mira.svg', null, false, false, true, 'cs', 1200, null, 20),
  ('marco-trazadoras', 'frame', 'Trazadoras', 'Balas trazadoras que dan la vuelta al avatar.', 'marcos/trazadoras.svg', null, false, false, true, 'cs', 1200, null, 30),
  ('marco-c4', 'frame', 'C4', 'Cinta de peligro, cables y la cuenta regresiva.', 'marcos/c4.svg', null, false, false, true, 'cs', 1200, null, 40),
  ('marco-circuito', 'frame', 'Circuito', 'Pistas verdes con pulsos de energía.', 'marcos/circuito.svg', null, false, false, true, 'cs', 1200, null, 50),
  ('marco-fuego', 'frame', 'Fuego', 'Llamas vivas y chispas que suben.', 'marcos/fuego.svg', null, false, false, true, 'cs', 1200, null, 60),
  ('marco-camuflaje', 'frame', 'Camuflaje', 'Patrón militar con placas de identificación.', 'marcos/camuflaje.svg', null, false, false, false, 'cs', 900, null, 70),
  ('marco-hielo', 'frame', 'Hielo', 'Escarcha, carámbanos y nieve que cae.', 'marcos/hielo.svg', null, false, false, true, 'cs', 1200, null, 80),
  ('marco-balas', 'frame', 'Cinta de balas', 'Cartuchos de bronce alrededor del avatar.', 'marcos/balas.svg', null, false, false, false, 'cs', 900, null, 90),
  ('marco-pixel', 'frame', 'Píxel', 'Borde de 8 bits que se mueve.', 'marcos/pixel.svg', null, false, false, true, 'cs', 1200, null, 100),
  ('marco-grafiti', 'frame', 'Grafiti', 'Pintura en aerosol que chorrea.', 'marcos/grafiti.svg', null, false, false, true, 'cs', 1200, null, 110),
  ('marco-pais-ar', 'frame', 'Argentina', 'Los colores de Argentina alrededor del avatar.', 'marcos/pais-ar.svg', null, false, false, true, 'paises', 1000, null, 120),
  ('marco-pais-br', 'frame', 'Brasil', 'Los colores de Brasil alrededor del avatar.', 'marcos/pais-br.svg', null, false, false, true, 'paises', 1000, null, 130),
  ('marco-pais-uy', 'frame', 'Uruguay', 'Los colores de Uruguay alrededor del avatar.', 'marcos/pais-uy.svg', null, false, false, true, 'paises', 1000, null, 140),
  ('marco-pais-cl', 'frame', 'Chile', 'Los colores de Chile alrededor del avatar.', 'marcos/pais-cl.svg', null, false, false, true, 'paises', 1000, null, 150),
  ('marco-pais-pe', 'frame', 'Perú', 'Los colores de Perú alrededor del avatar.', 'marcos/pais-pe.svg', null, false, false, true, 'paises', 1000, null, 160),
  ('marco-pais-co', 'frame', 'Colombia', 'Los colores de Colombia alrededor del avatar.', 'marcos/pais-co.svg', null, false, false, true, 'paises', 1000, null, 170),
  ('marco-pais-ve', 'frame', 'Venezuela', 'Los colores de Venezuela alrededor del avatar.', 'marcos/pais-ve.svg', null, false, false, true, 'paises', 1000, null, 180),
  ('marco-pais-ec', 'frame', 'Ecuador', 'Los colores de Ecuador alrededor del avatar.', 'marcos/pais-ec.svg', null, false, false, true, 'paises', 1000, null, 190),
  ('marco-pais-bo', 'frame', 'Bolivia', 'Los colores de Bolivia alrededor del avatar.', 'marcos/pais-bo.svg', null, false, false, true, 'paises', 1000, null, 200),
  ('marco-pais-py', 'frame', 'Paraguay', 'Los colores de Paraguay alrededor del avatar.', 'marcos/pais-py.svg', null, false, false, true, 'paises', 1000, null, 210),
  ('marco-pais-mx', 'frame', 'México', 'Los colores de México alrededor del avatar.', 'marcos/pais-mx.svg', null, false, false, true, 'paises2', 1000, null, 220),
  ('marco-pais-cr', 'frame', 'Costa Rica', 'Los colores de Costa Rica alrededor del avatar.', 'marcos/pais-cr.svg', null, false, false, true, 'paises2', 1000, null, 230),
  ('marco-pais-cu', 'frame', 'Cuba', 'Los colores de Cuba alrededor del avatar.', 'marcos/pais-cu.svg', null, false, false, true, 'paises2', 1000, null, 240),
  ('marco-pais-do', 'frame', 'Rep. Dominicana', 'Los colores de Rep. Dominicana alrededor del avatar.', 'marcos/pais-do.svg', null, false, false, true, 'paises2', 1000, null, 250),
  ('marco-pais-pr', 'frame', 'Puerto Rico', 'Los colores de Puerto Rico alrededor del avatar.', 'marcos/pais-pr.svg', null, false, false, true, 'paises2', 1000, null, 260),
  ('marco-pais-pa', 'frame', 'Panamá', 'Los colores de Panamá alrededor del avatar.', 'marcos/pais-pa.svg', null, false, false, true, 'paises2', 1000, null, 270),
  ('marco-pais-gt', 'frame', 'Guatemala', 'Los colores de Guatemala alrededor del avatar.', 'marcos/pais-gt.svg', null, false, false, true, 'paises2', 1000, null, 280),
  ('marco-pais-hn', 'frame', 'Honduras', 'Los colores de Honduras alrededor del avatar.', 'marcos/pais-hn.svg', null, false, false, true, 'paises2', 1000, null, 290),
  ('marco-pais-sv', 'frame', 'El Salvador', 'Los colores de El Salvador alrededor del avatar.', 'marcos/pais-sv.svg', null, false, false, true, 'paises2', 1000, null, 300),
  ('marco-pais-es', 'frame', 'España', 'Los colores de España alrededor del avatar.', 'marcos/pais-es.svg', null, false, false, true, 'paises2', 1000, null, 310),
  ('marco-mapa-dust2', 'frame', 'de_dust2', 'Arena, muros de adobe y la larga de toda la vida.', 'marcos/mapa-dust2.svg', null, false, false, false, 'mapas', 900, null, 320),
  ('marco-mapa-inferno', 'frame', 'de_inferno', 'Ladrillo italiano y la banana.', 'marcos/mapa-inferno.svg', null, false, false, false, 'mapas', 900, null, 330),
  ('marco-mapa-nuke', 'frame', 'de_nuke', 'Planta nuclear con franjas de peligro.', 'marcos/mapa-nuke.svg', null, false, false, false, 'mapas', 900, null, 340),
  ('marco-mapa-train', 'frame', 'de_train', 'Vías, vagones y metal.', 'marcos/mapa-train.svg', null, false, false, false, 'mapas', 900, null, 350),
  ('marco-mapa-office', 'frame', 'cs_office', 'Nieve afuera y rehenes adentro.', 'marcos/mapa-office.svg', null, false, false, false, 'mapas', 900, null, 360),
  ('marco-mapa-aztec', 'frame', 'de_aztec', 'Selva, templo y el puente colgante.', 'marcos/mapa-aztec.svg', null, false, false, false, 'mapas', 900, null, 370),
  ('marco-mapa-cbble', 'frame', 'de_cbble', 'Adoquines y murallas de castillo.', 'marcos/mapa-cbble.svg', null, false, false, false, 'mapas', 900, null, 380),
  ('marco-mapa-italy', 'frame', 'cs_italy', 'Techos de teja y el mercado.', 'marcos/mapa-italy.svg', null, false, false, false, 'mapas', 900, null, 390),
  ('marco-mapa-piranesi', 'frame', 'de_piranesi', 'Ruinas de piedra y arcos.', 'marcos/mapa-piranesi.svg', null, false, false, false, 'mapas', 900, null, 400),
  ('marco-mapa-prodigy', 'frame', 'de_prodigy', 'Laboratorio subterráneo y rejillas.', 'marcos/mapa-prodigy.svg', null, false, false, false, 'mapas', 900, null, 410),
  ('marco-kevlar', 'frame', 'Kevlar', 'Placa blindada con trama hexagonal.', 'marcos/kevlar.svg', null, true, false, true, 'cs', null, 1000, 420),
  ('marco-neon', 'frame', 'Neón', 'Degradado rosa, violeta y cian que gira sin parar.', 'marcos/neon.svg', null, true, false, true, 'cs', null, 1000, 430),
  ('marco-oro-vip', 'frame', 'Oro VIP', 'Corona, laureles y destello dorado.', 'marcos/oro-vip.svg', null, true, false, true, 'cs', null, 1000, 440),
  ('marco-diamante', 'frame', 'Diamante', 'Facetas de cristal con destellos.', 'marcos/diamante.svg', null, true, false, true, 'cs', null, 1000, 450),
  ('marco-plasma', 'frame', 'Plasma', 'Descargas eléctricas violetas.', 'marcos/plasma.svg', null, true, false, true, 'cs', null, 1000, 460),
  ('marco-galaxia', 'frame', 'Galaxia', 'Nebulosas que giran y estrellas fugaces.', 'marcos/galaxia.svg', null, true, false, true, 'cs', null, 1000, 470),
  ('marco-holografico', 'frame', 'Holográfico', 'Iridiscente, cambia de color sin parar.', 'marcos/holografico.svg', null, true, false, true, 'cs', null, 1000, 480),
  ('marco-laser', 'frame', 'Láser', 'Mira láser que barre el avatar.', 'marcos/laser.svg', null, true, false, true, 'cs', null, 1000, 490),
  ('marco-glitch', 'frame', 'Glitch', 'Señal rota en rojo y cian.', 'marcos/glitch.svg', null, true, false, true, 'cs', null, 1000, 500),
  ('marco-alas', 'frame', 'Alas', 'Alas blancas y aureola dorada.', 'marcos/alas.svg', null, true, false, true, 'cs', null, 1000, 510),
  ('marco-serie-ninja', 'frame', 'Shinobi', 'Espiral, cinta y shurikens que giran.', 'marcos/serie-ninja.svg', null, true, false, true, 'series', null, 1000, 520),
  ('marco-serie-guerrero', 'frame', 'Súper guerrero', 'Aura dorada que arde y rayos que chispean.', 'marcos/serie-guerrero.svg', null, true, false, true, 'series', null, 1000, 530),
  ('marco-serie-alien', 'frame', 'Reloj alien', 'Panel verde con el dial que transforma.', 'marcos/serie-alien.svg', null, true, false, true, 'series', null, 1000, 540),
  ('marco-serie-portal', 'frame', 'Portal', 'Un portal verde a otra dimensión que no para de girar.', 'marcos/serie-portal.svg', null, true, false, true, 'series', null, 1000, 550),
  ('marco-serie-navaja', 'frame', 'Gorra y navaja', 'Marco art déco de 1919 con una navaja en la visera.', 'marcos/serie-navaja.svg', null, true, false, true, 'series', null, 1000, 560),
  ('marco-serie-laboratorio', 'frame', 'Laboratorio', 'Cristales azules, burbujas y la tabla periódica de CS:S.', 'marcos/serie-laboratorio.svg', null, true, false, true, 'series', null, 1000, 570),
  ('marco-serie-reves', 'frame', 'Mundo del revés', 'Luces de colores que titilan y esporas en el aire.', 'marcos/serie-reves.svg', null, true, false, true, 'series', null, 1000, 580),
  ('marco-serie-reinos', 'frame', 'Reinos', 'Acero, espadas, una corona y nieve que cae.', 'marcos/serie-reinos.svg', null, true, false, true, 'series', null, 1000, 590),
  ('marco-serie-atraco', 'frame', 'Atraco', 'Mono rojo, lingote de oro y billetes volando.', 'marcos/serie-atraco.svg', null, true, false, true, 'series', null, 1000, 600),
  ('marco-serie-juego', 'frame', 'Juego mortal', 'Círculo, triángulo y cuadrado. Jugador N°034.', 'marcos/serie-juego.svg', null, true, false, true, 'series', null, 1000, 610),
  ('marco-arma-ak', 'frame', 'AK-47 Lava', 'Acabado Lava con el arma abajo y un brillo que corre.', 'marcos/arma-ak.svg', null, true, false, true, 'arsenal', null, 1000, 620),
  ('marco-arma-m4', 'frame', 'M4A1 Ártico', 'Acabado Ártico con el arma abajo y un brillo que corre.', 'marcos/arma-m4.svg', null, true, false, true, 'arsenal', null, 1000, 630),
  ('marco-arma-awp', 'frame', 'AWP Relámpago', 'Acabado Relámpago con el arma abajo y un brillo que corre.', 'marcos/arma-awp.svg', null, true, false, true, 'arsenal', null, 1000, 640),
  ('marco-arma-deagle', 'frame', 'Deagle Oro macizo', 'Acabado Oro macizo con el arma abajo y un brillo que corre.', 'marcos/arma-deagle.svg', null, true, false, true, 'arsenal', null, 1000, 650),
  ('marco-arma-scout', 'frame', 'Scout Selva', 'Acabado Selva con el arma abajo y un brillo que corre.', 'marcos/arma-scout.svg', null, true, false, true, 'arsenal', null, 1000, 660),
  ('marco-arma-usp', 'frame', 'USP Medianoche', 'Acabado Medianoche con el arma abajo y un brillo que corre.', 'marcos/arma-usp.svg', null, true, false, true, 'arsenal', null, 1000, 670),
  ('marco-arma-glock', 'frame', 'Glock Caramelo', 'Acabado Caramelo con el arma abajo y un brillo que corre.', 'marcos/arma-glock.svg', null, true, false, true, 'arsenal', null, 1000, 680),
  ('marco-arma-mp5', 'frame', 'MP5 Neón', 'Acabado Neón con el arma abajo y un brillo que corre.', 'marcos/arma-mp5.svg', null, true, false, true, 'arsenal', null, 1000, 690),
  ('marco-arma-cuchillo', 'frame', 'Cuchillo Fantasma', 'Acabado Fantasma con el arma abajo y un brillo que corre.', 'marcos/arma-cuchillo.svg', null, true, false, true, 'arsenal', null, 1000, 700),
  ('marco-arma-he', 'frame', 'HE Arcoíris', 'Acabado Arcoíris con el arma abajo y un brillo que corre.', 'marcos/arma-he.svg', null, true, false, true, 'arsenal', null, 1000, 710),
  ('marco-serie-dona', 'frame', 'Dona glaseada', 'Amarillo de pueblo chico y una dona que flota.', 'marcos/serie-dona.svg', null, true, false, true, 'series2', null, 1000, 720),
  ('marco-serie-zombi', 'frame', 'Apocalipsis zombi', 'Tierra removida y una mano que sale.', 'marcos/serie-zombi.svg', null, true, false, true, 'series2', null, 1000, 730),
  ('marco-serie-barril', 'frame', 'La vecindad', 'Madera de patio y un barril para esconderse.', 'marcos/serie-barril.svg', null, true, false, true, 'series2', null, 1000, 740),
  ('marco-serie-fuga', 'frame', 'La fuga', 'Mono naranja y barrotes, con uno doblado.', 'marcos/serie-fuga.svg', null, true, false, true, 'series2', null, 1000, 750),
  ('marco-serie-radiacion', 'frame', 'Reactor 4', 'Peligro radiactivo que late.', 'marcos/serie-radiacion.svg', null, true, false, true, 'series2', null, 1000, 760),
  ('marco-serie-vikingo', 'frame', 'Vikingo', 'Madera, hierro y el casco con cuernos.', 'marcos/serie-vikingo.svg', null, true, false, true, 'series2', null, 1000, 770),
  ('marco-serie-elementos', 'frame', 'Cuatro elementos', 'Agua, tierra, fuego y aire girando.', 'marcos/serie-elementos.svg', null, true, false, true, 'series2', null, 1000, 780),
  ('marco-serie-robot', 'frame', 'Robot del futuro', 'Metal del año 3000 y luces que parpadean.', 'marcos/serie-robot.svg', null, true, false, true, 'series2', null, 1000, 790),
  ('marco-serie-fondo-mar', 'frame', 'Fondo de mar', 'Agua, burbujas y una casa con forma de fruta.', 'marcos/serie-fondo-mar.svg', null, true, false, true, 'series2', null, 1000, 800),
  ('marco-serie-isla', 'frame', 'La isla', 'Mar, arena y una palmera en medio de la nada.', 'marcos/serie-isla.svg', null, true, false, true, 'series2', null, 1000, 810),
  ('sticker-gg', 'sticker', 'GG', 'Buena partida.', 'stickers/gg.svg', null, false, false, false, 'cs', 150, null, 820),
  ('sticker-nice-shot', 'sticker', 'NICE SHOT', 'Para el tiro de la ronda.', 'stickers/nice-shot.svg', null, false, false, false, 'cs', 150, null, 830),
  ('sticker-rush-b', 'sticker', 'RUSH B', 'Sin estrategia, sin miedo.', 'stickers/rush-b.svg', null, false, false, false, 'cs', 150, null, 840),
  ('sticker-1hp', 'sticker', '1 HP', 'Vivo de milagro.', 'stickers/1hp.svg', null, false, false, false, 'cs', 150, null, 850),
  ('sticker-clutch', 'sticker', 'CLUTCH', 'Último en pie, ronda ganada.', 'stickers/clutch.svg', null, false, false, false, 'cs', 150, null, 860),
  ('sticker-nt', 'sticker', 'NT', 'Nice try, la próxima sale.', 'stickers/nt.svg', null, false, false, false, 'cs', 150, null, 870),
  ('sticker-eco', 'sticker', 'ECO', 'Ronda de ahorro.', 'stickers/eco.svg', null, false, false, false, 'cs', 150, null, 880),
  ('sticker-afk', 'sticker', 'AFK', 'Ya vuelvo.', 'stickers/afk.svg', null, false, false, false, 'cs', 150, null, 890),
  ('sticker-pais-ar', 'sticker', 'CHE', 'CHE con la bandera de Argentina.', 'stickers/pais-ar.svg', null, false, false, false, 'paises', 200, null, 900),
  ('sticker-pais-br', 'sticker', 'BORA!', 'BORA! con la bandera de Brasil.', 'stickers/pais-br.svg', null, false, false, false, 'paises', 200, null, 910),
  ('sticker-pais-uy', 'sticker', 'GARRA', 'GARRA con la bandera de Uruguay.', 'stickers/pais-uy.svg', null, false, false, false, 'paises', 200, null, 920),
  ('sticker-pais-cl', 'sticker', '¿CACHAI?', '¿CACHAI? con la bandera de Chile.', 'stickers/pais-cl.svg', null, false, false, false, 'paises', 200, null, 930),
  ('sticker-pais-pe', 'sticker', 'CAUSA', 'CAUSA con la bandera de Perú.', 'stickers/pais-pe.svg', null, false, false, false, 'paises', 200, null, 940),
  ('sticker-pais-co', 'sticker', 'PARCE', 'PARCE con la bandera de Colombia.', 'stickers/pais-co.svg', null, false, false, false, 'paises', 200, null, 950),
  ('sticker-pais-ve', 'sticker', 'CHAMO', 'CHAMO con la bandera de Venezuela.', 'stickers/pais-ve.svg', null, false, false, false, 'paises', 200, null, 960),
  ('sticker-pais-ec', 'sticker', 'PANA', 'PANA con la bandera de Ecuador.', 'stickers/pais-ec.svg', null, false, false, false, 'paises', 200, null, 970),
  ('sticker-pais-bo', 'sticker', 'JALLALLA', 'JALLALLA con la bandera de Bolivia.', 'stickers/pais-bo.svg', null, false, false, false, 'paises', 200, null, 980),
  ('sticker-pais-py', 'sticker', 'JAHA', 'JAHA con la bandera de Paraguay.', 'stickers/pais-py.svg', null, false, false, false, 'paises', 200, null, 990),
  ('sticker-pais-mx', 'sticker', 'CHIDO', 'CHIDO con la bandera de México.', 'stickers/pais-mx.svg', null, false, false, false, 'paises2', 200, null, 1000),
  ('sticker-pais-cr', 'sticker', 'PURA VIDA', 'PURA VIDA con la bandera de Costa Rica.', 'stickers/pais-cr.svg', null, false, false, false, 'paises2', 200, null, 1010),
  ('sticker-pais-cu', 'sticker', 'ASERE', 'ASERE con la bandera de Cuba.', 'stickers/pais-cu.svg', null, false, false, false, 'paises2', 200, null, 1020),
  ('sticker-pais-do', 'sticker', 'KLK', 'KLK con la bandera de Rep. Dominicana.', 'stickers/pais-do.svg', null, false, false, false, 'paises2', 200, null, 1030),
  ('sticker-pais-pr', 'sticker', 'WEPA', 'WEPA con la bandera de Puerto Rico.', 'stickers/pais-pr.svg', null, false, false, false, 'paises2', 200, null, 1040),
  ('sticker-pais-pa', 'sticker', 'XOPA', 'XOPA con la bandera de Panamá.', 'stickers/pais-pa.svg', null, false, false, false, 'paises2', 200, null, 1050),
  ('sticker-pais-gt', 'sticker', 'CHILERO', 'CHILERO con la bandera de Guatemala.', 'stickers/pais-gt.svg', null, false, false, false, 'paises2', 200, null, 1060),
  ('sticker-pais-hn', 'sticker', 'CATRACHO', 'CATRACHO con la bandera de Honduras.', 'stickers/pais-hn.svg', null, false, false, false, 'paises2', 200, null, 1070),
  ('sticker-pais-sv', 'sticker', 'CHIVO', 'CHIVO con la bandera de El Salvador.', 'stickers/pais-sv.svg', null, false, false, false, 'paises2', 200, null, 1080),
  ('sticker-pais-es', 'sticker', 'MOLA', 'MOLA con la bandera de España.', 'stickers/pais-es.svg', null, false, false, false, 'paises2', 200, null, 1090),
  ('sticker-mapa-dust2', 'sticker', 'de_dust2 sitio A', 'El cartel del sitio A de de_dust2.', 'stickers/mapa-dust2.svg', null, false, false, false, 'mapas', 200, null, 1100),
  ('sticker-mapa-inferno', 'sticker', 'de_inferno sitio B', 'El cartel del sitio B de de_inferno.', 'stickers/mapa-inferno.svg', null, false, false, false, 'mapas', 200, null, 1110),
  ('sticker-mapa-nuke', 'sticker', 'de_nuke sitio A', 'El cartel del sitio A de de_nuke.', 'stickers/mapa-nuke.svg', null, false, false, false, 'mapas', 200, null, 1120),
  ('sticker-mapa-train', 'sticker', 'de_train sitio B', 'El cartel del sitio B de de_train.', 'stickers/mapa-train.svg', null, false, false, false, 'mapas', 200, null, 1130),
  ('sticker-mapa-office', 'sticker', 'cs_office sitio A', 'El cartel del sitio A de cs_office.', 'stickers/mapa-office.svg', null, false, false, false, 'mapas', 200, null, 1140),
  ('sticker-mapa-aztec', 'sticker', 'de_aztec sitio B', 'El cartel del sitio B de de_aztec.', 'stickers/mapa-aztec.svg', null, false, false, false, 'mapas', 200, null, 1150),
  ('sticker-mapa-cbble', 'sticker', 'de_cbble sitio A', 'El cartel del sitio A de de_cbble.', 'stickers/mapa-cbble.svg', null, false, false, false, 'mapas', 200, null, 1160),
  ('sticker-mapa-italy', 'sticker', 'cs_italy sitio B', 'El cartel del sitio B de cs_italy.', 'stickers/mapa-italy.svg', null, false, false, false, 'mapas', 200, null, 1170),
  ('sticker-mapa-piranesi', 'sticker', 'de_piranesi sitio A', 'El cartel del sitio A de de_piranesi.', 'stickers/mapa-piranesi.svg', null, false, false, false, 'mapas', 200, null, 1180),
  ('sticker-mapa-prodigy', 'sticker', 'de_prodigy sitio B', 'El cartel del sitio B de de_prodigy.', 'stickers/mapa-prodigy.svg', null, false, false, false, 'mapas', 200, null, 1190),
  ('sticker-ace', 'sticker', 'ACE', 'Cinco de cinco, con brillo.', 'stickers/ace.svg', null, true, false, true, 'cs', null, 200, 1200),
  ('sticker-mvp', 'sticker', 'MVP', 'La corona de la partida.', 'stickers/mvp.svg', null, true, false, true, 'cs', null, 200, 1210),
  ('sticker-headshot', 'sticker', 'HEADSHOT', 'Directo a la cabeza.', 'stickers/headshot.svg', null, true, false, true, 'cs', null, 200, 1220),
  ('sticker-one-tap', 'sticker', 'ONE TAP', 'Una bala, una baja.', 'stickers/one-tap.svg', null, true, false, true, 'cs', null, 200, 1230),
  ('sticker-defused', 'sticker', 'DEFUSED', 'Bomba desactivada en 0:00.', 'stickers/defused.svg', null, true, false, true, 'cs', null, 200, 1240),
  ('sticker-1v5', 'sticker', '1v5', 'Solo contra todos.', 'stickers/1v5.svg', null, true, false, true, 'cs', null, 200, 1250),
  ('sticker-wallbang', 'sticker', 'WALLBANG', 'A través de la pared.', 'stickers/wallbang.svg', null, true, false, true, 'cs', null, 200, 1260),
  ('sticker-ninja', 'sticker', 'NINJA', 'Defuse sin que nadie lo vea.', 'stickers/ninja.svg', null, true, false, true, 'cs', null, 200, 1270),
  ('sticker-serie-ninja', 'sticker', 'JUTSU!', 'Una nube de humo y un shuriken girando.', 'stickers/serie-ninja.svg', null, true, false, true, 'series', null, 200, 1280),
  ('sticker-serie-guerrero', 'sticker', '+9000', 'El medidor de poder explotó.', 'stickers/serie-guerrero.svg', null, true, false, true, 'series', null, 200, 1290),
  ('sticker-serie-alien', 'sticker', 'ALIEN', 'El dial verde listo para transformarte.', 'stickers/serie-alien.svg', null, true, false, true, 'series', null, 200, 1300),
  ('sticker-serie-portal', 'sticker', 'PORTAL', 'Un portal girando: ¿a qué dimensión vas?', 'stickers/serie-portal.svg', null, true, false, true, 'series', null, 200, 1310),
  ('sticker-serie-navaja', 'sticker', 'NAVAJA', 'La gorra de la banda, con filo.', 'stickers/serie-navaja.svg', null, true, false, true, 'series', null, 200, 1320),
  ('sticker-serie-laboratorio', 'sticker', 'COCINANDO', 'Elementos Cs y Ss: la química del server.', 'stickers/serie-laboratorio.svg', null, true, false, true, 'series', null, 200, 1330),
  ('sticker-serie-reves', 'sticker', 'CORRE', 'Las luces te avisan: corré.', 'stickers/serie-reves.svg', null, true, false, true, 'series', null, 200, 1340),
  ('sticker-serie-reinos', 'sticker', 'EL TRONO', 'La corona del que manda en el server.', 'stickers/serie-reinos.svg', null, true, false, true, 'series', null, 200, 1350),
  ('sticker-serie-atraco', 'sticker', 'ATRACO', 'Fajos de billetes que llueven.', 'stickers/serie-atraco.svg', null, true, false, true, 'series', null, 200, 1360),
  ('sticker-serie-juego', 'sticker', 'ELIMINADO', 'Las tres figuras se encienden por turno.', 'stickers/serie-juego.svg', null, true, false, true, 'series', null, 200, 1370),
  ('sticker-arma-ak', 'sticker', 'AK-47 Lava', 'La AK-47 con acabado Lava.', 'stickers/arma-ak.svg', null, true, false, true, 'arsenal', null, 200, 1380),
  ('sticker-arma-m4', 'sticker', 'M4A1 Ártico', 'La M4A1 con acabado Ártico.', 'stickers/arma-m4.svg', null, true, false, true, 'arsenal', null, 200, 1390),
  ('sticker-arma-awp', 'sticker', 'AWP Relámpago', 'La AWP con acabado Relámpago.', 'stickers/arma-awp.svg', null, true, false, true, 'arsenal', null, 200, 1400),
  ('sticker-arma-deagle', 'sticker', 'Deagle Oro macizo', 'La DEAGLE con acabado Oro macizo.', 'stickers/arma-deagle.svg', null, true, false, true, 'arsenal', null, 200, 1410),
  ('sticker-arma-scout', 'sticker', 'Scout Selva', 'La SCOUT con acabado Selva.', 'stickers/arma-scout.svg', null, true, false, true, 'arsenal', null, 200, 1420),
  ('sticker-arma-usp', 'sticker', 'USP Medianoche', 'La USP con acabado Medianoche.', 'stickers/arma-usp.svg', null, true, false, true, 'arsenal', null, 200, 1430),
  ('sticker-arma-glock', 'sticker', 'Glock Caramelo', 'La GLOCK con acabado Caramelo.', 'stickers/arma-glock.svg', null, true, false, true, 'arsenal', null, 200, 1440),
  ('sticker-arma-mp5', 'sticker', 'MP5 Neón', 'La MP5 con acabado Neón.', 'stickers/arma-mp5.svg', null, true, false, true, 'arsenal', null, 200, 1450),
  ('sticker-arma-cuchillo', 'sticker', 'Cuchillo Fantasma', 'La CUCHILLO con acabado Fantasma.', 'stickers/arma-cuchillo.svg', null, true, false, true, 'arsenal', null, 200, 1460),
  ('sticker-arma-he', 'sticker', 'HE Arcoíris', 'La HE con acabado Arcoíris.', 'stickers/arma-he.svg', null, true, false, true, 'arsenal', null, 200, 1470),
  ('sticker-serie-dona', 'sticker', 'DONA', 'DONA: el ícono de Dona glaseada flotando.', 'stickers/serie-dona.svg', null, true, false, true, 'series2', null, 200, 1480),
  ('sticker-serie-zombi', 'sticker', 'ZOMBI', 'ZOMBI: el ícono de Apocalipsis zombi flotando.', 'stickers/serie-zombi.svg', null, true, false, true, 'series2', null, 200, 1490),
  ('sticker-serie-barril', 'sticker', 'VECINDAD', 'VECINDAD: el ícono de La vecindad flotando.', 'stickers/serie-barril.svg', null, true, false, true, 'series2', null, 200, 1500),
  ('sticker-serie-fuga', 'sticker', 'FUGA', 'FUGA: el ícono de La fuga flotando.', 'stickers/serie-fuga.svg', null, true, false, true, 'series2', null, 200, 1510),
  ('sticker-serie-radiacion', 'sticker', 'REACTOR', 'REACTOR: el ícono de Reactor 4 flotando.', 'stickers/serie-radiacion.svg', null, true, false, true, 'series2', null, 200, 1520),
  ('sticker-serie-vikingo', 'sticker', 'VALHALLA', 'VALHALLA: el ícono de Vikingo flotando.', 'stickers/serie-vikingo.svg', null, true, false, true, 'series2', null, 200, 1530),
  ('sticker-serie-elementos', 'sticker', 'ELEMENTOS', 'ELEMENTOS: el ícono de Cuatro elementos flotando.', 'stickers/serie-elementos.svg', null, true, false, true, 'series2', null, 200, 1540),
  ('sticker-serie-robot', 'sticker', 'BIP BUP', 'BIP BUP: el ícono de Robot del futuro flotando.', 'stickers/serie-robot.svg', null, true, false, true, 'series2', null, 200, 1550),
  ('sticker-serie-fondo-mar', 'sticker', 'GLU GLU', 'GLU GLU: el ícono de Fondo de mar flotando.', 'stickers/serie-fondo-mar.svg', null, true, false, true, 'series2', null, 200, 1560),
  ('sticker-serie-isla', 'sticker', 'LA ISLA', 'LA ISLA: el ícono de La isla flotando.', 'stickers/serie-isla.svg', null, true, false, true, 'series2', null, 200, 1570),
  ('tema-terro', 'theme', 'Terrorista', 'Ocre y arena.', null, 'tema-terro', false, false, false, 'cs', 700, null, 1580),
  ('tema-anti', 'theme', 'Antiterrorista', 'Azul táctico.', null, 'tema-anti', false, false, false, 'cs', 700, null, 1590),
  ('tema-toxico', 'theme', 'Tóxico', 'Verde radiactivo.', null, 'tema-toxico', false, false, false, 'cs', 700, null, 1600),
  ('tema-hielo', 'theme', 'Hielo', 'Celeste helado.', null, 'tema-hielo', false, false, false, 'cs', 700, null, 1610),
  ('tema-carmesi', 'theme', 'Carmesí', 'Rojo intenso.', null, 'tema-carmesi', false, false, false, 'cs', 700, null, 1620),
  ('tema-camuflaje', 'theme', 'Camuflaje', 'Verde oliva militar.', null, 'tema-camuflaje', false, false, false, 'cs', 700, null, 1630),
  ('tema-atardecer', 'theme', 'Atardecer', 'Naranja cálido.', null, 'tema-atardecer', false, false, false, 'cs', 700, null, 1640),
  ('tema-grafito', 'theme', 'Grafito', 'Blanco y gris, minimalista.', null, 'tema-grafito', false, false, false, 'cs', 700, null, 1650),
  ('tema-pais-ar', 'theme', 'Argentina', 'Los colores de Argentina en todo el perfil.', null, 'tema-pais-ar', false, false, false, 'paises', 600, null, 1660),
  ('tema-pais-br', 'theme', 'Brasil', 'Los colores de Brasil en todo el perfil.', null, 'tema-pais-br', false, false, false, 'paises', 600, null, 1670),
  ('tema-pais-uy', 'theme', 'Uruguay', 'Los colores de Uruguay en todo el perfil.', null, 'tema-pais-uy', false, false, false, 'paises', 600, null, 1680),
  ('tema-pais-cl', 'theme', 'Chile', 'Los colores de Chile en todo el perfil.', null, 'tema-pais-cl', false, false, false, 'paises', 600, null, 1690),
  ('tema-pais-pe', 'theme', 'Perú', 'Los colores de Perú en todo el perfil.', null, 'tema-pais-pe', false, false, false, 'paises', 600, null, 1700),
  ('tema-pais-co', 'theme', 'Colombia', 'Los colores de Colombia en todo el perfil.', null, 'tema-pais-co', false, false, false, 'paises', 600, null, 1710),
  ('tema-pais-ve', 'theme', 'Venezuela', 'Los colores de Venezuela en todo el perfil.', null, 'tema-pais-ve', false, false, false, 'paises', 600, null, 1720),
  ('tema-pais-ec', 'theme', 'Ecuador', 'Los colores de Ecuador en todo el perfil.', null, 'tema-pais-ec', false, false, false, 'paises', 600, null, 1730),
  ('tema-pais-bo', 'theme', 'Bolivia', 'Los colores de Bolivia en todo el perfil.', null, 'tema-pais-bo', false, false, false, 'paises', 600, null, 1740),
  ('tema-pais-py', 'theme', 'Paraguay', 'Los colores de Paraguay en todo el perfil.', null, 'tema-pais-py', false, false, false, 'paises', 600, null, 1750),
  ('tema-pais-mx', 'theme', 'México', 'Los colores de México en todo el perfil.', null, 'tema-pais-mx', false, false, false, 'paises2', 600, null, 1760),
  ('tema-pais-cr', 'theme', 'Costa Rica', 'Los colores de Costa Rica en todo el perfil.', null, 'tema-pais-cr', false, false, false, 'paises2', 600, null, 1770),
  ('tema-pais-cu', 'theme', 'Cuba', 'Los colores de Cuba en todo el perfil.', null, 'tema-pais-cu', false, false, false, 'paises2', 600, null, 1780),
  ('tema-pais-do', 'theme', 'Rep. Dominicana', 'Los colores de Rep. Dominicana en todo el perfil.', null, 'tema-pais-do', false, false, false, 'paises2', 600, null, 1790),
  ('tema-pais-pr', 'theme', 'Puerto Rico', 'Los colores de Puerto Rico en todo el perfil.', null, 'tema-pais-pr', false, false, false, 'paises2', 600, null, 1800),
  ('tema-pais-pa', 'theme', 'Panamá', 'Los colores de Panamá en todo el perfil.', null, 'tema-pais-pa', false, false, false, 'paises2', 600, null, 1810),
  ('tema-pais-gt', 'theme', 'Guatemala', 'Los colores de Guatemala en todo el perfil.', null, 'tema-pais-gt', false, false, false, 'paises2', 600, null, 1820),
  ('tema-pais-hn', 'theme', 'Honduras', 'Los colores de Honduras en todo el perfil.', null, 'tema-pais-hn', false, false, false, 'paises2', 600, null, 1830),
  ('tema-pais-sv', 'theme', 'El Salvador', 'Los colores de El Salvador en todo el perfil.', null, 'tema-pais-sv', false, false, false, 'paises2', 600, null, 1840),
  ('tema-pais-es', 'theme', 'España', 'Los colores de España en todo el perfil.', null, 'tema-pais-es', false, false, false, 'paises2', 600, null, 1850),
  ('tema-mapa-dust2', 'theme', 'de_dust2', 'Los colores de de_dust2 en todo el perfil.', null, 'tema-mapa-dust2', false, false, false, 'mapas', 600, null, 1860),
  ('tema-mapa-inferno', 'theme', 'de_inferno', 'Los colores de de_inferno en todo el perfil.', null, 'tema-mapa-inferno', false, false, false, 'mapas', 600, null, 1870),
  ('tema-mapa-nuke', 'theme', 'de_nuke', 'Los colores de de_nuke en todo el perfil.', null, 'tema-mapa-nuke', false, false, false, 'mapas', 600, null, 1880),
  ('tema-mapa-train', 'theme', 'de_train', 'Los colores de de_train en todo el perfil.', null, 'tema-mapa-train', false, false, false, 'mapas', 600, null, 1890),
  ('tema-mapa-office', 'theme', 'cs_office', 'Los colores de cs_office en todo el perfil.', null, 'tema-mapa-office', false, false, false, 'mapas', 600, null, 1900),
  ('tema-mapa-aztec', 'theme', 'de_aztec', 'Los colores de de_aztec en todo el perfil.', null, 'tema-mapa-aztec', false, false, false, 'mapas', 600, null, 1910),
  ('tema-mapa-cbble', 'theme', 'de_cbble', 'Los colores de de_cbble en todo el perfil.', null, 'tema-mapa-cbble', false, false, false, 'mapas', 600, null, 1920),
  ('tema-mapa-italy', 'theme', 'cs_italy', 'Los colores de cs_italy en todo el perfil.', null, 'tema-mapa-italy', false, false, false, 'mapas', 600, null, 1930),
  ('tema-mapa-piranesi', 'theme', 'de_piranesi', 'Los colores de de_piranesi en todo el perfil.', null, 'tema-mapa-piranesi', false, false, false, 'mapas', 600, null, 1940),
  ('tema-mapa-prodigy', 'theme', 'de_prodigy', 'Los colores de de_prodigy en todo el perfil.', null, 'tema-mapa-prodigy', false, false, false, 'mapas', 600, null, 1950),
  ('tema-oro', 'theme', 'Oro VIP', 'Dorado con resplandor.', null, 'tema-oro', true, false, false, 'cs', null, 600, 1960),
  ('tema-obsidiana', 'theme', 'Obsidiana', 'Negro y violeta con resplandor.', null, 'tema-obsidiana', true, false, false, 'cs', null, 600, 1970),
  ('tema-diamante', 'theme', 'Diamante', 'Celeste cristal con resplandor.', null, 'tema-diamante', true, false, false, 'cs', null, 600, 1980),
  ('tema-synthwave', 'theme', 'Synthwave', 'Rosa y violeta retro con resplandor.', null, 'tema-synthwave', true, false, false, 'cs', null, 600, 1990),
  ('tema-holo', 'theme', 'Holográfico', 'El borde cambia de color.', null, 'tema-holo', true, false, true, 'cs', null, 600, 2000),
  ('tema-esmeralda', 'theme', 'Esmeralda', 'Verde joya con resplandor.', null, 'tema-esmeralda', true, false, false, 'cs', null, 600, 2010),
  ('tema-rubi', 'theme', 'Rubí', 'Rojo joya con resplandor.', null, 'tema-rubi', true, false, false, 'cs', null, 600, 2020),
  ('tema-aurora', 'theme', 'Aurora', 'El borde pasa de verde a violeta.', null, 'tema-aurora', true, false, true, 'cs', null, 600, 2030),
  ('tema-serie-ninja', 'theme', 'Shinobi', 'Los colores de Shinobi con un borde que brilla.', null, 'tema-serie-ninja', true, false, true, 'series', null, 600, 2040),
  ('tema-serie-guerrero', 'theme', 'Súper guerrero', 'Los colores de Súper guerrero con un borde que brilla.', null, 'tema-serie-guerrero', true, false, true, 'series', null, 600, 2050),
  ('tema-serie-alien', 'theme', 'Reloj alien', 'Los colores de Reloj alien con un borde que brilla.', null, 'tema-serie-alien', true, false, true, 'series', null, 600, 2060),
  ('tema-serie-portal', 'theme', 'Portal', 'Los colores de Portal con un borde que brilla.', null, 'tema-serie-portal', true, false, true, 'series', null, 600, 2070),
  ('tema-serie-navaja', 'theme', 'Gorra y navaja', 'Los colores de Gorra y navaja con un borde que brilla.', null, 'tema-serie-navaja', true, false, true, 'series', null, 600, 2080),
  ('tema-serie-laboratorio', 'theme', 'Laboratorio', 'Los colores de Laboratorio con un borde que brilla.', null, 'tema-serie-laboratorio', true, false, true, 'series', null, 600, 2090),
  ('tema-serie-reves', 'theme', 'Mundo del revés', 'Los colores de Mundo del revés con un borde que brilla.', null, 'tema-serie-reves', true, false, true, 'series', null, 600, 2100),
  ('tema-serie-reinos', 'theme', 'Reinos', 'Los colores de Reinos con un borde que brilla.', null, 'tema-serie-reinos', true, false, true, 'series', null, 600, 2110),
  ('tema-serie-atraco', 'theme', 'Atraco', 'Los colores de Atraco con un borde que brilla.', null, 'tema-serie-atraco', true, false, true, 'series', null, 600, 2120),
  ('tema-serie-juego', 'theme', 'Juego mortal', 'Los colores de Juego mortal con un borde que brilla.', null, 'tema-serie-juego', true, false, true, 'series', null, 600, 2130),
  ('tema-arma-ak', 'theme', 'Lava', 'Los colores del acabado Lava con un borde que brilla.', null, 'tema-arma-ak', true, false, true, 'arsenal', null, 600, 2140),
  ('tema-arma-m4', 'theme', 'Ártico', 'Los colores del acabado Ártico con un borde que brilla.', null, 'tema-arma-m4', true, false, true, 'arsenal', null, 600, 2150),
  ('tema-arma-awp', 'theme', 'Relámpago', 'Los colores del acabado Relámpago con un borde que brilla.', null, 'tema-arma-awp', true, false, true, 'arsenal', null, 600, 2160),
  ('tema-arma-deagle', 'theme', 'Oro macizo', 'Los colores del acabado Oro macizo con un borde que brilla.', null, 'tema-arma-deagle', true, false, true, 'arsenal', null, 600, 2170),
  ('tema-arma-scout', 'theme', 'Selva', 'Los colores del acabado Selva con un borde que brilla.', null, 'tema-arma-scout', true, false, true, 'arsenal', null, 600, 2180),
  ('tema-arma-usp', 'theme', 'Medianoche', 'Los colores del acabado Medianoche con un borde que brilla.', null, 'tema-arma-usp', true, false, true, 'arsenal', null, 600, 2190),
  ('tema-arma-glock', 'theme', 'Caramelo', 'Los colores del acabado Caramelo con un borde que brilla.', null, 'tema-arma-glock', true, false, true, 'arsenal', null, 600, 2200),
  ('tema-arma-mp5', 'theme', 'Neón', 'Los colores del acabado Neón con un borde que brilla.', null, 'tema-arma-mp5', true, false, true, 'arsenal', null, 600, 2210),
  ('tema-arma-cuchillo', 'theme', 'Fantasma', 'Los colores del acabado Fantasma con un borde que brilla.', null, 'tema-arma-cuchillo', true, false, true, 'arsenal', null, 600, 2220),
  ('tema-arma-he', 'theme', 'Arcoíris', 'Los colores del acabado Arcoíris con un borde que brilla.', null, 'tema-arma-he', true, false, true, 'arsenal', null, 600, 2230),
  ('tema-serie-dona', 'theme', 'Dona glaseada', 'Los colores de Dona glaseada con un borde que brilla.', null, 'tema-serie-dona', true, false, true, 'series2', null, 600, 2240),
  ('tema-serie-zombi', 'theme', 'Apocalipsis zombi', 'Los colores de Apocalipsis zombi con un borde que brilla.', null, 'tema-serie-zombi', true, false, true, 'series2', null, 600, 2250),
  ('tema-serie-barril', 'theme', 'La vecindad', 'Los colores de La vecindad con un borde que brilla.', null, 'tema-serie-barril', true, false, true, 'series2', null, 600, 2260),
  ('tema-serie-fuga', 'theme', 'La fuga', 'Los colores de La fuga con un borde que brilla.', null, 'tema-serie-fuga', true, false, true, 'series2', null, 600, 2270),
  ('tema-serie-radiacion', 'theme', 'Reactor 4', 'Los colores de Reactor 4 con un borde que brilla.', null, 'tema-serie-radiacion', true, false, true, 'series2', null, 600, 2280),
  ('tema-serie-vikingo', 'theme', 'Vikingo', 'Los colores de Vikingo con un borde que brilla.', null, 'tema-serie-vikingo', true, false, true, 'series2', null, 600, 2290),
  ('tema-serie-elementos', 'theme', 'Cuatro elementos', 'Los colores de Cuatro elementos con un borde que brilla.', null, 'tema-serie-elementos', true, false, true, 'series2', null, 600, 2300),
  ('tema-serie-robot', 'theme', 'Robot del futuro', 'Los colores de Robot del futuro con un borde que brilla.', null, 'tema-serie-robot', true, false, true, 'series2', null, 600, 2310),
  ('tema-serie-fondo-mar', 'theme', 'Fondo de mar', 'Los colores de Fondo de mar con un borde que brilla.', null, 'tema-serie-fondo-mar', true, false, true, 'series2', null, 600, 2320),
  ('tema-serie-isla', 'theme', 'La isla', 'Los colores de La isla con un borde que brilla.', null, 'tema-serie-isla', true, false, true, 'series2', null, 600, 2330),
  ('nombre-brillo', 'name', 'Brillo', 'Un destello recorre tu nombre.', null, 'nombre-brillo', false, false, true, 'cs', 600, null, 2340),
  ('nombre-glitch', 'name', 'Glitch', 'Tu nombre falla cada tanto, a propósito.', null, 'nombre-glitch', false, false, true, 'cs', 600, null, 2350),
  ('nombre-neon', 'name', 'Neón', 'Letrero luminoso que parpadea.', null, 'nombre-neon', false, false, true, 'cs', 600, null, 2360),
  ('nombre-retro', 'name', 'Retro', 'Sombra en capas de los 80.', null, 'nombre-retro', false, false, false, 'cs', 500, null, 2370),
  ('nombre-contorno', 'name', 'Contorno', 'Solo el borde de las letras.', null, 'nombre-contorno', false, false, false, 'cs', 500, null, 2380),
  ('nombre-sombra', 'name', 'Sombra', 'Sombra larga detrás de las letras.', null, 'nombre-sombra', false, false, false, 'cs', 500, null, 2390),
  ('nombre-hielo', 'name', 'Hielo', 'Letras congeladas.', null, 'nombre-hielo', false, false, false, 'cs', 500, null, 2400),
  ('nombre-pixel', 'name', 'Píxel', 'Letras de 8 bits con desfase de color.', null, 'nombre-pixel', false, false, false, 'cs', 500, null, 2410),
  ('nombre-pais-ar', 'name', 'Argentina', 'Tu nombre con las franjas de la bandera de Argentina.', null, 'nombre-pais-ar', false, false, false, 'paises', 400, null, 2420),
  ('nombre-pais-br', 'name', 'Brasil', 'Tu nombre con las franjas de la bandera de Brasil.', null, 'nombre-pais-br', false, false, false, 'paises', 400, null, 2430),
  ('nombre-pais-uy', 'name', 'Uruguay', 'Tu nombre con las franjas de la bandera de Uruguay.', null, 'nombre-pais-uy', false, false, false, 'paises', 400, null, 2440),
  ('nombre-pais-cl', 'name', 'Chile', 'Tu nombre con las franjas de la bandera de Chile.', null, 'nombre-pais-cl', false, false, false, 'paises', 400, null, 2450),
  ('nombre-pais-pe', 'name', 'Perú', 'Tu nombre con las franjas de la bandera de Perú.', null, 'nombre-pais-pe', false, false, false, 'paises', 400, null, 2460),
  ('nombre-pais-co', 'name', 'Colombia', 'Tu nombre con las franjas de la bandera de Colombia.', null, 'nombre-pais-co', false, false, false, 'paises', 400, null, 2470),
  ('nombre-pais-ve', 'name', 'Venezuela', 'Tu nombre con las franjas de la bandera de Venezuela.', null, 'nombre-pais-ve', false, false, false, 'paises', 400, null, 2480),
  ('nombre-pais-ec', 'name', 'Ecuador', 'Tu nombre con las franjas de la bandera de Ecuador.', null, 'nombre-pais-ec', false, false, false, 'paises', 400, null, 2490),
  ('nombre-pais-bo', 'name', 'Bolivia', 'Tu nombre con las franjas de la bandera de Bolivia.', null, 'nombre-pais-bo', false, false, false, 'paises', 400, null, 2500),
  ('nombre-pais-py', 'name', 'Paraguay', 'Tu nombre con las franjas de la bandera de Paraguay.', null, 'nombre-pais-py', false, false, false, 'paises', 400, null, 2510),
  ('nombre-pais-mx', 'name', 'México', 'Tu nombre con las franjas de la bandera de México.', null, 'nombre-pais-mx', false, false, false, 'paises2', 400, null, 2520),
  ('nombre-pais-cr', 'name', 'Costa Rica', 'Tu nombre con las franjas de la bandera de Costa Rica.', null, 'nombre-pais-cr', false, false, false, 'paises2', 400, null, 2530),
  ('nombre-pais-cu', 'name', 'Cuba', 'Tu nombre con las franjas de la bandera de Cuba.', null, 'nombre-pais-cu', false, false, false, 'paises2', 400, null, 2540),
  ('nombre-pais-do', 'name', 'Rep. Dominicana', 'Tu nombre con las franjas de la bandera de Rep. Dominicana.', null, 'nombre-pais-do', false, false, false, 'paises2', 400, null, 2550),
  ('nombre-pais-pr', 'name', 'Puerto Rico', 'Tu nombre con las franjas de la bandera de Puerto Rico.', null, 'nombre-pais-pr', false, false, false, 'paises2', 400, null, 2560),
  ('nombre-pais-pa', 'name', 'Panamá', 'Tu nombre con las franjas de la bandera de Panamá.', null, 'nombre-pais-pa', false, false, false, 'paises2', 400, null, 2570),
  ('nombre-pais-gt', 'name', 'Guatemala', 'Tu nombre con las franjas de la bandera de Guatemala.', null, 'nombre-pais-gt', false, false, false, 'paises2', 400, null, 2580),
  ('nombre-pais-hn', 'name', 'Honduras', 'Tu nombre con las franjas de la bandera de Honduras.', null, 'nombre-pais-hn', false, false, false, 'paises2', 400, null, 2590),
  ('nombre-pais-sv', 'name', 'El Salvador', 'Tu nombre con las franjas de la bandera de El Salvador.', null, 'nombre-pais-sv', false, false, false, 'paises2', 400, null, 2600),
  ('nombre-pais-es', 'name', 'España', 'Tu nombre con las franjas de la bandera de España.', null, 'nombre-pais-es', false, false, false, 'paises2', 400, null, 2610),
  ('nombre-mapa-dust2', 'name', 'de_dust2', 'Tu nombre con los colores de de_dust2.', null, 'nombre-mapa-dust2', false, false, false, 'mapas', 400, null, 2620),
  ('nombre-mapa-inferno', 'name', 'de_inferno', 'Tu nombre con los colores de de_inferno.', null, 'nombre-mapa-inferno', false, false, false, 'mapas', 400, null, 2630),
  ('nombre-mapa-nuke', 'name', 'de_nuke', 'Tu nombre con los colores de de_nuke.', null, 'nombre-mapa-nuke', false, false, false, 'mapas', 400, null, 2640),
  ('nombre-mapa-train', 'name', 'de_train', 'Tu nombre con los colores de de_train.', null, 'nombre-mapa-train', false, false, false, 'mapas', 400, null, 2650),
  ('nombre-mapa-office', 'name', 'cs_office', 'Tu nombre con los colores de cs_office.', null, 'nombre-mapa-office', false, false, false, 'mapas', 400, null, 2660),
  ('nombre-mapa-aztec', 'name', 'de_aztec', 'Tu nombre con los colores de de_aztec.', null, 'nombre-mapa-aztec', false, false, false, 'mapas', 400, null, 2670),
  ('nombre-mapa-cbble', 'name', 'de_cbble', 'Tu nombre con los colores de de_cbble.', null, 'nombre-mapa-cbble', false, false, false, 'mapas', 400, null, 2680),
  ('nombre-mapa-italy', 'name', 'cs_italy', 'Tu nombre con los colores de cs_italy.', null, 'nombre-mapa-italy', false, false, false, 'mapas', 400, null, 2690),
  ('nombre-mapa-piranesi', 'name', 'de_piranesi', 'Tu nombre con los colores de de_piranesi.', null, 'nombre-mapa-piranesi', false, false, false, 'mapas', 400, null, 2700),
  ('nombre-mapa-prodigy', 'name', 'de_prodigy', 'Tu nombre con los colores de de_prodigy.', null, 'nombre-mapa-prodigy', false, false, false, 'mapas', 400, null, 2710),
  ('nombre-arcoiris', 'name', 'Arcoíris', 'Todos los colores, en movimiento.', null, 'nombre-arcoiris', true, false, true, 'cs', null, 500, 2720),
  ('nombre-oro', 'name', 'Oro', 'Dorado con destello.', null, 'nombre-oro', true, false, true, 'cs', null, 500, 2730),
  ('nombre-fuego', 'name', 'Fuego', 'Tu nombre en llamas.', null, 'nombre-fuego', true, false, true, 'cs', null, 500, 2740),
  ('nombre-holografico', 'name', 'Holográfico', 'Cambia de color según la luz.', null, 'nombre-holografico', true, false, true, 'cs', null, 500, 2750),
  ('nombre-galaxia', 'name', 'Galaxia', 'Estrellas que viajan por las letras.', null, 'nombre-galaxia', true, false, true, 'cs', null, 500, 2760),
  ('nombre-plasma', 'name', 'Plasma', 'Brillo eléctrico que titila.', null, 'nombre-plasma', true, false, true, 'cs', null, 500, 2770),
  ('nombre-esmeralda', 'name', 'Esmeralda', 'Verde joya con destello.', null, 'nombre-esmeralda', true, false, true, 'cs', null, 500, 2780),
  ('nombre-cromo', 'name', 'Cromo', 'Metal pulido con reflejo.', null, 'nombre-cromo', true, false, true, 'cs', null, 500, 2790),
  ('nombre-chakra', 'name', 'Chakra', 'Energía azul que corre por las letras.', null, 'nombre-chakra', true, false, true, 'series', null, 500, 2800),
  ('nombre-ki', 'name', 'Ki', 'Aura dorada que tiembla de poder.', null, 'nombre-ki', true, false, true, 'series', null, 500, 2810),
  ('nombre-mutante', 'name', 'Mutante', 'Brillo verde que late.', null, 'nombre-mutante', true, false, true, 'series', null, 500, 2820),
  ('nombre-portal', 'name', 'Portal', 'Verde interdimensional que fluye.', null, 'nombre-portal', true, false, true, 'series', null, 500, 2830),
  ('nombre-whisky', 'name', 'Whisky 1919', 'Letra de época color ámbar.', null, 'nombre-whisky', true, false, true, 'series', null, 500, 2840),
  ('nombre-cristal', 'name', 'Cristal azul', 'Azul cristalino que destella.', null, 'nombre-cristal', true, false, true, 'series', null, 500, 2850),
  ('nombre-ochentoso', 'name', 'Ochentoso', 'Letras rojas de los 80 que titilan.', null, 'nombre-ochentoso', true, false, true, 'series', null, 500, 2860),
  ('nombre-acero', 'name', 'Acero antiguo', 'Acero forjado con vetas que se mueven.', null, 'nombre-acero', true, false, true, 'series', null, 500, 2870),
  ('nombre-billete', 'name', 'Billete', 'Verde billete recién impreso.', null, 'nombre-billete', true, false, true, 'series', null, 500, 2880),
  ('nombre-luz-roja', 'name', 'Luz roja, luz verde', 'Cambia de rojo a verde: no te muevas.', null, 'nombre-luz-roja', true, false, true, 'series', null, 500, 2890),
  ('nombre-arma-ak', 'name', 'Lava', 'Tu nombre con el acabado Lava.', null, 'nombre-arma-ak', true, false, true, 'arsenal', null, 500, 2900),
  ('nombre-arma-m4', 'name', 'Ártico', 'Tu nombre con el acabado Ártico.', null, 'nombre-arma-m4', true, false, true, 'arsenal', null, 500, 2910),
  ('nombre-arma-awp', 'name', 'Relámpago', 'Tu nombre con el acabado Relámpago.', null, 'nombre-arma-awp', true, false, true, 'arsenal', null, 500, 2920),
  ('nombre-arma-deagle', 'name', 'Oro macizo', 'Tu nombre con el acabado Oro macizo.', null, 'nombre-arma-deagle', true, false, true, 'arsenal', null, 500, 2930),
  ('nombre-arma-scout', 'name', 'Selva', 'Tu nombre con el acabado Selva.', null, 'nombre-arma-scout', true, false, true, 'arsenal', null, 500, 2940),
  ('nombre-arma-usp', 'name', 'Medianoche', 'Tu nombre con el acabado Medianoche.', null, 'nombre-arma-usp', true, false, true, 'arsenal', null, 500, 2950),
  ('nombre-arma-glock', 'name', 'Caramelo', 'Tu nombre con el acabado Caramelo.', null, 'nombre-arma-glock', true, false, true, 'arsenal', null, 500, 2960),
  ('nombre-arma-mp5', 'name', 'Neón', 'Tu nombre con el acabado Neón.', null, 'nombre-arma-mp5', true, false, true, 'arsenal', null, 500, 2970),
  ('nombre-arma-cuchillo', 'name', 'Fantasma', 'Tu nombre con el acabado Fantasma.', null, 'nombre-arma-cuchillo', true, false, true, 'arsenal', null, 500, 2980),
  ('nombre-arma-he', 'name', 'Arcoíris', 'Tu nombre con el acabado Arcoíris.', null, 'nombre-arma-he', true, false, true, 'arsenal', null, 500, 2990),
  ('nombre-dona', 'name', 'Glaseado', 'Efecto Glaseado, de la colección Dona glaseada.', null, 'nombre-dona', true, false, true, 'series2', null, 500, 3000),
  ('nombre-zombi', 'name', 'Podrido', 'Efecto Podrido, de la colección Apocalipsis zombi.', null, 'nombre-zombi', true, false, true, 'series2', null, 500, 3010),
  ('nombre-barril', 'name', 'Barril', 'Efecto Barril, de la colección La vecindad.', null, 'nombre-barril', true, false, true, 'series2', null, 500, 3020),
  ('nombre-fuga', 'name', 'Tatuaje', 'Efecto Tatuaje, de la colección La fuga.', null, 'nombre-fuga', true, false, true, 'series2', null, 500, 3030),
  ('nombre-radiacion', 'name', 'Radiactivo', 'Efecto Radiactivo, de la colección Reactor 4.', null, 'nombre-radiacion', true, false, true, 'series2', null, 500, 3040),
  ('nombre-vikingo', 'name', 'Rúnico', 'Efecto Rúnico, de la colección Vikingo.', null, 'nombre-vikingo', true, false, true, 'series2', null, 500, 3050),
  ('nombre-elementos', 'name', 'Elemental', 'Efecto Elemental, de la colección Cuatro elementos.', null, 'nombre-elementos', true, false, true, 'series2', null, 500, 3060),
  ('nombre-robot', 'name', 'Binario', 'Efecto Binario, de la colección Robot del futuro.', null, 'nombre-robot', true, false, true, 'series2', null, 500, 3070),
  ('nombre-fondo-mar', 'name', 'Burbujas', 'Efecto Burbujas, de la colección Fondo de mar.', null, 'nombre-fondo-mar', true, false, true, 'series2', null, 500, 3080),
  ('nombre-isla', 'name', 'Tropical', 'Efecto Tropical, de la colección La isla.', null, 'nombre-isla', true, false, true, 'series2', null, 500, 3090),
  ('fondo-humo', 'background', 'Granada de humo', 'Humo que cruza la tarjeta de lado a lado.', 'fondos/humo.svg', null, false, false, true, 'cs', 1000, null, 3100),
  ('fondo-radar', 'background', 'Radar', 'El radar barre y marca enemigos.', 'fondos/radar.svg', null, false, false, true, 'cs', 1000, null, 3110),
  ('fondo-casquillos', 'background', 'Lluvia de casquillos', 'Vainas de bronce que caen girando.', 'fondos/casquillos.svg', null, false, false, true, 'cs', 1000, null, 3120),
  ('fondo-neon', 'background', 'Neón', 'Sol retro y cuadrícula que avanza.', 'fondos/neon.svg', null, false, false, true, 'cs', 1000, null, 3130),
  ('fondo-tormenta', 'background', 'Tormenta', 'Lluvia y relámpagos de noche.', 'fondos/tormenta.svg', null, false, false, true, 'cs', 1000, null, 3140),
  ('fondo-consola', 'background', 'Consola', 'Columnas de código que bajan.', 'fondos/consola.svg', null, false, false, true, 'cs', 1000, null, 3150),
  ('fondo-mapa-dust2', 'background', 'Atardecer en el desierto', 'Dunas, sol bajo y arena con viento.', 'fondos/mapa-dust2.svg', null, false, false, true, 'mapas', 800, null, 3160),
  ('fondo-mapa-inferno', 'background', 'Brasas del pueblo', 'Muros de ladrillo, arcos y brasas que suben.', 'fondos/mapa-inferno.svg', null, false, false, true, 'mapas', 800, null, 3170),
  ('fondo-mapa-nuke', 'background', 'Planta nuclear', 'Símbolo que gira y franjas de peligro.', 'fondos/mapa-nuke.svg', null, false, false, true, 'mapas', 800, null, 3180),
  ('fondo-mapa-office', 'background', 'Oficina nevada', 'Edificios de noche con nieve que cae.', 'fondos/mapa-office.svg', null, false, false, true, 'mapas', 800, null, 3190),
  ('fondo-pais-cruz-del-sur', 'background', 'Cruz del Sur', 'El cielo del sur con sus estrellas.', 'fondos/pais-cruz-del-sur.svg', null, false, false, true, 'paises', 800, null, 3200),
  ('fondo-pais-carnaval', 'background', 'Carnaval', 'Papelitos y serpentinas de colores.', 'fondos/pais-carnaval.svg', null, false, false, true, 'paises', 800, null, 3210),
  ('fondo-serie-luna-roja', 'background', 'Luna roja', 'Hojas que vuelan bajo una luna enorme.', 'fondos/serie-luna-roja.svg', null, true, false, true, 'series', null, 1000, 3220),
  ('fondo-serie-aura', 'background', 'Aura dorada', 'Energía dorada que sube sin parar.', 'fondos/serie-aura.svg', null, true, false, true, 'series', null, 1000, 3230),
  ('fondo-serie-portal', 'background', 'Portal verde', 'Un portal en espiral que gira.', 'fondos/serie-portal.svg', null, true, false, true, 'series', null, 1000, 3240),
  ('fondo-serie-cristal', 'background', 'Cristales del desierto', 'Cristales azules que brillan de noche.', 'fondos/serie-cristal.svg', null, true, false, true, 'series', null, 1000, 3250),
  ('fondo-serie-niebla', 'background', 'Ciudad de humo', 'Fábricas, chimeneas y niebla de época.', 'fondos/serie-niebla.svg', null, true, false, true, 'series', null, 1000, 3260),
  ('fondo-serie-reves', 'background', 'Del otro lado', 'Cielo rojo, relámpagos y esporas flotando.', 'fondos/serie-reves.svg', null, true, false, true, 'series', null, 1000, 3270),
  ('fondo-serie-alien', 'background', 'Energía alien', 'Celdas verdes que se encienden en onda.', 'fondos/serie-alien.svg', null, true, false, true, 'series', null, 1000, 3280),
  ('fondo-serie-billetes', 'background', 'El gran golpe', 'Lluvia de billetes y caretas.', 'fondos/serie-billetes.svg', null, true, false, true, 'series', null, 1000, 3290),
  ('fondo-serie-abismo', 'background', 'Abismo', 'Medusas de colores y burbujas en lo profundo.', 'fondos/serie-abismo.svg', null, true, false, true, 'series2', null, 1000, 3300),
  ('fondo-arma-trazadoras', 'background', 'Fuego cruzado', 'Trazadoras que cruzan en diagonal.', 'fondos/arma-trazadoras.svg', null, true, false, true, 'arsenal', null, 1000, 3310),
  ('fondo-arma-oro', 'background', 'Bóveda de oro', 'Lingotes con un brillo que pasa.', 'fondos/arma-oro.svg', null, true, false, true, 'arsenal', null, 1000, 3320),
  ('fondo-arma-dragon', 'background', 'Escamas de dragón', 'Escamas rojas y un ojo que parpadea.', 'fondos/arma-dragon.svg', null, true, false, true, 'arsenal', null, 1000, 3330);
-- --- fin: catálogo generado ---

commit;
