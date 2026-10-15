-- Replanteo 08: formatos de PCW habilitados por el admin (plan docs/bitacora/2026-10-15-formatos-pcw).
-- pcw_config (una sola fila, como elo_config) guarda qué formatos (BO1, BO3, BO5) se pueden elegir al
-- publicar una PCW. Empieza con los tres. Solo un admin la cambia (set_pcw_formats) y la base la hace
-- cumplir en create_pcw_post. Los anuncios ya publicados y las partidas aceptadas conservan su formato.
-- NO aplicar en producción antes del corte (ver README.md).
begin;

do $$
begin
  if to_regclass('public.pcw_config') is not null then
    raise exception 'replanteo 08: pcw_config ya existe (¿ya se aplicó?)';
  end if;
end $$;

-- ---------- 1. configuración ----------
create table public.pcw_config (
  id         smallint primary key default 1 check (id = 1),
  best_of    int[] not null default '{1,3,5}',
  updated_at timestamptz not null default now(),
  updated_by uuid,
  -- Sin repetidos: lo garantiza set_pcw_formats, la única forma de escribir (un check no admite subconsultas).
  constraint pcw_config_best_of check (cardinality(best_of) between 1 and 3 and best_of <@ array[1, 3, 5])
);
comment on table public.pcw_config is 'Formatos de PCW que se pueden elegir al publicar (una sola fila). Se cambia con set_pcw_formats';
insert into public.pcw_config (id) values (1);

alter table public.pcw_config enable row level security;
create policy pcw_config_leer on public.pcw_config for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on public.pcw_config from anon, authenticated;

-- ---------- 2. cambio (solo admin) ----------
create function public.set_pcw_formats(p_best_of int[]) returns int[]
  language plpgsql security definer set search_path = public as $$
declare v int[];
begin
  if not is_admin() then raise exception 'Solo un administrador puede cambiar los formatos de PCW'; end if;
  if exists (select 1 from unnest(coalesce(p_best_of, '{}')) x where x is null or x not in (1, 3, 5)) then
    raise exception 'Los formatos válidos son BO1, BO3 y BO5';
  end if;
  select coalesce(array_agg(distinct x order by x), '{}') into v from unnest(p_best_of) x;
  if cardinality(v) = 0 then raise exception 'Tiene que quedar al menos un formato habilitado'; end if;
  update pcw_config set best_of = v, updated_at = now(), updated_by = auth.uid() where id = 1;
  return v;
end $$;
revoke all on function public.set_pcw_formats(int[]) from public, anon;
grant execute on function public.set_pcw_formats(int[]) to authenticated;

-- ---------- 3. create_pcw_post respeta la configuración ----------
create function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 08: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.create_pcw_post(text, integer, text, timestamp with time zone, text, uuid[], text[])', array[
  ['if p_best_of not in (1, 3, 5) then raise exception ''El formato tiene que ser BO1, BO3 o BO5''; end if;',
   E'if p_best_of not in (1, 3, 5) then raise exception ''El formato tiene que ser BO1, BO3 o BO5''; end if;\n  -- (replanteo 08) solo los formatos que habilitó el admin\n  if not exists (select 1 from pcw_config c where c.id = 1 and p_best_of = any(c.best_of)) then\n    raise exception ''El formato BO% no está habilitado para las PCW'', p_best_of;\n  end if;']
]);

commit;
