-- Prueba del replanteo 147 en la copia local, sin dejar nada: todo va en una transacción que termina en rollback.
-- Uso: (sed '/^begin;$/d; /^commit;$/d' 147_baneo_ficha_sin_steamid.sql; cat prueba_147.sql) | psql -v ON_ERROR_STOP=1
-- (el psql de afuera abre la transacción con el begin de abajo antes de pegar la 147: ver GUIA_IMPLEMENTACION.md).
-- Un servidor de mentira para csstv_bans_since: se deshace con el rollback.
create or replace function public.csstv_auth(p_token text) returns uuid language sql as $f$ select null::uuid $f$;

do $$
declare
  v_admin uuid := (select id from profiles where role = 'admin' limit 1);
  v_mod uuid := (select id from profiles where role in ('moderator') limit 1);
  v_sup uuid := (select id from profiles where role = 'support' limit 1);
  v_p uuid; v_user uuid; v_b1 uuid; v_b2 uuid; v_steam text := '76561198999999901'; r jsonb; n int; q jsonb;
begin
  -- Una ficha con cuenta y sin SteamID, sin baneos.
  select p.id, p.user_id into v_p, v_user from players p
   where p.steam_id is null and p.user_id is not null
     and not exists (select 1 from player_extra_steam_ids x where x.player_id = p.id)
     and not exists (select 1 from bans b where b.player_id = p.id) limit 1;
  raise notice 'ficha % cuenta %', v_p, v_user;

  -- 1. Un moderador (o el admin) la banea.
  perform set_config('request.jwt.claims', json_build_object('sub', coalesce(v_mod, v_admin), 'role', 'authenticated')::text, true);
  v_b1 := ban_create(v_p, null, 'Prueba 147', now() + interval '1 day');
  assert (select steam_id from bans where id = v_b1) is null, 'el baneo debería quedar sin SteamID';
  assert (select player_id from bans where id = v_b1) = v_p, 'el baneo debería ser de la ficha';
  assert mm_block_reason(v_user) = 'Tenés un baneo activo en los servidores', 'mm_block_reason: ' || coalesce(mm_block_reason(v_user), 'null');
  assert mm_user_banned(v_user), 'mm_user_banned debería dar true';
  assert (select status from ban_list where id = v_b1) = 'active', 'ban_list';
  raise notice 'OK 1: baneada, sin SteamID, bloqueada en el matchmaking';

  -- 2. Otro baneo reemplaza al primero.
  v_b2 := ban_create(v_p, null, 'Prueba 147 bis', now() + interval '2 days');
  assert (select replaced_by from bans where id = v_b1) = v_b2, 'el nuevo debería reemplazar al anterior';
  assert (select count(*) from ban_active_target(v_p, null)) = 1, 'un solo activo';
  raise notice 'OK 2: el nuevo reemplaza al anterior';

  -- 3. La sincronización no manda filas sin SteamID.
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from bans b, unnest(ban_steams(b.player_id, b.steam_id)) s where b.id = v_b2;
  assert n = 0, 'ban_steams sin SteamID debería venir vacío';
  assert not exists (select 1 from unnest(ban_steams(v_p, null)) s where s is null), 'ban_steams sin null';
  raise notice 'OK 3: ban_steams vacío';

  -- 4. Vincula un SteamID: el servidor lo ve baneado y la sincronización desde antes lo manda.
  -- Como si fuera viejo: bans_touch pisaría updated_at.
  alter table bans disable trigger bans_touch;
  update bans set updated_at = now() - interval '1 hour' where id = v_b2;
  alter table bans enable trigger bans_touch;
  update players set steam_id = v_steam, steam_added_at = now() where id = v_p;
  assert exists (select 1 from ban_active_for(v_steam) where id = v_b2), 'ban_active_for por el SteamID nuevo';
  -- csstv_auth de prueba (ver arriba): cursor de hace 5 minutos, antes del !claim y después del último cambio del baneo.
  r := csstv_bans_since('prueba', (now() - interval '5 minutes')::text);
  select count(*) into n from jsonb_array_elements(r->'items') i where i->>'ban_id' = v_b2::text and i->>'steam64' = v_steam;
  assert not exists (select 1 from jsonb_array_elements(r->'items') i where i->>'steam64' is null), 'sin filas sin SteamID';
  assert n = 1, 'la sincronización debería traer el SteamID nuevo';
  raise notice 'OK 4: con SteamID, el servidor lo ve baneado';

  -- 5. El soporte, sobre otra ficha sin SteamID: el cupo y el "ya está baneado".
  if v_sup is not null then
    select p.id into v_p from players p
     where p.steam_id is null and p.user_id is not null and p.id <> v_p
       and not exists (select 1 from player_extra_steam_ids x where x.player_id = p.id)
       and not exists (select 1 from bans b where b.player_id = p.id) limit 1;
    perform set_config('request.jwt.claims', json_build_object('sub', v_sup, 'role', 'authenticated')::text, true);
    q := ban_support_quota(v_p, null);
    assert (q->>'used')::int = 0 and not (q->>'banned')::boolean, 'cupo inicial ' || q::text;
    v_b1 := ban_create(v_p, null, 'Prueba 147 soporte', now() + interval '30 minutes');
    q := ban_support_quota(v_p, null);
    assert (q->>'used')::int = 1 and (q->>'banned')::boolean, 'cupo después ' || q::text;
    begin
      perform ban_create(v_p, null, 'Prueba 147 soporte 2', now() + interval '30 minutes');
      raise exception 'debería fallar: ya está baneado';
    exception when sqlstate 'P0001' then
      if sqlerrm not like 'Ya está baneado%' then raise; end if;
    end;
    raise notice 'OK 5: límites del soporte sin SteamID';
  else
    raise notice 'Sin cuenta de soporte: se saltea el 5';
  end if;

  -- 6. No queda un baneo sin ficha ni SteamID.
  begin
    insert into bans (player_id, steam_id, reason, source) values (null, null, 'x', 'web');
    raise exception 'debería fallar: bans_destino';
  exception when check_violation then null;
  end;
  raise notice 'OK 6: bans_destino';
end $$;
rollback;
