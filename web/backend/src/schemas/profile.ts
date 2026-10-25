import { z } from '@hono/zod-openapi';
import { AuthUser, Tag } from './auth';
import { NotificationPrefs, NotificationPrefsPatch } from './notifications';

// Las mismas listas y reglas que el formulario "Mi perfil" de index.html.
export const COUNTRIES = [
  'Argentina', 'Bolivia', 'Brasil', 'Chile', 'Colombia', 'Costa Rica', 'Cuba', 'Ecuador', 'El Salvador', 'España',
  'Estados Unidos', 'Guatemala', 'Honduras', 'México', 'Nicaragua', 'Panamá', 'Paraguay', 'Perú', 'Puerto Rico',
  'República Dominicana', 'Uruguay', 'Venezuela', 'Otro',
] as const;
export const GAME_ROLES = ['AWPer', 'Rifler', 'IGL', 'Support', 'Entry fragger', 'Lurker', 'Otro'] as const;

const STEAM64 = /^(7656119\d{10}|765612\d{11})$/;
const NICK = /^[A-Za-z0-9_\-]{2,32}$/;

/** Steam: SteamID64, STEAM_X:Y:Z, link de perfil (se pasa a https) o nombre de perfil. null si no sirve. */
export function cleanSteam(v: string): string | null {
  if (/^https?:\/\/steamcommunity\.com\/(id|profiles)\/[A-Za-z0-9_\-]+\/?$/i.test(v)) return v.replace(/^http:/i, 'https:');
  if (STEAM64.test(v) || /^STEAM_[0-5]:[01]:\d+$/i.test(v) || NICK.test(v)) return v;
  return null;
}

/** FACEIT: nickname o link de faceit.com (se pasa a https). null si no sirve. */
export function cleanFaceit(v: string): string | null {
  if (/^https?:\/\/(www\.)?faceit\.com\/\S*$/i.test(v)) return v.replace(/^http:/i, 'https:');
  return NICK.test(v) ? v : null;
}

/**
 * Campo de texto opcional: undefined = no se toca, null o "" = se borra, texto = se normaliza y valida.
 * `clean` devuelve el valor a guardar o null si no es válido.
 */
const text = (max: number, clean: (v: string) => string | null, message: string, example: string) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v, ctx) => {
      if (v === undefined || v === null || v === '') return v === undefined ? undefined : null;
      const out = clean(v);
      if (out === null) {
        ctx.addIssue({ code: 'custom', message });
        return z.NEVER;
      }
      return out;
    })
    .openapi({ type: ['string', 'null'], example, description: '`null` o `""` lo borra' });

const fromList = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal(''), z.null()])
    .optional()
    .transform((v) => (v === '' ? null : v));

// Preferencias de la cuenta (tabla user_preferences): solo las ve y las cambia el propio usuario.
export const THEME_FX = ['full', 'silent', 'off'] as const;
const themeFx = z.enum(THEME_FX).nullable().openapi({
  description: 'Efectos al cambiar de tema: `full` (con sonido), `silent` (sin sonido), `off` (desactivados) o `null` (todavía no eligió)',
});
export const Preferences = z
  .object({ theme_fx: themeFx, notifications: NotificationPrefs })
  .openapi('Preferences');
export const PreferencesPatch = z
  .object({ theme_fx: themeFx.optional(), notifications: NotificationPrefsPatch.optional() })
  .strict()
  .openapi('PreferencesPatch', { description: 'Solo se cambian las claves enviadas; `null` borra una' });

export const ProfilePatch = z
  .object({
    tag: Tag.optional(),
    real_name: text(60, (v) => (/^[\p{L}\p{M}' .\-]{1,60}$/u.test(v) ? v : null), 'Solo letras, espacios, punto, apóstrofe y guion.', 'Juan Pérez'),
    country: fromList(COUNTRIES).openapi({ description: 'Uno de la lista, o `null` para borrarlo' }),
    game_role: fromList(GAME_ROLES).openapi({ description: 'Uno de la lista, o `null` para borrarlo' }),
    steam: text(120, cleanSteam, 'Usa tu SteamID64 (17 dígitos), el link de tu perfil o tu nombre de perfil.', '76561198000000000'),
    faceit: text(120, cleanFaceit, 'Usa tu nickname de FACEIT o el link de tu perfil.', 'mecha'),
    discord: text(40, (v) => (/^[A-Za-z0-9_.#\-]{2,40}$/.test(v) ? v : null), 'Usa tu nombre de usuario de Discord, sin espacios.', 'mecha_css'),
    preferences: PreferencesPatch.optional(),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), { message: 'No hay nada para actualizar.' })
  .openapi('ProfilePatch');

export const ProfileDetails = z
  .object({
    avatar_url: z.string().nullable(),
    real_name: z.string().nullable(),
    country: z.string().nullable(),
    game_role: z.string().nullable(),
    steam: z.string().nullable(),
    faceit: z.string().nullable(),
    discord: z.string().nullable(),
    joined_at: z.string().nullable(),
    last_seen: z.string().nullable(),
    updated_at: z.string().nullable(),
  })
  .openapi('ProfileDetails');

export const MyProfile = z
  .object({
    user: AuthUser,
    details: ProfileDetails,
    player: z
      .object({
        id: z.uuid(),
        nick: z.string(),
        photo_url: z.string().nullable(),
        steam_id: z.string().nullable().openapi({ description: 'El SteamID principal. Todos los de la cuenta están en `GET /api/v1/me/claim-code` (`steam_ids`)' }),
      })
      .nullable()
      .openapi({ description: 'Ficha de jugador de la cuenta. Se crea o se vincula con `!claim` en el servidor; null si todavía no lo usó' }),
    teams: z
      .array(
        z.object({
          id: z.uuid(),
          name: z.string(),
          tag: z.string().nullable(),
          is_captain: z.boolean(),
          is_member: z.boolean().openapi({ description: 'false si solo es dueño o capitán sin estar en el plantel' }),
        }),
      )
      .openapi({ description: 'Equipos oficiales donde juega hoy el jugador vinculado, o que capitanea o creó (puede ser más de uno)' }),
    matches_played: z.number().int().openapi({ description: 'Partidas terminadas que jugó en el servidor (mixes, PCW y torneos)' }),
    preferences: Preferences.openapi({ description: 'Preferencias de la cuenta: siempre con todas sus claves (`null` si no eligió)' }),
  })
  .openapi('MyProfile');

export const AvatarResult = z.object({ avatar_url: z.string() }).openapi('AvatarResult');

export const AvatarUpload = z
  .object({
    file: z
      .custom<File>((v) => typeof File !== 'undefined' && v instanceof File, { message: 'Falta el archivo (campo "file").' })
      .openapi({ type: 'string', format: 'binary', description: 'JPEG, PNG o WebP, máximo 1 MB. Conviene recortarla a 256×256 antes de subirla.' }),
  })
  .openapi('AvatarUpload');
