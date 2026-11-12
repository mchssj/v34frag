-- Inversa del replanteo 110 (economía de puntos, tienda e inventario). Borra todo lo que creó, con los datos.
begin;
drop trigger if exists match_player_stats_award on public.match_player_stats;
drop trigger if exists player_medals_award on public.player_medals;
drop trigger if exists vip_memberships_award on public.vip_memberships;
drop trigger if exists matches_reverse_award on public.matches;
drop view if exists public.player_cosmetics_public, public.shop_catalog;
drop function if exists public.tg_award_match(), public.tg_reverse_match(), public.tg_award_medal(), public.tg_award_vip_welcome(),
  public.points_award(uuid, text, text, text, int, text, uuid),
  public.economy_award(uuid, text, text, text, timestamptz, text), public.wallet_of(uuid),
  public.matches_awarded_today(uuid), public.shop_theme(text),
  public.can_use_item(uuid, text), public.shop_weekly(), public.shop_buy(text), public.shop_buy_bundle(text),
  public.set_my_cosmetics(jsonb), public.wishlist_toggle(text), public.my_wallet(),
  public.my_ledger(uuid, text, bigint, int), public.my_inventory(), public.admin_points_grant(uuid, text, int, text),
  public.admin_economy_set(int, int, int, int), public.admin_economy_rule_set(text, int, int, boolean),
  public.admin_shop_item_update(text, int, boolean, boolean), public.admin_item_grant(uuid, text, text),
  public.admin_item_revoke(uuid, text, text), public.admin_wallets(text, int, int);
drop table if exists public.user_wishlist, public.user_cosmetics, public.user_items, public.shop_items,
  public.point_ledger, public.economy_rules, public.economy_config;
commit;
