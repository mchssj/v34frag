-- Replanteo 128: el admin bloquea jugadores en el matchmaking sin límites (Daniel, 2026-11-18).
-- Bitácora: docs/bitacora/2026-11-18-bloqueo-admin-sin-limite/
--
-- 1. mm_block: un admin (is_admin()) no pasa por "exclusivo para VIP", el máximo de bloqueos (max_blocks, aunque esté
--    en 0) ni los cambios por semana (block_changes_week). Lo demás queda igual que en la 104: no a sí mismo, el
--    registro en mm_block_log y el corte de amistad (85).
-- 2. mm_my_profile: al admin le manda blocks.max = null (sin tope), vip_only = false, allowed = true y changes = null.
--    El armado (mm_best_split_ex) no cambia: sus bloqueos siguen siendo blandos, como los de cualquiera.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/128_mm_bloqueo_admin_sin_limite.sql
begin;

create or replace function public.mm_block(p_player uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  c mm_config%rowtype;
  v jsonb;
begin
  select * into c from mm_config;
  if (select user_id from players where id = p_player) = auth.uid() then raise exception 'No te podés bloquear a vos mismo'; end if;
  -- Ya lo tenía bloqueado: no gasta un cambio.
  if exists (select 1 from mm_blocks where user_id = auth.uid() and player_id = p_player) then return; end if;
  -- (replanteo 128) El admin no tiene límites.
  if not is_admin() then
    if c.blocks_vip_only and not is_vip(auth.uid()) then raise exception 'El bloqueo es exclusivo para VIP'; end if;
    if (select count(*) from mm_blocks where user_id = auth.uid()) >= c.max_blocks then raise exception 'Ya usaste todos tus bloqueos'; end if;
    -- (replanteo 104) block_changes_week bloqueos nuevos en 7 días.
    v := mm_block_changes(auth.uid());
    if (v ->> 'changes_left')::int = 0 then
      raise exception 'Ya cambiaste tu bloqueo % veces en los últimos 7 días', c.block_changes_week
        using errcode = 'V8904', detail = jsonb_build_object('next_change_at', v -> 'next_change_at')::text;
    end if;
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
    array['''max'', c.max_blocks, ''vip_only'', c.blocks_vip_only, ''allowed'', not c.blocks_vip_only or v_vip,',
          '''max'', case when not is_admin() then c.max_blocks end, ''vip_only'', c.blocks_vip_only and not is_admin(),' ||
          ' ''allowed'', not c.blocks_vip_only or v_vip or is_admin(),   -- (replanteo 128) el admin sin límites'],
    array['''changes'', mm_block_changes(me),',
          '''changes'', case when not is_admin() then mm_block_changes(me) end,']
  ];
  i int;
begin
  for i in 1 .. array_length(pares, 1) loop
    if position(pares[i][1] in f) = 0 then
      raise exception 'replanteo 128: mm_my_profile no tiene el fragmento %', i;
    end if;
    f := replace(f, pares[i][1], pares[i][2]);
  end loop;
  execute f;
end $$;

commit;
