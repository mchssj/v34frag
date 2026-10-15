-- Pruebas de supabase/replanteo/08_formatos_pcw.sql (correr con la migración aplicada). Todo con rollback.
-- Simula usuarios con request.jwt.claims (lo que lee auth.uid()) y el rol authenticated/anon.
begin;

-- Ocho jugadores con cuenta para dos rosters de PCW; tres cuentas: admin, quien publica y quien acepta.
insert into public.players (id, nick, steam_id)
  select ('dddddddd-0000-4000-8000-0000000008' || lpad(i::text, 2, '0'))::uuid, 'f' || i, '765611980000008' || lpad(i::text, 2, '0')
    from generate_series(1, 8) i;
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-0000000008ad', 'admin08@test.local'),
  ('aaaaaaaa-0000-4000-8000-000000000081', 'pub08@test.local'),
  ('aaaaaaaa-0000-4000-8000-000000000082', 'acep08@test.local');
update public.profiles set role = 'admin' where id = 'aaaaaaaa-0000-4000-8000-0000000008ad';

create function pg_temp.roster(desde int) returns uuid[] language sql as $$
  select array_agg(('dddddddd-0000-4000-8000-0000000008' || lpad(i::text, 2, '0'))::uuid order by i) from generate_series(desde, desde + 3) i $$;
grant execute on function pg_temp.roster(int) to authenticated;

do $$
begin
  assert (select best_of from public.pcw_config where id = 1) = '{1,3,5}', 'la fila inicial no tiene los tres formatos';
end $$;

-- Un anónimo lee pero no escribe.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  assert (select count(*) from public.pcw_config) = 1, 'un anónimo no puede leer pcw_config';
  begin
    update public.pcw_config set best_of = '{1}';
    assert false, 'un anónimo escribió pcw_config';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_pcw_formats('{1}');
    assert false, 'un anónimo llamó a set_pcw_formats';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Quien publica: antes de que el admin cambie nada publica un BO5 (queda abierto).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000081","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.set_pcw_formats('{1}');
    assert false, 'un usuario común cambió los formatos';
  exception when others then
    assert sqlerrm = 'Solo un administrador puede cambiar los formatos de PCW', sqlerrm;
  end;
  begin
    update public.pcw_config set best_of = '{1}';
    assert false, 'un usuario común escribió pcw_config';
  exception when insufficient_privilege then null;
  end;
  perform public.create_pcw_post('Cinco', 5, null, now() + interval '1 day', null, pg_temp.roster(1), '{}');
end $$;

-- El admin deja BO1 y BO3 (con repetidos y desordenado) y prueba los inválidos.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000008ad","role":"authenticated"}', true);
do $$
declare e text;
begin
  assert public.set_pcw_formats('{3,1,3}') = '{1,3}', 'set_pcw_formats no ordenó ni quitó repetidos';
  assert (select updated_by from public.pcw_config) = 'aaaaaaaa-0000-4000-8000-0000000008ad', 'no guardó quién lo cambió';
  foreach e in array array['{}', '{2}', '{1,7}', null] loop
    begin
      perform public.set_pcw_formats(e::int[]);
      assert false, format('set_pcw_formats aceptó %s', e);
    exception when others then
      assert sqlerrm in ('Tiene que quedar al menos un formato habilitado', 'Los formatos válidos son BO1, BO3 y BO5'), sqlerrm;
    end;
  end loop;
  assert (select best_of from public.pcw_config) = '{1,3}', 'un intento inválido cambió la configuración';
end $$;

-- Publicar ahora: BO5 ya no se puede, BO3 sí. Se usa otra cuenta (la del admin), porque cada usuario tiene
-- un solo anuncio abierto y el BO5 de antes sigue abierto para aceptarlo más abajo.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-0000000008ad","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.create_pcw_post('Cinco otra vez', 5, null, now() + interval '1 day', null, pg_temp.roster(1), '{}');
    assert false, 'se publicó un BO5 deshabilitado';
  exception when others then
    assert sqlerrm = 'El formato BO5 no está habilitado para las PCW', sqlerrm;
  end;
  perform public.create_pcw_post('Tres', 3, null, now() + interval '1 day', null, pg_temp.roster(1), '{}');
  assert (select best_of from public.pcw_posts where by_user = auth.uid() and status = 'open') = 3, 'el BO3 no quedó publicado';
end $$;

-- Quien acepta: el anuncio BO5 publicado antes se acepta y la partida queda BO5.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000082","role":"authenticated"}', true);
do $$
declare post uuid; mid uuid;
begin
  select id into post from public.pcw_posts where by_user = 'aaaaaaaa-0000-4000-8000-000000000081' and status = 'open';
  mid := public.accept_pcw(post, 'Rivales', pg_temp.roster(5), '{}');
  assert (select best_of from public.matches where id = mid) = 5, 'la partida aceptada no conservó el BO5';
  raise notice 'replanteo 08: ok';
end $$;

rollback;
