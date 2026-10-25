import { describe, expect, it } from 'vitest';
import { toMixItem } from '../../src/routes/mixes';
import { toTv } from '../../src/services/live';
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
});
