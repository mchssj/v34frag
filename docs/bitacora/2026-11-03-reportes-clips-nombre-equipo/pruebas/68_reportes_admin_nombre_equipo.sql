-- Pruebas del replanteo 68. Se corren con correr.sh, dentro de una transacción que se deshace.
create or replace function pg_temp.como(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true) $$;

do $$
declare
  ua uuid := gen_random_uuid();  -- admin
  um uuid := gen_random_uuid();  -- moderador
  uc uuid := gen_random_uuid();  -- capitán
  t uuid;
  sfx text := substr(md5(random()::text), 1, 6);
  tg text := upper(substr(md5(random()::text), 1, 3));
begin
  insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
    select x, x || '@prueba.local', now(), now() - interval '30 days', 'authenticated', 'authenticated' from unnest(array[ua, um, uc]) x;
  insert into profiles (id, role) values (ua, 'admin') on conflict (id) do update set role = 'admin';
  insert into profiles (id, role) values (um, 'moderator') on conflict (id) do update set role = 'moderator';
  insert into profiles (id, role) values (uc, 'user') on conflict (id) do update set role = 'user';
  insert into players (nick, user_id, steam_id) values ('c68' || sfx, uc, (76561197960265728 + floor(random() * 1e9)::bigint)::text);

  -- 1. Reportes: el moderador ya no; el admin pasa el permiso (el reporte no existe).
  perform pg_temp.como(um);
  begin perform mm_admin_resolve_report(gen_random_uuid(), 'dismiss'); raise exception 'FALLA 1: el moderador resolvió';
  exception when insufficient_privilege then null; end;
  begin perform mm_admin_lists('reports', null); raise exception 'FALLA 1: el moderador vio los reportes';
  exception when insufficient_privilege then null; end;
  perform mm_admin_lists('penalties', null);  -- las sanciones siguen siendo de moderadores
  perform pg_temp.como(ua);
  begin perform mm_admin_resolve_report(gen_random_uuid(), 'dismiss'); raise exception 'FALLA 1: no llegó al reporte';
  exception when others then
    if sqlerrm <> 'Ese reporte ya se resolvió' then raise exception 'FALLA 1: el admin recibió: %', sqlerrm; end if;
  end;
  perform mm_admin_lists('reports', null);
  raise notice 'OK 1: reportes solo para el admin; las sanciones siguen para moderadores';

  -- 2. Espera del nombre: con 30 días, el segundo cambio se rechaza.
  perform pg_temp.como(ua);
  perform set_team_config((select max_members from team_config where id = 1), null, 30);
  perform pg_temp.como(uc);
  t := team_create('Equipo68 ' || sfx, 'E' || tg);
  update teams set name_changed_at = null where id = t;
  perform team_rename(t, 'Otro68 ' || sfx, 'O' || tg);
  begin
    perform team_rename(t, 'Tercero68 ' || sfx, 'T' || tg);
    raise exception 'FALLA 2: cambió dos veces seguidas';
  exception when sqlstate 'V3901' then
    if sqlerrm not like '%cada 30 días%' then raise exception 'FALLA 2: mensaje: %', sqlerrm; end if;
  end;
  raise notice 'OK 2: con 30 días, el segundo cambio se rechaza';

  -- 3. Con 7 días y el último cambio hace 8, se puede; con 0, siempre.
  perform pg_temp.como(ua);
  perform set_team_config((select max_members from team_config where id = 1), null, 7);
  update teams set name_changed_at = now() - interval '8 days' where id = t;
  perform pg_temp.como(uc);
  perform team_rename(t, 'Cuarto68 ' || sfx, 'C' || tg);
  begin
    perform team_rename(t, 'Quinto68 ' || sfx, 'Q' || tg);
    raise exception 'FALLA 3: con 7 días cambió dos veces';
  exception when sqlstate 'V3901' then
    if sqlerrm not like '%cada 7 días%' then raise exception 'FALLA 3: mensaje: %', sqlerrm; end if;
  end;
  perform pg_temp.como(ua);
  perform set_team_config((select max_members from team_config where id = 1), null, 0);
  perform pg_temp.como(uc);
  perform team_rename(t, 'Sexto68 ' || sfx, 'S' || tg);
  perform team_rename(t, 'Septimo68 ' || sfx, 'P' || tg);
  raise notice 'OK 3: la espera sigue a team_config.rename_days (7 y 0)';

  -- 4. set_team_config: rango y permiso.
  perform pg_temp.como(ua);
  begin perform set_team_config(10, null, 400); raise exception 'FALLA 4: aceptó 400';
  exception when raise_exception then
    if sqlerrm not like '%entre 0 y 365%' then raise exception 'FALLA 4: mensaje: %', sqlerrm; end if;
  end;
  perform pg_temp.como(um);
  begin perform set_team_config(10, null, 10); raise exception 'FALLA 4: el moderador cambió la config';
  exception when insufficient_privilege then null; end;
  perform pg_temp.como(ua);
  perform set_team_config(10, null, 12);
  if (select rename_days from team_config where id = 1) <> 12 then raise exception 'FALLA 4: no guardó'; end if;
  raise notice 'OK 4: set_team_config valida el rango y es solo del admin';

  -- 5. El manual.
  perform pg_temp.como(uc);
  if (manual_valores() ->> 'equipo.dias_nombre')::int <> 12 then raise exception 'FALLA 5: manual_valores sin equipo.dias_nombre'; end if;
  raise notice 'OK 5: manual_valores trae equipo.dias_nombre';
  perform pg_temp.como(null);
end $$;
