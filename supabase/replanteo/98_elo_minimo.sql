-- 98: mínimo de ELO por mix terminado (bitácora docs/bitacora/2026-11-09-elo-minimo-15/, Daniel 2026-11-09).
--
-- En un mix terminado (status finished, sin end_reason = 'crash', con ganador) y jugado desde
-- elo_config.min_delta_from, el que gana suma al menos min_delta y el que pierde resta al menos min_delta:
--   1. la parte base (TrueSkill) no baja de min_delta;
--   2. se suma el bonus por rating y todo se multiplica por su peso, como siempre;
--   3. mm_elo_delta (abandono, rendición) como siempre;
--   4. el total no baja de min_delta × peso (el que abandona cuenta como peso 1).
-- Los mixes interrumpidos (elo_crash_apply), los empates y los anteriores a min_delta_from siguen como antes.
-- mu y sigma no cambian. La sala muestra el mínimo en lo que se juega (mm_elo_stake).
--
-- Cambia elo_apply_match, elo_recompute_player y mm_elo_stake con reemplazos sobre su definición: si algún
-- fragmento no está, aborta. Después de aplicarla: notify pgrst y elo_recompute_all() (los mixes de la
-- Temporada 2 ya jugados reciben el mínimo).

begin;

alter table public.elo_config
  add column min_delta integer not null default 15 check (min_delta between 0 and 100),
  add column min_delta_from timestamptz;
comment on column public.elo_config.min_delta is 'Mínimo de ELO que suma o resta un mix terminado (0 lo apaga). Replanteo 98';
comment on column public.elo_config.min_delta_from is 'Desde cuándo vale min_delta (por played_at del mix; null = siempre). Replanteo 98';
update public.elo_config set min_delta_from = (select starts_at from public.seasons where number = 2) where id = 1;

-- El mínimo que le toca a un mix: 0 si no corresponde.
create function public.elo_min_for(p_match uuid) returns integer
  language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when c.min_delta > 0 and m.kind = 'mix' and m.status = 'finished'
                 and m.end_reason is distinct from 'crash' and m.winner_side in (1, 2)
                 and (c.min_delta_from is null or coalesce(m.played_at, m.starts_at) >= c.min_delta_from)
                then c.min_delta else 0 end
      from matches m, elo_config c
     where m.id = p_match and c.id = 1), 0) $$;
revoke all on function public.elo_min_for(uuid) from public, anon, authenticated;

do $$
declare
  f text;
  g text;
  procedure_pairs text[][];
  i int;
begin
  ---------------------------------------------------------------- elo_apply_match
  f := pg_get_functiondef('public.elo_apply_match'::regproc);
  procedure_pairs := array[
    array['  new_mu  double precision;' || chr(10) || 'begin',
          '  new_mu  double precision;' || chr(10) || '  v_min   integer;   -- (replanteo 98)' || chr(10) || 'begin'],
    array['  for r in' || chr(10) || '    select s.id, s.team, s.rating,',
          '  v_min := elo_min_for(p_match);   -- (replanteo 98)' || chr(10) || '  for r in' || chr(10) || '    select s.id, s.team, s.rating,'],
    array['    base  := round(2 * cfg.base * (res - p_team));',
          '    base  := round(2 * cfg.base * (res - p_team));' || chr(10) ||
          '    if v_min > 0 and res = 1 then base := greatest(base, v_min); elsif v_min > 0 and res = 0 then base := least(base, -v_min); end if;   -- (replanteo 98)'],
    array['delta := coalesce(mm_elo_delta(p_match, r.steam_id, r.team, res, p_team, delta), delta);',
          'delta := coalesce(mm_elo_delta(p_match, r.steam_id, r.team, res, p_team, delta), delta);' || chr(10) ||
          '    if v_min > 0 and res = 1 then delta := greatest(delta, round(v_min * r.wt)::int); elsif v_min > 0 and res = 0 then delta := least(delta, -round(v_min * r.wt)::int); end if;   -- (replanteo 98)']
  ];
  for i in 1 .. array_length(procedure_pairs, 1) loop
    if position(procedure_pairs[i][1] in f) = 0 then
      raise exception 'replanteo 98: elo_apply_match no tiene el fragmento %', i;
    end if;
    g := replace(f, procedure_pairs[i][1], procedure_pairs[i][2]);
    if g = f then raise exception 'replanteo 98: elo_apply_match sin cambio en el fragmento %', i; end if;
    f := g;
  end loop;
  execute f;

  ---------------------------------------------------------------- elo_recompute_player
  f := pg_get_functiondef('public.elo_recompute_player'::regproc);
  procedure_pairs := array[
    array['  n      integer := 0;' || chr(10) || 'begin',
          '  n      integer := 0;' || chr(10) || '  v_min  integer;   -- (replanteo 98)' || chr(10) || 'begin'],
    array['      base  := round(2 * cfg.base * (res - r.win_prob::double precision));',
          '      base  := round(2 * cfg.base * (res - r.win_prob::double precision));' || chr(10) ||
          '      v_min := elo_min_for(ev.mid);   -- (replanteo 98)' || chr(10) ||
          '      if v_min > 0 and res = 1 then base := greatest(base, v_min); elsif v_min > 0 and res = 0 then base := least(base, -v_min); end if;'],
    array['delta := coalesce(mm_elo_delta(ev.mid, p_key, r.team, res, r.win_prob::double precision, delta), delta);',
          'delta := coalesce(mm_elo_delta(ev.mid, p_key, r.team, res, r.win_prob::double precision, delta), delta);' || chr(10) ||
          '      if v_min > 0 and res = 1 then delta := greatest(delta, round(v_min * case when mm_elo_abandoned(ev.mid, p_key) then 1 else wt end)::int);' || chr(10) ||
          '      elsif v_min > 0 and res = 0 then delta := least(delta, -round(v_min * case when mm_elo_abandoned(ev.mid, p_key) then 1 else wt end)::int); end if;   -- (replanteo 98)']
  ];
  for i in 1 .. array_length(procedure_pairs, 1) loop
    if position(procedure_pairs[i][1] in f) = 0 then
      raise exception 'replanteo 98: elo_recompute_player no tiene el fragmento %', i;
    end if;
    f := replace(f, procedure_pairs[i][1], procedure_pairs[i][2]);
  end loop;
  execute f;

  ---------------------------------------------------------------- mm_elo_stake
  f := pg_get_functiondef('public.mm_elo_stake'::regproc);
  procedure_pairs := array[
    array['  v_base integer;' || chr(10) || 'begin',
          '  v_base integer;' || chr(10) || '  v_min  integer;   -- (replanteo 98)' || chr(10) || 'begin'],
    array['  v_base := coalesce((select base from elo_config where id = 1), 30);',
          '  v_base := coalesce((select base from elo_config where id = 1), 30);' || chr(10) ||
          '  v_min  := coalesce((select min_delta from elo_config where id = 1 and coalesce(min_delta_from, now()) <= now()), 0);   -- (replanteo 98)'],
    array['jsonb_build_object(''win'', greatest(round(2 * v_base * (1 - p))::int, 1), ''loss'', greatest(round(2 * v_base * p)::int, 1))',
          'jsonb_build_object(''win'', greatest(round(2 * v_base * (1 - p))::int, v_min, 1), ''loss'', greatest(round(2 * v_base * p)::int, v_min, 1))']
  ];
  for i in 1 .. array_length(procedure_pairs, 1) loop
    if position(procedure_pairs[i][1] in f) = 0 then
      raise exception 'replanteo 98: mm_elo_stake no tiene el fragmento %', i;
    end if;
    f := replace(f, procedure_pairs[i][1], procedure_pairs[i][2]);
  end loop;
  execute f;
end $$;

commit;
