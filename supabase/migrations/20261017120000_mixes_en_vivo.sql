-- =============================================================================
-- Mixes en vivo y mixes interrumpidos por una caída del servidor
--
-- - live_matches: la última foto de cada mix en curso. El plugin (2.1.0) la manda al final
--   de cada ronda por ingest_server_chunk con status "live", con el uid de las partes
--   "<match_uid>_v<seq>" para que dos fotos no mezclen sus partes en ingest_chunks.
--   Cuando llega el resultado final, la fila se borra.
-- - Mix interrumpido: el plugin, al volver de una caída, manda la última foto como
--   cancelada con cancel_reason "crash". Si el servidor no vuelve, un admin la cierra con
--   live_match_close (sin fotos hace 10 minutos). Queda una fila en match_crashes.
-- - ELO de un interrumpido: solo si un admin lo aprueba (elo_crash_apply), con al menos el
--   35 % de las rondas del mix (max_rounds) y sin empate. El mix pasa a finished con
--   end_reason "crash" y gana el que iba adelante: cuenta como cualquier mix terminado.
--
-- csstv_ingest no se toca (el replanteo lo redefine): la marca de caída se pone después.
--
-- Bitácora: docs/bitacora/2026-10-17-mixes-en-vivo/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable.
-- =============================================================================

begin;

alter table public.matches drop constraint if exists matches_cancel_reason_check;
alter table public.matches add constraint matches_cancel_reason_check
  check (cancel_reason is null or cancel_reason in ('admin', 'map_change', 'abandoned', 'crash'));
alter table public.matches drop constraint if exists matches_end_reason_check;
alter table public.matches add constraint matches_end_reason_check
  check (end_reason is null or end_reason in ('surrender', 'crash'));

create table if not exists public.live_matches (
  uid         text primary key,
  server_id   uuid not null references public.game_servers(id) on delete cascade,
  server_name text,
  seq         integer not null,
  map         text,
  score_a     integer not null,
  score_b     integer not null,
  max_rounds  integer,
  payload     jsonb not null,
  started_at  timestamptz,
  updated_at  timestamptz not null default now()
);

alter table public.live_matches enable row level security;
drop policy if exists "live_matches: todos ven" on public.live_matches;
create policy "live_matches: todos ven" on public.live_matches for select using (true);
revoke all on public.live_matches from anon, authenticated;
grant select on public.live_matches to anon, authenticated;

create table if not exists public.match_crashes (
  match_id    uuid primary key references public.matches(id) on delete cascade,
  max_rounds  integer not null,
  source      text not null check (source in ('plugin', 'admin')),   -- quién la cerró
  created_at  timestamptz not null default now(),
  decision    text check (decision in ('applied', 'discarded')),     -- null: falta revisarla
  reviewed_at timestamptz,
  reviewed_by uuid
);

alter table public.match_crashes enable row level security;
drop policy if exists "match_crashes: todos ven" on public.match_crashes;
create policy "match_crashes: todos ven" on public.match_crashes for select using (true);
revoke all on public.match_crashes from anon, authenticated;
grant select on public.match_crashes to anon, authenticated;

-- Rondas mínimas para aprobar el ELO de un interrumpido: 35 % de max_rounds, hacia arriba.
create or replace function public.crash_min_rounds(p_max_rounds integer)
returns integer language sql immutable as $$
  select ceil(greatest(coalesce(p_max_rounds, 0), 1) * 35 / 100.0)::integer
$$;

-- Guarda la foto de un mix en curso. No devuelve nada: el plugin no espera respuesta.
create or replace function public.csstv_live_upsert(p_server uuid, p_uid text, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid text := p->>'match_uid';
  v_seq integer;
  v_a   integer;
  v_b   integer;
begin
  if coalesce(p->>'schema', '') <> '1' then
    raise exception 'Versión de datos no soportada' using errcode = 'PT422';
  end if;
  if v_uid is null or v_uid !~ '^[A-Za-z0-9_-]{6,70}$' then
    raise exception 'match_uid inválido' using errcode = 'PT422';
  end if;
  v_seq := csstv_jint(p, 'live_seq', 100000);
  if v_seq < 1 or p_uid is distinct from v_uid || '_v' || v_seq then
    raise exception 'El uid no coincide con el contenido' using errcode = 'PT422';
  end if;
  v_a := (p #>> '{score,a}')::integer;
  v_b := (p #>> '{score,b}')::integer;
  if v_a is null or v_b is null or v_a not between 0 and 200 or v_b not between 0 and 200 then
    raise exception 'Marcador inválido' using errcode = 'PT422';
  end if;
  if jsonb_typeof(p->'players') is distinct from 'array' or jsonb_array_length(p->'players') not between 2 and 32 then
    raise exception 'Cantidad de jugadores inválida' using errcode = 'PT422';
  end if;

  -- Una foto que llega después del resultado final (o de que un admin lo cerró) no revive el mix.
  if exists (select 1 from matches where external_id = v_uid) then return; end if;

  insert into live_matches(uid, server_id, server_name, seq, map, score_a, score_b, max_rounds, payload, started_at, updated_at)
  values (v_uid, p_server, (select name from game_servers where id = p_server), v_seq,
          nullif(regexp_replace(lower(left(coalesce(p->>'map', ''), 64)), '^(de|cs)_', ''), ''),
          v_a, v_b, nullif(csstv_jint(p, 'max_rounds', 200), 0), p,
          to_timestamp(nullif(csstv_jint(p, 'started_at', 2147483647), 0)), now())
  on conflict (uid) do update
    set seq = excluded.seq, map = excluded.map, score_a = excluded.score_a, score_b = excluded.score_b,
        max_rounds = excluded.max_rounds, payload = excluded.payload, server_name = excluded.server_name,
        updated_at = now()
  where live_matches.seq < excluded.seq and live_matches.server_id = excluded.server_id;
end $$;

-- Después de csstv_ingest: marca la caída (csstv_ingest guarda un motivo desconocido como
-- 'admin') y deja la fila para que un admin la revise. Siempre borra la foto en vivo.
create or replace function public.csstv_after_ingest(p_match uuid, p jsonb, p_source text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from live_matches where uid = p->>'match_uid';
  if p->>'status' = 'cancelled' and p->>'cancel_reason' = 'crash' then
    update matches set cancel_reason = 'crash', cancelled_by = null
     where id = p_match and kind = 'mix' and status = 'cancelled';
    if found then
      insert into match_crashes(match_id, max_rounds, source)
      values (p_match, greatest(csstv_jint(p, 'max_rounds', 200), 1), p_source)
      on conflict (match_id) do nothing;
    end if;
  end if;
end $$;

-- Igual que en 20261011120000, más las fotos en vivo y la marca de caída.
create or replace function public.ingest_server_chunk(p_token text, p_uid text, p_part integer, p_total integer, p_data text)
returns uuid language plpgsql security definer set search_path = public as $_$
declare
  sid       uuid;
  v_id      uuid;
  v_b64     text;
  v_payload jsonb;
begin
  sid := csstv_auth(p_token);
  if p_uid is null or p_uid !~ '^[A-Za-z0-9_-]{6,80}$' then
    raise exception 'uid inválido' using errcode = 'PT422';
  end if;

  select id into v_id from matches where external_id = p_uid;
  if v_id is not null then return v_id; end if;

  if p_total is null or p_total not between 1 and 200 or p_part is null or p_part not between 1 and p_total then
    raise exception 'Número de parte inválido' using errcode = 'PT422';
  end if;
  if p_data is null or length(p_data) > 4000 or p_data !~ '^[A-Za-z0-9+/=]*$' then
    raise exception 'Parte inválida' using errcode = 'PT422';
  end if;

  delete from ingest_chunks where created_at < now() - interval '2 days';
  insert into ingest_chunks(uid, part, total, data, server_id)
  values (p_uid, p_part, p_total, p_data, sid)
  on conflict (uid, part) do update
    set data = excluded.data, total = excluded.total, server_id = excluded.server_id, created_at = now();

  if (select count(*) from ingest_chunks where uid = p_uid and total = p_total and part <= p_total) < p_total then
    return null;   -- faltan partes
  end if;

  select string_agg(data, '' order by part) into v_b64
    from ingest_chunks where uid = p_uid and part <= p_total;
  begin
    v_payload := convert_from(decode(v_b64, 'base64'), 'UTF8')::jsonb;
  exception when others then
    raise exception 'El resultado llegó dañado' using errcode = 'PT422';
  end;

  if v_payload->>'status' = 'live' then
    delete from ingest_chunks where uid = p_uid;
    perform csstv_live_upsert(sid, p_uid, v_payload);
    return null;
  end if;

  if v_payload->>'match_uid' is distinct from p_uid then
    raise exception 'El uid no coincide con el contenido' using errcode = 'PT422';
  end if;

  v_id := csstv_ingest(sid, v_payload);
  perform csstv_after_ingest(v_id, v_payload, 'plugin');
  perform elo_apply_match(v_id);
  delete from ingest_chunks where uid = p_uid;
  return v_id;
end $_$;

-- Igual que en 20261011180000 (csstv_uploader.py), más la marca de caída.
create or replace function public.ingest_server_match(p_token text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := csstv_ingest(csstv_auth(p_token), p_payload);
  perform csstv_after_ingest(v_id, p_payload, 'plugin');
  perform elo_apply_match(v_id);
  return v_id;
end $$;

-- Admin: un mix en vivo que dejó de mandar fotos (el servidor no volvió) pasa a cancelado
-- por caída con la última foto. Devuelve el id de la partida.
create or replace function public.live_match_close(p_uid text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  l    live_matches%rowtype;
  v_p  jsonb;
  v_id uuid;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede cerrar un mix en vivo' using errcode = '42501';
  end if;
  select * into l from live_matches where uid = p_uid for update;
  if l.uid is null then
    raise exception 'Ese mix ya no está en vivo' using errcode = 'P0002';
  end if;
  if l.updated_at > now() - interval '10 minutes' then
    raise exception 'El mix sigue mandando datos: se puede cerrar después de 10 minutos sin novedades' using errcode = '22023';
  end if;
  v_p := (l.payload - 'live_seq') || jsonb_build_object('status', 'cancelled', 'cancel_reason', 'crash', 'cancelled_by', '');
  v_id := csstv_ingest(l.server_id, v_p);
  perform csstv_after_ingest(v_id, v_p, 'admin');
  return v_id;
end $$;

-- Admin: aplica el ELO de un mix interrumpido. Pasa a finished y gana el que iba adelante.
create or replace function public.elo_crash_apply(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  m      record;
  c      match_crashes%rowtype;
  v_min  integer;
  x      uuid;
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede aplicar el ELO de un mix interrumpido' using errcode = '42501';
  end if;
  select * into c from match_crashes where match_id = p_match for update;
  select id, kind, status, cancel_reason, team1, team2, score1, score2 into m from matches where id = p_match for update;
  if c.match_id is null or m.id is null or m.kind <> 'mix' or m.status <> 'cancelled' or m.cancel_reason is distinct from 'crash' then
    raise exception 'Ese mix no está interrumpido por una caída' using errcode = 'P0002';
  end if;
  if c.decision is not null then
    raise exception 'Ese mix ya se revisó' using errcode = '22023';
  end if;
  v_min := crash_min_rounds(c.max_rounds);
  if coalesce(m.score1, 0) + coalesce(m.score2, 0) < v_min then
    raise exception 'Se jugaron % de % rondas: hacen falta % (35 %%)', coalesce(m.score1, 0) + coalesce(m.score2, 0), c.max_rounds, v_min
      using errcode = '22023';
  end if;
  if coalesce(m.score1, 0) = coalesce(m.score2, 0) then
    raise exception 'Iban empatados: no hay ganador para el ELO' using errcode = '22023';
  end if;

  update matches
     set status = 'finished', end_reason = 'crash', cancel_reason = null, cancelled_by = null,
         winner = case when score1 > score2 then team1 else team2 end
   where id = p_match;
  update match_crashes set decision = 'applied', reviewed_at = now(), reviewed_by = auth.uid() where match_id = p_match;

  foreach x in array array(select distinct player_id from match_player_stats where match_id = p_match and player_id is not null) loop
    perform recompute_player_stats(x);
  end loop;
  perform elo_apply_match(p_match);
end $$;

-- Admin: deja el mix interrumpido como cancelado, sin ELO.
create or replace function public.elo_crash_discard(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede revisar un mix interrumpido' using errcode = '42501';
  end if;
  update match_crashes set decision = 'discarded', reviewed_at = now(), reviewed_by = auth.uid()
   where match_id = p_match and decision is null;
  if not found then
    raise exception 'Ese mix no está pendiente de revisión' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.csstv_live_upsert(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.csstv_after_ingest(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.live_match_close(text) from public, anon;
revoke all on function public.elo_crash_apply(uuid) from public, anon;
revoke all on function public.elo_crash_discard(uuid) from public, anon;
grant execute on function public.live_match_close(text) to authenticated;
grant execute on function public.elo_crash_apply(uuid) to authenticated;
grant execute on function public.elo_crash_discard(uuid) to authenticated;
grant execute on function public.crash_min_rounds(integer) to anon, authenticated;

commit;
