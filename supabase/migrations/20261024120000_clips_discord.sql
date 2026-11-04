-- =============================================================================
-- Clips en Discord: las mejores jugadas de cada mix se publican en un canal con su video
--
-- - match_clips guarda si la jugada ya se publicó (discord_posted_at) y el id del mensaje.
-- - clip_discord_pending: las jugadas con video listo y sin publicar, entre las p_top mejores
--   de cada partida, de las partidas que ya no tienen ninguna de esas jugadas en cola o
--   grabándose (así salen juntas y en orden). Partida más vieja primero, del puesto 1 en adelante.
-- - clip_discord_mark: marca una jugada como publicada.
-- Las dos las usa la máquina de render (render/procesar.py) con su token (render_workers).
--
-- Necesita 20261023180000_clips_video.sql. match_clip_list no cambia: el replanteo no se toca.
--
-- Bitácora: docs/bitacora/2026-10-24-clips-discord/
-- Cómo aplicarla: Supabase > SQL Editor > pegar todo el archivo > Run. Re-ejecutable.
-- =============================================================================

begin;

alter table public.match_clips add column if not exists discord_posted_at  timestamptz;
alter table public.match_clips add column if not exists discord_message_id text;

-- Las jugadas para publicar, con lo que hace falta para el mensaje y para conseguir el video.
-- Devuelve un arreglo JSON (vacío si no hay nada).
create or replace function public.clip_discord_pending(p_token text, p_top integer default 5, p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform render_auth(p_token);
  if p_top is null or p_top not between 1 and 50 then
    raise exception 'Tope inválido' using errcode = 'PT422';
  end if;
  return coalesce((
    select jsonb_agg(x order by x.played_at, x.match_id, x.position)
      from (
        select l.id as clip_id, l.match_id, m.external_id, m.map, m.score1, m.score2, m.played_at,
               l.position, l.type, l.round, l.player_name, l.clutch_vs,
               l.video_key, l.video_in_r2, l.video_drive_id, l.video_seconds
          from match_clip_list l
          join matches m on m.id = l.match_id
          join match_clips c on c.id = l.id
         where l.position <= p_top and l.video_status = 'done' and c.discord_posted_at is null
           and m.status in ('finished', 'cancelled')
           and not exists (select 1 from match_clip_list p
                            where p.match_id = l.match_id and p.position <= p_top
                              and (p.video_status is null or p.video_status = 'processing'))
         order by m.played_at, l.match_id, l.position
         limit least(greatest(coalesce(p_limit, 20), 1), 100)
      ) x), '[]'::jsonb);
end $$;

-- Marca la jugada como publicada. false si no existe o ya estaba publicada.
create or replace function public.clip_discord_mark(p_token text, p_clip uuid, p_message_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform render_auth(p_token);
  if p_message_id is null or p_message_id !~ '^[0-9]{5,25}$' then
    raise exception 'Id de mensaje inválido' using errcode = 'PT422';
  end if;
  update match_clips set discord_posted_at = now(), discord_message_id = p_message_id
   where id = p_clip and discord_posted_at is null;
  return found;
end $$;

revoke all on function public.clip_discord_pending(text, integer, integer) from public;
revoke all on function public.clip_discord_mark(text, uuid, text) from public;
grant execute on function public.clip_discord_pending(text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.clip_discord_mark(text, uuid, text) to anon, authenticated, service_role;

commit;
