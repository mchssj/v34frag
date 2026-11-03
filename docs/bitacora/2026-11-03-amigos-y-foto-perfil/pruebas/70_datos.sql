-- Después de la 70: la ficha del caso previo quedó sin su foto y la foto quedó en el respaldo.
do $$ begin
  if (select photo_url from players where id = (select p from caso)) is not null then
    raise exception 'FALLA 70 datos: la ficha sigue con su foto';
  end if;
  if not exists (select 1 from replanteo70_fotos_ficha where player_id = (select p from caso) and photo_url = 'https://x/photos/viejo.jpg') then
    raise exception 'FALLA 70 datos: no quedó en el respaldo';
  end if;
  raise notice 'OK: el arreglo de datos de la 70';
end $$;
