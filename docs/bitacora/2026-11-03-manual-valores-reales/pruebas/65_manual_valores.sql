-- Pruebas del replanteo 65 (valores del manual). Se corren con correr.sh, dentro de una transacción que se deshace.
do $$
declare
  v jsonb;
  k text;
  claves text[] := array['mm.grupo_max', 'mm.grupo_dif_elo', 'mm.aceptar', 'mm.veto', 'mm.conectar', 'mm.espera_servidor',
                         'mm.volver', 'mm.sanciones', 'equipo.max_miembros', 'equipo.capitan_max', 'clips.por_partida',
                         'clips.por_jugador', 'elo.min_pct', 'elo.full_pct', 'claim.max_steam_ids'];
begin
  -- 1. Como usuario con sesión: todas las claves, números, y la escalera como arreglo.
  set local role authenticated;
  v := manual_valores();
  reset role;
  foreach k in array claves loop
    if not v ? k then raise exception 'FALLA 1: falta %', k; end if;
    if k <> 'mm.sanciones' and jsonb_typeof(v -> k) <> 'number' then raise exception 'FALLA 1: % no es un número', k; end if;
  end loop;
  if jsonb_typeof(v -> 'mm.sanciones') <> 'array' then raise exception 'FALLA 1: mm.sanciones no es un arreglo'; end if;
  if (select count(*) from jsonb_object_keys(v)) <> cardinality(claves) then raise exception 'FALLA 1: sobran claves: %', v; end if;
  raise notice 'OK 1: % claves como authenticated', cardinality(claves);

  -- 2. Sigue a la configuración.
  update mm_config set accept_seconds = 42 where id = 1;
  if (manual_valores() ->> 'mm.aceptar')::int <> 42 then raise exception 'FALLA 2: no sigue a mm_config'; end if;
  raise notice 'OK 2: sigue a mm_config';

  -- 3. anon no la puede llamar.
  begin
    set local role anon;
    perform manual_valores();
    reset role;
    raise exception 'FALLA 3: anon pudo llamarla';
  exception when insufficient_privilege then
    reset role;
    raise notice 'OK 3: anon no puede';
  end;
end $$;
