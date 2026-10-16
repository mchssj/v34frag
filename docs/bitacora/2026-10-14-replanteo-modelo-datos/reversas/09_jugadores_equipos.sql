-- Inversa de supabase/replanteo/09_jugadores_equipos.sql.
-- Saca el alias único, las palabras bloqueadas, las invitaciones, las reglas de plantel, el bando de PCW
-- "como equipo", el ranking, el listado de jugadores y las bajas seguras. Los nicks sincronizados con el
-- alias quedan como están (es un dato, no estructura).
begin;

create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $f$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 09: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $f$;

select pg_temp.reemplazar('public.handle_new_user()', array[
  [E'  -- (replanteo 09) alias tomado o con palabra bloqueada: queda el genérico\n  insert into profiles(id, tag)\n  values (new.id, (select case when alias_check(x.t) = ''ok'' then x.t else ''user_'' || right(replace(new.id::text, ''-'', ''''), 8) end\n                     from (select coalesce(nullif(left(trim(coalesce(new.raw_user_meta_data->>''tag'','''')), 24), ''''), ''user_'' || left(new.id::text, 6)) as t) x))',
   E'  insert into profiles(id, tag)\n  values (new.id, coalesce(nullif(left(trim(coalesce(new.raw_user_meta_data->>''tag'','''')), 24), ''''), ''user_'' || left(new.id::text, 6)))']
]);

create or replace function public.set_my_tag(p_tag text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  p_tag := trim(coalesce(p_tag, ''));
  if char_length(p_tag) < 2 or char_length(p_tag) > 24 then
    raise exception 'El nickname debe tener entre 2 y 24 caracteres';
  end if;
  insert into profiles(id, tag) values (auth.uid(), p_tag)
  on conflict (id) do update set tag = excluded.tag;
end $function$;

drop trigger teams_safe_delete on public.teams;
drop trigger players_safe_delete on public.players;
drop function public.teams_safe_delete();
drop function public.players_safe_delete();

drop function public.admin_users(text);
drop view public.steam_unlinked;
drop view public.team_overview;
drop view public.player_matches;
drop view public.player_overview;
drop view public.team_standings;
drop function public.set_ranking_config(int, int);
drop table public.ranking_config;

drop function public.approve_team_request(uuid);
drop function public.reject_team_request(uuid);
drop trigger team_requests_rules on public.team_requests;
drop function public.team_requests_rules();

drop function public.team_invite(uuid, uuid, text);
drop function public.team_request_join(uuid);
drop function public.team_invite_answer(uuid, boolean);
drop function public.team_invite_cancel(uuid);
drop function public.team_leave(uuid);
drop function public.team_kick(uuid, uuid);
drop function public.team_can_join(uuid, uuid);
drop function public.team_invites_expire();
drop table public.team_invites;

drop trigger tournament_registrations_unicos on public.tournament_registrations;
drop function public.tournament_registrations_unicos();
drop trigger team_members_rules on public.team_members;
drop function public.team_members_rules();

drop trigger teams_rules on public.teams;
drop function public.teams_rules();
drop index public.teams_parent;
alter table public.teams drop column parent_team_id;

drop trigger profiles_alias_nick on public.profiles;
drop function public.profiles_alias_nick();
drop trigger players_nick_alias on public.players;
drop function public.players_nick_alias();
drop function public.set_user_tag(uuid, text, boolean);
drop function public.alias_check(text);
drop index public.profiles_tag_unico;
alter table public.profiles drop column tag_changed_at;
comment on column public.profiles.tag is null;

drop function public.blocked_names_hits();
drop function public.admin_name_blocked(text);
drop function public.name_blocked(text);
drop table public.blocked_words;
drop function public.blocked_words_norm();
drop function public.name_norm(text);
drop function public.search_norm(text);

commit;
