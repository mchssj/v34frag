"""Arma web/frontend/src/features/medals/templates.json desde los SVG de Kyan (badges/nuevas/brillo_solo_marco).

Uso: python armar_manifiesto.py <badges/nuevas> <templates.json>
Lee las paletas METAL y ACC de generar_medallas_nuevas.py y, de cada SVG, qué capas tiene, su metal y su acento.
"""
import json
import os
import re
import sys

B, OUT = sys.argv[1], sys.argv[2]
src = open(os.path.join(B, 'generar_medallas_nuevas.py'), encoding='utf-8').read()


def block(name):
    i = src.index(name + ' = {')
    depth = 0
    for j in range(i, len(src)):
        if src[j] == '{':
            depth += 1
        elif src[j] == '}':
            depth -= 1
            if depth == 0:
                return src[i + len(name) + 3:j + 1]


METAL = eval(block('METAL'))
acc = lambda light, mid, dark, face: dict(light=light, mid=mid, dark=dark, face=face)  # noqa: E731
ACC = eval(block('ACC'))
SV = os.path.join(B, 'brillo_solo_marco')


def info(path):
    s = open(os.path.join(SV, path), encoding='utf-8').read()
    stops = re.search(r'<linearGradient id="metal".*?</linearGradient>', s, re.S).group(0)
    cols = tuple(c.upper() for c in re.findall(r'stop-color="(#[0-9A-Fa-f]{6})"', stops)[:3])
    metal = next((k for k, v in METAL.items() if (v['light'], v['mid'], v['dark']) == cols), None)
    cinta = re.search(r'<g id="cinta">\s*<path[^>]*fill="(#[0-9A-Fa-f]{6})"', s)
    fil = re.search(r'id="filete-(?:acento|interior)"[^>]*stroke="(#[0-9A-Fa-f]{6})"', s)
    accent = None
    if cinta and fil:
        accent = next((k for k, v in ACC.items() if k != 'bloqueada'
                       and v['dark'].upper() == cinta.group(1).upper() and v['mid'].upper() == fil.group(1).upper()), None)
    lab = re.search(r'<g id="(?:etiqueta|temporada)">.*?<text[^>]*>([^<]*)</text>', s, re.S)
    num = re.search(r'<text id="numero"[^>]*>([^<]*)</text>', s)
    band = re.search(r'<text id="texto-banda"[^>]*>([^<]*)</text>', s)
    custom = None
    cara = re.search(r'id="cara"[^>]*fill="(#[0-9A-Fa-f]{6})"', s)
    labfill = re.search(r'<g id="etiqueta">.*?<text[^>]*fill="(#[0-9A-Fa-f]{6})"', s, re.S)
    if accent is None and cinta and fil and cara and labfill and 'filete-acento' in s:
        custom = dict(light=labfill.group(1).upper(), mid=fil.group(1).upper(), dark=cinta.group(1).upper(), face=cara.group(1).upper())
    return dict(metal=metal, metal_colors=None if metal else list(cols), accent=accent, custom=custom, label=lab.group(1) if lab else None,
                number=num.group(1) if num else None, band=band.group(1) if band else None)


SINCE = '2026-10-29'
EXTRA = {'weapon_kills', 'clutches', 'pistol_won', 'bombs_exploded', 'rounds_won_ct', 'rounds_won_t', 'eco_won', 'rounds_survived'}


def W(*ws):
    return {'weapons': list(ws)}


# id, título, categoría, forma, svg, métrica, agregación, filtros, escalones, título, número
F = [
    ('mixes_jugados', 'Mixes jugados', 'Trayectoria', 'escudo', 'mejoradas/progresion_10_mixes.svg', 'mixes_played', 'total', {}, [10, 50, 100, 250, 500, 1000], '{n} mixes jugados', '{n}'),
    ('victorias', 'Victorias', 'Trayectoria', 'escudo', 'perfil/victorias_10.svg', 'mixes_won', 'total', {}, [10, 50, 100, 250, 500], '{n} victorias', '{n}'),
    ('racha', 'Racha de victorias', 'Trayectoria', 'escudo', 'perfil/racha_5.svg', 'win_streak', 'streak', {}, [5, 10, 15], 'Racha de {n} victorias', '{n}'),
    ('kills', 'Kills totales', 'Trayectoria', 'escudo', 'nuevas/perfil/kills_1000.svg', 'kills', 'total', {}, [1000, 5000, 10000], '{n} kills', '{k}'),
    ('dano', 'Daño total', 'Trayectoria', 'escudo', 'nuevas/perfil/dano_10k.svg', 'damage', 'total', {}, [10000, 50000, 100000], '{n} de daño', '{k}'),
    ('primer_mix', 'Primer mix', 'Trayectoria', 'escudo', 'nuevas/perfil/primer_mix.svg', 'mixes_played', 'once', {}, [1], 'Primer mix', None),
    ('primera_victoria', 'Primera victoria', 'Trayectoria', 'escudo', 'nuevas/perfil/primera_victoria.svg', 'mixes_won', 'once', {}, [1], 'Primera victoria', None),
    ('veterano', 'Veterano', 'Trayectoria', 'escudo', 'perfil/veterano_2.svg', 'seasons_played', 'total', {}, [2, 3, 5], '{n} temporadas jugadas', '{n}'),
    ('fundador', 'Fundador', 'Trayectoria', 'escudo', 'perfil/fundador.svg', 'played_season', 'once', {'season': 1}, [1], 'Fundador: jugó la temporada 1', None),
    ('pionero', 'Pionero', 'Trayectoria', 'escudo', 'nuevas/perfil/pionero_primer_mix.svg', 'first_match', 'once', {}, [1], 'Pionero: jugó el primer mix', None),
    ('hs_pct', 'Porcentaje de HS', 'Habilidad', 'hexagono', 'perfil/hs_35.svg', 'hs_pct', 'avg_min_matches', {'min_matches': 20}, [35, 45, 55], '{n} % de headshots', '{n}%'),
    ('kda', 'KDA', 'Habilidad', 'hexagono', 'perfil/kda_1_2.svg', 'kda', 'avg_min_matches', {'min_matches': 20}, [1.2, 1.5, 2.0], 'KDA {n}', '{d}'),
    ('adr', 'ADR', 'Habilidad', 'hexagono', 'perfil/adr_70.svg', 'adr', 'avg_min_matches', {'min_matches': 20}, [70, 85, 100], 'ADR {n}', '{n}'),
    ('entry', 'Entry kills', 'Habilidad', 'hexagono', 'perfil/entry_50.svg', 'first_kills', 'total', {}, [50, 250, 500], '{n} entry kills', '{n}'),
    ('multikill', 'Rondas de 4 kills', 'Habilidad', 'hexagono', 'perfil/multikill_10.svg', 'k4', 'total', {}, [10, 50, 100], '{n} rondas de 4 kills', '{n}'),
    ('aces', 'Aces', 'Habilidad', 'hexagono', 'perfil/aces_5.svg', 'k5', 'total', {}, [5, 25, 100], '{n} aces', '{n}'),
    ('elo', 'ELO máximo', 'Habilidad', 'hexagono', 'perfil/elo_1200.svg', 'elo_peak', 'max', {}, [1200, 1500, 1800, 2000], 'ELO máximo {n}', '{n}'),
    ('mvp_mix', 'MVP del mix', 'Habilidad', 'hexagono', 'nuevas/perfil/mvp_mix_10.svg', 'mvp_mixes', 'total', {}, [10, 50, 100], 'MVP en {n} mixes', '{n}'),
    ('clutch', 'Clutchs', 'Habilidad', 'hexagono', 'perfil/clutch_10.svg', 'clutches', 'total', {}, [10, 50, 100], '{n} clutchs ganados', '{n}'),
    ('awp', 'Kills con AWP', 'Arsenal y bomba', 'octagono', 'perfil/awp_100.svg', 'weapon_kills', 'total', W('awp'), [100, 500, 1000], '{n} kills con AWP', '{n}'),
    ('scout', 'Kills con Scout', 'Arsenal y bomba', 'octagono', 'perfil/scout_50.svg', 'weapon_kills', 'total', W('scout'), [50, 250, 500], '{n} kills con Scout', '{n}'),
    ('deagle', 'Kills con Deagle', 'Arsenal y bomba', 'octagono', 'perfil/deagle_100.svg', 'weapon_kills', 'total', W('deagle'), [100, 500, 1000], '{n} kills con Deagle', '{n}'),
    ('rifles', 'Kills con AK-47 o M4A1', 'Arsenal y bomba', 'octagono', 'perfil/rifles_500.svg', 'weapon_kills', 'total', W('ak47', 'm4a1'), [500, 2500, 5000], '{n} kills con AK-47 o M4A1', '{n}'),
    ('cuchillo', 'Kills con cuchillo', 'Arsenal y bomba', 'octagono', 'perfil/cuchillo_5.svg', 'weapon_kills', 'total', W('knife'), [5, 25, 100], '{n} kills con cuchillo', '{n}'),
    ('he', 'Kills con HE', 'Arsenal y bomba', 'octagono', 'perfil/he_25.svg', 'weapon_kills', 'total', W('hegrenade'), [25, 100, 250], '{n} kills con HE', '{n}'),
    ('smg', 'Kills con subfusiles', 'Arsenal y bomba', 'octagono', 'nuevas/perfil/smg_100.svg', 'weapon_kills', 'total', W('mp5navy', 'p90', 'ump45', 'tmp', 'mac10'), [100, 500, 1000], '{n} kills con subfusiles', '{n}'),
    ('escopetas', 'Kills con escopeta', 'Arsenal y bomba', 'octagono', 'nuevas/perfil/escopetas_50.svg', 'weapon_kills', 'total', W('m3', 'xm1014'), [50, 250, 500], '{n} kills con escopeta', '{n}'),
    ('eco_rifles', 'Kills con Famas o Galil', 'Arsenal y bomba', 'octagono', 'nuevas/perfil/eco_rifles_100.svg', 'weapon_kills', 'total', W('famas', 'galil'), [100, 500, 1000], '{n} kills con Famas o Galil', '{n}'),
    ('elites', 'Kills con Dual Elites', 'Arsenal y bomba', 'octagono', 'nuevas/perfil/elites_10.svg', 'weapon_kills', 'total', W('elite'), [10, 50, 100], '{n} kills con Dual Elites', '{n}'),
    ('pistolas', 'Pistolas ganadas', 'Arsenal y bomba', 'octagono', 'perfil/pistolas_25.svg', 'pistol_won', 'total', {}, [25, 100, 250], '{n} rondas de pistola ganadas', '{n}'),
    ('explotadas', 'Bombas explotadas', 'Arsenal y bomba', 'octagono', 'nuevas/perfil/explotadas_10.svg', 'bombs_exploded', 'total', {}, [10, 50, 100], '{n} bombas explotadas', '{n}'),
    ('plantadas', 'Bombas plantadas', 'Arsenal y bomba', 'octagono', 'perfil/plantadas_25.svg', 'plants', 'total', {}, [25, 100, 250], '{n} bombas plantadas', '{n}'),
    ('desactivadas', 'Bombas desactivadas', 'Arsenal y bomba', 'octagono', 'perfil/desactivadas_10.svg', 'defuses', 'total', {}, [10, 50, 100], '{n} bombas desactivadas', '{n}'),
    ('lado_ct', 'Rondas ganadas de CT', 'Rondas', 'pentagono', 'nuevas/perfil/lado_ct_100.svg', 'rounds_won_ct', 'total', {}, [100, 500, 1000], '{n} rondas ganadas de CT', '{n}'),
    ('lado_t', 'Rondas ganadas de T', 'Rondas', 'pentagono', 'nuevas/perfil/lado_t_100.svg', 'rounds_won_t', 'total', {}, [100, 500, 1000], '{n} rondas ganadas de T', '{n}'),
    ('eco_ganado', 'Ecos ganados', 'Rondas', 'pentagono', 'nuevas/perfil/eco_ganado_5.svg', 'eco_won', 'total', {}, [5, 25, 100], '{n} ecos ganados', '{n}'),
    ('sobreviviente', 'Rondas sobrevividas', 'Rondas', 'pentagono', 'nuevas/perfil/sobreviviente_100.svg', 'rounds_survived', 'total', {}, [100, 500, 1000], 'Sobrevivió {n} rondas', '{n}'),
]
MAPS = [('dust2', 'Dust2', ['dust2']), ('inferno', 'Inferno', ['inferno']), ('nuke', 'Nuke', ['nuke']), ('train', 'Train', ['train']),
        ('cbble', 'Cobblestone', ['cbble']), ('tuscan', 'Tuscan', ['tuscan']), ('season', 'Season', ['season']),
        ('cache', 'Cache', ['cache']), ('cpl_mirage', 'Mirage', ['cpl_mirage', 'mirage'])]
for k, name, keys in MAPS:
    F.append((f'mapa_{k}', f'Maestro de {name}', 'Mapas', 'placa', f'perfil/mapa_{k}_10.svg', 'map_wins', 'total',
              {'maps': keys}, [10, 50, 100], f'{{n}} victorias en {name}', '{n}'))
F += [
    ('podio', 'Podio de temporada', 'Temporada', 'escudo con laureles', 'mejoradas/podio_puesto_1.svg', 'season_rank', 'season_rank', {}, [1, 2, 3], 'Podio · puesto {n}', '{n}'),
    ('top_temporada', 'Top de temporada', 'Temporada', 'círculo con banda', 'perfil/top10_temporada.svg', 'season_rank', 'season_rank', {}, [10, 20], 'Top {n} de la temporada', None),
]
MANUAL = [('campeon_torneo', 'Campeón de torneo', 'perfil/campeon_torneo.svg'), ('finalista_torneo', 'Finalista de torneo', 'perfil/finalista_torneo.svg'),
          ('staff', 'Staff', 'perfil/staff.svg'), ('caster', 'Caster', 'perfil/caster.svg'), ('aniversario', 'Aniversario', 'perfil/aniversario.svg'),
          ('beta_tester', 'Beta tester', 'nuevas/perfil/beta_tester.svg'), ('fair_play', 'Fair play', 'nuevas/perfil/fair_play.svg'),
          ('reclutador', 'Reclutador', 'nuevas/perfil/reclutador.svg'), ('supporter', 'Supporter', 'nuevas/perfil/supporter.svg'),
          ('halloween', 'Halloween', 'nuevas/perfil/halloween.svg'), ('navidad', 'Navidad', 'nuevas/perfil/navidad.svg')]
for k, name, svg in MANUAL:
    F.append((k, name, 'Comunidad', 'sello', svg, 'manual', 'manual', {}, [1], name, None))

out = []
CUSTOM = {}
for (tid, title, cat, shape, svg, metric, agg, filters, steps, tfmt, nfmt) in F:
    assert os.path.exists(os.path.join(SV, svg)), svg
    i = info(svg)
    if i['custom']:
        CUSTOM[tid] = i['custom']
        i['accent'] = tid
    out.append({
        'id': tid, 'title': title, 'category': cat, 'shape': shape, 'svg': svg, 'scope': 'player',
        'accent': i['accent'], 'metal': i['metal'], 'metalColors': i['metal_colors'],
        'editable': {'number': i['number'] is not None and nfmt is not None, 'label': i['label'] is not None and agg != 'season_rank',
                     'band': i['band'] is not None, 'metal': True, 'accent': i['accent'] is not None and tid != 'podio'},
        'defaults': {'label': 'MIXES' if tid == 'mixes_jugados' else i['label'], 'number': nfmt, 'band': i['band']},
        'metric': metric, 'aggregation': agg, 'filters': filters, 'steps': steps, 'titleFmt': tfmt,
        'dataSince': SINCE if metric in EXTRA else None,
    })

data = {'acentos': {**{k: {kk: vv.upper() for kk, vv in v.items()} for k, v in ACC.items()}, **CUSTOM},
        'metales': {k: {kk: vv.upper() for kk, vv in v.items()} for k, v in METAL.items()},
        'plantillas': out}
with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(data, f, ensure_ascii=False, indent=1)
    f.write('\n')
for o in out:
    if not o['accent'] or not (o['metal'] or o['metalColors']):
        print('sin acento o metal:', o['id'], o['accent'], o['metal'], o['defaults'])
print(len(out), 'plantillas')
