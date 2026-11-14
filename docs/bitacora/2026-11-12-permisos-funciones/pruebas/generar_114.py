"""Genera supabase/replanteo/118_permisos.sql (antes 114) y su inversa desde acl_diff.txt (comparar.sh, referencia contra la copia
de producción). Solo quita lo que sobra: si a algún objeto le falta un permiso, se detiene (eso no es este arreglo).
Uso (desde la raíz del repo): python -I docs/bitacora/2026-11-12-permisos-funciones/pruebas/generar_114.py
"""
import ast
import sys
from collections import defaultdict
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[3]
DIFF = AQUI / "acl_diff.txt"
SQL = RAIZ / "supabase" / "replanteo" / "118_permisos.sql"
INV = RAIZ / "docs" / "bitacora" / "2026-10-14-replanteo-modelo-datos" / "reversas" / "118_permisos.sql"
ROLES = ("PUBLIC", "anon", "authenticated", "service_role")
# Objetos de la tienda (119): no están en producción ni en la referencia hasta la 117.
TIPO = {"f": "function", "r": "table", "p": "table", "v": "table", "m": "table", "S": "sequence"}

import subprocess

objetos = []  # (tipo, nombre, {rol: [privilegios]})
for linea in DIFF.read_text(encoding="utf-8").splitlines():
    if not linea.strip():
        continue
    k, n, mas, menos = linea.split("|", 3)
    falta = ast.literal_eval(menos[1:])
    if falta or k == "c":
        sys.exit(f"{n}: falta {falta} o es una columna. El diff tiene que ser el de antes de la 118 (este arreglo solo quita permisos)")
    por_rol = defaultdict(list)
    for a in ast.literal_eval(mas[1:]):
        rol, priv = a.split(":")
        if rol not in ROLES:
            sys.exit(f"Rol inesperado en {n}: {rol}")
        por_rol[rol].append(priv)
    objetos.append((k, n, dict(por_rol)))

def qual(n: str) -> str:
    return n if n.startswith("public.") else f"public.{n}"

def rol(r: str) -> str:
    return "public" if r == "PUBLIC" else r

def sentencias(verbo: str, prep: str) -> list[str]:
    out = []
    for k, n, por_rol in objetos:
        # Los roles que pierden lo mismo van en una sola sentencia.
        grupos = defaultdict(list)
        for r, privs in sorted(por_rol.items()):
            grupos[tuple(sorted(p.lower() for p in privs))].append(rol(r))
        for privs, roles in grupos.items():
            out.append(f"{verbo} {', '.join(privs)} on {TIPO[k]} {qual(n)} {prep} {', '.join(roles)};")
    return out

# Un revoke sobre la tabla también borra los permisos por columna (matches y ac_devices los tienen): se vuelven a dar
# los de la referencia para los roles y privilegios que se quitaron.
CONTENEDOR = "supabase_db_" + next(
    l.split('"')[1] for l in (RAIZ / "web" / "backend" / "supabase" / "config.toml").read_text(encoding="utf-8").splitlines() if l.startswith("project_id")
)
salida = subprocess.run(
    ["docker", "exec", CONTENEDOR, "psql", "-U", "postgres", "-d", "referencia_permisos", "-At", "-F|", "-c",
     "select a.attrelid::regclass::text, quote_ident(a.attname), pg_get_userbyid(x.grantee), x.privilege_type "
     "from pg_attribute a join pg_class c on c.oid = a.attrelid, aclexplode(a.attacl) x "
     "where c.relnamespace = 'public'::regnamespace and a.attacl is not null and a.attnum > 0 and not a.attisdropped "
     "and pg_get_userbyid(x.grantee) in ('anon', 'authenticated', 'service_role') order by 1, 3, 4, a.attnum"],
    capture_output=True, text=True, encoding="utf-8", check=True,
).stdout
columnas = defaultdict(list)  # (tabla, rol, privilegio) -> [columnas]
for l in salida.splitlines():
    t, col, r, priv = l.split("|")
    columnas[(t, r, priv)].append(col)
quitados = {(n, r, p) for k, n, por_rol in objetos if k != "f" for r, privs in por_rol.items() for p in privs}

# matches: la 10 dio select columna por columna sobre todas las columnas de ese momento menos link_code (el código de
# !match); las que se agregaron después nunca lo recibieron. La intención es todas menos link_code: se calcula al aplicar.
MATCHES = """do $$
begin
  execute 'grant select (' || (select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
                                 from information_schema.columns
                                where table_schema = 'public' and table_name = 'matches' and column_name <> 'link_code')
          || ') on public.matches to anon, authenticated';
end $$;"""

def matches_inversa() -> str:
    viejas = sorted(set(columnas[("matches", "anon", "SELECT")]) & set(columnas[("matches", "authenticated", "SELECT")]))
    lista_sql = ", ".join("'" + c.replace("'", "''") + "'" for c in viejas)
    return f"""do $$
declare v text;
begin
  select string_agg(quote_ident(column_name), ', ') into v from information_schema.columns
   where table_schema = 'public' and table_name = 'matches' and quote_ident(column_name) not in ({lista_sql});
  if v is not null then execute 'revoke select (' || v || ') on public.matches from anon, authenticated'; end if;
end $$;"""

def por_columna(verbo: str, prep: str) -> list[str]:
    out = []
    for (t, r, priv), cols in sorted(columnas.items()):
        if t == "matches":
            continue
        if (t, r, priv) in quitados:
            out.append(f"{verbo} {priv.lower()} ({', '.join(cols)}) on table {qual(t)} {prep} {r};")
    return out

funciones = [qual(n) for k, n, _ in objetos if k == "f"]
relaciones = [qual(n) for k, n, _ in objetos if k != "f"]
lista = lambda xs: ",\n    ".join(f"'{x}'" for x in xs)

cabecera = f"""-- 118 (antes 114): los permisos de producción vuelven a ser los de las migraciones (bitácora docs/bitacora/2026-11-12-permisos-funciones/).
--
-- La mudanza al VPS (2026-11-03, deploy/supabase/migrar-vps.sh) cargó el esquema de public en un Supabase nuevo, donde
-- cada objeto recibe permisos por defecto para anon y authenticated, y el volcado no traía los revoke. Quedaron
-- {len(funciones)} funciones que anon o authenticated pueden ejecutar por la API aunque las migraciones se lo quitan (entre ellas
-- season_close_run y csstv_after_ingest) y {len(relaciones)} tablas y vistas con permisos de más (las protege la RLS, pero no se dejan).
--
-- Generado por docs/bitacora/2026-11-12-permisos-funciones/pruebas/generar_114.py desde la comparación con una base
-- armada desde cero con las migraciones (comparar.sh). Solo quita lo que sobra: no da ningún permiso.
-- No toca datos ni definiciones. Se puede aplicar con mixes en curso.

begin;
"""

chequeo = f"""
do $$
declare v text; faltan text[] := '{{}}';
begin
  foreach v in array array[
    {lista(funciones)}] loop
    if to_regprocedure(v) is null then faltan := faltan || v; end if;
  end loop;
  foreach v in array array[
    {lista(relaciones)}] loop
    if to_regclass(v) is null then faltan := faltan || v; end if;
  end loop;
  if cardinality(faltan) > 0 then raise exception 'replanteo 118: no existen %', faltan; end if;
end $$;
"""

final = """
do $$ begin
  if has_function_privilege('anon', 'public.season_close_run(uuid, uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.season_close_run(uuid, uuid)', 'execute')
     or has_function_privilege('anon', 'public.csstv_after_ingest(uuid, jsonb, text)', 'execute')
     or has_function_privilege('anon', 'public.elo_recompute_player(text, text[])', 'execute')
     or has_function_privilege('authenticated', 'public.notify_due()', 'execute') then
    raise exception 'replanteo 118: quedó algún permiso de los que se quitan';
  end if;
  -- Lo que tiene que seguir andando: el plugin (anon con su token) y la web (con sesión).
  if not has_function_privilege('anon', 'public.csstv_ingest(uuid, jsonb)', 'execute')
     or not has_function_privilege('authenticated', 'public.mm_my_state()', 'execute') then
    raise exception 'replanteo 118: se quitó un permiso que se usa';
  end if;
  -- matches: todo menos el código de !match.
  if has_column_privilege('anon', 'public.matches', 'link_code', 'select')
     or not has_column_privilege('anon', 'public.matches', 'parent_approved', 'select')
     or not has_column_privilege('authenticated', 'public.matches', 'status', 'select') then
    raise exception 'replanteo 118: los permisos de matches no quedaron como tienen que quedar';
  end if;
end $$;

notify pgrst, 'reload schema';

commit;
"""

columnas_sql = por_columna("grant", "to") + [MATCHES]
SQL.write_text(
    cabecera + chequeo + "\n" + "\n".join(sentencias("revoke", "from"))
    + "\n\n-- Los permisos por columna que el revoke de la tabla se llevó (los de la referencia).\n" + "\n".join(columnas_sql) + "\n" + final,
    encoding="utf-8", newline="\n",
)
# La inversa: lo de la tabla entera vuelve a estar, y con eso los permisos por columna sobran pero no estorban (eran
# los mismos que tenía producción, que también los tenía).
INV.write_text(
    "-- Inversa de la 118: devuelve los permisos de más que tenía producción. Deja otra vez abiertas funciones como\n"
    "-- season_close_run: solo para deshacer si la 118 rompió algo, y hasta encontrar qué.\n\nbegin;\n\n"
    + "\n".join(sentencias("grant", "to"))
    + "\n\n-- matches: sin el permiso por columna de las que la lista de la 10 no tenía (como estaba).\n"
    + matches_inversa() + "\n\nnotify pgrst, 'reload schema';\n\ncommit;\n",
    encoding="utf-8", newline="\n",
)
print(f"{len(funciones)} funciones y {len(relaciones)} tablas y vistas; {len(sentencias('revoke', 'from'))} sentencias y {len(columnas_sql)} de columnas")
