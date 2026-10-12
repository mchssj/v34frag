-- Pruebas de 20261012120000_demos_y_canceladas.sql sobre el esquema mínimo de
-- docs/bitacora/2026-10-11-elo-jugadores/pruebas/stub_supabase.sql (ver GUIA_IMPLEMENTACION.md).
\set ON_ERROR_STOP 1
set client_min_messages = notice;
insert into game_servers(name, token_hash) values ('real', encode(sha256('tok'::bytea), 'hex'));
insert into game_servers(name, token_hash) values ('local', encode(sha256('tok2'::bytea), 'hex'));
update game_servers set panel_server_id = '55f80fed' where name = 'real';
insert into players(nick, steam_id) values ('p1', '76561198000000001');

-- Mix 5v5; "extra" se agrega al resultado (status, demo, etc.).
create function t_payload(uid text, a int, b int, extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('schema','1','match_uid',uid,'map','de_dust2','started_at',1000,'ended_at',2800,
    'score', jsonb_build_object('a',a,'b',b),
    'players', (select jsonb_agg(jsonb_build_object('team', case when i<=5 then 'a' else 'b' end, 'name','p'||i,
       'steamid', (76561198000000000+i)::text, 'rounds', a+b, 'kills', 10+i, 'deaths', 15-i,
       'k1',6,'k2',2,'k3',0,'k4',0,'k5',0)) from generate_series(1,10) i)) || extra
$$;
create function t_err(sql text) returns text language plpgsql as $$
begin execute sql; return 'sin error'; exception when others then return sqlstate || ' ' || sqlerrm; end $$;

-- T1: resultado viejo (sin campos nuevos) => finished, sin demo, con ganador y ELO.
select ingest_server_match('tok', t_payload('fin-0001', 16, 10)) as m1 \gset
do $$ declare m matches; begin
  select * into m from matches where external_id = 'fin-0001';
  if m.status <> 'finished' or m.demo_status <> 'none' or m.winner is null or m.cancel_reason is not null
     or not exists (select 1 from match_player_stats where match_id = m.id and elo_delta is not null)
     or (select maps from players where nick = 'p1') <> 1 then
    raise exception 'T1 falla';
  end if;
  raise notice 'T1 OK: formato viejo sigue igual (finished, demo none, ELO aplicado)';
end $$;

-- T2: terminada con demo => pending.
select ingest_server_match('tok', t_payload('fin-0002', 16, 14, '{"status":"finished","demo":true}')) \gset
do $$ begin
  if (select demo_status from matches where external_id = 'fin-0002') <> 'pending' then raise exception 'T2 falla'; end if;
  raise notice 'T2 OK: demo true => pending';
end $$;

-- T3: cancelada por cambio de mapa, con demo => sin ganador, sin ELO, no cuenta en stats del jugador.
select ingest_server_match('tok', t_payload('can-0001', 7, 3, '{"status":"cancelled","cancel_reason":"map_change","demo":true}')) \gset
do $$ declare m matches; begin
  select * into m from matches where external_id = 'can-0001';
  if m.status <> 'cancelled' or m.winner is not null or m.cancel_reason <> 'map_change' or m.demo_status <> 'pending'
     or m.score1 <> 7 or m.score2 <> 3
     or exists (select 1 from match_player_stats where match_id = m.id and elo_delta is not null)
     or (select count(*) from match_player_stats where match_id = m.id) <> 10
     or (select maps from players where nick = 'p1') <> 2 then
    raise exception 'T3 falla';
  end if;
  raise notice 'T3 OK: cancelada guarda marcador parcial y stats, sin ganador, sin ELO, sin contar en el perfil';
end $$;

-- T4: cancelada por admin, con quién canceló; motivo desconocido => admin.
select ingest_server_match('tok', t_payload('can-0002', 2, 1, '{"status":"cancelled","cancel_reason":"otro","cancelled_by":"daniloev"}')) \gset
do $$ declare m matches; begin
  select * into m from matches where external_id = 'can-0002';
  if m.cancel_reason <> 'admin' or m.cancelled_by <> 'daniloev' or m.demo_status <> 'none' then raise exception 'T4 falla'; end if;
  raise notice 'T4 OK: motivo admin y cancelled_by';
end $$;

-- T5: estado inválido => PT422; reenvío => mismo id.
do $$ declare e text; begin
  e := t_err($q$select ingest_server_match('tok', t_payload('bad-0001', 1, 0, '{"status":"live"}'))$q$);
  if e not like 'PT422%' then raise exception 'T5 falla: %', e; end if;
  if ingest_server_match('tok', t_payload('can-0001', 7, 3, '{"status":"cancelled"}'))
     <> (select id from matches where external_id = 'can-0001') then raise exception 'T5 falla: reenvío'; end if;
  raise notice 'T5 OK: estado inválido rechazado, reenvío idempotente';
end $$;

-- T6: elo_recompute_all no toca las canceladas.
set test.admin = 'on';
select elo_recompute_all() \gset
reset test.admin;
do $$ begin
  if exists (select 1 from match_player_stats s join matches m on m.id = s.match_id
              where m.status = 'cancelled' and s.elo_delta is not null) then raise exception 'T6 falla'; end if;
  raise notice 'T6 OK: recálculo de ELO ignora canceladas';
end $$;

-- T7: token del Worker y demo_pending.
set test.admin = 'on';
select create_demo_worker_token('cf') as wtok \gset
reset test.admin;
select set_config('t.wtok', :'wtok', false) \gset
select ingest_server_match('tok2', t_payload('loc-0001', 16, 0, '{"demo":true}')) \gset
do $$ declare e text; begin
  e := t_err($q$select * from demo_pending('malo')$q$);
  if e not like 'PT401%' then raise exception 'T7 falla: %', e; end if;
  e := t_err($q$select * from demo_pending('tok')$q$);
  if e not like 'PT401%' then raise exception 'T7 falla: token de servidor aceptado'; end if;
  raise notice 'T7 OK: tokens malos y de servidor rechazados';
end $$;
select external_id, panel_server_id, server_name, status from demo_pending(:'wtok');
do $$ begin
  if (select count(*) from demo_pending(current_setting('t.wtok'))) <> 2 then raise exception 'T7b falla'; end if;
  raise notice 'T7b OK: solo pendientes de servidores con panel_server_id (fin-0002 y can-0001)';
end $$;

-- T8: 6 reintentos => missing.
do $$ declare s text; begin
  for i in 1..6 loop s := demo_mark(current_setting('t.wtok'), 'fin-0002', 'retry'); end loop;
  if s <> 'missing' or (select demo_attempts from matches where external_id = 'fin-0002') <> 6 then raise exception 'T8 falla: %', s; end if;
  raise notice 'T8 OK: 6 reintentos => missing';
end $$;

-- T9: subida: ruta inválida rechazada, válida => uploaded; resultado desconocido rechazado.
do $$ declare e text; s text; begin
  e := t_err(format($q$select demo_mark(%L, 'can-0001', 'uploaded', '../x.dem', 10)$q$, current_setting('t.wtok')));
  if e not like 'PT422%' then raise exception 'T9 falla: %', e; end if;
  e := t_err(format($q$select demo_mark(%L, 'can-0001', 'borrar')$q$, current_setting('t.wtok')));
  if e not like 'PT422%' then raise exception 'T9 falla: %', e; end if;
  s := demo_mark(current_setting('t.wtok'), 'can-0001', 'uploaded', 'demos/2026/10/can-0001.dem', 284729);
  if s <> 'uploaded' or (select demo_size from matches where external_id = 'can-0001') <> 284729 then raise exception 'T9 falla'; end if;
  if (select count(*) from demo_pending(current_setting('t.wtok'))) <> 0 then raise exception 'T9 falla: sigue pendiente'; end if;
  raise notice 'T9 OK: subida registrada';
end $$;

-- T10: expiración.
update matches set demo_uploaded_at = now() - interval '91 days' where external_id = 'can-0001';
do $$ declare n int; begin
  n := demo_expire(current_setting('t.wtok'), 90);
  if n <> 1 or (select demo_status from matches where external_id = 'can-0001') <> 'expired' then
    raise exception 'T10 falla';
  end if;
  raise notice 'T10 OK: expiración a los 90 días';
end $$;

-- T11: create_demo_worker_token exige admin.
do $$ declare e text; begin
  set local role authenticated;
  e := t_err($q$select create_demo_worker_token('xx')$q$);
  reset role;
  if e not like '42501%' then raise exception 'T11 falla: %', e; end if;
  raise notice 'T11 OK: crear tokens exige admin';
end $$;

select external_id, status, winner is not null as con_ganador, cancel_reason, cancelled_by, demo_status, demo_attempts, demo_key
  from matches order by external_id;

-- T12: el insert del SQL Editor (final de la migración) genera un token que funciona.
with t as (select 'demow_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') as token),
     i as (insert into demo_workers(name, token_hash)
           select 'cloudflare-demos', encode(sha256(convert_to(token, 'UTF8')), 'hex') from t)
select token as wtok2 from t \gset
select count(*) as pendientes_con_token_sql from demo_pending(:'wtok2');
do $$ begin raise notice 'T12 OK: token creado desde el SQL Editor aceptado'; end $$;

-- T13 (con 20261012140000_motivo_abandono.sql): motivo 'abandoned'.
select ingest_server_match('tok', t_payload('aba-0001', 3, 2, '{"status":"cancelled","cancel_reason":"abandoned","demo":true}')) \gset
do $$ begin
  if (select cancel_reason from matches where external_id = 'aba-0001') <> 'abandoned' then raise exception 'T13 falla'; end if;
  raise notice 'T13 OK: cancelada por abandono';
end $$;
