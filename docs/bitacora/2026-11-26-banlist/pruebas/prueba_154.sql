-- Prueba del replanteo 154, en una transacción que termina en rollback. Como supabase_admin.
reset role;
create or replace function public.csstv_auth(p_token text) returns uuid language sql as $$ select id from game_servers order by name limit 1 $$;
do $$
declare v text; v_id uuid;
begin
  insert into bans (steam_id, nick, reason, expires_at, source) values ('76561199999999993', 'Tramposo|;"x', 'Motivo con | ; " \ y'||chr(10)||'salto', null, 'server') returning id into v_id;
  v := csstv_ban_list('t');
  assert v like 's|STEAM_0:1:%|0|Tramposo x|Motivo con y salto|server%', '1 el más nuevo primero y limpio: ' || left(v, 120);
  assert v like '%i|181.21.0.0/16|%', '2 el rango de 181.21';
  assert strpos(v, '"') = 0 and strpos(v, chr(92)) = 0, '3 sin comillas ni barras';
  raise notice 'ok: % registros', array_length(string_to_array(v, ';'), 1);
end $$;
rollback;
