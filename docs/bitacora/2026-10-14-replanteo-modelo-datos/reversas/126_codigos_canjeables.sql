-- Inversa de la 126: borra los códigos canjeables.
-- Se pierden los códigos, los canjes y los intentos fallidos, y los avisos code_redeemed y code_reverted.
-- Lo que ya se dio no se pierde del todo:
--   - Los puntos y las monedas quedan como regalos (point_grants), sin el canje.
--   - El VIP de un código queda como VIP dado a mano (source = 'manual'), con la misma fecha de fin.
--   - Lo que un código dio para siempre queda como regalo (source = 'grant'). Lo temporal se borra, porque sin
--     user_items.expires_at sería para siempre.
--   - Lo VIP de un código vuelve a usarse solo siendo VIP (se borra points_config.code_vip_free).

begin;

do $$ begin
  if to_regclass('public.redeem_codes') is null then raise exception 'inversa 126: la 126 no está aplicada'; end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'inversa 126: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

delete from public.notifications where type in ('code_redeemed', 'code_reverted');

drop function public.admin_redeem_attempts(int);
drop function public.admin_redemption_revert(uuid, text);
drop function public.admin_code_revoke(uuid, text);
drop function public.admin_code_redemptions(uuid);
drop function public.admin_codes(text, text, int, int);
drop function public.admin_code_create(text, text, int, int, int, int, timestamptz, timestamptz, uuid, text, text, text);
drop function public.my_redemptions();
drop function public.code_redeem(text, inet);
drop function public.code_reward_json(text, text, int, int);
drop function public.code_account(uuid);
drop function public.redeem_blocked_until(uuid);
drop function public.code_state(public.redeem_codes);
drop function public.code_random12();
drop function public.code_normalize(text);

select pg_temp.reemplazar('public.notification_category(text)', array[
  ['''points_granted'', ''item_granted'', ''item_revoked'', ''code_redeemed'', ''code_reverted'', -- (replanteo 126)
                   ',
   '''points_granted'', ''item_granted'', ''item_revoked'',']]);

drop function public.user_items_of(uuid);
-- El inventario de una cuenta: el dueño o un admin. usable: si hoy la puede usar.
create function public.user_items_of(p_user uuid default auth.uid())
  returns table (item_id text, kind text, name text, source text, currency text, price_paid int, note text,
                 acquired_at timestamptz, usable boolean)
  language plpgsql stable security definer set search_path = public as $$
begin
  if p_user is null or (p_user is distinct from auth.uid() and not is_admin()) then
    raise exception 'No puedes ver el inventario de otra cuenta' using errcode = '42501';
  end if;
  return query
  select u.item_id, i.kind, i.name, u.source, u.currency, u.price_paid, u.note, u.acquired_at, can_use_item(p_user, u.item_id)
    from user_items u join shop_items i on i.id = u.item_id
   where u.user_id = p_user
  union all
  -- el premio VIP no está en user_items: se muestra mientras sea VIP
  select i.id, i.kind, i.name, 'vip', null, null, null, null, true
    from shop_items i where i.vip_reward and is_vip(p_user)
   order by 8 desc nulls first;
end $$;
revoke all on function public.user_items_of(uuid) from public, anon;
grant execute on function public.user_items_of(uuid) to authenticated, service_role;

select pg_temp.reemplazar('public.points_history(uuid, text, integer, integer)', array[
  ['select case when g.redemption_id is not null then ''code'' else ''grant'' end, g.created_at, g.amount, g.reason, g.redemption_id::text from point_grants g -- (replanteo 126)',
   'select ''grant'', g.created_at, g.amount, g.reason, null from point_grants g']]);

select pg_temp.reemplazar('public.admin_item_grant(uuid, text, text)', array[
  ['on conflict (user_id, item_id) do update set source = ''grant'', granted_by = excluded.granted_by, note = excluded.note,
     currency = ''points'', price_paid = null, expires_at = null, acquired_at = now()
   where user_items.expires_at is not null; -- (replanteo 126) lo temporal pasa a ser para siempre',
   'on conflict (user_id, item_id) do nothing;']]);

select pg_temp.reemplazar('public.shop_buy(text)', array[
  ['if exists (select 1 from user_items where user_id = v_uid and item_id = p_item and expires_at is null) then',
   'if exists (select 1 from user_items where user_id = v_uid and item_id = p_item) then'],
  ['values (v_uid, p_item, ''purchase'', ''vip'', v_price)
      on conflict (user_id, item_id) do update set source = ''purchase'', currency = ''vip'', price_paid = excluded.price_paid,
         expires_at = null, granted_by = null, note = null, acquired_at = now();',
   'values (v_uid, p_item, ''purchase'', ''vip'', v_price);'],
  ['values (v_uid, p_item, ''purchase'', ''points'', v_price)
    on conflict (user_id, item_id) do update set source = ''purchase'', currency = ''points'', price_paid = excluded.price_paid,
       expires_at = null, granted_by = null, note = null, acquired_at = now();',
   'values (v_uid, p_item, ''purchase'', ''points'', v_price);']]);

-- can_use_item como la dejó la 119.
create or replace function public.can_use_item(p_user uuid, p_item text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_items i where i.id = p_item
                   and case when i.vip_reward then is_vip(p_user)
                            else exists (select 1 from user_items u where u.user_id = p_user and u.item_id = i.id)
                                 and (not i.vip_only or is_vip(p_user)) end)
$$;

select pg_temp.reemplazar('public.set_points_config(jsonb)', array[
  ['''custom_max_avatar'', ''custom_max_background'', ''code_vip_free'') then',
   '''custom_max_avatar'', ''custom_max_background'') then'],
  ['if k = ''code_vip_free'' then
      if jsonb_typeof(p_changes -> k) <> ''boolean'' then raise exception ''code_vip_free tiene que ser true o false''; end if;
    elsif jsonb_typeof(p_changes -> k) <> ''number'' then raise exception ''% tiene que ser un número'', k; end if;',
   'if jsonb_typeof(p_changes -> k) <> ''number'' then raise exception ''% tiene que ser un número'', k; end if;'],
  ['    code_vip_free = coalesce((p_changes ->> ''code_vip_free'')::boolean, code_vip_free), -- (replanteo 126)
    updated_at = now(), updated_by = auth.uid()',
   '    updated_at = now(), updated_by = auth.uid()']]);
alter table public.points_config drop column code_vip_free;

-- Lo que dieron los códigos
alter table public.point_grants drop column redemption_id;

delete from public.user_items where source = 'code' and expires_at is not null;
update public.user_items set source = 'grant' where source = 'code';
alter table public.user_items drop constraint user_items_source_check,
  add constraint user_items_source_check check (source in ('purchase', 'grant'));
alter table public.user_items drop column expires_at;

update public.vip_memberships set source = 'manual' where source = 'code';
alter table public.vip_memberships drop constraint vip_memberships_source_check,
  add constraint vip_memberships_source_check check (source in ('manual', 'import'));

drop table public.redeem_attempts;
drop table public.code_redemptions;
drop table public.redeem_codes;

notify pgrst, 'reload schema';

commit;
