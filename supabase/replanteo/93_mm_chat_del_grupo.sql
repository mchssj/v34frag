-- 93: chat del grupo en Jugar y denunciar desde ese chat (bitácora docs/bitacora/2026-11-08-pcw-real, Daniel 2026-11-08,
-- sobre el prototipo de Kyan en docs/bitacora/2026-11-08-pcw-demo).
--
--   1. mm_party_chat: los mensajes del grupo. Los ven solo los que están en el grupo y se borran cuando el grupo se
--      deshace (cascada desde mm_parties). Sin chat global.
--   2. mm_party_chat_send: 1 a 300 caracteres (como el chat de la sala), solo con un grupo de 2 o más, hasta 10 mensajes
--      cada 10 segundos. Avisa por el socket con 'party.chat' a los del grupo. mm_party_chat_list: los últimos 50.
--   3. mm_report_from_chat: denunciar a alguien por un mensaje del chat del grupo, sin sala. mm_reports.lobby_id pasa a
--      admitir null y guarda el mensaje como prueba (message). Una denuncia por cuenta denunciada cada 24 h.
--      mm_admin_lists('reports') suma message.
-- Es del matchmaking: va también en feat/frontend-fase-1 y en feat/mm-claim-en-sala.
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/93_mm_chat_del_grupo.sql.
begin;

do $$
begin
  if to_regclass('public.mm_parties') is null then raise exception 'replanteo 93: falta la 48 (mm_parties)'; end if;
  if to_regclass('public.mm_party_chat') is not null then raise exception 'replanteo 93: ya se aplicó (mm_party_chat existe)'; end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int;
begin
  for i in 1 .. array_length(cambios, 1) loop
    if position(cambios[i][1] in d) = 0 then
      raise exception 'replanteo 93: en % no se encontró: %', fn, left(cambios[i][1], 80);
    end if;
    d := replace(d, cambios[i][1], cambios[i][2]);
  end loop;
  execute d;
end $$;

-- ---------- 1. Mensajes ----------

create table public.mm_party_chat (
  id bigint generated always as identity primary key,
  party_id uuid not null references public.mm_parties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 300),
  created_at timestamptz not null default now()
);
comment on table public.mm_party_chat is 'Chat del grupo en Jugar; se borra con el grupo (replanteo 93)';
create index mm_party_chat_party on public.mm_party_chat (party_id, id);
create index mm_party_chat_user on public.mm_party_chat (user_id, created_at);
/** El grupo de una cuenta (o null). mm_party_members no se lee con la sesión del usuario. */
create function public.mm_party_of(p_user uuid) returns uuid
  language sql stable security definer set search_path = public as $$
  select party_id from mm_party_members where user_id = p_user $$;
revoke all on function public.mm_party_of(uuid) from public, anon;
grant execute on function public.mm_party_of(uuid) to authenticated;

alter table public.mm_party_chat enable row level security;
create policy "mm_party_chat: los del grupo" on public.mm_party_chat for select to authenticated
  using (party_id = mm_party_of(auth.uid()));
grant select on public.mm_party_chat to authenticated;

-- ---------- 2. Escribir y leer ----------

/** Mensajes de mi grupo, los últimos 50 (o los posteriores a p_after), del más viejo al más nuevo. */
create function public.mm_party_chat_list(p_after bigint default null) returns jsonb
  language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'user_id', x.user_id, 'player_id', x.player_id, 'alias', x.alias,
                                               'message', x.message, 'created_at', x.created_at, 'is_me', x.user_id = auth.uid())
                            order by x.id), '[]')
    from (select c.id, c.user_id, (select id from players where user_id = c.user_id limit 1) as player_id,
                 coalesce((select nick from players where user_id = c.user_id limit 1), p.tag, 'Usuario') as alias,
                 c.message, c.created_at
            from mm_party_chat c
            join mm_party_members me on me.party_id = c.party_id and me.user_id = auth.uid()
            left join profiles p on p.id = c.user_id
           where p_after is null or c.id > p_after
           order by c.id desc limit 50) x $$;

/** Escribir en el chat de mi grupo. Devuelve el mensaje con la misma forma que mm_party_chat_list. */
create function public.mm_party_chat_send(p_message text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare v_party uuid; v_msg text := trim(coalesce(p_message, '')); v_id bigint; v_users uuid[];
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select party_id into v_party from mm_party_members where user_id = auth.uid();
  if v_party is null then raise exception 'No estás en un grupo'; end if;
  select array_agg(user_id) into v_users from mm_party_members where party_id = v_party;
  if cardinality(v_users) < 2 then raise exception 'El chat del grupo es con al menos un compañero'; end if;
  if char_length(v_msg) < 1 or char_length(v_msg) > 300 then raise exception 'El mensaje va de 1 a 300 caracteres'; end if;
  if (select count(*) from mm_party_chat where user_id = auth.uid() and created_at > now() - interval '10 seconds') >= 10 then
    raise exception 'Estás escribiendo muy rápido: esperá unos segundos';
  end if;
  insert into mm_party_chat (party_id, user_id, message) values (v_party, auth.uid(), v_msg) returning id into v_id;
  perform mm_emit('party.chat', null, v_users);
  return (select e from jsonb_array_elements(mm_party_chat_list(v_id - 1)) e where (e->>'id')::bigint = v_id);
end $$;

revoke all on function public.mm_party_chat_list(bigint), public.mm_party_chat_send(text) from public, anon;
grant execute on function public.mm_party_chat_list(bigint), public.mm_party_chat_send(text) to authenticated;

-- ---------- 3. Denunciar desde el chat del grupo ----------

alter table public.mm_reports alter column lobby_id drop not null;
alter table public.mm_reports add column message text check (char_length(message) <= 300);
comment on column public.mm_reports.message is 'Denuncia desde el chat del grupo (sin sala): el mensaje, como prueba (replanteo 93)';
alter table public.mm_reports add constraint mm_reports_sala_o_mensaje check (lobby_id is not null or message is not null);

/** Denunciar al autor de un mensaje del chat de mi grupo. */
create function public.mm_report_from_chat(p_message bigint, p_reason text, p_note text default null) returns void
  language plpgsql security definer set search_path = public as $$
declare c mm_party_chat%rowtype;
begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión'; end if;
  select * into c from mm_party_chat where id = p_message;
  if c.id is null or not exists (select 1 from mm_party_members where party_id = c.party_id and user_id = auth.uid()) then
    raise exception 'Ese mensaje no está en el chat de tu grupo';
  end if;
  if c.user_id = auth.uid() then raise exception 'No te podés denunciar a vos mismo'; end if;
  if p_reason not in ('afk', 'toxic', 'cheat', 'abandon', 'other') then raise exception 'Motivo desconocido'; end if;
  if exists (select 1 from mm_reports where reporter_id = auth.uid() and reported_id = c.user_id and lobby_id is null
                and created_at > now() - interval '24 hours') then
    raise exception 'Ya denunciaste a ese jugador hoy';
  end if;
  insert into mm_reports (lobby_id, reporter_id, reported_id, reason, note, message)
  values (null, auth.uid(), c.user_id, p_reason, left(nullif(trim(p_note), ''), 500), c.message);
end $$;
revoke all on function public.mm_report_from_chat(bigint, text, text) from public, anon;
grant execute on function public.mm_report_from_chat(bigint, text, text) to authenticated;

select pg_temp.reemplazar('public.mm_admin_lists(text, text)', array[
  array[$q$'id', r.id, 'lobby_id', r.lobby_id, 'reason', r.reason, 'note', r.note,$q$,
        $q$'id', r.id, 'lobby_id', r.lobby_id, 'reason', r.reason, 'note', r.note, 'message', r.message,$q$]]);

commit;
