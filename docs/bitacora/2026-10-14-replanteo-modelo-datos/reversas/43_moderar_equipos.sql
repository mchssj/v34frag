-- Inversa de supabase/replanteo/43_moderar_equipos.sql. Se pierde el historial de cambios de los equipos y los avisos
-- team_staff_action quedan sin categoría (se borran).
begin;

do $$
begin
  if to_regclass('public.team_audit') is null then raise exception 'inversa 43: no existe team_audit (¿no se aplicó la 43?)'; end if;
end $$;

drop view public.admin_team_list;
drop function public.team_name_blocked(text, text);
drop function public.team_staff_rename(uuid, text, text, text);
drop function public.team_staff_remove_logo(uuid, text);
drop function public.team_staff_remove_member(uuid, uuid, text);
drop function public.team_staff_set_captain(uuid, uuid, text);
drop function public.team_staff_add_member(uuid, uuid, text, text);
drop function public.team_staff_set_role(uuid, uuid, text, text);
drop function public.team_staff_dissolve(uuid, text);
drop function public.team_staff_end(teams, text, jsonb);
drop function public.team_staff_begin(uuid, text, boolean);

drop trigger team_audit_members on public.team_members;
drop trigger team_audit_teams on public.teams;
drop function public.tg_team_audit_members();
drop function public.tg_team_audit_teams();
drop function public.team_audit_add(uuid, text, jsonb);
drop function public.team_actor_role(uuid);
drop table public.team_audit;

delete from public.notifications where type = 'team_staff_action';
do $$
declare d text := pg_get_functiondef('public.notification_category(text)'::regprocedure);
begin
  execute replace(d, '''team_dissolved'', ''team_staff_action'') then ''team''', '''team_dissolved'') then ''team''');
end $$;
create or replace function public.notification_required(p_type text) returns boolean
  language sql immutable as $$
  select p_type in ('team_invite', 'team_join_request', 'password_changed')
$$;

create or replace function public.tg_notify_team_members() returns trigger
  language plpgsql security definer set search_path = public as $$
declare t teams%rowtype; v_user uuid;
begin
  select * into t from teams where id = new.team_id;
  if t.kind is distinct from 'official' then return null; end if;
  v_user := (select user_id from players where id = new.player_id);
  if tg_op = 'INSERT' then
    -- Entró por una invitación o un pedido (lo avisa su respuesta) o es quien creó el equipo: nada más.
    if new.left_at is null and v_user is distinct from t.captain_id
       and not exists (select 1 from team_invites where team_id = new.team_id and player_id = new.player_id and status = 'open') then
      perform notify(array[v_user], 'team_added', jsonb_build_object('team', team_ref(t.id), 'role', new.role));
    end if;
    return null;
  end if;
  if old.left_at is null and new.left_at is not null then
    if current_setting('v34.team_deleting', true) = t.id::text then return null; end if;
    if v_user is not null and v_user = auth.uid() then
      perform notify(array[t.captain_id], 'team_member_left', jsonb_build_object('team', team_ref(t.id), 'player', player_ref(new.player_id)));
    else
      perform notify(array[v_user], 'team_removed', jsonb_build_object('team', team_ref(t.id)));
    end if;
  elsif new.left_at is null and new.role is distinct from old.role then
    perform notify(array[v_user], 'team_role_changed', jsonb_build_object('team', team_ref(t.id), 'role', new.role));
  end if;
  return null;
end $$;

commit;
