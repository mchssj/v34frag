-- =============================================================================
-- +20 de ELO a 4 ganadores del mix que se cayó el 2026-10-15 (~21:04, hora de Colombia).
-- El servidor se murió en medio de la partida y no quedó registro en la base.
--
-- Requiere la migración 20261015210000_elo_ajustes.sql.
-- Cómo aplicarlo: Supabase > SQL Editor > pegar todo > Run. Si ya se aplicó, aborta sin cambiar nada.
-- Para deshacerlo: select elo_remove_adjustment(id) por cada una de las 4 filas.
-- =============================================================================

begin;

do $$
declare
  nicks text[] := array['rbk', 'kyansuke', 'flow', 'honzzq'];
  ids   text[];
  faltan text;
  dup   text;
begin
  if exists (select 1 from elo_adjustments where reason like 'Mix caído 2026-10-15%') then
    raise exception 'Este ajuste ya se aplicó';
  end if;

  select string_agg(n, ', ') into faltan from unnest(nicks) n
   where not exists (select 1 from players p where lower(p.nick) = n and p.steam_id is not null);
  if faltan is not null then
    raise exception 'No encontré (o no tienen steam_id): %', faltan;
  end if;

  select string_agg(n, ', ') into dup from unnest(nicks) n
   where (select count(*) from players p where lower(p.nick) = n and p.steam_id is not null) > 1;
  if dup is not null then
    raise exception 'Nick repetido en players, revisar a mano: %', dup;
  end if;

  select array_agg(p.steam_id) into ids from players p where lower(p.nick) = any(nicks) and p.steam_id is not null;

  perform elo_add_adjustment(ids, 20, 'Mix caído 2026-10-15: el servidor se cayó en medio de la partida y no quedó registro',
                             '2026-10-15 21:04-05');
end $$;

-- Para revisar antes del commit: los 4 deberían tener +20.
select p.nick, a.steam_id, a.delta, e.elo, e.peak_elo
  from elo_adjustments a
  join player_elo e on e.steam_id = a.steam_id
  left join players p on p.steam_id = a.steam_id
 where a.reason like 'Mix caído 2026-10-15%'
 order by p.nick;

commit;
