-- Inversa de supabase/replanteo/11_listados.sql: borra las vistas de listados.
begin;
drop view public.admin_team_requests;
drop view public.admin_user_list;
drop view public.pcw_post_list;
drop view public.team_members_view;
drop view public.team_ranking;
drop view public.event_standings;
drop view public.event_registrations_view;
drop view public.event_list;
drop view public.match_list;
commit;
