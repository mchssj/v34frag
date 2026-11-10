-- Inversa de la 106: borra demo_evict, clip_r2_evict_due y clip_r2_evicted.
-- Las demos que se marcaron vencidas y los clips que quedaron solo en Drive siguen así (los archivos ya no están en R2).
-- Antes de aplicarla, sacar el cron de recorte de los dos Workers (TRIM_CRON).

begin;

drop function if exists public.demo_evict(text, text[]);
drop function if exists public.clip_r2_evict_due(text, integer);
drop function if exists public.clip_r2_evicted(text, uuid[]);

commit;
