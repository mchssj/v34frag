-- Pruebas de supabase/replanteo/42_torneo_fin_real.sql (correr con la migración aplicada). Todo con rollback.
begin;

create function pg_temp.ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if not coalesce(c, false) then raise exception 'FALLA: %', msg; end if;
  raise notice 'OK: %', msg;
end $$;

insert into public.teams(id, name, tag, kind) values
  ('eeeeeeee-4200-4000-8000-000000000001', 'Fin 42 A', 'F42A', 'official'),
  ('eeeeeeee-4200-4000-8000-000000000002', 'Fin 42 B', 'F42B', 'official');
-- Fin tentativo el 30, pero la final se jugó el 28.
insert into public.events(id, name, template, status, ends_on) values
  ('ffffffff-4200-4000-8000-000000000001', 'Fin 42', 'single', 'registration', date '2026-11-30');
select pg_temp.ok((select finished_at is null from public.event_list where id = 'ffffffff-4200-4000-8000-000000000001'), 'sin terminar: sin fecha real');

select set_config('v34.engine', '1', true);
insert into public.matches(event_id, kind, stage, round, pos, status, team1, team2, winner, best_of, score1, score2, played_at) values
  ('ffffffff-4200-4000-8000-000000000001', 'official', 'ko', 1, 1, 'finished', 'eeeeeeee-4200-4000-8000-000000000001',
   'eeeeeeee-4200-4000-8000-000000000002', 'eeeeeeee-4200-4000-8000-000000000001', 1, 1, 0, timestamptz '2026-11-28 21:00-05');
update public.events set status = 'finished', champion = 'eeeeeeee-4200-4000-8000-000000000001' where id = 'ffffffff-4200-4000-8000-000000000001';
select pg_temp.ok((select finished_at = timestamptz '2026-11-28 21:00-05' and ends_on = date '2026-11-30'
                     from public.event_list where id = 'ffffffff-4200-4000-8000-000000000001'),
                  'terminado: la fecha real es la de la última partida, no la tentativa');

-- Un W.O. (sin fecha) queda con la del momento.
insert into public.matches(id, event_id, kind, stage, round, pos, status, team1, team2, best_of) values
  ('cccccccc-4200-4000-8000-000000000001', 'ffffffff-4200-4000-8000-000000000001', 'official', 'ko', 2, 1, 'upcoming',
   'eeeeeeee-4200-4000-8000-000000000001', 'eeeeeeee-4200-4000-8000-000000000002', 1);
update public.matches set status = 'finished', winner = 'eeeeeeee-4200-4000-8000-000000000002', end_reason = 'walkover'
 where id = 'cccccccc-4200-4000-8000-000000000001';
select pg_temp.ok((select played_at is not null from public.matches where id = 'cccccccc-4200-4000-8000-000000000001'),
                  'W.O. sin fecha: queda la del momento');

rollback;
