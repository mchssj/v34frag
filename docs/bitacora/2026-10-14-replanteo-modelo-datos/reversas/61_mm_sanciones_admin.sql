-- Inversa del replanteo 61 (sanciones de la cola en Administración): saca la lista, la función y el registro.
-- Las sanciones ya levantadas quedan levantadas.
begin;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'inversa 61: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.mm_admin_lists(text, text)', array[
  ['if p_what in (''reports'', ''bans'', ''penalties'') then', 'if p_what in (''reports'', ''bans'') then'],
  ['    when ''penalties'' then (select coalesce(jsonb_agg(jsonb_build_object(''user_id'', p.user_id, ''player_id'', pl.id, ''nick'', pl.nick,' || E'\n' ||
   '        ''level'', p.level, ''max_level'', (select cardinality(penalty_ladder) from mm_config limit 1),' || E'\n' ||
   '        ''reason'', lg.reason, ''since'', lg.created_at, ''until'', p.until) order by p.until), ''[]'')' || E'\n' ||
   '        from mm_penalties p left join players pl on pl.user_id = p.user_id' || E'\n' ||
   '        left join lateral (select reason, created_at from mm_penalty_log where user_id = p.user_id order by created_at desc, id desc limit 1) lg on true' || E'\n' ||
   '        where p.until > now())' || E'\n',
   '']
]);

drop function public.mm_admin_lift_penalty(uuid, text);
alter table public.mm_penalty_log drop column lifted_at, drop column lifted_by, drop column lift_reason;

notify pgrst, 'reload schema';

commit;
