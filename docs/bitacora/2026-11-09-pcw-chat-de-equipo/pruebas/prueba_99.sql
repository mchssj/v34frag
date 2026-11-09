-- Pruebas del replanteo 99. Las arma probar_99.sh: van entre el replanteo y su inversa, dentro de una transacción que
-- se deshace al final. Usan una PCW que ya exista con una cuenta en cada lado que pueda escribir en su chat, una cuenta
-- de afuera y un admin. Cada bloque corre como la cuenta que dice (t95_como) y con el rol authenticated (RLS).

-- El límite de mensajes por segundo frena los inserts seguidos de la prueba (vuelve con el rollback).
alter table public.match_chat disable trigger chat_rate_limit;
create temp table t95 (k text primary key, u uuid);
grant select on t95 to authenticated;

do $$
declare m uuid; a uuid; b uuid; f uuid; adm uuid; u uuid; s int;
begin
  for m in select id from matches where kind = 'pcw' loop
    a := null; b := null;
    for s in 1 .. 2 loop
      foreach u in array match_side_users(m, s) loop
        perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
        if match_my_side(m) = s and match_chat_can_write(m) then
          if s = 1 then a := u; else b := u; end if;
          exit;
        end if;
      end loop;
    end loop;
    exit when a is not null and b is not null;
  end loop;
  if a is null or b is null then raise exception 'prueba 99: no hay una PCW con una cuenta que escriba en cada lado'; end if;
  select u.id into f from auth.users u left join profiles p on p.id = u.id
   where not u.id = any(match_side_users(m)) and coalesce(p.role, 'user') <> 'admin' limit 1;
  select id into adm from profiles where role = 'admin' and not id = any(match_side_users(m)) limit 1;
  insert into t95 values ('m', m), ('a', a), ('b', b), ('f', f), ('adm', adm);
  raise notice 'ok: PCW % con una cuenta en cada lado', m;
end $$;

create function pg_temp.como(k text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', (select u from t95 where t95.k = $1), 'role', 'authenticated')::text, true) $$;
create function pg_temp.m() returns uuid language sql stable as $$ select u from t95 where k = 'm' $$;

-- ===== 1. mm_my_team en una PCW =====
do $$
begin
  perform pg_temp.como('a');
  if mm_my_team(pg_temp.m()) is distinct from 1 then raise exception '1: el lado 1 no da 1'; end if;
  perform pg_temp.como('b');
  if mm_my_team(pg_temp.m()) is distinct from 2 then raise exception '1: el lado 2 no da 2'; end if;
  perform pg_temp.como('f');
  if mm_my_team(pg_temp.m()) is not null then raise exception '1: alguien de afuera tiene lado'; end if;
  raise notice 'ok 1: mm_my_team en una PCW';
end $$;

-- ===== 2. Escribir: el general y el de tu lado sí; con el lado ajeno no =====
select pg_temp.como('a');
set local role authenticated;
insert into match_chat (match_id, user_id, message) values (pg_temp.m(), auth.uid(), 't95 general');
insert into match_chat (match_id, user_id, message, side) values (pg_temp.m(), auth.uid(), 't95 equipo 1', 1);
do $$
begin
  begin
    insert into match_chat (match_id, user_id, message, side) values (pg_temp.m(), auth.uid(), 't95 espía', 2);
    raise exception '2: escribió en el chat del otro lado';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok 2: escribir con el lado propio';
end $$;
reset role;

select pg_temp.como('b');
set local role authenticated;
insert into match_chat (match_id, user_id, message, side) values (pg_temp.m(), auth.uid(), 't95 equipo 2', 2);
reset role;

-- ===== 3. Leer: cada lado ve el general y el suyo; afuera solo el general; el admin todo =====
create function pg_temp.ve(k text) returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.como(k);
  set local role authenticated;
  select string_agg(message, ',' order by message) into r from match_chat_public where match_id = pg_temp.m() and message like 't95 %';
  reset role;
  return coalesce(r, '');
end $$;
do $$
begin
  if pg_temp.ve('a') <> 't95 equipo 1,t95 general' then raise exception '3: el lado 1 ve %', pg_temp.ve('a'); end if;
  if pg_temp.ve('b') <> 't95 equipo 2,t95 general' then raise exception '3: el lado 2 ve %', pg_temp.ve('b'); end if;
  if pg_temp.ve('f') <> 't95 general' then raise exception '3: afuera ve %', pg_temp.ve('f'); end if;
  if pg_temp.ve('nadie') <> 't95 general' then raise exception '3: sin sesión ve %', pg_temp.ve('nadie'); end if;
  if (select u from t95 where k = 'adm') is not null
     and pg_temp.ve('adm') <> 't95 equipo 1,t95 equipo 2,t95 general' then raise exception '3: el admin ve %', pg_temp.ve('adm'); end if;
  raise notice 'ok 3: cada uno lee lo suyo';
end $$;
