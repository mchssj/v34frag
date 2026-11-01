-- =============================================================================
-- Datos del reporter para las medallas (bitácora docs/bitacora/2026-10-29-medallas-datos)
--
-- El reporter 2.7.0 manda claves nuevas en el resultado, sin cambiar "schema": 1: armas, clutchs, rondas
-- sobrevividas y ganadas por lado, pistolas, ecos, bombas explotadas y el equipamiento de cada ronda. Esta
-- migración las guarda para las medallas de la web nueva. La web vieja no las usa.
--
-- Van en tablas aparte (match_round_log y match_player_extra), no en matches ni en match_player_stats: la web
-- vieja carga esas dos tablas completas con select *, y columnas nuevas la harían más pesada en cada carga.
-- Un mix sin fila en estas tablas es de un plugin anterior a 2.7.0 (sin dato, no "cero").
--
-- csstv_ingest se parcha sobre la definición instalada (producción y staging tienen definiciones distintas):
-- se agrega una línea antes del "return v_id;" final. Los replanteos no tocan ese lugar.
--
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Es re-ejecutable.
-- =============================================================================

begin;

-- ---------- tablas ----------
create table if not exists public.match_round_log (
  match_id uuid primary key references public.matches(id) on delete cascade,
  rounds   jsonb not null,
  created_at timestamptz not null default now()
);
comment on table public.match_round_log is
  'Registro de rondas de cada mix (reporter): [{"n","winner":"a"|"b","a_side":"CT"|"T","reason","a_eq","b_eq"}]. '
  'a_eq/b_eq: equipamiento promedio de cada bando al terminar el freezetime (reporter 2.7.0; -1 = sin medir)';

create table if not exists public.match_player_extra (
  match_id        uuid not null,
  steam_id        text not null,
  rounds_survived integer,
  rounds_won_ct   integer,
  rounds_won_t    integer,
  pistol_won      integer,
  eco_won         integer,
  bombs_exploded  integer,
  clutch_1v1      integer,
  clutch_1v2      integer,
  clutch_1v3      integer,
  clutch_1v4      integer,
  clutch_1v5      integer,
  clutch_tries    integer,
  weapon_kills    jsonb,
  weapon_hs       jsonb,
  primary key (match_id, steam_id),
  foreign key (match_id, steam_id) references public.match_player_stats(match_id, steam_id) on delete cascade
);
comment on table public.match_player_extra is 'Stats de un jugador en un mix que manda el reporter 2.7.0 en adelante (para las medallas). null = el dato venía mal';
comment on column public.match_player_extra.rounds_survived is 'Rondas en las que terminó vivo';
comment on column public.match_player_extra.rounds_won_ct is 'Rondas ganadas jugando de CT';
comment on column public.match_player_extra.rounds_won_t is 'Rondas ganadas jugando de T';
comment on column public.match_player_extra.pistol_won is 'Rondas de pistola ganadas: la primera de cada mitad del reglamentario';
comment on column public.match_player_extra.eco_won is 'Rondas ganadas siendo eco: equipamiento promedio del bando < $1500 y del rival >= $3500, sin las primeras de cada mitad';
comment on column public.match_player_extra.bombs_exploded is 'Bombas que plantó y explotaron';
comment on column public.match_player_extra.clutch_tries is 'Veces que quedó último vivo de su bando contra al menos un rival';
comment on column public.match_player_extra.weapon_kills is 'Kills a rivales por arma, {"awp": n, ...}, solo armas con kills';
comment on column public.match_player_extra.weapon_hs is 'Headshots a rivales por arma, {"deagle": n, ...}';

-- Mismas reglas que match_player_stats: todos leen, solo los admins cambian.
alter table public.match_round_log enable row level security;
alter table public.match_player_extra enable row level security;
drop policy if exists "round log: todos ven" on public.match_round_log;
drop policy if exists "round log: admin gestiona" on public.match_round_log;
drop policy if exists "extra: todos ven" on public.match_player_extra;
drop policy if exists "extra: admin gestiona" on public.match_player_extra;
create policy "round log: todos ven" on public.match_round_log for select using (true);
create policy "round log: admin gestiona" on public.match_round_log for all using (is_admin()) with check (is_admin());
create policy "extra: todos ven" on public.match_player_extra for select using (true);
create policy "extra: admin gestiona" on public.match_player_extra for all using (is_admin()) with check (is_admin());

-- ---------- funciones ----------
-- Un entero de una clave, o null si no viene o no es un número en el rango.
create or replace function public.csstv_jint_null(p jsonb, k text, p_max integer)
returns integer language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p -> k) = 'number' and (p ->> k)::numeric between 0 and p_max
              then (p ->> k)::numeric::integer end
$$;

-- {"arma": n} saneado: claves cortas en minúscula, valores entre 1 y 999, como mucho 40. null si no es un objeto.
create or replace function public.csstv_jcounts(p jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select case when jsonb_typeof(p) = 'object' then
    coalesce((select jsonb_object_agg(key, (value #>> '{}')::numeric::integer)
                from (select key, value from jsonb_each(p)
                       where key ~ '^[a-z0-9_]{1,24}$' and jsonb_typeof(value) = 'number'
                         and (value #>> '{}')::numeric between 1 and 999
                       order by key limit 40) e), '{}'::jsonb)
  end
$$;

-- Guarda los datos nuevos de un resultado ya insertado por csstv_ingest. Nunca hace fallar el resultado.
create or replace function public.csstv_match_extra(p_match uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  pl jsonb;
  c  jsonb;
begin
  if jsonb_typeof(p -> 'rounds') = 'array' then
    insert into match_round_log(match_id, rounds)
    select p_match, coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'n', csstv_jint_null(r, 'n', 500),
             'winner', case when r ->> 'winner' in ('a', 'b') then r ->> 'winner' end,
             'a_side', case when r ->> 'a_side' in ('CT', 'T') then r ->> 'a_side' end,
             'reason', csstv_jint_null(r, 'reason', 100),
             'a_eq', case when jsonb_typeof(r -> 'a_eq') = 'number' and (r ->> 'a_eq')::numeric between -1 and 50000
                          then (r ->> 'a_eq')::numeric::integer end,
             'b_eq', case when jsonb_typeof(r -> 'b_eq') = 'number' and (r ->> 'b_eq')::numeric between -1 and 50000
                          then (r ->> 'b_eq')::numeric::integer end)) order by ord), '[]'::jsonb)
      from jsonb_array_elements(p -> 'rounds') with ordinality as x(r, ord)
     where jsonb_typeof(r) = 'object' and ord <= 200
    on conflict (match_id) do nothing;
  end if;

  if jsonb_typeof(p -> 'players') = 'array' then
    for pl in select value from jsonb_array_elements(p -> 'players') limit 32 loop
      continue when jsonb_typeof(pl) <> 'object' or not (pl ? 'survived' or pl ? 'weapon_kills' or pl ? 'clutches');
      c := case when jsonb_typeof(pl -> 'clutches') = 'object' then pl -> 'clutches' end;
      insert into match_player_extra(match_id, steam_id, rounds_survived, rounds_won_ct, rounds_won_t, pistol_won, eco_won,
                                     bombs_exploded, clutch_1v1, clutch_1v2, clutch_1v3, clutch_1v4, clutch_1v5, clutch_tries,
                                     weapon_kills, weapon_hs)
      select s.match_id, s.steam_id,
             csstv_jint_null(pl, 'survived', 200), csstv_jint_null(pl, 'won_ct', 200), csstv_jint_null(pl, 'won_t', 200),
             csstv_jint_null(pl, 'pistol_won', 200), csstv_jint_null(pl, 'eco_won', 200), csstv_jint_null(pl, 'bombs_exploded', 200),
             csstv_jint_null(c, '1v1', 200), csstv_jint_null(c, '1v2', 200), csstv_jint_null(c, '1v3', 200),
             csstv_jint_null(c, '1v4', 200), csstv_jint_null(c, '1v5', 200), csstv_jint_null(pl, 'clutch_tries', 200),
             csstv_jcounts(pl -> 'weapon_kills'), csstv_jcounts(pl -> 'weapon_hs')
        from match_player_stats s
       where s.match_id = p_match   -- la misma clave que usa csstv_ingest
         and s.steam_id = coalesce(csstv_steam64(pl ->> 'steamid'), left(coalesce(nullif(pl ->> 'steamid', ''), 'desconocido'), 40))
      on conflict (match_id, steam_id) do nothing;
    end loop;
  end if;
exception when others then
  raise warning 'csstv_match_extra %: %', p_match, sqlerrm;   -- el resultado se guarda igual, sin los datos nuevos
end $$;

revoke all on function public.csstv_match_extra(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.csstv_jint_null(jsonb, text, integer) from public, anon, authenticated;
revoke all on function public.csstv_jcounts(jsonb) from public, anon, authenticated;

-- csstv_ingest: una línea antes del return final, sobre la definición instalada. En producción la función
-- tiene saltos de línea de Windows (\r\n), así que el ancla acepta los dos.
do $$
declare
  d text := pg_get_functiondef('public.csstv_ingest(uuid, jsonb)'::regprocedure);
  ancla text := E'(\\r?\\n)(  return v_id;\\r?\\nend)';
begin
  if position('csstv_match_extra' in d) > 0 then
    raise notice 'csstv_ingest ya llama a csstv_match_extra';
    return;
  end if;
  if (select count(*) from regexp_matches(d, ancla, 'g')) <> 1 then
    raise exception 'medallas: no se encontró una sola vez el return final de csstv_ingest';
  end if;
  d := regexp_replace(d, ancla, E'\\1  -- (medallas) armas, clutchs, rondas y equipamiento (reporter 2.7.0)\\1  perform csstv_match_extra(v_id, p);\\1\\1\\2');
  execute d;
end $$;

notify pgrst, 'reload schema';

commit;
