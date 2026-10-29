-- =============================================================================
-- Tienda de cosméticos con puntos (web actual)
--
-- Mismo diseño y nombres que el plan del backend (docs/bitacora/2026-10-29-tienda-puntos-backend/), para
-- que el replanteo 34 lo tome en el corte. Usa el VIP de 20261028120000_vip.sql (is_vip, vip_memberships).
--
-- - points_config: puntos por mix jugado y ganado, ×VIP y ofertas de la semana. Una fila.
-- - shop_items: el catálogo de assets/perfil/catalogo.json (mismo id). price null = no se vende.
-- - user_items: inventario (comprado o regalado). user_cosmetics: lo equipado.
-- - point_grants: regalos y correcciones del admin, con motivo. No se borran.
-- - Los puntos ganados no se anotan: se calculan de los mixes terminados que contaron para el ELO
--   (regla de widget_player: player_id o steam_id del jugador, equipo 1 o 2, matches.winner).
--   ×VIP si la cuenta era VIP en la fecha del mix (was_vip).
-- - Los artículos vip_only no se compran: se usan mientras la cuenta es VIP y dejan de mostrarse solos.
-- - shop_catalog: el catálogo con el precio de la semana (shop_weekly: N artículos con descuento, elegidos
--   por la semana ISO en hora de Bogotá, sin trabajos programados).
-- - player_cosmetics_public: lo que tiene puesto cada ficha con cuenta, sin lo VIP vencido. Pública.
-- - profile_details.cover_url: la portada del perfil (avatars/<uid>/). El admin la quita con admin_cover_clear.
-- Sin avisos: notify() es del replanteo y todavía no está en producción.
--
-- Bitácora: docs/bitacora/2026-10-29-tienda-web/
-- Cómo aplicarla: primero 20261028120000_vip.sql. Después Supabase > SQL Editor > pegar todo este archivo > Run.
-- Re-ejecutable: la carga del catálogo actualiza textos y archivos, pero no pisa precios ni "activo".
-- =============================================================================

begin;

-- ---------- Configuración ----------
create table if not exists public.points_config (
  id              int primary key default 1 check (id = 1),
  per_mix         int not null default 10 check (per_mix between 0 and 1000),
  per_win         int not null default 5 check (per_win between 0 and 1000),
  vip_multiplier  numeric not null default 1.5 check (vip_multiplier between 1 and 3),
  weekly_count    int not null default 6 check (weekly_count between 0 and 24),
  weekly_discount int not null default 25 check (weekly_discount between 0 and 90),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles(id) on delete set null
);
insert into public.points_config (id) values (1) on conflict (id) do nothing;
alter table public.points_config enable row level security;
revoke all on public.points_config from anon, authenticated;
grant select on public.points_config to anon, authenticated;
drop policy if exists points_config_read on public.points_config;
create policy points_config_read on public.points_config for select using (true);

-- ---------- Catálogo ----------
create table if not exists public.shop_items (
  id          text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  kind        text not null check (kind in ('frame', 'sticker', 'theme', 'name')),
  name        text not null check (char_length(name) between 1 and 60),
  description text check (char_length(description) <= 200),
  file        text check (char_length(file) <= 120),
  css_class   text check (char_length(css_class) <= 60),
  vip_only    boolean not null default false,
  animated    boolean not null default false,
  collection  text not null default 'cs' check (collection ~ '^[a-z0-9]{2,20}$'),
  price       int check (price between 1 and 1000000),
  active      boolean not null default true,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  constraint shop_items_recurso check ((file is null) <> (css_class is null)),
  constraint shop_items_vip_sin_precio check (not vip_only or price is null)
);
alter table public.shop_items enable row level security;
revoke all on public.shop_items from anon, authenticated;
grant select on public.shop_items to anon, authenticated;
drop policy if exists shop_items_read on public.shop_items;
create policy shop_items_read on public.shop_items for select using (true);

-- ---------- Inventario, regalos y equipados ----------
create table if not exists public.user_items (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  item_id     text not null references public.shop_items(id) on delete cascade,
  source      text not null check (source in ('purchase', 'grant')),
  price_paid  int check (price_paid >= 0),
  granted_by  uuid references public.profiles(id) on delete set null,
  note        text check (char_length(note) <= 200),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create table if not exists public.point_grants (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     int not null check (amount <> 0 and amount between -1000000 and 1000000),
  reason     text not null check (char_length(reason) between 1 and 200),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists point_grants_user on public.point_grants (user_id);
create table if not exists public.user_cosmetics (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  frame      text references public.shop_items(id) on delete set null,
  theme      text references public.shop_items(id) on delete set null,
  name       text references public.shop_items(id) on delete set null,
  stickers   text[] not null default '{}' check (cardinality(stickers) <= 3),
  updated_at timestamptz not null default now()
);

-- Cada uno lee lo suyo y los admins, todo. Se escribe solo con las funciones.
alter table public.user_items enable row level security;
alter table public.point_grants enable row level security;
alter table public.user_cosmetics enable row level security;
revoke all on public.user_items, public.point_grants, public.user_cosmetics from anon, authenticated;
grant select on public.user_items, public.point_grants, public.user_cosmetics to authenticated;
drop policy if exists user_items_read on public.user_items;
create policy user_items_read on public.user_items for select to authenticated using (user_id = auth.uid() or is_admin());
drop policy if exists point_grants_read on public.point_grants;
create policy point_grants_read on public.point_grants for select to authenticated using (user_id = auth.uid() or is_admin());
drop policy if exists user_cosmetics_read on public.user_cosmetics;
create policy user_cosmetics_read on public.user_cosmetics for select to authenticated using (user_id = auth.uid() or is_admin());

-- ---------- Portada ----------
alter table public.profile_details add column if not exists cover_url text;
do $$ begin
  alter table public.profile_details add constraint profile_details_cover_url_check check (char_length(cover_url) <= 500);
exception when duplicate_object then null; end $$;

-- ---------- Puntos ----------
-- VIP vigente en una fecha: sin revocar (o revocado después), empezado y sin vencer en ese momento.
create or replace function public.was_vip(p_user uuid, p_at timestamptz) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from vip_memberships v
                  where v.user_id = p_user and v.starts_at <= p_at
                    and (v.ends_at is null or v.ends_at > p_at)
                    and (v.revoked_at is null or v.revoked_at > p_at))
$$;
revoke all on function public.was_vip(uuid, timestamptz) from public, anon;
grant execute on function public.was_vip(uuid, timestamptz) to authenticated, service_role;

-- Los mixes que le dan puntos a una cuenta: los de su ficha (player_id o steam_id), terminados y con ELO.
-- Interna: la usan las funciones de abajo, que controlan quién la puede pedir.
create or replace function public.points_mixes_of(p_user uuid)
  returns table (match_id uuid, played_at timestamptz, map text, won boolean, vip boolean, points int)
  language sql stable security definer set search_path = public as $$
  with p as (select id, steam_id from players where user_id = p_user),
  c as (select * from points_config where id = 1),
  mx as (
    select distinct on (m.id) m.id, coalesce(m.played_at, m.starts_at) at, m.map,
           coalesce(m.winner = case s.team when 1 then m.team1 else m.team2 end, false) won
      from p
      join match_player_stats s on s.player_id = p.id or (p.steam_id is not null and s.steam_id = p.steam_id)
      join matches m on m.id = s.match_id
     where m.kind = 'mix' and m.status = 'finished' and s.team in (1, 2) and s.elo_after is not null
     order by m.id, (s.player_id = p.id) desc nulls last
  )
  select mx.id, mx.at, mx.map, mx.won, was_vip(p_user, mx.at),
         round((c.per_mix + case when mx.won then c.per_win else 0 end)
               * case when was_vip(p_user, mx.at) then c.vip_multiplier else 1 end)::int
    from mx, c
$$;
revoke all on function public.points_mixes_of(uuid) from public, anon, authenticated;

create or replace function public.points_of(p_user uuid)
  returns table (earned int, granted int, spent int, balance int, mixes int)
  language sql stable security definer set search_path = public as $$
  with e as (select coalesce(sum(points), 0)::int pts, count(*)::int n from points_mixes_of(p_user)),
       g as (select coalesce(sum(amount), 0)::int pts from point_grants where user_id = p_user),
       s as (select coalesce(sum(price_paid), 0)::int pts from user_items where user_id = p_user and source = 'purchase')
  select e.pts, g.pts, s.pts, e.pts + g.pts - s.pts, e.n from e, g, s
$$;
revoke all on function public.points_of(uuid) from public, anon, authenticated;

-- Mi saldo (y si soy VIP hoy).
create or replace function public.my_points()
  returns table (earned int, granted int, spent int, balance int, mixes int, vip boolean)
  language sql stable security definer set search_path = public as $$
  select p.earned, p.granted, p.spent, p.balance, p.mixes, is_vip(auth.uid())
    from points_of(auth.uid()) p where auth.uid() is not null
$$;

-- Historial: mixes (+), regalos (±) y compras (−), lo más nuevo primero. El dueño o un admin.
create or replace function public.my_points_history(p_user uuid default auth.uid(), p_limit int default 50)
  returns table (kind text, at timestamptz, points int, label text, vip boolean)
  language plpgsql stable security definer set search_path = public as $$
begin
  if p_user is null or (p_user <> auth.uid() and not is_admin()) then
    raise exception 'No podés ver los puntos de otra cuenta' using errcode = '42501';
  end if;
  return query
  select * from (
    select 'mix'::text, x.played_at, x.points,
           coalesce(x.map, 'Mix') || case when x.won then ' · victoria' else '' end, x.vip
      from points_mixes_of(p_user) x
    union all
    select 'grant', g.created_at, g.amount, g.reason, false from point_grants g where g.user_id = p_user
    union all
    select 'purchase', u.acquired_at, -u.price_paid, i.name, false
      from user_items u join shop_items i on i.id = u.item_id
     where u.user_id = p_user and u.source = 'purchase'
  ) h order by 2 desc nulls last limit least(greatest(coalesce(p_limit, 50), 1), 500);
end $$;

revoke all on function public.my_points(), public.my_points_history(uuid, int) from public, anon;
grant execute on function public.my_points(), public.my_points_history(uuid, int) to authenticated, service_role;

-- ---------- Precio de la semana ----------
-- Los artículos en oferta esta semana: los que se venden, mezclados con la semana ISO como semilla.
create or replace function public.shop_weekly() returns setof text
  language sql stable security definer set search_path = public as $$
  select id from shop_items
   where active and price is not null and not vip_only
   order by md5(id || to_char(now() at time zone 'America/Bogota', 'IYYY-IW'))
   limit (select weekly_count from points_config where id = 1)
$$;
grant execute on function public.shop_weekly() to anon, authenticated, service_role;

-- El catálogo con el precio de hoy. weekly_ends: el lunes que viene a las 00:00 de Bogotá.
create or replace view public.shop_catalog as
select i.id, i.kind, i.name, i.description, i.file, i.css_class, i.vip_only, i.animated, i.collection,
       i.price as base_price,
       case when i.price is null then null
            when w.id is not null then greatest(1, round(i.price * (100 - c.weekly_discount) / 100.0)::int)
            else i.price end as price,
       w.id is not null as weekly,
       (date_trunc('week', now() at time zone 'America/Bogota') + interval '7 days') at time zone 'America/Bogota' as weekly_ends,
       i.sort
  from shop_items i
  cross join points_config c
  left join shop_weekly() w(id) on w.id = i.id
 where i.active and c.id = 1;
comment on view public.shop_catalog is 'Catálogo activo con el precio de hoy (ofertas de la semana incluidas)';
grant select on public.shop_catalog to anon, authenticated;

-- ---------- Comprar y equipar ----------
-- Compra un artículo con los puntos. Devuelve el precio pagado y el saldo nuevo.
create or replace function public.shop_buy(p_item text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_price int; v_bal int; i shop_items;
begin
  if v_uid is null then raise exception 'Iniciá sesión para comprar' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));
  select * into i from shop_items where id = p_item;
  if not found or not i.active then raise exception 'Ese artículo no está en la tienda'; end if;
  if i.vip_only then raise exception 'Es un artículo VIP: no se compra, se usa mientras seas VIP'; end if;
  if i.price is null then raise exception 'Ese artículo no está a la venta'; end if;
  if exists (select 1 from user_items where user_id = v_uid and item_id = p_item) then raise exception 'Ya lo tenés'; end if;
  select price into v_price from shop_catalog where id = p_item;
  select balance into v_bal from points_of(v_uid);
  if v_bal < v_price then raise exception 'Te faltan % puntos', v_price - v_bal; end if;
  insert into user_items (user_id, item_id, source, price_paid) values (v_uid, p_item, 'purchase', v_price);
  return jsonb_build_object('item', p_item, 'price_paid', v_price, 'balance', v_bal - v_price);
end $$;

-- ¿Puede usar este artículo la cuenta? Lo tiene, o es VIP y la cuenta es VIP hoy.
create or replace function public.can_use_item(p_user uuid, p_item text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_items i where i.id = p_item
                   and ((i.vip_only and is_vip(p_user))
                        or exists (select 1 from user_items u where u.user_id = p_user and u.item_id = i.id)))
$$;
-- La usa player_cosmetics_public, y las funciones de una vista se ejecutan con los permisos de quien la lee.
revoke all on function public.can_use_item(uuid, text) from public;
grant execute on function public.can_use_item(uuid, text) to anon, authenticated, service_role;

-- Cambia lo equipado. p_data con frame, theme, name (null o "" lo saca) y stickers (lista, hasta 3).
-- Las claves que no vienen no se tocan.
create or replace function public.set_my_cosmetics(p_data jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r user_cosmetics; k text; v text; st text[];
begin
  if v_uid is null then raise exception 'Iniciá sesión' using errcode = '42501'; end if;
  if jsonb_typeof(p_data) <> 'object' then raise exception 'Datos inválidos'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));
  insert into user_cosmetics (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into r from user_cosmetics where user_id = v_uid;
  foreach k in array array['frame', 'theme', 'name'] loop
    if p_data ? k then
      v := nullif(p_data ->> k, '');
      if v is not null then
        if not exists (select 1 from shop_items where id = v and kind = k) then raise exception 'Ese artículo no es del tipo %', k; end if;
        if not can_use_item(v_uid, v) then raise exception 'Todavía no tenés ese artículo'; end if;
      end if;
      if k = 'frame' then r.frame := v; elsif k = 'theme' then r.theme := v; else r.name := v; end if;
    end if;
  end loop;
  if p_data ? 'stickers' then
    if jsonb_typeof(p_data -> 'stickers') <> 'array' then raise exception 'stickers tiene que ser una lista'; end if;
    select coalesce(array_agg(distinct t.x), '{}') into st from jsonb_array_elements_text(p_data -> 'stickers') t(x) where t.x <> '';
    if cardinality(st) > 3 then raise exception 'Podés equipar hasta 3 stickers'; end if;
    foreach v in array st loop
      if not exists (select 1 from shop_items where id = v and kind = 'sticker') then raise exception 'Ese artículo no es un sticker'; end if;
      if not can_use_item(v_uid, v) then raise exception 'Todavía no tenés ese sticker'; end if;
    end loop;
    -- conserva el orden en que llegaron
    select coalesce(array_agg(x order by o), '{}') into r.stickers
      from (select distinct on (x) x, o from jsonb_array_elements_text(p_data -> 'stickers') with ordinality t(x, o) where x <> '' order by x, o) s;
  end if;
  update user_cosmetics set frame = r.frame, theme = r.theme, name = r.name, stickers = r.stickers, updated_at = now()
   where user_id = v_uid;
  return jsonb_build_object('frame', r.frame, 'theme', r.theme, 'name', r.name, 'stickers', to_jsonb(r.stickers));
end $$;

revoke all on function public.shop_buy(text), public.set_my_cosmetics(jsonb) from public, anon;
grant execute on function public.shop_buy(text), public.set_my_cosmetics(jsonb) to authenticated, service_role;

-- Lo que tiene puesto cada ficha con cuenta, ya resuelto y sin lo que no puede usar hoy (VIP vencido o
-- artículo quitado). Pública: es lo que se ve en el perfil.
create or replace view public.player_cosmetics_public as
select p.id as player_id, c.user_id, is_vip(c.user_id) as vip,
       case when can_use_item(c.user_id, c.frame) then c.frame end as frame,
       case when can_use_item(c.user_id, c.theme) then c.theme end as theme,
       case when can_use_item(c.user_id, c.name) then c.name end as name,
       coalesce((select array_agg(s order by o) from unnest(c.stickers) with ordinality u(s, o)
                  where can_use_item(c.user_id, s)), '{}') as stickers
  from user_cosmetics c
  join players p on p.user_id = c.user_id;
comment on view public.player_cosmetics_public is 'Cosméticos equipados de cada ficha con cuenta, sin los que no puede usar hoy';
grant select on public.player_cosmetics_public to anon, authenticated;

-- ---------- Admin ----------
create or replace function public.admin_points_grant(p_user uuid, p_amount int, p_reason text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'Solo un administrador puede dar puntos' using errcode = '42501'; end if;
  if coalesce(p_amount, 0) = 0 then raise exception 'La cantidad no puede ser 0'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No existe ese usuario'; end if;
  insert into point_grants (user_id, amount, reason, granted_by) values (p_user, p_amount, btrim(p_reason), auth.uid()) returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_item_grant(p_user uuid, p_item text, p_note text default null) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede regalar artículos' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No existe ese usuario'; end if;
  if not exists (select 1 from shop_items where id = p_item) then raise exception 'No existe ese artículo'; end if;
  if exists (select 1 from shop_items where id = p_item and vip_only) then raise exception 'Los artículos VIP se usan con el VIP: dale VIP a la cuenta'; end if;
  if char_length(p_note) > 200 then raise exception 'La nota puede tener hasta 200 caracteres'; end if;
  insert into user_items (user_id, item_id, source, granted_by, note) values (p_user, p_item, 'grant', auth.uid(), nullif(btrim(p_note), ''))
  on conflict (user_id, item_id) do nothing;
  if not found then raise exception 'Ya lo tiene'; end if;
end $$;

-- Quita un artículo del inventario y de lo equipado. No devuelve puntos (para eso, admin_points_grant).
create or replace function public.admin_item_revoke(p_user uuid, p_item text, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede quitar artículos' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || p_user::text));
  delete from user_items where user_id = p_user and item_id = p_item;
  if not found then raise exception 'No tiene ese artículo'; end if;
  update user_cosmetics set frame = nullif(frame, p_item), theme = nullif(theme, p_item), name = nullif(name, p_item),
         stickers = array_remove(stickers, p_item), updated_at = now()
   where user_id = p_user;
end $$;

-- Cambia un artículo del catálogo. Lo que viene en null no se toca; p_no_price = true lo saca de la venta.
create or replace function public.admin_shop_item_update(p_item text, p_price int default null, p_active boolean default null,
                                                         p_name text default null, p_description text default null,
                                                         p_sort int default null, p_no_price boolean default false) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede editar la tienda' using errcode = '42501'; end if;
  if p_price is not null and p_price < 1 then raise exception 'El precio tiene que ser mayor a 0'; end if;
  if p_price is not null and exists (select 1 from shop_items where id = p_item and vip_only) then
    raise exception 'Los artículos VIP no tienen precio';
  end if;
  update shop_items set
    price       = case when coalesce(p_no_price, false) then null else coalesce(p_price, price) end,
    active      = coalesce(p_active, active),
    name        = coalesce(nullif(btrim(p_name), ''), name),
    description = coalesce(p_description, description),
    sort        = coalesce(p_sort, sort)
   where id = p_item;
  if not found then raise exception 'No existe ese artículo'; end if;
end $$;

create or replace function public.set_points_config(p_per_mix int, p_per_win int, p_vip_multiplier numeric,
                                                    p_weekly_count int, p_weekly_discount int) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar los puntos' using errcode = '42501'; end if;
  update points_config set per_mix = p_per_mix, per_win = p_per_win, vip_multiplier = p_vip_multiplier,
         weekly_count = p_weekly_count, weekly_discount = p_weekly_discount, updated_at = now(), updated_by = auth.uid()
   where id = 1;
end $$;

-- Quita la portada de una cuenta (moderación). El archivo queda en el bucket.
create or replace function public.admin_cover_clear(p_user uuid, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede quitar portadas' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  update profile_details set cover_url = null, updated_at = now() where user_id = p_user and cover_url is not null;
  if not found then raise exception 'Esa cuenta no tiene portada'; end if;
end $$;

-- Saldo, inventario y VIP de todas las cuentas. Solo admins.
create or replace function public.admin_points_overview()
  returns table (user_id uuid, alias text, player_id uuid, nick text, vip boolean,
                 earned int, granted int, spent int, balance int, mixes int, items int, cover_url text)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return query
  select pr.id, pr.tag, pl.id, pl.nick, is_vip(pr.id), b.earned, b.granted, b.spent, b.balance, b.mixes,
         (select count(*)::int from user_items u where u.user_id = pr.id), d.cover_url
    from profiles pr
    left join players pl on pl.user_id = pr.id
    left join profile_details d on d.user_id = pr.id
    cross join lateral points_of(pr.id) b
   order by b.balance desc, pr.tag;
end $$;

revoke all on function public.admin_points_grant(uuid, int, text), public.admin_item_grant(uuid, text, text),
  public.admin_item_revoke(uuid, text, text), public.admin_shop_item_update(text, int, boolean, text, text, int, boolean),
  public.set_points_config(int, int, numeric, int, int), public.admin_cover_clear(uuid, text),
  public.admin_points_overview() from public, anon;
grant execute on function public.admin_points_grant(uuid, int, text), public.admin_item_grant(uuid, text, text),
  public.admin_item_revoke(uuid, text, text), public.admin_shop_item_update(text, int, boolean, text, text, int, boolean),
  public.set_points_config(int, int, numeric, int, int), public.admin_cover_clear(uuid, text),
  public.admin_points_overview() to authenticated, service_role;

-- ---------- Carga del catálogo ----------
-- Generado con docs/bitacora/2026-10-29-tienda-web/pruebas/generar_catalogo_sql.py desde assets/perfil/catalogo.json.
-- Re-ejecutable: actualiza textos y archivos; el precio y "activo" solo se ponen la primera vez.
-- --- inicio: catálogo generado ---
insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, animated, collection, price, sort) values
  ('marco-mira', 'frame', 'Mira', 'Esquinas tácticas y mira que respira.', 'marcos/mira.svg', null, false, true, 'cs', 1200, 10),
  ('marco-trazadoras', 'frame', 'Trazadoras', 'Balas trazadoras que dan la vuelta al avatar.', 'marcos/trazadoras.svg', null, false, true, 'cs', 1200, 20),
  ('marco-c4', 'frame', 'C4', 'Cinta de peligro, cables y la cuenta regresiva.', 'marcos/c4.svg', null, false, true, 'cs', 1200, 30),
  ('marco-circuito', 'frame', 'Circuito', 'Pistas verdes con pulsos de energía.', 'marcos/circuito.svg', null, false, true, 'cs', 1200, 40),
  ('marco-fuego', 'frame', 'Fuego', 'Llamas vivas y chispas que suben.', 'marcos/fuego.svg', null, false, true, 'cs', 1200, 50),
  ('marco-camuflaje', 'frame', 'Camuflaje', 'Patrón militar con placas de identificación.', 'marcos/camuflaje.svg', null, false, false, 'cs', 900, 60),
  ('marco-hielo', 'frame', 'Hielo', 'Escarcha, carámbanos y nieve que cae.', 'marcos/hielo.svg', null, false, true, 'cs', 1200, 70),
  ('marco-balas', 'frame', 'Cinta de balas', 'Cartuchos de bronce alrededor del avatar.', 'marcos/balas.svg', null, false, false, 'cs', 900, 80),
  ('marco-pixel', 'frame', 'Píxel', 'Borde de 8 bits que se mueve.', 'marcos/pixel.svg', null, false, true, 'cs', 1200, 90),
  ('marco-grafiti', 'frame', 'Grafiti', 'Pintura en aerosol que chorrea.', 'marcos/grafiti.svg', null, false, true, 'cs', 1200, 100),
  ('marco-pais-ar', 'frame', 'Argentina', 'Los colores de Argentina alrededor del avatar.', 'marcos/pais-ar.svg', null, false, true, 'paises', 1000, 110),
  ('marco-pais-br', 'frame', 'Brasil', 'Los colores de Brasil alrededor del avatar.', 'marcos/pais-br.svg', null, false, true, 'paises', 1000, 120),
  ('marco-pais-uy', 'frame', 'Uruguay', 'Los colores de Uruguay alrededor del avatar.', 'marcos/pais-uy.svg', null, false, true, 'paises', 1000, 130),
  ('marco-pais-cl', 'frame', 'Chile', 'Los colores de Chile alrededor del avatar.', 'marcos/pais-cl.svg', null, false, true, 'paises', 1000, 140),
  ('marco-pais-pe', 'frame', 'Perú', 'Los colores de Perú alrededor del avatar.', 'marcos/pais-pe.svg', null, false, true, 'paises', 1000, 150),
  ('marco-pais-co', 'frame', 'Colombia', 'Los colores de Colombia alrededor del avatar.', 'marcos/pais-co.svg', null, false, true, 'paises', 1000, 160),
  ('marco-pais-ve', 'frame', 'Venezuela', 'Los colores de Venezuela alrededor del avatar.', 'marcos/pais-ve.svg', null, false, true, 'paises', 1000, 170),
  ('marco-pais-ec', 'frame', 'Ecuador', 'Los colores de Ecuador alrededor del avatar.', 'marcos/pais-ec.svg', null, false, true, 'paises', 1000, 180),
  ('marco-pais-bo', 'frame', 'Bolivia', 'Los colores de Bolivia alrededor del avatar.', 'marcos/pais-bo.svg', null, false, true, 'paises', 1000, 190),
  ('marco-pais-py', 'frame', 'Paraguay', 'Los colores de Paraguay alrededor del avatar.', 'marcos/pais-py.svg', null, false, true, 'paises', 1000, 200),
  ('marco-pais-mx', 'frame', 'México', 'Los colores de México alrededor del avatar.', 'marcos/pais-mx.svg', null, false, true, 'paises2', 1000, 210),
  ('marco-pais-cr', 'frame', 'Costa Rica', 'Los colores de Costa Rica alrededor del avatar.', 'marcos/pais-cr.svg', null, false, true, 'paises2', 1000, 220),
  ('marco-pais-cu', 'frame', 'Cuba', 'Los colores de Cuba alrededor del avatar.', 'marcos/pais-cu.svg', null, false, true, 'paises2', 1000, 230),
  ('marco-pais-do', 'frame', 'Rep. Dominicana', 'Los colores de Rep. Dominicana alrededor del avatar.', 'marcos/pais-do.svg', null, false, true, 'paises2', 1000, 240),
  ('marco-pais-pr', 'frame', 'Puerto Rico', 'Los colores de Puerto Rico alrededor del avatar.', 'marcos/pais-pr.svg', null, false, true, 'paises2', 1000, 250),
  ('marco-pais-pa', 'frame', 'Panamá', 'Los colores de Panamá alrededor del avatar.', 'marcos/pais-pa.svg', null, false, true, 'paises2', 1000, 260),
  ('marco-pais-gt', 'frame', 'Guatemala', 'Los colores de Guatemala alrededor del avatar.', 'marcos/pais-gt.svg', null, false, true, 'paises2', 1000, 270),
  ('marco-pais-hn', 'frame', 'Honduras', 'Los colores de Honduras alrededor del avatar.', 'marcos/pais-hn.svg', null, false, true, 'paises2', 1000, 280),
  ('marco-pais-sv', 'frame', 'El Salvador', 'Los colores de El Salvador alrededor del avatar.', 'marcos/pais-sv.svg', null, false, true, 'paises2', 1000, 290),
  ('marco-pais-es', 'frame', 'España', 'Los colores de España alrededor del avatar.', 'marcos/pais-es.svg', null, false, true, 'paises2', 1000, 300),
  ('marco-mapa-dust2', 'frame', 'de_dust2', 'Arena, muros de adobe y la larga de toda la vida.', 'marcos/mapa-dust2.svg', null, false, false, 'mapas', 900, 310),
  ('marco-mapa-inferno', 'frame', 'de_inferno', 'Ladrillo italiano y la banana.', 'marcos/mapa-inferno.svg', null, false, false, 'mapas', 900, 320),
  ('marco-mapa-nuke', 'frame', 'de_nuke', 'Planta nuclear con franjas de peligro.', 'marcos/mapa-nuke.svg', null, false, false, 'mapas', 900, 330),
  ('marco-mapa-train', 'frame', 'de_train', 'Vías, vagones y metal.', 'marcos/mapa-train.svg', null, false, false, 'mapas', 900, 340),
  ('marco-mapa-office', 'frame', 'cs_office', 'Nieve afuera y rehenes adentro.', 'marcos/mapa-office.svg', null, false, false, 'mapas', 900, 350),
  ('marco-mapa-aztec', 'frame', 'de_aztec', 'Selva, templo y el puente colgante.', 'marcos/mapa-aztec.svg', null, false, false, 'mapas', 900, 360),
  ('marco-mapa-cbble', 'frame', 'de_cbble', 'Adoquines y murallas de castillo.', 'marcos/mapa-cbble.svg', null, false, false, 'mapas', 900, 370),
  ('marco-mapa-italy', 'frame', 'cs_italy', 'Techos de teja y el mercado.', 'marcos/mapa-italy.svg', null, false, false, 'mapas', 900, 380),
  ('marco-mapa-piranesi', 'frame', 'de_piranesi', 'Ruinas de piedra y arcos.', 'marcos/mapa-piranesi.svg', null, false, false, 'mapas', 900, 390),
  ('marco-mapa-prodigy', 'frame', 'de_prodigy', 'Laboratorio subterráneo y rejillas.', 'marcos/mapa-prodigy.svg', null, false, false, 'mapas', 900, 400),
  ('marco-kevlar', 'frame', 'Kevlar', 'Placa blindada con trama hexagonal.', 'marcos/kevlar.svg', null, true, true, 'cs', null, 410),
  ('marco-neon', 'frame', 'Neón', 'Degradado rosa, violeta y cian que gira sin parar.', 'marcos/neon.svg', null, true, true, 'cs', null, 420),
  ('marco-oro-vip', 'frame', 'Oro VIP', 'Corona, laureles y destello dorado.', 'marcos/oro-vip.svg', null, true, true, 'cs', null, 430),
  ('marco-diamante', 'frame', 'Diamante', 'Facetas de cristal con destellos.', 'marcos/diamante.svg', null, true, true, 'cs', null, 440),
  ('marco-plasma', 'frame', 'Plasma', 'Descargas eléctricas violetas.', 'marcos/plasma.svg', null, true, true, 'cs', null, 450),
  ('marco-galaxia', 'frame', 'Galaxia', 'Nebulosas que giran y estrellas fugaces.', 'marcos/galaxia.svg', null, true, true, 'cs', null, 460),
  ('marco-holografico', 'frame', 'Holográfico', 'Iridiscente, cambia de color sin parar.', 'marcos/holografico.svg', null, true, true, 'cs', null, 470),
  ('marco-laser', 'frame', 'Láser', 'Mira láser que barre el avatar.', 'marcos/laser.svg', null, true, true, 'cs', null, 480),
  ('marco-glitch', 'frame', 'Glitch', 'Señal rota en rojo y cian.', 'marcos/glitch.svg', null, true, true, 'cs', null, 490),
  ('marco-alas', 'frame', 'Alas', 'Alas blancas y aureola dorada.', 'marcos/alas.svg', null, true, true, 'cs', null, 500),
  ('marco-serie-ninja', 'frame', 'Shinobi', 'Espiral, cinta y shurikens que giran.', 'marcos/serie-ninja.svg', null, true, true, 'series', null, 510),
  ('marco-serie-guerrero', 'frame', 'Súper guerrero', 'Aura dorada que arde y rayos que chispean.', 'marcos/serie-guerrero.svg', null, true, true, 'series', null, 520),
  ('marco-serie-alien', 'frame', 'Reloj alien', 'Panel verde con el dial que transforma.', 'marcos/serie-alien.svg', null, true, true, 'series', null, 530),
  ('marco-serie-portal', 'frame', 'Portal', 'Un portal verde a otra dimensión que no para de girar.', 'marcos/serie-portal.svg', null, true, true, 'series', null, 540),
  ('marco-serie-navaja', 'frame', 'Gorra y navaja', 'Marco art déco de 1919 con una navaja en la visera.', 'marcos/serie-navaja.svg', null, true, true, 'series', null, 550),
  ('marco-serie-laboratorio', 'frame', 'Laboratorio', 'Cristales azules, burbujas y la tabla periódica de CS:S.', 'marcos/serie-laboratorio.svg', null, true, true, 'series', null, 560),
  ('marco-serie-reves', 'frame', 'Mundo del revés', 'Luces de colores que titilan y esporas en el aire.', 'marcos/serie-reves.svg', null, true, true, 'series', null, 570),
  ('marco-serie-reinos', 'frame', 'Reinos', 'Acero, espadas, una corona y nieve que cae.', 'marcos/serie-reinos.svg', null, true, true, 'series', null, 580),
  ('marco-serie-atraco', 'frame', 'Atraco', 'Mono rojo, lingote de oro y billetes volando.', 'marcos/serie-atraco.svg', null, true, true, 'series', null, 590),
  ('marco-serie-juego', 'frame', 'Juego mortal', 'Círculo, triángulo y cuadrado. Jugador N°034.', 'marcos/serie-juego.svg', null, true, true, 'series', null, 600),
  ('marco-arma-ak', 'frame', 'AK-47 Lava', 'Acabado Lava con el arma abajo y un brillo que corre.', 'marcos/arma-ak.svg', null, true, true, 'arsenal', null, 610),
  ('marco-arma-m4', 'frame', 'M4A1 Ártico', 'Acabado Ártico con el arma abajo y un brillo que corre.', 'marcos/arma-m4.svg', null, true, true, 'arsenal', null, 620),
  ('marco-arma-awp', 'frame', 'AWP Relámpago', 'Acabado Relámpago con el arma abajo y un brillo que corre.', 'marcos/arma-awp.svg', null, true, true, 'arsenal', null, 630),
  ('marco-arma-deagle', 'frame', 'Deagle Oro macizo', 'Acabado Oro macizo con el arma abajo y un brillo que corre.', 'marcos/arma-deagle.svg', null, true, true, 'arsenal', null, 640),
  ('marco-arma-scout', 'frame', 'Scout Selva', 'Acabado Selva con el arma abajo y un brillo que corre.', 'marcos/arma-scout.svg', null, true, true, 'arsenal', null, 650),
  ('marco-arma-usp', 'frame', 'USP Medianoche', 'Acabado Medianoche con el arma abajo y un brillo que corre.', 'marcos/arma-usp.svg', null, true, true, 'arsenal', null, 660),
  ('marco-arma-glock', 'frame', 'Glock Caramelo', 'Acabado Caramelo con el arma abajo y un brillo que corre.', 'marcos/arma-glock.svg', null, true, true, 'arsenal', null, 670),
  ('marco-arma-mp5', 'frame', 'MP5 Neón', 'Acabado Neón con el arma abajo y un brillo que corre.', 'marcos/arma-mp5.svg', null, true, true, 'arsenal', null, 680),
  ('marco-arma-cuchillo', 'frame', 'Cuchillo Fantasma', 'Acabado Fantasma con el arma abajo y un brillo que corre.', 'marcos/arma-cuchillo.svg', null, true, true, 'arsenal', null, 690),
  ('marco-arma-he', 'frame', 'HE Arcoíris', 'Acabado Arcoíris con el arma abajo y un brillo que corre.', 'marcos/arma-he.svg', null, true, true, 'arsenal', null, 700),
  ('marco-serie-dona', 'frame', 'Dona glaseada', 'Amarillo de pueblo chico y una dona que flota.', 'marcos/serie-dona.svg', null, true, true, 'series2', null, 710),
  ('marco-serie-zombi', 'frame', 'Apocalipsis zombi', 'Tierra removida y una mano que sale.', 'marcos/serie-zombi.svg', null, true, true, 'series2', null, 720),
  ('marco-serie-barril', 'frame', 'La vecindad', 'Madera de patio y un barril para esconderse.', 'marcos/serie-barril.svg', null, true, true, 'series2', null, 730),
  ('marco-serie-fuga', 'frame', 'La fuga', 'Mono naranja y barrotes, con uno doblado.', 'marcos/serie-fuga.svg', null, true, true, 'series2', null, 740),
  ('marco-serie-radiacion', 'frame', 'Reactor 4', 'Peligro radiactivo que late.', 'marcos/serie-radiacion.svg', null, true, true, 'series2', null, 750),
  ('marco-serie-vikingo', 'frame', 'Vikingo', 'Madera, hierro y el casco con cuernos.', 'marcos/serie-vikingo.svg', null, true, true, 'series2', null, 760),
  ('marco-serie-elementos', 'frame', 'Cuatro elementos', 'Agua, tierra, fuego y aire girando.', 'marcos/serie-elementos.svg', null, true, true, 'series2', null, 770),
  ('marco-serie-robot', 'frame', 'Robot del futuro', 'Metal del año 3000 y luces que parpadean.', 'marcos/serie-robot.svg', null, true, true, 'series2', null, 780),
  ('marco-serie-fondo-mar', 'frame', 'Fondo de mar', 'Agua, burbujas y una casa con forma de fruta.', 'marcos/serie-fondo-mar.svg', null, true, true, 'series2', null, 790),
  ('marco-serie-isla', 'frame', 'La isla', 'Mar, arena y una palmera en medio de la nada.', 'marcos/serie-isla.svg', null, true, true, 'series2', null, 800),
  ('sticker-gg', 'sticker', 'GG', 'Buena partida.', 'stickers/gg.svg', null, false, false, 'cs', 150, 810),
  ('sticker-nice-shot', 'sticker', 'NICE SHOT', 'Para el tiro de la ronda.', 'stickers/nice-shot.svg', null, false, false, 'cs', 150, 820),
  ('sticker-rush-b', 'sticker', 'RUSH B', 'Sin estrategia, sin miedo.', 'stickers/rush-b.svg', null, false, false, 'cs', 150, 830),
  ('sticker-1hp', 'sticker', '1 HP', 'Vivo de milagro.', 'stickers/1hp.svg', null, false, false, 'cs', 150, 840),
  ('sticker-clutch', 'sticker', 'CLUTCH', 'Último en pie, ronda ganada.', 'stickers/clutch.svg', null, false, false, 'cs', 150, 850),
  ('sticker-nt', 'sticker', 'NT', 'Nice try, la próxima sale.', 'stickers/nt.svg', null, false, false, 'cs', 150, 860),
  ('sticker-eco', 'sticker', 'ECO', 'Ronda de ahorro.', 'stickers/eco.svg', null, false, false, 'cs', 150, 870),
  ('sticker-afk', 'sticker', 'AFK', 'Ya vuelvo.', 'stickers/afk.svg', null, false, false, 'cs', 150, 880),
  ('sticker-pais-ar', 'sticker', 'CHE', 'CHE con la bandera de Argentina.', 'stickers/pais-ar.svg', null, false, false, 'paises', 200, 890),
  ('sticker-pais-br', 'sticker', 'BORA!', 'BORA! con la bandera de Brasil.', 'stickers/pais-br.svg', null, false, false, 'paises', 200, 900),
  ('sticker-pais-uy', 'sticker', 'GARRA', 'GARRA con la bandera de Uruguay.', 'stickers/pais-uy.svg', null, false, false, 'paises', 200, 910),
  ('sticker-pais-cl', 'sticker', '¿CACHAI?', '¿CACHAI? con la bandera de Chile.', 'stickers/pais-cl.svg', null, false, false, 'paises', 200, 920),
  ('sticker-pais-pe', 'sticker', 'CAUSA', 'CAUSA con la bandera de Perú.', 'stickers/pais-pe.svg', null, false, false, 'paises', 200, 930),
  ('sticker-pais-co', 'sticker', 'PARCE', 'PARCE con la bandera de Colombia.', 'stickers/pais-co.svg', null, false, false, 'paises', 200, 940),
  ('sticker-pais-ve', 'sticker', 'CHAMO', 'CHAMO con la bandera de Venezuela.', 'stickers/pais-ve.svg', null, false, false, 'paises', 200, 950),
  ('sticker-pais-ec', 'sticker', 'PANA', 'PANA con la bandera de Ecuador.', 'stickers/pais-ec.svg', null, false, false, 'paises', 200, 960),
  ('sticker-pais-bo', 'sticker', 'JALLALLA', 'JALLALLA con la bandera de Bolivia.', 'stickers/pais-bo.svg', null, false, false, 'paises', 200, 970),
  ('sticker-pais-py', 'sticker', 'JAHA', 'JAHA con la bandera de Paraguay.', 'stickers/pais-py.svg', null, false, false, 'paises', 200, 980),
  ('sticker-pais-mx', 'sticker', 'CHIDO', 'CHIDO con la bandera de México.', 'stickers/pais-mx.svg', null, false, false, 'paises2', 200, 990),
  ('sticker-pais-cr', 'sticker', 'PURA VIDA', 'PURA VIDA con la bandera de Costa Rica.', 'stickers/pais-cr.svg', null, false, false, 'paises2', 200, 1000),
  ('sticker-pais-cu', 'sticker', 'ASERE', 'ASERE con la bandera de Cuba.', 'stickers/pais-cu.svg', null, false, false, 'paises2', 200, 1010),
  ('sticker-pais-do', 'sticker', 'KLK', 'KLK con la bandera de Rep. Dominicana.', 'stickers/pais-do.svg', null, false, false, 'paises2', 200, 1020),
  ('sticker-pais-pr', 'sticker', 'WEPA', 'WEPA con la bandera de Puerto Rico.', 'stickers/pais-pr.svg', null, false, false, 'paises2', 200, 1030),
  ('sticker-pais-pa', 'sticker', 'XOPA', 'XOPA con la bandera de Panamá.', 'stickers/pais-pa.svg', null, false, false, 'paises2', 200, 1040),
  ('sticker-pais-gt', 'sticker', 'CHILERO', 'CHILERO con la bandera de Guatemala.', 'stickers/pais-gt.svg', null, false, false, 'paises2', 200, 1050),
  ('sticker-pais-hn', 'sticker', 'CATRACHO', 'CATRACHO con la bandera de Honduras.', 'stickers/pais-hn.svg', null, false, false, 'paises2', 200, 1060),
  ('sticker-pais-sv', 'sticker', 'CHIVO', 'CHIVO con la bandera de El Salvador.', 'stickers/pais-sv.svg', null, false, false, 'paises2', 200, 1070),
  ('sticker-pais-es', 'sticker', 'MOLA', 'MOLA con la bandera de España.', 'stickers/pais-es.svg', null, false, false, 'paises2', 200, 1080),
  ('sticker-mapa-dust2', 'sticker', 'de_dust2 sitio A', 'El cartel del sitio A de de_dust2.', 'stickers/mapa-dust2.svg', null, false, false, 'mapas', 200, 1090),
  ('sticker-mapa-inferno', 'sticker', 'de_inferno sitio B', 'El cartel del sitio B de de_inferno.', 'stickers/mapa-inferno.svg', null, false, false, 'mapas', 200, 1100),
  ('sticker-mapa-nuke', 'sticker', 'de_nuke sitio A', 'El cartel del sitio A de de_nuke.', 'stickers/mapa-nuke.svg', null, false, false, 'mapas', 200, 1110),
  ('sticker-mapa-train', 'sticker', 'de_train sitio B', 'El cartel del sitio B de de_train.', 'stickers/mapa-train.svg', null, false, false, 'mapas', 200, 1120),
  ('sticker-mapa-office', 'sticker', 'cs_office sitio A', 'El cartel del sitio A de cs_office.', 'stickers/mapa-office.svg', null, false, false, 'mapas', 200, 1130),
  ('sticker-mapa-aztec', 'sticker', 'de_aztec sitio B', 'El cartel del sitio B de de_aztec.', 'stickers/mapa-aztec.svg', null, false, false, 'mapas', 200, 1140),
  ('sticker-mapa-cbble', 'sticker', 'de_cbble sitio A', 'El cartel del sitio A de de_cbble.', 'stickers/mapa-cbble.svg', null, false, false, 'mapas', 200, 1150),
  ('sticker-mapa-italy', 'sticker', 'cs_italy sitio B', 'El cartel del sitio B de cs_italy.', 'stickers/mapa-italy.svg', null, false, false, 'mapas', 200, 1160),
  ('sticker-mapa-piranesi', 'sticker', 'de_piranesi sitio A', 'El cartel del sitio A de de_piranesi.', 'stickers/mapa-piranesi.svg', null, false, false, 'mapas', 200, 1170),
  ('sticker-mapa-prodigy', 'sticker', 'de_prodigy sitio B', 'El cartel del sitio B de de_prodigy.', 'stickers/mapa-prodigy.svg', null, false, false, 'mapas', 200, 1180),
  ('sticker-ace', 'sticker', 'ACE', 'Cinco de cinco, con brillo.', 'stickers/ace.svg', null, true, true, 'cs', null, 1190),
  ('sticker-mvp', 'sticker', 'MVP', 'La corona de la partida.', 'stickers/mvp.svg', null, true, true, 'cs', null, 1200),
  ('sticker-headshot', 'sticker', 'HEADSHOT', 'Directo a la cabeza.', 'stickers/headshot.svg', null, true, true, 'cs', null, 1210),
  ('sticker-one-tap', 'sticker', 'ONE TAP', 'Una bala, una baja.', 'stickers/one-tap.svg', null, true, true, 'cs', null, 1220),
  ('sticker-defused', 'sticker', 'DEFUSED', 'Bomba desactivada en 0:00.', 'stickers/defused.svg', null, true, true, 'cs', null, 1230),
  ('sticker-1v5', 'sticker', '1v5', 'Solo contra todos.', 'stickers/1v5.svg', null, true, true, 'cs', null, 1240),
  ('sticker-wallbang', 'sticker', 'WALLBANG', 'A través de la pared.', 'stickers/wallbang.svg', null, true, true, 'cs', null, 1250),
  ('sticker-ninja', 'sticker', 'NINJA', 'Defuse sin que nadie lo vea.', 'stickers/ninja.svg', null, true, true, 'cs', null, 1260),
  ('sticker-serie-ninja', 'sticker', 'JUTSU!', 'Una nube de humo y un shuriken girando.', 'stickers/serie-ninja.svg', null, true, true, 'series', null, 1270),
  ('sticker-serie-guerrero', 'sticker', '+9000', 'El medidor de poder explotó.', 'stickers/serie-guerrero.svg', null, true, true, 'series', null, 1280),
  ('sticker-serie-alien', 'sticker', 'ALIEN', 'El dial verde listo para transformarte.', 'stickers/serie-alien.svg', null, true, true, 'series', null, 1290),
  ('sticker-serie-portal', 'sticker', 'PORTAL', 'Un portal girando: ¿a qué dimensión vas?', 'stickers/serie-portal.svg', null, true, true, 'series', null, 1300),
  ('sticker-serie-navaja', 'sticker', 'NAVAJA', 'La gorra de la banda, con filo.', 'stickers/serie-navaja.svg', null, true, true, 'series', null, 1310),
  ('sticker-serie-laboratorio', 'sticker', 'COCINANDO', 'Elementos Cs y Ss: la química del server.', 'stickers/serie-laboratorio.svg', null, true, true, 'series', null, 1320),
  ('sticker-serie-reves', 'sticker', 'CORRE', 'Las luces te avisan: corré.', 'stickers/serie-reves.svg', null, true, true, 'series', null, 1330),
  ('sticker-serie-reinos', 'sticker', 'EL TRONO', 'La corona del que manda en el server.', 'stickers/serie-reinos.svg', null, true, true, 'series', null, 1340),
  ('sticker-serie-atraco', 'sticker', 'ATRACO', 'Fajos de billetes que llueven.', 'stickers/serie-atraco.svg', null, true, true, 'series', null, 1350),
  ('sticker-serie-juego', 'sticker', 'ELIMINADO', 'Las tres figuras se encienden por turno.', 'stickers/serie-juego.svg', null, true, true, 'series', null, 1360),
  ('sticker-arma-ak', 'sticker', 'AK-47 Lava', 'La AK-47 con acabado Lava.', 'stickers/arma-ak.svg', null, true, true, 'arsenal', null, 1370),
  ('sticker-arma-m4', 'sticker', 'M4A1 Ártico', 'La M4A1 con acabado Ártico.', 'stickers/arma-m4.svg', null, true, true, 'arsenal', null, 1380),
  ('sticker-arma-awp', 'sticker', 'AWP Relámpago', 'La AWP con acabado Relámpago.', 'stickers/arma-awp.svg', null, true, true, 'arsenal', null, 1390),
  ('sticker-arma-deagle', 'sticker', 'Deagle Oro macizo', 'La DEAGLE con acabado Oro macizo.', 'stickers/arma-deagle.svg', null, true, true, 'arsenal', null, 1400),
  ('sticker-arma-scout', 'sticker', 'Scout Selva', 'La SCOUT con acabado Selva.', 'stickers/arma-scout.svg', null, true, true, 'arsenal', null, 1410),
  ('sticker-arma-usp', 'sticker', 'USP Medianoche', 'La USP con acabado Medianoche.', 'stickers/arma-usp.svg', null, true, true, 'arsenal', null, 1420),
  ('sticker-arma-glock', 'sticker', 'Glock Caramelo', 'La GLOCK con acabado Caramelo.', 'stickers/arma-glock.svg', null, true, true, 'arsenal', null, 1430),
  ('sticker-arma-mp5', 'sticker', 'MP5 Neón', 'La MP5 con acabado Neón.', 'stickers/arma-mp5.svg', null, true, true, 'arsenal', null, 1440),
  ('sticker-arma-cuchillo', 'sticker', 'Cuchillo Fantasma', 'La CUCHILLO con acabado Fantasma.', 'stickers/arma-cuchillo.svg', null, true, true, 'arsenal', null, 1450),
  ('sticker-arma-he', 'sticker', 'HE Arcoíris', 'La HE con acabado Arcoíris.', 'stickers/arma-he.svg', null, true, true, 'arsenal', null, 1460),
  ('sticker-serie-dona', 'sticker', 'DONA', 'DONA: el ícono de Dona glaseada flotando.', 'stickers/serie-dona.svg', null, true, true, 'series2', null, 1470),
  ('sticker-serie-zombi', 'sticker', 'ZOMBI', 'ZOMBI: el ícono de Apocalipsis zombi flotando.', 'stickers/serie-zombi.svg', null, true, true, 'series2', null, 1480),
  ('sticker-serie-barril', 'sticker', 'VECINDAD', 'VECINDAD: el ícono de La vecindad flotando.', 'stickers/serie-barril.svg', null, true, true, 'series2', null, 1490),
  ('sticker-serie-fuga', 'sticker', 'FUGA', 'FUGA: el ícono de La fuga flotando.', 'stickers/serie-fuga.svg', null, true, true, 'series2', null, 1500),
  ('sticker-serie-radiacion', 'sticker', 'REACTOR', 'REACTOR: el ícono de Reactor 4 flotando.', 'stickers/serie-radiacion.svg', null, true, true, 'series2', null, 1510),
  ('sticker-serie-vikingo', 'sticker', 'VALHALLA', 'VALHALLA: el ícono de Vikingo flotando.', 'stickers/serie-vikingo.svg', null, true, true, 'series2', null, 1520),
  ('sticker-serie-elementos', 'sticker', 'ELEMENTOS', 'ELEMENTOS: el ícono de Cuatro elementos flotando.', 'stickers/serie-elementos.svg', null, true, true, 'series2', null, 1530),
  ('sticker-serie-robot', 'sticker', 'BIP BUP', 'BIP BUP: el ícono de Robot del futuro flotando.', 'stickers/serie-robot.svg', null, true, true, 'series2', null, 1540),
  ('sticker-serie-fondo-mar', 'sticker', 'GLU GLU', 'GLU GLU: el ícono de Fondo de mar flotando.', 'stickers/serie-fondo-mar.svg', null, true, true, 'series2', null, 1550),
  ('sticker-serie-isla', 'sticker', 'LA ISLA', 'LA ISLA: el ícono de La isla flotando.', 'stickers/serie-isla.svg', null, true, true, 'series2', null, 1560),
  ('tema-terro', 'theme', 'Terrorista', 'Ocre y arena.', null, 'tema-terro', false, false, 'cs', 700, 1570),
  ('tema-anti', 'theme', 'Antiterrorista', 'Azul táctico.', null, 'tema-anti', false, false, 'cs', 700, 1580),
  ('tema-toxico', 'theme', 'Tóxico', 'Verde radiactivo.', null, 'tema-toxico', false, false, 'cs', 700, 1590),
  ('tema-hielo', 'theme', 'Hielo', 'Celeste helado.', null, 'tema-hielo', false, false, 'cs', 700, 1600),
  ('tema-carmesi', 'theme', 'Carmesí', 'Rojo intenso.', null, 'tema-carmesi', false, false, 'cs', 700, 1610),
  ('tema-camuflaje', 'theme', 'Camuflaje', 'Verde oliva militar.', null, 'tema-camuflaje', false, false, 'cs', 700, 1620),
  ('tema-atardecer', 'theme', 'Atardecer', 'Naranja cálido.', null, 'tema-atardecer', false, false, 'cs', 700, 1630),
  ('tema-grafito', 'theme', 'Grafito', 'Blanco y gris, minimalista.', null, 'tema-grafito', false, false, 'cs', 700, 1640),
  ('tema-pais-ar', 'theme', 'Argentina', 'Los colores de Argentina en todo el perfil.', null, 'tema-pais-ar', false, false, 'paises', 600, 1650),
  ('tema-pais-br', 'theme', 'Brasil', 'Los colores de Brasil en todo el perfil.', null, 'tema-pais-br', false, false, 'paises', 600, 1660),
  ('tema-pais-uy', 'theme', 'Uruguay', 'Los colores de Uruguay en todo el perfil.', null, 'tema-pais-uy', false, false, 'paises', 600, 1670),
  ('tema-pais-cl', 'theme', 'Chile', 'Los colores de Chile en todo el perfil.', null, 'tema-pais-cl', false, false, 'paises', 600, 1680),
  ('tema-pais-pe', 'theme', 'Perú', 'Los colores de Perú en todo el perfil.', null, 'tema-pais-pe', false, false, 'paises', 600, 1690),
  ('tema-pais-co', 'theme', 'Colombia', 'Los colores de Colombia en todo el perfil.', null, 'tema-pais-co', false, false, 'paises', 600, 1700),
  ('tema-pais-ve', 'theme', 'Venezuela', 'Los colores de Venezuela en todo el perfil.', null, 'tema-pais-ve', false, false, 'paises', 600, 1710),
  ('tema-pais-ec', 'theme', 'Ecuador', 'Los colores de Ecuador en todo el perfil.', null, 'tema-pais-ec', false, false, 'paises', 600, 1720),
  ('tema-pais-bo', 'theme', 'Bolivia', 'Los colores de Bolivia en todo el perfil.', null, 'tema-pais-bo', false, false, 'paises', 600, 1730),
  ('tema-pais-py', 'theme', 'Paraguay', 'Los colores de Paraguay en todo el perfil.', null, 'tema-pais-py', false, false, 'paises', 600, 1740),
  ('tema-pais-mx', 'theme', 'México', 'Los colores de México en todo el perfil.', null, 'tema-pais-mx', false, false, 'paises2', 600, 1750),
  ('tema-pais-cr', 'theme', 'Costa Rica', 'Los colores de Costa Rica en todo el perfil.', null, 'tema-pais-cr', false, false, 'paises2', 600, 1760),
  ('tema-pais-cu', 'theme', 'Cuba', 'Los colores de Cuba en todo el perfil.', null, 'tema-pais-cu', false, false, 'paises2', 600, 1770),
  ('tema-pais-do', 'theme', 'Rep. Dominicana', 'Los colores de Rep. Dominicana en todo el perfil.', null, 'tema-pais-do', false, false, 'paises2', 600, 1780),
  ('tema-pais-pr', 'theme', 'Puerto Rico', 'Los colores de Puerto Rico en todo el perfil.', null, 'tema-pais-pr', false, false, 'paises2', 600, 1790),
  ('tema-pais-pa', 'theme', 'Panamá', 'Los colores de Panamá en todo el perfil.', null, 'tema-pais-pa', false, false, 'paises2', 600, 1800),
  ('tema-pais-gt', 'theme', 'Guatemala', 'Los colores de Guatemala en todo el perfil.', null, 'tema-pais-gt', false, false, 'paises2', 600, 1810),
  ('tema-pais-hn', 'theme', 'Honduras', 'Los colores de Honduras en todo el perfil.', null, 'tema-pais-hn', false, false, 'paises2', 600, 1820),
  ('tema-pais-sv', 'theme', 'El Salvador', 'Los colores de El Salvador en todo el perfil.', null, 'tema-pais-sv', false, false, 'paises2', 600, 1830),
  ('tema-pais-es', 'theme', 'España', 'Los colores de España en todo el perfil.', null, 'tema-pais-es', false, false, 'paises2', 600, 1840),
  ('tema-mapa-dust2', 'theme', 'de_dust2', 'Los colores de de_dust2 en todo el perfil.', null, 'tema-mapa-dust2', false, false, 'mapas', 600, 1850),
  ('tema-mapa-inferno', 'theme', 'de_inferno', 'Los colores de de_inferno en todo el perfil.', null, 'tema-mapa-inferno', false, false, 'mapas', 600, 1860),
  ('tema-mapa-nuke', 'theme', 'de_nuke', 'Los colores de de_nuke en todo el perfil.', null, 'tema-mapa-nuke', false, false, 'mapas', 600, 1870),
  ('tema-mapa-train', 'theme', 'de_train', 'Los colores de de_train en todo el perfil.', null, 'tema-mapa-train', false, false, 'mapas', 600, 1880),
  ('tema-mapa-office', 'theme', 'cs_office', 'Los colores de cs_office en todo el perfil.', null, 'tema-mapa-office', false, false, 'mapas', 600, 1890),
  ('tema-mapa-aztec', 'theme', 'de_aztec', 'Los colores de de_aztec en todo el perfil.', null, 'tema-mapa-aztec', false, false, 'mapas', 600, 1900),
  ('tema-mapa-cbble', 'theme', 'de_cbble', 'Los colores de de_cbble en todo el perfil.', null, 'tema-mapa-cbble', false, false, 'mapas', 600, 1910),
  ('tema-mapa-italy', 'theme', 'cs_italy', 'Los colores de cs_italy en todo el perfil.', null, 'tema-mapa-italy', false, false, 'mapas', 600, 1920),
  ('tema-mapa-piranesi', 'theme', 'de_piranesi', 'Los colores de de_piranesi en todo el perfil.', null, 'tema-mapa-piranesi', false, false, 'mapas', 600, 1930),
  ('tema-mapa-prodigy', 'theme', 'de_prodigy', 'Los colores de de_prodigy en todo el perfil.', null, 'tema-mapa-prodigy', false, false, 'mapas', 600, 1940),
  ('tema-oro', 'theme', 'Oro VIP', 'Dorado con resplandor.', null, 'tema-oro', true, false, 'cs', null, 1950),
  ('tema-obsidiana', 'theme', 'Obsidiana', 'Negro y violeta con resplandor.', null, 'tema-obsidiana', true, false, 'cs', null, 1960),
  ('tema-diamante', 'theme', 'Diamante', 'Celeste cristal con resplandor.', null, 'tema-diamante', true, false, 'cs', null, 1970),
  ('tema-synthwave', 'theme', 'Synthwave', 'Rosa y violeta retro con resplandor.', null, 'tema-synthwave', true, false, 'cs', null, 1980),
  ('tema-holo', 'theme', 'Holográfico', 'El borde cambia de color.', null, 'tema-holo', true, true, 'cs', null, 1990),
  ('tema-esmeralda', 'theme', 'Esmeralda', 'Verde joya con resplandor.', null, 'tema-esmeralda', true, false, 'cs', null, 2000),
  ('tema-rubi', 'theme', 'Rubí', 'Rojo joya con resplandor.', null, 'tema-rubi', true, false, 'cs', null, 2010),
  ('tema-aurora', 'theme', 'Aurora', 'El borde pasa de verde a violeta.', null, 'tema-aurora', true, true, 'cs', null, 2020),
  ('tema-serie-ninja', 'theme', 'Shinobi', 'Los colores de Shinobi con un borde que brilla.', null, 'tema-serie-ninja', true, true, 'series', null, 2030),
  ('tema-serie-guerrero', 'theme', 'Súper guerrero', 'Los colores de Súper guerrero con un borde que brilla.', null, 'tema-serie-guerrero', true, true, 'series', null, 2040),
  ('tema-serie-alien', 'theme', 'Reloj alien', 'Los colores de Reloj alien con un borde que brilla.', null, 'tema-serie-alien', true, true, 'series', null, 2050),
  ('tema-serie-portal', 'theme', 'Portal', 'Los colores de Portal con un borde que brilla.', null, 'tema-serie-portal', true, true, 'series', null, 2060),
  ('tema-serie-navaja', 'theme', 'Gorra y navaja', 'Los colores de Gorra y navaja con un borde que brilla.', null, 'tema-serie-navaja', true, true, 'series', null, 2070),
  ('tema-serie-laboratorio', 'theme', 'Laboratorio', 'Los colores de Laboratorio con un borde que brilla.', null, 'tema-serie-laboratorio', true, true, 'series', null, 2080),
  ('tema-serie-reves', 'theme', 'Mundo del revés', 'Los colores de Mundo del revés con un borde que brilla.', null, 'tema-serie-reves', true, true, 'series', null, 2090),
  ('tema-serie-reinos', 'theme', 'Reinos', 'Los colores de Reinos con un borde que brilla.', null, 'tema-serie-reinos', true, true, 'series', null, 2100),
  ('tema-serie-atraco', 'theme', 'Atraco', 'Los colores de Atraco con un borde que brilla.', null, 'tema-serie-atraco', true, true, 'series', null, 2110),
  ('tema-serie-juego', 'theme', 'Juego mortal', 'Los colores de Juego mortal con un borde que brilla.', null, 'tema-serie-juego', true, true, 'series', null, 2120),
  ('tema-arma-ak', 'theme', 'Lava', 'Los colores del acabado Lava con un borde que brilla.', null, 'tema-arma-ak', true, true, 'arsenal', null, 2130),
  ('tema-arma-m4', 'theme', 'Ártico', 'Los colores del acabado Ártico con un borde que brilla.', null, 'tema-arma-m4', true, true, 'arsenal', null, 2140),
  ('tema-arma-awp', 'theme', 'Relámpago', 'Los colores del acabado Relámpago con un borde que brilla.', null, 'tema-arma-awp', true, true, 'arsenal', null, 2150),
  ('tema-arma-deagle', 'theme', 'Oro macizo', 'Los colores del acabado Oro macizo con un borde que brilla.', null, 'tema-arma-deagle', true, true, 'arsenal', null, 2160),
  ('tema-arma-scout', 'theme', 'Selva', 'Los colores del acabado Selva con un borde que brilla.', null, 'tema-arma-scout', true, true, 'arsenal', null, 2170),
  ('tema-arma-usp', 'theme', 'Medianoche', 'Los colores del acabado Medianoche con un borde que brilla.', null, 'tema-arma-usp', true, true, 'arsenal', null, 2180),
  ('tema-arma-glock', 'theme', 'Caramelo', 'Los colores del acabado Caramelo con un borde que brilla.', null, 'tema-arma-glock', true, true, 'arsenal', null, 2190),
  ('tema-arma-mp5', 'theme', 'Neón', 'Los colores del acabado Neón con un borde que brilla.', null, 'tema-arma-mp5', true, true, 'arsenal', null, 2200),
  ('tema-arma-cuchillo', 'theme', 'Fantasma', 'Los colores del acabado Fantasma con un borde que brilla.', null, 'tema-arma-cuchillo', true, true, 'arsenal', null, 2210),
  ('tema-arma-he', 'theme', 'Arcoíris', 'Los colores del acabado Arcoíris con un borde que brilla.', null, 'tema-arma-he', true, true, 'arsenal', null, 2220),
  ('tema-serie-dona', 'theme', 'Dona glaseada', 'Los colores de Dona glaseada con un borde que brilla.', null, 'tema-serie-dona', true, true, 'series2', null, 2230),
  ('tema-serie-zombi', 'theme', 'Apocalipsis zombi', 'Los colores de Apocalipsis zombi con un borde que brilla.', null, 'tema-serie-zombi', true, true, 'series2', null, 2240),
  ('tema-serie-barril', 'theme', 'La vecindad', 'Los colores de La vecindad con un borde que brilla.', null, 'tema-serie-barril', true, true, 'series2', null, 2250),
  ('tema-serie-fuga', 'theme', 'La fuga', 'Los colores de La fuga con un borde que brilla.', null, 'tema-serie-fuga', true, true, 'series2', null, 2260),
  ('tema-serie-radiacion', 'theme', 'Reactor 4', 'Los colores de Reactor 4 con un borde que brilla.', null, 'tema-serie-radiacion', true, true, 'series2', null, 2270),
  ('tema-serie-vikingo', 'theme', 'Vikingo', 'Los colores de Vikingo con un borde que brilla.', null, 'tema-serie-vikingo', true, true, 'series2', null, 2280),
  ('tema-serie-elementos', 'theme', 'Cuatro elementos', 'Los colores de Cuatro elementos con un borde que brilla.', null, 'tema-serie-elementos', true, true, 'series2', null, 2290),
  ('tema-serie-robot', 'theme', 'Robot del futuro', 'Los colores de Robot del futuro con un borde que brilla.', null, 'tema-serie-robot', true, true, 'series2', null, 2300),
  ('tema-serie-fondo-mar', 'theme', 'Fondo de mar', 'Los colores de Fondo de mar con un borde que brilla.', null, 'tema-serie-fondo-mar', true, true, 'series2', null, 2310),
  ('tema-serie-isla', 'theme', 'La isla', 'Los colores de La isla con un borde que brilla.', null, 'tema-serie-isla', true, true, 'series2', null, 2320),
  ('nombre-brillo', 'name', 'Brillo', 'Un destello recorre tu nombre.', null, 'nombre-brillo', false, true, 'cs', 600, 2330),
  ('nombre-glitch', 'name', 'Glitch', 'Tu nombre falla cada tanto, a propósito.', null, 'nombre-glitch', false, true, 'cs', 600, 2340),
  ('nombre-neon', 'name', 'Neón', 'Letrero luminoso que parpadea.', null, 'nombre-neon', false, true, 'cs', 600, 2350),
  ('nombre-retro', 'name', 'Retro', 'Sombra en capas de los 80.', null, 'nombre-retro', false, false, 'cs', 500, 2360),
  ('nombre-contorno', 'name', 'Contorno', 'Solo el borde de las letras.', null, 'nombre-contorno', false, false, 'cs', 500, 2370),
  ('nombre-sombra', 'name', 'Sombra', 'Sombra larga detrás de las letras.', null, 'nombre-sombra', false, false, 'cs', 500, 2380),
  ('nombre-hielo', 'name', 'Hielo', 'Letras congeladas.', null, 'nombre-hielo', false, false, 'cs', 500, 2390),
  ('nombre-pixel', 'name', 'Píxel', 'Letras de 8 bits con desfase de color.', null, 'nombre-pixel', false, false, 'cs', 500, 2400),
  ('nombre-pais-ar', 'name', 'Argentina', 'Tu nombre con las franjas de la bandera de Argentina.', null, 'nombre-pais-ar', false, false, 'paises', 400, 2410),
  ('nombre-pais-br', 'name', 'Brasil', 'Tu nombre con las franjas de la bandera de Brasil.', null, 'nombre-pais-br', false, false, 'paises', 400, 2420),
  ('nombre-pais-uy', 'name', 'Uruguay', 'Tu nombre con las franjas de la bandera de Uruguay.', null, 'nombre-pais-uy', false, false, 'paises', 400, 2430),
  ('nombre-pais-cl', 'name', 'Chile', 'Tu nombre con las franjas de la bandera de Chile.', null, 'nombre-pais-cl', false, false, 'paises', 400, 2440),
  ('nombre-pais-pe', 'name', 'Perú', 'Tu nombre con las franjas de la bandera de Perú.', null, 'nombre-pais-pe', false, false, 'paises', 400, 2450),
  ('nombre-pais-co', 'name', 'Colombia', 'Tu nombre con las franjas de la bandera de Colombia.', null, 'nombre-pais-co', false, false, 'paises', 400, 2460),
  ('nombre-pais-ve', 'name', 'Venezuela', 'Tu nombre con las franjas de la bandera de Venezuela.', null, 'nombre-pais-ve', false, false, 'paises', 400, 2470),
  ('nombre-pais-ec', 'name', 'Ecuador', 'Tu nombre con las franjas de la bandera de Ecuador.', null, 'nombre-pais-ec', false, false, 'paises', 400, 2480),
  ('nombre-pais-bo', 'name', 'Bolivia', 'Tu nombre con las franjas de la bandera de Bolivia.', null, 'nombre-pais-bo', false, false, 'paises', 400, 2490),
  ('nombre-pais-py', 'name', 'Paraguay', 'Tu nombre con las franjas de la bandera de Paraguay.', null, 'nombre-pais-py', false, false, 'paises', 400, 2500),
  ('nombre-pais-mx', 'name', 'México', 'Tu nombre con las franjas de la bandera de México.', null, 'nombre-pais-mx', false, false, 'paises2', 400, 2510),
  ('nombre-pais-cr', 'name', 'Costa Rica', 'Tu nombre con las franjas de la bandera de Costa Rica.', null, 'nombre-pais-cr', false, false, 'paises2', 400, 2520),
  ('nombre-pais-cu', 'name', 'Cuba', 'Tu nombre con las franjas de la bandera de Cuba.', null, 'nombre-pais-cu', false, false, 'paises2', 400, 2530),
  ('nombre-pais-do', 'name', 'Rep. Dominicana', 'Tu nombre con las franjas de la bandera de Rep. Dominicana.', null, 'nombre-pais-do', false, false, 'paises2', 400, 2540),
  ('nombre-pais-pr', 'name', 'Puerto Rico', 'Tu nombre con las franjas de la bandera de Puerto Rico.', null, 'nombre-pais-pr', false, false, 'paises2', 400, 2550),
  ('nombre-pais-pa', 'name', 'Panamá', 'Tu nombre con las franjas de la bandera de Panamá.', null, 'nombre-pais-pa', false, false, 'paises2', 400, 2560),
  ('nombre-pais-gt', 'name', 'Guatemala', 'Tu nombre con las franjas de la bandera de Guatemala.', null, 'nombre-pais-gt', false, false, 'paises2', 400, 2570),
  ('nombre-pais-hn', 'name', 'Honduras', 'Tu nombre con las franjas de la bandera de Honduras.', null, 'nombre-pais-hn', false, false, 'paises2', 400, 2580),
  ('nombre-pais-sv', 'name', 'El Salvador', 'Tu nombre con las franjas de la bandera de El Salvador.', null, 'nombre-pais-sv', false, false, 'paises2', 400, 2590),
  ('nombre-pais-es', 'name', 'España', 'Tu nombre con las franjas de la bandera de España.', null, 'nombre-pais-es', false, false, 'paises2', 400, 2600),
  ('nombre-mapa-dust2', 'name', 'de_dust2', 'Tu nombre con los colores de de_dust2.', null, 'nombre-mapa-dust2', false, false, 'mapas', 400, 2610),
  ('nombre-mapa-inferno', 'name', 'de_inferno', 'Tu nombre con los colores de de_inferno.', null, 'nombre-mapa-inferno', false, false, 'mapas', 400, 2620),
  ('nombre-mapa-nuke', 'name', 'de_nuke', 'Tu nombre con los colores de de_nuke.', null, 'nombre-mapa-nuke', false, false, 'mapas', 400, 2630),
  ('nombre-mapa-train', 'name', 'de_train', 'Tu nombre con los colores de de_train.', null, 'nombre-mapa-train', false, false, 'mapas', 400, 2640),
  ('nombre-mapa-office', 'name', 'cs_office', 'Tu nombre con los colores de cs_office.', null, 'nombre-mapa-office', false, false, 'mapas', 400, 2650),
  ('nombre-mapa-aztec', 'name', 'de_aztec', 'Tu nombre con los colores de de_aztec.', null, 'nombre-mapa-aztec', false, false, 'mapas', 400, 2660),
  ('nombre-mapa-cbble', 'name', 'de_cbble', 'Tu nombre con los colores de de_cbble.', null, 'nombre-mapa-cbble', false, false, 'mapas', 400, 2670),
  ('nombre-mapa-italy', 'name', 'cs_italy', 'Tu nombre con los colores de cs_italy.', null, 'nombre-mapa-italy', false, false, 'mapas', 400, 2680),
  ('nombre-mapa-piranesi', 'name', 'de_piranesi', 'Tu nombre con los colores de de_piranesi.', null, 'nombre-mapa-piranesi', false, false, 'mapas', 400, 2690),
  ('nombre-mapa-prodigy', 'name', 'de_prodigy', 'Tu nombre con los colores de de_prodigy.', null, 'nombre-mapa-prodigy', false, false, 'mapas', 400, 2700),
  ('nombre-arcoiris', 'name', 'Arcoíris', 'Todos los colores, en movimiento.', null, 'nombre-arcoiris', true, true, 'cs', null, 2710),
  ('nombre-oro', 'name', 'Oro', 'Dorado con destello.', null, 'nombre-oro', true, true, 'cs', null, 2720),
  ('nombre-fuego', 'name', 'Fuego', 'Tu nombre en llamas.', null, 'nombre-fuego', true, true, 'cs', null, 2730),
  ('nombre-holografico', 'name', 'Holográfico', 'Cambia de color según la luz.', null, 'nombre-holografico', true, true, 'cs', null, 2740),
  ('nombre-galaxia', 'name', 'Galaxia', 'Estrellas que viajan por las letras.', null, 'nombre-galaxia', true, true, 'cs', null, 2750),
  ('nombre-plasma', 'name', 'Plasma', 'Brillo eléctrico que titila.', null, 'nombre-plasma', true, true, 'cs', null, 2760),
  ('nombre-esmeralda', 'name', 'Esmeralda', 'Verde joya con destello.', null, 'nombre-esmeralda', true, true, 'cs', null, 2770),
  ('nombre-cromo', 'name', 'Cromo', 'Metal pulido con reflejo.', null, 'nombre-cromo', true, true, 'cs', null, 2780),
  ('nombre-chakra', 'name', 'Chakra', 'Energía azul que corre por las letras.', null, 'nombre-chakra', true, true, 'series', null, 2790),
  ('nombre-ki', 'name', 'Ki', 'Aura dorada que tiembla de poder.', null, 'nombre-ki', true, true, 'series', null, 2800),
  ('nombre-mutante', 'name', 'Mutante', 'Brillo verde que late.', null, 'nombre-mutante', true, true, 'series', null, 2810),
  ('nombre-portal', 'name', 'Portal', 'Verde interdimensional que fluye.', null, 'nombre-portal', true, true, 'series', null, 2820),
  ('nombre-whisky', 'name', 'Whisky 1919', 'Letra de época color ámbar.', null, 'nombre-whisky', true, true, 'series', null, 2830),
  ('nombre-cristal', 'name', 'Cristal azul', 'Azul cristalino que destella.', null, 'nombre-cristal', true, true, 'series', null, 2840),
  ('nombre-ochentoso', 'name', 'Ochentoso', 'Letras rojas de los 80 que titilan.', null, 'nombre-ochentoso', true, true, 'series', null, 2850),
  ('nombre-acero', 'name', 'Acero antiguo', 'Acero forjado con vetas que se mueven.', null, 'nombre-acero', true, true, 'series', null, 2860),
  ('nombre-billete', 'name', 'Billete', 'Verde billete recién impreso.', null, 'nombre-billete', true, true, 'series', null, 2870),
  ('nombre-luz-roja', 'name', 'Luz roja, luz verde', 'Cambia de rojo a verde: no te muevas.', null, 'nombre-luz-roja', true, true, 'series', null, 2880),
  ('nombre-arma-ak', 'name', 'Lava', 'Tu nombre con el acabado Lava.', null, 'nombre-arma-ak', true, true, 'arsenal', null, 2890),
  ('nombre-arma-m4', 'name', 'Ártico', 'Tu nombre con el acabado Ártico.', null, 'nombre-arma-m4', true, true, 'arsenal', null, 2900),
  ('nombre-arma-awp', 'name', 'Relámpago', 'Tu nombre con el acabado Relámpago.', null, 'nombre-arma-awp', true, true, 'arsenal', null, 2910),
  ('nombre-arma-deagle', 'name', 'Oro macizo', 'Tu nombre con el acabado Oro macizo.', null, 'nombre-arma-deagle', true, true, 'arsenal', null, 2920),
  ('nombre-arma-scout', 'name', 'Selva', 'Tu nombre con el acabado Selva.', null, 'nombre-arma-scout', true, true, 'arsenal', null, 2930),
  ('nombre-arma-usp', 'name', 'Medianoche', 'Tu nombre con el acabado Medianoche.', null, 'nombre-arma-usp', true, true, 'arsenal', null, 2940),
  ('nombre-arma-glock', 'name', 'Caramelo', 'Tu nombre con el acabado Caramelo.', null, 'nombre-arma-glock', true, true, 'arsenal', null, 2950),
  ('nombre-arma-mp5', 'name', 'Neón', 'Tu nombre con el acabado Neón.', null, 'nombre-arma-mp5', true, true, 'arsenal', null, 2960),
  ('nombre-arma-cuchillo', 'name', 'Fantasma', 'Tu nombre con el acabado Fantasma.', null, 'nombre-arma-cuchillo', true, true, 'arsenal', null, 2970),
  ('nombre-arma-he', 'name', 'Arcoíris', 'Tu nombre con el acabado Arcoíris.', null, 'nombre-arma-he', true, true, 'arsenal', null, 2980),
  ('nombre-dona', 'name', 'Glaseado', 'Efecto Glaseado, de la colección Dona glaseada.', null, 'nombre-dona', true, true, 'series2', null, 2990),
  ('nombre-zombi', 'name', 'Podrido', 'Efecto Podrido, de la colección Apocalipsis zombi.', null, 'nombre-zombi', true, true, 'series2', null, 3000),
  ('nombre-barril', 'name', 'Barril', 'Efecto Barril, de la colección La vecindad.', null, 'nombre-barril', true, true, 'series2', null, 3010),
  ('nombre-fuga', 'name', 'Tatuaje', 'Efecto Tatuaje, de la colección La fuga.', null, 'nombre-fuga', true, true, 'series2', null, 3020),
  ('nombre-radiacion', 'name', 'Radiactivo', 'Efecto Radiactivo, de la colección Reactor 4.', null, 'nombre-radiacion', true, true, 'series2', null, 3030),
  ('nombre-vikingo', 'name', 'Rúnico', 'Efecto Rúnico, de la colección Vikingo.', null, 'nombre-vikingo', true, true, 'series2', null, 3040),
  ('nombre-elementos', 'name', 'Elemental', 'Efecto Elemental, de la colección Cuatro elementos.', null, 'nombre-elementos', true, true, 'series2', null, 3050),
  ('nombre-robot', 'name', 'Binario', 'Efecto Binario, de la colección Robot del futuro.', null, 'nombre-robot', true, true, 'series2', null, 3060),
  ('nombre-fondo-mar', 'name', 'Burbujas', 'Efecto Burbujas, de la colección Fondo de mar.', null, 'nombre-fondo-mar', true, true, 'series2', null, 3070),
  ('nombre-isla', 'name', 'Tropical', 'Efecto Tropical, de la colección La isla.', null, 'nombre-isla', true, true, 'series2', null, 3080)
on conflict (id) do update set kind = excluded.kind, name = excluded.name, description = excluded.description,
  file = excluded.file, css_class = excluded.css_class, vip_only = excluded.vip_only, animated = excluded.animated,
  collection = excluded.collection, sort = excluded.sort,
  price = case when excluded.vip_only then null else shop_items.price end;
-- --- fin: catálogo generado ---

commit;
