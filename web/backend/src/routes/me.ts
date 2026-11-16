import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requireUser } from '../lib/auth';
import { sortByPrimary } from '../lib/db';
import { inBackground } from '../lib/background';
import { AppError, fromPostgrest, type PostgrestLikeError } from '../lib/errors';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { AVATAR_MAX_BYTES, readImage, storageError } from '../lib/uploads';
import { bearer, errorResponses, json } from '../schemas/common';
import {
  AvatarResult,
  AvatarUpload,
  MyProfile,
  ProfilePatch,
  THEME_FX,
} from '../schemas/profile';
import { profileOf, roleOf } from '../services/account';
import { streamersOf } from '../services/hud';
import { vipStatusOf } from '../services/vip';
import { notificationPrefsOf } from '../schemas/notifications';

type C = Context<AppEnv>;
type Res = { data: unknown; error: PostgrestLikeError | null };
const must = <R extends Res>(r: R): R['data'] => {
  if (r.error) throw fromPostgrest(r.error);
  return r.data;
};
// Listados e inserts con .select(): sin error, siempre hay datos.
const mustHave = <R extends Res>(r: R): NonNullable<R['data']> => {
  const d = must(r);
  if (d === null || d === undefined) throw new AppError(500, 'INTERNAL', 'Supabase no devolvió datos.');
  return d as NonNullable<R['data']>;
};

const DETAILS = 'avatar_url, cover_url, real_name, country, game_role, steam, faceit, discord, joined_at, last_seen, updated_at';
const EMPTY_DETAILS = {
  avatar_url: null, cover_url: null, real_name: null, country: null, game_role: null, steam: null,
  faceit: null, discord: null, joined_at: null, last_seen: null, updated_at: null,
};

// ---------- lógica ----------

/** theme_fx guardado, o null si no hay o no es un valor conocido. */
const themeFxOf = (prefs: unknown) => {
  const v = (prefs as { theme_fx?: unknown } | null | undefined)?.theme_fx;
  return THEME_FX.find((x) => x === v) ?? null;
};

/** Lo mismo que mostraba rProfileView() en la web. */
async function loadMyProfile(c: C): Promise<z.infer<typeof MyProfile>> {
  const { sb, user, config } = c.var;
  const [account, details, ficha, prefs, vip, streamer, teamConfig] = await Promise.all([
    profileOf(config, user.token, user.id),
    sb.from('profile_details').select(DETAILS).eq('user_id', user.id).maybeSingle().then(must),
    sb.from('players').select('id, nick, photo_url, steam_id, bio, primary_team_id').eq('user_id', user.id).limit(1).maybeSingle().then(must),
    sb.from('user_preferences').select('preferences').eq('user_id', user.id).maybeSingle().then(must),
    vipStatusOf(sb, [user.id]),
    streamersOf(sb, [user.id]).then((m) => m.get(user.id)),
    sb.from('team_config').select('max_led').eq('id', 1).maybeSingle().then(must),
  ]);

  const { primary_team_id: primaryId = null, ...player } = ficha ?? {};

  // Equipos oficiales (no PCW) donde juega hoy el jugador vinculado, más los que capitanea o de los que es dueño.
  // Orden (replanteo 124): los suyos con el principal primero y después por fecha de ingreso; al final, por nombre,
  // los que capitanea o creó sin estar en el plantel.
  const memberRows = ficha
    ? mustHave(await sb.from('team_members').select('team_id, joined_at').eq('player_id', ficha.id).is('left_at', null))
    : [];
  const memberOf = memberRows.map((r) => r.team_id);
  const filter = [`captain_id.eq.${user.id}`, `owner_id.eq.${user.id}`, ...(memberOf.length ? [`id.in.(${memberOf.join(',')})`] : [])];
  const found = mustHave(
    await sb.from('teams').select('id, name, tag, captain_id').eq('kind', 'official').is('dissolved_at', null).or(filter.join(',')).order('name'),
  );
  const mine = sortByPrimary(
    found.flatMap((t) => {
      const m = memberRows.find((r) => r.team_id === t.id);
      return m ? [{ ...t, team_id: t.id, team_name: t.name, joined_at: m.joined_at }] : [];
    }),
    primaryId,
  );
  const teams = [...mine, ...found.filter((t) => !memberOf.includes(t.id))].map((t, i) => ({
    id: t.id,
    name: t.name,
    tag: t.tag,
    is_captain: t.captain_id === user.id,
    is_member: memberOf.includes(t.id),
    is_primary: i === 0 && memberOf.includes(t.id),
  }));

  // Partidas jugadas: las de la vista player_matches (mixes, PCW y torneos terminados).
  let matches_played = 0;
  if (ficha) {
    const { count, error } = await sb.from('player_matches').select('match_id', { count: 'exact', head: true }).eq('player_id', ficha.id);
    if (error) throw fromPostgrest(error);
    matches_played = count ?? 0;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      tag: account?.tag ?? null,
      role: roleOf(account?.role),
      created_at: details?.joined_at ?? null,
      password_changed_at: account?.password_changed_at ?? null,
    },
    details: details ?? EMPTY_DETAILS,
    player: ficha ? (player as Omit<typeof ficha, 'primary_team_id'>) : null,
    teams,
    matches_played,
    // El mismo conteo que teams_lead_limit (replanteo 40): oficiales, no disueltos, donde es capitán.
    team_lead: { led: teams.filter((t) => t.is_captain).length, max: teamConfig?.max_led ?? 1 },
    preferences: { theme_fx: themeFxOf(prefs?.preferences), notifications: notificationPrefsOf(prefs?.preferences) },
    vip: vip.get(user.id) ?? null,
    streamer: streamer?.active
      ? { since: streamer.granted_at!, has_link: !!streamer.has_link, link_created_at: streamer.token_created_at }
      : null,
  };
}

// ---------- rutas ----------

const getProfile = createRoute({
  method: 'get',
  path: '/api/v1/me/profile',
  tags: ['Mi perfil'],
  summary: 'Mi perfil',
  description: 'Datos de la cuenta, detalles del perfil, jugador vinculado, equipos oficiales actuales y partidas jugadas.',
  security: bearer,
  middleware: [requireUser] as const,
  responses: { 200: { description: 'Perfil', ...json(MyProfile) }, ...errorResponses(401) },
});

const patchProfile = createRoute({
  method: 'patch',
  path: '/api/v1/me/profile',
  tags: ['Mi perfil'],
  summary: 'Editar mi perfil',
  description:
    'Solo se cambian los campos enviados. `null` o `""` borra un campo. `tag` es el alias y sigue las reglas de ' +
    '`PUT /api/v1/me/alias` (único, sin palabras bloqueadas, una vez cada 15 días): conviene usar esa ruta. `bio` va en la ficha ' +
    'del jugador: sin jugador vinculado, `409 CONFLICT`.',
  security: bearer,
  middleware: [requireUser] as const,
  request: { body: { required: true, ...json(ProfilePatch) } },
  responses: { 200: { description: 'Perfil actualizado', ...json(MyProfile) }, ...errorResponses(400, 401, 409) },
});

const uploadAvatar = createRoute({
  method: 'post',
  path: '/api/v1/me/avatar',
  tags: ['Mi perfil'],
  summary: 'Subir mi avatar',
  description:
    '`multipart/form-data` con el campo `file`. JPEG, PNG o WebP de hasta 1 MB (el tipo se detecta por el contenido). ' +
    'Reemplaza al avatar anterior.',
  security: bearer,
  middleware: [
    requireUser,
    // Corta antes de leer todo el cuerpo: 1 MB de imagen más el margen del multipart.
    bodyLimit({
      maxSize: AVATAR_MAX_BYTES + 16 * 1024,
      onError: () => {
        throw new AppError(413, 'FILE_TOO_LARGE', 'La imagen pesa más de 1024 KB.');
      },
    }),
  ] as const,
  request: { body: { required: true, content: { 'multipart/form-data': { schema: AvatarUpload } } } },
  responses: {
    200: { description: 'Avatar actualizado', ...json(AvatarResult) },
    ...errorResponses(400, 401, 413),
  },
});

export const me = createRouter()
  .openapi(getProfile, async (c) => c.json(await loadMyProfile(c), 200))
  .openapi(patchProfile, async (c) => {
    const { sb, user, config } = c.var;
    const { tag, preferences, bio, ...fields } = c.req.valid('json');

    if (tag !== undefined && tag !== (await profileOf(config, user.token, user.id))?.tag) {
      must(await sb.rpc('set_my_tag', { p_tag: tag }));
    }
    // (E12) null borra la biografía (los tipos generados no admiten null en los argumentos).
    if (bio !== undefined) must(await sb.rpc('set_my_bio', { p_bio: bio as string }));
    const changes = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (Object.keys(changes).length) {
      must(
        await sb.from('profile_details').upsert({ user_id: user.id, ...changes, updated_at: new Date().toISOString() }),
      );
    }
    if (preferences !== undefined) {
      const { notifications, ...rest } = preferences;
      const changes: Record<string, unknown> = { ...rest };
      // set_my_preferences une solo el primer nivel: las categorías se unen acá con las que ya había.
      if (notifications !== undefined) {
        const saved = must(await sb.from('user_preferences').select('preferences').eq('user_id', user.id).maybeSingle());
        const prev = (saved?.preferences as { notifications?: Record<string, boolean> } | null)?.notifications ?? {};
        changes.notifications = { ...prev, ...Object.fromEntries(Object.entries(notifications).filter(([, v]) => v !== undefined)) };
      }
      must(await sb.rpc('set_my_preferences', { p_changes: changes as never }));
    }
    return c.json(await loadMyProfile(c), 200);
  })
  .openapi(uploadAvatar, async (c) => {
    const { sb, user } = c.var;
    const { bytes, type } = await readImage(c.req.valid('form').file, AVATAR_MAX_BYTES);

    const previous = must(await sb.from('profile_details').select('avatar_url').eq('user_id', user.id).maybeSingle())?.avatar_url;
    const bucket = sb.storage.from('avatars');
    // La política de Storage solo deja escribir en la carpeta <uid>/ del propio usuario.
    const path = `${user.id}/${Date.now()}.${type.ext}`;
    const up = await bucket.upload(path, bytes, { contentType: type.mime, upsert: false });
    if (up.error) throw storageError(up.error);

    const avatar_url = bucket.getPublicUrl(path).data.publicUrl;
    const saved = await sb
      .from('profile_details')
      .upsert({ user_id: user.id, avatar_url, updated_at: new Date().toISOString() });
    if (saved.error) {
      await bucket.remove([path]);
      throw fromPostgrest(saved.error);
    }

    // El avatar anterior ya no se usa: se borra sin demorar la respuesta (solo si es de su carpeta).
    const marker = `/storage/v1/object/public/avatars/${user.id}/`;
    if (previous?.includes(marker)) {
      const oldPath = decodeURIComponent(previous.slice(previous.indexOf(marker) + '/storage/v1/object/public/avatars/'.length));
      inBackground(
        c,
        bucket.remove([oldPath]).then((r) => {
          if (r.error) throw new Error(`borrar avatar anterior: ${r.error.message}`);
        }),
      );
    }
    return c.json({ avatar_url }, 200);
  });
