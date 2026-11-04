-- Replanteo 61: ver y levantar las sanciones automáticas de la cola del matchmaking
-- (plan docs/bitacora/2026-11-02-mm-sanciones-admin, aprobado por Daniel el 2026-11-02).
--   1. mm_penalty_log suma lifted_at, lifted_by y lift_reason: quién levantó la falta y por qué.
--   2. mm_admin_lists('penalties'): las sanciones vigentes con el motivo de la última falta y el nivel (moderadores).
--   3. mm_admin_lift_penalty(usuario, motivo): corta la espera, baja un nivel de la escalera, lo anota en la falta y le
--      avisa al jugador (penalty.lifted) para que la web vuelva a pedir su estado.
-- Se aplica después de la 60. NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'mm_penalty_log' and column_name = 'lifted_at') then
    raise exception 'replanteo 61: mm_penalty_log.lifted_at ya existe (¿ya se aplicó?)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    -- Sin \r: con el archivo en CRLF (autocrlf), los textos de varias líneas no coincidirían con la función.
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 61: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

-- ---------- 1. Registro de la falta levantada ----------

alter table public.mm_penalty_log
  add column lifted_at timestamptz,
  add column lifted_by uuid references auth.users(id) on delete set null,
  add column lift_reason text check (char_length(lift_reason) between 3 and 300);
comment on column public.mm_penalty_log.lifted_at is 'Cuándo un moderador levantó la sanción de esta falta (replanteo 61)';

-- ---------- 2. Lista de las vigentes ----------

select pg_temp.reemplazar('public.mm_admin_lists(text, text)', array[
  ['if p_what in (''reports'', ''bans'') then', 'if p_what in (''reports'', ''bans'', ''penalties'') then'],
  ['    when ''servers'' then',
   '    when ''penalties'' then (select coalesce(jsonb_agg(jsonb_build_object(''user_id'', p.user_id, ''player_id'', pl.id, ''nick'', pl.nick,' || E'\n' ||
   '        ''level'', p.level, ''max_level'', (select cardinality(penalty_ladder) from mm_config limit 1),' || E'\n' ||
   '        ''reason'', lg.reason, ''since'', lg.created_at, ''until'', p.until) order by p.until), ''[]'')' || E'\n' ||
   '        from mm_penalties p left join players pl on pl.user_id = p.user_id' || E'\n' ||
   '        left join lateral (select reason, created_at from mm_penalty_log where user_id = p.user_id order by created_at desc, id desc limit 1) lg on true' || E'\n' ||
   '        where p.until > now())' || E'\n' ||
   '    when ''servers'' then']
]);

-- ---------- 3. Levantar una ----------

create function public.mm_admin_lift_penalty(p_user uuid, p_reason text) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_log bigint;
begin
  if not is_moderator() then raise exception 'Solo moderadores y admins' using errcode = '42501'; end if;
  if char_length(v_reason) not between 3 and 300 then raise exception 'El motivo tiene que tener entre 3 y 300 caracteres'; end if;
  -- Bloqueada: si a la vez le cae otra falta, una de las dos espera a la otra.
  perform 1 from mm_penalties where user_id = p_user and until > now() for update;
  if not found then raise exception 'No tiene una sanción vigente' using errcode = 'P0002'; end if;
  -- Como si esa falta no hubiera pasado: sin espera y un nivel menos (Daniel, 2026-11-02).
  update mm_penalties set until = now(), level = greatest(0, level - 1) where user_id = p_user;
  select id into v_log from mm_penalty_log where user_id = p_user and lifted_at is null order by created_at desc, id desc limit 1;
  update mm_penalty_log set lifted_at = now(), lifted_by = auth.uid(), lift_reason = v_reason where id = v_log;
  perform mm_emit('penalty.lifted', null, array[p_user]);
end $$;
comment on function public.mm_admin_lift_penalty(uuid, text) is 'Levanta la sanción vigente de la cola: sin espera y un nivel menos (replanteo 61)';

revoke all on function public.mm_admin_lift_penalty(uuid, text) from public, anon;
grant execute on function public.mm_admin_lift_penalty(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
