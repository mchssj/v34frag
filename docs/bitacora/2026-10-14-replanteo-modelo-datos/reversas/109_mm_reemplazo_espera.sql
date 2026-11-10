-- Inversa de la 109: !callreplace vuelve a mostrar a los desconectados apenas se van, y mm_config sin replace_min_away_s.

begin;

create function pg_temp.i109(p_fn regprocedure, p_frag text, p_orig text) returns void language plpgsql as $f$
declare
  f text := pg_get_functiondef(p_fn);
begin
  if position(p_frag in f) = 0 then
    raise exception 'inversa 109: % no tiene el fragmento de la 109', p_fn;
  end if;
  f := replace(f, p_frag, p_orig);
  if position('replanteo 109' in f) > 0 then raise exception 'inversa 109: quedaron restos en %', p_fn; end if;
  execute f;
end $f$;

select pg_temp.i109('public.mm_set_config(jsonb)'::regprocedure,
  '    replace_min_away_s = coalesce((p->>''replace_min_away_s'')::int, replace_min_away_s),  -- (replanteo 109)' || chr(10), '');
select pg_temp.i109('public.csstv_mm_poll(text,text,text)'::regprocedure,
  ' and lp.left_at <= now() - make_interval(secs => (select replace_min_away_s from mm_config)) /* (replanteo 109) */', '');
select pg_temp.i109('public.csstv_mm_report(text,uuid,text,text)'::regprocedure,
  ' and left_at <= now() - make_interval(secs => (select replace_min_away_s from mm_config));  -- (replanteo 109)', ';');

alter table public.mm_config drop column replace_min_away_s;

commit;
