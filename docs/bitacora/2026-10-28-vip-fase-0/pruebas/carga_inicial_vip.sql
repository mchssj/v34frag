-- Carga inicial de los VIP de Kyan, todos lifetime y comprados en octubre de 2026. Se buscan por el nick de la ficha, como
-- los links de la web vieja (#jugador/<nick>): instt (uriel), sandeerz, romanxz (romanzera) y shoxmeister (cypee-thor).
-- starts_at es el día de la compra (medianoche de Colombia), para que days_active de vip_status (migración
-- 20261029120000_vip_dias.sql) cuente desde ahí. Fechas y montos pasados por Daniel el 2026-10-29.
-- El VIP es de la cuenta: se da a la cuenta vinculada a cada ficha (players.user_id). Una ficha sin cuenta se salta con
-- un aviso: cuando la cree y vincule su SteamID, se vuelve a correr este mismo archivo.
-- Re-ejecutable: a quien ya tiene su VIP de la carga (source = 'import') solo le corrige la fecha de inicio y la nota.
-- Correr en Supabase > SQL Editor, en producción. El paso 1 solo lee y el paso 2 no carga nada si algo no cuadra.

-- =====================================================================================================
-- Paso 1 (solo lectura): cada nick, su ficha y su cuenta. Las que no tienen user_id se saltan en el paso 2.
-- =====================================================================================================
select n.nick as buscado, p.id as player_id, p.nick as ficha, p.user_id, pr.tag as alias, public.is_vip(p.user_id) as ya_es_vip
  from unnest(array['instt', 'shoxmeister', 'romanxz', 'sandeerz']) n(nick)
  left join players p on lower(p.nick) = lower(n.nick)
  left join profiles pr on pr.id = p.user_id
 order by n.nick;

-- =====================================================================================================
-- Paso 2: darles VIP lifetime desde el día de la compra. Aborta sin cargar a nadie si un nick no existe, si hay dos
-- fichas con el mismo nick, si dos nicks son la misma cuenta o si alguno ya es VIP por otro lado (dado desde el admin).
-- =====================================================================================================
begin;

do $$
declare
  r record;
  v_players uuid[];
  v_user uuid;
  v_start timestamptz;
  v_note text;
  v_done uuid[] := '{}';
begin
  for r in select * from (values
      ('instt',       date '2026-10-26', '8000, descuento por ser el primero'),
      ('shoxmeister', date '2026-10-26', '12k'),
      ('romanxz',     date '2026-10-26', '12k'),
      ('sandeerz',    date '2026-10-27', '12k')) t(nick, bought, paid)
  loop
    select array_agg(id) into v_players from players where lower(nick) = lower(r.nick);
    if v_players is null then raise exception 'No hay ninguna ficha con el nick %', r.nick; end if;
    if cardinality(v_players) > 1 then raise exception 'Hay % fichas con el nick %', cardinality(v_players), r.nick; end if;
    select user_id into v_user from players where id = v_players[1];
    -- Fichas que perdieron players.user_id con el panel viejo (bitácora 2026-10-25-vinculos-perdidos): la cuenta todavía
    -- apunta a la ficha en profiles.player_id (columna que el replanteo 01 borra en el corte).
    if v_user is null and exists (select 1 from information_schema.columns
                                   where table_schema = 'public' and table_name = 'profiles' and column_name = 'player_id') then
      execute 'select id from profiles where player_id = $1 limit 1' into v_user using v_players[1];
      if v_user is not null then raise notice '% no tenía players.user_id: se usa la cuenta de profiles.player_id', r.nick; end if;
    end if;
    if v_user is null then
      raise notice 'PENDIENTE: la ficha % no tiene cuenta (tiene que crearla en la web y vincular su SteamID)', r.nick;
      continue;
    end if;
    if v_user = any(v_done) then raise exception 'La cuenta de % ya está en la lista con otro nick', r.nick; end if;
    v_done := v_done || v_user;

    v_start := r.bought::timestamp at time zone 'America/Bogota';
    v_note := format('Lifetime comprado el %s (%s): carga inicial de Kyan', r.bought, r.paid);
    if exists (select 1 from vip_memberships where user_id = v_user and source = 'import' and revoked_at is null and ends_at is null) then
      update vip_memberships set starts_at = v_start, note = v_note
       where user_id = v_user and source = 'import' and revoked_at is null and ends_at is null;
      raise notice 'Ya cargado, fecha corregida: % desde el %', r.nick, r.bought;
      continue;
    end if;
    if is_vip(v_user) then raise exception '% ya es VIP (dado desde el admin): revisarlo a mano', r.nick; end if;
    insert into vip_memberships (user_id, starts_at, ends_at, source, note)
    values (v_user, v_start, null, 'import', v_note);
    raise notice 'VIP lifetime: % desde el % (cuenta %)', r.nick, r.bought, v_user;
  end loop;
end $$;

-- Cómo quedó (antes del commit): todas las cuentas VIP, desde cuándo y cuántos días llevan.
select p.nick as ficha, pr.tag as alias, v.starts_at, v.ends_at, v.source, v.note, public.is_vip(v.user_id) as vip,
       (now() at time zone 'America/Bogota')::date - (v.starts_at at time zone 'America/Bogota')::date as dias
  from vip_memberships v
  join profiles pr on pr.id = v.user_id
  left join players p on p.user_id = v.user_id
 order by p.nick;

commit;
