-- Inversa de la 98: saca el mínimo de ELO. Después, elo_recompute_all() para devolver los mixes al cálculo anterior.

begin;

do $$
declare
  f text;
  pares text[][];
  i int;
  fn text;
begin
  foreach fn in array array['elo_apply_match', 'elo_recompute_player', 'mm_elo_stake'] loop
    f := pg_get_functiondef(('public.' || fn)::regproc);
    if fn = 'elo_apply_match' then
      pares := array[
        array[chr(10) || '  v_min   integer;   -- (replanteo 98)', ''],
        array['  v_min := elo_min_for(p_match);   -- (replanteo 98)' || chr(10), ''],
        array[chr(10) || '    if v_min > 0 and res = 1 then base := greatest(base, v_min); elsif v_min > 0 and res = 0 then base := least(base, -v_min); end if;   -- (replanteo 98)', ''],
        array[chr(10) || '    if v_min > 0 and res = 1 then delta := greatest(delta, round(v_min * r.wt)::int); elsif v_min > 0 and res = 0 then delta := least(delta, -round(v_min * r.wt)::int); end if;   -- (replanteo 98)', '']
      ];
    elsif fn = 'elo_recompute_player' then
      pares := array[
        array[chr(10) || '  v_min  integer;   -- (replanteo 98)', ''],
        array[chr(10) || '      v_min := elo_min_for(ev.mid);   -- (replanteo 98)' || chr(10) ||
              '      if v_min > 0 and res = 1 then base := greatest(base, v_min); elsif v_min > 0 and res = 0 then base := least(base, -v_min); end if;', ''],
        array[chr(10) || '      if v_min > 0 and res = 1 then delta := greatest(delta, round(v_min * case when mm_elo_abandoned(ev.mid, p_key) then 1 else wt end)::int);' || chr(10) ||
              '      elsif v_min > 0 and res = 0 then delta := least(delta, -round(v_min * case when mm_elo_abandoned(ev.mid, p_key) then 1 else wt end)::int); end if;   -- (replanteo 98)', '']
      ];
    else
      pares := array[
        array[chr(10) || '  v_min  integer;   -- (replanteo 98)', ''],
        array[chr(10) || '  v_min  := coalesce((select min_delta from elo_config where id = 1 and coalesce(min_delta_from, now()) <= now()), 0);   -- (replanteo 98)', ''],
        array['greatest(round(2 * v_base * (1 - p))::int, v_min, 1)', 'greatest(round(2 * v_base * (1 - p))::int, 1)'],
        array['greatest(round(2 * v_base * p)::int, v_min, 1)', 'greatest(round(2 * v_base * p)::int, 1)']
      ];
    end if;
    for i in 1 .. array_length(pares, 1) loop
      if position(pares[i][1] in f) = 0 then
        raise exception 'inversa 98: % no tiene el fragmento %', fn, i;
      end if;
      f := replace(f, pares[i][1], pares[i][2]);
    end loop;
    if position('replanteo 98' in f) > 0 then raise exception 'inversa 98: % quedó con restos', fn; end if;
    execute f;
  end loop;
end $$;

drop function public.elo_min_for(uuid);
alter table public.elo_config drop column min_delta, drop column min_delta_from;

commit;
