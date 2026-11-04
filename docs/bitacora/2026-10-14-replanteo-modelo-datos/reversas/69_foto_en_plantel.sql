-- Inversa del replanteo 69: team_members_view vuelve a leer solo players.photo_url.
begin;

do $$
declare d text := pg_get_viewdef('public.team_members_view'::regclass, true);
declare nuevo text := 'COALESCE(p.photo_url, ( SELECT d.avatar_url
           FROM profile_details d
          WHERE d.user_id = p.user_id)) AS photo_url,';
begin
  if position(nuevo in d) = 0 then
    raise exception 'inversa 69: team_members_view no tiene la foto del replanteo 69';
  end if;
  execute 'create or replace view public.team_members_view with (security_invoker = true) as ' || replace(d, nuevo, 'p.photo_url,');
end $$;

notify pgrst, 'reload schema';
commit;
