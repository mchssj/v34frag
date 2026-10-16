import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requireUser } from '../lib/auth';
import { inBackground } from '../lib/background';
import { AppError, fromPostgrest, type PostgrestLikeError } from '../lib/errors';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { AVATAR_MAX_BYTES, readImage, storageError } from '../lib/uploads';
import { bearer, errorResponses, json } from '../schemas/common';
import { Envelope, envelope, listQuery, runList } from '../lib/list';
import {
  AvatarResult,
  AvatarUpload,
  MyProfile,
  ProfilePatch,
  ProfileRequest,
  ProfileRequestBody,
} from '../schemas/profile';
import { profileOf, roleOf } from '../services/account';

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

const DETAILS = 'avatar_url, real_name, country, game_role, steam, faceit, discord, joined_at, last_seen, updated_at';
const EMPTY_DETAILS = {
  avatar_url: null, real_name: null, country: null, game_role: null, steam: null,
  faceit: null, discord: null, joined_at: null, last_seen: null, updated_at: null,
};

// ---------- lógica ----------

/** Lo mismo que mostraba rProfileView() en la web. */
async function loadMyProfile(c: C): Promise<z.infer<typeof MyProfile>> {
  const { sb, user, config } = c.var;
  const [account, details, player] = await Promise.all([
    profileOf(config, user.token, user.id),
    sb.from('profile_details').select(DETAILS).eq('user_id', user.id).maybeSingle().then(must),
    sb.from('players').select('id, nick, photo_url, steam_id').eq('user_id', user.id).limit(1).maybeSingle().then(must),
  ]);

  // Equipos oficiales (no PCW) donde juega hoy el jugador vinculado, más los que capitanea o de los que es dueño.
  const memberOf = player
    ? mustHave(await sb.from('team_members').select('team_id').eq('player_id', player.id).is('left_at', null)).map((r) => r.team_id)
    : [];
  const filter = [`captain_id.eq.${user.id}`, `owner_id.eq.${user.id}`, ...(memberOf.length ? [`id.in.(${memberOf.join(',')})`] : [])];
  const teams = mustHave(
    await sb.from('teams').select('id, name, tag, captain_id').eq('kind', 'official').or(filter.join(',')).order('name'),
  ).map((t) => ({ id: t.id, name: t.name, tag: t.tag, is_captain: t.captain_id === user.id, is_member: memberOf.includes(t.id) }));

  // Partidas jugadas: las de la vista player_matches (mixes, PCW y torneos terminados).
  let matches_played = 0;
  if (player) {
    const { count, error } = await sb.from('player_matches').select('match_id', { count: 'exact', head: true }).eq('player_id', player.id);
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
    },
    details: details ?? EMPTY_DETAILS,
    player,
    teams,
    matches_played,
  };
}

const MyClaimQuery = listQuery(['created_at'], { sort: 'created_at', order: 'desc' }).extend({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

const REQUEST_FIELDS = 'id, player_id, status, created_at, player:players(id, nick)';

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
    '`PUT /api/v1/me/alias` (único, sin palabras bloqueadas, una vez cada 15 días): conviene usar esa ruta.',
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

const listRequests = createRoute({
  method: 'get',
  path: '/api/v1/me/profile-requests',
  tags: ['Mi perfil'],
  summary: 'Mis solicitudes de reclamo de perfil',
  description:
    'Solicitudes de reclamo de perfil del usuario. **Deprecado:** el reclamo de perfil va a pasar al juego ' +
    '(`!claim <código>`); sigue funcionando hasta entonces.',
  deprecated: true,
  security: bearer,
  middleware: [requireUser] as const,
  request: { query: MyClaimQuery },
  responses: { 200: { description: 'Solicitudes', ...json(Envelope(ProfileRequest).openapi('ProfileRequestList')) }, ...errorResponses(400, 401) },
});

const createRequest = createRoute({
  method: 'post',
  path: '/api/v1/me/profile-requests',
  tags: ['Mi perfil'],
  summary: 'Reclamar un perfil de jugador',
  description:
    'Pide que un admin vincule el jugador a tu cuenta. El jugador no puede tener cuenta vinculada. ' +
    '**Deprecado:** el reclamo de perfil va a pasar al juego (`!claim <código>`); sigue funcionando hasta entonces.',
  deprecated: true,
  security: bearer,
  middleware: [requireUser] as const,
  request: { body: { required: true, ...json(ProfileRequestBody) } },
  responses: {
    201: { description: 'Solicitud creada (pendiente)', ...json(ProfileRequest) },
    ...errorResponses(400, 401, 404, 409),
  },
});

export const me = createRouter()
  .openapi(getProfile, async (c) => c.json(await loadMyProfile(c), 200))
  .openapi(patchProfile, async (c) => {
    const { sb, user, config } = c.var;
    const { tag, ...fields } = c.req.valid('json');

    if (tag !== undefined && tag !== (await profileOf(config, user.token, user.id))?.tag) {
      must(await sb.rpc('set_my_tag', { p_tag: tag }));
    }
    const changes = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
    if (Object.keys(changes).length) {
      must(
        await sb.from('profile_details').upsert({ user_id: user.id, ...changes, updated_at: new Date().toISOString() }),
      );
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
  })
  .openapi(listRequests, async (c) => {
    const p = c.req.valid('query');
    const { sb, user } = c.var;
    let q = sb.from('profile_requests').select(REQUEST_FIELDS, { count: 'exact' }).eq('user_id', user.id);
    if (p.status) q = q.eq('status', p.status);
    const { rows, total } = await runList<z.infer<typeof ProfileRequest>, typeof q>(q, p, {});
    return c.json(envelope(rows, total, p), 200);
  })
  .openapi(createRequest, async (c) => {
    const { sb, user } = c.var;
    const { player_id } = c.req.valid('json');

    const player = must(await sb.from('players').select('id, user_id').eq('id', player_id).maybeSingle());
    if (!player) throw new AppError(404, 'NOT_FOUND', 'Ese jugador no existe.');
    if (player.user_id) {
      throw new AppError(409, 'CONFLICT', player.user_id === user.id ? 'Ese jugador ya está vinculado a tu cuenta.' : 'Ese jugador ya fue reclamado por otra cuenta.');
    }
    const pending = mustHave(
      await sb.from('profile_requests').select('id').eq('user_id', user.id).eq('player_id', player_id).eq('status', 'pending').limit(1),
    );
    if (pending.length) throw new AppError(409, 'CONFLICT', 'Ya tienes una solicitud pendiente para ese jugador.');

    const row = mustHave(
      await sb.from('profile_requests').insert({ player_id, user_id: user.id, status: 'pending' }).select(REQUEST_FIELDS).single(),
    );
    return c.json(row, 201);
  });

