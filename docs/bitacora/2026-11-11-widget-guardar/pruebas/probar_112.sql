-- Prueba de la 112 en una transacción que se deshace (base local o producción).
-- Uso: probar_112.sh (le pasa las rutas de la 112 y de su inversa).
\set ON_ERROR_STOP 1
begin;

\i :r112

-- Dos cuentas: una con ficha y otra sin ficha.
insert into auth.users (id, email) values
  ('22222222-2222-4222-8222-000000000112', 'prueba112a@example.com'),
  ('22222222-2222-4222-8222-000000000113', 'prueba112b@example.com');
insert into players (id, nick, steam_id, user_id)
values ('11111111-1111-4111-8111-000000000112', 'prueba112', '76561190000000212', '22222222-2222-4222-8222-000000000112');

-- Un mix de hace 3 días: entra en "histórico" pero no en "hoy".
with m as (
  insert into matches (kind, status, best_of, side1_name, side2_name, map, played_at, score1, score2, winner_side)
  values ('mix', 'finished', 1, 'a', 'b', 'de_dust2', now() - interval '3 days', 13, 7, 1) returning id)
insert into match_player_stats (match_id, steam_id, player_id, nick, team, kills, deaths, assists, headshots, damage, rounds,
                                k1, k2, k3, k4, k5, first_kills, elo_delta)
select id, '76561190000000212', '11111111-1111-4111-8111-000000000112', 'prueba112', 1, 20, 10, 2, 9, 2000, 20, 8, 3, 2, 0, 0, 3, 18 from m;

do $$
declare j jsonb;
begin
  j := widget_player('11111111-1111-4111-8111-000000000112', null);
  if not (j ? 'settings') or j->'settings' <> 'null'::jsonb then raise exception 'falla 1: settings %', j->'settings'; end if;
  if (j->'period'->>'v')::int <> 0 then raise exception 'falla 1: sin nada guardado tenía que ser hoy (0 mixes)'; end if;
  if j->>'photo_url' is not null or not (j ? 'photo_url') then raise exception 'falla 1: se perdió photo_url'; end if;
  raise notice 'ok 1: sin guardar, settings null y período hoy';
end $$;

-- 2. Sin sesión no se guarda.
set local role anon;
do $$ begin
  perform widget_save('d=stats');
  raise exception 'falla 2: anon guardó';
exception when insufficient_privilege then raise notice 'ok 2: anon no puede llamar a widget_save';
end $$;
reset role;

-- 3. Cuenta sin ficha.
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-000000000113","role":"authenticated"}', true); end $$;
do $$ begin
  perform widget_save('d=stats');
  raise exception 'falla 3: guardó sin ficha';
exception when raise_exception then
  if sqlerrm not like '%ficha de jugador vinculada%' then raise; end if;
  raise notice 'ok 3: sin ficha, error claro';
end $$;

-- 4. El dueño guarda, y vuelve a guardar (upsert).
do $$ begin perform set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-000000000112","role":"authenticated"}', true); end $$;
do $$
declare r jsonb;
begin
  r := widget_save('d=barra');
  r := widget_save('d=stats&v=historico&h=photo%2Ctag&f=Hola+mundo');
  if r->>'query' <> 'd=stats&v=historico&h=photo%2Ctag&f=Hola+mundo' then raise exception 'falla 4: %', r; end if;
  if (select count(*) from widget_settings) <> 1 then raise exception 'falla 4: no es upsert'; end if;
  raise notice 'ok 4: guarda y reemplaza';
end $$;

-- 5. Texto inválido o largo.
do $$ begin
  begin perform widget_save('f=<script>'); raise exception 'falla 5a';
  exception when raise_exception then if sqlerrm not like '%no es válida%' then raise; end if; end;
  begin perform widget_save(repeat('a', 601)); raise exception 'falla 5b';
  exception when raise_exception then if sqlerrm not like '%no es válida%' then raise; end if; end;
  raise notice 'ok 5: rechaza caracteres raros y más de 600';
end $$;

-- 6. Sin escritura directa en la tabla.
do $$ begin
  update widget_settings set query = 'd=mini';
  if found then raise exception 'falla 6: authenticated escribió directo'; end if;
  raise notice 'ok 6: sin escritura directa';
exception when insufficient_privilege then raise notice 'ok 6: sin escritura directa';
end $$;
reset role;

-- 7. Como anon: widget_player lee lo guardado y usa su período.
set local role anon;
do $$
declare j jsonb;
begin
  j := widget_player('11111111-1111-4111-8111-000000000112', null);
  if j->>'settings' <> 'd=stats&v=historico&h=photo%2Ctag&f=Hola+mundo' then raise exception 'falla 7: %', j->'settings'; end if;
  if (j->'period'->>'v')::int <> 1 then raise exception 'falla 7: el período guardado (histórico) tenía que contar el mix'; end if;
  j := widget_player('11111111-1111-4111-8111-000000000112', 'today');
  if (j->'period'->>'v')::int <> 0 then raise exception 'falla 7: con período explícito manda el de la llamada'; end if;
  raise notice 'ok 7: anon lee settings; sin período usa el guardado y con período el pedido';
end $$;
reset role;

-- 8. La ficha borrada se lleva su configuración.
delete from match_player_stats where player_id = '11111111-1111-4111-8111-000000000112';
delete from players where id = '11111111-1111-4111-8111-000000000112';
do $$ begin
  if exists (select 1 from widget_settings) then raise exception 'falla 8'; end if;
  raise notice 'ok 8: on delete cascade';
end $$;

-- 9. La inversa.
\i :rev112
do $$ begin
  if to_regclass('public.widget_settings') is not null or to_regprocedure('public.widget_save(text)') is not null then
    raise exception 'falla 9: quedó la tabla o la función';
  end if;
  if widget_player((select id from players limit 1), 'all') ? 'settings' then raise exception 'falla 9: quedó settings'; end if;
  raise notice 'ok 9: la inversa vuelve al 111';
end $$;

rollback;
