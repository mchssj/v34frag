-- Inversa del replanteo 50: vuelve el mínimo de 5 mixes de la 48.
begin;
alter table public.mm_config alter column min_mixes set default 5;
update public.mm_config set min_mixes = 5;
commit;
