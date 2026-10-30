-- Carga inicial de los VIP de Kyan (2026-10-28), todos lifetime. Se buscan por el nick de la ficha, como los links de
-- la web vieja (#jugador/<nick>): instt (uriel), sandeerz, romanxz (romanzera) y shoxmeister (cypee-thor).
-- instt y sandeerz todavía no tienen cuenta (2026-10-28): se cargan después, cuando la creen y vinculen su SteamID,
-- corriendo este mismo archivo con sus nicks en las dos listas (la del paso 1 y v_nicks).
-- El VIP es de la cuenta: se da a la cuenta vinculada a cada ficha (players.user_id).
-- Correr en Supabase > SQL Editor, en producción. Se puede correr entero: el paso 1 solo lee y el paso 2 no carga
-- nada si algo no cuadra.

-- =====================================================================================================
-- Paso 1 (solo lectura): cada nick, su ficha y su cuenta. Todas las filas tienen que tener user_id.
-- =====================================================================================================
select n.nick as buscado, p.id as player_id, p.nick as ficha, p.user_id, pr.tag as alias, public.is_vip(p.user_id) as ya_es_vip
  from unnest(array['romanxz', 'shoxmeister']) n(nick)
  left join players p on lower(p.nick) = lower(n.nick)
  left join profiles pr on pr.id = p.user_id
 order by n.nick;

-- =====================================================================================================
-- Paso 2: darles VIP lifetime. Aborta sin cargar a nadie si un nick no existe, si hay dos fichas con el mismo nick,
-- si la ficha no tiene cuenta, si dos nicks son la misma cuenta o si alguno ya es VIP.
-- =====================================================================================================
begin;

do $$
declare
  v_nicks text[] := array['romanxz', 'shoxmeister'];  -- después: array['instt', 'sandeerz']
  v_nick text;
  v_players uuid[];
  v_user uuid;
  v_done uuid[] := '{}';
begin
  foreach v_nick in array v_nicks loop
    select array_agg(id) into v_players from players where lower(nick) = lower(v_nick);
    if v_players is null then raise exception 'No hay ninguna ficha con el nick %', v_nick; end if;
    if cardinality(v_players) > 1 then raise exception 'Hay % fichas con el nick %', cardinality(v_players), v_nick; end if;
    select user_id into v_user from players where id = v_players[1];
    -- Fichas que perdieron players.user_id con el panel viejo (bitácora 2026-10-25-vinculos-perdidos): la cuenta todavía
    -- apunta a la ficha en profiles.player_id (columna que el replanteo 01 borra en el corte).
    if v_user is null and exists (select 1 from information_schema.columns
                                   where table_schema = 'public' and table_name = 'profiles' and column_name = 'player_id') then
      execute 'select id from profiles where player_id = $1 limit 1' into v_user using v_players[1];
      if v_user is not null then raise notice '% no tenía players.user_id: se usa la cuenta de profiles.player_id', v_nick; end if;
    end if;
    if v_user is null then
      raise exception 'La ficha % no tiene cuenta: tiene que crearse una en la web y vincular su SteamID', v_nick;
    end if;
    if v_user = any(v_done) then raise exception 'La cuenta de % ya está en la lista con otro nick', v_nick; end if;
    if is_vip(v_user) then raise exception '% ya es VIP', v_nick; end if;
    insert into vip_memberships (user_id, starts_at, ends_at, source, note)
    values (v_user, now(), null, 'import', 'Lifetime: carga inicial de Kyan (2026-10-28)');
    v_done := v_done || v_user;
    raise notice 'VIP lifetime: % (cuenta %)', v_nick, v_user;
  end loop;
end $$;

-- Cómo quedó (antes del commit): todas las cuentas VIP, lifetime y activas.
select p.nick as ficha, pr.tag as alias, v.starts_at, v.ends_at, v.source, public.is_vip(v.user_id) as vip
  from vip_memberships v
  join profiles pr on pr.id = v.user_id
  left join players p on p.user_id = v.user_id
 order by p.nick;

commit;
