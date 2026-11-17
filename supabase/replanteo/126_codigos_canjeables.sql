-- 126: códigos canjeables para sorteos (bitácora docs/bitacora/2026-11-16-codigos-canjeables/, pedido por Kyan y aprobado
-- por Daniel el 2026-11-16).
--
-- Un admin genera códigos (uno o un lote de hasta 100, al azar CML-XXXX-XXXX-XXXX o personalizados) que dan un artículo de
-- la tienda (para siempre o por días), puntos, monedas VIP o VIP por días, con usos, desde y hasta cuándo sirven y
-- "solo para una cuenta". El jugador los canjea con code_redeem. El admin revoca códigos y revierte canjes.
--
-- Sobre la tienda de la 119:
--   - Los puntos y las monedas de un código son filas de point_grants con redemption_id: el saldo se sigue calculando.
--   - Lo temporal es user_items.expires_at. can_use_item no deja usar lo vencido (la fila queda, para mostrar "Venció").
--   - shop_buy y admin_item_grant vuelven permanente lo temporal en vez de decir "Ya lo tienes".
--   - El VIP de un código es un período de vip_memberships con source = 'code'.
--   - Un artículo VIP que se tiene por un código se usa sin ser VIP mientras points_config.code_vip_free esté encendido
--     (Daniel, 2026-11-17; encendido por defecto). Apagado, sigue la regla de la tienda: se usa siendo VIP. Si después
--     lo compra o se lo regala un admin, deja de ser del código y sigue la regla de siempre.
--
-- Topes contra la fuerza bruta, por cuenta: 5 fallos en 15 minutos bloquean 15 minutos desde el último fallo, y 20 fallos
-- en 24 horas bloquean hasta que el más viejo de esos 20 cumpla 24 horas. Solo es fallo un código que no existe,
-- revocado o que todavía no empezó (los tres dicen "no es válido"). Los fallos se borran a los 30 días.
--
-- code_redeem no lanza errores: devuelve {ok: false, error, message} para que el fallo anotado no se pierda con un
-- rollback. La API pasa error a error.code.
--
-- Los códigos al azar salen de gen_random_uuid() (aleatorio fuerte de Postgres, sin depender de pgcrypto).
-- Permisos explícitos en todo lo nuevo: en el VPS los objetos nacen con permisos para anon y authenticated (ver la 118).
-- Inversa en docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/126_codigos_canjeables.sql.
-- No toca datos. Se puede aplicar con mixes en curso. Después: notify pgrst (va al final).

begin;

do $$ begin
  if to_regclass('public.redeem_codes') is not null then raise exception 'replanteo 126: ya se aplicó (existe redeem_codes)'; end if;
  if to_regclass('public.point_grants') is null or to_regclass('public.user_items') is null then
    raise exception 'replanteo 126: falta la 119 (tienda)';
  end if;
  if to_regclass('public.vip_memberships') is null then raise exception 'replanteo 126: falta el VIP (20261028120000_vip.sql)'; end if;
  if not exists (select 1 from pg_constraint where conname = 'user_items_source_check') then
    raise exception 'replanteo 126: no encuentro user_items_source_check';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'vip_memberships_source_check') then
    raise exception 'replanteo 126: no encuentro vip_memberships_source_check';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 126: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- =====================================================================================================================
-- 1. Tablas
-- =====================================================================================================================
create table public.redeem_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[0-9A-Z]{8,24}$'),
  display       text not null check (char_length(display) between 8 and 30),
  custom        boolean not null default false,
  batch_id      uuid not null,
  reward        text not null check (reward in ('item', 'points', 'vip_coins', 'vip')),
  item_id       text references public.shop_items(id),
  amount        int check (amount between 1 and 100000),
  duration_days int check (duration_days between 1 and 365),
  max_uses      int not null check (max_uses between 1 and 10000),
  uses          int not null default 0,
  for_user      uuid references public.profiles(id) on delete cascade,
  starts_at     timestamptz not null default now(),
  expires_at    timestamptz,
  label         text check (char_length(label) <= 80),
  note          text check (char_length(note) <= 200),
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  revoked_by    uuid references public.profiles(id) on delete set null,
  revoke_reason text check (char_length(revoke_reason) <= 200),
  constraint redeem_codes_premio check (case reward
    when 'item' then item_id is not null and amount is null
    when 'vip' then duration_days is not null and item_id is null and amount is null
    else amount is not null and item_id is null and duration_days is null end),
  constraint redeem_codes_usos check (uses between 0 and max_uses),
  constraint redeem_codes_fechas check (expires_at is null or expires_at > starts_at)
);
create index redeem_codes_batch on public.redeem_codes (batch_id);
create index redeem_codes_created on public.redeem_codes (created_at desc);
comment on table public.redeem_codes is 'Códigos canjeables para sorteos: un premio (item, points, vip_coins o vip) por código. code: normalizado (code_normalize); display: como se muestra. uses: canjes sin revertir. Replanteo 126';

create table public.code_redemptions (
  id                uuid primary key default gen_random_uuid(),
  code_id           uuid not null references public.redeem_codes(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  redeemed_at       timestamptz not null default now(),
  reward            text not null,
  item_id           text references public.shop_items(id) on delete set null,
  amount            int,
  days              int,
  vip_membership_id uuid references public.vip_memberships(id) on delete set null,
  until             timestamptz,
  reverted_at       timestamptz,
  reverted_by       uuid references public.profiles(id) on delete set null,
  revert_reason     text check (char_length(revert_reason) <= 200),
  unique (code_id, user_id)
);
create index code_redemptions_user on public.code_redemptions (user_id, redeemed_at desc);
comment on table public.code_redemptions is 'Un canje de un código: una vez por cuenta, aunque se revierta. Lo que recibió, copiado del código. Replanteo 126';

create table public.redeem_attempts (
  id      bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  at      timestamptz not null default now(),
  ip      inet,
  typed   text check (char_length(typed) <= 4)
);
create index redeem_attempts_user on public.redeem_attempts (user_id, at desc);
create index redeem_attempts_at on public.redeem_attempts (at);
comment on table public.redeem_attempts is 'Canjes fallidos (código inexistente, revocado o sin empezar), para los topes. typed: los primeros 4 caracteres. Se borran a los 30 días. Replanteo 126';

alter table public.redeem_codes enable row level security;
alter table public.code_redemptions enable row level security;
alter table public.redeem_attempts enable row level security;
revoke all on public.redeem_codes, public.code_redemptions, public.redeem_attempts from public, anon, authenticated;

-- =====================================================================================================================
-- 2. Cambios en la tienda y el VIP
-- =====================================================================================================================
alter table public.user_items add column expires_at timestamptz;
comment on column public.user_items.expires_at is 'Hasta cuándo se puede usar (lo temporal de un código). null = para siempre. Replanteo 126';
alter table public.user_items drop constraint user_items_source_check,
  add constraint user_items_source_check check (source in ('purchase', 'grant', 'code'));

alter table public.vip_memberships drop constraint vip_memberships_source_check,
  add constraint vip_memberships_source_check check (source in ('manual', 'import', 'code'));

alter table public.point_grants add column redemption_id uuid references public.code_redemptions(id) on delete set null;
create unique index point_grants_redemption on public.point_grants (redemption_id) where amount > 0;
comment on column public.point_grants.redemption_id is 'El canje de un código que dio (o, en negativo, quitó) estos puntos o monedas. Replanteo 126';

-- Lo VIP de un código sin ser VIP (Daniel, 2026-11-17): se prende y se apaga desde Administración › Tienda.
alter table public.points_config add column code_vip_free boolean not null default true;
comment on column public.points_config.code_vip_free is 'Un artículo VIP que se tiene por un código (user_items.source = code) se usa sin ser VIP. Apagado, se usa siendo VIP, como lo comprado. Replanteo 126';

select pg_temp.reemplazar('public.set_points_config(jsonb)', array[
  ['''custom_max_avatar'', ''custom_max_background'') then',
   '''custom_max_avatar'', ''custom_max_background'', ''code_vip_free'') then'],
  ['if jsonb_typeof(p_changes -> k) <> ''number'' then raise exception ''% tiene que ser un número'', k; end if;',
   'if k = ''code_vip_free'' then
      if jsonb_typeof(p_changes -> k) <> ''boolean'' then raise exception ''code_vip_free tiene que ser true o false''; end if;
    elsif jsonb_typeof(p_changes -> k) <> ''number'' then raise exception ''% tiene que ser un número'', k; end if;'],
  ['    updated_at = now(), updated_by = auth.uid()',
   '    code_vip_free = coalesce((p_changes ->> ''code_vip_free'')::boolean, code_vip_free), -- (replanteo 126)
    updated_at = now(), updated_by = auth.uid()']]);

-- Lo vencido no se usa, y lo VIP de un código se usa sin ser VIP si code_vip_free está encendido. Con esto
-- player_cosmetics_public y set_my_cosmetics muestran y dejan poner justo lo que corresponde.
create or replace function public.can_use_item(p_user uuid, p_item text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_items i where i.id = p_item
                   and case when i.vip_reward then is_vip(p_user)
                            else exists (select 1 from user_items u where u.user_id = p_user and u.item_id = i.id
                                            and (u.expires_at is null or u.expires_at > now()) -- (replanteo 126)
                                            and (not i.vip_only or is_vip(p_user)
                                                 or (u.source = 'code' and (select c.code_vip_free from points_config c where c.id = 1)))) end)
$$;

-- Comprar algo que se tiene por un tiempo (vigente o vencido) lo vuelve una compra para siempre.
select pg_temp.reemplazar('public.shop_buy(text)', array[
  ['if exists (select 1 from user_items where user_id = v_uid and item_id = p_item) then',
   'if exists (select 1 from user_items where user_id = v_uid and item_id = p_item and expires_at is null) then'],
  ['values (v_uid, p_item, ''purchase'', ''vip'', v_price);',
   'values (v_uid, p_item, ''purchase'', ''vip'', v_price)
      on conflict (user_id, item_id) do update set source = ''purchase'', currency = ''vip'', price_paid = excluded.price_paid,
         expires_at = null, granted_by = null, note = null, acquired_at = now();'],
  ['values (v_uid, p_item, ''purchase'', ''points'', v_price);',
   'values (v_uid, p_item, ''purchase'', ''points'', v_price)
    on conflict (user_id, item_id) do update set source = ''purchase'', currency = ''points'', price_paid = excluded.price_paid,
       expires_at = null, granted_by = null, note = null, acquired_at = now();']]);

-- Regalar algo que se tiene por un tiempo lo vuelve un regalo para siempre.
select pg_temp.reemplazar('public.admin_item_grant(uuid, text, text)', array[
  ['on conflict (user_id, item_id) do nothing;',
   'on conflict (user_id, item_id) do update set source = ''grant'', granted_by = excluded.granted_by, note = excluded.note,
     currency = ''points'', price_paid = null, expires_at = null, acquired_at = now()
   where user_items.expires_at is not null; -- (replanteo 126) lo temporal pasa a ser para siempre']]);

-- En el historial, los puntos y las monedas de un código salen como 'code', con el canje en ref.
select pg_temp.reemplazar('public.points_history(uuid, text, integer, integer)', array[
  ['select ''grant'', g.created_at, g.amount, g.reason, null from point_grants g',
   'select case when g.redemption_id is not null then ''code'' else ''grant'' end, g.created_at, g.amount, g.reason, g.redemption_id::text from point_grants g -- (replanteo 126)']]);

-- El inventario con expires_at (cambia lo que devuelve: drop y create, con los mismos permisos).
drop function public.user_items_of(uuid);
create function public.user_items_of(p_user uuid default auth.uid())
  returns table (item_id text, kind text, name text, source text, currency text, price_paid int, note text,
                 acquired_at timestamptz, usable boolean, expires_at timestamptz)
  language plpgsql stable security definer set search_path = public as $$
begin
  if p_user is null or (p_user is distinct from auth.uid() and not is_admin()) then
    raise exception 'No puedes ver el inventario de otra cuenta' using errcode = '42501';
  end if;
  return query
  select u.item_id, i.kind, i.name, u.source, u.currency, u.price_paid, u.note, u.acquired_at, can_use_item(p_user, u.item_id),
         u.expires_at
    from user_items u join shop_items i on i.id = u.item_id
   where u.user_id = p_user
  union all
  -- el premio VIP no está en user_items: se muestra mientras sea VIP
  select i.id, i.kind, i.name, 'vip', null, null, null, null, true, null
    from shop_items i where i.vip_reward and is_vip(p_user)
   order by 8 desc nulls first;
end $$;
comment on function public.user_items_of(uuid) is 'Inventario de una cuenta (el dueño o un admin). usable: si hoy la puede usar; expires_at: hasta cuándo, si es temporal (replanteo 126)';
revoke all on function public.user_items_of(uuid) from public, anon;
grant execute on function public.user_items_of(uuid) to authenticated, service_role;

select pg_temp.reemplazar('public.notification_category(text)', array[
  ['''points_granted'', ''item_granted'', ''item_revoked'',',
   '''points_granted'', ''item_granted'', ''item_revoked'', ''code_redeemed'', ''code_reverted'', -- (replanteo 126)
                   ']]);

do $$ begin
  if notification_category('code_redeemed') is distinct from 'account' or notification_category('code_reverted') is distinct from 'account' then
    raise exception 'replanteo 126: los avisos no quedaron en account';
  end if;
end $$;

-- =====================================================================================================================
-- 3. Internas
-- =====================================================================================================================
-- Mayúsculas, sin espacios ni guiones, y O→0, I/L→1 (lo que se confunde al dictar). La misma regla al guardar y al canjear.
create function public.code_normalize(p_code text) returns text
  language sql immutable set search_path = public as $$
  select translate(regexp_replace(upper(coalesce(p_code, '')), '[\s-]+', '', 'g'), 'OIL', '011')
$$;

-- 12 caracteres de Crockford base32 (60 bits) sacados de gen_random_uuid(): los 15 dígitos hexadecimales que no son
-- ni la versión ni la variante.
create function public.code_random12() returns text
  language plpgsql volatile set search_path = public as $$
declare h text := replace(gen_random_uuid()::text, '-', ''); v bigint; a text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; r text := '';
begin
  v := ('x' || lpad(substr(h, 1, 12) || substr(h, 14, 3), 16, '0'))::bit(64)::bigint;
  for i in 0 .. 11 loop
    r := r || substr(a, ((v >> (5 * i)) & 31)::int + 1, 1);
  end loop;
  return r;
end $$;

-- Estado de un código: revoked, scheduled, expired, used_up o active.
create function public.code_state(c public.redeem_codes) returns text
  language sql stable set search_path = public as $$
  select case when c.revoked_at is not null then 'revoked'
              when c.starts_at > now() then 'scheduled'
              when c.expires_at is not null and c.expires_at <= now() then 'expired'
              when c.uses >= c.max_uses then 'used_up'
              else 'active' end
$$;

-- Hasta cuándo está bloqueada una cuenta por fallos (null: no lo está).
create function public.redeem_blocked_until(p_user uuid) returns timestamptz
  language sql stable security definer set search_path = public as $$
  with f as (select at, row_number() over (order by at desc) n from redeem_attempts
              where user_id = p_user and at > now() - interval '24 hours')
  select case when b.until > now() then b.until end
    from (select greatest(
            -- 5 fallos en 15 minutos: 15 minutos desde el último
            (select f1.at + interval '15 minutes' from f f1, f f5
              where f1.n = 1 and f5.n = 5 and f1.at - f5.at <= interval '15 minutes'),
            -- 20 fallos en 24 horas: hasta que el más viejo de esos 20 cumpla 24 horas
            (select at + interval '24 hours' from f where n = 20)) until) b
$$;

-- Una cuenta como la muestra la lista del admin: alias de la cuenta y su ficha.
create function public.code_account(p_user uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', pr.id, 'alias', pr.tag, 'player_id', pl.id, 'nick', pl.nick)
    from profiles pr
    left join lateral (select x.id, x.nick from players x where x.user_id = pr.id order by x.id limit 1) pl on true
   where pr.id = p_user
$$;

-- Lo que da un canje, para el jugador y el admin.
create function public.code_reward_json(p_reward text, p_item text, p_amount int, p_days int) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('reward', p_reward, 'item', case when p_item is not null then cosmetic_json(p_item) end,
                            'amount', p_amount, 'days', p_days)
$$;

revoke all on function public.code_normalize(text), public.code_random12(), public.code_state(public.redeem_codes),
  public.redeem_blocked_until(uuid), public.code_account(uuid), public.code_reward_json(text, text, int, int)
  from public, anon, authenticated;

-- =====================================================================================================================
-- 4. Canjear
-- =====================================================================================================================
-- Devuelve {ok: true, reward, item, amount, days, until, label} o {ok: false, error, message[, retry_after]}.
-- error: code_invalid, code_expired, code_used_up, code_already_redeemed, code_not_for_you, code_already_owned,
-- code_vip_lifetime, code_no_player, code_banned o code_rate_limited. p_ip: la IP que ve la API (para los fallos).
create function public.code_redeem(p_code text, p_ip inet default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_code text := code_normalize(p_code); v_until timestamptz; c redeem_codes; u user_items;
  v_red uuid; v_start timestamptz; v_vip uuid; v_name text; v_label text;
begin
  if v_uid is null then raise exception 'Inicia sesión para canjear un código' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));

  if not exists (select 1 from players where user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'code_no_player',
                              'message', 'Necesitas tu ficha de jugador vinculada para canjear códigos');
  end if;
  if exists (select 1 from bans b join players p on p.id = b.player_id
              where p.user_id = v_uid and b.lifted_at is null and (b.expires_at is null or b.expires_at > now()))
     or exists (select 1 from players p join player_steam_all s on s.player_id = p.id
                 cross join lateral ban_active_for(s.steam_id) x where p.user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'code_banned', 'message', 'Con un baneo vigente no puedes canjear códigos');
  end if;

  v_until := redeem_blocked_until(v_uid);
  if v_until is not null then
    return jsonb_build_object('ok', false, 'error', 'code_rate_limited',
                              'message', 'Probaste demasiados códigos que no existen. Espera un rato',
                              'retry_after', ceil(extract(epoch from v_until - now()))::int);
  end if;

  select * into c from redeem_codes where code = v_code for update;
  if not found or c.revoked_at is not null or c.starts_at > now() then
    insert into redeem_attempts (user_id, ip, typed) values (v_uid, p_ip, left(v_code, 4));
    delete from redeem_attempts where at < now() - interval '30 days';
    return jsonb_build_object('ok', false, 'error', 'code_invalid', 'message', 'Ese código no es válido');
  end if;
  if c.expires_at is not null and c.expires_at <= now() then
    return jsonb_build_object('ok', false, 'error', 'code_expired', 'message', 'Ese código venció');
  end if;
  if exists (select 1 from code_redemptions where code_id = c.id and user_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'code_already_redeemed', 'message', 'Ya canjeaste ese código');
  end if;
  if c.for_user is not null and c.for_user <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'code_not_for_you', 'message', 'Ese código es para otra cuenta');
  end if;
  -- agotado después de "ya lo canjeaste" y "es para otra cuenta": a quien ya lo usó le dice eso
  if c.uses >= c.max_uses then
    return jsonb_build_object('ok', false, 'error', 'code_used_up', 'message', 'Ese código ya se usó todas las veces que podía');
  end if;

  v_label := left('Código' || coalesce(': ' || c.label, ''), 200);

  -- ¿Ya tiene el premio para siempre? Entonces no se gasta.
  if c.reward = 'item' then
    select * into u from user_items where user_id = v_uid and item_id = c.item_id;
    if found and u.expires_at is null then
      return jsonb_build_object('ok', false, 'error', 'code_already_owned', 'message', 'Ya tienes ese artículo para siempre');
    end if;
  elsif c.reward = 'vip' then
    if exists (select 1 from vip_memberships where user_id = v_uid and revoked_at is null and ends_at is null) then
      return jsonb_build_object('ok', false, 'error', 'code_vip_lifetime', 'message', 'Ya eres VIP de por vida');
    end if;
  end if;

  insert into code_redemptions (code_id, user_id, reward, item_id, amount, days)
  values (c.id, v_uid, c.reward, c.item_id, c.amount, c.duration_days) returning id into v_red;

  if c.reward = 'item' then
    if u.user_id is null then
      insert into user_items (user_id, item_id, source, note, expires_at)
      values (v_uid, c.item_id, 'code', v_label, now() + make_interval(days => c.duration_days))
      returning expires_at into v_until;
    else
      -- lo tenía por un tiempo: un código para siempre lo vuelve permanente; uno por días le suma los días
      update user_items set expires_at = case when c.duration_days is null then null
                                              else greatest(now(), expires_at) + make_interval(days => c.duration_days) end
       where user_id = v_uid and item_id = c.item_id
      returning expires_at into v_until;
    end if;
  elsif c.reward = 'vip' then
    select greatest(now(), coalesce(max(ends_at), now())) into v_start
      from vip_memberships where user_id = v_uid and revoked_at is null and ends_at > now();
    v_until := v_start + make_interval(days => c.duration_days);
    insert into vip_memberships (user_id, starts_at, ends_at, source, note, granted_by)
    values (v_uid, v_start, v_until, 'code', v_label, c.created_by) returning id into v_vip;
  else
    insert into point_grants (user_id, currency, amount, reason, granted_by, redemption_id)
    values (v_uid, case c.reward when 'points' then 'points' else 'vip' end, c.amount, v_label, c.created_by, v_red);
  end if;

  update code_redemptions set until = v_until, vip_membership_id = v_vip where id = v_red;
  update redeem_codes set uses = uses + 1 where id = c.id;

  select name into v_name from shop_items where id = c.item_id;
  perform notify(array[v_uid], 'code_redeemed',
                 jsonb_build_object('reward', c.reward, 'item', c.item_id, 'name', v_name, 'amount', c.amount,
                                    'days', c.duration_days, 'until', v_until, 'label', c.label),
                 v_red::text, true);
  return code_reward_json(c.reward, c.item_id, c.amount, c.duration_days)
         || jsonb_build_object('ok', true, 'until', v_until, 'label', c.label);
end $$;

-- Mis canjes, lo más nuevo primero. Sin el código entero: los últimos 4 caracteres.
create function public.my_redemptions() returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(code_reward_json(r.reward, r.item_id, r.amount, r.days)
                            || jsonb_build_object('id', r.id, 'redeemed_at', r.redeemed_at, 'label', c.label,
                                                  'code_tail', right(c.display, 4), 'until', r.until,
                                                  'reverted_at', r.reverted_at)
                            order by r.redeemed_at desc), '[]'::jsonb)
    from code_redemptions r join redeem_codes c on c.id = r.code_id
   where r.user_id = auth.uid()
$$;

revoke all on function public.code_redeem(text, inet), public.my_redemptions() from public, anon;
grant execute on function public.code_redeem(text, inet), public.my_redemptions() to authenticated, service_role;

-- =====================================================================================================================
-- 5. Admin
-- =====================================================================================================================
-- Crea uno o un lote (p_count, hasta 100) con el mismo premio. Personalizado (p_custom) solo de a uno.
-- p_reward: item (p_item y p_days o null = para siempre), points o vip_coins (p_amount), vip (p_days).
-- Devuelve {batch_id, codes: [{id, code}]}.
create function public.admin_code_create(
  p_reward text, p_item text default null, p_amount int default null, p_days int default null,
  p_max_uses int default 1, p_count int default 1, p_starts_at timestamptz default null, p_expires_at timestamptz default null,
  p_for_user uuid default null, p_custom text default null, p_label text default null, p_note text default null
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_batch uuid := gen_random_uuid(); v_start timestamptz := coalesce(p_starts_at, now()); v_out jsonb := '[]';
  v_code text; v_display text; v_id uuid; v_try int; i shop_items;
begin
  if not is_admin() then raise exception 'Solo un administrador puede crear códigos' using errcode = '42501'; end if;
  if p_reward is null or p_reward not in ('item', 'points', 'vip_coins', 'vip') then
    raise exception 'Premio inválido: item, points, vip_coins o vip';
  end if;
  if p_reward = 'item' then
    select * into i from shop_items where id = p_item;
    if not found then raise exception 'No existe ese artículo'; end if;
    if i.vip_reward then raise exception 'Ese artículo viene con el VIP: haz un código de VIP'; end if;
    if p_amount is not null then raise exception 'Un artículo no lleva cantidad'; end if;
  elsif p_reward = 'vip' then
    if p_days is null then raise exception 'Elige cuántos días de VIP'; end if;
    if p_item is not null or p_amount is not null then raise exception 'El VIP no lleva artículo ni cantidad'; end if;
  else
    if p_amount is null or p_amount not between 1 and 100000 then raise exception 'La cantidad va de 1 a 100.000'; end if;
    if p_item is not null or p_days is not null then raise exception 'Los puntos y las monedas no llevan artículo ni días'; end if;
  end if;
  if p_days is not null and p_days not between 1 and 365 then raise exception 'Los días van de 1 a 365'; end if;
  if coalesce(p_max_uses, 0) not between 1 and 10000 then raise exception 'Los usos van de 1 a 10.000'; end if;
  if coalesce(p_count, 0) not between 1 and 100 then raise exception 'Se crean de 1 a 100 códigos por vez'; end if;
  if p_expires_at is not null and (p_expires_at <= v_start or p_expires_at <= now()) then
    raise exception 'El vencimiento tiene que ser después del comienzo y en el futuro';
  end if;
  if p_for_user is not null then
    if not exists (select 1 from profiles where id = p_for_user) then raise exception 'No existe esa cuenta'; end if;
    if p_count <> 1 or p_max_uses <> 1 then raise exception 'Un código para una cuenta es uno solo y de 1 uso'; end if;
  end if;
  if char_length(p_label) > 80 then raise exception 'El sorteo puede tener hasta 80 caracteres'; end if;
  if char_length(p_note) > 200 then raise exception 'La nota puede tener hasta 200 caracteres'; end if;

  if nullif(btrim(p_custom), '') is not null then
    if p_count <> 1 then raise exception 'Un código personalizado se crea de a uno'; end if;
    if char_length(btrim(p_custom)) > 30 or btrim(p_custom) !~ '^[A-Za-z0-9-]+$' then raise exception 'El código personalizado lleva solo letras, números y guiones (hasta 30)'; end if;
    v_code := code_normalize(p_custom);
    if char_length(v_code) not between 8 and 24 then raise exception 'El código personalizado va de 8 a 24 letras y números'; end if;
    if exists (select 1 from redeem_codes where code = v_code) then raise exception 'Ese código ya existe'; end if;
    insert into redeem_codes (code, display, custom, batch_id, reward, item_id, amount, duration_days, max_uses, for_user,
                              starts_at, expires_at, label, note, created_by)
    values (v_code, upper(btrim(p_custom)), true, v_batch, p_reward, p_item, p_amount, p_days, p_max_uses, p_for_user,
            v_start, p_expires_at, nullif(btrim(p_label), ''), nullif(btrim(p_note), ''), auth.uid())
    returning id into v_id;
    return jsonb_build_object('batch_id', v_batch, 'codes', jsonb_build_array(jsonb_build_object('id', v_id, 'code', upper(btrim(p_custom)))));
  end if;

  for n in 1 .. p_count loop
    v_try := 0;
    loop
      v_try := v_try + 1;
      v_display := code_random12();
      v_display := 'CML-' || substr(v_display, 1, 4) || '-' || substr(v_display, 5, 4) || '-' || substr(v_display, 9, 4);
      v_code := code_normalize(v_display);
      exit when not exists (select 1 from redeem_codes where code = v_code);
      if v_try >= 5 then raise exception 'No se pudo generar un código único'; end if;
    end loop;
    insert into redeem_codes (code, display, custom, batch_id, reward, item_id, amount, duration_days, max_uses, for_user,
                              starts_at, expires_at, label, note, created_by)
    values (v_code, v_display, false, v_batch, p_reward, p_item, p_amount, p_days, p_max_uses, p_for_user,
            v_start, p_expires_at, nullif(btrim(p_label), ''), nullif(btrim(p_note), ''), auth.uid())
    returning id into v_id;
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'code', v_display));
  end loop;
  return jsonb_build_object('batch_id', v_batch, 'codes', v_out);
end $$;

-- La lista: p_q busca en el código, el sorteo y la nota; p_state filtra por estado. total: cuántos hay con el filtro.
create function public.admin_codes(p_q text default null, p_state text default null, p_limit int default 50, p_offset int default 0)
  returns table (id uuid, code text, custom boolean, batch_id uuid, reward jsonb, max_uses int, uses int, for_user jsonb,
                 starts_at timestamptz, expires_at timestamptz, label text, note text, created_by jsonb, created_at timestamptz,
                 revoked_at timestamptz, revoke_reason text, state text, total bigint)
  language plpgsql stable security definer set search_path = public as $$
declare v_q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  if not is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  if p_state is not null and p_state not in ('scheduled', 'active', 'used_up', 'expired', 'revoked') then
    raise exception 'Estado inválido';
  end if;
  return query
  select c.id, c.display, c.custom, c.batch_id, code_reward_json(c.reward, c.item_id, c.amount, c.duration_days),
         c.max_uses, c.uses, code_account(c.for_user), c.starts_at, c.expires_at, c.label, c.note, code_account(c.created_by),
         c.created_at, c.revoked_at, c.revoke_reason, code_state(c), count(*) over ()
    from redeem_codes c
   where (v_q is null or c.code like '%' || code_normalize(v_q) || '%' or c.label ilike '%' || v_q || '%'
          or c.note ilike '%' || v_q || '%')
     and (p_state is null or code_state(c) = p_state)
   order by c.created_at desc, c.display
   limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end $$;

-- Quién canjeó un código.
create function public.admin_code_redemptions(p_code uuid)
  returns table (id uuid, account jsonb, redeemed_at timestamptz, until timestamptz, reverted_at timestamptz,
                 reverted_by jsonb, revert_reason text)
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return query
  select r.id, code_account(r.user_id), r.redeemed_at, r.until, r.reverted_at, code_account(r.reverted_by), r.revert_reason
    from code_redemptions r where r.code_id = p_code order by r.redeemed_at desc;
end $$;

-- Deja de servir. Lo ya canjeado sigue.
create function public.admin_code_revoke(p_code uuid, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede revocar códigos' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  update redeem_codes set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = btrim(p_reason)
   where id = p_code and revoked_at is null;
  if not found then raise exception 'No existe ese código o ya estaba revocado'; end if;
end $$;

-- Revierte un canje: quita los puntos o las monedas (fila negativa), revoca el período VIP o quita el artículo (o sus
-- días), si sigue siendo del código. El código recupera el uso. La cuenta no puede volver a canjearlo.
create function public.admin_redemption_revert(p_redemption uuid, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
declare r code_redemptions; c redeem_codes; u user_items; v_reason text := btrim(coalesce(p_reason, '')); v_name text;
begin
  if not is_admin() then raise exception 'Solo un administrador puede revertir canjes' using errcode = '42501'; end if;
  if char_length(v_reason) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  select * into r from code_redemptions where id = p_redemption;
  if not found then raise exception 'No existe ese canje'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || r.user_id::text));
  select * into c from redeem_codes where id = r.code_id for update;
  select * into r from code_redemptions where id = p_redemption for update;
  if r.reverted_at is not null then raise exception 'Ese canje ya se revirtió'; end if;

  if r.reward in ('points', 'vip_coins') then
    insert into point_grants (user_id, currency, amount, reason, granted_by, redemption_id)
    values (r.user_id, case r.reward when 'points' then 'points' else 'vip' end, -r.amount,
            left('Canje revertido: ' || v_reason, 200), auth.uid(), r.id);
  elsif r.reward = 'vip' then
    update vip_memberships set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = left('Canje revertido: ' || v_reason, 200)
     where id = r.vip_membership_id and revoked_at is null;
  else
    select * into u from user_items where user_id = r.user_id and item_id = r.item_id for update;
    -- si lo compró o se lo regalaron después, ya no es del código: no se toca
    if found and u.source = 'code' then
      if r.days is null then
        u.expires_at := '-infinity';
      elsif u.expires_at is not null then
        u.expires_at := u.expires_at - make_interval(days => r.days);
      end if;
      if u.expires_at is not null and u.expires_at <= now() then
        delete from user_items where user_id = r.user_id and item_id = r.item_id;
        update user_cosmetics set frame = nullif(frame, r.item_id), avatar = nullif(avatar, r.item_id),
               background = nullif(background, r.item_id), theme = nullif(theme, r.item_id), name = nullif(name, r.item_id),
               stickers = array_remove(stickers, r.item_id), updated_at = now()
         where user_id = r.user_id;
      elsif u.expires_at is not null then
        update user_items set expires_at = u.expires_at where user_id = r.user_id and item_id = r.item_id;
      end if;
    end if;
  end if;

  update code_redemptions set reverted_at = now(), reverted_by = auth.uid(), revert_reason = v_reason where id = r.id;
  update redeem_codes set uses = uses - 1 where id = c.id;
  select name into v_name from shop_items where id = r.item_id;
  perform notify(array[r.user_id], 'code_reverted',
                 jsonb_build_object('reward', r.reward, 'item', r.item_id, 'name', v_name, 'amount', r.amount,
                                    'days', r.days, 'label', c.label, 'reason', v_reason),
                 r.id::text);
end $$;

-- Fallos recientes y cuentas bloqueadas ahora, con contadores.
create function public.admin_redeem_attempts(p_limit int default 50) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo administradores' using errcode = '42501'; end if;
  return jsonb_build_object(
    'last_hour', (select count(*) from redeem_attempts where at > now() - interval '1 hour'),
    'last_day', (select count(*) from redeem_attempts where at > now() - interval '24 hours'),
    'attempts', coalesce((select jsonb_agg(jsonb_build_object('at', a.at, 'account', code_account(a.user_id), 'ip', host(a.ip),
                                                              'typed', a.typed) order by a.at desc)
                            from (select * from redeem_attempts order by at desc
                                   limit least(greatest(coalesce(p_limit, 50), 1), 200)) a), '[]'::jsonb),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('account', code_account(b.user_id), 'until', b.until) order by b.until desc)
                           from (select x.user_id, redeem_blocked_until(x.user_id) until
                                   from (select distinct user_id from redeem_attempts where at > now() - interval '24 hours') x) b
                          where b.until is not null), '[]'::jsonb));
end $$;

revoke all on function public.admin_code_create(text, text, int, int, int, int, timestamptz, timestamptz, uuid, text, text, text),
  public.admin_codes(text, text, int, int), public.admin_code_redemptions(uuid), public.admin_code_revoke(uuid, text),
  public.admin_redemption_revert(uuid, text), public.admin_redeem_attempts(int) from public, anon;
grant execute on function public.admin_code_create(text, text, int, int, int, int, timestamptz, timestamptz, uuid, text, text, text),
  public.admin_codes(text, text, int, int), public.admin_code_redemptions(uuid), public.admin_code_revoke(uuid, text),
  public.admin_redemption_revert(uuid, text), public.admin_redeem_attempts(int) to authenticated, service_role;

notify pgrst, 'reload schema';

commit;
