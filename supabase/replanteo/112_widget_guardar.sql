-- 112: guardar el widget para streamers en la cuenta (bitácora docs/bitacora/2026-11-11-widget-guardar/, Daniel 2026-11-11).
--
-- widget_settings guarda, por ficha, las opciones del widget con el formato de la URL sin el id
-- ("d=stats&v=historico&h=photo"). La web las vuelve a validar al leerlas (parseOptions), así que acá solo se limita
-- el largo y los caracteres. Se lee sin sesión (es lo que se ve en el stream) y solo se escribe con widget_save(), que
-- usa la ficha de auth.uid().
-- widget_player (110 y 111) devuelve además 'settings' y, si se la llama con p_period null, usa el período guardado
-- (v=hoy|24h|temporada|historico; sin nada, today). La firma no cambia.
-- Inversa en docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/112_widget_guardar.sql.

begin;

do $$
begin
  if to_regclass('public.widget_settings') is not null then
    raise exception 'replanteo 112: widget_settings ya existe (¿ya se aplicó?)';
  end if;
  if to_regprocedure('public.widget_player(uuid,text,timestamptz)') is null then
    raise exception 'replanteo 112: falta widget_player (replanteos 110 y 111)';
  end if;
end $$;

create table public.widget_settings (
  player_id  uuid primary key references public.players (id) on delete cascade,
  query      text not null check (length(query) <= 600 and query ~ '^[A-Za-z0-9=&,_%.+-]*$'),
  updated_at timestamptz not null default now()
);

comment on table public.widget_settings is
  'Configuración guardada del widget para streamers, con el formato de la URL sin el id. Pública (se ve en el stream); se escribe con widget_save(). Replanteo 112';

alter table public.widget_settings enable row level security;
create policy widget_settings_leer on public.widget_settings for select using (true);
revoke all on public.widget_settings from anon, authenticated;
grant select on public.widget_settings to anon, authenticated;

create function public.widget_save(p_query text)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v_player uuid;
  r        widget_settings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Tienes que iniciar sesión';
  end if;
  select id into v_player from players where user_id = auth.uid();
  if v_player is null then
    raise exception 'Para guardar tu widget necesitas tu ficha de jugador vinculada';
  end if;
  if p_query is null or length(p_query) > 600 or p_query !~ '^[A-Za-z0-9=&,_%.+-]*$' then
    raise exception 'La configuración del widget no es válida';
  end if;
  insert into widget_settings (player_id, query, updated_at) values (v_player, p_query, now())
  on conflict (player_id) do update set query = excluded.query, updated_at = excluded.updated_at
  returning * into r;
  return jsonb_build_object('query', r.query, 'updated_at', r.updated_at);
end $$;

comment on function public.widget_save(text) is
  'Guarda la configuración del widget de la ficha del usuario (upsert). Error si no tiene ficha o el texto no es válido. Replanteo 112';

revoke all on function public.widget_save(text) from public, anon;
grant execute on function public.widget_save(text) to authenticated, service_role;

create or replace function public.widget_player(p_player uuid, p_period text default 'today', p_since timestamptz default null)
returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  o       player_overview%rowtype;
  v_from  timestamptz;
  v_rank  integer;
  v_crank integer;
  v_cty   text;
  v_per   jsonb;
  v_last  jsonb;
  v_query text;
  v_per_k text := p_period;
begin
  if p_period is not null and p_period not in ('today', '24h', 'season', 'all') then
    raise exception 'widget_player: período inválido (%)', p_period using errcode = '22023';
  end if;

  select * into o from player_overview where id = p_player;
  if not found then
    return null;
  end if;

  -- Lo que guardó el dueño (replanteo 112). Sin período en la llamada, se usa el `v=` guardado; si no hay, hoy.
  select s.query into v_query from widget_settings s where s.player_id = p_player;
  if v_per_k is null then
    v_per_k := case substring(coalesce(v_query, '') from '(?:^|&)v=([^&]*)')
      when '24h' then '24h' when 'temporada' then 'season' when 'historico' then 'all' else 'today' end;
  end if;

  v_from := case v_per_k
    when 'today'  then coalesce(p_since, now() - interval '24 hours')
    when '24h'    then now() - interval '24 hours'
    when 'season' then (select starts_at from seasons where status = 'active' order by starts_at desc limit 1)
    else null
  end;

  select r.position, r.country into v_rank, v_cty
    from player_ranking r where r.id = p_player;
  if v_cty is null then
    select d.country into v_cty
      from players p join profile_details d on d.user_id = p.user_id
     where p.id = p_player;
  end if;
  if v_cty is not null and v_rank is not null then
    select x.pos into v_crank
      from (select r.id, rank() over (order by r.elo desc)::integer as pos
              from player_ranking r where r.country = v_cty) x
     where x.id = p_player;
  end if;

  with mixes as (
    select s.team, s.kills, s.deaths, s.rounds, s.damage, s.headshots, s.k1, s.k2, s.k3, s.k4, s.k5, s.first_kills,
           s.elo_delta, m.winner_side, x.pistol_won, x.weapon_kills,
           coalesce(x.clutch_1v1, 0) + coalesce(x.clutch_1v2, 0) + coalesce(x.clutch_1v3, 0)
             + coalesce(x.clutch_1v4, 0) + coalesce(x.clutch_1v5, 0) as clutches
      from match_player_stats s
      join matches m on m.id = s.match_id
      left join match_player_extra x on x.match_id = s.match_id and x.steam_id = s.steam_id
     where s.player_id = p_player and s.team in (1, 2)
       and m.kind = 'mix' and m.status = 'finished'
       and (v_from is null or coalesce(m.played_at, m.starts_at) >= v_from)
  )
  select jsonb_build_object(
           'v', count(*) filter (where winner_side = team),
           'd', count(*) filter (where winner_side is not null and winner_side <> team),
           'e', count(*) filter (where winner_side is null),
           'elo', coalesce(sum(elo_delta), 0),
           'kills', coalesce(sum(kills), 0),
           'deaths', coalesce(sum(deaths), 0),
           'rounds', coalesce(sum(rounds), 0),
           'damage', coalesce(sum(damage), 0),
           'headshots', coalesce(sum(headshots), 0),
           'k3', coalesce(sum(k3), 0),
           'k4', coalesce(sum(k4), 0),
           'k5', coalesce(sum(k5), 0),
           'sniper', coalesce(sum(coalesce((weapon_kills->>'awp')::int, 0) + coalesce((weapon_kills->>'scout')::int, 0)), 0),
           'knife', coalesce(sum(coalesce((weapon_kills->>'knife')::int, 0)), 0),
           'clutches', coalesce(sum(clutches), 0),
           'entries', coalesce(sum(first_kills), 0),
           'pistols', coalesce(sum(pistol_won), 0),
           'rating', case when coalesce(sum(rounds), 0) > 0 then
                       round(csstv_rating(sum(kills)::numeric, sum(deaths)::numeric, sum(rounds)::numeric, sum(k1)::numeric,
                                          sum(k2)::numeric, sum(k3)::numeric, sum(k4)::numeric, sum(k5)::numeric), 2) end)
    into v_per
    from mixes;

  select coalesce(jsonb_agg(jsonb_build_object('r', l.r, 'elo', l.elo_delta) order by l.at desc nulls last, l.match_id desc), '[]')
    into v_last
    from (select case when m.winner_side is null then 'E' when m.winner_side = s.team then 'V' else 'D' end as r,
                 s.elo_delta, coalesce(m.played_at, m.starts_at) as at, s.match_id
            from match_player_stats s
            join matches m on m.id = s.match_id
           where s.player_id = p_player and s.team in (1, 2)
             and m.kind = 'mix' and m.status = 'finished'
           order by coalesce(m.played_at, m.starts_at) desc nulls last, s.match_id desc
           limit 10) l;

  return jsonb_build_object(
    'id', o.id,
    'nick', o.nick,
    'team_tag', (select nullif(btrim(t->>'tag'), '') from jsonb_array_elements(o.teams) t limit 1),
    'country', v_cty,
    'photo_url', o.photo_url,
    'elo', coalesce(o.elo, (select start_elo from elo_config limit 1)),
    'peak_elo', coalesce(o.peak_elo, o.elo, (select start_elo from elo_config limit 1)),
    'matches', o.elo_matches,
    'rank', v_rank,
    'country_rank', v_crank,
    'period', v_per,
    'ultimos', v_last,
    'settings', v_query
  );
end $$;

comment on function public.widget_player(uuid, text, timestamptz) is
  'Datos del widget para streamers (OBS): foto, ELO, puestos, equipo, configuración guardada, stats del período (today, 24h, season, all) y últimos 10 resultados. null si la ficha no existe. Replanteos 110, 111 y 112';

revoke all on function public.widget_player(uuid, text, timestamptz) from public;
grant execute on function public.widget_player(uuid, text, timestamptz) to anon, authenticated, service_role;

commit;
