"""Arma definiciones_iniciales.sql: una definición por escalón de cada plantilla de la fase 1 (plan, paso 7).

Uso (desde la raíz del repo):
    python docs/bitacora/2026-11-04-medallas-configurables/pruebas/definiciones_iniciales.py

Lee web/frontend/src/features/medals/templates.json. Los escalones son los de los SVG de Kyan (badges/nuevas) y el
metal sube con cada escalón: bronce, plata, oro, platino y diamante. Las manuales (Comunidad) quedan activas para que un
admin las dé desde Administración › Jugadores › Fichas. Las de temporada ya las crea el replanteo 79.
"""
import json
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..', '..', '..'))
data = json.load(open(os.path.join(RAIZ, 'web/frontend/src/features/medals/templates.json'), encoding='utf-8'))
METALES = ['bronce', 'plata', 'oro', 'platino', 'diamante']


def numero(fmt, n):
    if fmt is None:
        return None
    if fmt == '{k}':
        return f'{n // 1000}k' if n >= 10000 and n % 1000 == 0 else str(int(n))
    if fmt == '{d}':
        return f'{n:.1f}'
    return fmt.replace('{n}', str(int(n)) if float(n).is_integer() else str(n))


def miles(n):
    if not float(n).is_integer():
        return str(n)
    return f'{int(n):,}'.replace(',', '.') if n >= 10000 else str(int(n))


def q(s):
    return 'null' if s is None else "'" + str(s).replace("'", "''") + "'"


filas = []
for t in data['plantillas']:
    if t['aggregation'] == 'season_rank' or t['id'] == 'campeon_torneo':
        continue
    pasos = t['steps']
    for i, n in enumerate(pasos):
        metal = METALES[min(i, 4)] if len(pasos) > 1 else (t['metal'] or 'oro')
        design = {'metal': metal}
        num = numero(t['defaults']['number'], n)
        if t['editable']['number'] and num:
            design['number'] = num
        if t['editable']['label'] and t['defaults']['label']:
            design['label'] = t['defaults']['label'][:14]
        if t['editable']['band'] and t['defaults']['band']:
            design['band'] = t['defaults']['band'][:14]
        if t['editable']['accent'] and t['accent']:
            design['accent'] = t['accent']
        key = t['id'] if t['aggregation'] in ('manual', 'once') else f"{t['id']}_{str(n).replace('.', '_')}"
        titulo = t['titleFmt'].replace('{n}', miles(n))
        filas.append('  (' + ', '.join([
            q(key), q(t['id']), q(titulo), q(json.dumps(design, ensure_ascii=False)) + '::jsonb', q(t['metric']), q(t['aggregation']),
            q(json.dumps(t['filters'])) + '::jsonb', str(n), q(t['id']) if len(pasos) > 1 else 'null', str(i + 1) if len(pasos) > 1 else 'null',
            q(t['dataSince']),
        ]) + ')')

sql = f"""-- Definiciones iniciales de las medallas (plan 2026-11-04-medallas-configurables, paso 7). Generado por
-- definiciones_iniciales.py desde web/frontend/src/features/medals/templates.json: no editar a mano.
-- Las crea activas y se las da a quienes ya las cumplen (retroactivas). Re-ejecutable: no toca las que ya existen.
begin;
insert into public.medal_definitions (key, template, title, design, metric, aggregation, filters, target, series, series_order, data_since,
                                      status, activated_at, retroactive)
select v.*, 'active', now(), true
  from (values
{(',' + chr(10)).join(filas)}
  ) as v(key, template, title, design, metric, aggregation, filters, target, series, series_order, data_since)
on conflict (key) do nothing;
select medals_award(null) as medallas_dadas;
commit;
"""
sql = sql.replace("'2026-10-29')", "'2026-10-29'::timestamptz)").replace(', null)\n', ', null::timestamptz)\n').replace(', null)', ', null::timestamptz)')
with open(os.path.join(AQUI, 'definiciones_iniciales.sql'), 'w', encoding='utf-8', newline='\n') as f:
    f.write(sql)
print(len(filas), 'definiciones')
