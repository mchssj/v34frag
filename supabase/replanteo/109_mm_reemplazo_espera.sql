-- 109: esperar 1 min 30 s antes de poder pedir un reemplazo con !callreplace (bitácora
-- docs/bitacora/2026-11-10-reemplazo-espera-minima/, Daniel 2026-11-10).
--
-- Antes, un jugador aparecía en el menú de !callreplace apenas se desconectaba (away= del poll), y su equipo podía votar
-- su reemplazo aunque se hubiera caído hace 10 segundos.
--   1. mm_config.replace_min_away_s (90 por defecto, de 0 a 600): segundos que tiene que llevar desconectado, desde su
--      última desconexión (left_at). mm_set_config lo acepta.
--   2. csstv_mm_poll: away= solo lista a los desconectados hace al menos ese tiempo.
--   3. csstv_mm_report, evento callreplace: rechaza (false) si todavía no pasó, aunque el plugin tenga una lista vieja.
-- El plugin no cambia. Reemplazos de texto marcados "(replanteo 109)". Inversa en
-- docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/109_mm_reemplazo_espera.sql.

begin;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mm_config' and column_name = 'replace_min_away_s') then
    raise exception 'replanteo 109: mm_config.replace_min_away_s ya existe (¿ya se aplicó?)';
  end if;
end $$;

alter table public.mm_config
  add column replace_min_away_s integer not null default 90 check (replace_min_away_s between 0 and 600);
comment on column public.mm_config.replace_min_away_s is
  'Segundos que un jugador tiene que llevar desconectado (desde left_at) para que su equipo pueda pedir un reemplazo con !callreplace. Replanteo 109';

-- Reemplaza en la definición de la función un fragmento que tiene que aparecer exactamente una vez.
create function pg_temp.r109(p_fn regprocedure, p_pairs text[]) returns void language plpgsql as $f$
declare
  f text := pg_get_functiondef(p_fn);
  i int;
begin
  if position('replanteo 109' in f) > 0 then
    raise exception 'replanteo 109: % ya está aplicado', p_fn;
  end if;
  for i in 1 .. array_length(p_pairs, 1) by 2 loop
    if position(p_pairs[i] in f) = 0 then
      raise exception 'replanteo 109: % no tiene el fragmento esperado: %', p_fn, p_pairs[i];
    end if;
    if position(p_pairs[i] in substr(f, position(p_pairs[i] in f) + 1)) > 0 then
      raise exception 'replanteo 109: el fragmento aparece más de una vez en %: %', p_fn, p_pairs[i];
    end if;
    f := replace(f, p_pairs[i], p_pairs[i + 1]);
  end loop;
  execute f;
end $f$;

select pg_temp.r109('public.mm_set_config(jsonb)'::regprocedure, array[
  '    replace_vote_cooldown_s = coalesce((p->>''replace_vote_cooldown_s'')::int, replace_vote_cooldown_s),' || chr(10),
  '    replace_vote_cooldown_s = coalesce((p->>''replace_vote_cooldown_s'')::int, replace_vote_cooldown_s),' || chr(10) ||
  '    replace_min_away_s = coalesce((p->>''replace_min_away_s'')::int, replace_min_away_s),  -- (replanteo 109)' || chr(10)]);

select pg_temp.r109('public.csstv_mm_poll(text,text,text)'::regprocedure, array[
  'where lp.lobby_id = l.id and lp.left_at is not null and not lp.abandoned and p.steam_id is not null), ''''),',
  'where lp.lobby_id = l.id and lp.left_at is not null and not lp.abandoned and p.steam_id is not null' ||
  ' and lp.left_at <= now() - make_interval(secs => (select replace_min_away_s from mm_config)) /* (replanteo 109) */), ''''),']);

select pg_temp.r109('public.csstv_mm_report(text,uuid,text,text)'::regprocedure, array[
  'select team into v_team from mm_lobby_players where lobby_id = l.id and user_id = v_user and left_at is not null and not abandoned;' || chr(10) ||
  '      if v_team is null or not mm_replace_can_open(l.id, v_team) then return false; end if;',
  'select team into v_team from mm_lobby_players where lobby_id = l.id and user_id = v_user and left_at is not null and not abandoned' ||
  ' and left_at <= now() - make_interval(secs => (select replace_min_away_s from mm_config));  -- (replanteo 109)' || chr(10) ||
  '      if v_team is null or not mm_replace_can_open(l.id, v_team) then return false; end if;']);

commit;
