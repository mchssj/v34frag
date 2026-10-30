-- =============================================================================
-- IPs de los jugadores, 2.ª parte (bitácora docs/bitacora/2026-10-29-ips-jugadores)
--
-- csstv_connections acepta "t" (unix, segundos) en cada intento: el primer intento de esa IP. El reporter 2.6.1 lo
-- manda para que los intentos que recupera de su archivo después de una caída queden en la hora en que pasaron, no
-- en la del envío. Sin "t" (el reporter 2.6.0), o con una fecha de más de 48 horas o en el futuro, vale la hora actual.
--
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Es re-ejecutable.
-- Necesita 20261029180000_ips_jugadores.sql.
-- =============================================================================

begin;

create or replace function public.csstv_connections(p_token text, p_seen jsonb default '[]', p_attempts jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_sid  uuid;
  v_now  timestamptz := now();
  v_hour timestamptz;
  e      jsonb;
  v_s64  text;
  v_ip   inet;
  v_nick text;
  n_seen integer := 0;
  n_att  integer := 0;
begin
  begin
    v_sid := csstv_auth(p_token);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;

  if jsonb_typeof(p_seen) = 'array' then
    for e in select x from jsonb_array_elements(p_seen) x limit 64 loop
      begin
        v_s64 := csstv_steam64(left(e ->> 'steam', 40));
      exception when others then   -- un número que no entra en bigint
        v_s64 := null;
      end;
      v_ip := csstv_ip(e ->> 'ip');
      continue when v_s64 is null or v_s64 !~ '^7656[0-9]{13}$' or v_ip is null;
      v_nick := nullif(left(btrim(coalesce(e ->> 'nick', '')), 64), '');
      insert into player_connections(server_id, steam_id, ip, nick) values (v_sid, v_s64, v_ip, v_nick);
      insert into player_ips as p (steam_id, ip, last_server_id, last_nick) values (v_s64, v_ip, v_sid, v_nick)
      on conflict (steam_id, ip) do update
        set last_seen_at = now(), times = p.times + 1, last_server_id = excluded.last_server_id,
            last_nick = coalesce(excluded.last_nick, p.last_nick);
      n_seen := n_seen + 1;
    end loop;
  end if;

  if jsonb_typeof(p_attempts) = 'array' then
    for e in select x from jsonb_array_elements(p_attempts) x limit 256 loop
      v_ip := csstv_ip(e ->> 'ip');
      continue when v_ip is null or coalesce(jsonb_typeof(e -> 'n'), '') <> 'number';
      -- (2.ª parte) la hora del primer intento, si es de las últimas 48 horas
      v_hour := date_trunc('hour', v_now);
      if coalesce(jsonb_typeof(e -> 't'), '') = 'number' and (e ->> 't')::numeric between
           extract(epoch from v_now - interval '48 hours') and extract(epoch from v_now + interval '5 minutes') then
        v_hour := date_trunc('hour', to_timestamp((e ->> 't')::numeric));
      end if;
      insert into connect_attempts as a (server_id, ip, hour, count)
      values (v_sid, v_ip, v_hour, greatest(1, least((e ->> 'n')::numeric, 100000))::integer)
      on conflict (server_id, ip, hour) do update set count = least(a.count + excluded.count, 2000000000);
      n_att := n_att + 1;
    end loop;
  end if;

  -- Sin pg_cron: de vez en cuando, borra lo que tiene más de 90 días.
  if random() < 0.02 then
    delete from player_connections where at < now() - interval '90 days';
    delete from connect_attempts where hour < now() - interval '90 days';
  end if;

  return jsonb_build_object('ok', true, 'seen', n_seen, 'attempts', n_att);
end $$;

revoke all on function public.csstv_connections(text, jsonb, jsonb) from public;
grant execute on function public.csstv_connections(text, jsonb, jsonb) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
