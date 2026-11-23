-- 137: tierlists de jugadores y equipos (bitácora docs/bitacora/2026-11-22-tierlists-jugadores-equipos, Daniel 2026-11-22).
--
--   1. tierlists: de una cuenta con ficha (owner y player_id), tipo players o teams, hasta 10 por cuenta. Todas públicas.
--      Nueva, trae los tiers S a D y, en el banco, las 30 primeras fichas del ranking o los 10 primeros equipos.
--      Una destacada por ficha (featured). copied_from: la original de una copia (null si se borró).
--   2. tierlist_tiers (hasta 10, nombre de 1 a 40) y tierlist_items (hasta 100 por tierlist): una ficha, un equipo real
--      (no los bandos de PCW) o un nombre externo de 1 a 40. Sin tier = en el banco. Si se borra la ficha o el equipo, el
--      ítem se va con ellos. tierlist_save reescribe los tiers y los ítems de una vez.
--   3. tierlist_comments: comentario y respuesta (dos niveles, la base rechaza responder una respuesta). Mismas reglas que
--      los del perfil (91 y 94): 280 caracteres, 30 s entre comentarios y 30 por día, palabras bloqueadas, baneados y
--      bloqueados no comentan. Se borran con deleted_at. El dueño los cierra en cada tierlist.
--   4. tierlist_likes: un me gusta por cuenta, no a la propia. Aviso al dueño la primera vez de cada cuenta.
--   5. tierlist_copy: copia ajena con tiers e ítems, sin comentarios, me gusta ni destacada. Cuenta para el tope.
--   6. tierlist_reports: denuncias de una tierlist o de un comentario. Las resuelven soporte, moderadores y admins:
--      descartar, o borrar (el comentario queda con deleted_at; la tierlist se borra y la denuncia guarda su nombre).
--   7. Avisos tierlist_comment, tierlist_reply y tierlist_like en la categoría friends.
-- Necesita la 94 (comment_blocked_word, profile_social_*) y la 117 (is_support, support_log).
-- Inversa: docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/137_tierlists.sql.
begin;

do $$
begin
  if to_regclass('public.tierlists') is not null then raise exception 'replanteo 137: ya se aplicó (tierlists existe)'; end if;
  if to_regprocedure('public.support_log(text, jsonb, text)') is null then raise exception 'replanteo 137: falta la 117 (support_log)'; end if;
  if to_regprocedure('public.comment_blocked_word(text)') is null then raise exception 'replanteo 137: falta la 94 (comment_blocked_word)'; end if;
end $$;

create or replace function pg_temp.reemplazar(fn regprocedure, cambios text[][]) returns void language plpgsql as $$
declare d text := pg_get_functiondef(fn); i int; a text; b text;
begin
  for i in 1 .. array_length(cambios, 1) loop
    a := replace(cambios[i][1], E'\r', ''); b := replace(cambios[i][2], E'\r', '');
    if position(a in d) = 0 then
      raise exception 'replanteo 137: en % no se encontró: %', fn, left(a, 80);
    end if;
    d := replace(d, a, b);
  end loop;
  execute d;
end $$;

select pg_temp.reemplazar('public.notification_category(text)', array[
  array[$q$when p_type in ('profile_comment', 'profile_like') then 'friends'$q$,
        $q$when p_type in ('profile_comment', 'profile_like', 'tierlist_comment', 'tierlist_reply', 'tierlist_like') then 'friends' -- (replanteo 137) tierlists$q$]]);

-- ---------- 1. Tablas ----------

create table public.tierlists (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references auth.users(id) on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 40),
  kind          text not null check (kind in ('players', 'teams')),
  featured      boolean not null default false,
  comments_open boolean not null default true,
  copied_from   uuid references public.tierlists(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.tierlists is 'Tierlists de jugadores o equipos, públicas, hasta 10 por cuenta (replanteo 137)';
create index tierlists_player on public.tierlists (player_id, updated_at desc);
create index tierlists_owner on public.tierlists (owner);
create unique index tierlists_one_featured on public.tierlists (player_id) where featured;

create table public.tierlist_tiers (
  id          uuid primary key default gen_random_uuid(),
  tierlist_id uuid not null references public.tierlists(id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 40),
  position    integer not null check (position between 0 and 9)
);
create index tierlist_tiers_list on public.tierlist_tiers (tierlist_id, position);

create table public.tierlist_items (
  id            uuid primary key default gen_random_uuid(),
  tierlist_id   uuid not null references public.tierlists(id) on delete cascade,
  tier_id       uuid references public.tierlist_tiers(id) on delete cascade,
  position      integer not null check (position between 0 and 99),
  ref_player    uuid references public.players(id) on delete cascade,
  ref_team      uuid references public.teams(id) on delete cascade,
  external_name text check (char_length(external_name) between 1 and 40),
  check (num_nonnulls(ref_player, ref_team, external_name) = 1),
  unique (tierlist_id, ref_player),
  unique (tierlist_id, ref_team)
);
comment on table public.tierlist_items is 'Ítems de una tierlist: ficha, equipo o nombre externo. tier_id null = en el banco (replanteo 137)';
create index tierlist_items_list on public.tierlist_items (tierlist_id, tier_id, position);
create index tierlist_items_player on public.tierlist_items (ref_player) where ref_player is not null;
create index tierlist_items_team on public.tierlist_items (ref_team) where ref_team is not null;

create table public.tierlist_comments (
  id          uuid primary key default gen_random_uuid(),
  tierlist_id uuid not null references public.tierlists(id) on delete cascade,
  parent_id   uuid references public.tierlist_comments(id) on delete cascade,
  author      uuid not null references auth.users(id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 280),
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references auth.users(id) on delete set null
);
comment on table public.tierlist_comments is 'Comentarios de las tierlists y sus respuestas (un nivel). Los borrados quedan con deleted_at (replanteo 137)';
create index tierlist_comments_list on public.tierlist_comments (tierlist_id, created_at desc) where parent_id is null;
create index tierlist_comments_replies on public.tierlist_comments (parent_id, created_at) where parent_id is not null;
create index tierlist_comments_author on public.tierlist_comments (author, created_at desc);

create table public.tierlist_likes (
  tierlist_id uuid not null references public.tierlists(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (tierlist_id, user_id)
);

-- Las denuncias quedan aunque se borre la tierlist: guardan su nombre (o el texto del comentario) y de quién era.
create table public.tierlist_reports (
  id          uuid primary key default gen_random_uuid(),
  tierlist_id uuid references public.tierlists(id) on delete set null,
  comment_id  uuid references public.tierlist_comments(id) on delete set null,
  target      text not null check (target in ('tierlist', 'comment')),
  snapshot    text not null check (char_length(snapshot) <= 300),
  author      uuid references public.players(id) on delete set null,
  reporter    uuid not null references auth.users(id) on delete cascade,
  reason      text not null check (reason in ('toxic', 'spam', 'harassment', 'other')),
  note        text check (char_length(note) <= 300),
  created_at  timestamptz not null default now(),
  status      text not null default 'open' check (status in ('open', 'dismissed', 'removed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz
);
comment on table public.tierlist_reports is 'Denuncias de tierlists y de sus comentarios: las revisan soporte, moderadores y admins (replanteo 137)';
create unique index tierlist_reports_once_list on public.tierlist_reports (tierlist_id, reporter) where target = 'tierlist';
create unique index tierlist_reports_once_comment on public.tierlist_reports (comment_id, reporter) where target = 'comment';
create index tierlist_reports_status on public.tierlist_reports (status, created_at desc);
create index tierlist_reports_reporter on public.tierlist_reports (reporter, created_at desc);

alter table public.tierlists enable row level security;
alter table public.tierlist_tiers enable row level security;
alter table public.tierlist_items enable row level security;
alter table public.tierlist_comments enable row level security;
alter table public.tierlist_likes enable row level security;
alter table public.tierlist_reports enable row level security;
revoke all on public.tierlists, public.tierlist_tiers, public.tierlist_items, public.tierlist_comments,
  public.tierlist_likes, public.tierlist_reports from anon, authenticated;

-- ---------- 2. Ayudas ----------

/** La ficha de la cuenta que llama; corta si no hay sesión o no tiene ficha. */
create function public.tierlist_me_player(p_what text) returns uuid
  language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  if auth.uid() is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  select id into v from players where user_id = auth.uid();
  if v is null then raise exception 'Necesitas tu ficha de jugador para %', p_what using errcode = '42501'; end if;
  return v;
end $$;

/** La tierlist o un 404. */
create function public.tierlist_row(p_id uuid) returns tierlists
  language plpgsql stable security definer set search_path = public as $$
declare t tierlists;
begin
  select * into t from tierlists where id = p_id;
  if t.id is null then raise exception 'Esa tierlist no existe' using errcode = 'P0002'; end if;
  return t;
end $$;

/** Corta con un 400 si el texto (nombre de tierlist, tier o ítem) está vacío, es largo o tiene una palabra bloqueada. */
create function public.tierlist_check_text(p_text text, p_what text) returns text
  language plpgsql stable security definer set search_path = public as $$
declare v text := btrim(coalesce(p_text, ''));
begin
  if char_length(v) = 0 then raise exception '% está vacío', p_what using errcode = 'P0001'; end if;
  if char_length(v) > 40 then raise exception '% tiene más de 40 caracteres', p_what using errcode = 'P0001'; end if;
  if comment_blocked_word(v) is not null then
    raise exception '% tiene una palabra que no está permitida (%)', p_what, comment_blocked_word(v) using errcode = 'P0001';
  end if;
  return v;
end $$;

create function public.tierlist_author_json(p_player uuid) returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object('player_id', p.id, 'nick', p.nick, 'photo_url', mm_player_photo(p.id),
                            'level', elo_level(mm_player_elo(p.id)), 'verified', p.verified)
    from players p where p.id = p_player $$;

/** Un ítem como lo ve la web: kind player, team o external, con nombre e imagen al día. */
create function public.tierlist_item_json(i tierlist_items) returns jsonb
  language sql stable security definer set search_path = public as $$
  select case
    when i.ref_player is not null then
      (select jsonb_build_object('kind', 'player', 'id', p.id, 'name', p.nick, 'tag', null, 'image_url', mm_player_photo(p.id))
         from players p where p.id = i.ref_player)
    when i.ref_team is not null then
      (select jsonb_build_object('kind', 'team', 'id', t.id, 'name', t.name, 'tag', t.tag, 'image_url', t.logo_url)
         from teams t where t.id = i.ref_team)
    else jsonb_build_object('kind', 'external', 'id', null, 'name', i.external_name, 'tag', null, 'image_url', null)
  end $$;

-- ---------- 3. Leer ----------

/** Las tierlists de una ficha: la destacada primero y después la última editada. También sin sesión. */
create function public.tierlists_of(p_player uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); v_owner uuid;
begin
  select user_id into v_owner from players where id = p_player;
  if not found then raise exception 'Ese jugador no existe' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'is_owner', me is not null and v_owner = me,
    'limit', 10,
    'count', (select count(*) from tierlists where owner = me),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', t.id, 'name', t.name, 'kind', t.kind, 'featured', t.featured, 'updated_at', t.updated_at,
                'likes', (select count(*) from tierlist_likes l where l.tierlist_id = t.id),
                'comments', case when t.comments_open then (select count(*) from tierlist_comments c
                                                             where c.tierlist_id = t.id and c.deleted_at is null) else 0 end,
                'items', (select count(*) from tierlist_items i where i.tierlist_id = t.id))
              order by t.featured desc, t.updated_at desc), '[]')
                from tierlists t where t.player_id = p_player));
end $$;

/** Una tierlist completa, con sus tiers, el banco y lo que puede hacer quien mira. También sin sesión. */
create function public.tierlist_get(p_id uuid) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t tierlists := tierlist_row(p_id);
  v_signed boolean := me is not null and exists (select 1 from players where user_id = me);
  v_restriction text := profile_social_blocked(me, t.player_id);
  v_mine boolean := me is not null and t.owner = me;
begin
  return jsonb_build_object(
    'id', t.id, 'name', t.name, 'kind', t.kind, 'featured', t.featured, 'comments_open', t.comments_open,
    'created_at', t.created_at, 'updated_at', t.updated_at,
    'owner', tierlist_author_json(t.player_id),
    'copied_from', (select jsonb_build_object('id', o.id, 'name', o.name, 'nick', p.nick)
                      from tierlists o join players p on p.id = o.player_id where o.id = t.copied_from),
    'likes', (select count(*) from tierlist_likes where tierlist_id = t.id),
    'liked', exists (select 1 from tierlist_likes where tierlist_id = t.id and user_id = me),
    'is_owner', v_mine,
    'can_like', v_signed and not v_mine and v_restriction is null,
    'can_copy', v_signed and not v_mine and (select count(*) from tierlists where owner = me) < 10,
    'can_comment', t.comments_open and v_signed and v_restriction is null,
    'can_report', me is not null and not v_mine,
    'restriction', v_restriction,
    'tiers', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', r.id, 'label', r.label,
                'items', (select coalesce(jsonb_agg(tierlist_item_json(i) order by i.position), '[]')
                            from tierlist_items i where i.tier_id = r.id))
              order by r.position), '[]')
                from tierlist_tiers r where r.tierlist_id = t.id),
    'bank', (select coalesce(jsonb_agg(tierlist_item_json(i) order by i.position), '[]')
               from tierlist_items i where i.tierlist_id = t.id and i.tier_id is null));
end $$;

/**
 * Los comentarios (20 por página, los más nuevos primero) con todas sus respuestas (las más viejas primero). Un
 * comentario borrado que tiene respuestas se ve sin texto ni autor (deleted = true). Cerrados, la lista viene vacía.
 * total: comentarios y respuestas visibles; threads: los comentarios que se paginan (para "Ver más").
 */
create function public.tierlist_comments_list(p_id uuid, p_before timestamptz default null) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); t tierlists := tierlist_row(p_id); v_mod boolean := me is not null and coalesce(is_support(), false);
begin
  if not t.comments_open then return jsonb_build_object('total', 0, 'threads', 0, 'items', '[]'::jsonb); end if;
  return jsonb_build_object(
    'total', (select count(*) from tierlist_comments where tierlist_id = t.id and deleted_at is null),
    -- Los que se paginan: los comentarios (no las respuestas) que se ven, también los borrados con respuestas.
    'threads', (select count(*) from tierlist_comments c where c.tierlist_id = t.id and c.parent_id is null
                  and (c.deleted_at is null
                       or exists (select 1 from tierlist_comments r where r.parent_id = c.id and r.deleted_at is null))),
    'items', (
      select coalesce(jsonb_agg(x.j order by x.created_at desc), '[]') from (
        select c.created_at, tierlist_comment_json(c, t.owner, v_mod) || jsonb_build_object(
                 'replies', (select coalesce(jsonb_agg(tierlist_comment_json(r, t.owner, v_mod) order by r.created_at), '[]')
                               from tierlist_comments r where r.parent_id = c.id and r.deleted_at is null)) j
          from tierlist_comments c
         where c.tierlist_id = t.id and c.parent_id is null and (p_before is null or c.created_at < p_before)
           and (c.deleted_at is null
                or exists (select 1 from tierlist_comments r where r.parent_id = c.id and r.deleted_at is null))
         order by c.created_at desc limit 20) x));
end $$;

create function public.tierlist_comment_json(c tierlist_comments, p_owner uuid, p_mod boolean) returns jsonb
  language sql stable security definer set search_path = public as $$
  select case when c.deleted_at is not null then
    jsonb_build_object('id', c.id, 'deleted', true, 'body', null, 'created_at', c.created_at, 'author', null,
                       'mine', false, 'can_report', false, 'can_delete', false)
  else
    jsonb_build_object('id', c.id, 'deleted', false, 'body', c.body, 'created_at', c.created_at,
                       'author', (select tierlist_author_json(p.id) from players p where p.user_id = c.author),
                       'mine', c.author = auth.uid(),
                       'can_report', auth.uid() is not null and c.author <> auth.uid(),
                       'can_delete', auth.uid() is not null and (c.author = auth.uid() or p_owner = auth.uid() or p_mod))
  end $$;

-- ---------- 4. Crear, guardar, borrar, destacar, copiar ----------

/** Crea una tierlist con los tiers S, A, B, C y D y el top del ranking en el banco. Devuelve su id. Hasta 10 por cuenta. */
create function public.tierlist_create(p_name text, p_kind text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare v_player uuid := tierlist_me_player('armar una tierlist'); v_name text := tierlist_check_text(p_name, 'El nombre'); v_id uuid;
begin
  if p_kind is null or p_kind not in ('players', 'teams') then raise exception 'El tipo es players o teams' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('tierlists:' || auth.uid()::text));
  if (select count(*) from tierlists where owner = auth.uid()) >= 10 then
    raise exception 'Llegaste al tope de 10 tierlists: borra una para armar otra' using errcode = 'P0001';
  end if;
  insert into tierlists (owner, player_id, name, kind) values (auth.uid(), v_player, v_name, p_kind) returning id into v_id;
  insert into tierlist_tiers (tierlist_id, label, position)
  select v_id, l, n - 1 from unnest(array['S', 'A', 'B', 'C', 'D']) with ordinality u(l, n);
  -- En el banco, para arrancar: las 30 primeras fichas del ranking (por ELO) o los 10 primeros equipos (posición oficial).
  if p_kind = 'players' then
    insert into tierlist_items (tierlist_id, tier_id, position, ref_player)
    select v_id, null, (row_number() over (order by o.elo desc, o.id) - 1)::int, o.id
      from (select id, elo from player_overview where elo is not null order by elo desc, id limit 30) o;
  else
    insert into tierlist_items (tierlist_id, tier_id, position, ref_team)
    select v_id, null, (row_number() over (order by r.official_position, r.team_id) - 1)::int, r.team_id
      from (select r.team_id, r.official_position from team_ranking r join teams t on t.id = r.team_id
             where t.kind <> 'pcw' and r.official_position is not null order by r.official_position, r.team_id limit 10) r;
  end if;
  return v_id;
end $$;

/**
 * Guarda la tierlist entera (solo el dueño): p_data = {"name", "tiers": [{"label", "items": [ítem]}], "bank": [ítem]},
 * con cada ítem {"player": id}, {"team": id} o {"name": texto}. Reemplaza los tiers y los ítems que tenía.
 */
create function public.tierlist_save(p_id uuid, p_data jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare
  t tierlists := tierlist_row(p_id);
  v_name text;
  v_tiers jsonb := coalesce(p_data->'tiers', '[]');
  v_bank jsonb := coalesce(p_data->'bank', '[]');
  v_total int;
  v_tier jsonb;
  v_tier_id uuid;
  n int := 0;
begin
  if auth.uid() is null or t.owner <> auth.uid() then raise exception 'Solo el dueño puede editar esta tierlist' using errcode = '42501'; end if;
  if jsonb_typeof(v_tiers) <> 'array' or jsonb_typeof(v_bank) <> 'array' then
    raise exception 'tiers y bank tienen que ser listas' using errcode = 'P0001';
  end if;
  v_name := tierlist_check_text(p_data->>'name', 'El nombre');
  if jsonb_array_length(v_tiers) not between 1 and 10 then raise exception 'Una tierlist tiene de 1 a 10 tiers' using errcode = 'P0001'; end if;
  select jsonb_array_length(v_bank) + coalesce(sum(jsonb_array_length(coalesce(x->'items', '[]'))), 0)::int into v_total
    from jsonb_array_elements(v_tiers) x;
  if v_total > 100 then raise exception 'Una tierlist tiene hasta 100 ítems' using errcode = 'P0001'; end if;

  delete from tierlist_tiers where tierlist_id = t.id;
  delete from tierlist_items where tierlist_id = t.id;
  update tierlists set name = v_name, updated_at = now() where id = t.id;

  for v_tier in select * from jsonb_array_elements(v_tiers) loop
    insert into tierlist_tiers (tierlist_id, label, position)
    values (t.id, tierlist_check_text(v_tier->>'label', 'El nombre de un tier'), n) returning id into v_tier_id;
    perform tierlist_insert_items(t, v_tier_id, coalesce(v_tier->'items', '[]'));
    n := n + 1;
  end loop;
  perform tierlist_insert_items(t, null, v_bank);
end $$;

create function public.tierlist_insert_items(t tierlists, p_tier uuid, p_items jsonb) returns void
  language plpgsql security definer set search_path = public as $$
declare it jsonb; n int := 0; v_ref uuid;
begin
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Los ítems tienen que ser una lista' using errcode = 'P0001'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if it ? 'name' then
      insert into tierlist_items (tierlist_id, tier_id, position, external_name)
      values (t.id, p_tier, n, tierlist_check_text(it->>'name', 'El nombre de un ítem'));
    elsif t.kind = 'players' and it ? 'player' then
      v_ref := (it->>'player')::uuid;
      if not exists (select 1 from players where id = v_ref) then raise exception 'Uno de los jugadores ya no existe' using errcode = 'P0001'; end if;
      if exists (select 1 from tierlist_items where tierlist_id = t.id and ref_player = v_ref) then
        raise exception 'Un jugador está dos veces' using errcode = 'P0001';
      end if;
      insert into tierlist_items (tierlist_id, tier_id, position, ref_player) values (t.id, p_tier, n, v_ref);
    elsif t.kind = 'teams' and it ? 'team' then
      v_ref := (it->>'team')::uuid;
      if not exists (select 1 from teams where id = v_ref and kind <> 'pcw') then raise exception 'Uno de los equipos ya no existe' using errcode = 'P0001'; end if;
      if exists (select 1 from tierlist_items where tierlist_id = t.id and ref_team = v_ref) then
        raise exception 'Un equipo está dos veces' using errcode = 'P0001';
      end if;
      insert into tierlist_items (tierlist_id, tier_id, position, ref_team) values (t.id, p_tier, n, v_ref);
    else
      raise exception 'Cada ítem es {"name"} o, según el tipo de la tierlist, {"player"} o {"team"}' using errcode = 'P0001';
    end if;
    n := n + 1;
  end loop;
end $$;

/** El dueño la borra, con sus comentarios y me gusta. */
create function public.tierlist_delete(p_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare t tierlists := tierlist_row(p_id);
begin
  if auth.uid() is null or t.owner <> auth.uid() then raise exception 'Solo el dueño puede borrar esta tierlist' using errcode = '42501'; end if;
  delete from tierlists where id = t.id;
end $$;

/** El dueño la destaca (y deja de estarlo la que lo era) o le saca la marca. */
create function public.tierlist_feature(p_id uuid, p_on boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare t tierlists := tierlist_row(p_id);
begin
  if auth.uid() is null or t.owner <> auth.uid() then raise exception 'Solo el dueño puede destacar esta tierlist' using errcode = '42501'; end if;
  if p_on then update tierlists set featured = false where player_id = t.player_id and featured and id <> t.id; end if;
  update tierlists set featured = coalesce(p_on, false) where id = t.id;
end $$;

/** El dueño abre o cierra los comentarios. Cerrados, no se ven ni se dejan; los me gusta siguen. */
create function public.tierlist_comments_set(p_id uuid, p_open boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare t tierlists := tierlist_row(p_id);
begin
  if auth.uid() is null or t.owner <> auth.uid() then raise exception 'Solo el dueño puede cambiar esto' using errcode = '42501'; end if;
  update tierlists set comments_open = coalesce(p_open, true) where id = t.id;
end $$;

/** Copia una tierlist ajena con sus tiers e ítems. Devuelve el id de la copia. */
create function public.tierlist_copy(p_id uuid) returns uuid
  language plpgsql security definer set search_path = public as $$
declare v_player uuid := tierlist_me_player('copiar una tierlist'); t tierlists := tierlist_row(p_id); v_id uuid; r tierlist_tiers; v_tier uuid;
begin
  if t.owner = auth.uid() then raise exception 'Esa tierlist ya es tuya' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('tierlists:' || auth.uid()::text));
  if (select count(*) from tierlists where owner = auth.uid()) >= 10 then
    raise exception 'Llegaste al tope de 10 tierlists: borra una para copiar otra' using errcode = 'P0001';
  end if;
  insert into tierlists (owner, player_id, name, kind, copied_from)
  values (auth.uid(), v_player, left(t.name, 32) || ' (copia)', t.kind, t.id) returning id into v_id;
  for r in select * from tierlist_tiers where tierlist_id = t.id order by position loop
    insert into tierlist_tiers (tierlist_id, label, position) values (v_id, r.label, r.position) returning id into v_tier;
    insert into tierlist_items (tierlist_id, tier_id, position, ref_player, ref_team, external_name)
    select v_id, v_tier, position, ref_player, ref_team, external_name from tierlist_items where tier_id = r.id;
  end loop;
  insert into tierlist_items (tierlist_id, tier_id, position, ref_player, ref_team, external_name)
  select v_id, null, position, ref_player, ref_team, external_name from tierlist_items where tierlist_id = t.id and tier_id is null;
  return v_id;
end $$;

-- ---------- 5. Me gusta ----------

create function public.tierlist_like(p_id uuid, p_on boolean) returns void
  language plpgsql security definer set search_path = public as $$
declare v_player uuid := tierlist_me_player('dar me gusta'); t tierlists := tierlist_row(p_id);
begin
  if t.owner = auth.uid() then raise exception 'No puedes darle me gusta a tu propia tierlist' using errcode = 'P0001'; end if;
  perform profile_social_check(auth.uid(), t.player_id);
  if not coalesce(p_on, false) then
    delete from tierlist_likes where tierlist_id = t.id and user_id = auth.uid();
    return;
  end if;
  insert into tierlist_likes (tierlist_id, user_id) values (t.id, auth.uid()) on conflict do nothing;
  -- Una vez por cuenta y tierlist: el ref queda aunque el dueño borre el aviso.
  if not exists (select 1 from notifications where ref = 'tierlist_like:' || t.id || ':' || auth.uid()) then
    perform notify(array[t.owner], 'tierlist_like',
      jsonb_build_object('player', player_ref(v_player), 'tierlist', jsonb_build_object('id', t.id, 'name', t.name)),
      'tierlist_like:' || t.id || ':' || auth.uid());
  end if;
end $$;

-- ---------- 6. Comentarios ----------

/** Comenta una tierlist o responde un comentario (p_parent). No se responde una respuesta. Devuelve el id. */
create function public.tierlist_comment_add(p_id uuid, p_body text, p_parent uuid default null) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  v_player uuid := tierlist_me_player('comentar');
  t tierlists := tierlist_row(p_id);
  v_body text := btrim(coalesce(p_body, ''));
  p tierlist_comments;
  v_id uuid;
begin
  if not t.comments_open then raise exception 'Esta tierlist no acepta comentarios' using errcode = '42501'; end if;
  perform profile_social_check(me, t.player_id);
  if char_length(v_body) = 0 then raise exception 'El comentario está vacío' using errcode = 'P0001'; end if;
  if char_length(v_body) > 280 then raise exception 'El comentario tiene más de 280 caracteres' using errcode = 'P0001'; end if;
  if comment_blocked_word(v_body) is not null then
    raise exception 'El comentario tiene una palabra que no está permitida (%)', comment_blocked_word(v_body) using errcode = 'P0001';
  end if;
  if p_parent is not null then
    select * into p from tierlist_comments where id = p_parent and tierlist_id = t.id and deleted_at is null;
    if p.id is null then raise exception 'Ese comentario no existe' using errcode = 'P0002'; end if;
    if p.parent_id is not null then raise exception 'No se puede responder una respuesta' using errcode = 'P0001'; end if;
  end if;
  if exists (select 1 from tierlist_comments where author = me and created_at > now() - interval '30 seconds') then
    raise exception 'Espera unos segundos antes de comentar de nuevo' using errcode = 'P0001';
  end if;
  if (select count(*) from tierlist_comments where author = me
        and (created_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date) >= 30 then
    raise exception 'Llegaste al tope de 30 comentarios por día' using errcode = 'P0001';
  end if;
  insert into tierlist_comments (tierlist_id, parent_id, author, body) values (t.id, p_parent, me, v_body) returning id into v_id;
  -- Comentario: al dueño. Respuesta: al autor del comentario. notify no avisa a uno mismo.
  perform notify(array[case when p_parent is null then t.owner else p.author end],
    case when p_parent is null then 'tierlist_comment' else 'tierlist_reply' end,
    jsonb_build_object('player', player_ref(v_player), 'tierlist', jsonb_build_object('id', t.id, 'name', t.name),
                       'comment', left(v_body, 100)),
    'tierlist_comment:' || v_id);
  return v_id;
end $$;

/** El autor, el dueño de la tierlist, soporte, moderadores y admins. */
create function public.tierlist_comment_delete(p_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c tierlist_comments; v_owner uuid;
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  select * into c from tierlist_comments where id = p_id and deleted_at is null;
  if c.id is null then raise exception 'Ese comentario no existe' using errcode = 'P0002'; end if;
  select owner into v_owner from tierlists where id = c.tierlist_id;
  if not (c.author = me or v_owner = me or coalesce(is_support(), false)) then
    raise exception 'No puedes borrar ese comentario' using errcode = '42501';
  end if;
  update tierlist_comments set deleted_at = now(), deleted_by = me where id = p_id;
  if c.author <> me and v_owner <> me then
    perform support_log('tierlist_comment_delete', jsonb_build_object('comment_id', c.id, 'tierlist_id', c.tierlist_id,
                        'player_id', (select player_id from tierlists where id = c.tierlist_id), 'body', left(c.body, 300)));
  end if;
end $$;

-- ---------- 7. Denuncias ----------

/** Denuncia una tierlist ajena (p_comment null) o un comentario ajeno de ella: una vez por cuenta, 20 por día. */
create function public.tierlist_report(p_id uuid, p_comment uuid, p_reason text, p_note text default null) returns uuid
  language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  t tierlists := tierlist_row(p_id);
  c tierlist_comments;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id uuid;
begin
  if me is null then raise exception 'Tienes que iniciar sesión' using errcode = '42501'; end if;
  if p_reason is null or p_reason not in ('toxic', 'spam', 'harassment', 'other') then
    raise exception 'El motivo es toxic, spam, harassment u other' using errcode = 'P0001';
  end if;
  if char_length(v_note) > 300 then raise exception 'La nota tiene más de 300 caracteres' using errcode = 'P0001'; end if;
  if (select count(*) from tierlist_reports where reporter = me
        and (created_at at time zone 'America/Bogota')::date = (now() at time zone 'America/Bogota')::date) >= 20 then
    raise exception 'Llegaste al tope de 20 denuncias por día' using errcode = 'P0001';
  end if;
  if p_comment is null then
    if t.owner = me then raise exception 'No puedes denunciar tu propia tierlist' using errcode = 'P0001'; end if;
    if exists (select 1 from tierlist_reports where target = 'tierlist' and tierlist_id = t.id and reporter = me) then
      raise exception 'Ya denunciaste esa tierlist' using errcode = 'P0001';
    end if;
    insert into tierlist_reports (tierlist_id, target, snapshot, author, reporter, reason, note)
    values (t.id, 'tierlist', t.name, t.player_id, me, p_reason, v_note) returning id into v_id;
  else
    select * into c from tierlist_comments where id = p_comment and tierlist_id = t.id and deleted_at is null;
    if c.id is null then raise exception 'Ese comentario no existe' using errcode = 'P0002'; end if;
    if c.author = me then raise exception 'No puedes denunciar tu propio comentario' using errcode = 'P0001'; end if;
    if exists (select 1 from tierlist_reports where target = 'comment' and comment_id = c.id and reporter = me) then
      raise exception 'Ya denunciaste ese comentario' using errcode = 'P0001';
    end if;
    insert into tierlist_reports (tierlist_id, comment_id, target, snapshot, author, reporter, reason, note)
    values (t.id, c.id, 'comment', c.body, (select id from players where user_id = c.author),
            me, p_reason, v_note) returning id into v_id;
  end if;
  return v_id;
end $$;

/** Las denuncias, para soporte, moderadores y admins. Mismos filtros que profile_comment_reports_admin. */
create function public.tierlist_reports_admin(p_status text default 'open', p_reason text default null,
                                              p_order text default 'desc', p_limit integer default 20, p_offset integer default 0)
  returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(is_support(), false) then raise exception 'Solo soporte, moderadores y admins' using errcode = '42501'; end if;
  if p_status is not null and p_status not in ('open', 'resolved') then raise exception 'El estado es open o resolved' using errcode = 'P0001'; end if;
  if p_order not in ('asc', 'desc') then raise exception 'El orden es asc o desc' using errcode = 'P0001'; end if;
  return (
    with f as (
      select r.* from tierlist_reports r
       where (p_status is null or (p_status = 'open' and r.status = 'open') or (p_status = 'resolved' and r.status <> 'open'))
         and (p_reason is null or r.reason = p_reason)),
    pg as (
      select row_number() over (order by case when p_order = 'asc' then r.created_at end asc,
                                         case when p_order = 'desc' then r.created_at end desc, r.id) as n,
             jsonb_build_object(
               'id', r.id, 'target', r.target, 'reason', r.reason, 'note', r.note, 'created_at', r.created_at, 'status', r.status,
               'resolved_at', r.resolved_at, 'resolved_by', (select player_ref(p.id) from players p where p.user_id = r.resolved_by limit 1),
               'reporter', (select player_ref(p.id) from players p where p.user_id = r.reporter limit 1),
               'reports', (select count(*) from tierlist_reports o where o.target = r.target
                             and (case when r.target = 'comment' then o.comment_id = r.comment_id else o.tierlist_id = r.tierlist_id end)),
               'tierlist_id', r.tierlist_id,
               'tierlist_name', (select name from tierlists where id = r.tierlist_id),
               'text', r.snapshot,
               'removed', case when r.target = 'comment'
                               then coalesce((select deleted_at is not null from tierlist_comments where id = r.comment_id), true)
                               else r.tierlist_id is null end,
               'author', player_ref(r.author)) as j
        from f r
       order by n
       limit least(greatest(coalesce(p_limit, 20), 1), 100) offset greatest(coalesce(p_offset, 0), 0))
    select jsonb_build_object('total', (select count(*) from f),
                              'items', coalesce((select jsonb_agg(j order by n) from pg), '[]'::jsonb)));
end $$;

/** 'dismiss' la descarta; 'delete' borra el comentario o la tierlist. Cierra las abiertas de lo mismo. */
create function public.tierlist_report_resolve(p_report uuid, p_action text) returns void
  language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r tierlist_reports;
begin
  if not coalesce(is_support(), false) then raise exception 'Solo soporte, moderadores y admins' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('dismiss', 'delete') then raise exception 'La acción es dismiss o delete' using errcode = 'P0001'; end if;
  select * into r from tierlist_reports where id = p_report for update;
  if r.id is null then raise exception 'Esa denuncia no existe' using errcode = 'P0002'; end if;
  if r.status <> 'open' then raise exception 'Esa denuncia ya se resolvió' using errcode = 'P0001'; end if;
  update tierlist_reports set status = case when p_action = 'delete' then 'removed' else 'dismissed' end,
         resolved_by = me, resolved_at = now()
   where status = 'open' and target = r.target
     and (case when r.target = 'comment' then comment_id = r.comment_id else tierlist_id = r.tierlist_id end);
  if p_action = 'delete' then
    if r.target = 'comment' then
      update tierlist_comments set deleted_at = now(), deleted_by = me where id = r.comment_id and deleted_at is null;
    else
      delete from tierlists where id = r.tierlist_id;
    end if;
  end if;
  perform support_log('tierlist_report', jsonb_build_object('report_id', r.id, 'target', r.target, 'decision', p_action,
                      'tierlist_id', r.tierlist_id, 'comment_id', r.comment_id, 'player_id', r.author, 'body', r.snapshot));
end $$;

-- ---------- Permisos ----------

revoke all on function public.tierlist_me_player(text), public.tierlist_row(uuid), public.tierlist_check_text(text, text),
  public.tierlist_author_json(uuid), public.tierlist_item_json(tierlist_items),
  public.tierlist_comment_json(tierlist_comments, uuid, boolean), public.tierlist_insert_items(tierlists, uuid, jsonb),
  public.tierlists_of(uuid), public.tierlist_get(uuid), public.tierlist_comments_list(uuid, timestamptz),
  public.tierlist_create(text, text), public.tierlist_save(uuid, jsonb), public.tierlist_delete(uuid),
  public.tierlist_feature(uuid, boolean), public.tierlist_comments_set(uuid, boolean), public.tierlist_copy(uuid),
  public.tierlist_like(uuid, boolean), public.tierlist_comment_add(uuid, text, uuid), public.tierlist_comment_delete(uuid),
  public.tierlist_report(uuid, uuid, text, text), public.tierlist_reports_admin(text, text, text, integer, integer),
  public.tierlist_report_resolve(uuid, text) from public, anon, authenticated;
grant execute on function public.tierlists_of(uuid), public.tierlist_get(uuid), public.tierlist_comments_list(uuid, timestamptz)
  to anon, authenticated;
grant execute on function public.tierlist_create(text, text), public.tierlist_save(uuid, jsonb), public.tierlist_delete(uuid),
  public.tierlist_feature(uuid, boolean), public.tierlist_comments_set(uuid, boolean), public.tierlist_copy(uuid),
  public.tierlist_like(uuid, boolean), public.tierlist_comment_add(uuid, text, uuid), public.tierlist_comment_delete(uuid),
  public.tierlist_report(uuid, uuid, text, text), public.tierlist_reports_admin(text, text, text, integer, integer),
  public.tierlist_report_resolve(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
