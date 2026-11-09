-- Pruebas de los replanteos 90 (verificados) y 91 (comentarios y votos). Las arma probar_90_91.sh: van entre las
-- migraciones y sus inversas, dentro de una transacción que se deshace al final (no dejan nada en la base).

create table public.t91 (k text primary key, u uuid, p uuid);
grant select on public.t91 to anon, authenticated;
create function public.t91u(k text) returns uuid language sql stable as $$ select u from public.t91 where t91.k = $1 $$;
create function public.t91p(k text) returns uuid language sql stable as $$ select p from public.t91 where t91.k = $1 $$;
create function public.t91_como(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', public.t91u(k), 'role', 'authenticated')::text, true) $$;
grant execute on function public.t91u(text), public.t91p(text), public.t91_como(text) to anon, authenticated;

-- Un error esperado: corre la sentencia y falla si NO da error o si el mensaje no es el esperado.
create function public.t91_falla(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if position(msg in sqlerrm) = 0 then raise exception 'esperaba "%", dio "%"', msg, sqlerrm; end if;
    return;
  end;
  raise exception 'esperaba el error "%" y no falló: %', msg, sql;
end $$;
grant execute on function public.t91_falla(text, text) to anon, authenticated;

do $$
declare k text; v uuid; pl uuid;
begin
  foreach k in array array['dueno', 'a', 'b', 'admin', 'mod', 'sinficha'] loop
    v := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
      values (v, k || '-' || substr(v::text, 1, 6) || '@prueba91.local', now(), now(), 'authenticated', 'authenticated');
    pl := null;
    if k <> 'sinficha' then insert into players (nick, user_id) values ('t91' || k || substr(v::text, 1, 4), v) returning id into pl; end if;
    insert into t91 values (k, v, pl);
  end loop;
  insert into profiles (id, role) values (t91u('admin'), 'admin'), (t91u('mod'), 'moderator')
    on conflict (id) do update set role = excluded.role;
  insert into players (nick) values ('t91ficha' || substr(gen_random_uuid()::text, 1, 4)) returning id into pl;
  insert into t91 values ('ficha', null, pl);
  raise notice 'ok: datos de prueba';
end $$;

-- ===== 90. Verificados: solo un admin =====
select t91_como('a'); set local role authenticated;
select t91_falla(format('select admin_player_verify(%L, %L, null)', t91p('a'), 'gold'), 'Solo un admin');
-- Las políticas no le dejan tocar su ficha directo: el UPDATE no cambia nada.
update players set verified = 'gold' where id = t91p('a');
reset role;
select t91_como('mod'); set local role authenticated;
select t91_falla(format('select admin_player_verify(%L, %L, null)', t91p('a'), 'gray'), 'Solo un admin');
reset role;
select t91_como('admin'); set local role authenticated;
select admin_player_verify(t91p('a'), 'gold', '  Jugador profesional  ');
select t91_falla(format('select admin_player_verify(%L, %L, null)', t91p('a'), 'azul'), 'gray o gold');
select t91_falla(format('select admin_player_verify(%L, %L, %L)', t91p('a'), 'gray', repeat('x', 61)), '60 caracteres');
select admin_player_verify(t91p('b'), 'gray', null);
-- Ni un admin la escribe directo: tiene que pasar por la función (el trigger).
select t91_falla(format('update players set verified = %L where id = %L', 'gray', t91p('dueno')), 'la pone un admin');
update players set bio = 'bio cambiada por un admin' where id = t91p('dueno');
reset role;
do $$ begin
  if (select bio from players where id = t91p('dueno')) <> 'bio cambiada por un admin' then raise exception 'el trigger frenó otro cambio'; end if;
  if (select verified from players where id = t91p('dueno')) is not null then raise exception 'el admin la escribió directo'; end if;
  if (select verified || '|' || verified_note from players where id = t91p('a')) <> 'gold|Jugador profesional' then raise exception 'a no quedó dorado con su motivo'; end if;
  if (select verified from players where id = t91p('b')) <> 'gray' or (select verified_by from players where id = t91p('b')) <> t91u('admin') then raise exception 'b no quedó gris'; end if;
end $$;
select t91_como('admin'); set local role authenticated;
select admin_player_verify(t91p('b'), null, 'lo que sea');
reset role;
do $$ begin
  if (select verified is not null or verified_note is not null or verified_at is not null from players where id = t91p('b')) then raise exception 'b no quedó sin insignia'; end if;
  raise notice 'ok 90: solo un admin pone, cambia y saca la insignia; el jugador no la puede escribir';
end $$;

-- ===== 91.1 Votos =====
select t91_como('a'); set local role authenticated;
select profile_vote(t91p('dueno'), 1::smallint);
select t91_falla(format('select profile_vote(%L, 1::smallint)', t91p('a')), 'propio perfil');
select t91_falla(format('select profile_vote(%L, 1::smallint)', t91p('ficha')), 'no tiene cuenta');
select t91_falla(format('select profile_vote(%L, 2::smallint)', t91p('dueno')), '1, -1 o 0');
reset role;
select t91_como('b'); set local role authenticated;
select profile_vote(t91p('dueno'), 1::smallint); select profile_vote(t91p('dueno'), -1::smallint);
reset role;
select t91_como('sinficha'); set local role authenticated;
select t91_falla(format('select profile_vote(%L, 1::smallint)', t91p('dueno')), 'ficha de jugador');
reset role;
do $$ declare w jsonb; begin
  perform t91_como('a'); w := profile_wall(t91p('dueno'));
  if (w->>'likes')::int <> 1 or (w->>'dislikes')::int <> 1 or (w->>'my_vote')::int <> 1 or not (w->>'can_vote')::boolean then raise exception 'votos mal: %', w; end if;
  perform t91_como('dueno'); w := profile_wall(t91p('dueno'));
  if (w->>'can_vote')::boolean or not (w->>'is_owner')::boolean then raise exception 'el dueño no vota: %', w; end if;
  raise notice 'ok 91.1: un voto por cuenta, se cambia, no el propio ni sin ficha';
end $$;
select t91_como('a'); set local role authenticated;
select profile_vote(t91p('dueno'), 0::smallint);
reset role;
do $$ begin
  perform t91_como('a');
  if (profile_wall(t91p('dueno'))->>'likes')::int <> 0 or profile_wall(t91p('dueno'))->'my_vote' <> 'null'::jsonb then raise exception 'el voto no se sacó'; end if;
  raise notice 'ok 91.2: con 0 se saca el voto';
end $$;

-- ===== 91.3 Comentarios, tope y borrado =====
select t91_como('a'); set local role authenticated;
select profile_comment_add(t91p('dueno'), '  buen jugador  ');
select t91_falla(format('select profile_comment_add(%L, %L)', t91p('dueno'), 'otro'), 'Espera unos segundos');
select t91_falla(format('select profile_comment_add(%L, %L)', t91p('b'), '   '), 'vacío');
select t91_falla(format('select profile_comment_add(%L, %L)', t91p('b'), repeat('x', 281)), '280');
reset role;
select t91_como('dueno'); set local role authenticated;
select profile_comment_add(t91p('dueno'), 'gracias');
reset role;
-- En la transacción now() no avanza: el de a queda un minuto antes, para ver el orden.
update profile_comments set created_at = created_at - interval '1 minute' where body = 'buen jugador';
select t91_como('sinficha'); set local role authenticated;
select t91_falla(format('select profile_comment_add(%L, %L)', t91p('dueno'), 'hola'), 'ficha de jugador');
reset role;
do $$ declare w jsonb; begin
  perform t91_como('b'); w := profile_wall(t91p('dueno'));
  if (w->>'total')::int <> 2 or w->'items'->1->>'body' <> 'buen jugador' then raise exception 'comentarios mal: %', w; end if;
  if (w->'items'->0->>'can_delete')::boolean or (w->'items'->0->>'mine')::boolean then raise exception 'b no borra lo ajeno: %', w; end if;
  if w->'items'->1->'author'->>'verified' <> 'gold' then raise exception 'falta la insignia del autor: %', w; end if;
  perform t91_como('dueno');
  if not (profile_wall(t91p('dueno'))->'items'->1->>'can_delete')::boolean then raise exception 'el dueño borra los de su perfil'; end if;
  raise notice 'ok 91.3: comentar (también el dueño), sin ficha no, vacío y largo no, 30 s entre comentarios';
end $$;
-- Sin sesión se lee el muro, pero no se puede comentar.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ declare w jsonb; begin
  w := profile_wall(t91p('dueno'));
  if (w->>'total')::int <> 2 or (w->>'can_comment')::boolean or (w->>'can_vote')::boolean then raise exception 'sin sesión mal: %', w; end if;
end $$;
select t91_falla(format('select profile_comment_add(%L, %L)', t91p('dueno'), 'x'), 'permission denied');
reset role;
-- b no borra lo de a; el moderador sí; el dueño sí. Los id, a mano: `authenticated` no lee la tabla.
insert into t91 select 'c_' || body, null, id from profile_comments where body in ('buen jugador', 'gracias');
select t91_como('b'); set local role authenticated;
select t91_falla(format('select profile_comment_delete(%L)', t91p('c_buen jugador')), 'No puedes borrar');
reset role;
select t91_como('mod'); set local role authenticated;
select profile_comment_delete(t91p('c_buen jugador'));
reset role;
select t91_como('dueno'); set local role authenticated;
select profile_comment_delete(t91p('c_gracias'));
reset role;
do $$ begin
  perform t91_como('b');
  if (profile_wall(t91p('dueno'))->>'total')::int <> 0 then raise exception 'los borrados se siguen viendo'; end if;
  if (select count(*) from profile_comments where player_id = t91p('dueno') and deleted_by is not null) <> 2 then raise exception 'los borrados no quedaron guardados'; end if;
  raise notice 'ok 91.4: borra el autor, el dueño o un moderador; quedan guardados';
end $$;

-- ===== 91.6 Avisos al dueño =====
do $$ begin
  -- a comentó y le dio me gusta (lo sacó en 91.2); b le dio me gusta y lo cambió a no me gusta; el dueño se comentó a sí mismo.
  if (select count(*) from notifications where user_id = t91u('dueno') and type = 'profile_comment') <> 1 then raise exception 'un aviso por el comentario de a (no por el del dueño)'; end if;
  if (select data->'player'->>'id' from notifications where user_id = t91u('dueno') and type = 'profile_comment')::uuid <> t91p('a') then raise exception 'el aviso no dice quién comentó'; end if;
  if (select count(*) from notifications where user_id = t91u('dueno') and type = 'profile_like') <> 2 then raise exception 'un aviso por cada cuenta que dio me gusta'; end if;
  if (select distinct category from notifications where user_id = t91u('dueno') and type like 'profile_%') <> 'friends' then raise exception 'van en Amigos'; end if;
end $$;
select t91_como('a'); set local role authenticated;
select profile_vote(t91p('dueno'), 1::smallint);
reset role;
do $$ begin
  if (select count(*) from notifications where user_id = t91u('dueno') and type = 'profile_like') <> 2 then raise exception 'volver a dar me gusta avisó de nuevo'; end if;
  raise notice 'ok 91.6: avisos por comentario y por el primer me gusta de cada cuenta, en Amigos; el no me gusta no avisa';
end $$;

-- ===== 91.5 Comentarios cerrados y tope diario =====
select t91_como('dueno'); set local role authenticated;
select profile_comments_set(false);
reset role;
update profile_comments set created_at = now() - interval '1 minute';
select t91_como('a'); set local role authenticated;
select t91_falla(format('select profile_comment_add(%L, %L)', t91p('dueno'), 'hola'), 'no acepta comentarios');
reset role;
do $$ declare w jsonb; begin
  perform t91_como('a'); w := profile_wall(t91p('dueno'));
  if (w->>'comments_open')::boolean or (w->>'can_comment')::boolean or jsonb_array_length(w->'items') <> 0 then raise exception 'cerrados mal: %', w; end if;
end $$;
-- 30 por día: se cargan 30 de hoy (hace más de 30 s) y el 31 no entra.
insert into profile_comments (player_id, author, body, created_at)
  select t91p('b'), t91u('a'), 'c' || g, now() - interval '1 minute' from generate_series(1, 29) g;
select t91_como('a'); set local role authenticated;
select t91_falla(format('select profile_comment_add(%L, %L)', t91p('b'), 'el 31'), 'tope de 30');
reset role;
do $$ begin raise notice 'ok 91.5: con los comentarios cerrados no se ven ni se dejan; tope de 30 por día'; end $$;

drop function public.t91_falla(text, text), public.t91_como(text), public.t91p(text), public.t91u(text);
drop table public.t91;
