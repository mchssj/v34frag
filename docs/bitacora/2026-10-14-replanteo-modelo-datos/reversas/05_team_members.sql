-- Inversa de supabase/replanteo/05_team_members.sql.
-- Vuelve a poner el plantel activo de cada equipo en teams.members y restaura las funciones (los
-- reemplazos son los de la migración invertidos, generados desde ella). El historial (bajas, roles,
-- fechas) no tiene lugar en el arreglo y se pierde.
begin;

alter table public.teams add column members uuid[] default '{}'::uuid[] not null;
update public.teams t
   set members = coalesce((select array_agg(tm.player_id order by tm.created_at, tm.player_id)
                             from public.team_members tm where tm.team_id = t.id and tm.left_at is null), '{}');

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $f$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 05: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $f$;

select pg_temp.reemplazar('public.pcw_make_side(text, uuid[], text[])', array[
  [E'  insert into teams(name, tag, owner_id, captain_id, guests, kind)\n  values (nombre, ''PCW'', auth.uid(), auth.uid(), vistos, ''pcw'')\n  returning id into tid;\n  insert into team_members(team_id, player_id, joined_at) select tid, x, now() from unnest(p_players) x;',
   E'  insert into teams(name, tag, owner_id, captain_id, members, guests, kind)\n  values (nombre, ''PCW'', auth.uid(), auth.uid(), p_players, vistos, ''pcw'')\n  returning id into tid;']
]);

select pg_temp.reemplazar('public.accept_pcw(uuid, text, uuid[], text[])', array[
  ['if exists (select 1 from team_members a join team_members b on b.player_id = a.player_id where a.team_id = po.team_id and b.team_id = tid and a.left_at is null and b.left_at is null) then',
   'if exists (select 1 from teams a, teams b where a.id = po.team_id and b.id = tid and a.members && b.members) then']
]);

select pg_temp.reemplazar('public.set_team_captain(uuid, uuid)', array[
  [E'    select 1 from team_members tm join players p on p.id = tm.player_id\n    where tm.team_id = p_team and tm.left_at is null and p.user_id = p_user) then',
   E'    select 1 from teams t join players p on p.id = any(t.members)\n    where t.id = p_team and p.user_id = p_user) then']
]);

select pg_temp.reemplazar('public.validate_report()', array[
  ['select coalesce(array_agg(player_id), ''{}'') into roster from team_members where team_id = new.team_id and left_at is null;',
   'select coalesce(members, ''{}'') into roster from teams where id = new.team_id;']
]);

drop table public.team_members;

commit;
