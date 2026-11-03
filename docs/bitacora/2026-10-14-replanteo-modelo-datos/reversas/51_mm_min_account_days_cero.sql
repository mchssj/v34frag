-- Inversa del replanteo 51: vuelven los 7 días de antigüedad mínima de la 48.
begin;
alter table public.mm_config alter column min_account_days set default 7;
update public.mm_config set min_account_days = 7;
commit;
