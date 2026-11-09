-- Replanteo 96: ajuste manual del armado del matchmaking (bitácora docs/bitacora/2026-11-09-ajuste-manual-armado/).
-- Pedido y aprobado por Daniel el 2026-11-09.
--   1. mm_balance_overrides: puntos por ficha (entre -300 y +300, nunca 0) que se suman al ELO de armado, con motivo,
--      autor y vencimiento. Sin fila, sin ajuste: todos quedan como estaban. Solo desde la base (sin API ni web).
--   2. mm_balance_override_log: historial de altas, cambios y bajas (trigger, también si se edita la tabla a mano).
--      Se guarda un año: lo borra mm_tick, como mm_queue_log.
--   3. mm_balance_override_set / _clear y la vista mm_balance_overrides_active. Solo postgres y service_role.
--   4. mm_balance_elos: ELO + ajuste por rating (si balance_rating, con su tope) + ajuste manual vigente. Devuelve null
--      solo si balance_rating está apagado y ninguno de la sala tiene ajuste vigente (como antes).
-- No cambian el ELO, el rating, la ventana de la cola, el capitán, el veto ni el ELO que se gana o pierde.
begin;

do $$
begin
  if to_regprocedure('public.mm_balance_elos(uuid[], integer[])') is null then
    raise exception 'replanteo 96: falta el replanteo 73 (aplicar antes 73_mm_equipos_con_rating.sql)';
  end if;
  if to_regclass('public.mm_balance_overrides') is not null then
    raise exception 'replanteo 96: mm_balance_overrides ya existe (¿ya se aplicó?)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    -- Sin \r: con el archivo en CRLF (autocrlf), los textos de varias líneas no coincidirían con la función.
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 96: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- ---------- 1. Tablas ----------

create table public.mm_balance_overrides (
  player_id  uuid primary key references public.players (id) on delete cascade,
  points     integer not null check (points between -300 and 300 and points <> 0),
  reason     text not null check (length(trim(reason)) >= 3),
  set_by     text not null check (length(trim(set_by)) >= 1),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.mm_balance_overrides is
  'Ajuste manual del ELO de armado del matchmaking por ficha (puntos, motivo, autor, vencimiento). Sin fila: sin ajuste. Solo desde la base. Replanteo 96';

create table public.mm_balance_override_log (
  id             bigint generated always as identity primary key,
  player_id      uuid not null,
  action         text not null check (action in ('set', 'update', 'clear')),
  points_before  integer,
  points_after   integer,
  expires_before timestamptz,
  expires_after  timestamptz,
  reason         text,
  set_by         text,
  db_user        text not null default current_user,
  at             timestamptz not null default now()
);
create index mm_balance_override_log_player on public.mm_balance_override_log (player_id, at);
create index mm_balance_override_log_at on public.mm_balance_override_log (at);
comment on table public.mm_balance_override_log is
  'Historial de los ajustes manuales del armado (alta, cambio, baja). Se borra al año (mm_tick). Replanteo 96';

alter table public.mm_balance_overrides enable row level security;
alter table public.mm_balance_override_log enable row level security;
revoke all on public.mm_balance_overrides, public.mm_balance_override_log from public, anon, authenticated;

-- ---------- 2. Historial ----------

-- La baja toma el motivo y el autor de mm_balance_override_clear (variables de la transacción). Un delete a mano
-- queda con motivo y autor null, pero con db_user.
create function public.tg_mm_balance_override_log() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into mm_balance_override_log (player_id, action, points_after, expires_after, reason, set_by)
    values (new.player_id, 'set', new.points, new.expires_at, new.reason, new.set_by);
    return new;
  elsif tg_op = 'UPDATE' then
    insert into mm_balance_override_log (player_id, action, points_before, points_after, expires_before, expires_after, reason, set_by)
    values (new.player_id, 'update', old.points, new.points, old.expires_at, new.expires_at, new.reason, new.set_by);
    return new;
  else
    insert into mm_balance_override_log (player_id, action, points_before, expires_before, reason, set_by)
    values (old.player_id, 'clear', old.points, old.expires_at,
            nullif(current_setting('mm.override_reason', true), ''), nullif(current_setting('mm.override_by', true), ''));
    return old;
  end if;
end $$;
revoke all on function public.tg_mm_balance_override_log() from public, anon, authenticated;

create trigger mm_balance_override_log after insert or update or delete on public.mm_balance_overrides
  for each row execute function public.tg_mm_balance_override_log();

-- ---------- 3. Poner, sacar y ver ----------

create function public.mm_balance_override_set(p_player uuid, p_points integer, p_reason text, p_by text, p_days integer default 30)
  returns public.mm_balance_overrides
  language plpgsql security definer set search_path = public as $$
declare v mm_balance_overrides;
begin
  if not exists (select 1 from players where id = p_player) then
    raise exception 'mm_balance_override_set: no existe la ficha %', p_player;
  end if;
  if p_points is null or p_points = 0 then
    raise exception 'mm_balance_override_set: los puntos no pueden ser 0 (para sacar el ajuste, mm_balance_override_clear)';
  end if;
  if p_days is null or p_days not between 1 and 180 then
    raise exception 'mm_balance_override_set: los días van de 1 a 180 (llegó %)', p_days;
  end if;
  insert into mm_balance_overrides (player_id, points, reason, set_by, expires_at)
  values (p_player, p_points, trim(p_reason), trim(p_by), now() + make_interval(days => p_days))
  on conflict (player_id) do update
    set points = excluded.points, reason = excluded.reason, set_by = excluded.set_by,
        expires_at = excluded.expires_at, updated_at = now()
  returning * into v;
  return v;
end $$;
comment on function public.mm_balance_override_set(uuid, integer, text, text, integer) is
  'Pone o reemplaza el ajuste manual del armado de una ficha (-300 a +300, no 0), con motivo, autor y días de vigencia (1 a 180, 30 por defecto). Replanteo 96';

create function public.mm_balance_override_clear(p_player uuid, p_reason text, p_by text) returns boolean
  language plpgsql security definer set search_path = public as $$
declare v_found boolean;
begin
  if p_reason is null or length(trim(p_reason)) < 3 or p_by is null or length(trim(p_by)) < 1 then
    raise exception 'mm_balance_override_clear: el motivo (3 letras o más) y el autor son obligatorios';
  end if;
  perform set_config('mm.override_reason', trim(p_reason), true);
  perform set_config('mm.override_by', trim(p_by), true);
  delete from mm_balance_overrides where player_id = p_player;
  v_found := found;
  -- Se limpian: un delete a mano más adelante en la misma transacción no tiene que heredar este motivo.
  perform set_config('mm.override_reason', '', true);
  perform set_config('mm.override_by', '', true);
  return v_found;
end $$;
comment on function public.mm_balance_override_clear(uuid, text, text) is
  'Saca el ajuste manual del armado de una ficha. El motivo y el autor quedan en el historial. Devuelve si había. Replanteo 96';

revoke all on function public.mm_balance_override_set(uuid, integer, text, text, integer),
                       public.mm_balance_override_clear(uuid, text, text) from public, anon, authenticated;

create view public.mm_balance_overrides_active with (security_invoker = true) as
select o.player_id, p.nick, p.steam_id, e.elo, o.points, o.expires_at, o.reason, o.set_by, o.created_at, o.updated_at
  from mm_balance_overrides o
  join players p on p.id = o.player_id
  left join player_elo e on e.steam_id = p.steam_id
 where o.expires_at > now()
 order by o.expires_at;
revoke all on public.mm_balance_overrides_active from public, anon, authenticated;
comment on view public.mm_balance_overrides_active is 'Los ajustes manuales del armado vigentes, con nick y ELO. Replanteo 96';

-- ---------- 4. El ELO de armado ----------

create or replace function public.mm_balance_elos(p_players uuid[], p_elos integer[]) returns integer[]
  language sql stable security definer set search_path = public as $$
  select case
           when not c.balance_rating and not exists (
             select 1 from mm_balance_overrides o where o.player_id = any (p_players) and o.expires_at > now()) then null
           else array(
             select e.elo
                    + case
                        when not c.balance_rating or r.rating is null or r.maps + c.balance_rating_prior_maps = 0 then 0
                        else greatest(-c.balance_rating_cap, least(c.balance_rating_cap, round(c.balance_rating_weight *
                               ((r.maps * r.rating + c.balance_rating_prior_maps) / (r.maps + c.balance_rating_prior_maps) - 1))))::int
                      end
                    -- (replanteo 96) el ajuste manual vigente, después del tope del rating
                    + coalesce(ov.points, 0)
               from unnest(p_players, p_elos) with ordinality e(player_id, elo, o)
               left join player_recent_rating(case when c.balance_rating then p_players else '{}'::uuid[] end,
                                              c.balance_rating_days) r on r.player_id = e.player_id
               left join mm_balance_overrides ov on ov.player_id = e.player_id and ov.expires_at > now()
              order by e.o)
         end
    from mm_config c
$$;
revoke all on function public.mm_balance_elos(uuid[], integer[]) from public, anon, authenticated;
comment on function public.mm_balance_elos(uuid[], integer[]) is
  'ELO de armado de cada ficha, en el mismo orden: ELO + peso × (rating corregido − 1,00) con tope (si balance_rating) + ajuste manual vigente (replanteo 96). Null si balance_rating está apagado y nadie tiene ajuste. Replanteos 73 y 96';

-- ---------- 5. El historial se borra al año ----------

select pg_temp.reemplazar('public.mm_tick()', array[
  ['  delete from mm_queue_log where left_at < now() - interval ''180 days'';',
   '  delete from mm_queue_log where left_at < now() - interval ''180 days'';' || E'\n' ||
   '  -- (replanteo 96) el historial de los ajustes manuales del armado se guarda un año' || E'\n' ||
   '  delete from mm_balance_override_log where at < now() - interval ''1 year'';']
]);

commit;
