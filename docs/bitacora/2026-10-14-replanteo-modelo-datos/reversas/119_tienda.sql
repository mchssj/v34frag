-- Inversa de la 119: borra la tienda. Se pierden los inventarios, lo equipado, los regalos de puntos, las portadas, lo
-- propio (avatar y fondos subidos) y sus denuncias (los archivos quedan en los buckets avatars y cosmetics). Los puntos ganados no se
-- pierden: se calculan.

begin;

-- Los avisos que ya se mandaron: sin su tipo, el check de notifications los rechazaría.
delete from public.notifications where type in ('points_granted', 'item_granted', 'item_revoked', 'cover_removed', 'custom_removed');

do $$
declare r record;
begin
  if (select count(*) from public.replanteo119_funciones) <> 1 then
    raise exception 'inversa 119: falta el respaldo de notification_category';
  end if;
  for r in select nombre, def from public.replanteo119_funciones loop
    execute r.def;
  end loop;
end $$;

-- El bucket cosmetics queda, con sus archivos (Storage no deja borrarlos desde SQL); sin políticas, nadie escribe.
drop policy "cosmetics: todos ven" on storage.objects;
drop policy "cosmetics: subir el propio" on storage.objects;
drop policy "cosmetics: borrar el propio" on storage.objects;
drop function public.profile_media_report_resolve(uuid, text);
drop function public.profile_media_reports_admin(text, text, text, text, integer, integer);
drop function public.media_report_current(uuid, text, text);
drop function public.profile_media_report(uuid, text, text, text);
drop function public.admin_custom_clear(uuid, uuid, text);
drop table public.profile_media_reports;
drop function public.media_report_reason_label(text);
drop function public.custom_cosmetic_delete(uuid);
drop function public.custom_cosmetic_set(text, boolean, text, text, int);
drop function public.custom_cosmetic_clear(uuid, text, uuid);
drop view public.player_cosmetics_public;
drop view public.shop_catalog;
drop function public.user_items_of(uuid);
drop function public.admin_points_accounts(text, boolean, text, int, int);
drop function public.admin_cover_clear(uuid, text);
drop function public.set_points_config(jsonb);
drop function public.admin_shop_item_update(text, jsonb);
drop function public.admin_item_revoke(uuid, text, text);
drop function public.admin_item_grant(uuid, text, text);
drop function public.admin_points_grant(uuid, int, text, text);
drop function public.cosmetic_json(text);
drop function public.set_my_cosmetics(jsonb);
drop function public.custom_cosmetic_json(uuid);
drop function public.shop_buy(text);
drop function public.can_use_item(uuid, text);
drop function public.shop_weekly();
drop function public.points_history(uuid, text, int, int);
drop function public.points_summary(uuid);
drop function public.points_totals(uuid);
drop function public.points_mixes_of(uuid);
drop function public.was_vip(uuid, timestamptz);
drop table public.user_cosmetics;
drop table public.custom_cosmetics;
drop table public.point_grants;
drop table public.user_items;
drop table public.shop_items;
drop table public.points_config;
alter table public.profile_details drop column cover_url;
drop table public.replanteo119_funciones;

commit;
