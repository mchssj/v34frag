-- 104: el bloqueo de los VIP no puede desarmar una partida (bitácora docs/bitacora/2026-11-09-bloqueo-blando/, Daniel y Kyan 2026-11-09).
--
-- 1. Bloqueo blando. mm_best_split_ex prueba todos los repartos que no separan un grupo y calcula d0, la mejor
--    diferencia sin mirar los bloqueos. De los repartos con diferencia <= d0 + mm_config.block_margin (100), elige el
--    que rompe menos bloqueos; si empatan, rompe los más recientes; después, el de menor diferencia. Si respetar todos
--    entra en el margen, es lo mismo que antes. Un grupo nunca se separa.
-- 2. mm_try_build guarda los bloqueos ignorados (mm_lobby_block_ignored) y avisa solo al que bloqueó (mm_block_ignored,
--    categoría elo: "Mixes y ELO"; la API no conoce la categoría mm).
-- 3. Límite: block_changes_week (5) bloqueos nuevos en los últimos 7 días por cuenta; desbloquear no cuenta. Al pasarse,
--    error V8904 con detail {"next_change_at": …} (la API lo devuelve como 409 CONFLICT con details).
--    mm_block_log guarda los bloqueos y desbloqueos (se borra a los 90 días en mm_tick).
-- 4. mm_my_profile: blocks.changes_week, changes_left y next_change_at. mm_set_config y manual_valores con los valores.
--
-- Respaldo de las funciones en replanteo104_funciones, para la inversa.

begin;

create table public.replanteo104_funciones (nombre text primary key, def text not null);
alter table public.replanteo104_funciones enable row level security;
insert into public.replanteo104_funciones(nombre, def)
select p.proname, pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('mm_best_split', 'mm_try_build', 'mm_block', 'mm_unblock', 'mm_my_profile', 'mm_tick', 'mm_set_config',
                     'manual_valores', 'notification_category');
do $$ begin
  if (select count(*) from public.replanteo104_funciones) <> 9 then
    raise exception 'replanteo 104: falta alguna función para respaldar (¿hay sobrecargas?)';
  end if;
end $$;

alter table public.mm_config
  add column block_margin integer not null default 100 check (block_margin between 0 and 2000),
  add column block_changes_week integer not null default 5 check (block_changes_week between 0 and 50);
comment on column public.mm_config.block_margin is 'Cuánto puede empeorar la diferencia de ELO de armado (en total) por respetar los bloqueos. Replanteo 104';
comment on column public.mm_config.block_changes_week is 'Bloqueos nuevos por cuenta en 7 días (0: sin límite). Replanteo 104';

create table public.mm_block_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  action text not null check (action in ('block', 'unblock')),
  at timestamptz not null default now()
);
create index mm_block_log_user_at on public.mm_block_log (user_id, at);
alter table public.mm_block_log enable row level security;   -- sin políticas: solo las funciones
comment on table public.mm_block_log is 'Bloqueos y desbloqueos del matchmaking, para el límite semanal (90 días). Replanteo 104';
-- Los bloqueos actuales cuentan con su fecha.
insert into public.mm_block_log (user_id, player_id, action, at) select user_id, player_id, 'block', created_at from public.mm_blocks;

create table public.mm_lobby_block_ignored (
  lobby_id uuid not null references public.mm_lobbies(id) on delete cascade,
  user_id uuid not null,
  player_id uuid not null,
  primary key (lobby_id, user_id, player_id)
);
alter table public.mm_lobby_block_ignored enable row level security;   -- sin políticas: solo las funciones
comment on table public.mm_lobby_block_ignored is 'Bloqueos que no se respetaron al armar la sala (quién bloqueó y a qué ficha). Replanteo 104';

---------------------------------------------------------------------------------------------------- reparto
create function public.mm_best_split_ex(p_users uuid[], p_elos integer[], p_parties uuid[], p_size integer) returns jsonb
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

create or replace function public.mm_best_split(p_users uuid[], p_elos integer[], p_parties uuid[], p_size integer) returns smallint[]
  language sql stable security definer set search_path = public as $$
  -- (replanteo 104) con el bloqueo blando de mm_best_split_ex
  select case when x is null then null else array(select (jsonb_array_elements_text(x -> 'sides'))::smallint) end
    from mm_best_split_ex(p_users, p_elos, p_parties, p_size) x $$;

---------------------------------------------------------------------------------------------------- límite semanal
-- Cuántos bloqueos nuevos le quedan en la ventana de 7 días y cuándo se libera el próximo (null si le quedan).
create function public.mm_block_changes(p_user uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  with c as (select block_changes_week w from mm_config),
  r as (select at from mm_block_log, c where user_id = p_user and action = 'block' and at > now() - interval '7 days'
         order by at desc limit (select greatest(w, 1) from c))
  select jsonb_build_object(
    'changes_week', c.w,
    'changes_left', case when c.w = 0 then null else greatest(c.w - (select count(*) from r), 0) end,
    'next_change_at', case when c.w > 0 and (select count(*) from r) >= c.w then (select min(at) from r) + interval '7 days' end)
  from c $$;
revoke all on function public.mm_block_changes(uuid) from public, anon, authenticated;

create or replace function public.mm_block(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  c mm_config%rowtype;
  v jsonb;
begin
  select * into c from mm_config;
  if c.blocks_vip_only and not is_vip(auth.uid()) then raise exception 'El bloqueo es exclusivo para VIP'; end if;
  if (select user_id from players where id = p_player) = auth.uid() then raise exception 'No te podés bloquear a vos mismo'; end if;
  -- Ya lo tenía bloqueado: no gasta un cambio.
  if exists (select 1 from mm_blocks where user_id = auth.uid() and player_id = p_player) then return; end if;
  if (select count(*) from mm_blocks where user_id = auth.uid()) >= c.max_blocks then raise exception 'Ya usaste todos tus bloqueos'; end if;
  -- (replanteo 104) block_changes_week bloqueos nuevos en 7 días.
  v := mm_block_changes(auth.uid());
  if (v ->> 'changes_left')::int = 0 then
    raise exception 'Ya cambiaste tu bloqueo % veces en los últimos 7 días', c.block_changes_week
      using errcode = 'V8904', detail = jsonb_build_object('next_change_at', v -> 'next_change_at')::text;
  end if;
  insert into mm_blocks (user_id, player_id) values (auth.uid(), p_player) on conflict do nothing;
  insert into mm_block_log (user_id, player_id, action) values (auth.uid(), p_player, 'block');
  -- (replanteo 85) Ya no son amigos ni quedan solicitudes entre los dos.
  perform mm_friend_cut(p_player);
end $$;

create or replace function public.mm_unblock(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  delete from mm_blocks where user_id = auth.uid() and player_id = p_player;
  if found then
    insert into mm_block_log (user_id, player_id, action) values (auth.uid(), p_player, 'unblock');   -- (replanteo 104)
  end if;
end $$;

---------------------------------------------------------------------------------------------------- reemplazos de texto
do $$
declare
  f text;
  g text;
  pares text[][];
  i int;
  fn text;
begin
  foreach fn in array array['mm_try_build', 'mm_my_profile', 'mm_tick', 'mm_set_config', 'manual_valores', 'notification_category'] loop
    f := pg_get_functiondef(('public.' || fn)::regproc);
    if fn = 'mm_try_build' then
      pares := array[
        array['  teams smallint[];' || chr(10),
              '  teams smallint[];' || chr(10) || '  v_split jsonb;   -- (replanteo 104)' || chr(10) || '  v_ign jsonb;' || chr(10)],
        array['    teams := mm_best_split(v_users, coalesce(v_bal, v_elos), v_parties, v_size);',
              '    -- (replanteo 104) Bloqueo blando: puede ignorar bloqueos que desarman la partida.' || chr(10) ||
              '    v_split := mm_best_split_ex(v_users, coalesce(v_bal, v_elos), v_parties, v_size);' || chr(10) ||
              '    teams := case when v_split is null then null else array(select (jsonb_array_elements_text(v_split -> ''sides''))::smallint) end;'],
        array['    -- (replanteo 59) Con esto la web abre',
              '    -- (replanteo 104) Los bloqueos que no se respetaron: registro y aviso solo al que bloqueó.' || chr(10) ||
              '    for v_ign in select jsonb_array_elements(coalesce(v_split -> ''ignored'', ''[]'')) loop' || chr(10) ||
              '      insert into mm_lobby_block_ignored (lobby_id, user_id, player_id)' || chr(10) ||
              '        select v_lobby, (v_ign ->> 0)::uuid, lp.player_id from mm_lobby_players lp' || chr(10) ||
              '         where lp.lobby_id = v_lobby and lp.user_id = (v_ign ->> 1)::uuid and lp.player_id is not null' || chr(10) ||
              '        on conflict do nothing;' || chr(10) ||
              '      perform notify(array[(v_ign ->> 0)::uuid], ''mm_block_ignored'',' || chr(10) ||
              '        jsonb_build_object(''lobby'', v_lobby, ''player'', (select jsonb_build_object(''id'', p.id, ''alias'', p.nick)' || chr(10) ||
              '          from mm_lobby_players lp join players p on p.id = lp.player_id where lp.lobby_id = v_lobby and lp.user_id = (v_ign ->> 1)::uuid)),' || chr(10) ||
              '        ''mm_block_ignored:'' || v_lobby || '':'' || (v_ign ->> 1), true);' || chr(10) ||
              '    end loop;' || chr(10) ||
              '    -- (replanteo 59) Con esto la web abre']
      ];
    elsif fn = 'mm_my_profile' then
      pares := array[
        array['''blocks'', jsonb_build_object(''max'', c.max_blocks, ''vip_only'', c.blocks_vip_only, ''allowed'', not c.blocks_vip_only or v_vip,',
              '''blocks'', jsonb_build_object(''max'', c.max_blocks, ''vip_only'', c.blocks_vip_only, ''allowed'', not c.blocks_vip_only or v_vip,' || chr(10) ||
              '        ''changes'', mm_block_changes(me),   -- (replanteo 104)']
      ];
    elsif fn = 'mm_tick' then
      pares := array[
        array['  delete from mm_balance_override_log where at < now() - interval ''1 year'';' || chr(10),
              '  delete from mm_balance_override_log where at < now() - interval ''1 year'';' || chr(10) ||
              '  -- (replanteo 104) el historial de bloqueos se guarda 90 días' || chr(10) ||
              '  delete from mm_block_log where at < now() - interval ''90 days'';' || chr(10)]
      ];
    elsif fn = 'mm_set_config' then
      pares := array[
        array['    replace_vote_cooldown_s = coalesce((p->>''replace_vote_cooldown_s'')::int, replace_vote_cooldown_s)' || chr(10),
              '    replace_vote_cooldown_s = coalesce((p->>''replace_vote_cooldown_s'')::int, replace_vote_cooldown_s),' || chr(10) ||
              '    -- (replanteo 104) bloqueo blando y límite semanal' || chr(10) ||
              '    block_margin = coalesce((p->>''block_margin'')::int, block_margin),' || chr(10) ||
              '    block_changes_week = coalesce((p->>''block_changes_week'')::int, block_changes_week)' || chr(10)]
      ];
    elsif fn = 'manual_valores' then
      pares := array[
        array['    ''mm.sanciones'', to_jsonb(m.penalty_ladder),',
              '    ''mm.sanciones'', to_jsonb(m.penalty_ladder),' || chr(10) ||
              '    ''mm.bloqueo_margen'', m.block_margin, ''mm.bloqueo_cambios'', m.block_changes_week,   -- (replanteo 104)']
      ];
    else
      pares := array[
        array['  select case' || chr(10),
              '  select case' || chr(10) || '    when p_type in (''mm_block_ignored'') then ''elo'' -- (replanteo 104)' || chr(10)]
      ];
    end if;
    for i in 1 .. array_length(pares, 1) loop
      if position(pares[i][1] in f) = 0 then
        raise exception 'replanteo 104: % no tiene el fragmento %', fn, i;
      end if;
      g := replace(f, pares[i][1], pares[i][2]);
      f := g;
    end loop;
    execute f;
  end loop;
end $$;

commit;
