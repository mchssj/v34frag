-- Inversa del replanteo 92 (ofertas de PCW, publicar con VIP y mapas fijos). Vuelve a "el primero que acepta se la queda":
--   - se borran las ofertas (pcw_offers), sus funciones y el trigger que las rechaza al cerrarse un anuncio;
--   - se borran las notificaciones pcw_offer, pcw_offer_chosen y pcw_offer_rejected;
--   - accept_pcw, pcw_cleanup, create_pcw_post, veto_sequence, match_map_pool, match_series_maps y
--     notification_category vuelven a como estaban (desde replanteo92_funciones, que se borra al final).
-- Las partidas creadas al elegir una oferta quedan: son PCW normales.
begin;

do $$
begin
  if to_regclass('public.replanteo92_funciones') is null then
    raise exception 'inversa 92: falta replanteo92_funciones (¿se aplicó la 92?)';
  end if;
end $$;

drop trigger pcw_posts_close_offers on public.pcw_posts;
drop trigger pcw_posts_close_offers_delete on public.pcw_posts;
drop function public.tg_pcw_posts_close_offers();
drop function public.pcw_offer_send(uuid, text, uuid[], text[], uuid, timestamptz);
drop function public.pcw_offer_withdraw(uuid);
drop function public.pcw_offer_choose(uuid);
drop function public.pcw_my_context();
drop table public.pcw_offers;
delete from public.notifications where type in ('pcw_offer', 'pcw_offer_chosen', 'pcw_offer_rejected');

do $$
declare r record; v_role text;
begin
  for r in select fn, def, exec_roles from public.replanteo92_funciones loop
    execute r.def;  -- create or replace (accept_pcw no existe: se crea)
    if r.fn like 'accept_pcw(%' then
      -- Recién creada: los mismos permisos que tenía.
      execute format('revoke all on function public.%s from public, anon, authenticated, service_role', r.fn);
      foreach v_role in array r.exec_roles loop
        if v_role <> 'postgres' then execute format('grant execute on function public.%s to %I', r.fn, v_role); end if;
      end loop;
    end if;
  end loop;
end $$;

drop table public.replanteo92_funciones;

commit;
