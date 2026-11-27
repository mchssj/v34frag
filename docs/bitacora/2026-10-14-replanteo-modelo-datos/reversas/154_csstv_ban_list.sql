-- Inversa del replanteo 154.
begin;
drop function if exists public.csstv_ban_list(text);
drop function if exists public.csstv_ban_list_clean(text, int);
notify pgrst, 'reload schema';
commit;
