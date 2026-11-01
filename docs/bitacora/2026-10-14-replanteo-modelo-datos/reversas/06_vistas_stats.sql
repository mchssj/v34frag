-- Inversa de supabase/replanteo/06_vistas_stats.sql.
-- Recrea la carga manual (columnas de players, stats_auto, tabla player_map_stats) y recompute_player_stats
-- tal como estaban después de 04 (secciones extraídas de supabase/schema/public.sql, con los reemplazos de
-- 04 aplicados a la función), y vuelve a calcular las stats de cada jugador desde sus partidas. Las stats
-- cargadas a mano de jugadores sin partidas no vuelven: están en el respaldo previo al corte.
begin;
set check_function_bodies = false;

drop view public.player_map_stats;
drop view public.player_stats;

alter table public.players
  add column rating numeric, add column kd numeric, add column hs numeric, add column adr numeric,
  add column maps integer, add column wins integer, add column losses integer,
  add column stats_auto boolean default true not null;

--
-- Name: recompute_player_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recompute_player_stats(p_player uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare a record;
begin
  -- Desde la web solo un admin; las funciones de ingesta la llaman sin usuario (anon).
  if auth.uid() is not null and not is_admin() then
    raise exception 'Solo un admin puede recalcular estadísticas' using errcode = '42501';
  end if;
  select count(*) as maps,
         coalesce(sum(s.kills), 0) as k, coalesce(sum(s.deaths), 0) as d, coalesce(sum(s.headshots), 0) as hs,
         coalesce(sum(s.damage), 0) as dmg, coalesce(sum(s.rounds), 0) as r,
         coalesce(sum(s.k1), 0) as k1, coalesce(sum(s.k2), 0) as k2, coalesce(sum(s.k3), 0) as k3,
         coalesce(sum(s.k4), 0) as k4, coalesce(sum(s.k5), 0) as k5,
         count(*) filter (where m.winner_side = s.team) as w,
         count(*) filter (where m.winner_side is not null and m.winner_side <> s.team) as l
    into a
    from match_player_stats s
    join matches m on m.id = s.match_id
   where s.player_id = p_player and m.status = 'finished';

  if a.maps = 0 then return; end if;

  update players set
    rating = csstv_rating(a.k, a.d, a.r, a.k1, a.k2, a.k3, a.k4, a.k5),
    kd     = round(a.k::numeric / greatest(a.d, 1), 2),
    hs     = case when a.k > 0 then round(a.hs * 100.0 / a.k, 1) end,
    adr    = case when a.r > 0 then round(a.dmg::numeric / a.r, 1) end,
    maps   = a.maps,
    wins   = a.w,
    losses = a.l
  where id = p_player and stats_auto;
end $$;

--
-- Name: player_map_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_map_stats (
    id integer NOT NULL,
    player_id uuid,
    map_name text NOT NULL,
    rating numeric(4,2),
    kd numeric(4,2),
    maps integer
);

--
-- Name: player_map_stats_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.player_map_stats_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: player_map_stats_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.player_map_stats_id_seq OWNED BY public.player_map_stats.id;

--
-- Name: player_map_stats id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_map_stats ALTER COLUMN id SET DEFAULT nextval('public.player_map_stats_id_seq'::regclass);

--
-- Name: player_map_stats player_map_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_map_stats
    ADD CONSTRAINT player_map_stats_pkey PRIMARY KEY (id);

--
-- Name: idx_mapstats_jugador; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mapstats_jugador ON public.player_map_stats USING btree (player_id);

--
-- Name: player_map_stats player_map_stats_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_map_stats
    ADD CONSTRAINT player_map_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

--
-- Name: player_map_stats Permitir lectura general de map stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Permitir lectura general de map stats" ON public.player_map_stats FOR SELECT USING (true);

--
-- Name: player_map_stats mapstats: admin gestiona; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "mapstats: admin gestiona" ON public.player_map_stats USING (public.is_admin()) WITH CHECK (public.is_admin());

--
-- Name: player_map_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.player_map_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: FUNCTION recompute_player_stats(p_player uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recompute_player_stats(p_player uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recompute_player_stats(p_player uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recompute_player_stats(p_player uuid) TO service_role;

--
-- Name: TABLE player_map_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.player_map_stats TO anon;
GRANT ALL ON TABLE public.player_map_stats TO authenticated;
GRANT ALL ON TABLE public.player_map_stats TO service_role;

--
-- Name: SEQUENCE player_map_stats_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.player_map_stats_id_seq TO anon;
GRANT ALL ON SEQUENCE public.player_map_stats_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.player_map_stats_id_seq TO service_role;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $f$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 06: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $f$;

select pg_temp.reemplazar('public.csstv_ingest(uuid, jsonb)', array[
  [E'  -- Las stats de cada jugador salen de la vista player_stats (replanteo 06): no hay nada que recalcular.\n',
   E'  -- Una cancelada no cambia las estadísticas de nadie.\n  if v_status = ''finished'' then\n    foreach x in array array(select distinct unnest(affected)) loop\n      perform recompute_player_stats(x);\n    end loop;\n  end if;\n']
]);

select pg_temp.reemplazar('public.link_steam_id(text, uuid)', array[
  ['    -- (replanteo 06) las stats de cur salen de la vista player_stats',
   '    perform recompute_player_stats(cur);'],
  ['  -- (replanteo 06) las stats de p_player salen de la vista player_stats',
   '  perform recompute_player_stats(p_player);']
]);

do $$ begin
  if to_regprocedure('public.elo_crash_apply(uuid)') is not null then
    perform pg_temp.reemplazar('public.elo_crash_apply(uuid)', array[
      [E'  -- (replanteo 06) las stats de los jugadores salen de la vista player_stats\n',
       E'  foreach x in array array(select distinct player_id from match_player_stats where match_id = p_match and player_id is not null) loop\n    perform recompute_player_stats(x);\n  end loop;\n']
    ]);
  end if;
end $$;

-- Stats de cada jugador desde sus partidas, como hacía la ingesta.
do $$
declare p uuid;
begin
  for p in select id from public.players loop perform public.recompute_player_stats(p); end loop;
end $$;

commit;
