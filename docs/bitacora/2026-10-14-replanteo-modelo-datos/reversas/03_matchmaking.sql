-- Inversa de supabase/replanteo/03_matchmaking.sql.
-- Recrea la estructura del matchmaking tal como estaba en producción. Las secciones se extrajeron
-- automáticamente de supabase/schema/public.sql (volcado con base 20261014120000). Los DATOS no vuelven
-- (cola, envíos, modos y ajustes): si hicieran falta, están en el respaldo previo al corte.
begin;
set check_function_bodies = false;

alter table public.matches add column matchmaking_mode text;
alter table public.matches add constraint matches_matchmaking_mode_check
  check (((matchmaking_mode is null) or (matchmaking_mode = any (array['1v1'::text, '2v2'::text, '3v3'::text, '5v5'::text]))));
alter table public.game_servers add column matchmaking_enabled boolean default false not null;
alter table public.game_servers add column last_assigned_at timestamp with time zone;

--
-- Name: matchmaking_admin_release_server(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_admin_release_server(p_match_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare uid uuid:=auth.uid();
begin
 if uid is null or not exists(select 1 from public.profiles where id=uid and role='admin') then raise exception 'Solo un administrador puede liberar una partida.' using errcode='42501'; end if;
 update public.matchmaking_dispatch set dispatch_state='finished',updated_at=now() where match_id=p_match_id;
 update public.matches set status='finished' where id=p_match_id and status in ('upcoming','live');
 update public.matchmaking_queue set status='cancelled' where match_id=p_match_id and status='matched';
 return found;
end; $$;

--
-- Name: matchmaking_cancel(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_cancel() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare uid uuid:=auth.uid();begin if uid is null then raise exception 'Iniciá sesión.' using errcode='42501';end if;update public.matchmaking_queue set status='cancelled' where user_id=uid and status='waiting';return public.matchmaking_status();end $$;

--
-- Name: matchmaking_join(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_join(p_mode text DEFAULT '5v5'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  uid uuid := auth.uid();
  p public.players%rowtype;
  elo_now integer;
  is_open boolean;
  mode_enabled boolean;
  existing_mode text;
begin
  if uid is null then
    raise exception 'Iniciá sesión para entrar a la cola.' using errcode='42501';
  end if;
  select queue_open into is_open from public.matchmaking_settings where id=true;
  if coalesce(is_open,true)=false then
    raise exception 'La queue está cerrada por administración.' using errcode='55000';
  end if;
  if p_mode not in ('1v1','2v2','3v3','5v5') then
    raise exception 'Formato de matchmaking inválido.' using errcode='22023';
  end if;
  select enabled into mode_enabled from public.matchmaking_modes where mode=p_mode;
  if coalesce(mode_enabled,false)=false then
    raise exception 'Ese formato está deshabilitado por administración.' using errcode='55000';
  end if;
  if exists (
    select 1 from public.matchmaking_queue q join public.matches m on m.id=q.match_id
    where q.user_id=uid and q.status='matched' and m.status in ('upcoming','live')
  ) then
    raise exception 'Ya tenés una partida de matchmaking activa.' using errcode='23505';
  end if;
  select q.mode into existing_mode
  from public.matchmaking_queue q
  where q.user_id=uid and q.status='waiting'
  order by q.joined_at desc limit 1;
  if existing_mode is not null and existing_mode <> p_mode then
    raise exception 'Ya estás en la cola %. Cancelá la búsqueda antes de cambiar de formato.', existing_mode using errcode='23505';
  end if;

  select * into p
  from public.players
  where user_id=uid and steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$'
  order by id limit 1;
  if not found then
    raise exception 'Necesitás vincular tu cuenta a un perfil de jugador con SteamID64 válido.' using errcode='22023';
  end if;

  select coalesce(pe.elo, ec.start_elo, 1000) into elo_now
  from (select 1) x
  left join public.player_elo pe on pe.steam_id=p.steam_id
  left join public.elo_config ec on ec.id=1;

  if existing_mode is null then
    insert into public.matchmaking_queue(user_id, player_id, steam_id, elo, mode)
    values (uid, p.id, p.steam_id, coalesce(elo_now,1000), p_mode);
  end if;

  perform public.matchmaking_try_match();
  return public.matchmaking_status();
end;
$_$;

--
-- Name: matchmaking_queue_state(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_queue_state() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'queue_open', coalesce((select queue_open from public.matchmaking_settings where id = true), true),
    'updated_at', (select updated_at from public.matchmaking_settings where id = true),
    'modes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mode', mm.mode,
        'enabled', mm.enabled,
        'players_per_team', mm.players_per_team,
        'queue_size', (select count(*)::integer from public.matchmaking_queue q where q.status='waiting' and q.mode=mm.mode)
      ) order by mm.players_per_team)
      from public.matchmaking_modes mm
    ), '[]'::jsonb)
  );
$$;

--
-- Name: matchmaking_server_mark_live(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_server_mark_live(p_token text, p_match_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare sid uuid;
begin
 sid:=public.csstv_auth(p_token);
 update public.matchmaking_dispatch set dispatch_state='live',updated_at=now() where match_id=p_match_id and server_id=sid and dispatch_state in ('assigned','live');
 return found;
end; $$;

--
-- Name: matchmaking_server_poll(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_server_poll(p_token text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
 select string_agg(
   'STEAM_0:'||mod((p.steam_id::numeric-76561197960265728)::bigint,2)::text||':'||
   floor((p.steam_id::numeric-76561197960265728)/2)::bigint::text||'='||
   case when p.id=any(m.lineup1) then '3' else '2' end,
   ',' order by p.nick
 )
 into steam_ids
 from public.matchmaking_queue q
 join public.players p on p.id=q.player_id
 join public.matches m on m.id=q.match_id
 where q.match_id=mid and q.status='matched'
   and p.steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$';
 if coalesce(steam_ids,'')='' then return 'ERROR|ROSTER_EMPTY'; end if;
 update public.matchmaking_dispatch set updated_at=now() where match_id=mid;
 return mid::text||'|'||pwd||'|'||coalesce(map_name,'de_dust2')||'|'||steam_ids;
end;
$_$;

--
-- Name: matchmaking_set_mode(text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_set_mode(p_mode text, p_enabled boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id=uid and role='admin') then
    raise exception 'Solo un administrador puede configurar los formatos de matchmaking.' using errcode='42501';
  end if;
  if p_mode not in ('1v1','2v2','3v3','5v5') then
    raise exception 'Formato de matchmaking inválido.' using errcode='22023';
  end if;
  update public.matchmaking_modes
    set enabled = p_enabled, updated_at = now(), updated_by = uid
  where mode = p_mode;
  if not found then raise exception 'No existe el formato solicitado.' using errcode='22023'; end if;
  return public.matchmaking_queue_state();
end;
$$;

--
-- Name: matchmaking_set_queue_open(boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_set_queue_open(p_open boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role = 'admin') then
    raise exception 'Solo un administrador puede cambiar el estado de la queue.' using errcode = '42501';
  end if;
  insert into public.matchmaking_settings(id, queue_open, updated_at, updated_by)
  values (true, p_open, now(), uid)
  on conflict (id) do update
    set queue_open = excluded.queue_open,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
  return public.matchmaking_queue_state();
end;
$$;

--
-- Name: matchmaking_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_status() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  uid uuid := auth.uid();
  q public.matchmaking_queue%rowtype;
  waiting integer := 0;
  pos integer := null;
  st text := 'idle';
  mdata jsonb := null;
  mode_size integer := 5;
begin
  if uid is null then raise exception 'Iniciá sesión.' using errcode='42501'; end if;
  perform public.matchmaking_try_match();

  select * into q
  from public.matchmaking_queue x
  where x.user_id=uid and (
    x.status='waiting' or
    (x.status='matched' and exists (
      select 1 from public.matches mm where mm.id=x.match_id and mm.status in ('upcoming','live')
    ))
  )
  order by x.joined_at desc limit 1;

  if found then
    select players_per_team into mode_size from public.matchmaking_modes where mode=q.mode;
    select count(*)::integer into waiting from public.matchmaking_queue x where x.status='waiting' and x.mode=q.mode;
    if q.status='waiting' then
      st := 'waiting';
      select count(*)::integer+1 into pos from public.matchmaking_queue x
      where x.status='waiting' and x.mode=q.mode and x.joined_at<q.joined_at;
    else
      st := 'matched';
      select jsonb_build_object(
        'id',m.id,'status',m.status,'mode',coalesce(m.matchmaking_mode,q.mode),
        'server_name',gs.name,'connect_address',gs.connect_address,
        'server_password',(select d.server_password from public.matchmaking_dispatch d where d.match_id=m.id and d.dispatch_state in ('assigned','live')),
        'team1',t1.name,'team2',t2.name,'lineup1',m.lineup1,'lineup2',m.lineup2,
        'roster',coalesce((
          select jsonb_agg(jsonb_build_object(
            'player_id',p.id,'nick',p.nick,'elo',coalesce(pe.elo,q2.elo),
            'team',case when p.id=any(m.lineup1) then 1 else 2 end
          ) order by p.nick)
          from public.matchmaking_queue q2 join public.players p on p.id=q2.player_id
          left join public.player_elo pe on pe.steam_id=q2.steam_id
          where q2.match_id=m.id and q2.status='matched'
        ),'[]'::jsonb)
      )
      into mdata
      from public.matches m
      left join public.game_servers gs on gs.id=m.server_id
      left join public.teams t1 on t1.id=m.team1
      left join public.teams t2 on t2.id=m.team2
      where m.id=q.match_id;
    end if;
    return jsonb_build_object(
      'status',st,'queue_size',waiting,'position',pos,'mode',q.mode,
      'players_per_team',mode_size,'match',mdata
    );
  end if;
  return jsonb_build_object('status','idle','queue_size',0,'position',null,'mode',null,'players_per_team',null,'match',null);
end;
$$;

--
-- Name: matchmaking_try_match(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_try_match() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare is_open boolean;
begin
  select queue_open into is_open from public.matchmaking_settings where id = true;
  if coalesce(is_open, true) = false then return false; end if;
  return public.matchmaking_try_match_unchecked();
end;
$$;

--
-- Name: matchmaking_try_match_unchecked(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.matchmaking_try_match_unchecked() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  chosen_mode text;
  team_size integer;
  total_slots integer;
  qids uuid[];
  pids uuid[];
  elos integer[];
  n integer := 0;
  i integer;
  t1 uuid[] := '{}';
  t2 uuid[] := '{}';
  srv record;
  mid uuid;
  tid1 uuid;
  tid2 uuid;
  shortid text;
begin
  select mm.mode, mm.players_per_team
    into chosen_mode, team_size
  from public.matchmaking_modes mm
  join public.matchmaking_queue q on q.mode = mm.mode and q.status = 'waiting'
  where mm.enabled
  group by mm.mode, mm.players_per_team
  having count(*) >= mm.players_per_team * 2
  order by min(q.joined_at), mm.players_per_team
  limit 1;

  if chosen_mode is null then return false; end if;
  total_slots := team_size * 2;

  select array_agg(x.id order by x.elo desc, x.joined_at),
         array_agg(x.player_id order by x.elo desc, x.joined_at),
         array_agg(x.elo order by x.elo desc, x.joined_at),
         count(*)::integer
    into qids, pids, elos, n
  from (
    select q.id, q.player_id, q.elo, q.joined_at
    from public.matchmaking_queue q
    where q.status = 'waiting' and q.mode = chosen_mode
    order by q.joined_at
    for update skip locked
    limit total_slots
  ) x;

  if coalesce(n, 0) < total_slots then return false; end if;

  select gs.id, gs.name, gs.connect_address
    into srv
  from public.game_servers gs
  where gs.active and gs.matchmaking_enabled and gs.connect_address is not null
    and not exists (
      select 1 from public.matches m
      where m.server_id = gs.id and m.status in ('upcoming','live')
    )
  order by gs.last_assigned_at nulls first, gs.created_at
  for update skip locked
  limit 1;
  if not found then return false; end if;

  for i in 1..total_slots loop
    if mod(floor((i - 1)::numeric / 2)::integer, 2) = 0 then
      if mod(i, 2) = 1 then t1 := array_append(t1, pids[i]);
      else t2 := array_append(t2, pids[i]); end if;
    else
      if mod(i, 2) = 1 then t2 := array_append(t2, pids[i]);
      else t1 := array_append(t1, pids[i]); end if;
    end if;
  end loop;

  mid := gen_random_uuid();
  tid1 := gen_random_uuid();
  tid2 := gen_random_uuid();
  shortid := substr(replace(mid::text, '-', ''), 1, 6);

  insert into public.teams(id, name, tag, members, kind)
  values (tid1, 'MM-'||shortid||'-A', 'MMA', t1, 'mix'),
         (tid2, 'MM-'||shortid||'-B', 'MMB', t2, 'mix');

  insert into public.matches(
    id, kind, team1, team2, status, starts_at, best_of, server_id, server_ip,
    lineup1, lineup2, matchmaking_mode
  )
  values (
    mid, 'mix', tid1, tid2, 'upcoming', now(), 1, srv.id, srv.connect_address,
    t1, t2, chosen_mode
  );

  update public.matchmaking_queue
  set status = 'matched', match_id = mid, matched_at = now()
  where id = any(qids);
  update public.game_servers set last_assigned_at = now() where id = srv.id;
  return true;
end;
$$;

--
-- Name: matchmaking_dispatch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matchmaking_dispatch (
    match_id uuid NOT NULL,
    server_id uuid NOT NULL,
    server_password text NOT NULL,
    dispatch_state text DEFAULT 'assigned'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    CONSTRAINT matchmaking_dispatch_dispatch_state_check CHECK ((dispatch_state = ANY (ARRAY['assigned'::text, 'live'::text, 'finished'::text, 'failed'::text])))
);

--
-- Name: matchmaking_modes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matchmaking_modes (
    mode text NOT NULL,
    players_per_team integer NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT matchmaking_modes_mode_check CHECK ((mode = ANY (ARRAY['1v1'::text, '2v2'::text, '3v3'::text, '5v5'::text]))),
    CONSTRAINT matchmaking_modes_players_per_team_check CHECK ((players_per_team = ANY (ARRAY[1, 2, 3, 5])))
);

--
-- Name: matchmaking_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matchmaking_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    player_id uuid NOT NULL,
    steam_id text NOT NULL,
    elo integer DEFAULT 1000 NOT NULL,
    status text DEFAULT 'waiting'::text NOT NULL,
    match_id uuid,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    matched_at timestamp with time zone,
    mode text DEFAULT '5v5'::text NOT NULL,
    CONSTRAINT matchmaking_queue_elo_check CHECK ((elo >= 0)),
    CONSTRAINT matchmaking_queue_mode_check CHECK ((mode = ANY (ARRAY['1v1'::text, '2v2'::text, '3v3'::text, '5v5'::text]))),
    CONSTRAINT matchmaking_queue_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'matched'::text, 'cancelled'::text])))
);

--
-- Name: matchmaking_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matchmaking_settings (
    id boolean DEFAULT true NOT NULL,
    queue_open boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT matchmaking_settings_id_check CHECK (id)
);

--
-- Name: matchmaking_dispatch matchmaking_dispatch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_dispatch
    ADD CONSTRAINT matchmaking_dispatch_pkey PRIMARY KEY (match_id);

--
-- Name: matchmaking_modes matchmaking_modes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_modes
    ADD CONSTRAINT matchmaking_modes_pkey PRIMARY KEY (mode);

--
-- Name: matchmaking_queue matchmaking_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_queue
    ADD CONSTRAINT matchmaking_queue_pkey PRIMARY KEY (id);

--
-- Name: matchmaking_settings matchmaking_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_settings
    ADD CONSTRAINT matchmaking_settings_pkey PRIMARY KEY (id);

--
-- Name: matchmaking_queue_match_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchmaking_queue_match_id_idx ON public.matchmaking_queue USING btree (match_id);

--
-- Name: matchmaking_queue_one_waiting_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX matchmaking_queue_one_waiting_per_user ON public.matchmaking_queue USING btree (user_id) WHERE (status = 'waiting'::text);

--
-- Name: matchmaking_queue_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchmaking_queue_user_idx ON public.matchmaking_queue USING btree (user_id, joined_at DESC);

--
-- Name: matchmaking_queue_waiting_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchmaking_queue_waiting_idx ON public.matchmaking_queue USING btree (joined_at) WHERE (status = 'waiting'::text);

--
-- Name: matchmaking_queue_waiting_mode_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX matchmaking_queue_waiting_mode_idx ON public.matchmaking_queue USING btree (mode, joined_at) WHERE (status = 'waiting'::text);

--
-- Name: matchmaking_dispatch matchmaking_dispatch_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_dispatch
    ADD CONSTRAINT matchmaking_dispatch_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

--
-- Name: matchmaking_dispatch matchmaking_dispatch_server_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_dispatch
    ADD CONSTRAINT matchmaking_dispatch_server_id_fkey FOREIGN KEY (server_id) REFERENCES public.game_servers(id) ON DELETE CASCADE;

--
-- Name: matchmaking_modes matchmaking_modes_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_modes
    ADD CONSTRAINT matchmaking_modes_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);

--
-- Name: matchmaking_queue matchmaking_queue_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_queue
    ADD CONSTRAINT matchmaking_queue_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE SET NULL;

--
-- Name: matchmaking_queue matchmaking_queue_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_queue
    ADD CONSTRAINT matchmaking_queue_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

--
-- Name: matchmaking_queue matchmaking_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_queue
    ADD CONSTRAINT matchmaking_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: matchmaking_settings matchmaking_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchmaking_settings
    ADD CONSTRAINT matchmaking_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);

--
-- Name: matchmaking_queue matchmaking: ver solo la propia cola; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "matchmaking: ver solo la propia cola" ON public.matchmaking_queue FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

--
-- Name: matchmaking_dispatch; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matchmaking_dispatch ENABLE ROW LEVEL SECURITY;

--
-- Name: matchmaking_modes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matchmaking_modes ENABLE ROW LEVEL SECURITY;

--
-- Name: matchmaking_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: matchmaking_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matchmaking_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: matchmaking_settings matchmaking_settings_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY matchmaking_settings_public_read ON public.matchmaking_settings FOR SELECT TO authenticated, anon USING (true);

--
-- Name: FUNCTION matchmaking_admin_release_server(p_match_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_admin_release_server(p_match_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_admin_release_server(p_match_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_admin_release_server(p_match_id uuid) TO service_role;

--
-- Name: FUNCTION matchmaking_cancel(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_cancel() FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_cancel() TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_cancel() TO service_role;

--
-- Name: FUNCTION matchmaking_join(p_mode text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_join(p_mode text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_join(p_mode text) TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_join(p_mode text) TO service_role;

--
-- Name: FUNCTION matchmaking_queue_state(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_queue_state() FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_queue_state() TO anon;
GRANT ALL ON FUNCTION public.matchmaking_queue_state() TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_queue_state() TO service_role;

--
-- Name: FUNCTION matchmaking_server_mark_live(p_token text, p_match_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_server_mark_live(p_token text, p_match_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_server_mark_live(p_token text, p_match_id uuid) TO anon;
GRANT ALL ON FUNCTION public.matchmaking_server_mark_live(p_token text, p_match_id uuid) TO service_role;

--
-- Name: FUNCTION matchmaking_server_poll(p_token text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_server_poll(p_token text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_server_poll(p_token text) TO anon;
GRANT ALL ON FUNCTION public.matchmaking_server_poll(p_token text) TO service_role;

--
-- Name: FUNCTION matchmaking_set_mode(p_mode text, p_enabled boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_set_mode(p_mode text, p_enabled boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_set_mode(p_mode text, p_enabled boolean) TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_set_mode(p_mode text, p_enabled boolean) TO service_role;

--
-- Name: FUNCTION matchmaking_set_queue_open(p_open boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_set_queue_open(p_open boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_set_queue_open(p_open boolean) TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_set_queue_open(p_open boolean) TO service_role;

--
-- Name: FUNCTION matchmaking_status(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_status() FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_status() TO authenticated;
GRANT ALL ON FUNCTION public.matchmaking_status() TO service_role;

--
-- Name: FUNCTION matchmaking_try_match(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_try_match() FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_try_match() TO service_role;

--
-- Name: FUNCTION matchmaking_try_match_unchecked(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.matchmaking_try_match_unchecked() FROM PUBLIC;
GRANT ALL ON FUNCTION public.matchmaking_try_match_unchecked() TO service_role;

--
-- Name: TABLE matchmaking_dispatch; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matchmaking_dispatch TO service_role;

--
-- Name: TABLE matchmaking_modes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matchmaking_modes TO service_role;

--
-- Name: TABLE matchmaking_queue; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matchmaking_queue TO anon;
GRANT ALL ON TABLE public.matchmaking_queue TO authenticated;
GRANT ALL ON TABLE public.matchmaking_queue TO service_role;

--
-- Name: TABLE matchmaking_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matchmaking_settings TO service_role;

--
-- Name: COLUMN matchmaking_settings.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.matchmaking_settings TO anon;
GRANT SELECT(id) ON TABLE public.matchmaking_settings TO authenticated;

--
-- Name: COLUMN matchmaking_settings.queue_open; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(queue_open) ON TABLE public.matchmaking_settings TO anon;
GRANT SELECT(queue_open) ON TABLE public.matchmaking_settings TO authenticated;

--
-- Name: COLUMN matchmaking_settings.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(updated_at) ON TABLE public.matchmaking_settings TO anon;
GRANT SELECT(updated_at) ON TABLE public.matchmaking_settings TO authenticated;

commit;
