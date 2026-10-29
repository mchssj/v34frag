-- =============================================================================
-- Progresión VIP con moneda propia
--
-- Plan: docs/bitacora/2026-10-29-vip-progresion/PLAN.md. Necesita 20261029180000_tienda.sql y
-- 20261029200000_fondo_miniperfil.sql.
-- - Ser VIP desbloquea solo el Marco Oro VIP (shop_items.vip_reward). El resto de lo VIP se compra con
--   monedas VIP (shop_items.vip_price).
-- - Las monedas VIP se ganan como los puntos (vip_per_mix + vip_per_win), solo en los mixes jugados
--   siendo VIP (was_vip a la fecha del mix). No se anotan: se calculan.
-- - VIP vencido: lo VIP comprado y el saldo quedan congelados hasta que vuelva a ser VIP.
-- - Los puntos normales ya no llevan ×VIP: vip_multiplier = 1 (queda configurable).
-- - user_items.currency y point_grants.currency separan puntos de monedas VIP.
-- Re-ejecutable.
-- =============================================================================

begin;

-- ---------- Configuración ----------
alter table public.points_config
  add column if not exists vip_per_mix int not null default 10 check (vip_per_mix between 0 and 1000),
  add column if not exists vip_per_win int not null default 5 check (vip_per_win between 0 and 1000);
alter table public.points_config alter column vip_multiplier set default 1;
update public.points_config set vip_multiplier = 1 where id = 1;

-- ---------- Catálogo ----------
alter table public.shop_items
  add column if not exists vip_price int check (vip_price between 1 and 1000000),
  add column if not exists vip_reward boolean not null default false;
do $$ begin
  alter table public.shop_items add constraint shop_items_vip_price_solo_vip check (vip_only or vip_price is null);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.shop_items add constraint shop_items_reward_vip check (not vip_reward or (vip_only and vip_price is null));
exception when duplicate_object then null; end $$;

-- ---------- Moneda de cada movimiento ----------
alter table public.user_items add column if not exists currency text not null default 'points';
alter table public.point_grants add column if not exists currency text not null default 'points';
do $$ begin
  alter table public.user_items add constraint user_items_currency_check check (currency in ('points', 'vip'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.point_grants add constraint point_grants_currency_check check (currency in ('points', 'vip'));
exception when duplicate_object then null; end $$;

-- ---------- Puntos (solo la moneda normal) ----------
create or replace function public.points_of(p_user uuid)
  returns table (earned int, granted int, spent int, balance int, mixes int)
  language sql stable security definer set search_path = public as $$
  with e as (select coalesce(sum(points), 0)::int pts, count(*)::int n from points_mixes_of(p_user)),
       g as (select coalesce(sum(amount), 0)::int pts from point_grants where user_id = p_user and currency = 'points'),
       s as (select coalesce(sum(price_paid), 0)::int pts from user_items
              where user_id = p_user and source = 'purchase' and currency = 'points')
  select e.pts, g.pts, s.pts, e.pts + g.pts - s.pts, e.n from e, g, s
$$;
revoke all on function public.points_of(uuid) from public, anon, authenticated;

-- El historial de puntos, sin lo de monedas VIP (eso va en my_vip_coins_history).
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
    select 'grant', g.created_at, g.amount, g.reason, false from point_grants g
     where g.user_id = p_user and g.currency = 'points'
    union all
    select 'purchase', u.acquired_at, -u.price_paid, i.name, false
      from user_items u join shop_items i on i.id = u.item_id
     where u.user_id = p_user and u.source = 'purchase' and u.currency = 'points'
  ) h order by 2 desc nulls last limit least(greatest(coalesce(p_limit, 50), 1), 500);
end $$;

-- ---------- Monedas VIP ----------
-- Los mixes que dan monedas VIP: los mismos que dan puntos, solo los jugados siendo VIP. Interna.
create or replace function public.vip_coins_mixes_of(p_user uuid)
  returns table (match_id uuid, played_at timestamptz, map text, won boolean, coins int)
  language sql stable security definer set search_path = public as $$
  select x.match_id, x.played_at, x.map, x.won,
         (c.vip_per_mix + case when x.won then c.vip_per_win else 0 end)::int
    from points_mixes_of(p_user) x
    cross join points_config c
   where c.id = 1 and x.vip
$$;
revoke all on function public.vip_coins_mixes_of(uuid) from public, anon, authenticated;

create or replace function public.vip_coins_of(p_user uuid)
  returns table (earned int, granted int, spent int, balance int, mixes int)
  language sql stable security definer set search_path = public as $$
  with e as (select coalesce(sum(coins), 0)::int n, count(*)::int m from vip_coins_mixes_of(p_user)),
       g as (select coalesce(sum(amount), 0)::int n from point_grants where user_id = p_user and currency = 'vip'),
       s as (select coalesce(sum(price_paid), 0)::int n from user_items
              where user_id = p_user and source = 'purchase' and currency = 'vip')
  select e.n, g.n, s.n, e.n + g.n - s.n, e.m from e, g, s
$$;
revoke all on function public.vip_coins_of(uuid) from public, anon, authenticated;

-- Mis monedas VIP (y si soy VIP hoy: si no, están congeladas).
create or replace function public.my_vip_coins()
  returns table (earned int, granted int, spent int, balance int, mixes int, vip boolean)
  language sql stable security definer set search_path = public as $$
  select c.earned, c.granted, c.spent, c.balance, c.mixes, is_vip(auth.uid())
    from vip_coins_of(auth.uid()) c where auth.uid() is not null
$$;

create or replace function public.my_vip_coins_history(p_user uuid default auth.uid(), p_limit int default 50)
  returns table (kind text, at timestamptz, coins int, label text)
  language plpgsql stable security definer set search_path = public as $$
begin
  if p_user is null or (p_user <> auth.uid() and not is_admin()) then
    raise exception 'No podés ver las monedas de otra cuenta' using errcode = '42501';
  end if;
  return query
  select * from (
    select 'mix'::text, x.played_at, x.coins, coalesce(x.map, 'Mix') || case when x.won then ' · victoria' else '' end
      from vip_coins_mixes_of(p_user) x
    union all
    select 'grant', g.created_at, g.amount, g.reason from point_grants g where g.user_id = p_user and g.currency = 'vip'
    union all
    select 'purchase', u.acquired_at, -u.price_paid, i.name
      from user_items u join shop_items i on i.id = u.item_id
     where u.user_id = p_user and u.source = 'purchase' and u.currency = 'vip'
  ) h order by 2 desc nulls last limit least(greatest(coalesce(p_limit, 50), 1), 500);
end $$;
revoke all on function public.my_vip_coins(), public.my_vip_coins_history(uuid, int) from public, anon;
grant execute on function public.my_vip_coins(), public.my_vip_coins_history(uuid, int) to authenticated, service_role;

-- ---------- Quién puede usar qué ----------
-- El premio VIP, mientras sea VIP. Lo demás, si lo tiene; lo VIP, además, solo mientras sea VIP.
create or replace function public.can_use_item(p_user uuid, p_item text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_items i where i.id = p_item
                   and case when i.vip_reward then is_vip(p_user)
                            else exists (select 1 from user_items u where u.user_id = p_user and u.item_id = i.id)
                                 and (not i.vip_only or is_vip(p_user)) end)
$$;
revoke all on function public.can_use_item(uuid, text) from public;
grant execute on function public.can_use_item(uuid, text) to anon, authenticated, service_role;

-- ---------- Catálogo con precio de hoy ----------
-- Las columnas nuevas van al final: create or replace view no deja cambiar el orden de las que ya están.
create or replace view public.shop_catalog as
select i.id, i.kind, i.name, i.description, i.file, i.css_class, i.vip_only, i.animated, i.collection,
       i.price as base_price,
       case when i.price is null then null
            when w.id is not null then greatest(1, round(i.price * (100 - c.weekly_discount) / 100.0)::int)
            else i.price end as price,
       w.id is not null as weekly,
       (date_trunc('week', now() at time zone 'America/Bogota') + interval '7 days') at time zone 'America/Bogota' as weekly_ends,
       i.sort, i.vip_price, i.vip_reward
  from shop_items i
  cross join points_config c
  left join shop_weekly() w(id) on w.id = i.id
 where i.active and c.id = 1;
grant select on public.shop_catalog to anon, authenticated;

-- ---------- Comprar ----------
-- Lo normal, con puntos. Lo VIP, con monedas VIP y siendo VIP hoy. Devuelve precio, moneda y saldo nuevo.
create or replace function public.shop_buy(p_item text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_price int; v_bal int; i shop_items;
begin
  if v_uid is null then raise exception 'Iniciá sesión para comprar' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));
  select * into i from shop_items where id = p_item;
  if not found or not i.active then raise exception 'Ese artículo no está en la tienda'; end if;
  if i.vip_reward then raise exception 'Ese artículo viene con el VIP: no se compra'; end if;
  if exists (select 1 from user_items where user_id = v_uid and item_id = p_item) then raise exception 'Ya lo tenés'; end if;
  if i.vip_only then
    if not is_vip(v_uid) then raise exception 'Los artículos VIP se compran siendo VIP'; end if;
    if i.vip_price is null then raise exception 'Ese artículo no está a la venta'; end if;
    v_price := i.vip_price;
    select balance into v_bal from vip_coins_of(v_uid);
    if v_bal < v_price then raise exception 'Te faltan % monedas VIP', v_price - v_bal; end if;
    insert into user_items (user_id, item_id, source, price_paid, currency) values (v_uid, p_item, 'purchase', v_price, 'vip');
    return jsonb_build_object('item', p_item, 'price_paid', v_price, 'currency', 'vip', 'balance', v_bal - v_price);
  end if;
  if i.price is null then raise exception 'Ese artículo no está a la venta'; end if;
  select price into v_price from shop_catalog where id = p_item;
  select balance into v_bal from points_of(v_uid);
  if v_bal < v_price then raise exception 'Te faltan % puntos', v_price - v_bal; end if;
  insert into user_items (user_id, item_id, source, price_paid) values (v_uid, p_item, 'purchase', v_price);
  return jsonb_build_object('item', p_item, 'price_paid', v_price, 'currency', 'points', 'balance', v_bal - v_price);
end $$;
revoke all on function public.shop_buy(text) from public, anon;
grant execute on function public.shop_buy(text) to authenticated, service_role;

-- ---------- Admin ----------
create or replace function public.admin_vip_coins_grant(p_user uuid, p_amount int, p_reason text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception 'Solo un administrador puede dar monedas VIP' using errcode = '42501'; end if;
  if coalesce(p_amount, 0) = 0 then raise exception 'La cantidad no puede ser 0'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No existe ese usuario'; end if;
  insert into point_grants (user_id, amount, reason, granted_by, currency)
  values (p_user, p_amount, btrim(p_reason), auth.uid(), 'vip') returning id into v_id;
  return v_id;
end $$;

-- Regalar un artículo, también uno VIP (se usa mientras la cuenta sea VIP). El premio VIP no se regala.
create or replace function public.admin_item_grant(p_user uuid, p_item text, p_note text default null) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede regalar artículos' using errcode = '42501'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'No existe ese usuario'; end if;
  if not exists (select 1 from shop_items where id = p_item) then raise exception 'No existe ese artículo'; end if;
  if exists (select 1 from shop_items where id = p_item and vip_reward) then raise exception 'Ese artículo viene con el VIP: dale VIP a la cuenta'; end if;
  if char_length(p_note) > 200 then raise exception 'La nota puede tener hasta 200 caracteres'; end if;
  insert into user_items (user_id, item_id, source, granted_by, note) values (p_user, p_item, 'grant', auth.uid(), nullif(btrim(p_note), ''))
  on conflict (user_id, item_id) do nothing;
  if not found then raise exception 'Ya lo tiene'; end if;
end $$;

-- Precio en monedas VIP de un artículo VIP. null lo saca de la venta.
create or replace function public.admin_shop_item_vip_price(p_item text, p_vip_price int) returns void
  language plpgsql security definer set search_path = public as $$
declare i shop_items;
begin
  if not is_admin() then raise exception 'Solo un administrador puede editar la tienda' using errcode = '42501'; end if;
  select * into i from shop_items where id = p_item;
  if not found then raise exception 'No existe ese artículo'; end if;
  if not i.vip_only then raise exception 'Solo los artículos VIP tienen precio en monedas VIP'; end if;
  if i.vip_reward then raise exception 'Ese artículo viene con el VIP: no tiene precio'; end if;
  if p_vip_price is not null and p_vip_price < 1 then raise exception 'El precio tiene que ser mayor a 0'; end if;
  update shop_items set vip_price = p_vip_price where id = p_item;
end $$;

create or replace function public.set_vip_coins_config(p_vip_per_mix int, p_vip_per_win int) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar las monedas VIP' using errcode = '42501'; end if;
  update points_config set vip_per_mix = p_vip_per_mix, vip_per_win = p_vip_per_win, updated_at = now(), updated_by = auth.uid()
   where id = 1;
end $$;

-- Igual que antes, con el saldo de monedas VIP al final. Cambia el tipo de lo que devuelve: hay que borrarla.
drop function if exists public.admin_points_overview();
create function public.admin_points_overview()
  returns table (user_id uuid, alias text, player_id uuid, nick text, vip boolean,
                 earned int, granted int, spent int, balance int, mixes int, items int, cover_url text,
                 vip_earned int, vip_granted int, vip_spent int, vip_balance int)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return query
  select pr.id, pr.tag, pl.id, pl.nick, is_vip(pr.id), b.earned, b.granted, b.spent, b.balance, b.mixes,
         (select count(*)::int from user_items u where u.user_id = pr.id), d.cover_url,
         v.earned, v.granted, v.spent, v.balance
    from profiles pr
    left join players pl on pl.user_id = pr.id
    left join profile_details d on d.user_id = pr.id
    cross join lateral points_of(pr.id) b
    cross join lateral vip_coins_of(pr.id) v
   order by b.balance desc, pr.tag;
end $$;

revoke all on function public.admin_vip_coins_grant(uuid, int, text), public.admin_item_grant(uuid, text, text),
  public.admin_shop_item_vip_price(text, int), public.set_vip_coins_config(int, int),
  public.admin_points_overview() from public, anon;
grant execute on function public.admin_vip_coins_grant(uuid, int, text), public.admin_item_grant(uuid, text, text),
  public.admin_shop_item_vip_price(text, int), public.set_vip_coins_config(int, int),
  public.admin_points_overview() to authenticated, service_role;

-- ---------- Carga ----------
-- Generado con docs/bitacora/2026-10-29-vip-progresion/pruebas/generar_vip.py desde assets/perfil/catalogo.json.
-- El Marco Oro VIP, y el precio VIP de cada artículo VIP solo la primera vez (no pisa lo que cambió un admin).
insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, animated, collection, price, sort, vip_reward)
values ('marco-vip-oro', 'frame', 'Oro VIP', 'Viene con el VIP: marco de oro con corona.', 'marcos/vip-oro.svg', null, true, true, 'vip', null, 1, true)
on conflict (id) do update set name = excluded.name, description = excluded.description, file = excluded.file,
  vip_only = true, vip_reward = true, vip_price = null, price = null, collection = excluded.collection;
-- --- inicio: precios VIP generados ---
update public.shop_items set vip_price = case kind when 'sticker' then 200 when 'name' then 500 when 'theme' then 600 when 'frame' then 1000 when 'background' then 1000 end
 where vip_only and not vip_reward and vip_price is null;
-- --- fin: precios VIP generados ---

commit;
