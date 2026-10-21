-- Replanteo 23: !whois con varios SteamID por ficha (planes docs/bitacora/2026-10-19-plugin-whois y 2026-10-20-whois-menu).
--   - csstv_whois nació en producción con un SteamID por ficha (supabase/migrations/20261019180000_whois.sql y
--     20261020120000_whois_menu.sql, que le suma p_online y la lista de candidatos para el menú del plugin 2.3.1).
--   - Acá los nicks y las partidas son de todos los SteamID de la ficha (player_steam_all), suma steam_count, y los
--     candidatos se agrupan por ficha: la clave es el principal, online es cualquier SteamID conectado de la ficha.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.csstv_whois(text, text, text, text)') is null then
    raise exception 'replanteo 23: falta csstv_whois con p_online (aplicar antes supabase/migrations/20261020120000_whois_menu.sql)';
  end if;
  if to_regclass('public.player_steam_all') is null then
    raise exception 'replanteo 23: falta player_steam_all (aplicar antes 15_claim.sql)';
  end if;
  if obj_description('public.csstv_whois(text, text, text, text)'::regprocedure, 'pg_proc') like '%(replanteo 23)%' then
    raise exception 'replanteo 23: csstv_whois ya tiene varios SteamID (¿ya se aplicó?)';
  end if;
end $$;

-- Todos los SteamID de la ficha de un SteamID, o solo ese si no tiene ficha.
create function public.steam_group(p_s64 text) returns text[]
  language sql stable security definer set search_path = public as $$
  select coalesce((select array_agg(a.steam_id order by a.steam_id) from player_steam_all a where a.player_id = steam_owner(p_s64)),
                  array[p_s64]) $$;
revoke all on function public.steam_group(text) from public, anon, authenticated;

create or replace function public.csstv_whois(p_token text, p_steam text default null, p_query text default null, p_online text default null)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  s64 text; q text; pat text; n int; v_list text; v_online text[];
  v_owner uuid; v_steams text[];
  v_matches int; v_last timestamptz; v_nick_count int; v_nicks text;
  r record;
begin
  perform csstv_auth(p_token);

  if nullif(trim(coalesce(p_steam, '')), '') is not null then
    s64 := csstv_steam64(p_steam);
    if s64 is null then return jsonb_build_object('ok', false, 'message', 'SteamID inválido'); end if;
  else
    q := trim(coalesce(p_query, ''));
    if char_length(q) < 2 or char_length(q) > 32 then
      return jsonb_build_object('ok', false, 'message', 'Escribí entre 2 y 32 caracteres del nombre');
    end if;
    pat := '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    select coalesce(array_agg(distinct t.x), '{}') into v_online
      from (select csstv_steam64(trim(u)) as x from unnest(string_to_array(coalesce(p_online, ''), ',')) u) t
     where t.x is not null;

    -- Candidatos (como en producción), agrupados por ficha: la clave es su principal. (replanteo 23)
    with c as (
      select s.steam_id, coalesce(m.played_at, m.starts_at, s.created_at) as last
        from match_player_stats s left join matches m on m.id = s.match_id
       where s.nick ilike pat and is_steam64(s.steam_id)
      union all
      select pl.steam_id, null
        from players pl left join profiles pr on pr.id = pl.user_id
       where pl.steam_id is not null and (pl.nick ilike pat or pr.tag ilike pat)
      union all
      select o, null from unnest(v_online) o
    ), g as (
      select coalesce(pl.steam_id, c.steam_id) as steam_id, max(c.last) as last,
             min(c.steam_id) filter (where c.steam_id = any(v_online)) as online
        from c
        left join player_steam_all a on a.steam_id = c.steam_id
        left join players pl on pl.id = a.player_id
       group by coalesce(pl.steam_id, c.steam_id)
    ), k as (
      select g.*, steam_group(g.steam_id) as steams, count(*) over () as n,
             row_number() over (order by g.online is not null desc, g.last desc nulls last, g.steam_id) as pos
        from g
    )
    select max(k.n)::int, min(k.steam_id),
           string_agg(concat_ws('|',
             csstv_steam0(k.steam_id),
             coalesce(csstv_steam0(k.online), ''),
             translate(coalesce(
               (select s.nick from match_player_stats s left join matches m on m.id = s.match_id
                 where s.steam_id = any(k.steams) and nullif(trim(s.nick), '') is not null
                 order by coalesce(m.played_at, m.starts_at, s.created_at) desc limit 1),
               (select pl.nick from players pl where pl.id = steam_owner(k.steam_id)), ''), '|;', '/,'),
             (select count(distinct s.match_id) from match_player_stats s where s.steam_id = any(k.steams)),
             case when steam_owner(k.steam_id) is not null then 1 else 0 end),
             ';' order by k.pos)
      into n, s64, v_list
      from k where k.pos <= 15;
    n := coalesce(n, 0);
    if n = 0 then
      return jsonb_build_object('ok', false, 'message', format('Nadie jugó con un nombre parecido a "%s"', q));
    end if;
    if n > 1 then
      return jsonb_build_object('ok', true, 'multiple', true, 'total', n, 'candidates', v_list);
    end if;
  end if;

  -- (replanteo 23) todos los SteamID de la ficha, o solo ese si no tiene ficha
  v_owner := steam_owner(s64);
  v_steams := steam_group(s64);

  select count(distinct s.match_id)::int, max(coalesce(m.played_at, m.starts_at, s.created_at))
    into v_matches, v_last
    from match_player_stats s left join matches m on m.id = s.match_id
   where s.steam_id = any(v_steams);
  -- Los 6 nicks usados más recientemente (y cuántos distintos usó en total).
  select count(*)::int, string_agg(x.nick, ', ' order by x.last desc, x.nick) filter (where x.rn <= 6)
    into v_nick_count, v_nicks
    from (select s.nick, max(coalesce(m.played_at, m.starts_at, s.created_at)) as last,
                 row_number() over (order by max(coalesce(m.played_at, m.starts_at, s.created_at)) desc, s.nick) as rn
            from match_player_stats s left join matches m on m.id = s.match_id
           where s.steam_id = any(v_steams) and nullif(trim(s.nick), '') is not null
           group by s.nick) x;
  select pl.id, pl.nick, pr.tag into r
    from players pl left join profiles pr on pr.id = pl.user_id
   where pl.id = v_owner;

  return jsonb_build_object(
    'ok', true, 'multiple', false, 'steam_id', csstv_steam0(s64), 'steam_count', cardinality(v_steams),
    'nicks', coalesce(v_nicks, ''), 'nick_count', v_nick_count, 'matches', v_matches,
    'last_played', to_char(v_last at time zone 'America/Bogota', 'YYYY-MM-DD'),
    'player_id', r.id, 'player_nick', r.nick, 'alias', r.tag);
end $$;
comment on function public.csstv_whois(text, text, text, text) is '!whois del plugin: nicks de las partidas y perfil de la web, con todos los SteamID de la ficha; con varios candidatos, la lista para el menú (replanteo 23)';

commit;
