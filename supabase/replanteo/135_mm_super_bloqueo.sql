-- Replanteo 135: super bloqueo del admin en el matchmaking (Daniel, 2026-11-22).
-- Bitácora: docs/bitacora/2026-11-22-super-bloqueo/
--
-- 1. mm_blocks.super: un admin marca un bloqueo suyo con mm_block_super(ficha, on/off).
-- 2. mm_best_split_ex: los super bloqueos (de quien hoy es admin) se respetan siempre, sin el margen de ELO de la 104.
--    Solo si ningún reparto los respeta a todos (un grupo no se separa) se rompen los menos posibles.
--    Los bloqueos normales siguen igual.
-- 3. mm_my_profile: blocks.list[].super.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/135_mm_super_bloqueo.sql
begin;

alter table public.mm_blocks add column super boolean not null default false;
comment on column public.mm_blocks.super is 'Super bloqueo (solo admin): se respeta aunque los equipos queden desparejos. Replanteo 135';

create function public.mm_block_super(p_player uuid, p_on boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'El super bloqueo es solo para admins' using errcode = '42501'; end if;
  update mm_blocks set super = p_on where user_id = auth.uid() and player_id = p_player;
  if not found then raise exception 'Primero bloqueá a ese jugador'; end if;
end $$;
revoke all on function public.mm_block_super(uuid, boolean) from public, anon;
grant execute on function public.mm_block_super(uuid, boolean) to authenticated;

create or replace function public.mm_best_split_ex(p_users uuid[], p_elos integer[], p_parties uuid[], p_size integer) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  n int := cardinality(p_users);
  v_margin int := coalesce((select block_margin from mm_config), 100);
  -- Bloqueos dentro de la sala: posiciones del que bloquea y del bloqueado, y un peso por antigüedad (el más reciente
  -- pesa 1, el anterior 2, 4...): con los mismos bloqueos rotos, conviene romper los más recientes.
  bi int[]; bj int[]; bw bigint[];
  bh boolean[];   -- (replanteo 135) super bloqueo de un admin
  nb int;
  masks int[] := '{}'; diffs int[] := '{}'; broken int[] := '{}'; weights bigint[] := '{}';
  hards int[] := '{}';
  sides smallint[];
  mask int; i int; j int; k int;
  sum1 int; sum2 int; cnt int; ok boolean;
  v_k int; v_w bigint; v_h int;
  h0 int;
  d0 int;
  best int;
  ign jsonb := '[]';
begin
  select coalesce(array_agg(x.a order by x.rn), '{}'), coalesce(array_agg(x.b order by x.rn), '{}'),
         coalesce(array_agg((2::bigint ^ least(x.rn - 1, 61))::bigint order by x.rn), '{}'),
         coalesce(array_agg(x.h order by x.rn), '{}')
    into bi, bj, bw, bh
    from (select a.o::int a, b.o::int b, row_number() over (order by bl.created_at desc, a.o, b.o) rn,
                 bl.super and exists (select 1 from profiles pr where pr.id = bl.user_id and pr.role = 'admin') h
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
    v_k := 0; v_w := 0; v_h := 0;
    for k in 1..nb loop
      if (case when bi[k] = 1 then 1 else ((mask >> (bi[k] - 2)) & 1) end) = (case when bj[k] = 1 then 1 else ((mask >> (bj[k] - 2)) & 1) end) then
        v_k := v_k + 1; v_w := v_w + bw[k];
        if bh[k] then v_h := v_h + 1; end if;
      end if;
    end loop;
    masks := masks || mask; diffs := diffs || abs(sum1 - sum2); broken := broken || v_k; weights := weights || v_w;
    hards := hards || v_h;
  end loop;
  if cardinality(masks) = 0 then return null; end if;

  -- (replanteo 135) Solo cuentan los repartos que rompen menos super bloqueos (normalmente ninguno), sin margen.
  select min(h) into h0 from unnest(hards) h;
  select min(diffs[s]) into d0 from generate_subscripts(diffs, 1) s where hards[s] = h0;
  -- Dentro del margen: el que rompe menos bloqueos, después los más recientes, después la menor diferencia.
  for i in 1..cardinality(masks) loop
    continue when hards[i] > h0 or diffs[i] > d0 + v_margin;
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

do $$
declare
  f text := pg_get_functiondef('public.mm_my_profile'::regproc);
  a text := 'jsonb_build_object(''player_id'', p.id, ''nick'', p.nick)), ''[]'') from mm_blocks b';
begin
  if position(a in f) = 0 then raise exception 'replanteo 135: mm_my_profile no tiene la lista de bloqueos'; end if;
  execute replace(f, a, 'jsonb_build_object(''player_id'', p.id, ''nick'', p.nick, ''super'', b.super)), ''[]'') from mm_blocks b');
end $$;

commit;
