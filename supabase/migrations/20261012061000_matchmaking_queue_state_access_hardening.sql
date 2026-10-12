begin;
drop policy if exists matchmaking_settings_public_read on public.matchmaking_settings;
create policy matchmaking_settings_public_read on public.matchmaking_settings
for select to anon, authenticated using (true);
grant select (id, queue_open, updated_at) on public.matchmaking_settings to anon, authenticated;
create or replace function public.matchmaking_queue_state()
returns jsonb language sql security invoker set search_path = public as $$
  select jsonb_build_object(
    'queue_open', coalesce((select queue_open from public.matchmaking_settings where id = true), true),
    'updated_at', (select updated_at from public.matchmaking_settings where id = true)
  );
$$;
revoke all on function public.matchmaking_queue_state() from public;
grant execute on function public.matchmaking_queue_state() to anon, authenticated;
commit;