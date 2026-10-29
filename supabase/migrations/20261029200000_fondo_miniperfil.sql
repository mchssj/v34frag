-- Fondo de miniperfil: un cosmético más (kind 'background') que va detrás de la tarjeta chica del jugador.
-- Plan: docs/bitacora/2026-10-29-fondo-miniperfil/PLAN.md. Necesita 20261029180000_tienda.sql.
-- - shop_items.kind acepta 'background'; user_cosmetics.background guarda el equipado.
-- - set_my_cosmetics, player_cosmetics_public y admin_item_revoke lo tienen en cuenta.
-- - Carga los 24 fondos (12 para todos, 12 VIP).
-- Re-ejecutable.

begin;

alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check
  check (kind in ('frame', 'sticker', 'theme', 'name', 'background'));

alter table public.user_cosmetics
  add column if not exists background text references public.shop_items(id) on delete set null;

-- Igual que en 20261029180000_tienda.sql, con background como un tipo más de un solo artículo.
create or replace function public.set_my_cosmetics(p_data jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r user_cosmetics; k text; v text; st text[];
begin
  if v_uid is null then raise exception 'Iniciá sesión' using errcode = '42501'; end if;
  if jsonb_typeof(p_data) <> 'object' then raise exception 'Datos inválidos'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));
  insert into user_cosmetics (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into r from user_cosmetics where user_id = v_uid;
  foreach k in array array['frame', 'theme', 'name', 'background'] loop
    if p_data ? k then
      v := nullif(p_data ->> k, '');
      if v is not null then
        if not exists (select 1 from shop_items where id = v and kind = k) then raise exception 'Ese artículo no es del tipo %', k; end if;
        if not can_use_item(v_uid, v) then raise exception 'Todavía no tenés ese artículo'; end if;
      end if;
      if k = 'frame' then r.frame := v; elsif k = 'theme' then r.theme := v;
      elsif k = 'name' then r.name := v; else r.background := v; end if;
    end if;
  end loop;
  if p_data ? 'stickers' then
    if jsonb_typeof(p_data -> 'stickers') <> 'array' then raise exception 'stickers tiene que ser una lista'; end if;
    select coalesce(array_agg(distinct t.x), '{}') into st from jsonb_array_elements_text(p_data -> 'stickers') t(x) where t.x <> '';
    if cardinality(st) > 3 then raise exception 'Podés equipar hasta 3 stickers'; end if;
    foreach v in array st loop
      if not exists (select 1 from shop_items where id = v and kind = 'sticker') then raise exception 'Ese artículo no es un sticker'; end if;
      if not can_use_item(v_uid, v) then raise exception 'Todavía no tenés ese sticker'; end if;
    end loop;
    -- conserva el orden en que llegaron
    select coalesce(array_agg(x order by o), '{}') into r.stickers
      from (select distinct on (x) x, o from jsonb_array_elements_text(p_data -> 'stickers') with ordinality t(x, o) where x <> '' order by x, o) s;
  end if;
  update user_cosmetics set frame = r.frame, theme = r.theme, name = r.name, background = r.background,
         stickers = r.stickers, updated_at = now()
   where user_id = v_uid;
  return jsonb_build_object('frame', r.frame, 'theme', r.theme, 'name', r.name, 'background', r.background,
                            'stickers', to_jsonb(r.stickers));
end $$;
revoke all on function public.set_my_cosmetics(jsonb) from public, anon;
grant execute on function public.set_my_cosmetics(jsonb) to authenticated, service_role;

-- La columna nueva va al final: create or replace view no deja cambiar el orden de las que ya están.
create or replace view public.player_cosmetics_public as
select p.id as player_id, c.user_id, is_vip(c.user_id) as vip,
       case when can_use_item(c.user_id, c.frame) then c.frame end as frame,
       case when can_use_item(c.user_id, c.theme) then c.theme end as theme,
       case when can_use_item(c.user_id, c.name) then c.name end as name,
       coalesce((select array_agg(s order by o) from unnest(c.stickers) with ordinality u(s, o)
                  where can_use_item(c.user_id, s)), '{}') as stickers,
       case when can_use_item(c.user_id, c.background) then c.background end as background
  from user_cosmetics c
  join players p on p.user_id = c.user_id;
grant select on public.player_cosmetics_public to anon, authenticated;

create or replace function public.admin_item_revoke(p_user uuid, p_item text, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Solo un administrador puede quitar artículos' using errcode = '42501'; end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 1 and 200 then raise exception 'El motivo es obligatorio (hasta 200 caracteres)'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || p_user::text));
  delete from user_items where user_id = p_user and item_id = p_item;
  if not found then raise exception 'No tiene ese artículo'; end if;
  update user_cosmetics set frame = nullif(frame, p_item), theme = nullif(theme, p_item), name = nullif(name, p_item),
         background = nullif(background, p_item), stickers = array_remove(stickers, p_item), updated_at = now()
   where user_id = p_user;
end $$;
revoke all on function public.admin_item_revoke(uuid, text, text) from public, anon;
grant execute on function public.admin_item_revoke(uuid, text, text) to authenticated, service_role;

-- ---------- Carga de los fondos ----------
-- Generado con docs/bitacora/2026-10-29-fondo-miniperfil/pruebas/generar_fondos.py.
-- Re-ejecutable: actualiza textos y archivos; el precio y "activo" solo se ponen la primera vez.
insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, animated, collection, price, sort) values
-- --- inicio: fondos generados ---
  ('fondo-humo', 'background', 'Granada de humo', 'Humo que cruza la tarjeta de lado a lado.', 'fondos/humo.svg', null, false, true, 'cs', 1000, 5000),
  ('fondo-radar', 'background', 'Radar', 'El radar barre y marca enemigos.', 'fondos/radar.svg', null, false, true, 'cs', 1000, 5010),
  ('fondo-casquillos', 'background', 'Lluvia de casquillos', 'Vainas de bronce que caen girando.', 'fondos/casquillos.svg', null, false, true, 'cs', 1000, 5020),
  ('fondo-neon', 'background', 'Neón', 'Sol retro y cuadrícula que avanza.', 'fondos/neon.svg', null, false, true, 'cs', 1000, 5030),
  ('fondo-tormenta', 'background', 'Tormenta', 'Lluvia y relámpagos de noche.', 'fondos/tormenta.svg', null, false, true, 'cs', 1000, 5040),
  ('fondo-consola', 'background', 'Consola', 'Columnas de código que bajan.', 'fondos/consola.svg', null, false, true, 'cs', 1000, 5050),
  ('fondo-mapa-dust2', 'background', 'Atardecer en el desierto', 'Dunas, sol bajo y arena con viento.', 'fondos/mapa-dust2.svg', null, false, true, 'mapas', 800, 5060),
  ('fondo-mapa-inferno', 'background', 'Brasas del pueblo', 'Muros de ladrillo, arcos y brasas que suben.', 'fondos/mapa-inferno.svg', null, false, true, 'mapas', 800, 5070),
  ('fondo-mapa-nuke', 'background', 'Planta nuclear', 'Símbolo que gira y franjas de peligro.', 'fondos/mapa-nuke.svg', null, false, true, 'mapas', 800, 5080),
  ('fondo-mapa-office', 'background', 'Oficina nevada', 'Edificios de noche con nieve que cae.', 'fondos/mapa-office.svg', null, false, true, 'mapas', 800, 5090),
  ('fondo-pais-cruz-del-sur', 'background', 'Cruz del Sur', 'El cielo del sur con sus estrellas.', 'fondos/pais-cruz-del-sur.svg', null, false, true, 'paises', 800, 5100),
  ('fondo-pais-carnaval', 'background', 'Carnaval', 'Papelitos y serpentinas de colores.', 'fondos/pais-carnaval.svg', null, false, true, 'paises', 800, 5110),
  ('fondo-serie-luna-roja', 'background', 'Luna roja', 'Hojas que vuelan bajo una luna enorme.', 'fondos/serie-luna-roja.svg', null, true, true, 'series', null, 5120),
  ('fondo-serie-aura', 'background', 'Aura dorada', 'Energía dorada que sube sin parar.', 'fondos/serie-aura.svg', null, true, true, 'series', null, 5130),
  ('fondo-serie-portal', 'background', 'Portal verde', 'Un portal en espiral que gira.', 'fondos/serie-portal.svg', null, true, true, 'series', null, 5140),
  ('fondo-serie-cristal', 'background', 'Cristales del desierto', 'Cristales azules que brillan de noche.', 'fondos/serie-cristal.svg', null, true, true, 'series', null, 5150),
  ('fondo-serie-niebla', 'background', 'Ciudad de humo', 'Fábricas, chimeneas y niebla de época.', 'fondos/serie-niebla.svg', null, true, true, 'series', null, 5160),
  ('fondo-serie-reves', 'background', 'Del otro lado', 'Cielo rojo, relámpagos y esporas flotando.', 'fondos/serie-reves.svg', null, true, true, 'series', null, 5170),
  ('fondo-serie-alien', 'background', 'Energía alien', 'Celdas verdes que se encienden en onda.', 'fondos/serie-alien.svg', null, true, true, 'series', null, 5180),
  ('fondo-serie-billetes', 'background', 'El gran golpe', 'Lluvia de billetes y caretas.', 'fondos/serie-billetes.svg', null, true, true, 'series', null, 5190),
  ('fondo-serie-abismo', 'background', 'Abismo', 'Medusas de colores y burbujas en lo profundo.', 'fondos/serie-abismo.svg', null, true, true, 'series2', null, 5200),
  ('fondo-arma-trazadoras', 'background', 'Fuego cruzado', 'Trazadoras que cruzan en diagonal.', 'fondos/arma-trazadoras.svg', null, true, true, 'arsenal', null, 5210),
  ('fondo-arma-oro', 'background', 'Bóveda de oro', 'Lingotes con un brillo que pasa.', 'fondos/arma-oro.svg', null, true, true, 'arsenal', null, 5220),
  ('fondo-arma-dragon', 'background', 'Escamas de dragón', 'Escamas rojas y un ojo que parpadea.', 'fondos/arma-dragon.svg', null, true, true, 'arsenal', null, 5230)
-- --- fin: fondos generados ---
on conflict (id) do update set kind = excluded.kind, name = excluded.name, description = excluded.description,
  file = excluded.file, css_class = excluded.css_class, vip_only = excluded.vip_only, animated = excluded.animated,
  collection = excluded.collection, sort = excluded.sort,
  price = case when excluded.vip_only then null else shop_items.price end;

commit;
