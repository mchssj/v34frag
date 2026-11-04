import { describe, expect, it } from 'vitest';
import { toMixItem } from '../../src/routes/mixes';
import { eloLevel, toTv } from '../../src/services/live';
import { likeExact } from '../../src/services/players';
import { tvAddress } from '../../src/services/servers';

// Lógica pura de los mixes, el SourceTV y el perfil por nick (plan docs/bitacora/2026-10-24-api-mixes-perfil-ranking).

describe('SourceTV', () => {
  it('dirección: el host del servidor con el puerto de SourceTV', () => {
    expect(tvAddress('10.0.0.1:27015', 27020)).toBe('10.0.0.1:27020');
    expect(tvAddress('connect 10.0.0.1:27015', 27020)).toBe('10.0.0.1:27020');
    expect(tvAddress('10.0.0.1:27015', null)).toBeNull();
    expect(tvAddress(null, 27020)).toBeNull();
    expect(tvAddress('no es una dirección', 27020)).toBeNull();
  });

  it('toTv: los dos o nada', () => {
    expect(toTv('10.0.0.1', 27020)).toEqual({ host: '10.0.0.1', port: 27020 });
    expect(toTv('', 27020)).toBeNull();
    expect(toTv('10.0.0.1', null)).toBeNull();
  });
});

describe('nick exacto para ilike', () => {
  it('saca los espacios y escapa los comodines', () => {
    expect(likeExact('  Mecha ')).toBe('Mecha');
    expect(likeExact('a_b%c\\d')).toBe('a\\_b\\%c\\\\d');
  });
});

describe('toMixItem', () => {
  const base = {
    match_id: null, live_uid: 'srv1-x', status: 'live', map: 'de_nuke', server_id: '11111111-1111-4111-8111-111111111111', server_name: 'S1',
    score1: 3, score2: 2, winner_side: null, side1_name: 'A', side2_name: 'B', rounds_played: 5, current_round: 6, max_rounds: 24,
    started_at: 'x', ended_at: null, cancel_reason: null, demo_status: 'none', stale: false, mvp_player_id: null, mvp_alias: null,
    mvp_game_nick: 'pepe', mvp_elo: 2100, mvp_rating: 1.5, tv_host: '10.0.0.1', tv_port: 27020,
  };

  it('en vivo: TV, ronda actual y MVP sin ficha con su nivel', () => {
    expect(toMixItem(base)).toMatchObject({
      status: 'live', current_round: 6, tv: { host: '10.0.0.1', port: 27020 }, server: { id: base.server_id, name: 'S1' },
      mvp: { player_id: null, alias: null, game_nick: 'pepe', elo: 2100, level: 10, rating: 1.5 },
    });
  });

  it('terminado: sin TV aunque el servidor la tenga; sin jugadores, sin MVP; sin servidor, null', () => {
    const r = toMixItem({ ...base, status: 'finished', live_uid: null, match_id: '22222222-2222-4222-8222-222222222222', mvp_game_nick: null, mvp_elo: null, server_id: null, demo_status: null });
    expect(r.tv).toBeNull();
    expect(r.mvp).toBeNull();
    expect(r.server).toBeNull();
    expect(r.demo_status).toBe('none');
  });

  it('review: el de match_list en un interrumpido; null en vivo y sin revisión', () => {
    const cancelled = { ...base, status: 'cancelled', live_uid: null, match_id: '22222222-2222-4222-8222-222222222222' };
    expect(toMixItem(cancelled, 'pending').review).toBe('pending');
    expect(toMixItem(cancelled, 'applied').review).toBe('applied');
    expect(toMixItem(cancelled).review).toBeNull();
    expect(toMixItem(base, 'pending').review).toBeNull();
  });
});

describe('eloLevel', () => {
  const elos = new Map([['76561198000000001', 1360], ['76561198000000002', 400]]);
  it('ELO actual y su nivel; sin fila o sin SteamID (bots, NOSTEAM), null', () => {
    expect(eloLevel(elos, '76561198000000001')).toEqual({ elo: 1360, level: 7 });
    expect(eloLevel(elos, '76561198000000002')).toEqual({ elo: 400, level: 1 });
    expect(eloLevel(elos, 'BOT')).toEqual({ elo: null, level: null });
    expect(eloLevel(elos, null)).toEqual({ elo: null, level: null });
    expect(eloLevel(elos, undefined)).toEqual({ elo: null, level: null });
  });
});

describe('clutchesOf (replanteo 29)', () => {
  it('las cinco claves siempre, sumando por cantidad de rivales e ignorando valores raros', async () => {
    const { clutchesOf } = await import('../../src/services/matches');
    expect(clutchesOf([])).toEqual({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 });
    expect(
      clutchesOf([
        { vs: 1, won: 2 },
        { vs: 3, won: 1 },
        { vs: 1, won: 1 },
        { vs: 6, won: 9 },
        { vs: null, won: 4 },
        { vs: 2, won: null },
      ]),
    ).toEqual({ '1': 3, '2': 0, '3': 1, '4': 0, '5': 0 });
  });
});
