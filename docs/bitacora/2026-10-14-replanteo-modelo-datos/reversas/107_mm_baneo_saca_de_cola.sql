-- Inversa de la 107: borra el trigger bans_mm_kick, mm_ban_kick, mm_unit_banned y mm_user_banned, y saca la condición de
-- mm_try_build. Los que salieron de la cola o de una sala por un baneo no vuelven.

begin;

do $$
declare
  f text := pg_get_functiondef('public.mm_try_build(text)'::regprocedure);
  v_new text := 'and not mm_unit_away(coalesce(party_id::text, user_id::text))';
  v_old text := 'and not mm_unit_away(coalesce(party_id::text, user_id::text)) and not mm_unit_banned(coalesce(party_id::text, user_id::text)) /* (replanteo 107) */';
  n int;
begin
  n := (length(f) - length(replace(f, v_old, ''))) / length(v_old);
  if n <> 3 then raise exception 'inversa 107: mm_try_build no tiene la condición de la 107 (% apariciones)', n; end if;
  execute replace(f, v_old, v_new);
end $$;

drop trigger if exists bans_mm_kick on public.bans;
drop function if exists public.bans_mm_kick();
drop function if exists public.mm_ban_kick(uuid);
drop function if exists public.mm_unit_banned(text);
drop function if exists public.mm_user_banned(uuid);

commit;
