-- 131: los sorteos no dan artículos desactivados (bitácora docs/bitacora/2026-11-20-sorteos-sin-desactivados/,
-- Daniel 2026-11-20).
--
-- La 126 dejaba crear un código con un artículo inactivo ("exclusivo de sorteo"). Daniel lo saca: admin_code_create
-- rechaza un artículo con active = false. Los códigos ya creados siguen dando su artículo. Es la misma función de la
-- 126 con una validación más (create or replace conserva los permisos).
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/131_sorteos_sin_desactivados.sql.
begin;

create or replace function public.admin_code_create(
  p_reward text, p_item text default null, p_amount int default null, p_days int default null,
  p_max_uses int default 1, p_count int default 1, p_starts_at timestamptz default null, p_expires_at timestamptz default null,
  p_for_user uuid default null, p_custom text default null, p_label text default null, p_note text default null
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_batch uuid := gen_random_uuid(); v_start timestamptz := coalesce(p_starts_at, now()); v_out jsonb := '[]';
  v_code text; v_display text; v_id uuid; v_try int; i shop_items;
begin
  if not is_admin() then raise exception 'Solo un administrador puede crear códigos' using errcode = '42501'; end if;
  if p_reward is null or p_reward not in ('item', 'points', 'vip_coins', 'vip') then
    raise exception 'Premio inválido: item, points, vip_coins o vip';
  end if;
  if p_reward = 'item' then
    select * into i from shop_items where id = p_item;
    if not found then raise exception 'No existe ese artículo'; end if;
    if i.vip_reward then raise exception 'Ese artículo viene con el VIP: haz un código de VIP'; end if;
    if not i.active then raise exception 'Ese artículo no está en la tienda: actívalo para sortearlo'; end if;
    if p_amount is not null then raise exception 'Un artículo no lleva cantidad'; end if;
  elsif p_reward = 'vip' then
    if p_days is null then raise exception 'Elige cuántos días de VIP'; end if;
    if p_item is not null or p_amount is not null then raise exception 'El VIP no lleva artículo ni cantidad'; end if;
  else
    if p_amount is null or p_amount not between 1 and 100000 then raise exception 'La cantidad va de 1 a 100.000'; end if;
    if p_item is not null or p_days is not null then raise exception 'Los puntos y las monedas no llevan artículo ni días'; end if;
  end if;
  if p_days is not null and p_days not between 1 and 365 then raise exception 'Los días van de 1 a 365'; end if;
  if coalesce(p_max_uses, 0) not between 1 and 10000 then raise exception 'Los usos van de 1 a 10.000'; end if;
  if coalesce(p_count, 0) not between 1 and 100 then raise exception 'Se crean de 1 a 100 códigos por vez'; end if;
  if p_expires_at is not null and (p_expires_at <= v_start or p_expires_at <= now()) then
    raise exception 'El vencimiento tiene que ser después del comienzo y en el futuro';
  end if;
  if p_for_user is not null then
    if not exists (select 1 from profiles where id = p_for_user) then raise exception 'No existe esa cuenta'; end if;
    if p_count <> 1 or p_max_uses <> 1 then raise exception 'Un código para una cuenta es uno solo y de 1 uso'; end if;
  end if;
  if char_length(p_label) > 80 then raise exception 'El sorteo puede tener hasta 80 caracteres'; end if;
  if char_length(p_note) > 200 then raise exception 'La nota puede tener hasta 200 caracteres'; end if;

  if nullif(btrim(p_custom), '') is not null then
    if p_count <> 1 then raise exception 'Un código personalizado se crea de a uno'; end if;
    if char_length(btrim(p_custom)) > 30 or btrim(p_custom) !~ '^[A-Za-z0-9-]+$' then raise exception 'El código personalizado lleva solo letras, números y guiones (hasta 30)'; end if;
    v_code := code_normalize(p_custom);
    if char_length(v_code) not between 8 and 24 then raise exception 'El código personalizado va de 8 a 24 letras y números'; end if;
    if exists (select 1 from redeem_codes where code = v_code) then raise exception 'Ese código ya existe'; end if;
    insert into redeem_codes (code, display, custom, batch_id, reward, item_id, amount, duration_days, max_uses, for_user,
                              starts_at, expires_at, label, note, created_by)
    values (v_code, upper(btrim(p_custom)), true, v_batch, p_reward, p_item, p_amount, p_days, p_max_uses, p_for_user,
            v_start, p_expires_at, nullif(btrim(p_label), ''), nullif(btrim(p_note), ''), auth.uid())
    returning id into v_id;
    return jsonb_build_object('batch_id', v_batch, 'codes', jsonb_build_array(jsonb_build_object('id', v_id, 'code', upper(btrim(p_custom)))));
  end if;

  for n in 1 .. p_count loop
    v_try := 0;
    loop
      v_try := v_try + 1;
      v_display := code_random12();
      v_display := 'CML-' || substr(v_display, 1, 4) || '-' || substr(v_display, 5, 4) || '-' || substr(v_display, 9, 4);
      v_code := code_normalize(v_display);
      exit when not exists (select 1 from redeem_codes where code = v_code);
      if v_try >= 5 then raise exception 'No se pudo generar un código único'; end if;
    end loop;
    insert into redeem_codes (code, display, custom, batch_id, reward, item_id, amount, duration_days, max_uses, for_user,
                              starts_at, expires_at, label, note, created_by)
    values (v_code, v_display, false, v_batch, p_reward, p_item, p_amount, p_days, p_max_uses, p_for_user,
            v_start, p_expires_at, nullif(btrim(p_label), ''), nullif(btrim(p_note), ''), auth.uid())
    returning id into v_id;
    v_out := v_out || jsonb_build_array(jsonb_build_object('id', v_id, 'code', v_display));
  end loop;
  return jsonb_build_object('batch_id', v_batch, 'codes', v_out);
end $$;

commit;
