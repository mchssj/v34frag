-- =============================================================================
-- !whois: nicks que usó un jugador en las partidas y su perfil en la web
--
-- - csstv_whois(p_token, p_steam, p_query): la llama el plugin (2.3.0) con el token del
--   servidor, como claim_with_code. Por SteamID (STEAM_0:X:Y o SteamID64) o por texto: un nick
--   de las partidas, el nick de la ficha o el alias de la cuenta.
-- - Los nicks salen solo de las partidas (match_player_stats.nick), también de las canceladas
--   que guardaron stats. Las fichas privadas se muestran igual (lo usan admins y moderadores;
--   el permiso lo controla el plugin).
-- - Respuesta plana (sin listas): el plugin la lee con el mismo lector que la de !claim.
-- - Escrita contra el esquema de producción (un SteamID por ficha: players.steam_id). El
--   replanteo 23 la redefine con todos los SteamID de la ficha.
--
-- Bitácora: docs/bitacora/2026-10-19-plugin-whois/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable.
-- =============================================================================

begin;

-- SteamID64 → STEAM_0:X:Y (lo que ve el admin en el juego). null si no es un SteamID64.
create or replace function public.csstv_steam0(p_s64 text) returns text
  language sql immutable set search_path = public as $$
  select case when p_s64 ~ '^(7656119[0-9]{10}|765612[0-9]{11})$' then
    'STEAM_0:' || ((p_s64::bigint - 76561197960265728) % 2) || ':' || ((p_s64::bigint - 76561197960265728) / 2) end $$;

create or replace function public.csstv_whois(p_token text, p_steam text default null, p_query text default null) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  s64 text; q text; pat text; n int; cands text[]; v_list text;
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
    select count(*)::int, array_agg(g.steam_id order by g.last desc nulls last, g.steam_id) into n, cands
      from (select c.steam_id, max(c.last) as last
              from (select s.steam_id, coalesce(m.played_at, m.starts_at, s.created_at) as last
                      from match_player_stats s left join matches m on m.id = s.match_id
                     where s.nick ilike pat and s.steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$'
                    union all
                    select pl.steam_id, null
                      from players pl left join profiles pr on pr.id = pl.user_id
                     where pl.steam_id is not null and (pl.nick ilike pat or pr.tag ilike pat)) c
             group by c.steam_id) g;
    if n = 0 then
      return jsonb_build_object('ok', false, 'message', format('Nadie jugó con un nombre parecido a "%s"', q));
    end if;
    if n > 1 then
      select string_agg(coalesce(
               (select s.nick from match_player_stats s left join matches m on m.id = s.match_id
                 where s.steam_id = x.steam_id and nullif(trim(s.nick), '') is not null
                 order by coalesce(m.played_at, m.starts_at, s.created_at) desc limit 1),
               (select pl.nick from players pl where pl.steam_id = x.steam_id limit 1), '?')
             || ' (' || csstv_steam0(x.steam_id) || ')', ', ' order by x.pos)
        into v_list
        from unnest(cands[1:5]) with ordinality as x(steam_id, pos);
      return jsonb_build_object('ok', true, 'multiple', true, 'total', n, 'candidates', v_list);
    end if;
    s64 := cands[1];
  end if;

  select count(distinct s.match_id)::int, max(coalesce(m.played_at, m.starts_at, s.created_at))
    into v_matches, v_last
    from match_player_stats s left join matches m on m.id = s.match_id
   where s.steam_id = s64;
  -- Los 6 nicks usados más recientemente (y cuántos distintos usó en total).
  select count(*)::int, string_agg(x.nick, ', ' order by x.last desc, x.nick) filter (where x.rn <= 6)
    into v_nick_count, v_nicks
    from (select s.nick, max(coalesce(m.played_at, m.starts_at, s.created_at)) as last,
                 row_number() over (order by max(coalesce(m.played_at, m.starts_at, s.created_at)) desc, s.nick) as rn
            from match_player_stats s left join matches m on m.id = s.match_id
           where s.steam_id = s64 and nullif(trim(s.nick), '') is not null
           group by s.nick) x;
  select pl.id, pl.nick, pr.tag into r
    from players pl left join profiles pr on pr.id = pl.user_id
   where pl.steam_id = s64 limit 1;

  return jsonb_build_object(
    'ok', true, 'multiple', false, 'steam_id', csstv_steam0(s64),
    'nicks', coalesce(v_nicks, ''), 'nick_count', v_nick_count, 'matches', v_matches,
    'last_played', to_char(v_last at time zone 'America/Bogota', 'YYYY-MM-DD'),
    'player_id', r.id, 'player_nick', r.nick, 'alias', r.tag);
end $$;
comment on function public.csstv_whois(text, text, text) is '!whois del plugin: nicks de las partidas y perfil de la web de un SteamID (un SteamID por ficha)';
revoke all on function public.csstv_whois(text, text, text) from public;
grant execute on function public.csstv_whois(text, text, text) to anon, authenticated, service_role;

commit;
