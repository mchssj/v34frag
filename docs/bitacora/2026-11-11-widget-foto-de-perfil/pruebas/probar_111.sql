-- Prueba de la 111 en la base local, todo dentro de una transacción que se deshace.
-- Uso: probar_111.sh (le pasa las rutas de la 111 y de su inversa).
\set ON_ERROR_STOP 1
begin;

-- Una ficha con foto y otra sin foto.
insert into players (id, nick, steam_id, photo_url)
values ('11111111-1111-4111-8111-000000000111', 'prueba111a', '76561190000000111', 'https://example.com/a.png'),
       ('11111111-1111-4111-8111-000000000112', 'prueba111b', '76561190000000112', null);

\i :r111

do $$
declare j jsonb;
begin
  j := widget_player('11111111-1111-4111-8111-000000000111', 'all');
  if j->>'photo_url' is distinct from 'https://example.com/a.png' then
    raise exception 'falla: con foto devolvió %', j->'photo_url';
  end if;
  j := widget_player('11111111-1111-4111-8111-000000000112', 'all');
  if not (j ? 'photo_url') or j->'photo_url' <> 'null'::jsonb then
    raise exception 'falla: sin foto devolvió %', j->'photo_url';
  end if;
  if j->>'nick' <> 'prueba111b' or j->'period' is null or j->'ultimos' is null then
    raise exception 'falla: faltan claves del 110: %', j;
  end if;
  if widget_player('00000000-0000-4000-8000-000000000000', 'all') is not null then
    raise exception 'falla: ficha inexistente no da null';
  end if;
  raise notice 'ok: 111 devuelve photo_url (con y sin foto) y conserva lo del 110';
end $$;

-- Se puede aplicar dos veces (es create or replace): la segunda no rompe.
\i :r111

\i :rev111
do $$
begin
  if widget_player('11111111-1111-4111-8111-000000000111', 'all') ? 'photo_url' then
    raise exception 'falla: la inversa dejó photo_url';
  end if;
  raise notice 'ok: la inversa vuelve al 110';
end $$;

rollback;
