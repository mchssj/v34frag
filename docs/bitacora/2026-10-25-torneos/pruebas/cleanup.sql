-- Borra lo sembrado para probar torneos.
begin;
delete from events where name like 'Prueba ·%';
delete from team_members where team_id::text like 'eeeeeeee-0000-%';
delete from teams where id::text like 'eeeeeeee-0000-%';
delete from players where id::text like 'eeeeeeee-1111-%';
commit;
