-- Replanteo 57: aviso de la cola del matchmaking en Discord (plan docs/bitacora/2026-11-02-aviso-cola-discord).
--   - mm_queue_pings: cada aviso (quién, cuándo, modo y si era del staff).
--   - mm_queue_ping(): quien está en la cola (o un moderador) avisa; uno cada 15 minutos para todo el servidor, salvo el
--     staff. La API publica en el webhook; la base solo decide si se puede y arma los datos.
--   - mm_queue_ping_status() para el botón y mm_queue_ping_cancel() si Discord no lo publicó.
-- Se aplica después de la 56. NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.mm_queue') is null then
    raise exception 'replanteo 57: falta mm_queue (aplicar antes 48_matchmaking.sql)';
  end if;
  if to_regclass('public.mm_queue_pings') is not null then
    raise exception 'replanteo 57: mm_queue_pings ya existe (¿ya se aplicó?)';
  end if;
end $$;

create table public.mm_queue_pings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text,
  by_staff boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.mm_queue_pings is 'Avisos de la cola en Discord (replanteo 57). Uno cada 15 min para todos, salvo el staff';
create index mm_queue_pings_created on public.mm_queue_pings (created_at desc);
alter table public.mm_queue_pings enable row level security;
revoke all on table public.mm_queue_pings from anon, authenticated;

/** Desde cuándo se puede volver a avisar (null = ya). */
create function public.mm_queue_ping_next() returns timestamptz
  language sql stable security definer set search_path = public as $$
  select nullif(greatest(max(created_at) + interval '15 minutes', now()), now()) from mm_queue_pings $$;

/** Estado del botón: si la cuenta puede avisar ahora y desde cuándo puede. */
create function public.mm_queue_ping_status() returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  v_staff boolean := is_moderator();
  v_queued boolean := exists (select 1 from mm_queue where user_id = auth.uid());
  v_next timestamptz := mm_queue_ping_next();
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  return jsonb_build_object('staff', v_staff, 'queued', v_queued, 'next_at', case when v_staff then null else v_next end,
    'can_ping', v_staff or (v_queued and v_next is null));
end $$;

/** Avisa: devuelve el id, el alias, cuántos buscan por modo y el modo de quien avisa. */
create function public.mm_queue_ping() returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_staff boolean := is_moderator();
  v_mode text;
  v_next timestamptz;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión' using errcode = '42501'; end if;
  -- Uno a la vez: dos botones al mismo tiempo no publican dos avisos.
  perform pg_advisory_xact_lock(hashtext('mm_queue_ping'));
  select mode into v_mode from mm_queue where user_id = auth.uid();
  if v_mode is null and not v_staff then raise exception 'Tenés que estar buscando partida para avisar'; end if;
  v_next := mm_queue_ping_next();
  if v_next is not null and not v_staff then
    raise exception 'Ya se avisó hace poco: el próximo aviso se puede a las %', to_char(v_next at time zone 'America/Bogota', 'HH24:MI')
      using errcode = 'V5701', detail = jsonb_build_object('next_at', v_next)::text;
  end if;
  insert into mm_queue_pings (user_id, mode, by_staff) values (auth.uid(), v_mode, v_staff) returning id into v_id;
  return jsonb_build_object('id', v_id, 'mode', v_mode, 'staff', v_staff,
    'alias', coalesce((select tag from profiles where id = auth.uid()), (select nick from players where user_id = auth.uid() limit 1), 'Alguien'),
    'queue', coalesce((select jsonb_object_agg(mode, n) from (select mode, count(*) n from mm_queue group by mode) q), '{}'),
    'next_at', now() + interval '15 minutes');
end $$;

/** Discord no lo publicó: el aviso no cuenta para el límite. Solo el propio y de hace menos de un minuto. */
create function public.mm_queue_ping_cancel(p_id uuid) returns void
  language sql security definer set search_path = public as $$
  delete from mm_queue_pings where id = p_id and user_id = auth.uid() and created_at > now() - interval '1 minute' $$;

revoke all on function public.mm_queue_ping_next(), public.mm_queue_ping_status(), public.mm_queue_ping(), public.mm_queue_ping_cancel(uuid)
  from public, anon;
grant execute on function public.mm_queue_ping_status(), public.mm_queue_ping(), public.mm_queue_ping_cancel(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
