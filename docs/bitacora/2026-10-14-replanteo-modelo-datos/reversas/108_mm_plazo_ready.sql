-- Inversa de la 108: mm_tick sin el plazo del !ready (vuelve a cancelar al vencer connect_deadline aunque estén
-- todos conectados). Las salas que ya se alargaron siguen con su connect_deadline.

begin;

do $$
declare
  f text;
  ini int;
  fin int;
  marca_ini text := '      -- (replanteo 108) ini';
  marca_fin text := '      -- (replanteo 108) fin' || chr(10);
  decl text := '  v_ready timestamptz;  -- (replanteo 108)' || chr(10);
begin
  f := pg_get_functiondef('public.mm_tick()'::regprocedure);
  ini := position(marca_ini in f);
  fin := position(marca_fin in f);
  if ini = 0 or fin = 0 or fin < ini or position(decl in f) = 0 then
    raise exception 'inversa 108: mm_tick no tiene el bloque de la 108';
  end if;
  f := left(f, ini - 1) || substr(f, fin + length(marca_fin));
  f := replace(f, decl, '');
  if position('replanteo 108' in f) > 0 then raise exception 'inversa 108: quedaron restos en mm_tick'; end if;
  execute f;
end $$;

commit;
