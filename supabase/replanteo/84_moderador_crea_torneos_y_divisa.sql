-- 84: el moderador crea torneos (con aprobación de un admin) y el premio con monto y divisa
-- (bitácora docs/bitacora/2026-11-07-moderador-crea-torneos-y-divisa, Daniel 2026-11-07).
--
--   1. events.admin_review: lo pone la base al crear, true si lo creó un moderador (no un admin). Ese torneo lo aprueba
--      o lo rechaza solo un admin, y su aviso de revisión (admin_event_review) les llega solo a los admins.
--   2. Un moderador crea torneos normales e históricos (antes, solo históricos y aprobados solos). Todo lo suyo nace
--      pendiente. Es dueño de lo que creó (can_own_event: borrar y cancelar) y lo vuelve a enviar aunque esté en testing.
--   3. Premio: events.prize_amount, prize_currency (USD, ARS u other) y prize_currency_other (el nombre de la otra).
--      events.prize sigue como el detalle en texto libre.
--   4. event_list suma admin_review, prize_amount, prize_currency y prize_currency_other.
-- Necesita la 80. Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/84_moderador_crea_torneos_y_divisa.sql.
begin;

do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name = 'approval') then
    raise exception 'replanteo 84: falta la 80 (events.approval)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'events' and column_name = 'admin_review') then
    raise exception 'replanteo 84: ya se aplicó (events.admin_review existe)';
  end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 84: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- Suma columnas al final de una vista security_invoker. Busca el FROM de primer nivel.
create or replace function pg_temp.sumar_columnas(v regclass, cols text) returns void language plpgsql as $$
declare d text := pg_get_viewdef(v, true); marca text := E'\n   FROM '; n int;
begin
  n := (length(d) - length(replace(d, marca, ''))) / length(marca);
  if n <> 1 then raise exception 'replanteo 84: la vista % tiene % FROM de primer nivel', v, n; end if;
  execute format('create or replace view %s with (security_invoker = true) as %s', v,
                 replace(d, marca, E',\n    ' || cols || marca));
end $$;

-- =====================================================================================================
-- 1. Columnas
-- =====================================================================================================
alter table public.events
  add column admin_review boolean not null default false,
  add column prize_amount numeric(12, 2) constraint events_prize_amount_check check (prize_amount > 0),
  add column prize_currency text constraint events_prize_currency_check check (prize_currency in ('USD', 'ARS', 'other')),
  add column prize_currency_other text constraint events_prize_currency_other_len check (char_length(btrim(prize_currency_other)) between 1 and 12),
  add constraint events_prize_amount_currency check ((prize_amount is null) = (prize_currency is null)),
  add constraint events_prize_currency_other_check check ((prize_currency is not distinct from 'other') = (prize_currency_other is not null));

comment on column public.events.admin_review is 'Lo creó un moderador: lo aprueba o lo rechaza solo un admin. Lo pone la base al crear. Replanteo 84';
comment on column public.events.prize_amount is 'Monto del premio (opcional, con prize_currency). events.prize es el detalle. Replanteo 84';
comment on column public.events.prize_currency is 'USD, ARS u other (con prize_currency_other). Replanteo 84';
comment on column public.events.prize_currency_other is 'Nombre de la divisa cuando prize_currency = other (por ejemplo BRL), hasta 12 caracteres. Replanteo 84';

-- =====================================================================================================
-- 2. Quién crea y quién aprueba
-- =====================================================================================================
-- Los avisos solo para admins usan notify_admin_ids() (replanteo 28).
drop policy "torneos: crear" on public.events;
create policy "torneos: crear" on public.events for insert to authenticated
  with check ((is_organizer() or is_moderator()) and (organizer_id = auth.uid() or is_admin()));

select pg_temp.reemplazar('public.events_guard()', array[
  [E'    -- (replanteo 80) un moderador crea solo históricos; testing solo admin o moderador; lo de un organizador nace pendiente\n'
   || E'    if auth.uid() is not null and not is_organizer() and not (new.historic and is_moderator()) then\n'
   || E'      raise exception ''Solo un organizador o un admin puede crear torneos'' using errcode = ''42501'';',
   E'    -- (replanteo 84) crean organizadores, moderadores y admins; lo que no crea un admin nace pendiente\n'
   || E'    if auth.uid() is not null and not is_organizer() and not is_moderator() then\n'
   || E'      raise exception ''Solo un organizador, un moderador o un admin puede crear torneos'' using errcode = ''42501'';'],
  ['    new.approval := case when auth.uid() is null or is_moderator() then ''approved'' else ''pending'' end;',
   E'    new.approval := case when auth.uid() is null or is_admin() then ''approved'' else ''pending'' end;\n'
   || E'    new.admin_review := auth.uid() is not null and is_moderator() and not is_admin();   -- (replanteo 84)'],
  ['  if new.historic is distinct from old.historic then raise exception ''El tipo del torneo (histórico o normal) no se cambia''; end if;',
   E'  if new.historic is distinct from old.historic then raise exception ''El tipo del torneo (histórico o normal) no se cambia''; end if;\n'
   || E'  if new.admin_review is distinct from old.admin_review and auth.uid() is not null then\n'
   || E'    raise exception ''Quién aprueba el torneo no se cambia'';   -- (replanteo 84)\n'
   || E'  end if;']
]);

select pg_temp.reemplazar('public.event_review(uuid, boolean, text)', array[
  ['  if e.approval <> ''pending'' then raise exception ''Ese torneo no espera aprobación'' using errcode = ''V3901''; end if;',
   E'  if e.admin_review and not is_admin() then   -- (replanteo 84) lo de un moderador lo aprueba un admin\n'
   || E'    raise exception ''Lo creó un moderador: lo aprueba o lo rechaza un admin'' using errcode = ''42501'';\n'
   || E'  end if;\n'
   || E'  if e.approval <> ''pending'' then raise exception ''Ese torneo no espera aprobación'' using errcode = ''V3901''; end if;']
]);

select pg_temp.reemplazar('public.event_resubmit(uuid)', array[
  ['  if e.organizer_id is distinct from auth.uid() or e.testing then',
   '  if e.organizer_id is distinct from auth.uid() or (e.testing and not is_moderator()) then   -- (replanteo 84) el moderador, también en testing'],
  ['  perform notify(notify_staff_ids(), ''admin_event_review'',',
   '  perform notify(case when e.admin_review then notify_admin_ids() else notify_staff_ids() end, ''admin_event_review'',   -- (replanteo 84)']
]);

-- El moderador es dueño de lo que creó (borrar y cancelar), también en testing.
select pg_temp.reemplazar('public.can_own_event(uuid)', array[
  ['     where e.id = p_event and e.organizer_id = auth.uid() and p.role = ''organizer'' and not e.testing)',
   '     where e.id = p_event and e.organizer_id = auth.uid() and (p.role = ''organizer'' and not e.testing or p.role = ''moderator''))   -- (replanteo 84)']
]);

select pg_temp.reemplazar('public.tg_notify_events()', array[
  ['      perform notify(notify_staff_ids(), ''admin_event_review'',',
   '      perform notify(case when new.admin_review then notify_admin_ids() else notify_staff_ids() end, ''admin_event_review'',   -- (replanteo 84)']
]);

-- =====================================================================================================
-- 3. Listado de torneos
-- =====================================================================================================
select pg_temp.sumar_columnas('public.event_list', 'e.admin_review, e.prize_amount, e.prize_currency, e.prize_currency_other');

notify pgrst, 'reload schema';
commit;
