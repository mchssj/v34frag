import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app';
import {
  aplicarMarcadores, armarManual, duracion, indiceDe, leerEncabezado, MARCADORES, type ManualArchivo, seccionesDe, textoPlano,
} from '../../src/lib/manual';
import { olvidarValores } from '../../src/routes/manual';
import { cargarManual } from '../../src/lib/manual-node';
import { json, testEnv } from '../helpers';
import { makeKey, signToken, userClaims, type TestKey } from '../jwt';

// Manual de usuario (plan docs/bitacora/2026-11-02-manual-usuario).
const USER = '66666666-6666-4666-8666-666666666666';
let key: TestKey;
beforeAll(async () => {
  key = await makeKey();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const pag = (ruta: string, titulo: string, orden: number, cuerpo = 'Texto.', extra = ''): ManualArchivo => ({
  ruta,
  texto: `---\ntitulo: ${titulo}\nresumen: Resumen de ${titulo}\norden: ${orden}\n${extra}---\n\n${cuerpo}\n`,
});
const img = (ruta: string): ManualArchivo => ({ ruta, leer: async () => new Uint8Array([1, 2, 3]) });

const ARCHIVOS: ManualArchivo[] = [
  { ruta: 'README.md', texto: '# Manual' },
  pag('jugador/buscar-partida.md', 'Buscar partida', 2, 'Ver [vincular](/help/jugador/vincular-steamid).\n\n![Botón](img/buscar.webp)'),
  pag('jugador/vincular-steamid.md', 'Vincular tu SteamID', 1),
  img('jugador/img/buscar.webp'),
  pag('capitan/jugar-pcw.md', 'Jugar una PCW', 1, 'Texto.', 'oculta: true\n'),
  pag('organizador/iniciar-partida.md', 'Iniciar una partida', 1),
  pag('moderador/banear.md', 'Banear', 1),
  pag('admin/servidores.md', 'Servidores', 1),
  img('admin/img/servidores.webp'),
];

function app(role: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
      if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
      if (url.includes('/rest/v1/profiles')) return Response.json([{ role }]);
      return new Response('no simulado: ' + url, { status: 599 });
    }),
  );
  const { manual, errores } = armarManual(ARCHIVOS);
  expect(errores).toEqual([]);
  const a = createApp({ manual });
  return async (path: string, conSesion = true) =>
    a.request(path, conSesion ? { headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } } : {}, testEnv());
}

describe('qué sección ve cada rol', () => {
  it('usuario, organizador, moderador y admin', () => {
    expect(seccionesDe('user')).toEqual(['jugador', 'capitan', 'streamer', 'servidor-externo']);
    expect(seccionesDe('organizer')).toEqual(['jugador', 'capitan', 'organizador', 'streamer', 'servidor-externo']);
    expect(seccionesDe('moderator')).toEqual(['jugador', 'capitan', 'organizador', 'moderador', 'streamer', 'servidor-externo']);
    expect(seccionesDe('admin')).toHaveLength(7);
    expect(seccionesDe('otro')).toEqual(seccionesDe('user'));
  });
});

describe('armarManual', () => {
  it('lee el encabezado', () => {
    expect(leerEncabezado('---\ntitulo: A: b\norden: 1\n---\nCuerpo')).toEqual({ campos: { titulo: 'A: b', orden: '1' }, cuerpo: 'Cuerpo' });
    expect(leerEncabezado('Sin encabezado')).toBeNull();
  });

  it('marca los errores de cada archivo', () => {
    const { errores, manual } = armarManual([
      pag('jugador/Mal Nombre.md', 'X', 1),
      pag('otra/pagina.md', 'X', 1),
      { ruta: 'jugador/sin-encabezado.md', texto: 'Hola' },
      { ruta: 'jugador/campos.md', texto: '---\ntitulo: X\norden: uno\ncolor: rojo\n---\n' },
      img('jugador/img/Captura 1.PNG'),
      { ruta: 'jugador/notas.txt', texto: '' },
      pag('jugador/ok.md', 'Ok', 1),
    ]);
    expect(errores).toEqual([
      expect.stringContaining('jugador/Mal Nombre.md'),
      expect.stringContaining('otra/pagina.md: la carpeta'),
      expect.stringContaining('jugador/sin-encabezado.md: falta el encabezado'),
      'jugador/campos.md: falta resumen; orden tiene que ser un número; campo desconocido: color',
      expect.stringContaining('jugador/img/Captura 1.PNG'),
      expect.stringContaining('jugador/notas.txt: sobra'),
    ]);
    expect([...manual.paginas.keys()]).toEqual(['jugador/ok']);
  });

  it('revisa los links y las capturas', () => {
    const { errores } = armarManual([
      pag('jugador/a.md', 'A', 1, [
        '[no existe](/help/jugador/nada)',
        '[oculta](/help/capitan/oculta)',
        '[de admin](/help/admin/b)',
        '[índice](/help) [pantalla](/play) [afuera](https://cmleague.lat)',
        '![falta](img/falta.webp) ![otra sección](../admin/img/x.webp)',
      ].join('\n')),
      pag('capitan/oculta.md', 'Oculta', 1, '[admin desde oculta](/help/jugador/a)', 'oculta: true\n'),
      pag('admin/b.md', 'B', 1, '[a jugador](/help/jugador/a)'),
    ]);
    expect(errores).toEqual([
      'jugador/a.md: el link /help/jugador/nada no lleva a ninguna página del manual',
      'jugador/a.md: el link /help/capitan/oculta lleva a una página oculta',
      'jugador/a.md: el link /help/admin/b es de una sección que no ven todos (user, organizer, moderator)',
      'jugador/a.md: falta la captura jugador/img/falta.webp',
      'jugador/a.md: la captura ../admin/img/x.webp tiene que estar en img/ de la misma sección',
    ]);
  });

  it('el índice va en orden, sin ocultas ni secciones vacías, y abre en la del rol más alto', () => {
    const { manual } = armarManual(ARCHIVOS);
    expect(indiceDe(manual, 'user')).toEqual({
      inicio: 'jugador',
      secciones: [{
        id: 'jugador',
        titulo: 'Jugador',
        paginas: [
          { tarea: 'vincular-steamid', titulo: 'Vincular tu SteamID', resumen: 'Resumen de Vincular tu SteamID', texto: 'Texto.' },
          { tarea: 'buscar-partida', titulo: 'Buscar partida', resumen: 'Resumen de Buscar partida', texto: 'Ver vincular.' },
        ],
      }],
    });
    expect(indiceDe(manual, 'admin').inicio).toBe('admin');
    expect(indiceDe(manual, 'admin').secciones.flatMap((s) => s.paginas.map((p) => p.tarea))).not.toContain('jugar-pcw');
    expect(indiceDe(manual, 'moderator').secciones.map((s) => s.id)).toEqual(['jugador', 'organizador', 'moderador']);
  });
});

describe('textoPlano (buscador de la ayuda)', () => {
  it('saca el Markdown y deja los comandos y el texto de los links', () => {
    const md = [
      '## Pausas',
      '',
      '| Comando | Qué hace |',
      '|---|---|',
      '| `!pause` | Pausa **táctica** |',
      '',
      '> **Ojo:** tienes {{mm.aceptar}} para [aceptar](/help/jugador/buscar-partida).',
      '',
      '![Botón](img/x.webp)',
      '1. Escribe `!2v2_start`.',
      '- Uno',
    ].join('\n');
    expect(textoPlano(md)).toBe('Pausas Comando Qué hace !pause Pausa táctica Ojo: tienes para aceptar. Escribe !2v2_start. Uno');
  });
});

describe('GET /api/v1/manual', () => {
  it('sin sesión: 401', async () => {
    const get = app('user');
    expect((await get('/api/v1/manual', false)).status).toBe(401);
    expect((await get('/api/v1/manual/jugador/buscar-partida', false)).status).toBe(401);
    expect((await get('/api/v1/manual/jugador/img/buscar.webp', false)).status).toBe(401);
  });

  it('el índice según el rol, con caché privada', async () => {
    const res = await app('organizer')('/api/v1/manual');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=300');
    const body = await json(res);
    expect(body.inicio).toBe('organizador');
    expect(body.secciones.map((s: { id: string }) => s.id)).toEqual(['jugador', 'organizador']);
  });
});

describe('GET /api/v1/manual/{seccion}/{tarea}', () => {
  it('devuelve la página', async () => {
    const res = await app('user')('/api/v1/manual/jugador/buscar-partida');
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({
      seccion: 'jugador',
      tarea: 'buscar-partida',
      titulo: 'Buscar partida',
      resumen: 'Resumen de Buscar partida',
      markdown: 'Ver [vincular](/help/jugador/vincular-steamid).\n\n![Botón](img/buscar.webp)\n',
    });
  });

  it('otra sección, oculta o inexistente: el mismo 404', async () => {
    const get = app('moderator');
    const cuerpos = [];
    for (const p of ['admin/servidores', 'capitan/jugar-pcw', 'jugador/nada', 'nada/nada', '..%2F..%2Fsecretos/x']) {
      const res = await get(`/api/v1/manual/${p}`);
      expect(res.status, p).toBe(404);
      const { error } = await json(res);
      cuerpos.push(error.message);
    }
    expect(new Set(cuerpos)).toEqual(new Set(['No existe esa página del manual.']));
  });

  it('el admin ve todo menos lo oculto', async () => {
    const get = app('admin');
    expect((await get('/api/v1/manual/admin/servidores')).status).toBe(200);
    expect((await get('/api/v1/manual/moderador/banear')).status).toBe(200);
    expect((await get('/api/v1/manual/capitan/jugar-pcw')).status).toBe(404);
  });
});

describe('GET /api/v1/manual/{seccion}/img/{archivo}', () => {
  it('la captura de una sección que ve', async () => {
    const res = await app('user')('/api/v1/manual/jugador/img/buscar.webp');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/webp');
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('la de otra sección o una que no existe: 404', async () => {
    const get = app('user');
    expect((await get('/api/v1/manual/admin/img/servidores.webp')).status).toBe(404);
    expect((await get('/api/v1/manual/jugador/img/nada.webp')).status).toBe(404);
    expect((await get('/api/v1/manual/jugador/img/..%2F..%2Fpackage.json')).status).toBe(404);
  });
});

// El manual del repo, si esta rama lo tiene (está en docs/manual/): sin errores.
const repo = resolve(import.meta.dirname, '../../../../docs/manual');
describe.runIf(existsSync(repo))('docs/manual', () => {
  it('no tiene errores', () => {
    expect(cargarManual(repo).errores).toEqual([]);
  });
});

// --- Valores de la configuración (plan docs/bitacora/2026-11-03-manual-valores-reales) --------------------------------
describe('marcadores', () => {
  const VALORES = {
    'mm.grupo_max': 3, 'mm.grupo_dif_elo': 1500, 'mm.aceptar': 1, 'mm.veto': 20, 'mm.conectar': 1, 'mm.espera_servidor': 4,
    'mm.volver': 2, 'mm.sanciones': [10, 30, 120, 2880], 'equipo.max_miembros': 12, 'equipo.capitan_max': 2,
    'clips.por_partida': 8, 'clips.por_jugador': 1, 'elo.min_pct': 40, 'elo.full_pct': 95,
  };

  it('duraciones en minutos, horas y días', () => {
    expect([1, 45, 60, 90, 1440, 2880].map(duracion)).toEqual(['1 minuto', '45 minutos', '1 hora', '90 minutos', '24 horas', '2 días']);
  });

  it('reemplaza cada marcador con su formato, en singular y plural', () => {
    const texto = 'Grupo de {{mm.grupo_max}} con {{mm.grupo_dif_elo}} de ELO. Aceptar: {{mm.aceptar}}; veto: {{ mm.veto }}. ' +
      'Conectar: {{mm.conectar}}. Sanciones: {{mm.sanciones}}, de {{mm.sancion_min}} a {{mm.sancion_max}}. ' +
      'Capitán de {{equipo.capitan_max}}. Desde el {{elo.min_pct}}.';
    expect(aplicarMarcadores(texto, VALORES)).toBe(
      'Grupo de 3 con 1.500 de ELO. Aceptar: 1 segundo; veto: 20 segundos. Conectar: 1 minuto. ' +
        'Sanciones: 10 minutos, 30 minutos, 2 horas y 2 días, de 10 minutos a 2 días. Capitán de 2 equipos. Desde el 40 %.',
    );
  });

  it('sin valores, o con un valor raro, usa el de por defecto', () => {
    expect(aplicarMarcadores('{{mm.aceptar}} · {{mm.sanciones}}', null)).toBe('15 segundos · 5 minutos, 15 minutos, 1 hora y 24 horas');
    expect(aplicarMarcadores('{{mm.aceptar}} · {{mm.sancion_max}}', { 'mm.aceptar': 'x', 'mm.sanciones': [] })).toBe('15 segundos · 24 horas');
  });

  it('todo el catálogo tiene un valor por defecto que se puede mostrar', () => {
    for (const nombre of Object.keys(MARCADORES)) expect(aplicarMarcadores(`{{${nombre}}}`, null)).not.toContain('{{');
  });

  it('el build rechaza un marcador desconocido, mal escrito o en el resumen', () => {
    const { errores } = armarManual([
      pag('jugador/a.md', 'A', 1, 'Tienes {{mm.aceptarr}} y {{MM.Veto}}.'),
      pag('jugador/b.md', 'B {{mm.veto}}', 2),
      pag('jugador/c.md', 'C', 3, 'Bien: {{mm.veto}}.'),
    ]);
    expect(errores).toEqual([
      'jugador/a.md: marcador desconocido: {{mm.aceptarr}}; marcador desconocido: {{MM.Veto}}',
      'jugador/b.md: los marcadores ({{…}}) van solo en el texto, no en titulo ni resumen',
    ]);
  });

  describe('la página con los valores de la base', () => {
    const conValores = (respuesta: () => Response) => {
      olvidarValores();
      const llamadas: string[] = [];
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: RequestInfo | URL) => {
          const url = decodeURIComponent(String(input instanceof Request ? input.url : input));
          if (url.endsWith('/auth/v1/.well-known/jwks.json')) return Response.json({ keys: [key.jwk] });
          if (url.includes('/rest/v1/profiles')) return Response.json([{ role: 'user' }]);
          if (url.includes('/rest/v1/rpc/manual_valores')) {
            llamadas.push(url);
            return respuesta();
          }
          return new Response('no simulado: ' + url, { status: 599 });
        }),
      );
      const { manual } = armarManual([pag('jugador/x.md', 'X', 1, 'Tienes {{mm.aceptar}} para aceptar.')]);
      const a = createApp({ manual });
      const pedir = async () =>
        json<{ markdown: string }>(
          await a.request('/api/v1/manual/jugador/x', { headers: { Authorization: `Bearer ${await signToken(key, userClaims(USER))}` } }, testEnv()),
        );
      return { pedir, llamadas };
    };

    it('reemplaza con el valor vigente y lo guarda 60 s', async () => {
      const { pedir, llamadas } = conValores(() => Response.json({ 'mm.aceptar': 20 }));
      expect((await pedir()).markdown).toBe('Tienes 20 segundos para aceptar.\n');
      expect((await pedir()).markdown).toBe('Tienes 20 segundos para aceptar.\n');
      expect(llamadas).toHaveLength(1);
    });

    it('si la base falla, la página sale igual con el valor por defecto', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { pedir, llamadas } = conValores(() => Response.json({ message: 'no existe' }, { status: 404 }));
      expect((await pedir()).markdown).toBe('Tienes 15 segundos para aceptar.\n');
      await pedir();
      expect(llamadas).toHaveLength(1);
      expect(console.warn).toHaveBeenCalledOnce();
    });
  });
});
