-- Pruebas de supabase/replanteo/21_steam_desvincular.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;
create function pg_temp.como(u text) returns void language sql as $$
  select set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', u), true) $$;
create function pg_temp.s(n int) returns text language sql immutable as $$ select '7656119821' || lpad(n::text, 7, '0') $$;
-- Mensaje del error de una sentencia, o null si no falla.
create function pg_temp.error(q text) returns text language plpgsql as $$
begin
  execute q;
  return null;
exception when others then return sqlerrm;
end $$;
grant execute on function pg_temp.ok(boolean, text), pg_temp.como(text), pg_temp.s(int), pg_temp.error(text) to authenticated;

-- Admin y una cuenta con ficha: principal 1, adicionales 2 y 3. Cada SteamID jugó un mix distinto.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-2100-4000-8000-0000000000ad', 'admin21@test.local', '{"tag":"Admin21"}'),
  ('aaaaaaaa-2100-4000-8000-000000000001', 'u1-21@test.local', '{"tag":"Uno21"}');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-2100-4000-8000-0000000000ad';
insert into public.players(id, nick, user_id, steam_id) values
  ('dddddddd-2100-4000-8000-000000000001', 'x', 'aaaaaaaa-2100-4000-8000-000000000001', pg_temp.s(1));
insert into public.player_extra_steam_ids(steam_id, player_id, added_at) values
  (pg_temp.s(2), 'dddddddd-2100-4000-8000-000000000001', '2026-01-02'),
  (pg_temp.s(3), 'dddddddd-2100-4000-8000-000000000001', '2026-01-03');
insert into public.matches(id, kind, status, map, score1, score2, winner_side, played_at)
  select ('cccccccc-2100-4000-8000-00000000000' || i)::uuid, 'mix', 'finished', 'de_dust2', 16, 10, 1, now() - (4 - i) * interval '1 day'
    from generate_series(1, 3) i;
insert into public.match_player_stats(match_id, steam_id, team, nick, rounds, rating)
  select ('cccccccc-2100-4000-8000-00000000000' || i)::uuid, case when j = 1 then pg_temp.s(i) else pg_temp.s(100 * i + j) end,
         case when j <= 5 then 1 else 2 end, 'J21n' || i || '-' || j, 26, 1
    from generate_series(1, 3) i, generate_series(1, 10) j;

set local role authenticated;
select pg_temp.como('aaaaaaaa-2100-4000-8000-0000000000ad');
select public.elo_recompute_all();
create temp table antes as select elo, peak_elo, matches from public.player_elo where steam_id = pg_temp.s(1);
grant select on antes to authenticated;

-- Principal: el jugador, sin aprobación; el ELO pasa a la clave nueva y queda igual.
select pg_temp.como('aaaaaaaa-2100-4000-8000-000000000001');
do $$ begin
  perform pg_temp.ok((select matches = 3 from antes), 'la ficha tiene un solo ELO con los 3 mixes');
  perform public.set_my_primary_steam(pg_temp.s(2));
  perform pg_temp.ok((select steam_id = pg_temp.s(2) from public.players where id = 'dddddddd-2100-4000-8000-000000000001'), 'el jugador cambia su principal');
  perform pg_temp.ok(exists (select 1 from public.player_extra_steam_ids where steam_id = pg_temp.s(1)), 'el viejo principal queda como adicional');
  perform pg_temp.ok((select added_at = '2026-01-02' from public.player_steam_all where steam_id = pg_temp.s(2) and is_primary),
                     'el principal nuevo conserva su fecha y player_steam_all la trae');
  perform pg_temp.ok((select added_at is null from public.player_steam_all where steam_id = pg_temp.s(1) and not is_primary),
                     'el viejo principal (sin fecha conocida) sigue sin fecha, no toma la de ahora');
  perform pg_temp.ok((select (e.elo, e.peak_elo, e.matches) = (a.elo, a.peak_elo, a.matches) from public.player_elo e, antes a where e.steam_id = pg_temp.s(2)),
                     'el ELO pasa a la clave nueva sin cambiar');
  perform pg_temp.ok(not exists (select 1 from public.player_elo where steam_id = pg_temp.s(1)), 'no queda ELO con la clave vieja');
  perform public.set_my_primary_steam(pg_temp.s(2));
  perform pg_temp.ok(pg_temp.error($q$select public.set_my_primary_steam(pg_temp.s(3))$q$) like 'Ya cambiaste tu SteamID principal en las últimas 24 horas%',
                     'una vez cada 24 horas (hacer principal al que ya lo es no cuenta)');
  perform pg_temp.ok(pg_temp.error($q$select public.set_my_primary_steam(pg_temp.s(201))$q$) = 'Ese SteamID no es de tu ficha', 'un SteamID ajeno no');
end $$;

-- Recalcular todo da lo mismo.
select pg_temp.como('aaaaaaaa-2100-4000-8000-0000000000ad');
select public.elo_recompute_all();
do $$ begin
  perform pg_temp.ok((select (e.elo, e.peak_elo, e.matches) = (a.elo, a.peak_elo, a.matches) from public.player_elo e, antes a where e.steam_id = pg_temp.s(2)),
                     'recalcular todo da el mismo ELO');
end $$;

-- Desvincular: pedido del jugador.
select pg_temp.como('aaaaaaaa-2100-4000-8000-000000000001');
do $$ declare v bigint; begin
  v := public.request_steam_unlink(pg_temp.s(1), '  Era de mi hermano  ');
  perform pg_temp.ok((select kind = 'remove' and status = 'pending' and note = 'Era de mi hermano' from public.steam_requests where id = v),
                     'crea el pedido con el motivo recortado');
  perform pg_temp.ok(pg_temp.error($q$select public.request_steam_unlink(pg_temp.s(1))$q$) like 'Ya pediste desvincular ese SteamID%', 'no se pide dos veces');
  perform pg_temp.ok(pg_temp.error($q$select public.set_my_primary_steam(pg_temp.s(1))$q$) like 'Ese SteamID tiene un pedido para desvincularlo%',
                     'con pedido pendiente no puede ser principal');
  perform public.request_steam_unlink(pg_temp.s(3));
  perform pg_temp.ok(pg_temp.error($q$select public.request_steam_unlink(pg_temp.s(2))$q$) = 'Es tu único SteamID: no se puede desvincular',
                     'la ficha no puede quedar sin SteamID sumando pedidos');
  perform pg_temp.ok(pg_temp.error($q$select public.approve_steam_request(1)$q$) like 'Solo un admin%', 'el jugador no aprueba');
end $$;

select pg_temp.como('aaaaaaaa-2100-4000-8000-0000000000ad');
do $$ declare v1 bigint; v3 bigint; begin
  select id into v1 from public.steam_requests where steam_id = pg_temp.s(1) and status = 'pending';
  select id into v3 from public.steam_requests where steam_id = pg_temp.s(3) and status = 'pending';
  perform pg_temp.ok((select kind = 'remove' and note = 'Era de mi hermano' and not shares_match from public.admin_steam_requests where id = v1),
                     'la vista del admin trae tipo y motivo');
  perform public.approve_steam_request(v1);
  perform pg_temp.ok(public.steam_owner(pg_temp.s(1)) is null, 'aprobado: el SteamID queda sin ficha');
  perform pg_temp.ok((select player_id is null from public.match_player_stats where steam_id = pg_temp.s(1)), 'sus partidas vuelven a quedar sin ficha');
  perform pg_temp.ok((select matches = 2 from public.player_elo where steam_id = pg_temp.s(2)), 'el ELO de la ficha se recalcula sin ese SteamID');
  perform pg_temp.ok((select matches = 1 from public.player_elo where steam_id = pg_temp.s(1)), 'el SteamID suelto vuelve a tener su ELO');
  -- El admin lo quita directo: el pedido queda aprobado.
  perform public.admin_remove_steam(pg_temp.s(3));
  perform pg_temp.ok((select status = 'approved' from public.steam_requests where id = v3), 'quitarlo directo aprueba el pedido');
end $$;

-- Aprobar un pedido del único SteamID que queda (se puede llegar si el admin cambió la ficha a mano).
reset role;
insert into public.player_extra_steam_ids(steam_id, player_id) values (pg_temp.s(3), 'dddddddd-2100-4000-8000-000000000001');
insert into public.steam_requests(player_id, user_id, steam_id, kind) values
  ('dddddddd-2100-4000-8000-000000000001', 'aaaaaaaa-2100-4000-8000-000000000001', pg_temp.s(3), 'remove');
delete from public.player_extra_steam_ids where steam_id = pg_temp.s(3);
set local role authenticated;
do $$ begin
  perform pg_temp.ok(pg_temp.error(format('select public.approve_steam_request(%s)',
                       (select id from public.steam_requests where steam_id = pg_temp.s(3) and status = 'pending'))) = 'Ese SteamID ya no es de esa ficha',
                     'no aprueba si el SteamID ya no es de la ficha');
end $$;

-- Fechas: quitar el principal sube al adicional más viejo con su fecha; un SteamID nuevo como principal toma la de ahora.
reset role;
insert into public.player_extra_steam_ids(steam_id, player_id, added_at) values
  (pg_temp.s(5), 'dddddddd-2100-4000-8000-000000000001', '2026-01-05'),
  (pg_temp.s(4), 'dddddddd-2100-4000-8000-000000000001', '2026-01-04');
insert into public.players(id, nick) values ('dddddddd-2100-4000-8000-000000000002', 'y');
set local role authenticated;
select pg_temp.como('aaaaaaaa-2100-4000-8000-0000000000ad');
do $$ begin
  perform public.admin_remove_steam(pg_temp.s(2));
  perform pg_temp.ok((select steam_id = pg_temp.s(4) and steam_added_at = '2026-01-04' from public.players where id = 'dddddddd-2100-4000-8000-000000000001'),
                     'quitar el principal sube al adicional más viejo con su fecha');
  perform public.link_steam_id(pg_temp.s(2), 'dddddddd-2100-4000-8000-000000000002');
  perform pg_temp.ok((select steam_added_at > now() - interval '1 minute' from public.players where id = 'dddddddd-2100-4000-8000-000000000002'),
                     'el primer SteamID de una ficha toma la fecha de ahora');
end $$;

rollback;
