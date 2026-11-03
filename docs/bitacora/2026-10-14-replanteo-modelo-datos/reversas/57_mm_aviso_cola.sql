-- Inversa del replanteo 57 (aviso de la cola en Discord): borra los avisos y sus funciones.
begin;

drop function public.mm_queue_ping_cancel(uuid), public.mm_queue_ping(), public.mm_queue_ping_status(), public.mm_queue_ping_next();
drop table public.mm_queue_pings;

notify pgrst, 'reload schema';

commit;
