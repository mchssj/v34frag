-- Inversa de la 146 (preveto de mapas para VIP). Primero, volver la API y la web a la versión anterior.
-- Se pierden los mapas que eligieron los VIP (mm_prevetos) y cuántos votos tuvo cada preveto (match_vetos.vip_votes).
-- Los baneos por preveto quedan en match_vetos como baneos automáticos sin bando.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 146: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- Lo agregado entre "(replanteo 146) ini" y "fin", con su salto de línea.
create or replace function pg_temp.sacar_146(fn regprocedure) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); n text;
begin
  n := regexp_replace(d, E'\n\\s*-- \\(replanteo 146\\) ini.*?-- \\(replanteo 146\\) fin', '', 'g');
  if n = d then raise exception 'inversa 146: en % no se encontró el bloque', fn; end if;
  execute n;
end $$;

select pg_temp.sacar_146('public.mm_start_veto(uuid)');
select pg_temp.sacar_146('public.mm_my_profile()');
select pg_temp.reemplazar('public.mm_lobby_json(uuid, uuid)', array[[
  $a$'auto', v.by_user is null and v.vip_votes is null, 'vip_votes', v.vip_votes) order by v.seq)$a$,
  $b$'auto', v.by_user is null) order by v.seq)$b$]]);
select pg_temp.reemplazar('public.mm_set_config(jsonb)', array[[
  $a$block_changes_week),
    vip_preveto_max = coalesce((p->>'vip_preveto_max')::int, vip_preveto_max)  -- (replanteo 146)$a$,
  $b$block_changes_week)$b$]]);
select pg_temp.reemplazar('public.mm_set_mode_maps(text, text[])', array[[
  $a$
  perform mm_emit('mm.config', null, null);  -- (replanteo 146) las opciones del preveto salen del pool$a$, '']]);
select pg_temp.reemplazar('public.manual_valores()', array[[
  $a$ 'mm.preveto_max', m.vip_preveto_max,$a$, '']]);

drop function public.mm_set_preveto(text, text);
drop function public.mm_preveto_slots(text);
drop table public.mm_prevetos;
alter table public.match_vetos drop column vip_votes;
alter table public.mm_config drop column vip_preveto_max;

notify pgrst, 'reload schema';
commit;
