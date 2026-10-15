import { createRoute, type z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { requireUser } from '../lib/auth';
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
  ProfileRequest,
  ProfileRequestBody,
} from '../schemas/profile';
import { profileOf } from '../services/account';

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

  // Equipo oficial (no PCW): donde juega hoy el jugador vinculado; si no, del que es capitán o dueño.
  const official = () => sb.from('teams').select('id, name, tag').eq('kind', 'official').limit(1);
  let team: { id: string; name: string; tag: string | null } | null = null;
  if (player) {
    const ids = mustHave(
      await sb.from('team_members').select('team_id').eq('player_id', player.id).is('left_at', null),
    ).map((r) => r.team_id);
    if (ids.length) team = must(await official().in('id', ids).maybeSingle());
  }
  team ??= must(await official().or(`captain_id.eq.${user.id},owner_id.eq.${user.id}`).maybeSingle());

  let matches_played = 0;
  if (team) {
    // Terminadas, sin byes y sin partidas huérfanas (con etapa de torneo pero sin torneo), como isOrph().
    const valid = 'or(stage.is.null,event_id.not.is.null)';
    const { count, error } = await sb
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'finished')
      .eq('bye', false)
      .or(`and(team1.eq.${team.id},${valid}),and(team2.eq.${team.id},${valid})`);
    if (error) throw fromPostgrest(error);
    matches_played = count ?? 0;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      tag: account?.tag ?? null,
      role: account?.role === 'admin' ? 'admin' : 'user',
      created_at: details?.joined_at ?? null,
    },
    details: details ?? EMPTY_DETAILS,
    player,
    team,
    matches_played,
  };
}

const REQUEST_FIELDS = 'id, player_id, status, created_at, player:players(id, nick)';

// ---------- rutas ----------

const getProfile = createRoute({
  method: 'get',
  path: '/api/v1/me/profile',
  tags: ['Mi perfil'],
  summary: 'Mi perfil',
  description: 'Datos de la cuenta, detalles del perfil, jugador vinculado, equipo actual y partidas jugadas.',
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
    'Solo se cambian los campos enviados. `null` o `""` borra un campo. El tag se cambia con `set_my_tag` ' +
    '(la misma regla que en la web: 2 a 24 caracteres).',
  security: bearer,
  middleware: [requireUser] as const,
  request: { body: { required: true, ...json(ProfilePatch) } },
  responses: { 200: { description: 'Perfil actualizado', ...json(MyProfile) }, ...errorResponses(400, 401) },
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
  responses: { 200: { description: 'Solicitudes, la más nueva primero', ...json(ProfileRequest.array()) }, ...errorResponses(401) },
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
    const { sb, user } = c.var;
    const rows = mustHave(
      await sb.from('profile_requests').select(REQUEST_FIELDS).eq('user_id', user.id).order('created_at', { ascending: false }),
    );
    return c.json(rows, 200);
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

