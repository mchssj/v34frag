-- Inversa del replanteo 128: el admin vuelve a tener los límites del bloqueo como cualquiera (mm_block de la 104).
-- Los bloqueos que el admin ya tiene de más se quedan; solo no puede sumar nuevos.
begin;

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

do $$
declare
  f text := pg_get_functiondef('public.mm_my_profile'::regproc);
  pares text[][] := array[
    array['''max'', case when not is_admin() then c.max_blocks end, ''vip_only'', c.blocks_vip_only and not is_admin(),' ||
          ' ''allowed'', not c.blocks_vip_only or v_vip or is_admin(),   -- (replanteo 128) el admin sin límites',
          '''max'', c.max_blocks, ''vip_only'', c.blocks_vip_only, ''allowed'', not c.blocks_vip_only or v_vip,'],
    array['''changes'', case when not is_admin() then mm_block_changes(me) end,',
          '''changes'', mm_block_changes(me),']
  ];
  i int;
begin
  for i in 1 .. array_length(pares, 1) loop
    if position(pares[i][1] in f) = 0 then
      raise exception 'inversa 128: mm_my_profile no tiene el fragmento %', i;
    end if;
    f := replace(f, pares[i][1], pares[i][2]);
  end loop;
  execute f;
end $$;

commit;
