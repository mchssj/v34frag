import { z } from '@hono/zod-openapi';

const email = z.email().max(254).openapi({ example: 'jugador@example.com' });

export const Tag = z
  .string()
  .trim()
  .min(2)
  .max(24)
  .openapi({ description: 'Alias: el nombre en la web. Único sin distinguir mayúsculas, 2 a 24 caracteres', example: 'Mecha' });

export const SignupBody = z
  .object({
    email,
    password: z.string().min(6).max(72).openapi({ example: 'una-clave-larga' }),
    tag: Tag,
  })
  .openapi('SignupBody');

export const LoginBody = z
  .object({
    email,
    password: z.string().min(1).max(72),
  })
  .openapi('LoginBody');

export const PasswordChangeBody = z
  .object({
    current_password: z.string().min(1).max(72),
    new_password: z.string().min(6).max(72).openapi({ description: 'Las mismas reglas del registro: de 6 a 72 caracteres' }),
  })
  .openapi('PasswordChangeBody');

export const RefreshBody = z
  .object({ refresh_token: z.string().min(1).max(512) })
  .openapi('RefreshBody');

export const AuthUser = z
  .object({
    id: z.uuid(),
    email: z.string().nullable(),
    tag: z.string().nullable(),
    role: z
      .enum(['user', 'organizer', 'moderator', 'admin'])
      .openapi({ description: 'Todos juegan. `organizer` crea y gestiona sus torneos; `moderator` banea; `admin`, todo' }),
    created_at: z.string().nullable().openapi({ description: 'Fecha de registro de la cuenta' }),
    password_changed_at: z.string().nullable().openapi({ description: 'Último cambio de contraseña; null si no la cambió desde que se guarda la fecha (2026-10-19)' }),
  })
  .openapi('AuthUser');

export const Session = z
  .object({
    access_token: z.string().openapi({ description: 'Va en `Authorization: Bearer`. Dura 1 hora.' }),
    refresh_token: z.string().openapi({ description: 'Se canjea en `POST /auth/refresh` por una sesión nueva. Es de un solo uso.' }),
    expires_at: z.number().int().openapi({ description: 'Vencimiento del access_token (segundos Unix)' }),
    user: AuthUser,
  })
  .openapi('Session');

export const SignupResult = z
  .object({
    session: Session.nullable().openapi({ description: 'null si hay que confirmar el email antes de entrar' }),
    needsConfirmation: z.boolean(),
  })
  .openapi('SignupResult');

export type AuthUserT = z.infer<typeof AuthUser>;
export type SessionT = z.infer<typeof Session>;
