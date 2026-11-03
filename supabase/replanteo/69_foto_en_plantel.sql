-- Replanteo 69: la foto de cada integrante en el plantel de un equipo (bitácora docs/bitacora/2026-11-03-foto-en-plantel).
-- team_members_view leía solo players.photo_url, que queda vacía cuando el jugador sube su foto desde la cuenta
-- (profile_details.avatar_url). El plantel y "Roles de equipo" mostraban la inicial. Ahora usa lo mismo que
-- player_overview: coalesce(players.photo_url, profile_details.avatar_url).
-- Solo cambia la expresión de photo_url: mismas columnas, mismo orden, security_invoker como antes. Va después de la 68.
begin;

do $$
declare d text := pg_get_viewdef('public.team_members_view'::regclass, true);
begin
  if position('avatar_url' in d) > 0 then
    raise exception 'replanteo 69: team_members_view ya usa avatar_url (¿ya se aplicó?)';
  end if;
  if position('p.photo_url,' in d) = 0 then
    raise exception 'replanteo 69: team_members_view no tiene p.photo_url como se esperaba';
  end if;
  d := replace(d, 'p.photo_url,',
    'COALESCE(p.photo_url, ( SELECT d.avatar_url FROM profile_details d WHERE d.user_id = p.user_id)) AS photo_url,');
  execute 'create or replace view public.team_members_view with (security_invoker = true) as ' || d;
end $$;

notify pgrst, 'reload schema';
commit;
