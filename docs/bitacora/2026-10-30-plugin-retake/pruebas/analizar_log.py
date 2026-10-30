"""Verifica las reglas del retake en el log de SourceMod de la build de depuración.
Uso: python analizar_log.py <log> <byte desde el que leer>"""
import re
import sys
from collections import defaultdict

path, start = sys.argv[1], int(sys.argv[2])
with open(path, encoding='utf-8', errors='replace') as f:
    f.seek(start)
    lines = f.read().splitlines()

jug, puntos, awps, fines = defaultdict(list), defaultdict(list), defaultdict(list), {}
mezclas_log = []
partida, ultima = 0, 0   # cuando la ronda baja empieza otra partida: se cuentan aparte
for line in lines:
    m = re.search(r'RETAKE_DBG (\w+) (.*)', line)
    if not m:
        continue
    d = dict(kv.split('=') for kv in m.group(2).split())
    n = int(d.get('ronda', 0))
    if n and n < ultima:
        partida += 1
    if n:
        ultima = n
    r = (partida, n)
    if m.group(1) == 'mezcla':
        mezclas_log.append(r)
    elif m.group(1) == 'jugador':
        jug[r].append(d)
    elif m.group(1) == 'punto':
        puntos[r].append((d['lado'], d['indice'], d['jugador']))
    elif m.group(1) == 'awp':
        awps[r].append(d)
    elif m.group(1) == 'fin':
        fines[r] = (int(d['ganador']), int(d['razon']))

err = []
kits = {'pistola': [0, 0], 'fullbuy': [0, 0]}
for r in sorted(jug):
    ps = jug[r]
    tipo = ps[0]['tipo']
    if (tipo == 'pistola') != (r[1] <= 5):
        err.append(f'ronda {r}: tipo {tipo}')
    if sum(p['planta'] == '1' for p in ps) != 1:
        err.append(f'ronda {r}: plantadores != 1')
    pts = [(lado, i) for lado, i, _ in puntos[r]]
    if len(pts) != len(set(pts)):
        err.append(f'ronda {r}: punto repetido')
    for p in ps:
        if tipo == 'pistola' and (p['primaria'] != '-' or p['casco'] == '1'):
            err.append(f'ronda {r}: equipo de full buy en pistola: {p}')
        if tipo == 'fullbuy' and (p['primaria'] == '-' or p['casco'] == '0'):
            err.append(f'ronda {r}: falta equipo de full buy: {p}')
        if p['equipo'] == '3':
            kits[tipo][1] += 1
            kits[tipo][0] += int(p['kit'])
    for lado in ('2', '3'):
        n = sum(p['primaria'] == 'weapon_awp' and p['equipo'] == lado for p in ps)
        if n > 1 or (tipo == 'pistola' and n):
            err.append(f'ronda {r}: {n} AWP en el equipo {lado}')

racha, mezclas, actual = 0, [], 0
for r in sorted(fines):
    if r[0] != actual:
        actual, racha = r[0], 0
    g = fines[r][0]
    racha = racha + 1 if g == 2 else 0
    if racha > 3:
        racha = 0
        if r[1] < max(x[1] for x in fines if x[0] == r[0]):   # la última ronda de la partida no mezcla: se termina
            mezclas.append(r)
if mezclas != mezclas_log:
    err.append(f'mezclas: esperadas {mezclas}, registradas {mezclas_log}')

sitios = ''.join('AB'[int(jug[r][0]['sitio'])] for r in sorted(jug))
if 'AAA' in sitios or 'BBB' in sitios:
    err.append(f'mismo sitio más de 2 veces seguidas: {sitios}')
print('sitios:', sitios)
print('rondas jugadas:', len(jug), 'terminadas:', len(fines))
print('razones de fin:', sorted(set(v[1] for v in fines.values())), 'ganadores:', {g: sum(v[0] == g for v in fines.values()) for g in (1, 2, 3)})
print('kits:', kits)
print('rondas con mezcla esperada:', mezclas)
print('errores:', len(err))
for e in err:
    print(' ', e)
