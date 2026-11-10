-- Prueba del replanteo 106 en la base local (después de aplicar la 106). Todo dentro de una transacción que se deshace.
-- psql -v ON_ERROR_STOP=1 -f prueba_106.sql
begin;

-- Tokens de prueba.
insert into demo_workers(name, token_hash) values ('prueba106', encode(sha256(convert_to('demo106', 'UTF8')), 'hex'));
insert into render_workers(name, token_hash) values ('prueba106', encode(sha256(convert_to('render106', 'UTF8')), 'hex'));

-- 1. demo_evict: solo pasa a expired las uploaded con esa clave.
do $$
declare v_id uuid; v_key text; n int;
begin
  select id, demo_key into v_id, v_key from matches where demo_status = 'uploaded' and demo_key is not null limit 1;
  if v_id is null then raise notice 'sin demos subidas en la base local: se salta demo_evict'; return; end if;
  n := demo_evict('demo106', array[v_key, 'demos/no/existe.dem']);
  if n <> 1 or (select demo_status from matches where id = v_id) <> 'expired' then raise exception 'demo_evict: %', n; end if;
  if demo_evict('demo106', array[v_key]) <> 0 then raise exception 'demo_evict: marcó dos veces'; end if;
  if demo_evict('demo106', '{}') <> 0 then raise exception 'demo_evict: con la lista vacía'; end if;
  begin
    perform demo_evict('malo', array['x']);
    raise exception 'demo_evict: aceptó un token malo';
  exception when sqlstate 'PT401' then null;
  end;
  raise notice 'demo_evict ok';
end $$;

-- 2. clip_r2_evict_due y clip_r2_evicted: solo los que están en Drive, los no destacados primero.
do $$
declare r record; v_first uuid; n int; v_prev boolean := false;
begin
  for r in select d.clip_id, exists (select 1 from featured_clips_shown s where s.clip_id = d.clip_id) as feat
             from clip_r2_evict_due('render106', 1000) d loop
    if v_prev and not r.feat then raise exception 'clip_r2_evict_due: un no destacado después de un destacado'; end if;
    v_prev := r.feat;
    if v_first is null then v_first := r.clip_id; end if;
  end loop;
  if exists (select 1 from clip_r2_evict_due('render106', 1000) d join match_clips c on c.id = d.clip_id
              where c.video_drive_id is null or c.video_r2_deleted_at is not null or c.video_status <> 'done') then
    raise exception 'clip_r2_evict_due: dio uno sin Drive o ya borrado';
  end if;
  if v_first is null then raise notice 'sin clips en Drive en la base local: se salta clip_r2_evicted'; return; end if;
  n := clip_r2_evicted('render106', array[v_first, gen_random_uuid()]);
  if n <> 1 or (select video_r2_deleted_at from match_clips where id = v_first) is null then
    raise exception 'clip_r2_evicted: %', n;
  end if;
  if exists (select 1 from clip_r2_evict_due('render106', 1000) where clip_id = v_first) then
    raise exception 'clip_r2_evicted: lo sigue dando';
  end if;
  raise notice 'clips ok';
end $$;

rollback;
