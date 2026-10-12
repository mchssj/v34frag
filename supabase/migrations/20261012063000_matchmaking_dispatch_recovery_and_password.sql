begin;

-- The dispatcher can re-claim a still-active match after a plugin restart.
create or replace function public.matchmaking_server_poll(p_token text)
returns text language plpgsql security definer set search_path=public as $$
declare sid uuid; mid uuid; pwd text; map_name text; steam_ids text; state text;
begin
 sid:=public.csstv_auth(p_token);
 select d.match_id,d.server_password,d.dispatch_state,coalesce(nullif(m.map,''),'de_dust2')
 into mid,pwd,state,map_name
 from public.matchmaking_dispatch d join public.matches m on m.id=d.match_id
 where d.server_id=sid and d.dispatch_state in ('assigned','live') and m.status in ('upcoming','live')
 order by d.created_at desc limit 1;
 if mid is null then
  select m.id,coalesce(nullif(m.map,''),'de_dust2') into mid,map_name
  from public.matches m where m.server_id=sid and m.status in ('upcoming','live')
  order by m.starts_at desc nulls last limit 1;
  if mid is null then return 'IDLE'; end if;
  pwd:='frag'||lpad(floor(random()*10000)::integer::text,4,'0');
  insert into public.matchmaking_dispatch(match_id,server_id,server_password,dispatch_state)
  values(mid,sid,pwd,'assigned')
  on conflict(match_id) do update set server_password=excluded.server_password,dispatch_state='assigned',updated_at=now(),last_error=null
  returning server_password,dispatch_state into pwd,state;
 end if;
 select string_agg('STEAM_0:'||mod((p.steam_id::numeric-76561197960265728)::bigint,2)::text||':'||floor((p.steam_id::numeric-76561197960265728)/2)::bigint::text,',' order by p.nick)
 into steam_ids from public.matchmaking_queue q join public.players p on p.id=q.player_id
 where q.match_id=mid and q.status='matched' and p.steam_id ~ '^7656119[0-9]{10}$';
 if coalesce(steam_ids,'')='' then return 'ERROR|ROSTER_EMPTY'; end if;
 update public.matchmaking_dispatch set updated_at=now() where match_id=mid;
 return mid::text||'|'||pwd||'|'||coalesce(map_name,'de_dust2')||'|'||steam_ids;
end; $$;

create or replace function public.matchmaking_status()
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); q public.matchmaking_queue%rowtype; waiting integer:=0; pos integer:=null; st text:='idle'; mdata jsonb:=null;
begin
 if uid is null then raise exception 'Iniciá sesión.' using errcode='42501'; end if;
 perform public.matchmaking_try_match();
 select count(*)::integer into waiting from public.matchmaking_queue where status='waiting';
 select * into q from public.matchmaking_queue x where x.user_id=uid and (x.status='waiting' or (x.status='matched' and exists(select 1 from public.matches mm where mm.id=x.match_id and mm.status in('upcoming','live')))) order by x.joined_at desc limit 1;
 if found and q.status='waiting' then
  st:='waiting'; select count(*)::integer+1 into pos from public.matchmaking_queue x where x.status='waiting' and x.joined_at<q.joined_at;
 elsif found and q.status='matched' then
  st:='matched';
  select jsonb_build_object(
   'id',m.id,'status',m.status,'server_name',gs.name,'connect_address',gs.connect_address,
   'server_password',(select d.server_password from public.matchmaking_dispatch d where d.match_id=m.id and d.dispatch_state in ('assigned','live')),
   'team1',t1.name,'team2',t2.name,'lineup1',m.lineup1,'lineup2',m.lineup2,
   'roster',coalesce((select jsonb_agg(jsonb_build_object('player_id',p.id,'nick',p.nick,'elo',coalesce(pe.elo,q2.elo),'team',case when p.id=any(m.lineup1) then 1 else 2 end) order by p.nick) from public.matchmaking_queue q2 join public.players p on p.id=q2.player_id left join public.player_elo pe on pe.steam_id=q2.steam_id where q2.match_id=m.id),'[]'::jsonb))
  into mdata from public.matches m left join public.game_servers gs on gs.id=m.server_id left join public.teams t1 on t1.id=m.team1 left join public.teams t2 on t2.id=m.team2 where m.id=q.match_id;
 end if;
 return jsonb_build_object('status',st,'queue_size',waiting,'position',pos,'match',mdata);
end; $$;
revoke all on function public.matchmaking_status() from public,anon;
grant execute on function public.matchmaking_status() to authenticated;

commit;
