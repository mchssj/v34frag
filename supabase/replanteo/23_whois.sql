-- Replanteo 23: !whois con varios SteamID por ficha (plan docs/bitacora/2026-10-19-plugin-whois).
--   - csstv_whois nació en producción (supabase/migrations/20261019180000_whois.sql) con un SteamID por ficha.
--     Acá los nicks y las partidas son de todos los SteamID de la ficha (player_steam_all), suma steam_count,
--     y en la búsqueda por texto los SteamID de una misma ficha cuentan como un solo candidato.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regprocedure('public.csstv_whois(text, text, text)') is null then
    raise exception 'replanteo 23: falta csstv_whois (aplicar antes supabase/migrations/20261019180000_whois.sql)';
  end if;
  if to_regclass('public.player_steam_all') is null then
    raise exception 'replanteo 23: falta player_steam_all (aplicar antes 15_claim.sql)';
  end if;
  if obj_description('public.csstv_whois(text, text, text)'::regprocedure, 'pg_proc') like '%(replanteo 23)%' then
    raise exception 'replanteo 23: csstv_whois ya tiene varios SteamID (¿ya se aplicó?)';
  end if;
end $$;

create or replace function public.csstv_whois(p_token text, p_steam text default null, p_query text default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  s64 text; q text; pat text; n int; cands text[]; v_list text;
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
    -- Candidatos: SteamID que usaron un nick parecido en una partida, o cuya ficha o cuenta se llama así.
    -- Los de una misma ficha se juntan en su principal.
    select count(*)::int, array_agg(g.steam_id order by g.last desc nulls last, g.steam_id) into n, cands
      from (select coalesce(pl.steam_id, c.steam_id) as steam_id, max(c.last) as last
              from (select s.steam_id, coalesce(m.played_at, m.starts_at, s.created_at) as last
                      from match_player_stats s left join matches m on m.id = s.match_id
                     where s.nick ilike pat and is_steam64(s.steam_id)
                    union all
                    select pl.steam_id, null
                      from players pl left join profiles pr on pr.id = pl.user_id
                     where pl.steam_id is not null and (pl.nick ilike pat or pr.tag ilike pat)) c
              left join player_steam_all a on a.steam_id = c.steam_id
              left join players pl on pl.id = a.player_id
             group by coalesce(pl.steam_id, c.steam_id)) g;
    if n = 0 then
      return jsonb_build_object('ok', false, 'message', format('Nadie jugó con un nombre parecido a "%s"', q));
    end if;
    if n > 1 then
      select string_agg(coalesce(
               (select s.nick from match_player_stats s left join matches m on m.id = s.match_id
                 where s.steam_id in (select a.steam_id from player_steam_all a where a.player_id = steam_owner(x.steam_id)
                                      union select x.steam_id)
                   and nullif(trim(s.nick), '') is not null
                 order by coalesce(m.played_at, m.starts_at, s.created_at) desc limit 1),
               (select pl.nick from players pl where pl.id = steam_owner(x.steam_id)), '?')
             || ' (' || csstv_steam0(x.steam_id) || ')', ', ' order by x.pos)
        into v_list
        from unnest(cands[1:5]) with ordinality as x(steam_id, pos);
      return jsonb_build_object('ok', true, 'multiple', true, 'total', n, 'candidates', v_list);
    end if;
    s64 := cands[1];
  end if;

  -- (replanteo 23) todos los SteamID de la ficha, o solo ese si no tiene ficha
  v_owner := steam_owner(s64);
  if v_owner is not null then
    select array_agg(a.steam_id) into v_steams from player_steam_all a where a.player_id = v_owner;
  else
    v_steams := array[s64];
  end if;

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
comment on function public.csstv_whois(text, text, text) is '!whois del plugin: nicks de las partidas y perfil de la web, con todos los SteamID de la ficha (replanteo 23)';

commit;
