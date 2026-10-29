-- Ensayo sobre la copia de producción en la base LOCAL (cargada con cargar_datos.sh y el replanteo hasta la 34 encima).
-- Para 8 pares (ficha + SteamID sin ficha que nunca jugaron juntos), en una transacción que se deshace:
-- suma el SteamID, verifica que los demás no cambian y compara la ficha con elo_recompute_all.
-- Uso: docker exec -i supabase_db_v34frag-api psql -U postgres -d postgres -q < ensayo_copia_prod.sql
select public.elo_recompute_all() as mixes_base \gset
\echo mixes :mixes_base
create temp table pares as
with fichas as (
  select p.id, p.steam_id k, e.matches from players p join player_elo e on e.steam_id = p.steam_id where e.matches >= 1
), sueltos as (
  select e.steam_id s, e.matches from player_elo e where steam_owner(e.steam_id) is null and e.matches >= 1
)
select f.id, f.k, s.s, f.matches fm, s.matches sm from fichas f, sueltos s
 where not exists (select 1 from match_player_stats a join match_player_stats b on b.match_id = a.match_id
                    where a.steam_id = f.k and b.steam_id = s.s)
 order by md5(f.k || s.s) limit 8;
select count(*) from pares;
create function pg_temp.foto(x text[]) returns text language sql as $$
  select md5(coalesce((select string_agg(format('%s|%s|%s|%s|%s|%s', steam_id, elo, peak_elo, mu, sigma, matches), ',' order by steam_id)
                         from player_elo where steam_id <> all(x)), '') ||
             coalesce((select string_agg(format('%s|%s|%s|%s|%s', id, elo_before, elo_after, elo_delta, win_prob), ',' order by id)
                         from match_player_stats where steam_id <> all(x)), '')) $$;
create temp table elo0 as select steam_id, elo from player_elo;
do $$
declare r record; f0 text; ok boolean; mine integer; exact integer; cambian integer; maxd integer; t0 timestamptz; ms integer;
begin
  for r in select * from pares loop
    begin
      f0 := pg_temp.foto(array[r.k, r.s]);
      perform steam_attach(r.s, r.id, null);
      t0 := clock_timestamp();
      perform elo_after_attach(r.s);
      ms := extract(milliseconds from clock_timestamp() - t0);
      ok := f0 = pg_temp.foto(array[r.k, r.s]);
      select elo into mine from player_elo where steam_id = r.k;
      perform elo_recompute_all();
      select elo into exact from player_elo where steam_id = r.k;
      select count(*), max(abs(e.elo - z.elo)) into cambian, maxd from player_elo e join elo0 z using (steam_id)
       where e.steam_id not in (r.k, r.s) and e.elo <> z.elo;
      raise notice 'par: mixes %+%, demás iguales: %, ficha por ficha % vs exacto % (dif %), % ms; con el recálculo general cambian % jugadores (máx % puntos)',
        r.fm, r.sm, ok, mine, exact, mine - exact, ms, cambian, coalesce(maxd, 0);
      raise exception 'deshacer';
    exception when raise_exception then
      if sqlerrm <> 'deshacer' then raise; end if;
    end;
  end loop;
end $$;
