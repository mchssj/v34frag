-- Limpieza 2026-11-03 (Kyan), solo producción: fichas sin SteamID, sin partidas y sin cuenta (menos Venom), y equipos
-- sin ninguna fila en team_members, sin partidas, sin inscripciones y sin equipos hijos. Aborta si las cantidades
-- no son las del inventario (34 y 10). Antes deja en el resultado los ids y nombres de lo que borra.
\set ON_ERROR_STOP on
begin;

create temp table limpieza_fichas on commit drop as
select p.id, p.nick from players p
 where p.steam_id is null and p.user_id is null and p.nick <> 'Venom'
   and not exists (select 1 from player_extra_steam_ids x where x.player_id = p.id)
   and not exists (select 1 from match_player_stats s where s.player_id = p.id)
   and not exists (select 1 from matches m where p.id = any(m.lineup1) or p.id = any(m.lineup2));

create temp table limpieza_equipos on commit drop as
select t.id, t.name from teams t
 where not exists (select 1 from team_members m where m.team_id = t.id)
   and not exists (select 1 from matches m where t.id in (m.team1, m.team2))
   and not exists (select 1 from tournament_registrations r where r.team_id = t.id)
   and not exists (select 1 from teams h where h.parent_team_id = t.id)
   and not exists (select 1 from events e where e.champion = t.id);

do $$
begin
  if (select count(*) from limpieza_fichas) <> 34 or (select count(*) from limpieza_equipos) <> 10 then
    raise exception 'limpieza: las cantidades cambiaron (fichas %, equipos %)',
      (select count(*) from limpieza_fichas), (select count(*) from limpieza_equipos);
  end if;
end $$;

select 'ficha', id, nick from limpieza_fichas order by lower(nick);
select 'equipo', id, name from limpieza_equipos order by lower(name);

delete from players where id in (select id from limpieza_fichas);
delete from teams where id in (select id from limpieza_equipos);

do $$
begin
  if exists (select 1 from players where id in (select id from limpieza_fichas))
     or exists (select 1 from teams where id in (select id from limpieza_equipos)) then
    raise exception 'limpieza: quedó algo sin borrar';
  end if;
end $$;

commit;
