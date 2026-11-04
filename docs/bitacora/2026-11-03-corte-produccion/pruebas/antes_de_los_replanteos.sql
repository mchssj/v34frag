-- Paso 2.2 del corte: las fichas con nick repetido (sin distinguir mayúsculas), que hacen abortar el replanteo 27.
-- Se renombra la de cada par con menos mapas (nick + '_2'). Las cuatro son fichas sin cuenta, cada una con su SteamID
-- (consultado en producción el 2026-11-03). Aborta si cambió algo desde entonces.
begin;

do $$
declare n int;
begin
  select count(*) into n from players
   where id in ('9321d9c9-b9e0-42f2-bd25-efa98b328af2', '68530300-5b28-43df-b41a-fd687cefa582') and user_id is null;
  if n <> 2 then raise exception 'corte: las fichas a renombrar ya no están como el 2026-11-03'; end if;
end $$;

update players set nick = nick || '_2' where id = '9321d9c9-b9e0-42f2-bd25-efa98b328af2';  -- geusz, 3 mapas
update players set nick = nick || '_2' where id = '68530300-5b28-43df-b41a-fd687cefa582';  -- Thorfinn, 1 mapa

-- El alias de cuenta repetido, que hace abortar el replanteo 09 (encontrado en el ensayo del 2026-11-03): dos cuentas
-- "musul". Se renombra la segunda (alta el 2026-10-20, un solo inicio de sesión, sin ficha).
do $$
begin
  if not exists (select 1 from profiles where id = '18b6b088-441c-4e7a-a26c-d914ec835cac' and lower(tag) = 'musul')
     or exists (select 1 from players where user_id = '18b6b088-441c-4e7a-a26c-d914ec835cac') then
    raise exception 'corte: la cuenta "musul" a renombrar ya no está como el 2026-11-03';
  end if;
end $$;
update profiles set tag = 'musul_2' where id = '18b6b088-441c-4e7a-a26c-d914ec835cac';

do $$
begin
  if exists (select 1 from players group by lower(nick) having count(*) > 1) then
    raise exception 'corte: siguen quedando nicks repetidos';
  end if;
  if exists (select lower(trim(tag)) from profiles group by 1 having count(*) > 1) then
    raise exception 'corte: siguen quedando alias de cuenta repetidos';
  end if;
end $$;

commit;
