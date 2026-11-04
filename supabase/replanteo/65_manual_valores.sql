-- Replanteo 65: valores de la configuración para el manual de usuario (plan docs/bitacora/2026-11-03-manual-valores-reales).
--   manual_valores(): los números que el manual muestra con marcadores ({{mm.aceptar}}), con el valor vigente. Solo
--   esos: mm_config no la puede leer un usuario común y esta función no expone nada más.
-- Las claves son los nombres de los marcadores (web/backend/src/lib/manual.ts, MARCADORES).
-- Solo lectura. Va después de la 64. NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.mm_config') is null or to_regclass('public.team_config') is null
     or to_regclass('public.clip_config') is null or to_regclass('public.elo_config') is null
     or to_regclass('public.claim_config') is null then
    raise exception 'replanteo 65: faltan mm_config, team_config, clip_config, elo_config o claim_config';
  end if;
  if to_regprocedure('public.manual_valores()') is not null then
    raise exception 'replanteo 65: manual_valores ya existe (¿ya se aplicó?)';
  end if;
end $$;

create function public.manual_valores() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'mm.grupo_max', m.max_party_size,
    'mm.grupo_dif_elo', m.party_max_elo_gap,
    'mm.aceptar', m.accept_seconds,
    'mm.veto', m.veto_seconds,
    'mm.conectar', m.connect_minutes,
    'mm.espera_servidor', m.server_wait_minutes,
    'mm.volver', m.reconnect_minutes,
    'mm.sanciones', to_jsonb(m.penalty_ladder),
    'equipo.max_miembros', t.max_members,
    'equipo.capitan_max', t.max_led,
    'clips.por_partida', c.per_match,
    'clips.por_jugador', c.per_player,
    'elo.min_pct', e.min_pct,
    'elo.full_pct', e.full_pct,
    'claim.max_steam_ids', k.max_steam_ids)
  from mm_config m, team_config t, clip_config c, elo_config e, claim_config k
  where m.id = 1 and t.id = 1 and c.id = 1 and e.id = 1 and k.id = 1 $$;

comment on function public.manual_valores() is
  'Valores de la configuración que muestra el manual de usuario (replanteo 65). Las claves son los marcadores de docs/manual.';

revoke all on function public.manual_valores() from public, anon;
grant execute on function public.manual_valores() to authenticated;

commit;
