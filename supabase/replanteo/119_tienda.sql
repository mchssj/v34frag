-- 119: tienda de cosméticos con puntos y monedas VIP (bitácora docs/bitacora/2026-11-11-tienda-de-puntos/).
--
-- Une las tres migraciones de Kyan del 2026-10-29 (kyan/pruebas: 20261029180000_tienda.sql,
-- 20261029200000_fondo_miniperfil.sql y 20261029210000_vip_progresion.sql), que nunca se corrieron, adaptadas al replanteo:
--   - Un mix da puntos si terminó (sin end_reason = 'crash'), le dio ELO al jugador (elo_after) y no abandonó
--     (mm_elo_abandoned). Cuentan los mapas del matchmaking, que son mixes con parent_match_id. Las PCW no dan ELO,
--     así que no entran. El jugador es la ficha de la cuenta con todos sus SteamID (principal y adicionales).
--   - Ganó: matches.winner_side = el equipo del jugador.
--   - Avisos con notify(): points_granted, item_granted, item_revoked y cover_removed (categoría account).
--   - Semana de las ofertas: lunes 00:00 de Argentina.
--
-- Reglas:
--   - Los puntos y las monedas VIP no se anotan: se calculan de los mixes (points_mixes_of). Borrar un mix o cambiar
--     points_config corrige el saldo de todos solo.
--   - Saldo = ganados + regalos del admin (point_grants) − gastados (user_items.price_paid), por moneda.
--   - Monedas VIP: solo de los mixes jugados siendo VIP en esa fecha (was_vip). Lo VIP se compra con monedas siendo VIP
--     hoy y se usa mientras la cuenta sea VIP: si vence, queda congelado. El Marco Oro VIP (vip_reward) viene con el VIP.
--   - El admin cambia precios, precio VIP, a la venta y activo, y regala o quita puntos, monedas y artículos.
--   - Lo propio (bitácora 2026-11-13-avatar-y-fondo-propios): cada cuenta sube su fondo fijo (puntos) y, siendo VIP, su
--     avatar y su fondo animados (monedas VIP), y paga cada vez que sube uno. Se ve al instante; si lo denuncian, un
--     moderador o un admin lo saca, sin devolver lo pagado. Lo animado se oculta si vence el VIP y vuelve al renovar.
--   - Lo subido queda guardado (bitácora 2026-11-14-inventario-de-lo-propio): hasta custom_max_avatar avatares y
--     custom_max_background fondos por cuenta; ponerse uno guardado no cuesta. Se borra solo si lo borra el dueño o lo
--     saca un moderador o un admin.
--
-- Después de aplicarla: notify pgrst.

begin;

do $$ begin
  if to_regclass('public.shop_items') is not null then raise exception 'replanteo 119: ya se aplicó (existe shop_items)'; end if;
  if to_regclass('public.widget_settings') is null then raise exception 'replanteo 119: falta la 112'; end if;
  if to_regclass('public.vip_memberships') is null then raise exception 'replanteo 119: falta el VIP (20261028120000_vip.sql)'; end if;
  if to_regprocedure('public.mm_elo_abandoned(uuid, text)') is null then raise exception 'replanteo 119: falta la 48'; end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'profile_details' and column_name = 'cover_url') then
    raise exception 'replanteo 119: profile_details.cover_url ya existe';
  end if;
end $$;

-- Respaldo de lo que se cambia, para la inversa.
create table public.replanteo119_funciones (nombre text primary key, def text not null);
alter table public.replanteo119_funciones enable row level security;
insert into public.replanteo119_funciones(nombre, def)
select p.proname, pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'notification_category';
do $$ begin
  if (select count(*) from public.replanteo119_funciones) <> 1 then
    raise exception 'replanteo 119: falta notification_category (¿o tiene sobrecargas?)';
  end if;
end $$;

-- =====================================================================================================================
-- 1. Configuración
-- =====================================================================================================================
create table public.points_config (
  id              int primary key default 1 check (id = 1),
  per_mix         int not null default 10 check (per_mix between 0 and 1000),
  per_win         int not null default 5 check (per_win between 0 and 1000),
  vip_multiplier  numeric not null default 1 check (vip_multiplier between 1 and 3),
  vip_per_mix     int not null default 10 check (vip_per_mix between 0 and 1000),
  vip_per_win     int not null default 5 check (vip_per_win between 0 and 1000),
  weekly_count    int not null default 6 check (weekly_count between 0 and 24),
  weekly_discount int not null default 25 check (weekly_discount between 0 and 90),
  custom_avatar_price      int not null default 550 check (custom_avatar_price between 1 and 1000000),
  custom_bg_animated_price int not null default 650 check (custom_bg_animated_price between 1 and 1000000),
  custom_bg_static_price   int not null default 500 check (custom_bg_static_price between 1 and 1000000),
  custom_max_avatar        int not null default 5 check (custom_max_avatar between 1 and 50),
  custom_max_background    int not null default 5 check (custom_max_background between 1 and 50),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id) on delete set null
);
comment on table public.points_config is 'Puntos y monedas VIP por mix, ×VIP de los puntos, ofertas de la semana, precios de lo propio (avatar y fondo animados en monedas VIP, fondo fijo en puntos) y cuántos avatares y fondos propios guarda cada cuenta. Una fila. Replanteo 119';
-- Los valores con los que sale (Daniel, 2026-11-14: los de su base local).
insert into public.points_config (id, per_mix, per_win, vip_multiplier, vip_per_mix, vip_per_win, weekly_count, weekly_discount,
                                  custom_avatar_price, custom_bg_animated_price, custom_bg_static_price,
                                  custom_max_avatar, custom_max_background)
values (1, 20, 10, 1, 20, 10, 6, 25, 550, 650, 300, 5, 5);
alter table public.points_config enable row level security;
revoke all on public.points_config from anon, authenticated;
grant select on public.points_config to anon, authenticated;
create policy "points_config: todos ven" on public.points_config for select using (true);

-- =====================================================================================================================
-- 2. Catálogo, inventario, regalos y equipados
-- =====================================================================================================================
create table public.shop_items (
  id          text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  kind        text not null check (kind in ('frame', 'sticker', 'theme', 'name', 'background', 'avatar')),
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
  constraint shop_items_recurso check ((file is null) <> (css_class is null)),
  constraint shop_items_vip_sin_precio check (not vip_only or price is null),
  constraint shop_items_vip_price_solo_vip check (vip_only or vip_price is null),
  constraint shop_items_reward_vip check (not vip_reward or (vip_only and vip_price is null))
);
comment on table public.shop_items is 'Catálogo de cosméticos (web/frontend/public/cosmetics/catalogo.json, mismo id). price: puntos (null no se vende); vip_price: monedas VIP de lo VIP; vip_reward: viene con el VIP. Replanteo 119';
alter table public.shop_items enable row level security;
revoke all on public.shop_items from anon, authenticated;
grant select on public.shop_items to anon, authenticated;
create policy "shop_items: todos ven" on public.shop_items for select using (true);

create table public.user_items (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  item_id     text not null references public.shop_items(id) on delete cascade,
  source      text not null check (source in ('purchase', 'grant')),
  currency    text not null default 'points' check (currency in ('points', 'vip')),
  price_paid  int check (price_paid >= 0),
  granted_by  uuid references public.profiles(id) on delete set null,
  note        text check (char_length(note) <= 200),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
comment on table public.user_items is 'Inventario de cada cuenta: comprado (con puntos o monedas VIP) o regalado por un admin. Replanteo 119';

create table public.point_grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  currency   text not null default 'points' check (currency in ('points', 'vip')),
  amount     int not null check (amount <> 0 and amount between -1000000 and 1000000),
  reason     text not null check (char_length(reason) between 1 and 200),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index point_grants_user on public.point_grants (user_id);
comment on table public.point_grants is 'Regalos y correcciones del admin, en puntos o monedas VIP, con motivo. No se borran. Replanteo 119';

create table public.user_cosmetics (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  frame      text references public.shop_items(id) on delete set null,
  avatar     text references public.shop_items(id) on delete set null,
  background text references public.shop_items(id) on delete set null,
  theme      text references public.shop_items(id) on delete set null,
  name       text references public.shop_items(id) on delete set null,
  stickers   text[] not null default '{}' check (cardinality(stickers) <= 3),
  avatar_custom     uuid,
  background_custom uuid,
  updated_at timestamptz not null default now(),
  constraint user_cosmetics_avatar_uno check (avatar_custom is null or avatar is null),
  constraint user_cosmetics_background_uno check (background_custom is null or background is null)
);
comment on table public.user_cosmetics is 'Lo que tiene equipado cada cuenta: uno por tipo y hasta 3 stickers. avatar: el animado que reemplaza la foto. *_custom: la subida propia puesta (custom_cosmetics.id). Replanteo 119';

-- Lo propio: el avatar y los fondos que sube cada cuenta. Una fila por subida; las que no tienen cleared_at están
-- guardadas en su inventario (deleted: la borró el dueño; removed: la sacó un moderador o un admin). La puesta es la
-- de user_cosmetics. Lo pagado cuenta como gastado aunque se borre. Los archivos están en el bucket cosmetics
-- (<uid>/): la API los sube y los borra.
create table public.custom_cosmetics (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  kind           text not null check (kind in ('avatar', 'background')),
  animated       boolean not null,
  url            text not null check (char_length(url) between 1 and 500),
  poster_url     text check (char_length(poster_url) <= 500),
  currency       text not null check (currency in ('points', 'vip')),
  price          int not null check (price >= 0),
  created_at     timestamptz not null default now(),
  cleared_at     timestamptz,
  cleared_reason text check (cleared_reason in ('deleted', 'removed')),
  cleared_by     uuid references public.profiles(id) on delete set null,
  constraint custom_cosmetics_avatar_animado check (kind <> 'avatar' or animated),
  constraint custom_cosmetics_moneda check (currency = case when animated then 'vip' else 'points' end),
  constraint custom_cosmetics_poster check (not animated or poster_url is not null),
  constraint custom_cosmetics_cleared check ((cleared_at is null) = (cleared_reason is null))
);
create index custom_cosmetics_guardadas on public.custom_cosmetics (user_id, kind) where cleared_at is null;
create index custom_cosmetics_user on public.custom_cosmetics (user_id, created_at desc);
comment on table public.custom_cosmetics is 'Avatar y fondos propios subidos por cada cuenta. Sin cleared_at: guardados en su inventario (hasta points_config.custom_max_*). Lo pagado no se devuelve. Replanteo 119';
alter table public.user_cosmetics
  add constraint user_cosmetics_avatar_custom_fkey foreign key (avatar_custom) references public.custom_cosmetics(id) on delete set null,
  add constraint user_cosmetics_background_custom_fkey foreign key (background_custom) references public.custom_cosmetics(id) on delete set null;

-- Cada uno lee lo suyo y los admins, todo. Se escribe solo con las funciones.
alter table public.user_items enable row level security;
alter table public.point_grants enable row level security;
alter table public.user_cosmetics enable row level security;
alter table public.custom_cosmetics enable row level security;
revoke all on public.user_items, public.point_grants, public.user_cosmetics, public.custom_cosmetics from anon, authenticated;
grant select on public.user_items, public.point_grants, public.user_cosmetics, public.custom_cosmetics to authenticated;
create policy "user_items: el dueño y los admins ven" on public.user_items for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "point_grants: el dueño y los admins ven" on public.point_grants for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "user_cosmetics: el dueño y los admins ven" on public.user_cosmetics for select to authenticated
  using (user_id = auth.uid() or is_admin());
create policy "custom_cosmetics: el dueño y los admins ven" on public.custom_cosmetics for select to authenticated
  using (user_id = auth.uid() or is_admin());

-- Portada del perfil (bucket avatars, carpeta <uid>/, con las políticas que ya tiene). La sube la API.
alter table public.profile_details add column cover_url text constraint profile_details_cover_url_check check (char_length(cover_url) <= 500);
comment on column public.profile_details.cover_url is 'Portada del perfil (4:1). El admin la quita con admin_cover_clear. Replanteo 119';

-- =====================================================================================================================
-- 3. Puntos y monedas VIP
-- =====================================================================================================================
-- VIP vigente en una fecha: empezado, sin vencer y sin revocar (o revocado después) en ese momento.
create function public.was_vip(p_user uuid, p_at timestamptz) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from vip_memberships v
                  where v.user_id = p_user and v.starts_at <= p_at
                    and (v.ends_at is null or v.ends_at > p_at)
                    and (v.revoked_at is null or v.revoked_at > p_at))
$$;
revoke all on function public.was_vip(uuid, timestamptz) from public, anon, authenticated;

-- Los mixes que le dan puntos a una cuenta, con lo que da cada uno. Interna: la llaman las funciones de abajo.
create function public.points_mixes_of(p_user uuid)
  returns table (match_id uuid, played_at timestamptz, map text, mm boolean, won boolean, vip boolean, points int, coins int)
  language sql stable security definer set search_path = public as $$
  with fichas as (select id, steam_id from players where user_id = p_user),
  steams as (
    select steam_id from fichas where steam_id is not null
    union
    select x.steam_id from player_extra_steam_ids x join fichas f on f.id = x.player_id
  ),
  mx as (
    select distinct on (m.id) m.id, coalesce(m.played_at, m.starts_at) at, m.map, m.parent_match_id is not null mm,
           coalesce(m.winner_side = s.team, false) won, s.steam_id
      from match_player_stats s
      join matches m on m.id = s.match_id
     where (s.player_id in (select id from fichas) or s.steam_id in (select steam_id from steams))
       and m.kind = 'mix' and m.status = 'finished' and m.end_reason is distinct from 'crash'
       and s.team in (1, 2) and s.elo_after is not null
     order by m.id, s.player_id is null
  ),
  ok as (
    select mx.*, was_vip(p_user, mx.at) vip from mx
     where not mm_elo_abandoned(mx.id, elo_key(mx.steam_id))
  )
  select ok.id, ok.at, ok.map, ok.mm, ok.won, ok.vip,
         round((c.per_mix + case when ok.won then c.per_win else 0 end)
               * case when ok.vip then c.vip_multiplier else 1 end)::int,
         case when ok.vip then c.vip_per_mix + case when ok.won then c.vip_per_win else 0 end else 0 end
    from ok cross join points_config c
   where c.id = 1
$$;
revoke all on function public.points_mixes_of(uuid) from public, anon, authenticated;

-- Totales de las dos monedas en una pasada. Interna.
create function public.points_totals(p_user uuid)
  returns table (earned int, granted int, spent int, balance int, mixes int,
                 vip_earned int, vip_granted int, vip_spent int, vip_balance int, vip_mixes int)
  language sql stable security definer set search_path = public as $$
  with e as (select coalesce(sum(points), 0)::int pts, count(*)::int n,
                    coalesce(sum(coins), 0)::int vpts, (count(*) filter (where vip))::int vn
               from points_mixes_of(p_user)),
       g as (select coalesce(sum(amount) filter (where currency = 'points'), 0)::int pts,
                    coalesce(sum(amount) filter (where currency = 'vip'), 0)::int vpts
               from point_grants where user_id = p_user),
       -- gastado: las compras de la tienda y cada subida de lo propio
       s as (select coalesce(sum(x.price) filter (where x.currency = 'points'), 0)::int pts,
                    coalesce(sum(x.price) filter (where x.currency = 'vip'), 0)::int vpts
               from (select price_paid price, currency from user_items where user_id = p_user and source = 'purchase'
                     union all
                     select price, currency from custom_cosmetics where user_id = p_user) x)
  select e.pts, g.pts, s.pts, e.pts + g.pts - s.pts, e.n,
         e.vpts, g.vpts, s.vpts, e.vpts + g.vpts - s.vpts, e.vn
    from e, g, s
$$;
revoke all on function public.points_totals(uuid) from public, anon, authenticated;

-- El saldo de una cuenta: el dueño o un admin. Las monedas VIP están congeladas si hoy no es VIP.
create function public.points_summary(p_user uuid default auth.uid()) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare t record; v_vip boolean;
begin
  if p_user is null or (p_user is distinct from auth.uid() and not is_admin()) then
    raise exception 'No puedes ver los puntos de otra cuenta' using errcode = '42501';
  end if;
  select * into t from points_totals(p_user);
  v_vip := is_vip(p_user);
  return jsonb_build_object(
    'vip', v_vip,
    'has_player', exists (select 1 from players where user_id = p_user),
    'points', jsonb_build_object('earned', t.earned, 'granted', t.granted, 'spent', t.spent, 'balance', t.balance, 'mixes', t.mixes),
    'vip_coins', jsonb_build_object('earned', t.vip_earned, 'granted', t.vip_granted, 'spent', t.vip_spent,
                                    'balance', t.vip_balance, 'mixes', t.vip_mixes, 'frozen', not v_vip));
end $$;
revoke all on function public.points_summary(uuid) from public, anon;
grant execute on function public.points_summary(uuid) to authenticated, service_role;

-- Historial de una moneda, lo más nuevo primero: mixes (+), regalos (±), compras (−) y lo propio subido (custom, −).
-- total: cuántas filas hay.
create function public.points_history(p_user uuid default auth.uid(), p_currency text default 'points',
                                      p_limit int default 20, p_offset int default 0)
  returns table (kind text, at timestamptz, amount int, label text, ref text, total bigint)
  language plpgsql stable security definer set search_path = public as $$
begin
  if p_user is null or (p_user is distinct from auth.uid() and not is_admin()) then
    raise exception 'No puedes ver los puntos de otra cuenta' using errcode = '42501';
  end if;
  if p_currency not in ('points', 'vip') then raise exception 'Moneda inválida: points o vip'; end if;
  return query
  select h.kind, h.at, h.amount, h.label, h.ref, count(*) over () from (
    select case when x.mm then 'mm' else 'mix' end kind, x.played_at at,
           case when p_currency = 'vip' then x.coins else x.points end amount,
           coalesce(regexp_replace(x.map, '^[a-z]+_', ''), 'Mix') || case when x.won then ' · victoria' else '' end label,
           x.match_id::text ref
      from points_mixes_of(p_user) x
     where p_currency = 'points' or x.vip
    union all
    select 'grant', g.created_at, g.amount, g.reason, null from point_grants g
     where g.user_id = p_user and g.currency = p_currency
    union all
    select 'purchase', u.acquired_at, -u.price_paid, i.name, i.id
      from user_items u join shop_items i on i.id = u.item_id
     where u.user_id = p_user and u.source = 'purchase' and u.currency = p_currency
    union all
    select 'custom', c.created_at, -c.price,
           case when c.kind = 'avatar' then 'Avatar propio' when c.animated then 'Fondo de miniperfil animado propio' else 'Fondo de miniperfil propio' end,
           c.id::text
      from custom_cosmetics c
     where c.user_id = p_user and c.currency = p_currency
  ) h
  order by h.at desc nulls last
  limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function public.points_history(uuid, text, int, int) from public, anon;
grant execute on function public.points_history(uuid, text, int, int) to authenticated, service_role;

-- =====================================================================================================================
-- 4. Catálogo con el precio de hoy
-- =====================================================================================================================
-- Los artículos en oferta esta semana: los que se venden con puntos, mezclados con la semana ISO como semilla.
create function public.shop_weekly() returns setof text
  language sql stable security definer set search_path = public as $$
  select id from shop_items
   where active and price is not null and not vip_only
   order by md5(id || to_char(now() at time zone 'America/Argentina/Buenos_Aires', 'IYYY-IW'))
   limit (select weekly_count from points_config where id = 1)
$$;
grant execute on function public.shop_weekly() to anon, authenticated, service_role;

-- El catálogo activo con el precio de hoy. weekly_ends: el lunes que viene a las 00:00 de Argentina.
create view public.shop_catalog as
select i.id, i.kind, i.name, i.description, i.file, i.css_class, i.vip_only, i.vip_reward, i.animated, i.collection,
       i.price as base_price,
       case when i.price is null then null
            when w.id is not null then greatest(1, round(i.price * (100 - c.weekly_discount) / 100.0)::int)
            else i.price end as price,
       i.vip_price,
       w.id is not null as weekly,
       (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') + interval '7 days')
         at time zone 'America/Argentina/Buenos_Aires' as weekly_ends,
       i.sort
  from shop_items i
  cross join points_config c
  left join shop_weekly() w(id) on w.id = i.id
 where i.active and c.id = 1;
comment on view public.shop_catalog is 'Catálogo activo con el precio de hoy (ofertas de la semana incluidas). Replanteo 119';
grant select on public.shop_catalog to anon, authenticated;

-- =====================================================================================================================
-- 5. Comprar, usar y equipar
-- =====================================================================================================================
-- ¿Puede usar la cuenta este artículo hoy? El premio VIP, mientras sea VIP. Lo demás, si lo tiene; lo VIP, además,
-- mientras sea VIP (si vence, queda congelado).
create function public.can_use_item(p_user uuid, p_item text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_items i where i.id = p_item
                   and case when i.vip_reward then is_vip(p_user)
                            else exists (select 1 from user_items u where u.user_id = p_user and u.item_id = i.id)
                                 and (not i.vip_only or is_vip(p_user)) end)
$$;
-- La usa player_cosmetics_public.
revoke all on function public.can_use_item(uuid, text) from public;
grant execute on function public.can_use_item(uuid, text) to anon, authenticated, service_role;

-- Compra con puntos (lo de todos) o con monedas VIP (lo VIP, siendo VIP hoy). Devuelve precio, moneda y saldo nuevo.
create function public.shop_buy(p_item text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_price int; v_bal int; i shop_items;
begin
  if v_uid is null then raise exception 'Inicia sesión para comprar' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));
  select * into i from shop_items where id = p_item;
  if not found or not i.active then raise exception 'Ese artículo no está en la tienda'; end if;
  if i.vip_reward then raise exception 'Ese artículo viene con el VIP: no se compra'; end if;
  if exists (select 1 from user_items where user_id = v_uid and item_id = p_item) then raise exception 'Ya lo tienes'; end if;
  if not exists (select 1 from players where user_id = v_uid) then
    raise exception 'Necesitas tu ficha de jugador vinculada para usar la tienda';
  end if;
  if i.vip_only then
    if not is_vip(v_uid) then raise exception 'Los artículos VIP se compran siendo VIP'; end if;
    if i.vip_price is null then raise exception 'Ese artículo no está a la venta'; end if;
    v_price := i.vip_price;
    select vip_balance into v_bal from points_totals(v_uid);
    if v_bal < v_price then raise exception 'Te faltan % monedas VIP', v_price - v_bal; end if;
    insert into user_items (user_id, item_id, source, currency, price_paid) values (v_uid, p_item, 'purchase', 'vip', v_price);
    return jsonb_build_object('item', p_item, 'price_paid', v_price, 'currency', 'vip', 'balance', v_bal - v_price);
  end if;
  if i.price is null then raise exception 'Ese artículo no está a la venta'; end if;
  select price into v_price from shop_catalog where id = p_item;
  select balance into v_bal from points_totals(v_uid);
  if v_bal < v_price then raise exception 'Te faltan % puntos', v_price - v_bal; end if;
  insert into user_items (user_id, item_id, source, currency, price_paid) values (v_uid, p_item, 'purchase', 'points', v_price);
  return jsonb_build_object('item', p_item, 'price_paid', v_price, 'currency', 'points', 'balance', v_bal - v_price);
end $$;

-- Una subida propia como la necesita la web: null si se borró o si es animada y la cuenta no es VIP hoy.
-- id 'custom'; url y poster_url en vez de file. Interna de la vista y de set_my_cosmetics.
create function public.custom_cosmetic_json(p_id uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', 'custom', 'kind', c.kind,
                            'name', case when c.kind = 'avatar' then 'Avatar propio' else 'Fondo de miniperfil propio' end,
                            'file', null, 'css_class', null, 'animated', c.animated, 'vip_only', c.animated,
                            'url', c.url, 'poster_url', c.poster_url)
    from custom_cosmetics c
   where c.id = p_id and c.cleared_at is null and (not c.animated or is_vip(c.user_id))
$$;
grant execute on function public.custom_cosmetic_json(uuid) to anon, authenticated, service_role;

-- Cambia lo equipado. p_data con frame, avatar, background, theme, name (null o "" lo saca) y stickers (lista, hasta 3).
-- En avatar y background, "custom:<id>" pone una subida propia guardada (gratis). Las claves que no vienen no se tocan.
-- Devuelve lo equipado (lo propio, como "custom:<id>").
create function public.set_my_cosmetics(p_data jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r user_cosmetics; k text; v text; st text[]; cu uuid;
begin
  if v_uid is null then raise exception 'Inicia sesión' using errcode = '42501'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Datos inválidos'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));
  insert into user_cosmetics (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into r from user_cosmetics where user_id = v_uid;
  foreach k in array array['frame', 'avatar', 'background', 'theme', 'name'] loop
    if p_data ? k then
      v := nullif(p_data ->> k, '');
      cu := null;
      if v like 'custom:%' and k in ('avatar', 'background') then
        if v !~ '^custom:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Subida inválida'; end if;
        cu := substr(v, 8)::uuid;
        if not exists (select 1 from custom_cosmetics where id = cu and user_id = v_uid and kind = k and cleared_at is null) then
          raise exception 'No tienes ese % guardado', case k when 'avatar' then 'avatar' else 'fondo de miniperfil' end;
        end if;
        if custom_cosmetic_json(cu) is null then raise exception 'Lo animado se usa siendo VIP'; end if;
        v := null;
      elsif v is not null then
        if not exists (select 1 from shop_items where id = v and kind = k) then raise exception 'Ese artículo no es del tipo %', k; end if;
        if not can_use_item(v_uid, v) then raise exception 'Todavía no tienes ese artículo'; end if;
      end if;
      case k when 'frame' then r.frame := v;
             when 'avatar' then r.avatar := v; r.avatar_custom := cu;
             when 'background' then r.background := v; r.background_custom := cu;
             when 'theme' then r.theme := v; else r.name := v; end case;
    end if;
  end loop;
  if p_data ? 'stickers' then
    if jsonb_typeof(p_data -> 'stickers') <> 'array' then raise exception 'stickers tiene que ser una lista'; end if;
    -- sin repetir y en el orden en que llegaron
    select coalesce(array_agg(x order by o), '{}') into st
      from (select distinct on (x) x, o from jsonb_array_elements_text(p_data -> 'stickers') with ordinality t(x, o)
             where x <> '' order by x, o) s;
    if cardinality(st) > 3 then raise exception 'Puedes equipar hasta 3 stickers'; end if;
    foreach v in array st loop
      if not exists (select 1 from shop_items where id = v and kind = 'sticker') then raise exception 'Ese artículo no es un sticker'; end if;
      if not can_use_item(v_uid, v) then raise exception 'Todavía no tienes ese sticker'; end if;
    end loop;
    r.stickers := st;
  end if;
  update user_cosmetics set frame = r.frame, avatar = r.avatar, background = r.background, theme = r.theme, name = r.name,
         stickers = r.stickers, avatar_custom = r.avatar_custom, background_custom = r.background_custom, updated_at = now()
   where user_id = v_uid;
  return jsonb_build_object('frame', r.frame,
                            'avatar', coalesce('custom:' || r.avatar_custom, r.avatar),
                            'background', coalesce('custom:' || r.background_custom, r.background),
                            'theme', r.theme, 'name', r.name, 'stickers', to_jsonb(r.stickers));
end $$;

revoke all on function public.shop_buy(text), public.set_my_cosmetics(jsonb) from public, anon;
grant execute on function public.shop_buy(text), public.set_my_cosmetics(jsonb) to authenticated, service_role;

-- Un artículo como lo necesita la web para dibujarlo. Interna de la vista.
create function public.cosmetic_json(p_item text) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', i.id, 'kind', i.kind, 'name', i.name, 'file', i.file, 'css_class', i.css_class,
                            'animated', i.animated, 'vip_only', i.vip_only)
    from shop_items i where i.id = p_item
$$;
grant execute on function public.cosmetic_json(text) to anon, authenticated, service_role;

-- Lo que tiene puesto cada ficha con cuenta, resuelto y sin lo que no puede usar hoy (VIP vencido o artículo quitado).
-- Pública a propósito: es lo que se ve en el perfil. Corre con los permisos del dueño de la vista (lee user_cosmetics).
create view public.player_cosmetics_public as
select p.id as player_id, c.user_id, is_vip(c.user_id) as vip,
       case when can_use_item(c.user_id, c.frame) then cosmetic_json(c.frame) end as frame,
       case when c.avatar_custom is not null then custom_cosmetic_json(c.avatar_custom)
            when can_use_item(c.user_id, c.avatar) then cosmetic_json(c.avatar) end as avatar,
       case when c.background_custom is not null then custom_cosmetic_json(c.background_custom)
            when can_use_item(c.user_id, c.background) then cosmetic_json(c.background) end as background,
       case when can_use_item(c.user_id, c.theme) then cosmetic_json(c.theme) end as theme,
       case when can_use_item(c.user_id, c.name) then cosmetic_json(c.name) end as name,
       coalesce((select jsonb_agg(cosmetic_json(s) order by o) from unnest(c.stickers) with ordinality u(s, o)
                  where can_use_item(c.user_id, s)), '[]'::jsonb) as stickers
  from user_cosmetics c
  join players p on p.user_id = c.user_id;
comment on view public.player_cosmetics_public is 'Cosméticos equipados de cada ficha con cuenta (también el avatar y el fondo propios), sin los que no puede usar hoy. Replanteo 119';
grant select on public.player_cosmetics_public to anon, authenticated;

-- =====================================================================================================================
-- 6. Admin
-- =====================================================================================================================
-- Suma o resta puntos (p_currency 'points') o monedas VIP ('vip'), con motivo. Avisa a la cuenta.
create function public.admin_points_grant(p_user uuid, p_amount int, p_reason text, p_currency text default 'points') returns uuid
  language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'Solo un administrador puede dar puntos' using errcode = '42501'; end if;
  if p_currency not in ('points', 'vip') then raise exception 'Moneda inválida: points o vip'; end if;
  if coalesce(p_amount, 0) = 0 then raise exception 'La cantidad no puede ser 0'; end if;
  if abs(p_amount) > 1000000 then raise exception 'La cantidad es demasiado grande'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No existe ese usuario'; end if;
  insert into point_grants (user_id, currency, amount, reason, granted_by)
  values (p_user, p_currency, p_amount, btrim(p_reason), auth.uid()) returning id into v_id;
  perform notify(array[p_user], 'points_granted',
                 jsonb_build_object('amount', p_amount, 'currency', p_currency, 'reason', btrim(p_reason)));
  return v_id;
end $$;

-- Regala un artículo, también uno VIP o uno sin precio (lo VIP se usa mientras la cuenta sea VIP). El premio VIP no.
create function public.admin_item_grant(p_user uuid, p_item text, p_note text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare i shop_items;
begin
  if not is_admin() then raise exception 'Solo un administrador puede regalar artículos' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No existe ese usuario'; end if;
  select * into i from shop_items where id = p_item;
  if not found then raise exception 'No existe ese artículo'; end if;
  if i.vip_reward then raise exception 'Ese artículo viene con el VIP: dale VIP a la cuenta'; end if;
  if char_length(p_note) > 200 then raise exception 'La nota puede tener hasta 200 caracteres'; end if;
  insert into user_items (user_id, item_id, source, granted_by, note)
  values (p_user, p_item, 'grant', auth.uid(), nullif(btrim(p_note), ''))
  on conflict (user_id, item_id) do nothing;
  if not found then raise exception 'Ya lo tiene'; end if;
  perform notify(array[p_user], 'item_granted', jsonb_build_object('item', p_item, 'name', i.name, 'kind', i.kind));
end $$;

-- Quita un artículo del inventario y de lo equipado. No devuelve lo pagado: como lo gastado se calcula de user_items,
-- una compra quitada deja en point_grants un descuento por lo que costó, con el motivo (el saldo no cambia).
create function public.admin_item_revoke(p_user uuid, p_item text, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
declare v_name text; u user_items;
begin
  if not is_admin() then raise exception 'Solo un administrador puede quitar artículos' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || p_user::text));
  delete from user_items where user_id = p_user and item_id = p_item returning * into u;
  if not found then raise exception 'No tiene ese artículo'; end if;
  select name into v_name from shop_items where id = p_item;
  if u.source = 'purchase' and coalesce(u.price_paid, 0) > 0 then
    insert into point_grants (user_id, currency, amount, reason, granted_by)
    values (p_user, u.currency, -u.price_paid, left('Compra quitada: ' || v_name || ' (' || btrim(p_reason) || ')', 200), auth.uid());
  end if;
  update user_cosmetics set frame = nullif(frame, p_item), avatar = nullif(avatar, p_item), background = nullif(background, p_item),
         theme = nullif(theme, p_item), name = nullif(name, p_item), stickers = array_remove(stickers, p_item), updated_at = now()
   where user_id = p_user;
  perform notify(array[p_user], 'item_revoked', jsonb_build_object('item', p_item, 'name', v_name, 'reason', btrim(p_reason)));
end $$;

-- Cambia un artículo. p_changes con price (puntos; null lo saca de la venta), vip_price (monedas, solo lo VIP),
-- active, sort, name y description. Lo que no viene no se toca. Devuelve el artículo.
create function public.admin_shop_item_update(p_item text, p_changes jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare i shop_items; k text;
begin
  if not is_admin() then raise exception 'Solo un administrador puede editar la tienda' using errcode = '42501'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then raise exception 'Datos inválidos'; end if;
  for k in select jsonb_object_keys(p_changes) loop
    if k not in ('price', 'vip_price', 'active', 'sort', 'name', 'description', 'vip_only') then
      raise exception 'No se puede cambiar %', k;
    end if;
  end loop;
  select * into i from shop_items where id = p_item for update;
  if not found then raise exception 'No existe ese artículo'; end if;
  -- Pasar de todos a VIP o al revés: el precio de la otra moneda se borra (si no viene el nuevo, no se vende).
  -- Quien ya lo tiene lo conserva; si pasa a VIP, lo usa solo mientras sea VIP (can_use_item).
  if p_changes ? 'vip_only' and jsonb_typeof(p_changes -> 'vip_only') = 'boolean'
     and (p_changes ->> 'vip_only')::boolean is distinct from i.vip_only then
    if i.vip_reward then raise exception 'El artículo que viene con el VIP sigue siendo VIP'; end if;
    i.vip_only := (p_changes ->> 'vip_only')::boolean;
    if i.vip_only then i.price := null; else i.vip_price := null; end if;
  end if;
  if p_changes ? 'price' then
    if i.vip_only and jsonb_typeof(p_changes -> 'price') <> 'null' then raise exception 'Lo VIP no tiene precio en puntos: usa vip_price'; end if;
    i.price := (p_changes ->> 'price')::int;
    if i.price is not null and i.price < 1 then raise exception 'El precio tiene que ser mayor a 0'; end if;
  end if;
  if p_changes ? 'vip_price' then
    if (not i.vip_only or i.vip_reward) and jsonb_typeof(p_changes -> 'vip_price') <> 'null' then
      raise exception 'Solo los artículos VIP (menos el que viene con el VIP) tienen precio en monedas VIP';
    end if;
    i.vip_price := (p_changes ->> 'vip_price')::int;
    if i.vip_price is not null and i.vip_price < 1 then raise exception 'El precio tiene que ser mayor a 0'; end if;
  end if;
  if p_changes ? 'active' then i.active := coalesce((p_changes ->> 'active')::boolean, i.active); end if;
  if p_changes ? 'sort' then i.sort := coalesce((p_changes ->> 'sort')::int, i.sort); end if;
  if p_changes ? 'name' then i.name := coalesce(nullif(btrim(p_changes ->> 'name'), ''), i.name); end if;
  if p_changes ? 'description' then i.description := nullif(btrim(p_changes ->> 'description'), ''); end if;
  update shop_items set price = i.price, vip_price = i.vip_price, active = i.active, sort = i.sort,
         name = i.name, description = i.description, vip_only = i.vip_only
   where id = p_item;
  return to_jsonb(i);
end $$;

-- Cambia points_config (per_mix, per_win, vip_multiplier, vip_per_mix, vip_per_win, weekly_count, weekly_discount y los
-- precios de lo propio: custom_avatar_price, custom_bg_animated_price y custom_bg_static_price; y cuántos guarda cada
-- cuenta: custom_max_avatar y custom_max_background). Cambia el saldo de todos: los puntos se calculan. Bajar un tope
-- no borra nada: quien tiene más no sube otro hasta quedar debajo. Devuelve la configuración.
create function public.set_points_config(p_changes jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare c points_config; k text;
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar los puntos' using errcode = '42501'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then raise exception 'Datos inválidos'; end if;
  for k in select jsonb_object_keys(p_changes) loop
    if k not in ('per_mix', 'per_win', 'vip_multiplier', 'vip_per_mix', 'vip_per_win', 'weekly_count', 'weekly_discount',
                 'custom_avatar_price', 'custom_bg_animated_price', 'custom_bg_static_price',
                 'custom_max_avatar', 'custom_max_background') then
      raise exception 'No se puede cambiar %', k;
    end if;
    if jsonb_typeof(p_changes -> k) <> 'number' then raise exception '% tiene que ser un número', k; end if;
  end loop;
  update points_config set
    per_mix         = coalesce((p_changes ->> 'per_mix')::int, per_mix),
    per_win         = coalesce((p_changes ->> 'per_win')::int, per_win),
    vip_multiplier  = coalesce((p_changes ->> 'vip_multiplier')::numeric, vip_multiplier),
    vip_per_mix     = coalesce((p_changes ->> 'vip_per_mix')::int, vip_per_mix),
    vip_per_win     = coalesce((p_changes ->> 'vip_per_win')::int, vip_per_win),
    weekly_count    = coalesce((p_changes ->> 'weekly_count')::int, weekly_count),
    weekly_discount = coalesce((p_changes ->> 'weekly_discount')::int, weekly_discount),
    custom_avatar_price      = coalesce((p_changes ->> 'custom_avatar_price')::int, custom_avatar_price),
    custom_bg_animated_price = coalesce((p_changes ->> 'custom_bg_animated_price')::int, custom_bg_animated_price),
    custom_bg_static_price   = coalesce((p_changes ->> 'custom_bg_static_price')::int, custom_bg_static_price),
    custom_max_avatar        = coalesce((p_changes ->> 'custom_max_avatar')::int, custom_max_avatar),
    custom_max_background    = coalesce((p_changes ->> 'custom_max_background')::int, custom_max_background),
    updated_at = now(), updated_by = auth.uid()
   where id = 1
  returning * into c;
  return to_jsonb(c);
end $$;

-- Quita la portada de una cuenta (moderación), con motivo. La API borra el archivo. Devuelve la URL que tenía.
create function public.admin_cover_clear(p_user uuid, p_reason text) returns text
  language plpgsql security definer set search_path = public as $$
declare v_url text;
begin
  if not is_admin() then raise exception 'Solo un administrador puede quitar portadas' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  select cover_url into v_url from profile_details where user_id = p_user;
  if v_url is null then raise exception 'Esa cuenta no tiene portada'; end if;
  update profile_details set cover_url = null, updated_at = now() where user_id = p_user;
  perform notify(array[p_user], 'cover_removed', jsonb_build_object('reason', btrim(p_reason)));
  return v_url;
end $$;

-- Las cuentas con su saldo, para Administración › Tienda. Paginado, con búsqueda (alias o nick), filtro VIP y orden
-- (balance, vip_balance, mixes o alias, con :asc o :desc). total: cuántas cumplen el filtro.
create function public.admin_points_accounts(p_q text default null, p_vip boolean default null, p_sort text default 'balance:desc',
                                             p_limit int default 20, p_offset int default 0)
  returns table (user_id uuid, alias text, player_id uuid, nick text, vip boolean,
                 earned int, granted int, spent int, balance int, mixes int,
                 vip_earned int, vip_granted int, vip_spent int, vip_balance int, items int, cover_url text, total bigint)
  language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if not is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if coalesce(p_sort, 'balance:desc') not in ('balance:desc', 'balance:asc', 'vip_balance:desc', 'vip_balance:asc',
                                               'mixes:desc', 'mixes:asc', 'alias:asc', 'alias:desc') then
    raise exception 'Orden inválido';
  end if;
  return query
  with base as (
    select pr.id uid, pr.tag, pl.id pid, pl.nick pnick, is_vip(pr.id) v
      from profiles pr
      left join lateral (select x.id, x.nick from players x where x.user_id = pr.id order by x.id limit 1) pl on true
     where v_q is null or pr.tag ilike '%' || v_q || '%' or pl.nick ilike '%' || v_q || '%'
  ), filt as (select * from base where p_vip is null or base.v = p_vip)
  select f.uid, f.tag, f.pid, f.pnick, f.v, t.earned, t.granted, t.spent, t.balance, t.mixes,
         t.vip_earned, t.vip_granted, t.vip_spent, t.vip_balance,
         (select count(*)::int from user_items u where u.user_id = f.uid), d.cover_url, count(*) over ()
    from filt f
    cross join lateral points_totals(f.uid) t
    left join profile_details d on d.user_id = f.uid
   order by
     case when p_sort = 'balance:desc' then t.balance end desc nulls last,
     case when p_sort = 'balance:asc' then t.balance end asc nulls last,
     case when p_sort = 'vip_balance:desc' then t.vip_balance end desc nulls last,
     case when p_sort = 'vip_balance:asc' then t.vip_balance end asc nulls last,
     case when p_sort = 'mixes:desc' then t.mixes end desc nulls last,
     case when p_sort = 'mixes:asc' then t.mixes end asc nulls last,
     case when p_sort = 'alias:desc' then f.tag end desc nulls last,
     f.tag asc
   limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- El inventario de una cuenta: el dueño o un admin. usable: si hoy la puede usar.
create function public.user_items_of(p_user uuid default auth.uid())
  returns table (item_id text, kind text, name text, source text, currency text, price_paid int, note text,
                 acquired_at timestamptz, usable boolean)
  language plpgsql stable security definer set search_path = public as $$
begin
  if p_user is null or (p_user is distinct from auth.uid() and not is_admin()) then
    raise exception 'No puedes ver el inventario de otra cuenta' using errcode = '42501';
  end if;
  return query
  select u.item_id, i.kind, i.name, u.source, u.currency, u.price_paid, u.note, u.acquired_at, can_use_item(p_user, u.item_id)
    from user_items u join shop_items i on i.id = u.item_id
   where u.user_id = p_user
  union all
  -- el premio VIP no está en user_items: se muestra mientras sea VIP
  select i.id, i.kind, i.name, 'vip', null, null, null, null, true
    from shop_items i where i.vip_reward and is_vip(p_user)
   order by 8 desc nulls first;
end $$;

revoke all on function public.admin_points_grant(uuid, int, text, text), public.admin_item_grant(uuid, text, text),
  public.admin_item_revoke(uuid, text, text), public.admin_shop_item_update(text, jsonb), public.set_points_config(jsonb),
  public.admin_cover_clear(uuid, text), public.admin_points_accounts(text, boolean, text, int, int),
  public.user_items_of(uuid) from public, anon;
grant execute on function public.admin_points_grant(uuid, int, text, text), public.admin_item_grant(uuid, text, text),
  public.admin_item_revoke(uuid, text, text), public.admin_shop_item_update(text, jsonb), public.set_points_config(jsonb),
  public.admin_cover_clear(uuid, text), public.admin_points_accounts(text, boolean, text, int, int),
  public.user_items_of(uuid) to authenticated, service_role;

-- =====================================================================================================================
-- 7. Avisos nuevos en la categoría account (custom_removed: un moderador o un admin sacó el avatar o el fondo propio)
-- =====================================================================================================================
do $$
declare f text := pg_get_functiondef('public.notification_category'::regproc);
        a text := '''vip_granted'', ''vip_revoked'', ''vip_expiring'',';
begin
  if position(a in f) = 0 then raise exception 'replanteo 119: notification_category cambió (no encuentro los avisos del VIP)'; end if;
  execute replace(f, a, a || ' ''points_granted'', ''item_granted'', ''item_revoked'', ''cover_removed'', ''custom_removed'', -- (replanteo 119)' || chr(10) || '                   ');
  if notification_category('points_granted') is distinct from 'account' or notification_category('custom_removed') is distinct from 'account' then
    raise exception 'replanteo 119: el aviso no quedó en account';
  end if;
end $$;

-- =====================================================================================================================
-- 8. Lo propio: subir, borrar, sacar y denunciar
-- =====================================================================================================================
-- Los archivos: bucket cosmetics, público para leer. Cada cuenta escribe y borra en su carpeta <uid>/ (la API sube con la
-- sesión del jugador); lo que saca un moderador o un admin lo borra la API con la clave de servicio. El avatar y el fondo
-- animados son un WebM con su imagen fija en WebP; el fondo fijo, la imagen recortada (JPEG, PNG o WebP).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('cosmetics', 'cosmetics', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'video/webm'])
  on conflict (id) do nothing;
create policy "cosmetics: todos ven" on storage.objects for select to anon, authenticated using (bucket_id = 'cosmetics');
create policy "cosmetics: subir el propio" on storage.objects for insert to authenticated
  with check (bucket_id = 'cosmetics' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cosmetics: borrar el propio" on storage.objects for delete to authenticated
  using (bucket_id = 'cosmetics' and (storage.foldername(name))[1] = auth.uid()::text);

-- Interna: borra una subida del inventario (p_why deleted o removed) y se la saca si la tenía puesta.
-- Devuelve la fila cerrada (id null si no estaba guardada), para que la API borre los archivos.
create function public.custom_cosmetic_clear(p_id uuid, p_why text, p_by uuid) returns custom_cosmetics
  language plpgsql security definer set search_path = public as $$
declare o custom_cosmetics;
begin
  update custom_cosmetics set cleared_at = now(), cleared_reason = p_why, cleared_by = p_by
   where id = p_id and cleared_at is null
  returning * into o;
  if o.id is not null then
    update user_cosmetics set avatar_custom = nullif(avatar_custom, o.id), background_custom = nullif(background_custom, o.id),
           updated_at = now()
     where user_id = o.user_id and o.id in (avatar_custom, background_custom);
  end if;
  return o;
end $$;
revoke all on function public.custom_cosmetic_clear(uuid, text, uuid) from public, anon, authenticated;

-- Sube lo propio (la API ya guardó los archivos): avatar (siempre animado, VIP, monedas VIP) o background (animado: VIP,
-- monedas VIP; fijo: cualquiera, puntos). p_price es el precio que vio el jugador: si cambió, no cobra. Si ya guarda el
-- tope de ese tipo, no cobra. Cobra, la guarda (las anteriores siguen guardadas) y se la pone. Devuelve el id de la
-- subida, lo pagado y el saldo nuevo.
create function public.custom_cosmetic_set(p_kind text, p_animated boolean, p_url text, p_poster text, p_price int) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); c points_config; v_price int; v_cur text; v_bal int; v_max int; v_id uuid;
begin
  if v_uid is null then raise exception 'Inicia sesión para subir' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('avatar', 'background') then raise exception 'El tipo es avatar o background'; end if;
  if p_animated is null then raise exception 'Falta decir si es animado'; end if;
  if p_kind = 'avatar' and not p_animated then raise exception 'El avatar propio es animado'; end if;
  if coalesce(char_length(p_url), 0) not between 1 and 500 or coalesce(char_length(p_poster), 0) > 500 then
    raise exception 'Dirección del archivo inválida';
  end if;
  if p_animated and p_poster is null then raise exception 'Falta la imagen fija'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));
  if not exists (select 1 from players where user_id = v_uid) then
    raise exception 'Necesitas tu ficha de jugador vinculada para usar la tienda';
  end if;
  select * into c from points_config where id = 1;
  v_max := case when p_kind = 'avatar' then c.custom_max_avatar else c.custom_max_background end;
  if (select count(*) from custom_cosmetics where user_id = v_uid and kind = p_kind and cleared_at is null) >= v_max then
    raise exception 'Llegaste a % % guardados: borra uno para subir otro', v_max,
      case when p_kind = 'avatar' then 'avatares' else 'fondos de miniperfil' end;
  end if;
  if p_animated then
    if not is_vip(v_uid) then raise exception 'El avatar y el fondo animados propios son para los VIP'; end if;
    v_cur := 'vip';
    v_price := case when p_kind = 'avatar' then c.custom_avatar_price else c.custom_bg_animated_price end;
    select vip_balance into v_bal from points_totals(v_uid);
  else
    v_cur := 'points';
    v_price := c.custom_bg_static_price;
    select balance into v_bal from points_totals(v_uid);
  end if;
  if p_price is distinct from v_price then raise exception 'El precio cambió: ahora cuesta %', v_price; end if;
  if v_bal < v_price then
    raise exception 'Te faltan % %', v_price - v_bal, case when v_cur = 'vip' then 'monedas VIP' else 'puntos' end;
  end if;
  insert into custom_cosmetics (user_id, kind, animated, url, poster_url, currency, price)
  values (v_uid, p_kind, p_animated, p_url, p_poster, v_cur, v_price) returning id into v_id;
  insert into user_cosmetics (user_id) values (v_uid) on conflict (user_id) do nothing;
  if p_kind = 'avatar' then
    update user_cosmetics set avatar = null, avatar_custom = v_id, updated_at = now() where user_id = v_uid;
  else
    update user_cosmetics set background = null, background_custom = v_id, updated_at = now() where user_id = v_uid;
  end if;
  return jsonb_build_object('id', v_id, 'price_paid', v_price, 'currency', v_cur, 'balance', v_bal - v_price);
end $$;

-- El dueño borra una subida guardada (puesta o no). No devuelve lo pagado. Devuelve los archivos para que la API los
-- borre.
create function public.custom_cosmetic_delete(p_id uuid) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); o custom_cosmetics;
begin
  if v_uid is null then raise exception 'Inicia sesión' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));
  if not exists (select 1 from custom_cosmetics where id = p_id and user_id = v_uid and cleared_at is null) then
    raise exception 'No tienes esa subida guardada' using errcode = 'P0002';
  end if;
  o := custom_cosmetic_clear(p_id, 'deleted', v_uid);
  return jsonb_build_object('url', o.url, 'poster_url', o.poster_url);
end $$;

-- El texto del motivo de una denuncia, para el aviso al dueño.
create function public.media_report_reason_label(p_reason text) returns text
  language sql immutable set search_path = public as $$
  select case p_reason when 'copyright' then 'Usa una imagen de otra persona sin permiso'
                       when 'nsfw' then 'Contenido sexual o explícito'
                       when 'offensive' then 'Contenido ofensivo'
                       else 'No respeta las reglas de la comunidad' end
$$;

-- Denuncias de imágenes del perfil: el avatar o el fondo propios, o la portada. Como las de comentarios (replanteo 94).
-- url: la imagen que se denunció (si el dueño la cambia, la denuncia queda sobre la vieja).
create table public.profile_media_reports (
  id          uuid primary key default gen_random_uuid(),
  target      uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('avatar', 'background', 'cover')),
  url         text not null check (char_length(url) <= 500),
  poster_url  text check (char_length(poster_url) <= 500),
  reporter    uuid not null references auth.users(id) on delete cascade,
  reason      text not null check (reason in ('copyright', 'nsfw', 'offensive', 'other')),
  note        text check (char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  status      text not null default 'open' check (status in ('open', 'dismissed', 'removed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  unique (url, reporter)
);
comment on table public.profile_media_reports is 'Denuncias del avatar, el fondo propio y la portada de un perfil: las revisan moderadores y admins. Replanteo 119';
create index profile_media_reports_status on public.profile_media_reports (status, created_at desc);
create index profile_media_reports_reporter on public.profile_media_reports (reporter, created_at desc);
alter table public.profile_media_reports enable row level security;
revoke all on public.profile_media_reports from anon, authenticated;

-- Admin (Gestionar en Administración › Tienda): saca una subida guardada de una cuenta (puesta o no), con motivo. No
-- devuelve lo pagado. Avisa a la cuenta y cierra las denuncias abiertas de esa imagen. Las demás guardadas siguen.
-- Devuelve los archivos para que la API los borre.
create function public.admin_custom_clear(p_user uuid, p_id uuid, p_reason text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare o custom_cosmetics;
begin
  if not is_admin() then raise exception 'Solo un administrador puede sacar lo propio' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || p_user::text));
  if not exists (select 1 from custom_cosmetics where id = p_id and user_id = p_user and cleared_at is null) then
    raise exception 'Esa cuenta no tiene esa subida guardada' using errcode = 'P0002';
  end if;
  o := custom_cosmetic_clear(p_id, 'removed', auth.uid());
  update profile_media_reports set status = 'removed', resolved_by = auth.uid(), resolved_at = now()
   where url = o.url and status = 'open';
  perform notify(array[p_user], 'custom_removed', jsonb_build_object('kind', o.kind, 'reason', btrim(p_reason)));
  return jsonb_build_object('url', o.url, 'poster_url', o.poster_url);
end $$;

-- Denuncia la imagen que se ve hoy en el perfil de una ficha: avatar o background (los propios) o cover. Una vez por
-- cuenta e imagen, 20 por día (Bogotá, como las de comentarios).
create function public.profile_media_report(p_player uuid, p_kind text, p_reason text, p_note text default null) returns uuid
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); v_target uuid; v_url text; v_poster text; j jsonb;
        v_note text := nullif(btrim(coalesce(p_note, '')), ''); v_id uuid;
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('avatar', 'background', 'cover') then
    raise exception 'Lo que se denuncia es avatar, background o cover' using errcode = 'P0001';
  end if;
  if p_reason is null or p_reason not in ('copyright', 'nsfw', 'offensive', 'other') then
    raise exception 'El motivo es copyright, nsfw, offensive u other' using errcode = 'P0001';
  end if;
  if char_length(v_note) > 300 then raise exception 'La nota tiene más de 300 caracteres' using errcode = 'P0001'; end if;
  select user_id into v_target from players where id = p_player;
  if v_target is null then raise exception 'Ese jugador no tiene cuenta' using errcode = 'P0002'; end if;
  if v_target = me then raise exception 'No puedes denunciar tu propia imagen' using errcode = 'P0001'; end if;
  if p_kind = 'cover' then
    select cover_url into v_url from profile_details where user_id = v_target;
  else
    select case p_kind when 'avatar' then x.avatar else x.background end into j
      from player_cosmetics_public x where x.player_id = p_player;
    if j ->> 'id' = 'custom' then v_url := j ->> 'url'; v_poster := j ->> 'poster_url'; end if;
  end if;
  if v_url is null then raise exception 'Esa imagen ya no está en el perfil' using errcode = 'P0002'; end if;
  if exists (select 1 from profile_media_reports where url = v_url and reporter = me) then
    raise exception 'Ya denunciaste esa imagen' using errcode = 'P0001';
  end if;
  if (select count(*) from profile_media_reports where reporter = me
        and (created_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date) >= 20 then
    raise exception 'Llegaste al tope de 20 denuncias por día' using errcode = 'P0001';
  end if;
  insert into profile_media_reports (target, kind, url, poster_url, reporter, reason, note)
  values (v_target, p_kind, v_url, v_poster, me, p_reason, v_note) returning id into v_id;
  return v_id;
end $$;

-- ¿La imagen denunciada sigue en la cuenta? La portada, si sigue puesta; lo propio, si sigue guardado (aunque se la
-- haya sacado: un moderador la puede borrar igual). Interna.
create function public.media_report_current(p_target uuid, p_kind text, p_url text) returns boolean
  language sql stable security definer set search_path = public as $$
  select case when p_kind = 'cover' then exists (select 1 from profile_details where user_id = p_target and cover_url = p_url)
              else exists (select 1 from custom_cosmetics where user_id = p_target and kind = p_kind and url = p_url and cleared_at is null) end
$$;
revoke all on function public.media_report_current(uuid, text, text) from public, anon, authenticated;

/**
 * Las denuncias de imágenes, para moderadores y admins. p_status: 'open', 'resolved' o null (todas). p_kind y p_reason:
 * uno o null. p_order: 'asc' o 'desc' (por fecha). Paginada. current: si la imagen sigue puesta.
 */
create function public.profile_media_reports_admin(p_status text default 'open', p_kind text default null, p_reason text default null,
                                                   p_order text default 'desc', p_limit integer default 20, p_offset integer default 0)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_moderator(), false) then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('open', 'resolved') then raise exception 'El estado es open o resolved' using errcode = 'P0001'; end if;
  if p_kind is not null and p_kind not in ('avatar', 'background', 'cover') then raise exception 'El tipo es avatar, background o cover' using errcode = 'P0001'; end if;
  if p_reason is not null and p_reason not in ('copyright', 'nsfw', 'offensive', 'other') then raise exception 'Motivo inválido' using errcode = 'P0001'; end if;
  if p_order not in ('asc', 'desc') then raise exception 'El orden es asc o desc' using errcode = 'P0001'; end if;
  return (
    with f as (
      select r.* from profile_media_reports r
       where (p_status is null or (p_status = 'open' and r.status = 'open') or (p_status = 'resolved' and r.status <> 'open'))
         and (p_kind is null or r.kind = p_kind) and (p_reason is null or r.reason = p_reason)),
    pg as (
      select row_number() over (order by case when p_order = 'asc' then r.created_at end asc,
                                         case when p_order = 'desc' then r.created_at end desc, r.id) as n,
             jsonb_build_object(
               'id', r.id, 'kind', r.kind, 'url', r.url, 'poster_url', r.poster_url, 'reason', r.reason, 'note', r.note,
               'created_at', r.created_at, 'status', r.status, 'resolved_at', r.resolved_at,
               'resolved_by', (select player_ref(p.id) from players p where p.user_id = r.resolved_by order by p.id limit 1),
               'reporter', (select player_ref(p.id) from players p where p.user_id = r.reporter order by p.id limit 1),
               'reports', (select count(*) from profile_media_reports o where o.url = r.url),
               'current', media_report_current(r.target, r.kind, r.url),
               'profile', (select player_ref(p.id) from players p where p.user_id = r.target order by p.id limit 1)) as j
        from f r
       order by n
       limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0))
    select jsonb_build_object('total', (select count(*) from f),
                              'items', coalesce((select jsonb_agg(j order by n) from pg), '[]'::jsonb)));
end $$;

/**
 * Moderador o admin: 'dismiss' descarta o 'remove' saca la imagen (si sigue puesta), sin devolver lo pagado, y le avisa
 * al dueño con el motivo. Cierra todas las denuncias abiertas de esa imagen. Devuelve los archivos sacados (url y
 * poster_url, null si no se sacó nada) para que la API los borre.
 */
create function public.profile_media_report_resolve(p_report uuid, p_action text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r profile_media_reports%rowtype; o custom_cosmetics;
        v_out jsonb := jsonb_build_object('url', null, 'poster_url', null);
begin
  if not coalesce(is_moderator(), false) then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('dismiss', 'remove') then raise exception 'La acción es dismiss o remove' using errcode = 'P0001'; end if;
  select * into r from profile_media_reports where id = p_report for update;
  if r.id is null then raise exception 'Esa denuncia no existe' using errcode = 'P0002'; end if;
  if r.status <> 'open' then raise exception 'Esa denuncia ya se resolvió' using errcode = 'P0001'; end if;
  if p_action = 'remove' and media_report_current(r.target, r.kind, r.url) then
    if r.kind = 'cover' then
      update profile_details set cover_url = null, updated_at = now() where user_id = r.target;
      perform notify(array[r.target], 'cover_removed', jsonb_build_object('reason', media_report_reason_label(r.reason)));
      v_out := jsonb_build_object('url', r.url, 'poster_url', null);
    else
      perform pg_advisory_xact_lock(hashtext('shop:' || r.target::text));
      -- solo esa subida: las demás guardadas de la cuenta siguen
      o := custom_cosmetic_clear((select id from custom_cosmetics
                                   where user_id = r.target and kind = r.kind and url = r.url and cleared_at is null
                                   order by created_at desc limit 1), 'removed', me);
      perform notify(array[r.target], 'custom_removed',
                     jsonb_build_object('kind', r.kind, 'reason', media_report_reason_label(r.reason)));
      v_out := jsonb_build_object('url', o.url, 'poster_url', o.poster_url);
    end if;
  end if;
  update profile_media_reports set status = case when p_action = 'remove' then 'removed' else 'dismissed' end,
         resolved_by = me, resolved_at = now()
   where url = r.url and status = 'open';
  return v_out;
end $$;

revoke all on function public.custom_cosmetic_set(text, boolean, text, text, int), public.custom_cosmetic_delete(uuid),
  public.admin_custom_clear(uuid, uuid, text), public.profile_media_report(uuid, text, text, text),
  public.profile_media_reports_admin(text, text, text, text, integer, integer), public.profile_media_report_resolve(uuid, text),
  public.media_report_reason_label(text) from public, anon;
grant execute on function public.custom_cosmetic_set(text, boolean, text, text, int), public.custom_cosmetic_delete(uuid),
  public.admin_custom_clear(uuid, uuid, text), public.profile_media_report(uuid, text, text, text),
  public.profile_media_reports_admin(text, text, text, text, integer, integer), public.profile_media_report_resolve(uuid, text),
  public.media_report_reason_label(text) to authenticated, service_role;

-- =====================================================================================================================
-- 9. Carga del catálogo
-- =====================================================================================================================
-- Generado con docs/bitacora/2026-11-11-tienda-de-puntos/pruebas/generar_catalogo.py desde
-- web/frontend/public/cosmetics/catalogo.json. Precios en puntos de Kyan (kyan/pruebas, generar_catalogo_sql.py y
-- generar_fondos.py) y precio en monedas VIP del catálogo. El admin los cambia después.
-- --- inicio: catálogo generado ---
insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, vip_reward, animated, collection, price, vip_price, active, sort) values
  ('marco-vip-oro', 'frame', 'Oro VIP', 'Viene con el VIP: marco de oro con corona.', 'marcos/vip-oro.svg', null, true, true, true, 'vip', null, null, true, 10),
  ('marco-mira', 'frame', 'Mira', 'Esquinas tácticas y mira que respira.', 'marcos/mira.svg', null, false, false, true, 'cs', 550, null, true, 20),
  ('marco-trazadoras', 'frame', 'Trazadoras', 'Balas trazadoras que dan la vuelta al avatar.', 'marcos/trazadoras.svg', null, false, false, true, 'cs', 550, null, true, 30),
  ('marco-c4', 'frame', 'C4', 'Cinta de peligro, cables y la cuenta regresiva.', 'marcos/c4.svg', null, false, false, true, 'cs', 550, null, true, 40),
  ('marco-circuito', 'frame', 'Circuito', 'Pistas verdes con pulsos de energía.', 'marcos/circuito.svg', null, false, false, true, 'cs', 550, null, true, 50),
  ('marco-fuego', 'frame', 'Fuego', 'Llamas vivas y chispas que suben.', 'marcos/fuego.svg', null, false, false, true, 'cs', 550, null, false, 60),
  ('marco-camuflaje', 'frame', 'Camuflaje', 'Patrón militar con placas de identificación.', 'marcos/camuflaje.svg', null, false, false, false, 'cs', 400, null, true, 70),
  ('marco-hielo', 'frame', 'Hielo', 'Escarcha, carámbanos y nieve que cae.', 'marcos/hielo.svg', null, false, false, true, 'cs', 550, null, true, 80),
  ('marco-balas', 'frame', 'Cinta de balas', 'Cartuchos de bronce alrededor del avatar.', 'marcos/balas.svg', null, false, false, false, 'cs', 400, null, false, 90),
  ('marco-pixel', 'frame', 'Píxel', 'Borde de 8 bits que se mueve.', 'marcos/pixel.svg', null, false, false, true, 'cs', 550, null, false, 100),
  ('marco-grafiti', 'frame', 'Grafiti', 'Pintura en aerosol que chorrea.', 'marcos/grafiti.svg', null, false, false, true, 'cs', 550, null, true, 110),
  ('marco-pais-ar', 'frame', 'Argentina', 'Los colores de Argentina alrededor del avatar.', 'marcos/pais-ar.svg', null, false, false, true, 'paises', 450, null, true, 120),
  ('marco-pais-br', 'frame', 'Brasil', 'Los colores de Brasil alrededor del avatar.', 'marcos/pais-br.svg', null, false, false, true, 'paises', 450, null, true, 130),
  ('marco-pais-uy', 'frame', 'Uruguay', 'Los colores de Uruguay alrededor del avatar.', 'marcos/pais-uy.svg', null, false, false, true, 'paises', 450, null, true, 140),
  ('marco-pais-cl', 'frame', 'Chile', 'Los colores de Chile alrededor del avatar.', 'marcos/pais-cl.svg', null, false, false, true, 'paises', 450, null, true, 150),
  ('marco-pais-pe', 'frame', 'Perú', 'Los colores de Perú alrededor del avatar.', 'marcos/pais-pe.svg', null, false, false, true, 'paises', 450, null, true, 160),
  ('marco-pais-co', 'frame', 'Colombia', 'Los colores de Colombia alrededor del avatar.', 'marcos/pais-co.svg', null, false, false, true, 'paises', 450, null, true, 170),
  ('marco-pais-ve', 'frame', 'Venezuela', 'Los colores de Venezuela alrededor del avatar.', 'marcos/pais-ve.svg', null, false, false, true, 'paises', 450, null, true, 180),
  ('marco-pais-ec', 'frame', 'Ecuador', 'Los colores de Ecuador alrededor del avatar.', 'marcos/pais-ec.svg', null, false, false, true, 'paises', 450, null, true, 190),
  ('marco-pais-bo', 'frame', 'Bolivia', 'Los colores de Bolivia alrededor del avatar.', 'marcos/pais-bo.svg', null, false, false, true, 'paises', 450, null, true, 200),
  ('marco-pais-py', 'frame', 'Paraguay', 'Los colores de Paraguay alrededor del avatar.', 'marcos/pais-py.svg', null, false, false, true, 'paises', 450, null, true, 210),
  ('marco-pais-mx', 'frame', 'México', 'Los colores de México alrededor del avatar.', 'marcos/pais-mx.svg', null, false, false, true, 'paises2', 450, null, true, 220),
  ('marco-pais-cr', 'frame', 'Costa Rica', 'Los colores de Costa Rica alrededor del avatar.', 'marcos/pais-cr.svg', null, false, false, true, 'paises2', 450, null, true, 230),
  ('marco-pais-cu', 'frame', 'Cuba', 'Los colores de Cuba alrededor del avatar.', 'marcos/pais-cu.svg', null, false, false, true, 'paises2', 450, null, true, 240),
  ('marco-pais-do', 'frame', 'Rep. Dominicana', 'Los colores de Rep. Dominicana alrededor del avatar.', 'marcos/pais-do.svg', null, false, false, true, 'paises2', 450, null, true, 250),
  ('marco-pais-pr', 'frame', 'Puerto Rico', 'Los colores de Puerto Rico alrededor del avatar.', 'marcos/pais-pr.svg', null, false, false, true, 'paises2', 450, null, true, 260),
  ('marco-pais-pa', 'frame', 'Panamá', 'Los colores de Panamá alrededor del avatar.', 'marcos/pais-pa.svg', null, false, false, true, 'paises2', 450, null, true, 270),
  ('marco-pais-gt', 'frame', 'Guatemala', 'Los colores de Guatemala alrededor del avatar.', 'marcos/pais-gt.svg', null, false, false, true, 'paises2', 450, null, true, 280),
  ('marco-pais-hn', 'frame', 'Honduras', 'Los colores de Honduras alrededor del avatar.', 'marcos/pais-hn.svg', null, false, false, true, 'paises2', 450, null, true, 290),
  ('marco-pais-sv', 'frame', 'El Salvador', 'Los colores de El Salvador alrededor del avatar.', 'marcos/pais-sv.svg', null, false, false, true, 'paises2', 450, null, true, 300),
  ('marco-pais-es', 'frame', 'España', 'Los colores de España alrededor del avatar.', 'marcos/pais-es.svg', null, false, false, true, 'paises2', 450, null, true, 310),
  ('marco-mapa-dust2', 'frame', 'de_dust2', 'Arena, muros de adobe y la larga de toda la vida.', 'marcos/mapa-dust2.svg', null, false, false, false, 'mapas', 400, null, true, 320),
  ('marco-mapa-inferno', 'frame', 'de_inferno', 'Ladrillo italiano y la banana.', 'marcos/mapa-inferno.svg', null, false, false, false, 'mapas', 400, null, true, 330),
  ('marco-mapa-nuke', 'frame', 'de_nuke', 'Planta nuclear con franjas de peligro.', 'marcos/mapa-nuke.svg', null, false, false, false, 'mapas', 400, null, true, 340),
  ('marco-mapa-train', 'frame', 'de_train', 'Vías, vagones y metal.', 'marcos/mapa-train.svg', null, false, false, false, 'mapas', 400, null, true, 350),
  ('marco-mapa-office', 'frame', 'cs_office', 'Nieve afuera y rehenes adentro.', 'marcos/mapa-office.svg', null, false, false, false, 'mapas', 400, null, true, 360),
  ('marco-mapa-aztec', 'frame', 'de_aztec', 'Selva, templo y el puente colgante.', 'marcos/mapa-aztec.svg', null, false, false, false, 'mapas', 400, null, true, 370),
  ('marco-mapa-cbble', 'frame', 'de_cbble', 'Adoquines y murallas de castillo.', 'marcos/mapa-cbble.svg', null, false, false, false, 'mapas', 400, null, true, 380),
  ('marco-mapa-italy', 'frame', 'cs_italy', 'Techos de teja y el mercado.', 'marcos/mapa-italy.svg', null, false, false, false, 'mapas', 400, null, true, 390),
  ('marco-mapa-piranesi', 'frame', 'de_piranesi', 'Ruinas de piedra y arcos.', 'marcos/mapa-piranesi.svg', null, false, false, false, 'mapas', 400, null, true, 400),
  ('marco-mapa-prodigy', 'frame', 'de_prodigy', 'Laboratorio subterráneo y rejillas.', 'marcos/mapa-prodigy.svg', null, false, false, false, 'mapas', 400, null, true, 410),
  ('marco-kevlar', 'frame', 'Kevlar', 'Placa blindada con trama hexagonal.', 'marcos/kevlar.svg', null, true, false, true, 'cs', null, 450, true, 420),
  ('marco-neon', 'frame', 'Neón', 'Degradado rosa, violeta y cian que gira sin parar.', 'marcos/neon.svg', null, true, false, true, 'cs', null, 450, true, 430),
  ('marco-oro-vip', 'frame', 'Oro VIP', 'Corona, laureles y destello dorado.', 'marcos/oro-vip.svg', null, true, false, true, 'cs', null, 450, true, 440),
  ('marco-diamante', 'frame', 'Diamante', 'Facetas de cristal con destellos.', 'marcos/diamante.svg', null, true, false, true, 'cs', null, 450, true, 450),
  ('marco-plasma', 'frame', 'Plasma', 'Descargas eléctricas violetas.', 'marcos/plasma.svg', null, true, false, true, 'cs', null, 450, true, 460),
  ('marco-galaxia', 'frame', 'Galaxia', 'Nebulosas que giran y estrellas fugaces.', 'marcos/galaxia.svg', null, true, false, true, 'cs', null, 450, false, 470),
  ('marco-holografico', 'frame', 'Holográfico', 'Iridiscente, cambia de color sin parar.', 'marcos/holografico.svg', null, true, false, true, 'cs', null, 450, true, 480),
  ('marco-laser', 'frame', 'Láser', 'Mira láser que barre el avatar.', 'marcos/laser.svg', null, true, false, true, 'cs', null, 450, true, 490),
  ('marco-glitch', 'frame', 'Glitch', 'Señal rota en rojo y cian.', 'marcos/glitch.svg', null, true, false, true, 'cs', null, 450, true, 500),
  ('marco-alas', 'frame', 'Alas', 'Alas blancas y aureola dorada.', 'marcos/alas.svg', null, true, false, true, 'cs', null, 450, false, 510),
  ('marco-serie-ninja', 'frame', 'Shinobi', 'Espiral, cinta y shurikens que giran.', 'marcos/serie-ninja.svg', null, true, false, true, 'series', null, 450, true, 520),
  ('marco-serie-guerrero', 'frame', 'Súper guerrero', 'Aura dorada que arde y rayos que chispean.', 'marcos/serie-guerrero.svg', null, true, false, true, 'series', null, 450, true, 530),
  ('marco-serie-alien', 'frame', 'Reloj alien', 'Panel verde con el dial que transforma.', 'marcos/serie-alien.svg', null, true, false, true, 'series', null, 450, false, 540),
  ('marco-serie-portal', 'frame', 'Portal', 'Un portal verde a otra dimensión que no para de girar.', 'marcos/serie-portal.svg', null, true, false, true, 'series', null, 450, true, 550),
  ('marco-serie-navaja', 'frame', 'Gorra y navaja', 'Marco art déco de 1919 con una navaja en la visera.', 'marcos/serie-navaja.svg', null, true, false, true, 'series', null, 450, true, 560),
  ('marco-serie-laboratorio', 'frame', 'Laboratorio', 'Cristales azules, burbujas y la tabla periódica de CS:S.', 'marcos/serie-laboratorio.svg', null, true, false, true, 'series', null, 450, true, 570),
  ('marco-serie-reves', 'frame', 'Mundo del revés', 'Luces de colores que titilan y esporas en el aire.', 'marcos/serie-reves.svg', null, true, false, true, 'series', null, 450, true, 580),
  ('marco-serie-reinos', 'frame', 'Reinos', 'Acero, espadas, una corona y nieve que cae.', 'marcos/serie-reinos.svg', null, true, false, true, 'series', null, 450, true, 590),
  ('marco-serie-atraco', 'frame', 'Atraco', 'Mono rojo, lingote de oro y billetes volando.', 'marcos/serie-atraco.svg', null, true, false, true, 'series', null, 450, true, 600),
  ('marco-serie-juego', 'frame', 'Juego mortal', 'Círculo, triángulo y cuadrado. Jugador N°034.', 'marcos/serie-juego.svg', null, true, false, true, 'series', null, 450, false, 610),
  ('marco-arma-ak', 'frame', 'AK-47 Lava', 'Acabado Lava con el arma abajo y un brillo que corre.', 'marcos/arma-ak.svg', null, true, false, true, 'arsenal', null, 450, true, 620),
  ('marco-arma-m4', 'frame', 'M4A1 Ártico', 'Acabado Ártico con el arma abajo y un brillo que corre.', 'marcos/arma-m4.svg', null, true, false, true, 'arsenal', null, 450, true, 630),
  ('marco-arma-awp', 'frame', 'AWP Relámpago', 'Acabado Relámpago con el arma abajo y un brillo que corre.', 'marcos/arma-awp.svg', null, true, false, true, 'arsenal', null, 450, true, 640),
  ('marco-arma-deagle', 'frame', 'Deagle Oro macizo', 'Acabado Oro macizo con el arma abajo y un brillo que corre.', 'marcos/arma-deagle.svg', null, true, false, true, 'arsenal', null, 450, true, 650),
  ('marco-arma-scout', 'frame', 'Scout Selva', 'Acabado Selva con el arma abajo y un brillo que corre.', 'marcos/arma-scout.svg', null, true, false, true, 'arsenal', null, 450, true, 660),
  ('marco-arma-usp', 'frame', 'USP Medianoche', 'Acabado Medianoche con el arma abajo y un brillo que corre.', 'marcos/arma-usp.svg', null, true, false, true, 'arsenal', null, 450, true, 670),
  ('marco-arma-glock', 'frame', 'Glock Caramelo', 'Acabado Caramelo con el arma abajo y un brillo que corre.', 'marcos/arma-glock.svg', null, true, false, true, 'arsenal', null, 450, true, 680),
  ('marco-arma-mp5', 'frame', 'MP5 Neón', 'Acabado Neón con el arma abajo y un brillo que corre.', 'marcos/arma-mp5.svg', null, true, false, true, 'arsenal', null, 450, true, 690),
  ('marco-arma-cuchillo', 'frame', 'Cuchillo Fantasma', 'Acabado Fantasma con el arma abajo y un brillo que corre.', 'marcos/arma-cuchillo.svg', null, true, false, true, 'arsenal', null, 450, true, 700),
  ('marco-arma-he', 'frame', 'HE Arcoíris', 'Acabado Arcoíris con el arma abajo y un brillo que corre.', 'marcos/arma-he.svg', null, true, false, true, 'arsenal', null, 450, true, 710),
  ('marco-serie-dona', 'frame', 'Dona glaseada', 'Amarillo de pueblo chico y una dona que flota.', 'marcos/serie-dona.svg', null, true, false, true, 'series2', null, 450, true, 720),
  ('marco-serie-zombi', 'frame', 'Apocalipsis zombi', 'Tierra removida y una mano que sale.', 'marcos/serie-zombi.svg', null, true, false, true, 'series2', null, 450, true, 730),
  ('marco-serie-barril', 'frame', 'La vecindad', 'Madera de patio y un barril para esconderse.', 'marcos/serie-barril.svg', null, true, false, true, 'series2', null, 450, true, 740),
  ('marco-serie-fuga', 'frame', 'La fuga', 'Mono naranja y barrotes, con uno doblado.', 'marcos/serie-fuga.svg', null, true, false, true, 'series2', null, 450, true, 750),
  ('marco-serie-radiacion', 'frame', 'Reactor 4', 'Peligro radiactivo que late.', 'marcos/serie-radiacion.svg', null, true, false, true, 'series2', null, 450, true, 760),
  ('marco-serie-vikingo', 'frame', 'Vikingo', 'Madera, hierro y el casco con cuernos.', 'marcos/serie-vikingo.svg', null, true, false, true, 'series2', null, 450, true, 770),
  ('marco-serie-elementos', 'frame', 'Cuatro elementos', 'Agua, tierra, fuego y aire girando.', 'marcos/serie-elementos.svg', null, true, false, true, 'series2', null, 450, true, 780),
  ('marco-serie-robot', 'frame', 'Robot del futuro', 'Metal del año 3000 y luces que parpadean.', 'marcos/serie-robot.svg', null, true, false, true, 'series2', null, 450, true, 790),
  ('marco-serie-fondo-mar', 'frame', 'Fondo de mar', 'Agua, burbujas y una casa con forma de fruta.', 'marcos/serie-fondo-mar.svg', null, true, false, true, 'series2', null, 450, true, 800),
  ('marco-serie-isla', 'frame', 'La isla', 'Mar, arena y una palmera en medio de la nada.', 'marcos/serie-isla.svg', null, true, false, true, 'series2', null, 450, true, 810),
  ('sticker-gg', 'sticker', 'GG', 'Buena partida.', 'stickers/gg.svg', null, false, false, false, 'cs', 100, null, true, 820),
  ('sticker-nice-shot', 'sticker', 'NICE SHOT', 'Para el tiro de la ronda.', 'stickers/nice-shot.svg', null, false, false, false, 'cs', 100, null, true, 830),
  ('sticker-rush-b', 'sticker', 'RUSH B', 'Sin estrategia, sin miedo.', 'stickers/rush-b.svg', null, false, false, false, 'cs', 100, null, true, 840),
  ('sticker-1hp', 'sticker', '1 HP', 'Vivo de milagro.', 'stickers/1hp.svg', null, false, false, false, 'cs', 100, null, true, 850),
  ('sticker-clutch', 'sticker', 'CLUTCH', 'Último en pie, ronda ganada.', 'stickers/clutch.svg', null, false, false, false, 'cs', 100, null, true, 860),
  ('sticker-nt', 'sticker', 'NT', 'Nice try, la próxima sale.', 'stickers/nt.svg', null, false, false, false, 'cs', 100, null, true, 870),
  ('sticker-eco', 'sticker', 'ECO', 'Ronda de ahorro.', 'stickers/eco.svg', null, false, false, false, 'cs', 100, null, true, 880),
  ('sticker-afk', 'sticker', 'AFK', 'Ya vuelvo.', 'stickers/afk.svg', null, false, false, false, 'cs', 100, null, true, 890),
  ('sticker-pais-ar', 'sticker', 'CHE', 'CHE con la bandera de Argentina.', 'stickers/pais-ar.svg', null, false, false, false, 'paises', 150, null, true, 900),
  ('sticker-pais-br', 'sticker', 'BORA!', 'BORA! con la bandera de Brasil.', 'stickers/pais-br.svg', null, false, false, false, 'paises', 150, null, true, 910),
  ('sticker-pais-uy', 'sticker', 'GARRA', 'GARRA con la bandera de Uruguay.', 'stickers/pais-uy.svg', null, false, false, false, 'paises', 150, null, false, 920),
  ('sticker-pais-cl', 'sticker', '¿CACHAI?', '¿CACHAI? con la bandera de Chile.', 'stickers/pais-cl.svg', null, false, false, false, 'paises', 150, null, true, 930),
  ('sticker-pais-pe', 'sticker', 'CAUSA', 'CAUSA con la bandera de Perú.', 'stickers/pais-pe.svg', null, false, false, false, 'paises', 150, null, true, 940),
  ('sticker-pais-co', 'sticker', 'PARCE', 'PARCE con la bandera de Colombia.', 'stickers/pais-co.svg', null, false, false, false, 'paises', 150, null, true, 950),
  ('sticker-pais-ve', 'sticker', 'CHAMO', 'CHAMO con la bandera de Venezuela.', 'stickers/pais-ve.svg', null, false, false, false, 'paises', 150, null, true, 960),
  ('sticker-pais-ec', 'sticker', 'PANA', 'PANA con la bandera de Ecuador.', 'stickers/pais-ec.svg', null, false, false, false, 'paises', 150, null, false, 970),
  ('sticker-pais-bo', 'sticker', 'JALLALLA', 'JALLALLA con la bandera de Bolivia.', 'stickers/pais-bo.svg', null, false, false, false, 'paises', 150, null, false, 980),
  ('sticker-pais-py', 'sticker', 'JAHA', 'JAHA con la bandera de Paraguay.', 'stickers/pais-py.svg', null, false, false, false, 'paises', 150, null, false, 990),
  ('sticker-pais-mx', 'sticker', 'CHIDO', 'CHIDO con la bandera de México.', 'stickers/pais-mx.svg', null, false, false, false, 'paises2', 150, null, true, 1000),
  ('sticker-pais-cr', 'sticker', 'PURA VIDA', 'PURA VIDA con la bandera de Costa Rica.', 'stickers/pais-cr.svg', null, false, false, false, 'paises2', 150, null, false, 1010),
  ('sticker-pais-cu', 'sticker', 'ASERE', 'ASERE con la bandera de Cuba.', 'stickers/pais-cu.svg', null, false, false, false, 'paises2', 150, null, true, 1020),
  ('sticker-pais-do', 'sticker', 'KLK', 'KLK con la bandera de Rep. Dominicana.', 'stickers/pais-do.svg', null, false, false, false, 'paises2', 150, null, true, 1030),
  ('sticker-pais-pr', 'sticker', 'WEPA', 'WEPA con la bandera de Puerto Rico.', 'stickers/pais-pr.svg', null, false, false, false, 'paises2', 150, null, false, 1040),
  ('sticker-pais-pa', 'sticker', 'XOPA', 'XOPA con la bandera de Panamá.', 'stickers/pais-pa.svg', null, false, false, false, 'paises2', 150, null, false, 1050),
  ('sticker-pais-gt', 'sticker', 'CHILERO', 'CHILERO con la bandera de Guatemala.', 'stickers/pais-gt.svg', null, false, false, false, 'paises2', 150, null, false, 1060),
  ('sticker-pais-hn', 'sticker', 'CATRACHO', 'CATRACHO con la bandera de Honduras.', 'stickers/pais-hn.svg', null, false, false, false, 'paises2', 150, null, false, 1070),
  ('sticker-pais-sv', 'sticker', 'CHIVO', 'CHIVO con la bandera de El Salvador.', 'stickers/pais-sv.svg', null, false, false, false, 'paises2', 150, null, false, 1080),
  ('sticker-pais-es', 'sticker', 'MOLA', 'MOLA con la bandera de España.', 'stickers/pais-es.svg', null, false, false, false, 'paises2', 150, null, true, 1090),
  ('sticker-mapa-dust2', 'sticker', 'de_dust2 sitio A', 'El cartel del sitio A de de_dust2.', 'stickers/mapa-dust2.svg', null, false, false, false, 'mapas', 150, null, true, 1100),
  ('sticker-mapa-inferno', 'sticker', 'de_inferno sitio B', 'El cartel del sitio B de de_inferno.', 'stickers/mapa-inferno.svg', null, false, false, false, 'mapas', 150, null, true, 1110),
  ('sticker-mapa-nuke', 'sticker', 'de_nuke sitio A', 'El cartel del sitio A de de_nuke.', 'stickers/mapa-nuke.svg', null, false, false, false, 'mapas', 150, null, true, 1120),
  ('sticker-mapa-train', 'sticker', 'de_train sitio B', 'El cartel del sitio B de de_train.', 'stickers/mapa-train.svg', null, false, false, false, 'mapas', 150, null, true, 1130),
  ('sticker-mapa-office', 'sticker', 'cs_office sitio A', 'El cartel del sitio A de cs_office.', 'stickers/mapa-office.svg', null, false, false, false, 'mapas', 150, null, true, 1140),
  ('sticker-mapa-aztec', 'sticker', 'de_aztec sitio B', 'El cartel del sitio B de de_aztec.', 'stickers/mapa-aztec.svg', null, false, false, false, 'mapas', 150, null, true, 1150),
  ('sticker-mapa-cbble', 'sticker', 'de_cbble sitio A', 'El cartel del sitio A de de_cbble.', 'stickers/mapa-cbble.svg', null, false, false, false, 'mapas', 150, null, true, 1160),
  ('sticker-mapa-italy', 'sticker', 'cs_italy sitio B', 'El cartel del sitio B de cs_italy.', 'stickers/mapa-italy.svg', null, false, false, false, 'mapas', 150, null, true, 1170),
  ('sticker-mapa-piranesi', 'sticker', 'de_piranesi sitio A', 'El cartel del sitio A de de_piranesi.', 'stickers/mapa-piranesi.svg', null, false, false, false, 'mapas', 150, null, true, 1180),
  ('sticker-mapa-prodigy', 'sticker', 'de_prodigy sitio B', 'El cartel del sitio B de de_prodigy.', 'stickers/mapa-prodigy.svg', null, false, false, false, 'mapas', 150, null, true, 1190),
  ('sticker-ace', 'sticker', 'ACE', 'Cinco de cinco, con brillo.', 'stickers/ace.svg', null, true, false, true, 'cs', null, 150, true, 1200),
  ('sticker-mvp', 'sticker', 'MVP', 'La corona de la partida.', 'stickers/mvp.svg', null, true, false, true, 'cs', null, 150, true, 1210),
  ('sticker-headshot', 'sticker', 'HEADSHOT', 'Directo a la cabeza.', 'stickers/headshot.svg', null, true, false, true, 'cs', null, 150, true, 1220),
  ('sticker-one-tap', 'sticker', 'ONE TAP', 'Una bala, una baja.', 'stickers/one-tap.svg', null, true, false, true, 'cs', null, 150, true, 1230),
  ('sticker-defused', 'sticker', 'DEFUSED', 'Bomba desactivada en 0:00.', 'stickers/defused.svg', null, true, false, true, 'cs', null, 150, true, 1240),
  ('sticker-1v5', 'sticker', '1v5', 'Solo contra todos.', 'stickers/1v5.svg', null, true, false, true, 'cs', null, 150, true, 1250),
  ('sticker-wallbang', 'sticker', 'WALLBANG', 'A través de la pared.', 'stickers/wallbang.svg', null, true, false, true, 'cs', null, 150, true, 1260),
  ('sticker-ninja', 'sticker', 'NINJA', 'Defuse sin que nadie lo vea.', 'stickers/ninja.svg', null, true, false, true, 'cs', null, 150, true, 1270),
  ('sticker-serie-ninja', 'sticker', 'JUTSU!', 'Una nube de humo y un shuriken girando.', 'stickers/serie-ninja.svg', null, true, false, true, 'series', null, 150, true, 1280),
  ('sticker-serie-guerrero', 'sticker', '+9000', 'El medidor de poder explotó.', 'stickers/serie-guerrero.svg', null, true, false, true, 'series', null, 150, true, 1290),
  ('sticker-serie-alien', 'sticker', 'ALIEN', 'El dial verde listo para transformarte.', 'stickers/serie-alien.svg', null, true, false, true, 'series', null, 150, false, 1300),
  ('sticker-serie-portal', 'sticker', 'PORTAL', 'Un portal girando: ¿a qué dimensión vas?', 'stickers/serie-portal.svg', null, true, false, true, 'series', null, 150, true, 1310),
  ('sticker-serie-navaja', 'sticker', 'NAVAJA', 'La gorra de la banda, con filo.', 'stickers/serie-navaja.svg', null, true, false, true, 'series', null, 150, true, 1320),
  ('sticker-serie-laboratorio', 'sticker', 'COCINANDO', 'Elementos Cs y Ss: la química del server.', 'stickers/serie-laboratorio.svg', null, true, false, true, 'series', null, 150, true, 1330),
  ('sticker-serie-reves', 'sticker', 'CORRE', 'Las luces te avisan: corré.', 'stickers/serie-reves.svg', null, true, false, true, 'series', null, 150, true, 1340),
  ('sticker-serie-reinos', 'sticker', 'EL TRONO', 'La corona del que manda en el server.', 'stickers/serie-reinos.svg', null, true, false, true, 'series', null, 150, true, 1350),
  ('sticker-serie-atraco', 'sticker', 'ATRACO', 'Fajos de billetes que llueven.', 'stickers/serie-atraco.svg', null, true, false, true, 'series', null, 150, true, 1360),
  ('sticker-serie-juego', 'sticker', 'ELIMINADO', 'Las tres figuras se encienden por turno.', 'stickers/serie-juego.svg', null, true, false, true, 'series', null, 150, false, 1370),
  ('sticker-arma-ak', 'sticker', 'AK-47 Lava', 'La AK-47 con acabado Lava.', 'stickers/arma-ak.svg', null, true, false, true, 'arsenal', null, 150, true, 1380),
  ('sticker-arma-m4', 'sticker', 'M4A1 Ártico', 'La M4A1 con acabado Ártico.', 'stickers/arma-m4.svg', null, true, false, true, 'arsenal', null, 150, true, 1390),
  ('sticker-arma-awp', 'sticker', 'AWP Relámpago', 'La AWP con acabado Relámpago.', 'stickers/arma-awp.svg', null, true, false, true, 'arsenal', null, 150, true, 1400),
  ('sticker-arma-deagle', 'sticker', 'Deagle Oro macizo', 'La DEAGLE con acabado Oro macizo.', 'stickers/arma-deagle.svg', null, true, false, true, 'arsenal', null, 150, true, 1410),
  ('sticker-arma-scout', 'sticker', 'Scout Selva', 'La SCOUT con acabado Selva.', 'stickers/arma-scout.svg', null, true, false, true, 'arsenal', null, 150, true, 1420),
  ('sticker-arma-usp', 'sticker', 'USP Medianoche', 'La USP con acabado Medianoche.', 'stickers/arma-usp.svg', null, true, false, true, 'arsenal', null, 150, true, 1430),
  ('sticker-arma-glock', 'sticker', 'Glock Caramelo', 'La GLOCK con acabado Caramelo.', 'stickers/arma-glock.svg', null, true, false, true, 'arsenal', null, 150, true, 1440),
  ('sticker-arma-mp5', 'sticker', 'MP5 Neón', 'La MP5 con acabado Neón.', 'stickers/arma-mp5.svg', null, true, false, true, 'arsenal', null, 150, true, 1450),
  ('sticker-arma-cuchillo', 'sticker', 'Cuchillo Fantasma', 'La CUCHILLO con acabado Fantasma.', 'stickers/arma-cuchillo.svg', null, true, false, true, 'arsenal', null, 150, true, 1460),
  ('sticker-arma-he', 'sticker', 'HE Arcoíris', 'La HE con acabado Arcoíris.', 'stickers/arma-he.svg', null, true, false, true, 'arsenal', null, 150, true, 1470),
  ('sticker-serie-dona', 'sticker', 'DONA', 'DONA: el ícono de Dona glaseada flotando.', 'stickers/serie-dona.svg', null, true, false, true, 'series2', null, 150, true, 1480),
  ('sticker-serie-zombi', 'sticker', 'ZOMBI', 'ZOMBI: el ícono de Apocalipsis zombi flotando.', 'stickers/serie-zombi.svg', null, true, false, true, 'series2', null, 150, true, 1490),
  ('sticker-serie-barril', 'sticker', 'VECINDAD', 'VECINDAD: el ícono de La vecindad flotando.', 'stickers/serie-barril.svg', null, true, false, true, 'series2', null, 150, true, 1500),
  ('sticker-serie-fuga', 'sticker', 'FUGA', 'FUGA: el ícono de La fuga flotando.', 'stickers/serie-fuga.svg', null, true, false, true, 'series2', null, 150, true, 1510),
  ('sticker-serie-radiacion', 'sticker', 'REACTOR', 'REACTOR: el ícono de Reactor 4 flotando.', 'stickers/serie-radiacion.svg', null, true, false, true, 'series2', null, 150, true, 1520),
  ('sticker-serie-vikingo', 'sticker', 'VALHALLA', 'VALHALLA: el ícono de Vikingo flotando.', 'stickers/serie-vikingo.svg', null, true, false, true, 'series2', null, 150, true, 1530),
  ('sticker-serie-elementos', 'sticker', 'ELEMENTOS', 'ELEMENTOS: el ícono de Cuatro elementos flotando.', 'stickers/serie-elementos.svg', null, true, false, true, 'series2', null, 150, true, 1540),
  ('sticker-serie-robot', 'sticker', 'BIP BUP', 'BIP BUP: el ícono de Robot del futuro flotando.', 'stickers/serie-robot.svg', null, true, false, true, 'series2', null, 150, true, 1550),
  ('sticker-serie-fondo-mar', 'sticker', 'GLU GLU', 'GLU GLU: el ícono de Fondo de mar flotando.', 'stickers/serie-fondo-mar.svg', null, true, false, true, 'series2', null, 150, true, 1560),
  ('sticker-serie-isla', 'sticker', 'LA ISLA', 'LA ISLA: el ícono de La isla flotando.', 'stickers/serie-isla.svg', null, true, false, true, 'series2', null, 150, true, 1570),
  ('tema-terro', 'theme', 'Terrorista', 'Ocre y arena.', null, 'tema-terro', false, false, false, 'cs', 350, null, true, 1580),
  ('tema-anti', 'theme', 'Antiterrorista', 'Azul táctico.', null, 'tema-anti', false, false, false, 'cs', 350, null, true, 1590),
  ('tema-toxico', 'theme', 'Tóxico', 'Verde radiactivo.', null, 'tema-toxico', false, false, false, 'cs', 350, null, true, 1600),
  ('tema-hielo', 'theme', 'Hielo', 'Celeste helado.', null, 'tema-hielo', false, false, false, 'cs', 350, null, true, 1610),
  ('tema-carmesi', 'theme', 'Carmesí', 'Rojo intenso.', null, 'tema-carmesi', false, false, false, 'cs', 350, null, true, 1620),
  ('tema-camuflaje', 'theme', 'Camuflaje', 'Verde oliva militar.', null, 'tema-camuflaje', false, false, false, 'cs', 350, null, true, 1630),
  ('tema-atardecer', 'theme', 'Atardecer', 'Naranja cálido.', null, 'tema-atardecer', false, false, false, 'cs', 350, null, true, 1640),
  ('tema-grafito', 'theme', 'Grafito', 'Blanco y gris, minimalista.', null, 'tema-grafito', false, false, false, 'cs', 350, null, true, 1650),
  ('tema-pais-ar', 'theme', 'Argentina', 'Los colores de Argentina en todo el perfil.', null, 'tema-pais-ar', false, false, false, 'paises', 300, null, true, 1660),
  ('tema-pais-br', 'theme', 'Brasil', 'Los colores de Brasil en todo el perfil.', null, 'tema-pais-br', false, false, false, 'paises', 300, null, true, 1670),
  ('tema-pais-uy', 'theme', 'Uruguay', 'Los colores de Uruguay en todo el perfil.', null, 'tema-pais-uy', false, false, false, 'paises', 300, null, true, 1680),
  ('tema-pais-cl', 'theme', 'Chile', 'Los colores de Chile en todo el perfil.', null, 'tema-pais-cl', false, false, false, 'paises', 300, null, true, 1690),
  ('tema-pais-pe', 'theme', 'Perú', 'Los colores de Perú en todo el perfil.', null, 'tema-pais-pe', false, false, false, 'paises', 300, null, true, 1700),
  ('tema-pais-co', 'theme', 'Colombia', 'Los colores de Colombia en todo el perfil.', null, 'tema-pais-co', false, false, false, 'paises', 300, null, true, 1710),
  ('tema-pais-ve', 'theme', 'Venezuela', 'Los colores de Venezuela en todo el perfil.', null, 'tema-pais-ve', false, false, false, 'paises', 300, null, true, 1720),
  ('tema-pais-ec', 'theme', 'Ecuador', 'Los colores de Ecuador en todo el perfil.', null, 'tema-pais-ec', false, false, false, 'paises', 300, null, true, 1730),
  ('tema-pais-bo', 'theme', 'Bolivia', 'Los colores de Bolivia en todo el perfil.', null, 'tema-pais-bo', false, false, false, 'paises', 300, null, true, 1740),
  ('tema-pais-py', 'theme', 'Paraguay', 'Los colores de Paraguay en todo el perfil.', null, 'tema-pais-py', false, false, false, 'paises', 300, null, true, 1750),
  ('tema-pais-mx', 'theme', 'México', 'Los colores de México en todo el perfil.', null, 'tema-pais-mx', false, false, false, 'paises2', 300, null, true, 1760),
  ('tema-pais-cr', 'theme', 'Costa Rica', 'Los colores de Costa Rica en todo el perfil.', null, 'tema-pais-cr', false, false, false, 'paises2', 300, null, true, 1770),
  ('tema-pais-cu', 'theme', 'Cuba', 'Los colores de Cuba en todo el perfil.', null, 'tema-pais-cu', false, false, false, 'paises2', 300, null, true, 1780),
  ('tema-pais-do', 'theme', 'Rep. Dominicana', 'Los colores de Rep. Dominicana en todo el perfil.', null, 'tema-pais-do', false, false, false, 'paises2', 300, null, true, 1790),
  ('tema-pais-pr', 'theme', 'Puerto Rico', 'Los colores de Puerto Rico en todo el perfil.', null, 'tema-pais-pr', false, false, false, 'paises2', 300, null, true, 1800),
  ('tema-pais-pa', 'theme', 'Panamá', 'Los colores de Panamá en todo el perfil.', null, 'tema-pais-pa', false, false, false, 'paises2', 300, null, true, 1810),
  ('tema-pais-gt', 'theme', 'Guatemala', 'Los colores de Guatemala en todo el perfil.', null, 'tema-pais-gt', false, false, false, 'paises2', 300, null, true, 1820),
  ('tema-pais-hn', 'theme', 'Honduras', 'Los colores de Honduras en todo el perfil.', null, 'tema-pais-hn', false, false, false, 'paises2', 300, null, true, 1830),
  ('tema-pais-sv', 'theme', 'El Salvador', 'Los colores de El Salvador en todo el perfil.', null, 'tema-pais-sv', false, false, false, 'paises2', 300, null, true, 1840),
  ('tema-pais-es', 'theme', 'España', 'Los colores de España en todo el perfil.', null, 'tema-pais-es', false, false, false, 'paises2', 300, null, true, 1850),
  ('tema-mapa-dust2', 'theme', 'de_dust2', 'Los colores de de_dust2 en todo el perfil.', null, 'tema-mapa-dust2', false, false, false, 'mapas', 300, null, true, 1860),
  ('tema-mapa-inferno', 'theme', 'de_inferno', 'Los colores de de_inferno en todo el perfil.', null, 'tema-mapa-inferno', false, false, false, 'mapas', 300, null, true, 1870),
  ('tema-mapa-nuke', 'theme', 'de_nuke', 'Los colores de de_nuke en todo el perfil.', null, 'tema-mapa-nuke', false, false, false, 'mapas', 300, null, true, 1880),
  ('tema-mapa-train', 'theme', 'de_train', 'Los colores de de_train en todo el perfil.', null, 'tema-mapa-train', false, false, false, 'mapas', 300, null, true, 1890),
  ('tema-mapa-office', 'theme', 'cs_office', 'Los colores de cs_office en todo el perfil.', null, 'tema-mapa-office', false, false, false, 'mapas', 300, null, true, 1900),
  ('tema-mapa-aztec', 'theme', 'de_aztec', 'Los colores de de_aztec en todo el perfil.', null, 'tema-mapa-aztec', false, false, false, 'mapas', 300, null, true, 1910),
  ('tema-mapa-cbble', 'theme', 'de_cbble', 'Los colores de de_cbble en todo el perfil.', null, 'tema-mapa-cbble', false, false, false, 'mapas', 300, null, true, 1920),
  ('tema-mapa-italy', 'theme', 'cs_italy', 'Los colores de cs_italy en todo el perfil.', null, 'tema-mapa-italy', false, false, false, 'mapas', 300, null, true, 1930),
  ('tema-mapa-piranesi', 'theme', 'de_piranesi', 'Los colores de de_piranesi en todo el perfil.', null, 'tema-mapa-piranesi', false, false, false, 'mapas', 300, null, true, 1940),
  ('tema-mapa-prodigy', 'theme', 'de_prodigy', 'Los colores de de_prodigy en todo el perfil.', null, 'tema-mapa-prodigy', false, false, false, 'mapas', 300, null, true, 1950),
  ('tema-oro', 'theme', 'Oro VIP', 'Dorado con resplandor.', null, 'tema-oro', true, false, false, 'cs', null, 300, true, 1960),
  ('tema-obsidiana', 'theme', 'Obsidiana', 'Negro y violeta con resplandor.', null, 'tema-obsidiana', true, false, false, 'cs', null, 300, true, 1970),
  ('tema-diamante', 'theme', 'Diamante', 'Celeste cristal con resplandor.', null, 'tema-diamante', true, false, false, 'cs', null, 300, true, 1980),
  ('tema-synthwave', 'theme', 'Synthwave', 'Rosa y violeta retro con resplandor.', null, 'tema-synthwave', true, false, false, 'cs', null, 300, true, 1990),
  ('tema-holo', 'theme', 'Holográfico', 'El borde cambia de color.', null, 'tema-holo', true, false, true, 'cs', null, 300, true, 2000),
  ('tema-esmeralda', 'theme', 'Esmeralda', 'Verde joya con resplandor.', null, 'tema-esmeralda', true, false, false, 'cs', null, 300, true, 2010),
  ('tema-rubi', 'theme', 'Rubí', 'Rojo joya con resplandor.', null, 'tema-rubi', true, false, false, 'cs', null, 300, true, 2020),
  ('tema-aurora', 'theme', 'Aurora', 'El borde pasa de verde a violeta.', null, 'tema-aurora', true, false, true, 'cs', null, 300, true, 2030),
  ('tema-serie-ninja', 'theme', 'Shinobi', 'Los colores de Shinobi con un borde que brilla.', null, 'tema-serie-ninja', true, false, true, 'series', null, 300, true, 2040),
  ('tema-serie-guerrero', 'theme', 'Súper guerrero', 'Los colores de Súper guerrero con un borde que brilla.', null, 'tema-serie-guerrero', true, false, true, 'series', null, 300, true, 2050),
  ('tema-serie-alien', 'theme', 'Reloj alien', 'Los colores de Reloj alien con un borde que brilla.', null, 'tema-serie-alien', true, false, true, 'series', null, 300, false, 2060),
  ('tema-serie-portal', 'theme', 'Portal', 'Los colores de Portal con un borde que brilla.', null, 'tema-serie-portal', true, false, true, 'series', null, 300, true, 2070),
  ('tema-serie-navaja', 'theme', 'Gorra y navaja', 'Los colores de Gorra y navaja con un borde que brilla.', null, 'tema-serie-navaja', true, false, true, 'series', null, 300, true, 2080),
  ('tema-serie-laboratorio', 'theme', 'Laboratorio', 'Los colores de Laboratorio con un borde que brilla.', null, 'tema-serie-laboratorio', true, false, true, 'series', null, 300, true, 2090),
  ('tema-serie-reves', 'theme', 'Mundo del revés', 'Los colores de Mundo del revés con un borde que brilla.', null, 'tema-serie-reves', true, false, true, 'series', null, 300, true, 2100),
  ('tema-serie-reinos', 'theme', 'Reinos', 'Los colores de Reinos con un borde que brilla.', null, 'tema-serie-reinos', true, false, true, 'series', null, 300, true, 2110),
  ('tema-serie-atraco', 'theme', 'Atraco', 'Los colores de Atraco con un borde que brilla.', null, 'tema-serie-atraco', true, false, true, 'series', null, 300, true, 2120),
  ('tema-serie-juego', 'theme', 'Juego mortal', 'Los colores de Juego mortal con un borde que brilla.', null, 'tema-serie-juego', true, false, true, 'series', null, 300, true, 2130),
  ('tema-arma-ak', 'theme', 'Lava', 'Los colores del acabado Lava con un borde que brilla.', null, 'tema-arma-ak', true, false, true, 'arsenal', null, 300, true, 2140),
  ('tema-arma-m4', 'theme', 'Ártico', 'Los colores del acabado Ártico con un borde que brilla.', null, 'tema-arma-m4', true, false, true, 'arsenal', null, 300, true, 2150),
  ('tema-arma-awp', 'theme', 'Relámpago', 'Los colores del acabado Relámpago con un borde que brilla.', null, 'tema-arma-awp', true, false, true, 'arsenal', null, 300, true, 2160),
  ('tema-arma-deagle', 'theme', 'Oro macizo', 'Los colores del acabado Oro macizo con un borde que brilla.', null, 'tema-arma-deagle', true, false, true, 'arsenal', null, 300, true, 2170),
  ('tema-arma-scout', 'theme', 'Selva', 'Los colores del acabado Selva con un borde que brilla.', null, 'tema-arma-scout', true, false, true, 'arsenal', null, 300, true, 2180),
  ('tema-arma-usp', 'theme', 'Medianoche', 'Los colores del acabado Medianoche con un borde que brilla.', null, 'tema-arma-usp', true, false, true, 'arsenal', null, 300, true, 2190),
  ('tema-arma-glock', 'theme', 'Caramelo', 'Los colores del acabado Caramelo con un borde que brilla.', null, 'tema-arma-glock', true, false, true, 'arsenal', null, 300, true, 2200),
  ('tema-arma-mp5', 'theme', 'Neón', 'Los colores del acabado Neón con un borde que brilla.', null, 'tema-arma-mp5', true, false, true, 'arsenal', null, 300, true, 2210),
  ('tema-arma-cuchillo', 'theme', 'Fantasma', 'Los colores del acabado Fantasma con un borde que brilla.', null, 'tema-arma-cuchillo', true, false, true, 'arsenal', null, 300, true, 2220),
  ('tema-arma-he', 'theme', 'Arcoíris', 'Los colores del acabado Arcoíris con un borde que brilla.', null, 'tema-arma-he', true, false, true, 'arsenal', null, 300, true, 2230),
  ('tema-serie-dona', 'theme', 'Dona glaseada', 'Los colores de Dona glaseada con un borde que brilla.', null, 'tema-serie-dona', true, false, true, 'series2', null, 300, true, 2240),
  ('tema-serie-zombi', 'theme', 'Apocalipsis zombi', 'Los colores de Apocalipsis zombi con un borde que brilla.', null, 'tema-serie-zombi', true, false, true, 'series2', null, 300, true, 2250),
  ('tema-serie-barril', 'theme', 'La vecindad', 'Los colores de La vecindad con un borde que brilla.', null, 'tema-serie-barril', true, false, true, 'series2', null, 300, true, 2260),
  ('tema-serie-fuga', 'theme', 'La fuga', 'Los colores de La fuga con un borde que brilla.', null, 'tema-serie-fuga', true, false, true, 'series2', null, 300, true, 2270),
  ('tema-serie-radiacion', 'theme', 'Reactor 4', 'Los colores de Reactor 4 con un borde que brilla.', null, 'tema-serie-radiacion', true, false, true, 'series2', null, 300, true, 2280),
  ('tema-serie-vikingo', 'theme', 'Vikingo', 'Los colores de Vikingo con un borde que brilla.', null, 'tema-serie-vikingo', true, false, true, 'series2', null, 300, true, 2290),
  ('tema-serie-elementos', 'theme', 'Cuatro elementos', 'Los colores de Cuatro elementos con un borde que brilla.', null, 'tema-serie-elementos', true, false, true, 'series2', null, 300, true, 2300),
  ('tema-serie-robot', 'theme', 'Robot del futuro', 'Los colores de Robot del futuro con un borde que brilla.', null, 'tema-serie-robot', true, false, true, 'series2', null, 300, true, 2310),
  ('tema-serie-fondo-mar', 'theme', 'Fondo de mar', 'Los colores de Fondo de mar con un borde que brilla.', null, 'tema-serie-fondo-mar', true, false, true, 'series2', null, 300, true, 2320),
  ('tema-serie-isla', 'theme', 'La isla', 'Los colores de La isla con un borde que brilla.', null, 'tema-serie-isla', true, false, true, 'series2', null, 300, true, 2330),
  ('nombre-brillo', 'name', 'Brillo', 'Un destello recorre tu nombre.', null, 'nombre-brillo', false, false, true, 'cs', 300, null, true, 2340),
  ('nombre-glitch', 'name', 'Glitch', 'Tu nombre falla cada tanto, a propósito.', null, 'nombre-glitch', false, false, true, 'cs', 300, null, true, 2350),
  ('nombre-neon', 'name', 'Neón', 'Letrero luminoso que parpadea.', null, 'nombre-neon', false, false, true, 'cs', 300, null, true, 2360),
  ('nombre-retro', 'name', 'Retro', 'Sombra en capas de los 80.', null, 'nombre-retro', false, false, false, 'cs', 250, null, true, 2370),
  ('nombre-contorno', 'name', 'Contorno', 'Solo el borde de las letras.', null, 'nombre-contorno', false, false, false, 'cs', 250, null, true, 2380),
  ('nombre-sombra', 'name', 'Sombra', 'Sombra larga detrás de las letras.', null, 'nombre-sombra', false, false, false, 'cs', 250, null, true, 2390),
  ('nombre-hielo', 'name', 'Hielo', 'Letras congeladas.', null, 'nombre-hielo', false, false, false, 'cs', 250, null, true, 2400),
  ('nombre-pixel', 'name', 'Píxel', 'Letras de 8 bits con desfase de color.', null, 'nombre-pixel', false, false, false, 'cs', 250, null, true, 2410),
  ('nombre-pais-ar', 'name', 'Argentina', 'Tu nombre con las franjas de la bandera de Argentina.', null, 'nombre-pais-ar', false, false, false, 'paises', 200, null, true, 2420),
  ('nombre-pais-br', 'name', 'Brasil', 'Tu nombre con las franjas de la bandera de Brasil.', null, 'nombre-pais-br', false, false, false, 'paises', 200, null, true, 2430),
  ('nombre-pais-uy', 'name', 'Uruguay', 'Tu nombre con las franjas de la bandera de Uruguay.', null, 'nombre-pais-uy', false, false, false, 'paises', 200, null, true, 2440),
  ('nombre-pais-cl', 'name', 'Chile', 'Tu nombre con las franjas de la bandera de Chile.', null, 'nombre-pais-cl', false, false, false, 'paises', 200, null, true, 2450),
  ('nombre-pais-pe', 'name', 'Perú', 'Tu nombre con las franjas de la bandera de Perú.', null, 'nombre-pais-pe', false, false, false, 'paises', 200, null, true, 2460),
  ('nombre-pais-co', 'name', 'Colombia', 'Tu nombre con las franjas de la bandera de Colombia.', null, 'nombre-pais-co', false, false, false, 'paises', 200, null, true, 2470),
  ('nombre-pais-ve', 'name', 'Venezuela', 'Tu nombre con las franjas de la bandera de Venezuela.', null, 'nombre-pais-ve', false, false, false, 'paises', 200, null, true, 2480),
  ('nombre-pais-ec', 'name', 'Ecuador', 'Tu nombre con las franjas de la bandera de Ecuador.', null, 'nombre-pais-ec', false, false, false, 'paises', 200, null, true, 2490),
  ('nombre-pais-bo', 'name', 'Bolivia', 'Tu nombre con las franjas de la bandera de Bolivia.', null, 'nombre-pais-bo', false, false, false, 'paises', 200, null, true, 2500),
  ('nombre-pais-py', 'name', 'Paraguay', 'Tu nombre con las franjas de la bandera de Paraguay.', null, 'nombre-pais-py', false, false, false, 'paises', 200, null, true, 2510),
  ('nombre-pais-mx', 'name', 'México', 'Tu nombre con las franjas de la bandera de México.', null, 'nombre-pais-mx', false, false, false, 'paises2', 200, null, true, 2520),
  ('nombre-pais-cr', 'name', 'Costa Rica', 'Tu nombre con las franjas de la bandera de Costa Rica.', null, 'nombre-pais-cr', false, false, false, 'paises2', 200, null, true, 2530),
  ('nombre-pais-cu', 'name', 'Cuba', 'Tu nombre con las franjas de la bandera de Cuba.', null, 'nombre-pais-cu', false, false, false, 'paises2', 200, null, true, 2540),
  ('nombre-pais-do', 'name', 'Rep. Dominicana', 'Tu nombre con las franjas de la bandera de Rep. Dominicana.', null, 'nombre-pais-do', false, false, false, 'paises2', 200, null, true, 2550),
  ('nombre-pais-pr', 'name', 'Puerto Rico', 'Tu nombre con las franjas de la bandera de Puerto Rico.', null, 'nombre-pais-pr', false, false, false, 'paises2', 200, null, true, 2560),
  ('nombre-pais-pa', 'name', 'Panamá', 'Tu nombre con las franjas de la bandera de Panamá.', null, 'nombre-pais-pa', false, false, false, 'paises2', 200, null, true, 2570),
  ('nombre-pais-gt', 'name', 'Guatemala', 'Tu nombre con las franjas de la bandera de Guatemala.', null, 'nombre-pais-gt', false, false, false, 'paises2', 200, null, true, 2580),
  ('nombre-pais-hn', 'name', 'Honduras', 'Tu nombre con las franjas de la bandera de Honduras.', null, 'nombre-pais-hn', false, false, false, 'paises2', 200, null, true, 2590),
  ('nombre-pais-sv', 'name', 'El Salvador', 'Tu nombre con las franjas de la bandera de El Salvador.', null, 'nombre-pais-sv', false, false, false, 'paises2', 200, null, true, 2600),
  ('nombre-pais-es', 'name', 'España', 'Tu nombre con las franjas de la bandera de España.', null, 'nombre-pais-es', false, false, false, 'paises2', 200, null, true, 2610),
  ('nombre-mapa-dust2', 'name', 'de_dust2', 'Tu nombre con los colores de de_dust2.', null, 'nombre-mapa-dust2', false, false, false, 'mapas', 200, null, true, 2620),
  ('nombre-mapa-inferno', 'name', 'de_inferno', 'Tu nombre con los colores de de_inferno.', null, 'nombre-mapa-inferno', false, false, false, 'mapas', 200, null, true, 2630),
  ('nombre-mapa-nuke', 'name', 'de_nuke', 'Tu nombre con los colores de de_nuke.', null, 'nombre-mapa-nuke', false, false, false, 'mapas', 200, null, true, 2640),
  ('nombre-mapa-train', 'name', 'de_train', 'Tu nombre con los colores de de_train.', null, 'nombre-mapa-train', false, false, false, 'mapas', 200, null, true, 2650),
  ('nombre-mapa-office', 'name', 'cs_office', 'Tu nombre con los colores de cs_office.', null, 'nombre-mapa-office', false, false, false, 'mapas', 200, null, true, 2660),
  ('nombre-mapa-aztec', 'name', 'de_aztec', 'Tu nombre con los colores de de_aztec.', null, 'nombre-mapa-aztec', false, false, false, 'mapas', 200, null, true, 2670),
  ('nombre-mapa-cbble', 'name', 'de_cbble', 'Tu nombre con los colores de de_cbble.', null, 'nombre-mapa-cbble', false, false, false, 'mapas', 200, null, true, 2680),
  ('nombre-mapa-italy', 'name', 'cs_italy', 'Tu nombre con los colores de cs_italy.', null, 'nombre-mapa-italy', false, false, false, 'mapas', 200, null, true, 2690),
  ('nombre-mapa-piranesi', 'name', 'de_piranesi', 'Tu nombre con los colores de de_piranesi.', null, 'nombre-mapa-piranesi', false, false, false, 'mapas', 200, null, true, 2700),
  ('nombre-mapa-prodigy', 'name', 'de_prodigy', 'Tu nombre con los colores de de_prodigy.', null, 'nombre-mapa-prodigy', false, false, false, 'mapas', 200, null, true, 2710),
  ('nombre-arcoiris', 'name', 'Arcoíris', 'Todos los colores, en movimiento.', null, 'nombre-arcoiris', true, false, true, 'cs', null, 250, true, 2720),
  ('nombre-oro', 'name', 'Oro', 'Dorado con destello.', null, 'nombre-oro', true, false, true, 'cs', null, 250, true, 2730),
  ('nombre-fuego', 'name', 'Fuego', 'Tu nombre en llamas.', null, 'nombre-fuego', true, false, true, 'cs', null, 250, true, 2740),
  ('nombre-holografico', 'name', 'Holográfico', 'Cambia de color según la luz.', null, 'nombre-holografico', true, false, true, 'cs', null, 250, true, 2750),
  ('nombre-galaxia', 'name', 'Galaxia', 'Estrellas que viajan por las letras.', null, 'nombre-galaxia', true, false, true, 'cs', null, 250, true, 2760),
  ('nombre-plasma', 'name', 'Plasma', 'Brillo eléctrico que titila.', null, 'nombre-plasma', true, false, true, 'cs', null, 250, true, 2770),
  ('nombre-esmeralda', 'name', 'Esmeralda', 'Verde joya con destello.', null, 'nombre-esmeralda', true, false, true, 'cs', null, 250, true, 2780),
  ('nombre-cromo', 'name', 'Cromo', 'Metal pulido con reflejo.', null, 'nombre-cromo', true, false, true, 'cs', null, 250, true, 2790),
  ('nombre-chakra', 'name', 'Chakra', 'Energía azul que corre por las letras.', null, 'nombre-chakra', true, false, true, 'series', null, 250, true, 2800),
  ('nombre-ki', 'name', 'Ki', 'Aura dorada que tiembla de poder.', null, 'nombre-ki', true, false, true, 'series', null, 250, true, 2810),
  ('nombre-mutante', 'name', 'Mutante', 'Brillo verde que late.', null, 'nombre-mutante', true, false, true, 'series', null, 250, true, 2820),
  ('nombre-portal', 'name', 'Portal', 'Verde interdimensional que fluye.', null, 'nombre-portal', true, false, true, 'series', null, 250, true, 2830),
  ('nombre-whisky', 'name', 'Whisky 1919', 'Letra de época color ámbar.', null, 'nombre-whisky', true, false, true, 'series', null, 250, true, 2840),
  ('nombre-cristal', 'name', 'Cristal azul', 'Azul cristalino que destella.', null, 'nombre-cristal', true, false, true, 'series', null, 250, true, 2850),
  ('nombre-ochentoso', 'name', 'Ochentoso', 'Letras rojas de los 80 que titilan.', null, 'nombre-ochentoso', true, false, true, 'series', null, 250, true, 2860),
  ('nombre-acero', 'name', 'Acero antiguo', 'Acero forjado con vetas que se mueven.', null, 'nombre-acero', true, false, true, 'series', null, 250, true, 2870),
  ('nombre-billete', 'name', 'Billete', 'Verde billete recién impreso.', null, 'nombre-billete', true, false, true, 'series', null, 250, true, 2880),
  ('nombre-luz-roja', 'name', 'Luz roja, luz verde', 'Cambia de rojo a verde: no te muevas.', null, 'nombre-luz-roja', true, false, true, 'series', null, 250, true, 2890),
  ('nombre-arma-ak', 'name', 'Lava', 'Tu nombre con el acabado Lava.', null, 'nombre-arma-ak', true, false, true, 'arsenal', null, 250, true, 2900),
  ('nombre-arma-m4', 'name', 'Ártico', 'Tu nombre con el acabado Ártico.', null, 'nombre-arma-m4', true, false, true, 'arsenal', null, 250, true, 2910),
  ('nombre-arma-awp', 'name', 'Relámpago', 'Tu nombre con el acabado Relámpago.', null, 'nombre-arma-awp', true, false, true, 'arsenal', null, 250, true, 2920),
  ('nombre-arma-deagle', 'name', 'Oro macizo', 'Tu nombre con el acabado Oro macizo.', null, 'nombre-arma-deagle', true, false, true, 'arsenal', null, 250, true, 2930),
  ('nombre-arma-scout', 'name', 'Selva', 'Tu nombre con el acabado Selva.', null, 'nombre-arma-scout', true, false, true, 'arsenal', null, 250, true, 2940),
  ('nombre-arma-usp', 'name', 'Medianoche', 'Tu nombre con el acabado Medianoche.', null, 'nombre-arma-usp', true, false, true, 'arsenal', null, 250, true, 2950),
  ('nombre-arma-glock', 'name', 'Caramelo', 'Tu nombre con el acabado Caramelo.', null, 'nombre-arma-glock', true, false, true, 'arsenal', null, 250, true, 2960),
  ('nombre-arma-mp5', 'name', 'Neón', 'Tu nombre con el acabado Neón.', null, 'nombre-arma-mp5', true, false, true, 'arsenal', null, 250, true, 2970),
  ('nombre-arma-cuchillo', 'name', 'Fantasma', 'Tu nombre con el acabado Fantasma.', null, 'nombre-arma-cuchillo', true, false, true, 'arsenal', null, 250, true, 2980),
  ('nombre-arma-he', 'name', 'Arcoíris', 'Tu nombre con el acabado Arcoíris.', null, 'nombre-arma-he', true, false, true, 'arsenal', null, 250, true, 2990),
  ('nombre-dona', 'name', 'Glaseado', 'Efecto Glaseado, de la colección Dona glaseada.', null, 'nombre-dona', true, false, true, 'series2', null, 250, true, 3000),
  ('nombre-zombi', 'name', 'Podrido', 'Efecto Podrido, de la colección Apocalipsis zombi.', null, 'nombre-zombi', true, false, true, 'series2', null, 250, true, 3010),
  ('nombre-barril', 'name', 'Barril', 'Efecto Barril, de la colección La vecindad.', null, 'nombre-barril', true, false, true, 'series2', null, 250, true, 3020),
  ('nombre-fuga', 'name', 'Tatuaje', 'Efecto Tatuaje, de la colección La fuga.', null, 'nombre-fuga', true, false, true, 'series2', null, 250, true, 3030),
  ('nombre-radiacion', 'name', 'Radiactivo', 'Efecto Radiactivo, de la colección Reactor 4.', null, 'nombre-radiacion', true, false, true, 'series2', null, 250, true, 3040),
  ('nombre-vikingo', 'name', 'Rúnico', 'Efecto Rúnico, de la colección Vikingo.', null, 'nombre-vikingo', true, false, true, 'series2', null, 250, true, 3050),
  ('nombre-elementos', 'name', 'Elemental', 'Efecto Elemental, de la colección Cuatro elementos.', null, 'nombre-elementos', true, false, true, 'series2', null, 250, true, 3060),
  ('nombre-robot', 'name', 'Binario', 'Efecto Binario, de la colección Robot del futuro.', null, 'nombre-robot', true, false, true, 'series2', null, 250, true, 3070),
  ('nombre-fondo-mar', 'name', 'Burbujas', 'Efecto Burbujas, de la colección Fondo de mar.', null, 'nombre-fondo-mar', true, false, true, 'series2', null, 250, true, 3080),
  ('nombre-isla', 'name', 'Tropical', 'Efecto Tropical, de la colección La isla.', null, 'nombre-isla', true, false, true, 'series2', null, 250, true, 3090),
  ('fondo-humo', 'background', 'Granada de humo', 'Humo que cruza la tarjeta de lado a lado.', 'fondos/humo.svg', null, false, false, true, 'cs', 450, null, true, 3100),
  ('fondo-radar', 'background', 'Radar', 'El radar barre y marca enemigos.', 'fondos/radar.svg', null, false, false, true, 'cs', 450, null, true, 3110),
  ('fondo-casquillos', 'background', 'Lluvia de casquillos', 'Vainas de bronce que caen girando.', 'fondos/casquillos.svg', null, false, false, true, 'cs', 450, null, true, 3120),
  ('fondo-neon', 'background', 'Neón', 'Sol retro y cuadrícula que avanza.', 'fondos/neon.svg', null, false, false, true, 'cs', 450, null, true, 3130),
  ('fondo-tormenta', 'background', 'Tormenta', 'Lluvia y relámpagos de noche.', 'fondos/tormenta.svg', null, false, false, true, 'cs', 450, null, true, 3140),
  ('fondo-consola', 'background', 'Consola', 'Columnas de código que bajan.', 'fondos/consola.svg', null, false, false, true, 'cs', 450, null, true, 3150),
  ('fondo-mapa-dust2', 'background', 'Atardecer en el desierto', 'Dunas, sol bajo y arena con viento.', 'fondos/mapa-dust2.svg', null, false, false, true, 'mapas', 350, null, true, 3160),
  ('fondo-mapa-inferno', 'background', 'Brasas del pueblo', 'Muros de ladrillo, arcos y brasas que suben.', 'fondos/mapa-inferno.svg', null, false, false, true, 'mapas', 350, null, true, 3170),
  ('fondo-mapa-nuke', 'background', 'Planta nuclear', 'Símbolo que gira y franjas de peligro.', 'fondos/mapa-nuke.svg', null, false, false, true, 'mapas', 350, null, true, 3180),
  ('fondo-mapa-office', 'background', 'Oficina nevada', 'Edificios de noche con nieve que cae.', 'fondos/mapa-office.svg', null, false, false, true, 'mapas', 350, null, true, 3190),
  ('fondo-pais-cruz-del-sur', 'background', 'Cruz del Sur', 'El cielo del sur con sus estrellas.', 'fondos/pais-cruz-del-sur.svg', null, false, false, true, 'paises', 350, null, true, 3200),
  ('fondo-pais-carnaval', 'background', 'Carnaval', 'Papelitos y serpentinas de colores.', 'fondos/pais-carnaval.svg', null, false, false, true, 'paises', 350, null, true, 3210),
  ('fondo-serie-luna-roja', 'background', 'Luna roja', 'Hojas que vuelan bajo una luna enorme.', 'fondos/serie-luna-roja.svg', null, true, false, true, 'series', null, 450, true, 3220),
  ('fondo-serie-aura', 'background', 'Aura dorada', 'Energía dorada que sube sin parar.', 'fondos/serie-aura.svg', null, true, false, true, 'series', null, 450, true, 3230),
  ('fondo-serie-portal', 'background', 'Portal verde', 'Un portal en espiral que gira.', 'fondos/serie-portal.svg', null, true, false, true, 'series', null, 450, true, 3240),
  ('fondo-serie-cristal', 'background', 'Cristales del desierto', 'Cristales azules que brillan de noche.', 'fondos/serie-cristal.svg', null, true, false, true, 'series', null, 450, true, 3250),
  ('fondo-serie-niebla', 'background', 'Ciudad de humo', 'Fábricas, chimeneas y niebla de época.', 'fondos/serie-niebla.svg', null, true, false, true, 'series', null, 450, true, 3260),
  ('fondo-serie-reves', 'background', 'Del otro lado', 'Cielo rojo, relámpagos y esporas flotando.', 'fondos/serie-reves.svg', null, true, false, true, 'series', null, 450, true, 3270),
  ('fondo-serie-alien', 'background', 'Energía alien', 'Celdas verdes que se encienden en onda.', 'fondos/serie-alien.svg', null, true, false, true, 'series', null, 450, false, 3280),
  ('fondo-serie-billetes', 'background', 'El gran golpe', 'Lluvia de billetes y caretas.', 'fondos/serie-billetes.svg', null, true, false, true, 'series', null, 450, true, 3290),
  ('fondo-serie-abismo', 'background', 'Abismo', 'Medusas de colores y burbujas en lo profundo.', 'fondos/serie-abismo.svg', null, true, false, true, 'series2', null, 450, true, 3300),
  ('fondo-arma-trazadoras', 'background', 'Fuego cruzado', 'Trazadoras que cruzan en diagonal.', 'fondos/arma-trazadoras.svg', null, true, false, true, 'arsenal', null, 450, true, 3310),
  ('fondo-arma-oro', 'background', 'Bóveda de oro', 'Lingotes con un brillo que pasa.', 'fondos/arma-oro.svg', null, true, false, true, 'arsenal', null, 450, true, 3320),
  ('fondo-arma-dragon', 'background', 'Escamas de dragón', 'Escamas rojas y un ojo que parpadea.', 'fondos/arma-dragon.svg', null, true, false, true, 'arsenal', null, 450, true, 3330),
  ('fondo-extra-cerezos', 'background', 'Cerezos en flor', 'Pétalos que caen sobre ramas rosas.', 'fondos/extra-cerezos.svg', null, false, false, true, 'anime', 350, null, true, 3340),
  ('fondo-extra-velocidad', 'background', 'Líneas de velocidad', 'Como la viñeta de un golpe final.', 'fondos/extra-velocidad.svg', null, false, false, true, 'anime', 350, null, true, 3350),
  ('fondo-extra-tejados', 'background', 'Tejados de noche', 'Una aldea dormida bajo la luna.', 'fondos/extra-tejados.svg', null, false, false, true, 'anime', 350, null, true, 3360),
  ('fondo-extra-lluvia-neon', 'background', 'Lluvia de neón', 'Carteles que titilan en la ciudad mojada.', 'fondos/extra-lluvia-neon.svg', null, false, false, true, 'anime', 350, null, true, 3370),
  ('fondo-extra-gatos', 'background', 'Lluvia de gatos', 'Gatos que caen dando vueltas.', 'fondos/extra-gatos.svg', null, false, false, true, 'memes', 350, null, true, 3380),
  ('fondo-extra-grafico', 'background', 'Sube y sube', 'Velas verdes hasta el techo.', 'fondos/extra-grafico.svg', null, false, false, true, 'memes', 350, null, true, 3390),
  ('fondo-extra-rayo', 'background', 'Destello amarillo', 'Rayos dorados y cuchillos clavados en la noche.', 'fondos/extra-rayo.svg', null, true, false, true, 'anime', null, 450, true, 3400),
  ('fondo-extra-luna', 'background', 'Luna de cuervos', 'Cuervos que cruzan una luna enorme.', 'fondos/extra-luna.svg', null, true, false, true, 'anime', null, 450, true, 3410),
  ('fondo-extra-runas', 'background', 'Círculo de runas', 'Tres círculos mágicos que giran.', 'fondos/extra-runas.svg', null, true, false, true, 'anime', null, 450, true, 3420),
  ('fondo-extra-olas', 'background', 'Gran ola', 'Olas que avanzan bajo un sol rojo.', 'fondos/extra-olas.svg', null, true, false, true, 'anime', null, 450, true, 3430),
  ('fondo-extra-disco', 'background', 'Noche de baile', 'Bola de espejos y luces de colores.', 'fondos/extra-disco.svg', null, true, false, true, 'memes', null, 450, true, 3440),
  ('fondo-extra-patos', 'background', 'Baño de patos', 'Patos de goma que suben entre burbujas.', 'fondos/extra-patos.svg', null, true, false, true, 'memes', null, 450, true, 3450),
  ('avatar-rayo', 'avatar', 'Destello rubio', 'Pelo de punta y bandana con un rayo.', 'avatares/rayo.svg', null, false, false, false, 'anime', 450, null, false, 3460),
  ('avatar-bruja', 'avatar', 'Ojos de hielo', 'Sombrero puntiagudo y mirada helada.', 'avatares/bruja.svg', null, false, false, false, 'anime', 450, null, false, 3470),
  ('avatar-roja', 'avatar', 'Melena roja', 'Pelo de fuego y sonrisa de costado.', 'avatares/roja.svg', null, false, false, false, 'anime', 450, null, false, 3480),
  ('avatar-samurai', 'avatar', 'Samurái', 'Moño alto, cicatriz y pocas palabras.', 'avatares/samurai.svg', null, false, false, false, 'anime', 450, null, false, 3490),
  ('avatar-estudiante', 'avatar', 'Delegada', 'Coletas, anteojos y todas las tareas al día.', 'avatares/estudiante.svg', null, false, false, false, 'anime', 450, null, false, 3500),
  ('avatar-gamer', 'avatar', 'Sin dormir', 'Auriculares puestos y una partida más.', 'avatares/gamer.svg', null, false, false, false, 'anime', 450, null, false, 3510),
  ('avatar-gato-lentes', 'avatar', 'Gato con lentes', 'Fino, de saco y con lentes negros.', 'avatares/gato-lentes.svg', null, false, false, false, 'memes', 450, null, false, 3520),
  ('avatar-gato-enojado', 'avatar', 'Gato enojado', 'No le gustan los lunes ni tus tiros.', 'avatares/gato-enojado.svg', null, false, false, false, 'memes', 450, null, false, 3530),
  ('avatar-shiba', 'avatar', 'Perro tranqui', 'Todo está bien, aunque pierdas 16 a 0.', 'avatares/shiba.svg', null, false, false, false, 'memes', 450, null, false, 3540),
  ('avatar-rana', 'avatar', 'Rana contenta', 'Una rana a la que le da lo mismo el ELO.', 'avatares/rana.svg', null, false, false, false, 'memes', 450, null, false, 3550),
  ('avatar-capibara', 'avatar', 'Capibara zen', 'En paz con todos, incluso con los campers.', 'avatares/capibara.svg', null, false, false, false, 'memes', 450, null, false, 3560),
  ('avatar-pato', 'avatar', 'Pato de goma', 'Hace cuac y escucha tus problemas.', 'avatares/pato.svg', null, false, false, false, 'memes', 450, null, false, 3570),
  ('avatar-relampago', 'avatar', 'Relámpago dorado', 'Rayos alrededor y ojos que brillan.', 'avatares/relampago.svg', null, true, false, true, 'anime', null, 450, false, 3580),
  ('avatar-hechicera', 'avatar', 'Hechicera', 'Parpadea entre chispas azules.', 'avatares/hechicera.svg', null, true, false, true, 'anime', null, 450, false, 3590),
  ('avatar-oni', 'avatar', 'Oni', 'Cuernos, brasas y ojos encendidos.', 'avatares/oni.svg', null, true, false, true, 'anime', null, 450, false, 3600),
  ('avatar-sombra', 'avatar', 'Sombra', 'Pañuelo, parche y un solo ojo atento.', 'avatares/sombra.svg', null, true, false, true, 'anime', null, 450, false, 3610),
  ('avatar-nieve', 'avatar', 'Princesa de nieve', 'Pelo blanco y una nevada que no para.', 'avatares/nieve.svg', null, true, false, true, 'anime', null, 450, false, 3620),
  ('avatar-cerezo', 'avatar', 'Bajo el cerezo', 'Coletas rosas y pétalos que caen.', 'avatares/cerezo.svg', null, true, false, true, 'anime', null, 450, false, 3630),
  ('avatar-gato-lentes-vip', 'avatar', 'Gato bailarín', 'Se mueve al ritmo y le caen los lentes.', 'avatares/gato-lentes-vip.svg', null, false, false, true, 'memes', 450, null, true, 3640),
  ('avatar-gato-amor', 'avatar', 'Gato enamorado', 'Ojos de corazón que no paran de latir.', 'avatares/gato-amor.svg', null, false, false, true, 'memes', 450, null, true, 3650),
  ('avatar-mono', 'avatar', 'Mono risueño', 'Se ríe de tu último tiro fallado.', 'avatares/mono.svg', null, true, false, true, 'memes', null, 450, false, 3660),
  ('avatar-pinguino', 'avatar', 'Pingüino navideño', 'Con gorro de lana y nieve encima.', 'avatares/pinguino.svg', null, true, false, true, 'memes', null, 450, false, 3670),
  ('avatar-zorro', 'avatar', 'Zorro astuto', 'Pestañea entre brasas y te mira de reojo.', 'avatares/zorro.svg', null, true, false, true, 'memes', null, 450, false, 3680),
  ('avatar-capibara-vip', 'avatar', 'Capibara con naranja', 'Se balancea con una naranja en la cabeza.', 'avatares/capibara-vip.svg', null, true, false, true, 'memes', null, 450, false, 3690);
do $$ begin
  if (select count(*) from public.shop_items) <> 369 then raise exception 'replanteo 119: faltan artículos'; end if;
end $$;
-- --- fin: catálogo generado ---

commit;
