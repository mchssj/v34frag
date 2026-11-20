-- Inversa de la 132: shop_catalog vuelve a la de la 119, sin is_new. Una vista no deja quitar columnas con
-- create or replace, así que se borra y se vuelve a crear, con el comentario y los permisos de la 119.
-- Antes, la API tiene que volver a una versión que no pida is_new.
begin;

drop view public.shop_catalog;

create view public.shop_catalog as
select i.id, i.kind, i.name, i.description, i.file, i.css_class, i.vip_only, i.vip_reward, i.animated, i.collection,
       i.price as base_price,
       case when i.price is null then null
            when w.id is not null then greatest(1, round(i.price * (100 - c.weekly_discount) / 100.0)::int)
            else i.price end as price,
       i.vip_price,
       w.id is not null as weekly,
       (date_trunc('week', now() at time zone 'America/Argentina/Buenos_Aires') + interval '7 days')
         at time zone 'America/Argentina/Buenos_Aires' as weekly_ends,
       i.sort
  from shop_items i
  cross join points_config c
  left join shop_weekly() w(id) on w.id = i.id
 where i.active and c.id = 1;
comment on view public.shop_catalog is 'Catálogo activo con el precio de hoy (ofertas de la semana incluidas). Replanteo 119';
grant select on public.shop_catalog to anon, authenticated;

commit;
