-- Pruebas del replanteo 88 (las PCW no dan ELO). Las arma probar_88.sh: van después del replanteo y antes de su inversa,
-- dentro de una transacción que se deshace al final (no dejan nada en la base).
-- Usa un mix terminado con ELO (G) y una PCW (P) de la base local. t88 guarda el ELO de referencia.

-- ===== 0. Al aplicarse, la 88 le saca el ELO a la PCW ya jugada (probar_88.sh la vinculó antes) =====
do $$
declare g uuid := (select t.g from t88_pre t);
begin
  if exists (select 1 from match_player_stats where match_id = g and elo_after is not null) then
    raise exception '0: la PCW ya jugada sigue con ELO después de aplicar la 88';
  end if;
  update matches set parent_match_id = null, parent_side1 = null where id = g;  -- vuelve a ser un mix y recupera el ELO
  if not exists (select 1 from match_player_stats where match_id = g and elo_after is not null) then
    raise exception '0: el mix desvinculado no recuperó el ELO';
  end if;
  raise notice 'ok 0: al aplicarse, la 88 recalcula sin las PCW ya jugadas';
end $$;

create temp table t88 (k text primary key, id uuid);
create temp table t88_elo as select steam_id, elo from player_elo;

do $$
declare g uuid; p uuid;
begin
  select m.id into g from matches m
   where m.kind = 'mix' and m.status = 'finished' and m.parent_match_id is null
     and exists (select 1 from match_player_stats s where s.match_id = m.id and s.elo_after is not null)
     and m.id <> (select t.g from t88_pre t)
   -- Mejor uno posterior al último cierre o comienzo de temporada: si no, el reinicio tapa el cambio de ELO.
   order by coalesce(m.played_at, m.starts_at) > coalesce((select max(coalesce(closed_at, starts_at)) from seasons), '-infinity') desc,
            coalesce(m.played_at, m.starts_at) desc limit 1;
  select id into p from matches where kind = 'pcw' limit 1;
  if g is null or p is null then raise exception 'falta un mix con ELO o una PCW en la base local'; end if;
  insert into t88 values ('g', g), ('p', p);
  raise notice 'ok: datos de prueba';
end $$;

-- ===== 1. Vincular a una PCW un mapa que ya tenía ELO lo deja sin ELO y recalcula =====
do $$
declare g uuid := (select id from t88 where k = 'g'); p uuid := (select id from t88 where k = 'p');
begin
  update matches set parent_match_id = p, parent_side1 = 1 where id = g;
  if exists (select 1 from match_player_stats where match_id = g and (elo_after is not null or elo_delta is not null)) then
    raise exception '1: el mapa de la PCW sigue con ELO';
  end if;
  if coalesce((select coalesce(played_at, starts_at) from matches where id = g), '-infinity')
       <= coalesce((select max(coalesce(closed_at, starts_at)) from seasons), '-infinity') then
    raise notice '1: el mapa es anterior al último reinicio de temporada; no se mira el cambio de ELO';
  elsif not exists (select 1 from match_player_stats s join t88_elo e on e.steam_id = elo_key(s.steam_id)
                  join player_elo x on x.steam_id = e.steam_id
                 where s.match_id = g and x.elo <> e.elo) then
    raise exception '1: el ELO de los jugadores del mapa no cambió';
  end if;
  raise notice 'ok 1: vincular a una PCW saca el ELO del mapa';
end $$;

-- ===== 2. elo_apply_match no hace nada con un mapa de una PCW =====
do $$
declare g uuid := (select id from t88 where k = 'g');
begin
  perform elo_apply_match(g);
  if exists (select 1 from match_player_stats where match_id = g and elo_after is not null) then
    raise exception '2: elo_apply_match aplicó ELO a un mapa de PCW';
  end if;
  raise notice 'ok 2: elo_apply_match saltea el mapa de PCW';
end $$;

-- ===== 3. Un recálculo completo tampoco lo cuenta =====
do $$
declare g uuid := (select id from t88 where k = 'g');
begin
  perform elo_recompute_all();
  if exists (select 1 from match_player_stats where match_id = g and elo_after is not null) then
    raise exception '3: el recálculo le dio ELO al mapa de PCW';
  end if;
  raise notice 'ok 3: el recálculo saltea el mapa de PCW';
end $$;

-- ===== 4. Desvincularlo le devuelve el ELO y todo queda como al principio =====
do $$
declare g uuid := (select id from t88 where k = 'g');
begin
  update matches set parent_match_id = null, parent_side1 = null where id = g;
  if not exists (select 1 from match_player_stats where match_id = g and elo_after is not null) then
    raise exception '4: el mapa desvinculado no recuperó el ELO';
  end if;
  if exists (select steam_id, elo from t88_elo except select steam_id, elo from player_elo)
     or exists (select steam_id, elo from player_elo except select steam_id, elo from t88_elo) then
    raise exception '4: el ELO no volvió a ser el de antes';
  end if;
  raise notice 'ok 4: desvincular devuelve el ELO de antes';
end $$;

-- ===== 5. Un mapa sin ELO que entra a una PCW (la ingesta) no recalcula =====
do $$
declare g uuid := (select id from t88 where k = 'g'); p uuid := (select id from t88 where k = 'p'); antes text;
begin
  update match_player_stats set elo_before = null, elo_after = null, elo_delta = null, win_prob = null where match_id = g;
  -- Un recálculo borra y vuelve a crear las filas de player_elo: cambia su ctid.
  select string_agg(ctid::text, ',' order by steam_id) into antes from player_elo;
  update matches set parent_match_id = p, parent_side1 = 2 where id = g;
  if (select string_agg(ctid::text, ',' order by steam_id) from player_elo) is distinct from antes then
    raise exception '5: vincular un mapa sin ELO recalculó';
  end if;
  update matches set parent_match_id = null, parent_side1 = null where id = g;  -- recalcula y lo deja como al principio
  raise notice 'ok 5: el vínculo de la ingesta no recalcula';
end $$;

-- ===== 6. Un no admin no recalcula a mano, pero sí desde el trigger =====
do $$
declare u uuid := (select id from profiles where role is distinct from 'admin' limit 1);
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  begin
    perform elo_recompute_all();
    raise exception '6: un no admin recalculó a mano';
  exception when insufficient_privilege then null;
  end;
  perform set_config('v34.elo_pcw_link', 'on', true);
  perform elo_recompute_all();
  perform set_config('v34.elo_pcw_link', 'off', true);
  perform set_config('request.jwt.claims', '', true);
  raise notice 'ok 6: el recálculo del trigger no pide admin';
end $$;
