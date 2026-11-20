-- 132: etiqueta "Nuevo" en la tienda durante 3 días (bitácora docs/bitacora/2026-11-20-tienda-etiqueta-nuevo/,
-- Daniel 2026-11-20).
--
-- shop_catalog (de la 119) suma is_new: el artículo entró a la base (shop_items.created_at) hace menos de 3 días.
-- Activar uno desactivado no lo vuelve nuevo. Una vista solo admite columnas nuevas al final; create or replace
-- conserva los permisos.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/132_tienda_etiqueta_nuevo.sql.
begin;

create or replace view public.shop_catalog as
select i.id, i.kind, i.name, i.description, i.file, i.css_class, i.vip_only, i.vip_reward, i.animated, i.collection,
       i.price as base_price,
       case when i.price is null then null
            when w.id is not null then greatest(1, round(i.price * (100 - c.weekly_discount) / 100.0)::int)
            else i.price end as price,
       i.vip_price,
       w.id is not null as weekly,
       (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') + interval '7 days')
         at time zone 'America/Argentina/Buenos_Aires' as weekly_ends,
       i.sort,
       i.created_at >= now() - interval '3 days' as is_new
  from shop_items i
  cross join points_config c
  left join shop_weekly() w(id) on w.id = i.id
 where i.active and c.id = 1;

commit;
