-- Inversa del replanteo 135: sin super bloqueo. mm_best_split_ex vuelve a la de la 104 y mm_my_profile sin 'super'.
-- Se pierden las marcas de super bloqueo; los bloqueos quedan como normales.
begin;

do $$
declare
  f text := pg_get_functiondef('public.mm_my_profile'::regproc);
  a text := 'jsonb_build_object(''player_id'', p.id, ''nick'', p.nick, ''super'', b.super)), ''[]'') from mm_blocks b';
begin
  if position(a in f) = 0 then raise exception 'inversa 135: mm_my_profile no tiene la lista con super'; end if;
  execute replace(f, a, 'jsonb_build_object(''player_id'', p.id, ''nick'', p.nick)), ''[]'') from mm_blocks b');
end $$;

-- mm_best_split_ex de la 104.
create or replace function public.mm_best_split_ex(p_users uuid[], p_elos integer[], p_parties uuid[], p_size integer) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  n int := cardinality(p_users);
  v_margin int := coalesce((select block_margin from mm_config), 100);
  -- Bloqueos dentro de la sala: posiciones del que bloquea y del bloqueado, y un peso por antigüedad (el más reciente
  -- pesa 1, el anterior 2, 4...): con los mismos bloqueos rotos, conviene romper los más recientes.
  bi int[]; bj int[]; bw bigint[];
  nb int;
  masks int[] := '{}'; diffs int[] := '{}'; broken int[] := '{}'; weights bigint[] := '{}';
  sides smallint[];
  mask int; i int; j int; k int;
  sum1 int; sum2 int; cnt int; ok boolean;
  v_k int; v_w bigint;
  d0 int;
  best int;
  ign jsonb := '[]';
begin
  select coalesce(array_agg(x.a order by x.rn), '{}'), coalesce(array_agg(x.b order by x.rn), '{}'),
         coalesce(array_agg((2::bigint ^ least(x.rn - 1, 61))::bigint order by x.rn), '{}')
    into bi, bj, bw
    from (select a.o::int a, b.o::int b, row_number() over (order by bl.created_at desc, a.o, b.o) rn
            from unnest(p_users) with ordinality a(u, o)
            join mm_blocks bl on bl.user_id = a.u
            join players pl on pl.id = bl.player_id
            join unnest(p_users) with ordinality b(u, o) on b.u = pl.user_id) x;
  nb := cardinality(bi);

  -- El jugador 1 queda siempre en el equipo 1: las demás combinaciones son espejadas.
  for mask in 0..(1 << (n - 1)) - 1 loop
    cnt := 1; sum1 := p_elos[1]; sum2 := 0;
    for i in 2..n loop
      if (mask >> (i - 2)) & 1 = 1 then cnt := cnt + 1; sum1 := sum1 + p_elos[i]; else sum2 := sum2 + p_elos[i]; end if;
    end loop;
    if cnt <> p_size then continue; end if;
    -- Un grupo nunca se separa.
    ok := true;
    for i in 1..n loop
      for j in i + 1..n loop
        if p_parties[i] = p_parties[j]
           and (case when i = 1 then 1 else ((mask >> (i - 2)) & 1) end) <> (case when j = 1 then 1 else ((mask >> (j - 2)) & 1) end) then
          ok := false;
        end if;
      end loop;
    end loop;
    if not ok then continue; end if;
    -- Bloqueos que rompe este reparto (los dos en el mismo equipo).
    v_k := 0; v_w := 0;
    for k in 1..nb loop
      if (case when bi[k] = 1 then 1 else ((mask >> (bi[k] - 2)) & 1) end) = (case when bj[k] = 1 then 1 else ((mask >> (bj[k] - 2)) & 1) end) then
        v_k := v_k + 1; v_w := v_w + bw[k];
      end if;
    end loop;
    masks := masks || mask; diffs := diffs || abs(sum1 - sum2); broken := broken || v_k; weights := weights || v_w;
  end loop;
  if cardinality(masks) = 0 then return null; end if;

  select min(d) into d0 from unnest(diffs) d;
  -- Dentro del margen: el que rompe menos bloqueos, después los más recientes, después la menor diferencia.
  for i in 1..cardinality(masks) loop
    continue when diffs[i] > d0 + v_margin;
    if best is null or (broken[i], weights[i], diffs[i]) < (broken[best], weights[best], diffs[best]) then best := i; end if;
  end loop;

  sides := array[1]::smallint[];
  for i in 2..n loop
    sides := sides || (case when (masks[best] >> (i - 2)) & 1 = 1 then 1 else 2 end)::smallint;
  end loop;
  for k in 1..nb loop
    if sides[bi[k]] = sides[bj[k]] then ign := ign || jsonb_build_array(jsonb_build_array(p_users[bi[k]], p_users[bj[k]])); end if;
  end loop;
  return jsonb_build_object('sides', to_jsonb(sides), 'ignored', ign, 'diff', diffs[best], 'diff_free', d0);
end $$;
revoke all on function public.mm_best_split_ex(uuid[], integer[], uuid[], integer) from public, anon, authenticated;

drop function public.mm_block_super(uuid, boolean);
alter table public.mm_blocks drop column super;

commit;
