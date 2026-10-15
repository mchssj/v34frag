-- Pruebas de supabase/replanteo/01_limpieza.sql (correr con la migración aplicada).
do $$
declare n int;
begin
  assert to_regclass('public.player_claims') is null, 'player_claims sigue existiendo';
  assert not exists (select 1 from information_schema.columns where table_schema = 'public' and
    (table_name, column_name) in (('profiles', 'player_id'), ('player_medals', 'color'), ('matches', 'demo_url'), ('matches', 'video_url'))),
    'quedó alguna columna que había que borrar';

  -- Una política de lectura y una de admin por tabla.
  select count(*) into n from pg_policies where tablename = 'events';
  assert n = 2, format('events tiene %s políticas (esperadas 2)', n);
  select count(*) into n from pg_policies where tablename = 'matches';
  assert n = 2, format('matches tiene %s políticas (esperadas 2)', n);
  select count(*) into n from pg_policies where tablename = 'players' and cmd = 'SELECT';
  assert n = 1, format('players tiene %s políticas de lectura (esperada 1)', n);

  -- La vista pública de perfiles sigue funcionando.
  perform 1 from public.public_profiles limit 1;

  -- El formato swiss ya no se acepta; los demás sí.
  begin
    insert into public.events (name, format) values ('prueba swiss', 'swiss');
    assert false, 'se pudo crear un torneo swiss';
  exception when check_violation then null;
  end;
  insert into public.events (name, format) values ('prueba double', 'double');
  delete from public.events where name = 'prueba double';

  raise notice 'replanteo 01: ok';
end $$;
