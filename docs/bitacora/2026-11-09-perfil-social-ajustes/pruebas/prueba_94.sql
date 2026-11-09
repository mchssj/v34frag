-- Pruebas del replanteo 94. Las arma probar_94.sh: van entre el replanteo y su inversa, dentro de una transacción que
-- se deshace al final (no dejan nada en la base).

create table public.t94 (k text primary key, u uuid, p uuid);
grant select on public.t94 to anon, authenticated;
create function public.t94u(k text) returns uuid language sql stable as $$ select u from public.t94 where t94.k = $1 $$;
create function public.t94p(k text) returns uuid language sql stable as $$ select p from public.t94 where t94.k = $1 $$;
create function public.t94_como(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', public.t94u(k), 'role', 'authenticated')::text, true) $$;
grant execute on function public.t94u(text), public.t94p(text), public.t94_como(text) to anon, authenticated;

-- Un error esperado: corre la sentencia y falla si NO da error o si el mensaje no es el esperado.
create function public.t94_falla(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if position(msg in sqlerrm) = 0 then raise exception 'esperaba "%", dio "%"', msg, sqlerrm; end if;
    return;
  end;
  raise exception 'esperaba el error "%" y no falló: %', msg, sql;
end $$;
grant execute on function public.t94_falla(text, text) to anon, authenticated;

do $$
declare k text; v uuid; pl uuid;
begin
  foreach k in array array['dueno', 'a', 'ban1', 'ban2', 'bloq', 'den', 'autor', 'mod', 'admin'] loop
    v := gen_random_uuid();
    insert into auth.users (id, email, email_confirmed_at, created_at, aud, role)
      values (v, k || '-' || substr(v::text, 1, 6) || '@prueba94.local', now(), now(), 'authenticated', 'authenticated');
    insert into players (nick, user_id, steam_id)
      values ('t94' || k || substr(v::text, 1, 4), v, '7656119' || lpad((floor(random() * 1e10))::bigint::text, 10, '0')) returning id into pl;
    insert into t94 values (k, v, pl);
  end loop;
  insert into profiles (id, role) values (t94u('admin'), 'admin'), (t94u('mod'), 'moderator')
    on conflict (id) do update set role = excluded.role;
  insert into blocked_words (word) values ('zqtonto');
  raise notice 'ok: datos de prueba';
end $$;

-- ===== 1. Palabras bloqueadas, palabra por palabra =====
do $$ begin
  if comment_blocked_word('eres un ZQTONTO') is distinct from 'zqtonto' then raise exception 'no frenó la palabra'; end if;
  if comment_blocked_word('dos zqtontos') is distinct from 'zqtonto' then raise exception 'no frenó el plural'; end if;
  if comment_blocked_word('con números: zqt0nt0') is distinct from 'zqtonto' then raise exception 'no frenó con números'; end if;
  if comment_blocked_word('abczqtonto adentro de otra') is not null then raise exception 'frenó una palabra que solo la contiene'; end if;
  if comment_blocked_word('zqtonteria es más larga') is not null then raise exception 'frenó una palabra con 3 letras más'; end if;
  if comment_blocked_word('buen partido, gg') is not null then raise exception 'frenó un comentario normal'; end if;
end $$;
select t94_como('a'); set local role authenticated;
select t94_falla(format('select profile_comment_add(%L, %L)', t94p('dueno'), 'sos un zqtonto'), 'no está permitida (zqtonto)');
select profile_comment_add(t94p('dueno'), 'buen partido, gg');
reset role;
do $$ begin
  if (select count(*) from profile_comments where author = t94u('a')) <> 1 then raise exception 'el comentario normal no quedó'; end if;
  raise notice 'ok 94.1: las palabras bloqueadas frenan el comentario, palabra por palabra';
end $$;

-- ===== 2. Baneados: por la ficha y por un SteamID =====
insert into bans (player_id, steam_id, reason, source, expires_at)
  values (t94p('ban1'), (select steam_id from players where id = t94p('ban1')), 'prueba 94', 'web', now() + interval '1 day');
insert into bans (steam_id, reason, source) values ((select steam_id from players where id = t94p('ban2')), 'prueba 94, sin ficha', 'web');
select t94_como('ban1'); set local role authenticated;
select t94_falla(format('select profile_vote(%L, 1::smallint)', t94p('dueno')), 'baneo activo');
select t94_falla(format('select profile_comment_add(%L, %L)', t94p('dueno'), 'hola'), 'baneo activo');
do $$ begin
  if (profile_wall(t94p('dueno'))->>'can_vote')::boolean or (profile_wall(t94p('dueno'))->>'can_comment')::boolean then
    raise exception 'el muro le deja votar o comentar al baneado';
  end if;
  if profile_wall(t94p('dueno'))->>'restriction' is distinct from 'banned' then raise exception 'el muro no dice que está baneado'; end if;
end $$;
reset role;
select t94_como('ban2'); set local role authenticated;
select t94_falla(format('select profile_vote(%L, -1::smallint)', t94p('dueno')), 'baneo activo');
reset role;
-- Levantado, ya puede.
update bans set lifted_at = now() where player_id = t94p('ban1');
select t94_como('ban1'); set local role authenticated;
select profile_vote(t94p('dueno'), 1::smallint);
reset role;
do $$ begin
  if not exists (select 1 from profile_votes where voter = t94u('ban1')) then raise exception 'con el baneo levantado no votó'; end if;
  raise notice 'ok 94.2: con un baneo activo (por la ficha o por el SteamID) no se comenta ni se vota; levantado, sí';
end $$;

-- ===== 3. Bloqueado por el dueño =====
insert into mm_blocks (user_id, player_id) values (t94u('dueno'), t94p('bloq'));
select t94_como('bloq'); set local role authenticated;
select t94_falla(format('select profile_vote(%L, 1::smallint)', t94p('dueno')), 'te bloqueó');
select t94_falla(format('select profile_comment_add(%L, %L)', t94p('dueno'), 'hola'), 'te bloqueó');
-- En otro perfil, sí.
select profile_vote(t94p('a'), 1::smallint);
do $$ begin
  if (profile_wall(t94p('dueno'))->>'can_comment')::boolean then raise exception 'el muro le deja comentar al bloqueado'; end if;
  if profile_wall(t94p('dueno'))->>'restriction' is distinct from 'blocked' then raise exception 'el muro no dice que está bloqueado'; end if;
  if profile_wall(t94p('a'))->'restriction' <> 'null'::jsonb then raise exception 'en otro perfil dice que está restringido'; end if;
  if not (profile_wall(t94p('a'))->>'can_comment')::boolean then raise exception 'en otro perfil no lo deja comentar'; end if;
end $$;
reset role;
do $$ begin raise notice 'ok 94.3: el bloqueado por el dueño no comenta ni vota en ese perfil, sí en los demás'; end $$;

-- ===== 4. Denunciar =====
insert into profile_comments (player_id, author, body, created_at) values
  (t94p('dueno'), t94u('autor'), 'comentario 1', now() - interval '3 minutes'),
  (t94p('dueno'), t94u('autor'), 'comentario 2', now() - interval '2 minutes'),
  (t94p('dueno'), t94u('autor'), 'comentario 3', now() - interval '1 minute');
insert into t94 select 'c' || right(body, 1), null, id from profile_comments where author = t94u('autor');
insert into t94 select 'ca', null, id from profile_comments where author = t94u('a');
select t94_como('den'); set local role authenticated;
do $$ begin
  if not (select bool_and((i->>'can_report')::boolean) from jsonb_array_elements(profile_wall(t94p('dueno'))->'items') i
           where i->'author'->>'player_id' = t94p('autor')::text) then raise exception 'no puede denunciar un comentario ajeno'; end if;
end $$;
select profile_comment_report(t94p('c1'), 'toxic', '  insulta  ');
select profile_comment_report(t94p('c2'), 'spam');
select profile_comment_report(t94p('c3'), 'harassment');
select t94_falla(format('select profile_comment_report(%L, %L)', t94p('c1'), 'spam'), 'Ya denunciaste');
select t94_falla(format('select profile_comment_report(%L, %L)', t94p('c1'), 'feo'), 'El motivo es');
select t94_falla(format('select profile_comment_reports_admin()'), 'Solo moderadores');
reset role;
select t94_como('a'); set local role authenticated;
select t94_falla(format('select profile_comment_report(%L, %L)', t94p('ca'), 'spam'), 'tu propio comentario');
select profile_comment_report(t94p('c1'), 'other');
reset role;
do $$ begin
  if (select note from profile_comment_reports where reporter = t94u('den') and reason = 'toxic') <> 'insulta' then raise exception 'la nota no quedó recortada'; end if;
  raise notice 'ok 94.4: se denuncia un comentario ajeno, una vez por cuenta; no el propio ni con otro motivo';
end $$;

-- ===== 5. La lista y resolver =====
-- En una transacción now() es el mismo: las fechas se escalonan para probar el orden.
update profile_comment_reports r set created_at = now() - case right(c.body, 1) || r.reason
    when '1toxic' then interval '4 minutes' when '2spam' then interval '3 minutes' when '3harassment' then interval '2 minutes' else interval '1 minute' end
  from profile_comments c where c.id = r.comment_id;
insert into t94 select 'r' || right(c.body, 1) || r.reason, null, r.id from profile_comment_reports r join profile_comments c on c.id = r.comment_id;
select t94_como('mod'); set local role authenticated;
do $$
declare l jsonb;
begin
  l := profile_comment_reports_admin('open', null, 'asc', 2, 0);
  if (l->>'total')::int <> 4 or jsonb_array_length(l->'items') <> 2 then raise exception 'la página no es 2 de 4: %', l; end if;
  if l->'items'->0->'comment'->>'body' <> 'comentario 1' or (l->'items'->0->>'reports')::int <> 2 then raise exception 'el orden o el conteo no va: %', l->'items'->0; end if;
  l := profile_comment_reports_admin('open', null, 'asc', 2, 2);
  if jsonb_array_length(l->'items') <> 2 or l->'items'->1->'comment'->>'body' <> 'comentario 1' then raise exception 'la segunda página no va: %', l; end if;
  if (profile_comment_reports_admin('open', 'spam')->>'total')::int <> 1 then raise exception 'el filtro por motivo no va'; end if;
  if (profile_comment_reports_admin('open', null, 'desc')->'items'->0->'comment'->>'body') <> 'comentario 1' then raise exception 'el orden desc no va'; end if;
end $$;
-- Descartar el 2: el comentario queda.
select profile_comment_report_resolve(t94p('r2spam'), 'dismiss');
-- Borrar el 1: se borra y se cierran sus dos denuncias.
select profile_comment_report_resolve(t94p('r1toxic'), 'delete');
select t94_falla(format('select profile_comment_report_resolve(%L, %L)',
  t94p('r1other'), 'dismiss'), 'ya se resolvió');
select t94_falla(format('select profile_comment_report_resolve(%L, %L)',
  t94p('r3harassment'), 'ban'), 'dismiss o delete');
reset role;
do $$ begin
  if (select deleted_at is not null or status <> 'dismissed' from profile_comments c join profile_comment_reports r on r.comment_id = c.id where c.body = 'comentario 2') then
    raise exception 'descartar no dejó el comentario o la denuncia como corresponde';
  end if;
  if (select deleted_by from profile_comments where body = 'comentario 1') <> t94u('mod') then raise exception 'borrar no borró el comentario'; end if;
  if exists (select 1 from profile_comment_reports r join profile_comments c on c.id = r.comment_id where c.body = 'comentario 1' and r.status <> 'removed') then
    raise exception 'quedaron denuncias abiertas del comentario borrado';
  end if;
  if (select resolved_by from profile_comment_reports r join profile_comments c on c.id = r.comment_id where c.body = 'comentario 2') <> t94u('mod') then raise exception 'falta quién resolvió'; end if;
end $$;
select t94_como('mod'); set local role authenticated;
do $$ begin
  if (profile_comment_reports_admin('open')->>'total')::int <> 1 then raise exception 'quedan más abiertas de las que van'; end if;
  if (profile_comment_reports_admin('resolved')->>'total')::int <> 3 then raise exception 'las resueltas no son 3'; end if;
  if (profile_comment_reports_admin(null)->>'total')::int <> 4 then raise exception 'todas no son 4'; end if;
end $$;
reset role;
-- El comentario borrado ya no se denuncia.
select t94_como('ban1'); set local role authenticated;
select t94_falla(format('select profile_comment_report(%L, %L)', t94p('c1'), 'spam'), 'no existe');
reset role;
do $$ begin raise notice 'ok 94.5: la lista paginada, filtrada y ordenada; descartar deja el comentario y borrar lo borra y cierra sus denuncias'; end $$;

-- ===== 6. La insignia en la ficha del matchmaking =====
select t94_como('admin'); set local role authenticated;
select admin_player_verify(t94p('a'), 'gold', null);
reset role;
do $$ begin
  if mm_player_card(t94p('a'), null)->>'verified' is distinct from 'gold' then raise exception 'mm_player_card sin la insignia'; end if;
  if mm_player_card(t94p('dueno'), null)->'verified' <> 'null'::jsonb then raise exception 'mm_player_card con insignia de más'; end if;
  raise notice 'ok 94.6: mm_player_card trae verified';
end $$;
-- Los amigos de Jugar: el dueño agrega a "a" (amistad de los dos lados, como la deja mm_add_friend aceptada).
insert into mm_friends (user_id, player_id) values (t94u('dueno'), t94p('a')) on conflict do nothing;
select t94_como('dueno'); set local role authenticated;
do $$ begin
  if (select f->>'verified' from jsonb_array_elements(mm_my_profile()->'friends') f where f->>'player_id' = t94p('a')::text) is distinct from 'gold' then
    raise exception 'los amigos de mm_my_profile sin la insignia';
  end if;
end $$;
reset role;
do $$ begin
  raise notice 'ok 94.7: los amigos de Jugar traen verified';
end $$;

drop function public.t94_falla(text, text);
drop function public.t94_como(text);
drop function public.t94u(text);
drop function public.t94p(text);
drop table public.t94;
