import { createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { optionalUser, requireUser } from '../lib/auth';
import { must, mustHave, notFound } from '../lib/db';
import { AppError } from '../lib/errors';
import { createRouter } from '../lib/router';
import type { AppEnv } from '../lib/types';
import { bearer, errorResponses, json } from '../schemas/common';
import { EventParam } from '../schemas/events';
import {
  PIN_AWARDS,
  AwardCandidateList,
  AwardParam,
  AwardPick,
  EventClipList,
  EventPins,
  FeaturedMedals,
  FeaturedMedalsBody,
  PlayerShowcase,
  ShowcaseBody,
  TeamPinList,
  ShowcaseItem,
  type Award,
  type PinsConfig,
  type PinsConfigInput,
  type TeamPin,
} from '../schemas/pins';
import { IdParam } from '../schemas/players';
import { resolvePlayer } from '../services/players';

// Pines y trofeos de torneo, premios individuales y vitrina del jugador (replanteo 123).

type C = Context<AppEnv>;
type Db = C['var']['sb'];

const PIN_COLS = 'id, event_id, event_name, team_id, team_name, team_tag, team_logo_url, tier, place, year, awarded_at, style, metal';
const AWARD_COLS =
  'id, event_id, event_name, award, player_id, nick, team_id, team_name, team_tag, team_logo_url, value, manual, clip_id, awarded_at, year, style';

type PinRow = {
  id: string; event_id: string; event_name: string; team_id: string; team_name: string; team_tag: string | null;
  team_logo_url: string | null; tier: string; place: number; year: number; awarded_at: string; style: string; metal: string;
};
type AwardRow = {
  id: string; event_id: string; event_name: string; award: string; player_id: string; nick: string; team_id: string | null;
  team_name: string | null; team_tag: string | null; team_logo_url: string | null; value: number | string | null; manual: boolean;
  clip_id: string | null; awarded_at: string; year: number; style: string;
};

const toPin = (r: PinRow): z.infer<typeof TeamPin> => ({
  id: r.id,
  event: { id: r.event_id, name: r.event_name },
  team: { id: r.team_id, name: r.team_name, tag: r.team_tag, logo_url: r.team_logo_url },
  tier: r.tier as z.infer<typeof TeamPin>['tier'],
  place: r.place,
  year: r.year,
  style: r.style as z.infer<typeof TeamPin>['style'],
  metal: r.metal as z.infer<typeof TeamPin>['metal'],
  awarded_at: r.awarded_at,
});

const toAward = (r: AwardRow): z.infer<typeof Award> => ({
  id: r.id,
  event: { id: r.event_id, name: r.event_name },
  award: r.award as z.infer<typeof Award>['award'],
  player: { id: r.player_id, nick: r.nick },
  team: r.team_id && r.team_name ? { id: r.team_id, name: r.team_name, tag: r.team_tag, logo_url: r.team_logo_url } : null,
  value: r.value === null ? null : Number(r.value),
  manual: r.manual,
  clip_id: r.clip_id,
  year: r.year,
  style: r.style as z.infer<typeof Award>['style'],
  awarded_at: r.awarded_at,
});

// Orden de los premios en el podio: el MVP primero.
const awardOrder = (a: string) => PIN_AWARDS.indexOf(a as (typeof PIN_AWARDS)[number]);

// ---------- rutas ----------

const eventPins = createRoute({
  method: 'get', path: '/api/v1/events/{id}/pins', tags: ['Torneos'], middleware: [optionalUser] as const,
  summary: 'Pines y premios de un torneo',
  description: 'La configuración (efectiva y lo que cambió el torneo), los pines por puesto, los premios individuales y los que esperan que el organizador los elija.',
  request: { params: EventParam },
  responses: { 200: { description: 'Pines', ...json(EventPins) }, ...errorResponses(400, 404) },
});

const candidates = createRoute({
  method: 'get', path: '/api/v1/events/{id}/awards/{award}/candidates', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Candidatos para elegir un premio a mano',
  description: 'Todo el plantel inscrito: primero los 10 mejores por la cifra del premio (`suggested`), después el resto. Solo el organizador del torneo o un admin.',
  request: { params: AwardParam },
  responses: { 200: { description: 'Candidatos', ...json(AwardCandidateList) }, ...errorResponses(400, 401, 403, 404) },
});

const pick = createRoute({
  method: 'put', path: '/api/v1/events/{id}/awards/{award}', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Elegir el ganador de un premio',
  description: 'Pisa al automático y se mantiene en los recálculos. La jugada del torneo se elige con un clip de sus partidas.',
  request: { params: AwardParam, body: { required: true, ...json(AwardPick) } },
  responses: { 204: { description: 'Elegido' }, ...errorResponses(400, 401, 403, 404) },
});

const unpick = createRoute({
  method: 'delete', path: '/api/v1/events/{id}/awards/{award}', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Borrar la elección de un premio',
  description: 'Vuelve al automático o, en modo "lo elijo yo", queda pendiente.',
  request: { params: AwardParam },
  responses: { 204: { description: 'Borrada' }, ...errorResponses(400, 401, 403, 404) },
});

const eventClips = createRoute({
  method: 'get', path: '/api/v1/events/{id}/clips', tags: ['Torneos'], security: bearer, middleware: [requireUser] as const,
  summary: 'Clips de un torneo',
  description: 'Los clips listos de los mixes vinculados a sus partidas, para elegir la jugada del torneo. Solo el organizador del torneo o un admin.',
  request: { params: EventParam },
  responses: { 200: { description: 'Clips', ...json(EventClipList) }, ...errorResponses(400, 401, 403) },
});

const showcase = createRoute({
  method: 'get', path: '/api/v1/players/{id}/showcase', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Vitrina de un jugador',
  description: 'Los destacados del Resumen (hasta 6) y todos sus pines y premios.',
  request: { params: IdParam },
  responses: { 200: { description: 'Vitrina', ...json(PlayerShowcase) }, ...errorResponses(400, 404) },
});

const putShowcase = createRoute({
  method: 'put', path: '/api/v1/me/showcase', tags: ['Cuenta'], security: bearer, middleware: [requireUser] as const,
  summary: 'Elegir los destacados de mi vitrina',
  description: '`auto`: se eligen solos (los mejores puestos y los más recientes). `manual`: hasta 6 pines o premios propios, en orden.',
  request: { body: { required: true, ...json(ShowcaseBody) } },
  responses: { 204: { description: 'Guardada' }, ...errorResponses(400, 401, 403) },
});

const featuredMedals = createRoute({
  method: 'get', path: '/api/v1/players/{id}/medals/featured', tags: ['Jugadores'], middleware: [optionalUser] as const,
  summary: 'Logros destacados del Resumen',
  description: 'Cómo se eligen (`auto` o `manual`) y, en `manual`, cuáles, en orden.',
  request: { params: IdParam },
  responses: { 200: { description: 'Logros destacados', ...json(FeaturedMedals) }, ...errorResponses(400, 404) },
});

const putFeaturedMedals = createRoute({
  method: 'put', path: '/api/v1/me/medals/featured', tags: ['Cuenta'], security: bearer, middleware: [requireUser] as const,
  summary: 'Elegir los logros del Resumen',
  description: '`auto`: los de más veces conseguidos. `manual`: hasta 10 logros propios, en orden.',
  request: { body: { required: true, ...json(FeaturedMedalsBody) } },
  responses: { 204: { description: 'Guardados' }, ...errorResponses(400, 401, 403) },
});

const teamPins = createRoute({
  method: 'get', path: '/api/v1/teams/{id}/pins', tags: ['Equipos'], middleware: [optionalUser] as const,
  summary: 'Vitrina de un equipo',
  description: 'Sus pines de torneo: primero los mejores puestos, después los más recientes.',
  request: { params: EventParam },
  responses: { 200: { description: 'Pines', ...json(TeamPinList) }, ...errorResponses(400) },
});

async function playerPinsAndAwards(sb: Db, playerId: string) {
  const [pins, awards] = await Promise.all([
    sb.from('player_pin_list').select(PIN_COLS).eq('player_id', playerId).order('awarded_at', { ascending: false }).then(mustHave),
    sb.from('player_award_list').select(AWARD_COLS).eq('player_id', playerId).order('awarded_at', { ascending: false }).then(mustHave),
  ]);
  return { pins: (pins as unknown as PinRow[]).map(toPin), awards: (awards as unknown as AwardRow[]).map(toAward) };
}

export const pins = createRouter()
  .openapi(eventPins, async (c) => {
    const { id } = c.req.valid('param');
    const sb = c.var.sb;
    const ev = must(await sb.from('events').select('id, status, pins').eq('id', id).maybeSingle());
    if (!ev) throw notFound('ese torneo');
    const [config, results, awards, calc] = await Promise.all([
      sb.rpc('pins_config', { p: ev.pins as never }).then(mustHave),
      sb.from('team_pin_list').select(PIN_COLS).eq('event_id', id).order('place').then(mustHave),
      sb.from('player_award_list').select(AWARD_COLS).eq('event_id', id).then(mustHave),
      Promise.all(PIN_AWARDS.map((a) => sb.rpc('event_award_calculable', { p_event: id, p_award: a }).then(mustHave))),
    ]);
    const cfg = config as unknown as z.infer<typeof PinsConfig>;
    const list = (awards as unknown as AwardRow[]).map(toAward).sort((a, b) => awardOrder(a.award) - awardOrder(b.award));
    const given = new Set(list.map((a) => a.award));
    const pending =
      ev.status === 'finished' && cfg.enabled
        ? PIN_AWARDS.filter((a) => cfg.awards[a]?.on && !given.has(a) && (cfg.awards[a]?.mode === 'pick' || !calc[PIN_AWARDS.indexOf(a)]))
        : [];
    return c.json(
      {
        config: cfg,
        custom: (ev.pins ?? null) as z.infer<typeof PinsConfigInput> | null,
        results: (results as unknown as PinRow[]).map(toPin),
        awards: list,
        pending,
        calculable: Object.fromEntries(PIN_AWARDS.map((a, i) => [a, !!calc[i]])) as Record<(typeof PIN_AWARDS)[number], boolean>,
      },
      200,
    );
  })
  .openapi(candidates, async (c) => {
    const { id, award } = c.req.valid('param');
    const sb = c.var.sb;
    type Row = { player_id: string; team_id: string | null; value: number | string | null; kills: number | null; adr: number | string | null;
                 rating: number | string | null; maps: number | null; suggested: boolean };
    const rows = mustHave(await sb.rpc('event_award_candidates', { p_event: id, p_award: award })) as unknown as Row[];
    const [players, teams] = await Promise.all([
      rows.length ? sb.from('players').select('id, nick').in('id', rows.map((r) => r.player_id)).then(mustHave) : [],
      rows.length
        ? sb.from('teams').select('id, name, tag, logo_url').in('id', [...new Set(rows.map((r) => r.team_id).filter((t): t is string => !!t))]).then(mustHave)
        : [],
    ]);
    const nick = new Map((players as { id: string; nick: string }[]).map((p) => [p.id, p.nick]));
    const team = new Map((teams as { id: string; name: string; tag: string | null; logo_url: string | null }[]).map((t) => [t.id, t]));
    const num = (v: number | string | null) => (v === null ? null : Number(v));
    return c.json(
      {
        items: rows.map((r) => ({
          player: { id: r.player_id, nick: nick.get(r.player_id) ?? '?' },
          team: r.team_id ? (team.get(r.team_id) ?? null) : null,
          value: num(r.value),
          kills: r.kills === null ? null : Number(r.kills),
          adr: num(r.adr),
          rating: num(r.rating),
          maps: r.maps === null ? null : Number(r.maps),
          suggested: r.suggested,
        })),
      },
      200,
    );
  })
  .openapi(pick, async (c) => {
    const { id, award } = c.req.valid('param');
    const body = c.req.valid('json');
    if ((award === 'play') !== !!body.clip_id) {
      throw new AppError(400, 'VALIDATION_ERROR', award === 'play' ? 'La jugada del torneo se elige con un clip.' : 'Este premio se elige con un jugador.');
    }
    must(await c.var.sb.rpc('event_award_pick', { p_event: id, p_award: award, p_player: (body.player_id ?? null) as never, p_clip: (body.clip_id ?? null) as never }));
    return c.body(null, 204);
  })
  .openapi(unpick, async (c) => {
    const { id, award } = c.req.valid('param');
    must(await c.var.sb.rpc('event_award_clear', { p_event: id, p_award: award }));
    return c.body(null, 204);
  })
  .openapi(eventClips, async (c) => {
    const { id } = c.req.valid('param');
    const sb = c.var.sb;
    if (!must(await sb.rpc('can_manage_event', { p_event: id }))) {
      throw new AppError(403, 'FORBIDDEN', 'Solo el organizador del torneo o un admin.');
    }
    const parents = (mustHave(await sb.from('matches').select('id').eq('event_id', id)) as { id: string }[]).map((m) => m.id);
    const games = parents.length
      ? (mustHave(await sb.from('matches').select('id').in('parent_match_id', parents).eq('parent_approved', true)) as { id: string }[]).map((m) => m.id)
      : [];
    type Row = { id: string; match_id: string; player_id: string | null; player_name: string | null; type: string | null; round: number | null;
                 kills: number | null; clutch_vs: number | null };
    const rows = games.length
      ? (mustHave(
          await sb.from('match_clip_list').select('id, match_id, player_id, player_name, type, round, kills, clutch_vs')
            .in('match_id', games).eq('video_status', 'done').order('priority', { ascending: false }).limit(200),
        ) as unknown as Row[])
      : [];
    return c.json(
      {
        items: rows.map((r) => ({
          id: r.id, match_id: r.match_id, player: { id: r.player_id, name: r.player_name ?? '?' }, type: r.type, round: r.round,
          kills: r.kills, clutch_vs: r.clutch_vs,
        })),
      },
      200,
    );
  })
  .openapi(showcase, async (c) => {
    const sb = c.var.sb;
    const id = await resolvePlayer(sb, c.req.valid('param').id);
    const [all, shown, prefs] = await Promise.all([
      playerPinsAndAwards(sb, id),
      sb.from('player_showcase_shown').select('kind, ref_id, pos').eq('player_id', id).order('pos').then(mustHave),
      sb.from('player_showcase_prefs').select('mode').eq('player_id', id).maybeSingle().then(must),
    ]);
    const pinById = new Map(all.pins.map((p) => [p.id, p]));
    const awardById = new Map(all.awards.map((a) => [a.id, a]));
    const featured: z.infer<typeof ShowcaseItem>[] = [];
    for (const s of shown as { kind: string; ref_id: string }[]) {
      const pin = s.kind === 'pin' ? pinById.get(s.ref_id) : undefined;
      const award = s.kind === 'award' ? awardById.get(s.ref_id) : undefined;
      if (pin) featured.push({ kind: 'pin', pin });
      else if (award) featured.push({ kind: 'award', award });
    }
    return c.json({ mode: (prefs?.mode ?? 'auto') as 'auto' | 'manual', featured, pins: all.pins, awards: all.awards }, 200);
  })
  .openapi(putShowcase, async (c) => {
    const { mode, items } = c.req.valid('json');
    must(await c.var.sb.rpc('player_showcase_set', { p_mode: mode, p_items: items as never }));
    return c.body(null, 204);
  })
  .openapi(featuredMedals, async (c) => {
    const sb = c.var.sb;
    const id = await resolvePlayer(sb, c.req.valid('param').id);
    const [prefs, rows] = await Promise.all([
      sb.from('player_showcase_prefs').select('medals_mode').eq('player_id', id).maybeSingle().then(must),
      sb.from('player_medal_featured').select('definition_id, title, rank').eq('player_id', id).order('position').then(mustHave),
    ]);
    const mode = (prefs?.medals_mode ?? 'auto') as 'auto' | 'manual';
    return c.json({ mode, items: mode === 'manual' ? (rows as { definition_id: string; title: string; rank: number | null }[]) : [] }, 200);
  })
  .openapi(putFeaturedMedals, async (c) => {
    const { mode, items } = c.req.valid('json');
    must(await c.var.sb.rpc('player_medals_featured_set', { p_mode: mode, p_items: items as never }));
    return c.body(null, 204);
  })
  .openapi(teamPins, async (c) => {
    const { id } = c.req.valid('param');
    const rows = mustHave(
      await c.var.sb.from('team_pin_list').select(PIN_COLS).eq('team_id', id).order('place').order('awarded_at', { ascending: false }),
    );
    return c.json({ items: (rows as unknown as PinRow[]).map(toPin) }, 200);
  });
