begin;
alter table public.game_servers add column if not exists connect_address text, add column if not exists matchmaking_enabled boolean not null default false, add column if not exists last_assigned_at timestamptz;
do $$ begin if not exists(select 1 from pg_constraint where conname='game_servers_connect_address_format') then alter table public.game_servers add constraint game_servers_connect_address_format check(connect_address is null or connect_address ~ '^[A-Za-z0-9.-]+:[0-9]{1,5}$'); end if; end $$;
create table if not exists public.matchmaking_queue(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, player_id uuid not null references public.players(id) on delete cascade, steam_id text not null, elo integer not null default 1000 check(elo>=0), status text not null default 'waiting' check(status in('waiting','matched','cancelled')), match_id uuid references public.matches(id) on delete set null, joined_at timestamptz not null default now(), matched_at timestamptz);
create index if not exists matchmaking_queue_waiting_idx on public.matchmaking_queue(joined_at) where status='waiting';
create index if not exists matchmaking_queue_user_idx on public.matchmaking_queue(user_id,joined_at desc);
create unique index if not exists matchmaking_queue_one_waiting_per_user on public.matchmaking_queue(user_id) where status='waiting';
alter table public.matchmaking_queue enable row level security;
drop policy if exists "matchmaking: ver solo la propia cola" on public.matchmaking_queue;
create policy "matchmaking: ver solo la propia cola" on public.matchmaking_queue for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.matchmaking_try_match() returns boolean language plpgsql security definer set search_path=public as $$
declare qids uuid[]; pids uuid[]; elos integer[]; n integer:=0; total integer; bestdiff integer:=2147483647; best integer[]; a integer;b integer;c integer;d integer;e integer;i integer;s1 integer;s2 integer; t1 uuid[]:='{}';t2 uuid[]:='{}'; srv record; mid uuid:=gen_random_uuid(); tid1 uuid:=gen_random_uuid();tid2 uuid:=gen_random_uuid(); shortid text:=substr(replace(mid::text,'-',''),1,6);
begin
 select array_agg(q.id order by q.joined_at),array_agg(q.player_id order by q.joined_at),array_agg(q.elo order by q.joined_at),count(*)::integer
 into qids,pids,elos,n from (select q.* from public.matchmaking_queue q where q.status='waiting' order by q.joined_at for update skip locked limit 10) q;
 if coalesce(n,0)<10 then return false; end if;
 select gs.id,gs.name,gs.connect_address into srv from public.game_servers gs where gs.active and gs.matchmaking_enabled and gs.connect_address is not null and not exists(select 1 from public.matches m where m.server_id=gs.id and m.status in('upcoming','live')) order by gs.last_assigned_at nulls first,gs.created_at for update skip locked limit 1;
 if not found then return false; end if;
 select sum(x) into total from unnest(elos) x;
 for a in 1..6 loop for b in (a+1)..7 loop for c in (b+1)..8 loop for d in (c+1)..9 loop for e in (d+1)..10 loop
 s1:=elos[a]+elos[b]+elos[c]+elos[d]+elos[e];s2:=total-s1;
 if abs(s1-s2)<bestdiff then bestdiff:=abs(s1-s2);best:=array[a,b,c,d,e];end if;
 end loop;end loop;end loop;end loop;end loop;
 for i in 1..10 loop if i=any(best) then t1:=array_append(t1,pids[i]);else t2:=array_append(t2,pids[i]);end if;end loop;
 insert into public.teams(id,name,tag,members,kind) values(tid1,'MM-'||shortid||'-A','MMA',t1,'mix'),(tid2,'MM-'||shortid||'-B','MMB',t2,'mix');
 insert into public.matches(id,kind,team1,team2,status,starts_at,best_of,server_id,server_ip,lineup1,lineup2) values(mid,'mix',tid1,tid2,'upcoming',now(),1,srv.id,srv.connect_address,t1,t2);
 update public.matchmaking_queue set status='matched',match_id=mid,matched_at=now() where id=any(qids);
 update public.game_servers set last_assigned_at=now() where id=srv.id;
 return true;
end $$;
revoke all on function public.matchmaking_try_match() from public,anon,authenticated;

create or replace function public.matchmaking_status() returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); q public.matchmaking_queue%rowtype; waiting integer:=0; pos integer:=null; st text:='idle'; mdata jsonb:=null;
begin
 if uid is null then raise exception 'Iniciá sesión.' using errcode='42501'; end if;
 perform public.matchmaking_try_match();
 select count(*)::integer into waiting from public.matchmaking_queue where status='waiting';
 select * into q from public.matchmaking_queue x where x.user_id=uid and (x.status='waiting' or (x.status='matched' and exists(select 1 from public.matches mm where mm.id=x.match_id and mm.status in('upcoming','live')))) order by x.joined_at desc limit 1;
 if found and q.status='waiting' then
  st:='waiting';select count(*)::integer+1 into pos from public.matchmaking_queue x where x.status='waiting' and x.joined_at<q.joined_at;
 elsif found and q.status='matched' then
  st:='matched';
  select jsonb_build_object('id',m.id,'status',m.status,'server_name',gs.name,'connect_address',gs.connect_address,'team1',t1.name,'team2',t2.name,'lineup1',m.lineup1,'lineup2',m.lineup2,'roster',coalesce((select jsonb_agg(jsonb_build_object('player_id',p.id,'nick',p.nick,'elo',coalesce(pe.elo,q2.elo),'team',case when p.id=any(m.lineup1) then 1 else 2 end) order by p.nick) from public.matchmaking_queue q2 join public.players p on p.id=q2.player_id left join public.player_elo pe on pe.steam_id=q2.steam_id where q2.match_id=m.id),'[]'::jsonb))
  into mdata from public.matches m left join public.game_servers gs on gs.id=m.server_id left join public.teams t1 on t1.id=m.team1 left join public.teams t2 on t2.id=m.team2 where m.id=q.match_id;
 end if;
 return jsonb_build_object('status',st,'queue_size',waiting,'position',pos,'match',mdata);
end $$;

create or replace function public.matchmaking_join() returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); p public.players%rowtype; elo_now integer;
begin
 if uid is null then raise exception 'Iniciá sesión para entrar a la cola.' using errcode='42501'; end if;
 if exists(select 1 from public.matchmaking_queue q join public.matches m on m.id=q.match_id where q.user_id=uid and q.status='matched' and m.status in('upcoming','live')) then raise exception 'Ya tenés una partida de matchmaking activa.' using errcode='23505'; end if;
 select * into p from public.players where user_id=uid and steam_id ~ '^7656119[0-9]{10}$' order by id limit 1;
 if not found then raise exception 'Necesitás vincular tu perfil de jugador a tu cuenta y tener un SteamID64 válido.' using errcode='22023'; end if;
 select coalesce(pe.elo,ec.start_elo,1000) into elo_now from (select 1) x left join public.player_elo pe on pe.steam_id=p.steam_id left join public.elo_config ec on ec.id=1;
 if not exists(select 1 from public.matchmaking_queue where user_id=uid and status='waiting') then insert into public.matchmaking_queue(user_id,player_id,steam_id,elo) values(uid,p.id,p.steam_id,coalesce(elo_now,1000));end if;
 perform public.matchmaking_try_match();return public.matchmaking_status();
end $$;
create or replace function public.matchmaking_cancel() returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();begin if uid is null then raise exception 'Iniciá sesión.' using errcode='42501';end if;update public.matchmaking_queue set status='cancelled' where user_id=uid and status='waiting';return public.matchmaking_status();end $$;
revoke all on function public.matchmaking_join() from public,anon;
revoke all on function public.matchmaking_cancel() from public,anon;
revoke all on function public.matchmaking_status() from public,anon;
grant execute on function public.matchmaking_join() to authenticated;
grant execute on function public.matchmaking_cancel() to authenticated;
grant execute on function public.matchmaking_status() to authenticated;
create index if not exists matches_server_status_idx on public.matches(server_id, status);
create index if not exists matchmaking_queue_match_id_idx on public.matchmaking_queue(match_id);
commit;
