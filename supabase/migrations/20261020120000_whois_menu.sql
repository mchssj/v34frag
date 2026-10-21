-- =============================================================================
-- !whois con menú: una sola lista de candidatos con los conectados y la base
--
-- - csstv_whois suma p_online: los SteamID de los conectados cuyo nombre coincide (los manda
--   el plugin 2.3.1, separados por coma). Cuentan como candidatos aunque nunca hayan jugado.
-- - Los candidatos son personas: un conectado que también aparece por un nick viejo sale una vez.
-- - Con varios candidatos, candidates trae hasta 15 separados por ";", cada uno
--   "steam|online|nick|partidas|ficha" (el plugin arma el menú). Conectados primero, después
--   por la última partida.
-- - Compatible con el plugin 2.3.0: p_online es opcional.
-- - Un SteamID por ficha (esquema de producción). El replanteo 23 la redefine por ficha.
--
-- Bitácora: docs/bitacora/2026-10-20-whois-menu/
-- Necesita: 20261019180000_whois.sql (csstv_steam0).
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable.
-- =============================================================================

begin;

drop function if exists public.csstv_whois(text, text, text);

create or replace function public.csstv_whois(p_token text, p_steam text default null, p_query text default null, p_online text default null)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  s64 text; q text; pat text; n int; v_list text; v_online text[];
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

    -- Candidatos: SteamID que usaron un nick parecido en una partida, cuya ficha o cuenta se llama así,
    -- o que están conectados con un nombre parecido. Hasta 15, conectados primero.
    with c as (
      select s.steam_id, coalesce(m.played_at, m.starts_at, s.created_at) as last
        from match_player_stats s left join matches m on m.id = s.match_id
       where s.nick ilike pat and s.steam_id ~ '^(7656119[0-9]{10}|765612[0-9]{11})$'
      union all
      select pl.steam_id, null
        from players pl left join profiles pr on pr.id = pl.user_id
       where pl.steam_id is not null and (pl.nick ilike pat or pr.tag ilike pat)
      union all
      select o, null from unnest(v_online) o
    ), g as (
      select c.steam_id, max(c.last) as last, bool_or(c.steam_id = any(v_online)) as online
        from c group by c.steam_id
    ), k as (
      select g.*, count(*) over () as n,
             row_number() over (order by g.online desc, g.last desc nulls last, g.steam_id) as pos
        from g
    )
    select max(k.n)::int, min(k.steam_id),
           string_agg(concat_ws('|',
             csstv_steam0(k.steam_id),
             case when k.online then csstv_steam0(k.steam_id) else '' end,
             translate(coalesce(
               (select s.nick from match_player_stats s left join matches m on m.id = s.match_id
                 where s.steam_id = k.steam_id and nullif(trim(s.nick), '') is not null
                 order by coalesce(m.played_at, m.starts_at, s.created_at) desc limit 1),
               (select pl.nick from players pl where pl.steam_id = k.steam_id limit 1), ''), '|;', '/,'),
             (select count(distinct s.match_id) from match_player_stats s where s.steam_id = k.steam_id),
             case when exists (select 1 from players pl where pl.steam_id = k.steam_id) then 1 else 0 end),
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
    -- Un solo candidato: s64 ya es su SteamID.
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
comment on function public.csstv_whois(text, text, text, text) is '!whois del plugin: nicks de las partidas y perfil de la web; con varios candidatos, la lista para el menú (un SteamID por ficha)';
revoke all on function public.csstv_whois(text, text, text, text) from public;
grant execute on function public.csstv_whois(text, text, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;
