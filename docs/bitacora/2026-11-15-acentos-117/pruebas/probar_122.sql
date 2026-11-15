-- Prueba de la 122 en una transacción que se deshace (base local o producción).
-- Uso: probar_122.sh (le pasa la ruta de la 122 sin begin ni commit).
--   En una base sana (la local): rompe las siete funciones y los dos comentarios como quedaron en producción
--   (UTF-8 leído como WIN1252, con \r\n), aplica la 122 y comprueba que vuelven a ser idénticos a los de antes.
--   En producción (ya rotos): aplica la 122 y comprueba que no queda nada roto y que las funciones se pueden llamar.
\set ON_ERROR_STOP 1
begin;

create temp table objetos (fn regprocedure);
insert into objetos select f from unnest(array[
  to_regprocedure('public.ban_lift(uuid, text)'), to_regprocedure('public.clip_reject(uuid, text)'),
  to_regprocedure('public.clip_reprocess(uuid)'), to_regprocedure('public.clip_review_ok(uuid)'),
  to_regprocedure('public.mm_admin_lists(text, text)'), to_regprocedure('public.profile_comment_delete(uuid)'),
  to_regprocedure('public.team_staff_remove_logo(uuid, text)')]) f;
do $$ begin
  if (select count(*) from objetos where fn is not null) <> 7 then raise exception 'falla 0: faltan funciones de la 117'; end if;
end $$;

-- ¿Ya está rota (producción) o sana (local)? Sana = sin "Ã" seguido de un carácter de la segunda mitad de Latin-1.
create temp table estado as
select bool_or(pg_get_functiondef(fn) ~ (chr(195) || '[' || chr(128) || '-' || chr(191) || ']')) as rota from objetos;

create temp table antes as
select fn, md5(replace(pg_get_functiondef(fn), chr(13), '')) as h from objetos;
create temp table comentarios_antes as
select obj_description('public.support_actions'::regclass, 'pg_class') as tabla,
       col_description('public.match_clips'::regclass, (select attnum from pg_attribute
         where attrelid = 'public.match_clips'::regclass and attname = 'video_reprocessed_by')) as columna;

-- 1. En una base sana, romperlas como en producción.
do $$
declare o record; d text;
begin
  if (select rota from estado) then raise notice 'ok 1: ya estaban rotas (producción), no se rompen'; return; end if;
  for o in select fn from objetos loop
    d := convert_from(convert_to(pg_get_functiondef(o.fn), 'UTF8'), 'WIN1252');
    execute replace(d, chr(10), chr(13) || chr(10));
  end loop;
  execute format('comment on table public.support_actions is %L',
                 convert_from(convert_to((select tabla from comentarios_antes), 'UTF8'), 'WIN1252'));
  execute format('comment on column public.match_clips.video_reprocessed_by is %L',
                 convert_from(convert_to((select columna from comentarios_antes), 'UTF8'), 'WIN1252'));
  if not exists (select 1 from objetos where pg_get_functiondef(fn) ~ (chr(195) || '[' || chr(128) || '-' || chr(191) || ']')) then
    raise exception 'falla 1: no se rompieron';
  end if;
  raise notice 'ok 1: rotas como en producción';
end $$;

-- 2. La 122.
\i :r122

-- 3. Ya no queda nada roto, y en la base sana quedan idénticas a las de antes.
do $$
declare distintas text;
begin
  if exists (select 1 from objetos where pg_get_functiondef(fn) ~ (chr(195) || '[' || chr(128) || '-' || chr(191) || ']')
                                      or position(chr(13) in pg_get_functiondef(fn)) > 0) then
    raise exception 'falla 3: siguen rotas';
  end if;
  if obj_description('public.support_actions'::regclass, 'pg_class') ~ (chr(195) || '[' || chr(128) || '-' || chr(191) || ']') then
    raise exception 'falla 3: el comentario de support_actions';
  end if;
  if not (select rota from estado) then
    select string_agg(a.fn::text, ', ') into distintas from antes a where a.h <> md5(pg_get_functiondef(a.fn));
    if distintas is not null then raise exception 'falla 3: no quedan como antes: %', distintas; end if;
    if obj_description('public.support_actions'::regclass, 'pg_class') <> (select tabla from comentarios_antes) then
      raise exception 'falla 3: el comentario de support_actions no quedó como antes';
    end if;
    if col_description('public.match_clips'::regclass, (select attnum from pg_attribute
         where attrelid = 'public.match_clips'::regclass and attname = 'video_reprocessed_by')) <> (select columna from comentarios_antes) then
      raise exception 'falla 3: el comentario de video_reprocessed_by no quedó como antes';
    end if;
    raise notice 'ok 3: arregladas e idénticas a las de antes';
  else
    raise notice 'ok 3: arregladas';
  end if;
end $$;

-- 3b. Ningún comentario de public con secuencias rotas: "Ã" + Latin-1, o "â€" (comillas, rayas, "›", "…").
do $$
declare quedan text;
begin
  select string_agg(i.identity, ', ') into quedan
    from pg_description d, lateral pg_identify_object(d.classoid, d.objoid, d.objsubid) i
   where i.schema = 'public'
     and (d.description ~ (chr(195) || '[' || chr(128) || '-' || chr(191) || ']') or position(chr(226) || chr(8364) in d.description) > 0);
  if quedan is not null then raise exception 'falla 3b: comentarios rotos: %', quedan; end if;
  raise notice 'ok 3b: ningún comentario roto';
end $$;

-- 4. Los textos de los errores salen bien: ban_lift sin baneo da "No existe ese baneo" (sin acentos), y clip_reject sin
-- sesión de soporte da un mensaje con acentos.
do $$ begin
  perform clip_reject('00000000-0000-4000-8000-000000000122', 'x');
  raise exception 'falla 4: clip_reject pasó sin sesión';
exception when others then
  if sqlerrm like 'falla 4%' then raise; end if;
  if sqlerrm ~ (chr(195) || '[' || chr(128) || '-' || chr(191) || ']') then raise exception 'falla 4: mensaje roto: %', sqlerrm; end if;
  raise notice 'ok 4: clip_reject responde "%"', sqlerrm;
end $$;

-- 5. Los permisos siguen igual.
do $$ begin
  if has_function_privilege('anon', 'public.ban_lift(uuid, text)', 'execute') then raise exception 'falla 5: anon ejecuta ban_lift'; end if;
  if not has_function_privilege('authenticated', 'public.ban_lift(uuid, text)', 'execute') then raise exception 'falla 5: authenticated no ejecuta ban_lift'; end if;
  raise notice 'ok 5: los permisos siguen igual';
end $$;

rollback;
