-- Datos de prueba SOLO para la base local: mixes 5v5 de los últimos días entre los equipos "(suizo)",
-- para ver el rating de las últimas 4 semanas en las alineaciones de la Llave.
-- Cada equipo juega 3 mixes (contra los 3 equipos siguientes de la lista), con stats al azar pero fijas.
-- Se pueden borrar con el bloque del final. Se puede correr de nuevo: primero borra lo anterior.
begin;

delete from public.match_player_stats where match_id in (select id from public.matches where external_id like 'prueba-rating-5v5-%');
delete from public.matches where external_id like 'prueba-rating-5v5-%';

select setseed(0.44);
select set_config('v34.engine', '1', true);

create temp table eq on commit drop as
select t.id, row_number() over (order by t.name) - 1 as i,
       (select array_agg(m.player_id order by p.nick) from public.team_members m join public.players p on p.id = m.player_id
         where m.team_id = t.id and m.left_at is null and p.steam_id is not null) as jugadores
  from public.teams t
 where t.name like '%(suizo)' and t.dissolved_at is null
   and (select count(*) from public.team_members m where m.team_id = t.id and m.left_at is null) >= 5;

create temp table cruces on commit drop as
select gen_random_uuid() as id, a.id as t1, b.id as t2, a.jugadores as j1, b.jugadores as j2, k,
       now() - make_interval(days => ((a.i * 3 + k) % 25 + 1)::int, hours => ((a.i + k) % 12)::int) as cuando,
       (array['de_dust2', 'de_inferno', 'de_nuke', 'de_train', 'de_cbble'])[1 + (a.i + k) % 5] as mapa,
       random() < 0.5 as gana1
  from eq a cross join generate_series(1, 3) k
  join eq b on b.i = (a.i + k) % (select count(*) from eq);

insert into public.matches(id, kind, status, played_at, starts_at, map, score1, score2, external_id)
select id, 'mix', 'finished', cuando, cuando, mapa,
       case when gana1 then 16 else 8 + (random() * 6)::int end,
       case when gana1 then 8 + (random() * 6)::int else 16 end,
       'prueba-rating-5v5-' || id
  from cruces;

-- Una fila por jugador: los multi-kills cierran con las kills, y 22 a 30 rondas.
insert into public.match_player_stats(match_id, player_id, steam_id, nick, team, kills, deaths, assists, headshots, damage,
                                      rounds, k1, k2, k3, k4, k5, first_kills, first_deaths, plants, defuses)
select x.match_id, x.player_id, p.steam_id, p.nick, x.team,
       x.k1 + 2 * x.k2 + 3 * x.k3 + 4 * x.k4 + 5 * x.k5, x.deaths, x.assists,
       ((x.k1 + 2 * x.k2 + 3 * x.k3 + 4 * x.k4 + 5 * x.k5) * (0.3 + random() * 0.4))::int,
       (x.k1 + 2 * x.k2 + 3 * x.k3 + 4 * x.k4 + 5 * x.k5) * (85 + (random() * 40)::int),
       x.rounds, x.k1, x.k2, x.k3, x.k4, x.k5, (random() * 5)::int, (random() * 5)::int, (random() * 3)::int, (random() * 2)::int
  from (
    select c.id as match_id, j.player_id, j.team, m.score1 + m.score2 as rounds,
           -- cada jugador tiene un nivel propio (por su id) para que el rating varíe entre jugadores
           (4 + (abs(hashtext(j.player_id::text)) % 8) + random() * 5)::int as k1,
           (random() * 4)::int as k2, (random() * 2)::int as k3, (random() < 0.15)::int as k4, (random() < 0.04)::int as k5,
           (10 + random() * 10)::int as deaths, (random() * 7)::int as assists
      from cruces c join public.matches m on m.id = c.id
      cross join lateral (
        select u.player_id, 1 as team from unnest(c.j1[1:5]) u(player_id)
        union all select u.player_id, 2 from unnest(c.j2[1:5]) u(player_id)
      ) j
  ) x join public.players p on p.id = x.player_id;

-- El rating de cada fila (el plugin lo manda calculado; acá se calcula con la misma fórmula).
update match_player_stats set rating = csstv_rating(kills, deaths, rounds, k1, k2, k3, k4, k5)
 where match_id in (select id from matches where external_id like 'prueba-rating-5v5-%');

select count(*) as mixes, (select count(*) from eq) as equipos from cruces;
commit;

-- Para borrarlos:
-- begin;
-- delete from public.match_player_stats where match_id in (select id from public.matches where external_id like 'prueba-rating-5v5-%');
-- delete from public.matches where external_id like 'prueba-rating-5v5-%';
-- commit;
