-- Avatares de la tienda: un cosmético más (kind 'avatar') que reemplaza la foto de perfil mientras esté puesto.
-- Plan: docs/bitacora/2026-11-01-avatares-tienda/PLAN.md. Necesita 20261029210000_vip_progresion.sql.
-- - shop_items.kind acepta 'avatar'; user_cosmetics.avatar guarda el equipado.
-- - set_my_cosmetics, player_cosmetics_public y admin_item_revoke lo tienen en cuenta.
-- - Carga los 24 avatares y 12 fondos nuevos.
-- Re-ejecutable.

begin;

alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check
  check (kind in ('frame', 'sticker', 'theme', 'name', 'background', 'avatar'));

alter table public.user_cosmetics
  add column if not exists avatar text references public.shop_items(id) on delete set null;

-- Igual que en 20261029200000_fondo_miniperfil.sql, con avatar como un tipo más de un solo artículo.
create or replace function public.set_my_cosmetics(p_data jsonb) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r user_cosmetics; k text; v text; st text[];
begin
  if v_uid is null then raise exception 'Iniciá sesión' using errcode = '42501'; end if;
  if jsonb_typeof(p_data) <> 'object' then raise exception 'Datos inválidos'; end if;
  perform pg_advisory_xact_lock(hashtext('shop:' || v_uid::text));
  insert into user_cosmetics (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into r from user_cosmetics where user_id = v_uid;
  foreach k in array array['frame', 'theme', 'name', 'background', 'avatar'] loop
    if p_data ? k then
      v := nullif(p_data ->> k, '');
      if v is not null then
        if not exists (select 1 from shop_items where id = v and kind = k) then raise exception 'Ese artículo no es del tipo %', k; end if;
        if not can_use_item(v_uid, v) then raise exception 'Todavía no tenés ese artículo'; end if;
      end if;
      if k = 'frame' then r.frame := v; elsif k = 'theme' then r.theme := v;
      elsif k = 'name' then r.name := v; elsif k = 'background' then r.background := v; else r.avatar := v; end if;
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
  update user_cosmetics set frame = r.frame, theme = r.theme, name = r.name, background = r.background, avatar = r.avatar,
         stickers = r.stickers, updated_at = now()
   where user_id = v_uid;
  return jsonb_build_object('frame', r.frame, 'theme', r.theme, 'name', r.name, 'background', r.background, 'avatar', r.avatar,
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
       case when can_use_item(c.user_id, c.background) then c.background end as background,
       case when can_use_item(c.user_id, c.avatar) then c.avatar end as avatar
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
         background = nullif(background, p_item), avatar = nullif(avatar, p_item), stickers = array_remove(stickers, p_item), updated_at = now()
   where user_id = p_user;
end $$;
revoke all on function public.admin_item_revoke(uuid, text, text) from public, anon;
grant execute on function public.admin_item_revoke(uuid, text, text) to authenticated, service_role;

-- ---------- Carga de los artículos ----------
-- Generado con docs/bitacora/2026-11-01-avatares-tienda/pruebas/generar_avatares.py.
-- Re-ejecutable: actualiza textos y archivos; los precios y "activo" solo se ponen la primera vez.
insert into public.shop_items (id, kind, name, description, file, css_class, vip_only, animated, collection, price, vip_price, sort) values
-- --- inicio: artículos generados ---
  ('avatar-rayo', 'avatar', 'Destello rubio', 'Pelo de punta y bandana con un rayo.', 'avatares/rayo.svg', null, false, false, 'anime', 1000, null, 6000),
  ('avatar-bruja', 'avatar', 'Ojos de hielo', 'Sombrero puntiagudo y mirada helada.', 'avatares/bruja.svg', null, false, false, 'anime', 1000, null, 6010),
  ('avatar-roja', 'avatar', 'Melena roja', 'Pelo de fuego y sonrisa de costado.', 'avatares/roja.svg', null, false, false, 'anime', 1000, null, 6020),
  ('avatar-samurai', 'avatar', 'Samurái', 'Moño alto, cicatriz y pocas palabras.', 'avatares/samurai.svg', null, false, false, 'anime', 1000, null, 6030),
  ('avatar-estudiante', 'avatar', 'Delegada', 'Coletas, anteojos y todas las tareas al día.', 'avatares/estudiante.svg', null, false, false, 'anime', 1000, null, 6040),
  ('avatar-gamer', 'avatar', 'Sin dormir', 'Auriculares puestos y una partida más.', 'avatares/gamer.svg', null, false, false, 'anime', 1000, null, 6050),
  ('avatar-gato-lentes', 'avatar', 'Gato con lentes', 'Fino, de saco y con lentes negros.', 'avatares/gato-lentes.svg', null, false, false, 'memes', 1000, null, 6060),
  ('avatar-gato-enojado', 'avatar', 'Gato enojado', 'No le gustan los lunes ni tus tiros.', 'avatares/gato-enojado.svg', null, false, false, 'memes', 1000, null, 6070),
  ('avatar-shiba', 'avatar', 'Perro tranqui', 'Todo está bien, aunque pierdas 16 a 0.', 'avatares/shiba.svg', null, false, false, 'memes', 1000, null, 6080),
  ('avatar-rana', 'avatar', 'Rana contenta', 'Una rana a la que le da lo mismo el ELO.', 'avatares/rana.svg', null, false, false, 'memes', 1000, null, 6090),
  ('avatar-capibara', 'avatar', 'Capibara zen', 'En paz con todos, incluso con los campers.', 'avatares/capibara.svg', null, false, false, 'memes', 1000, null, 6100),
  ('avatar-pato', 'avatar', 'Pato de goma', 'Hace cuac y escucha tus problemas.', 'avatares/pato.svg', null, false, false, 'memes', 1000, null, 6110),
  ('avatar-relampago', 'avatar', 'Relámpago dorado', 'Rayos alrededor y ojos que brillan.', 'avatares/relampago.svg', null, true, true, 'anime', null, 1000, 6120),
  ('avatar-hechicera', 'avatar', 'Hechicera', 'Parpadea entre chispas azules.', 'avatares/hechicera.svg', null, true, true, 'anime', null, 1000, 6130),
  ('avatar-oni', 'avatar', 'Oni', 'Cuernos, brasas y ojos encendidos.', 'avatares/oni.svg', null, true, true, 'anime', null, 1000, 6140),
  ('avatar-sombra', 'avatar', 'Sombra', 'Pañuelo, parche y un solo ojo atento.', 'avatares/sombra.svg', null, true, true, 'anime', null, 1000, 6150),
  ('avatar-nieve', 'avatar', 'Princesa de nieve', 'Pelo blanco y una nevada que no para.', 'avatares/nieve.svg', null, true, true, 'anime', null, 1000, 6160),
  ('avatar-cerezo', 'avatar', 'Bajo el cerezo', 'Coletas rosas y pétalos que caen.', 'avatares/cerezo.svg', null, true, true, 'anime', null, 1000, 6170),
  ('avatar-gato-lentes-vip', 'avatar', 'Gato bailarín', 'Se mueve al ritmo y le caen los lentes.', 'avatares/gato-lentes-vip.svg', null, true, true, 'memes', null, 1000, 6180),
  ('avatar-gato-amor', 'avatar', 'Gato enamorado', 'Ojos de corazón que no paran de latir.', 'avatares/gato-amor.svg', null, true, true, 'memes', null, 1000, 6190),
  ('avatar-mono', 'avatar', 'Mono risueño', 'Se ríe de tu último tiro fallado.', 'avatares/mono.svg', null, true, true, 'memes', null, 1000, 6200),
  ('avatar-pinguino', 'avatar', 'Pingüino navideño', 'Con gorro de lana y nieve encima.', 'avatares/pinguino.svg', null, true, true, 'memes', null, 1000, 6210),
  ('avatar-zorro', 'avatar', 'Zorro astuto', 'Pestañea entre brasas y te mira de reojo.', 'avatares/zorro.svg', null, true, true, 'memes', null, 1000, 6220),
  ('avatar-capibara-vip', 'avatar', 'Capibara con naranja', 'Se balancea con una naranja en la cabeza.', 'avatares/capibara-vip.svg', null, true, true, 'memes', null, 1000, 6230),
  ('fondo-extra-cerezos', 'background', 'Cerezos en flor', 'Pétalos que caen sobre ramas rosas.', 'fondos/extra-cerezos.svg', null, false, true, 'anime', 800, null, 6240),
  ('fondo-extra-velocidad', 'background', 'Líneas de velocidad', 'Como la viñeta de un golpe final.', 'fondos/extra-velocidad.svg', null, false, true, 'anime', 800, null, 6250),
  ('fondo-extra-tejados', 'background', 'Tejados de noche', 'Una aldea dormida bajo la luna.', 'fondos/extra-tejados.svg', null, false, true, 'anime', 800, null, 6260),
  ('fondo-extra-lluvia-neon', 'background', 'Lluvia de neón', 'Carteles que titilan en la ciudad mojada.', 'fondos/extra-lluvia-neon.svg', null, false, true, 'anime', 800, null, 6270),
  ('fondo-extra-gatos', 'background', 'Lluvia de gatos', 'Gatos que caen dando vueltas.', 'fondos/extra-gatos.svg', null, false, true, 'memes', 800, null, 6280),
  ('fondo-extra-grafico', 'background', 'Sube y sube', 'Velas verdes hasta el techo.', 'fondos/extra-grafico.svg', null, false, true, 'memes', 800, null, 6290),
  ('fondo-extra-rayo', 'background', 'Destello amarillo', 'Rayos dorados y cuchillos clavados en la noche.', 'fondos/extra-rayo.svg', null, true, true, 'anime', null, 1000, 6300),
  ('fondo-extra-luna', 'background', 'Luna de cuervos', 'Cuervos que cruzan una luna enorme.', 'fondos/extra-luna.svg', null, true, true, 'anime', null, 1000, 6310),
  ('fondo-extra-runas', 'background', 'Círculo de runas', 'Tres círculos mágicos que giran.', 'fondos/extra-runas.svg', null, true, true, 'anime', null, 1000, 6320),
  ('fondo-extra-olas', 'background', 'Gran ola', 'Olas que avanzan bajo un sol rojo.', 'fondos/extra-olas.svg', null, true, true, 'anime', null, 1000, 6330),
  ('fondo-extra-disco', 'background', 'Noche de baile', 'Bola de espejos y luces de colores.', 'fondos/extra-disco.svg', null, true, true, 'memes', null, 1000, 6340),
  ('fondo-extra-patos', 'background', 'Baño de patos', 'Patos de goma que suben entre burbujas.', 'fondos/extra-patos.svg', null, true, true, 'memes', null, 1000, 6350)
-- --- fin: artículos generados ---
on conflict (id) do update set kind = excluded.kind, name = excluded.name, description = excluded.description,
  file = excluded.file, css_class = excluded.css_class, vip_only = excluded.vip_only, animated = excluded.animated,
  collection = excluded.collection, sort = excluded.sort,
  price = case when excluded.vip_only then null else shop_items.price end;

commit;
