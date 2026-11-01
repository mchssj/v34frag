import { z } from '@hono/zod-openapi';

const Code = z.string().trim().min(1).max(128);

export const LinkBody = z
  .object({
    device_name: z.string().trim().min(1).max(64).openapi({ description: 'Nombre del equipo que ve el jugador al aprobar' }),
    agent_version: z.string().trim().max(32).optional(),
  })
  .openapi('AcLinkBody');

export const LinkStart = z
  .object({
    device_code: z.string().openapi({ description: 'Secreto del agente, para `POST /link/claim`' }),
    user_code: z.string().openapi({ description: 'Código que aprueba el jugador' }),
    verification_url: z.url().openapi({ description: 'La página que abre el agente en el navegador' }),
    expires_in: z.number().int(),
    interval: z.number().int().openapi({ description: 'Segundos entre consultas a `POST /link/claim`' }),
  })
  .openapi('AcLinkStart');

export const ClaimBody = z.object({ device_code: Code }).openapi('AcClaimBody');

export const ClaimResult = z
  .object({
    status: z.enum(['pending', 'approved', 'expired']),
    device_id: z.uuid().optional(),
    access_token: z.string().optional(),
    refresh_token: z.string().optional(),
    expires_in: z.number().int().optional(),
  })
  .openapi('AcClaimResult');

export const RefreshBody = z.object({ refresh_token: Code }).openapi('AcRefreshBody');

export const Tokens = z
  .object({ access_token: z.string(), refresh_token: z.string(), expires_in: z.number().int() })
  .openapi('AcTokens');

export const HeartbeatBody = z.object({ agent_version: z.string().trim().max(32).optional() }).openapi('AcHeartbeatBody');

export const Heartbeat = z
  .object({
    session: z
      .object({ id: z.uuid(), server_id: z.uuid(), match_uid: z.string().nullable(), started_at: z.string() })
      .nullable()
      .openapi({ description: 'La sesión abierta. Sin sesión, el agente no recopila nada.' }),
  })
  .openapi('AcHeartbeat');

export const ApproveBody = z.object({ user_code: z.string().trim().min(1).max(16) }).openapi('AcApproveBody');
export const Approved = z.object({ device_name: z.string() }).openapi('AcApproved');

export const Device = z
  .object({
    id: z.uuid(),
    name: z.string(),
    agent_version: z.string().nullable(),
    last_seen_at: z.string().nullable(),
    revoked_at: z.string().nullable(),
    created_at: z.string(),
  })
  .openapi('AcDevice');
export const DeviceList = z.object({ items: z.array(Device) }).openapi('AcDeviceList');

export const PublicStatus = z
  .object({ agent_linked: z.boolean(), sessions_30d: z.number().int(), last_session_at: z.string().nullable() })
  .openapi('AcPublicStatus');

export const SessionQuery = z.object({
  status: z.enum(['open', 'closed', 'lost']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const AdminSession = z
  .object({
    id: z.uuid(),
    player_id: z.uuid(),
    nick: z.string(),
    steam_id: z.string(),
    server_id: z.uuid(),
    server_name: z.string(),
    match_uid: z.string().nullable(),
    status: z.enum(['open', 'closed', 'lost']),
    started_at: z.string(),
    last_contact_at: z.string(),
    ended_at: z.string().nullable(),
    end_reason: z.string().nullable(),
  })
  .openapi('AcAdminSession');
export const AdminSessionList = z.object({ items: z.array(AdminSession) }).openapi('AcAdminSessionList');

export const OpenBody = z.object({ minutes: z.number().int().min(0).max(720) }).openapi('AcOpenBody');
export const OpenResult = z.object({ open_until: z.string().nullable() }).openapi('AcOpenResult');
