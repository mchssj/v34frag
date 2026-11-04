-- Replanteo 63: salir de la cola del matchmaking al cerrar la web o la sesión
-- (plan docs/bitacora/2026-11-02-mm-salir-cola-al-cerrar, aprobado por Daniel: pausa inmediata y 10 s de gracia).
--   1. mm_queue.away_since: desde cuándo no tiene ninguna conexión. mm_try_build no usa una unidad (jugador o grupo)
--      con alguien en pausa: así no le arma sala a quien no está, ni al compañero sin él.
--   2. mm_queue_away, mm_queue_back, mm_queue_drop_away y mm_queue_presence_sweep: las llama la API (rol mm_listener)
--      según el socket. Pasada la gracia sale de la cola sin sanción (outcome disconnected), con su grupo.
--   3. mm_logout(): al cerrar sesión sale de la cola en el acto. A diferencia de mm_leave, nunca rechaza una sala.
--   4. mm_my_live(): queue_dropped_at, para que Jugar diga por qué ya no está buscando.
-- Se aplica después de la 62. NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'mm_queue' and column_name = 'away_since') then
    raise exception 'replanteo 63: mm_queue.away_since ya existe (¿ya se aplicó?)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    -- Sin \r: con el archivo en CRLF (autocrlf), los textos de varias líneas no coincidirían con la función.
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 63: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- ---------- 1. Pausa ----------

alter table public.mm_queue add column away_since timestamptz;
comment on column public.mm_queue.away_since is 'Desde cuándo no tiene ninguna conexión (null = conectado). En pausa no se lo usa para armar salas (replanteo 63)';

alter table public.mm_queue_log drop constraint mm_queue_log_outcome_check;
alter table public.mm_queue_log add constraint mm_queue_log_outcome_check
  check (outcome in ('matched', 'left', 'cancelled', 'closed', 'disconnected'));

-- Una unidad es un jugador solo o un grupo: si alguien del grupo está en pausa, el grupo entero espera.
create function public.mm_unit_away(p_unit text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from mm_queue where coalesce(party_id::text, user_id::text) = p_unit and away_since is not null) $$;

select pg_temp.reemplazar('public.mm_try_build(text)', array[
  ['and (ready_at is null or ready_at <= now())',
   'and (ready_at is null or ready_at <= now()) and not mm_unit_away(coalesce(party_id::text, user_id::text))']
]);

-- ---------- 2. Presencia (la llama la API) ----------

create function public.mm_queue_away(p_user uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  update mm_queue set away_since = now() where user_id = p_user and away_since is null;
  return found;
end $$;

create function public.mm_queue_back(p_user uuid) returns boolean
  language plpgsql security definer set search_path = public as $$
begin
  update mm_queue set away_since = null where user_id = p_user and away_since is not null;
  return found;
end $$;

-- Saca al que sigue en pausa hace más de p_grace_s, con su grupo. Devuelve cuántos salieron (0 si volvió a tiempo).
create function public.mm_queue_drop_away(p_user uuid, p_grace_s int) returns int
  language plpgsql security definer set search_path = public as $$
declare
  v_party uuid;
  v_mates uuid[];
  r record;
  n int := 0;
begin
  select party_id into v_party from mm_queue
    where user_id = p_user and away_since <= now() - make_interval(secs => p_grace_s) for update;
  if not found then return 0; end if;
  perform mm_queue_remove(p_user, 'disconnected');
  n := 1;
  if v_party is not null then
    for r in select user_id from mm_queue where party_id = v_party loop
      perform mm_queue_remove(r.user_id, 'left');
      v_mates := v_mates || r.user_id;
      n := n + 1;
    end loop;
    -- Los compañeros siguen conectados: su pantalla tiene que dejar de mostrar "Buscando".
    if v_mates is not null then perform mm_emit('party.changed', null, v_mates); end if;
  end if;
  return n;
end $$;

-- La red de seguridad: los conectados vuelven, los demás quedan en pausa y los que pasaron la gracia salen.
create function public.mm_queue_presence_sweep(p_online uuid[], p_grace_s int) returns int
  language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  update mm_queue set away_since = null where away_since is not null and user_id = any(coalesce(p_online, '{}'));
  update mm_queue set away_since = now() where away_since is null and not (user_id = any(coalesce(p_online, '{}')));
  for r in select user_id from mm_queue where away_since <= now() - make_interval(secs => p_grace_s) loop
    n := n + mm_queue_drop_away(r.user_id, p_grace_s);
  end loop;
  return n;
end $$;

-- ---------- 3. Cerrar sesión ----------

create function public.mm_logout() returns void
  language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_party uuid := (select party_id from mm_party_members where user_id = me);
  r record;
begin
  for r in select user_id from mm_queue where user_id = me or (v_party is not null and party_id = v_party) loop
    perform mm_queue_remove(r.user_id, 'left');
  end loop;
end $$;

-- ---------- 4. Por qué ya no está buscando ----------

select pg_temp.reemplazar('public.mm_my_live(boolean)', array[
  ['    ''penalty'', (select jsonb_build_object(''until'', until, ''level'', level) from mm_penalties where user_id = me and until > now()),',
   '    ''queue_dropped_at'', (select l.left_at from mm_queue_log l where l.user_id = me and not exists (select 1 from mm_queue where user_id = me)' || E'\n' ||
   '        and l.id = (select max(id) from mm_queue_log where user_id = me) and l.outcome = ''disconnected'' and l.left_at > now() - interval ''10 minutes''),' || E'\n' ||
   '    ''penalty'', (select jsonb_build_object(''until'', until, ''level'', level) from mm_penalties where user_id = me and until > now()),']
]);

-- ---------- Permisos ----------

revoke all on function public.mm_unit_away(text), public.mm_queue_away(uuid), public.mm_queue_back(uuid),
  public.mm_queue_drop_away(uuid, int), public.mm_queue_presence_sweep(uuid[], int), public.mm_logout() from public, anon, authenticated;
grant execute on function public.mm_logout() to authenticated;
grant execute on function public.mm_queue_away(uuid), public.mm_queue_back(uuid), public.mm_queue_drop_away(uuid, int),
  public.mm_queue_presence_sweep(uuid[], int) to service_role;
-- La API las llama con la conexión del LISTEN (rol mm_listener, deploy/vps/api.env.example). En local no existe.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'mm_listener') then
    grant execute on function public.mm_queue_away(uuid), public.mm_queue_back(uuid), public.mm_queue_drop_away(uuid, int),
      public.mm_queue_presence_sweep(uuid[], int) to mm_listener;
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
