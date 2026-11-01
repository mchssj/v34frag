-- Pruebas de supabase/replanteo/07_match_vincular.sql (correr con la migración aplicada). Todo con rollback.
begin;

-- Servidor con token "tok07". Doce jugadores: p1..p12, con SteamID 76561198000000701..712.
insert into public.game_servers (id, name, token_hash)
  values ('cccccccc-0000-4000-8000-000000000071', 'srv 07', encode(sha256(convert_to('tok07', 'UTF8')), 'hex'));
insert into public.players (id, nick, steam_id)
  select ('dddddddd-0000-4000-8000-0000000007' || lpad(i::text, 2, '0'))::uuid, 'p' || i, '765611980000007' || lpad(i::text, 2, '0')
    from generate_series(1, 12) i;
-- Equipos: oficiales Alfa (p1..p5) y Beta (p6..p10 más los suplentes p11 y p12); PCW PA (p1..p5) y PB (p6..p10); Chico (p1..p4).
insert into public.teams (id, name, kind) values
  ('eeeeeeee-0000-4000-8000-000000000071', 'Alfa', 'official'), ('eeeeeeee-0000-4000-8000-000000000072', 'Beta', 'official'),
  ('eeeeeeee-0000-4000-8000-000000000073', 'PA', 'pcw'),        ('eeeeeeee-0000-4000-8000-000000000074', 'PB', 'pcw'),
  ('eeeeeeee-0000-4000-8000-000000000075', 'Chico', 'official');
insert into public.team_members (team_id, player_id)
  select t.id, ('dddddddd-0000-4000-8000-0000000007' || lpad(i::text, 2, '0'))::uuid
    from (values ('eeeeeeee-0000-4000-8000-000000000071'::uuid, 1, 5), ('eeeeeeee-0000-4000-8000-000000000072', 6, 12),
                 ('eeeeeeee-0000-4000-8000-000000000073', 1, 5), ('eeeeeeee-0000-4000-8000-000000000074', 6, 10),
                 ('eeeeeeee-0000-4000-8000-000000000075', 1, 4)) t(id, desde, hasta),
         generate_series(t.desde, t.hasta) i;
insert into public.events (id, name, stage) values ('abababab-0000-4000-8000-000000000071', 'Titan', 'Inscripciones');
insert into public.matches (id, team1, team2, kind, status, best_of, event_id, stage) values
  ('ffffffff-0000-4000-8000-000000000071', 'eeeeeeee-0000-4000-8000-000000000071', 'eeeeeeee-0000-4000-8000-000000000072', 'official', 'upcoming', 1, 'abababab-0000-4000-8000-000000000071', 'Final'),
  ('ffffffff-0000-4000-8000-000000000072', 'eeeeeeee-0000-4000-8000-000000000073', 'eeeeeeee-0000-4000-8000-000000000074', 'pcw', 'upcoming', 3, null, null),
  ('ffffffff-0000-4000-8000-000000000073', 'eeeeeeee-0000-4000-8000-000000000071', 'eeeeeeee-0000-4000-8000-000000000072', 'official', 'finished', 1, null, null),
  ('ffffffff-0000-4000-8000-000000000074', 'eeeeeeee-0000-4000-8000-000000000071', 'eeeeeeee-0000-4000-8000-000000000072', 'official', 'upcoming', 1, null, null),
  ('ffffffff-0000-4000-8000-000000000075', 'eeeeeeee-0000-4000-8000-000000000073', 'eeeeeeee-0000-4000-8000-000000000074', 'pcw', 'upcoming', 1, null, null);

-- Ayudas: jugador i como JSON del payload; stand-in sin cuenta; juego del servidor; valor de una clave del lookup.
create function pg_temp.j(i int) returns jsonb language sql as $$
  select jsonb_build_object('name', 'p' || i, 'steamid', '765611980000007' || lpad(i::text, 2, '0')) $$;
create function pg_temp.si(n text) returns jsonb language sql as $$ select jsonb_build_object('name', n, 'steamid', 'BOT') $$;
create function pg_temp.juego(uid text, a jsonb, b jsonb, sa int, sb int, code text, lado int, estado text default 'finished') returns uuid
language plpgsql as $$
declare jug jsonb := '[]'; x jsonb;
begin
  for x in select value from jsonb_array_elements(a) loop jug := jug || jsonb_build_array(x || jsonb_build_object('team', 'a', 'rounds', 20, 'kills', 10)); end loop;
  for x in select value from jsonb_array_elements(b) loop jug := jug || jsonb_build_array(x || jsonb_build_object('team', 'b', 'rounds', 20, 'kills', 10)); end loop;
  return public.csstv_ingest('cccccccc-0000-4000-8000-000000000071', jsonb_build_object(
    'schema', '1', 'match_uid', uid, 'status', estado, 'map', 'de_nuke', 'score', jsonb_build_object('a', sa, 'b', sb), 'players', jug)
    || case when code is null then '{}'::jsonb else jsonb_build_object('link_code', code) end
    || case when lado is null then '{}'::jsonb else jsonb_build_object('link_side_a', lado::text) end);
end $$;
create function pg_temp.v(t text, k text) returns text language sql as $$
  select substr(l, length(k) + 2) from unnest(string_to_array(t, E'\n')) l where l like k || '=%' limit 1 $$;
create function pg_temp.code(m uuid) returns text language sql as $$ select link_code from public.matches where id = m $$;

do $$
declare
  t text; gid uuid; m public.matches;
  alfa jsonb := jsonb_build_array(pg_temp.j(1), pg_temp.j(2), pg_temp.j(3), pg_temp.j(4), pg_temp.j(5));
  beta jsonb := jsonb_build_array(pg_temp.j(6), pg_temp.j(7), pg_temp.j(8), pg_temp.j(9), pg_temp.j(10));
begin
  -- Códigos: automáticos en torneo y PCW, nunca en un mix.
  assert pg_temp.code('ffffffff-0000-4000-8000-000000000071') ~ '^[A-HJ-NP-Z2-9]{5}$', 'código inválido';
  begin
    insert into public.matches (kind, status, link_code) values ('mix', 'finished', 'ABCDE');
    assert false, 'un mix aceptó un código';
  exception when check_violation then null;
  end;

  -- Lookup en texto (torneo y PCW, código en minúscula).
  t := public.csstv_match_lookup('tok07', lower(pg_temp.code('ffffffff-0000-4000-8000-000000000071')));
  assert pg_temp.v(t, 'ok') = '1' and pg_temp.v(t, 'kind') = 'official', t;
  assert pg_temp.v(t, 'title') = 'Titan · Final: Alfa vs Beta', pg_temp.v(t, 'title');
  assert pg_temp.v(t, 't1') = (select string_agg(public.csstv_steam2('765611980000007' || lpad(i::text, 2, '0')), ',' order by i) from generate_series(1, 5) i), pg_temp.v(t, 't1');
  assert public.csstv_steam2('76561197960265729') = 'STEAM_0:1:0' and public.csstv_steam2('76561198000000000') = 'STEAM_0:0:19867136', 'csstv_steam2 mal';
  assert public.csstv_steam2('BOT') is null, 'csstv_steam2 aceptó algo que no es un SteamID64';
  assert array_length(string_to_array(pg_temp.v(t, 't2'), ','), 1) = 7, 'el lookup no trae el plantel completo (con suplentes)';
  assert pg_temp.v(t, 'max_standins') = '0' and pg_temp.v(t, 'min_roster') = '5' and pg_temp.v(t, 'best_of') = '1', t;
  assert pg_temp.v(t, 'code') = pg_temp.code('ffffffff-0000-4000-8000-000000000071'), 'el lookup no devuelve el código';
  t := public.csstv_match_lookup('tok07', pg_temp.code('ffffffff-0000-4000-8000-000000000072'));
  assert pg_temp.v(t, 'title') = 'PCW: PA vs PB' and pg_temp.v(t, 'max_standins') = '2' and pg_temp.v(t, 'min_roster') = '3', t;
  assert pg_temp.v(public.csstv_match_lookup('malo', 'XXXXX'), 'error') like 'Token de servidor inválido%', 'lookup: token inválido';
  assert pg_temp.v(public.csstv_match_lookup('tok07', 'ZZZZZ'), 'error') = 'No hay ninguna partida con ese código', 'lookup: código inexistente';
  assert pg_temp.v(public.csstv_match_lookup('tok07', pg_temp.code('ffffffff-0000-4000-8000-000000000073')), 'ok') = '0', 'lookup: partida terminada';

  -- Torneo BO1: Beta juega en el bando a (link_side_a = 2) con 5 de sus 7 (los suplentes no juegan) y gana 13-7.
  gid := pg_temp.juego('juego07a', beta, alfa, 13, 7, pg_temp.code('ffffffff-0000-4000-8000-000000000071'), 2);
  assert (select parent_side1 from public.matches where id = gid) = 2, 'torneo: no quedó vinculado con el lado 2';
  assert (select side1_name || '/' || side2_name from public.matches where id = gid) = 'Beta/Alfa',
    format('torneo: nombres de los bandos %s', (select side1_name || '/' || side2_name from public.matches where id = gid));
  select * into m from public.matches where id = 'ffffffff-0000-4000-8000-000000000071';
  assert m.status = 'finished' and m.score1 = 0 and m.score2 = 1 and m.winner_side = 2, format('torneo: %s %s-%s', m.status, m.score1, m.score2);
  assert (m.maps->0->>'r1')::int = 7 and (m.maps->0->>'r2')::int = 13, format('torneo maps: %s', m.maps);
  assert (select maps from public.player_stats where player_id = 'dddddddd-0000-4000-8000-000000000706') = 1, 'stats contadas dos veces';
  perform pg_temp.juego('juego07a', beta, alfa, 13, 7, pg_temp.code('ffffffff-0000-4000-8000-000000000071'), 2);
  assert jsonb_array_length((select maps from public.matches where id = 'ffffffff-0000-4000-8000-000000000071')) = 1, 'el reenvío sumó el mapa';

  -- Torneo: con un stand-in, o con el lado declarado al revés, queda como mix y no toca la partida.
  gid := pg_temp.juego('juego07b', jsonb_build_array(pg_temp.j(1), pg_temp.j(2), pg_temp.j(3), pg_temp.j(4), pg_temp.si('standin')), beta, 13, 5,
                       pg_temp.code('ffffffff-0000-4000-8000-000000000074'), 1);
  assert (select parent_match_id from public.matches where id = gid) is null, 'torneo con stand-in se vinculó';
  gid := pg_temp.juego('juego07c', alfa, beta, 13, 5, pg_temp.code('ffffffff-0000-4000-8000-000000000074'), 2);
  assert (select parent_match_id from public.matches where id = gid) is null, 'lado declarado al revés se vinculó';
  assert (select status from public.matches where id = 'ffffffff-0000-4000-8000-000000000074') = 'upcoming', 'se tocó la partida';
  -- Plugin viejo (sin link_side_a): se deduce por mayoría.
  gid := pg_temp.juego('juego07d', beta, alfa, 13, 9, pg_temp.code('ffffffff-0000-4000-8000-000000000074'), null);
  assert (select parent_side1 from public.matches where id = gid) = 2, 'sin link_side_a no se dedujo el lado';

  -- PCW BO3: 3 inscritos + 2 stand-ins por lado. PA gana el mapa 1 (en vivo 1-0) y el 2 (termina 2-0).
  perform pg_temp.juego('juego07e', jsonb_build_array(pg_temp.j(1), pg_temp.j(2), pg_temp.j(3), pg_temp.si('s1'), pg_temp.si('s2')),
                        jsonb_build_array(pg_temp.j(6), pg_temp.j(7), pg_temp.j(8), pg_temp.si('s3'), pg_temp.si('s4')), 13, 10,
                        pg_temp.code('ffffffff-0000-4000-8000-000000000072'), 1);
  select * into m from public.matches where id = 'ffffffff-0000-4000-8000-000000000072';
  assert m.status = 'live' and m.score1 = 1 and m.score2 = 0 and m.winner is null, format('PCW mapa 1: %s %s-%s', m.status, m.score1, m.score2);
  perform pg_temp.juego('juego07f', jsonb_build_array(pg_temp.j(6), pg_temp.j(7), pg_temp.j(8), pg_temp.j(9)), jsonb_build_array(pg_temp.j(1), pg_temp.j(2), pg_temp.j(3), pg_temp.j(4)),
                        8, 13, pg_temp.code('ffffffff-0000-4000-8000-000000000072'), 2);
  select * into m from public.matches where id = 'ffffffff-0000-4000-8000-000000000072';
  assert m.status = 'finished' and m.score1 = 2 and m.score2 = 0 and m.winner_side = 1, format('PCW final: %s %s-%s', m.status, m.score1, m.score2);
  -- PCW con solo 2 inscritos en un bando: queda como mix.
  gid := pg_temp.juego('juego07g', jsonb_build_array(pg_temp.j(1), pg_temp.j(2), pg_temp.si('a'), pg_temp.si('b'), pg_temp.si('c')), beta, 13, 2,
                       pg_temp.code('ffffffff-0000-4000-8000-000000000075'), 1);
  assert (select parent_match_id from public.matches where id = gid) is null, 'PCW con 2 inscritos se vinculó';
  -- Un juego cancelado no se vincula.
  gid := pg_temp.juego('juego07h', alfa, beta, 5, 2, pg_temp.code('ffffffff-0000-4000-8000-000000000075'), 1, 'cancelled');
  assert (select parent_match_id from public.matches where id = gid) is null, 'un juego cancelado se vinculó';
  assert (select status from public.matches where id = 'ffffffff-0000-4000-8000-000000000075') = 'upcoming', 'se tocó la PCW';

  -- Inscripción a un torneo: 4 jugadores no alcanzan, 5 sí.
  begin
    insert into public.tournament_registrations (event_id, team_id) values ('abababab-0000-4000-8000-000000000071', 'eeeeeeee-0000-4000-8000-000000000075');
    assert false, 'se inscribió un equipo con 4 jugadores';
  exception when others then
    assert sqlerrm like 'Para inscribirse a un torneo el equipo necesita al menos 5%', sqlerrm;
  end;
  insert into public.tournament_registrations (event_id, team_id) values ('abababab-0000-4000-8000-000000000071', 'eeeeeeee-0000-4000-8000-000000000071');
end $$;

-- PCW: publicar con 3 jugadores con cuenta falla; con 4 funciona.
insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-000000000071', 'pcw07@test.local');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000071","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.create_pcw_post('Tres', 1, null, now() + interval '1 day', null,
      array['dddddddd-0000-4000-8000-000000000701', 'dddddddd-0000-4000-8000-000000000702', 'dddddddd-0000-4000-8000-000000000703']::uuid[], array['Invitado']);
    assert false, 'se publicó una PCW con 3 jugadores con cuenta';
  exception when others then
    assert sqlerrm like 'El roster tiene que tener al menos 4 jugadores con cuenta%', sqlerrm;
  end;
  perform public.create_pcw_post('Cuatro', 1, null, now() + interval '1 day', null,
    array['dddddddd-0000-4000-8000-000000000701', 'dddddddd-0000-4000-8000-000000000702', 'dddddddd-0000-4000-8000-000000000703', 'dddddddd-0000-4000-8000-000000000704']::uuid[], '{}');
  raise notice 'replanteo 07: ok';
end $$;

rollback;
