// Manual de usuario (plan docs/bitacora/2026-11-02-manual-usuario). Los textos están en docs/manual/<sección>/<tarea>.md y
// las capturas en docs/manual/<sección>/img/. Este archivo no importa nada de Node ni del proyecto: lo usan la API, el
// build (scripts/build.mjs, que valida el manual antes de copiarlo) y las pruebas.

export const SECCIONES = [
  { id: 'jugador', titulo: 'Jugador' },
  { id: 'capitan', titulo: 'Capitán o líder de equipo' },
  { id: 'organizador', titulo: 'Organizador de torneo' },
  { id: 'moderador', titulo: 'Moderador' },
  { id: 'admin', titulo: 'Admin' },
  { id: 'streamer', titulo: 'Streamer' },
  { id: 'servidor-externo', titulo: 'Dueño de un servidor externo' },
] as const;
export type SeccionId = (typeof SECCIONES)[number]['id'];

const TODOS = ['jugador', 'capitan', 'streamer', 'servidor-externo'] as const;
const ROLES = ['user', 'organizer', 'moderator', 'admin'] as const;

/** Las secciones que ve cada rol de cuenta (profiles.role). Un rol desconocido ve lo mismo que un usuario. */
export function seccionesDe(role: string | null | undefined): SeccionId[] {
  const extra: SeccionId[] =
    role === 'admin' ? ['organizador', 'moderador', 'admin']
    : role === 'moderator' ? ['organizador', 'moderador']
    : role === 'organizer' ? ['organizador']
    : [];
  const ve = new Set<SeccionId>([...TODOS, ...extra]);
  return SECCIONES.map((s) => s.id).filter((id) => ve.has(id));
}

/** La sección con la que abre la ayuda: la del rol más alto. */
export function inicioDe(role: string | null | undefined): SeccionId {
  return role === 'admin' ? 'admin' : role === 'moderator' ? 'moderador' : role === 'organizer' ? 'organizador' : 'jugador';
}

export type ManualPagina = {
  seccion: SeccionId;
  tarea: string;
  titulo: string;
  resumen: string;
  orden: number;
  oculta: boolean;
  markdown: string;
};

export type ManualImagen = { seccion: SeccionId; archivo: string; tipo: string; leer: () => Promise<Uint8Array> };

export type Manual = {
  paginas: Map<string, ManualPagina>; // clave: sección/tarea
  imagenes: Map<string, ManualImagen>; // clave: sección/archivo
};

/** Un archivo de docs/manual/, con la ruta relativa a esa carpeta y separada con "/". */
export type ManualArchivo = { ruta: string; texto?: string; leer?: () => Promise<Uint8Array> };

export const TAREA_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const IMAGEN_RE = /^[a-z0-9]+(?:[-_][a-z0-9]+)*\.(webp|png|jpg)$/;
const TIPOS: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' };

const esSeccion = (s: string): s is SeccionId => SECCIONES.some((x) => x.id === s);

/** Lee el encabezado (`---` … `---`) de una página: líneas `clave: valor`. */
export function leerEncabezado(texto: string): { campos: Record<string, string>; cuerpo: string } | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto);
  if (!m) return null;
  const campos: Record<string, string> = {};
  for (const linea of m[1]!.split(/\r?\n/)) {
    if (!linea.trim()) continue;
    const i = linea.indexOf(':');
    if (i <= 0) return null;
    campos[linea.slice(0, i).trim()] = linea.slice(i + 1).trim();
  }
  return { campos, cuerpo: texto.slice(m[0].length).replace(/\r\n/g, '\n') };
}

/**
 * Arma el manual y devuelve también los errores. Con errores, el build no sigue; la API arranca igual con las páginas
 * que sí están bien y los muestra en el log.
 */
export function armarManual(archivos: ManualArchivo[]): { manual: Manual; errores: string[] } {
  const errores: string[] = [];
  const paginas = new Map<string, ManualPagina>();
  const imagenes = new Map<string, ManualImagen>();

  for (const a of archivos) {
    const partes = a.ruta.split('/');
    if (partes.length === 1 && partes[0] === 'README.md') continue;
    const [seccion, nombre, archivo] = partes;
    if (!seccion || !esSeccion(seccion)) {
      errores.push(`${a.ruta}: la carpeta tiene que ser una sección (${SECCIONES.map((s) => s.id).join(', ')})`);
      continue;
    }
    if (partes.length === 3 && nombre === 'img') {
      if (!IMAGEN_RE.test(archivo!)) {
        errores.push(`${a.ruta}: la captura tiene que ser .webp, .png o .jpg, en minúsculas y sin espacios`);
        continue;
      }
      if (!a.leer) continue;
      imagenes.set(`${seccion}/${archivo}`, { seccion, archivo: archivo!, tipo: TIPOS[archivo!.split('.').pop()!]!, leer: a.leer });
      continue;
    }
    if (partes.length !== 2 || !nombre!.endsWith('.md')) {
      errores.push(`${a.ruta}: sobra (solo van <sección>/<tarea>.md y <sección>/img/<captura>)`);
      continue;
    }
    const tarea = nombre!.slice(0, -3);
    if (!TAREA_RE.test(tarea)) {
      errores.push(`${a.ruta}: el nombre tiene que ir en minúsculas y con guiones`);
      continue;
    }
    const enc = leerEncabezado(a.texto ?? '');
    if (!enc) {
      errores.push(`${a.ruta}: falta el encabezado (--- titulo, resumen, orden ---)`);
      continue;
    }
    const { titulo, resumen, orden, oculta, ...resto } = enc.campos;
    const malos: string[] = [];
    if (!titulo) malos.push('falta titulo');
    if (!resumen) malos.push('falta resumen');
    if (!orden || !/^\d+$/.test(orden)) malos.push('orden tiene que ser un número');
    if (oculta !== undefined && oculta !== 'true' && oculta !== 'false') malos.push('oculta es true o false');
    for (const k of Object.keys(resto)) malos.push(`campo desconocido: ${k}`);
    if (/\{\{.*?\}\}/.test(`${titulo ?? ''} ${resumen ?? ''}`)) malos.push('los marcadores ({{…}}) van solo en el texto, no en titulo ni resumen');
    for (const n of new Set(marcadoresDesconocidos(enc.cuerpo))) malos.push(`marcador desconocido: {{${n}}}`);
    if (malos.length) {
      errores.push(`${a.ruta}: ${malos.join('; ')}`);
      continue;
    }
    paginas.set(`${seccion}/${tarea}`, {
      seccion, tarea, titulo: titulo!, resumen: resumen!, orden: Number(orden), oculta: oculta === 'true', markdown: enc.cuerpo.trim() + '\n',
    });
  }

  for (const p of paginas.values()) errores.push(...revisarLinks(p, paginas, imagenes));
  return { manual: { paginas, imagenes }, errores };
}

/** Links a otras páginas del manual y capturas: tienen que existir y verse al menos por quien ve la página. */
function revisarLinks(p: ManualPagina, paginas: Map<string, ManualPagina>, imagenes: Map<string, ManualImagen>): string[] {
  const errores: string[] = [];
  const donde = `${p.seccion}/${p.tarea}.md`;
  for (const m of p.markdown.matchAll(/(!?)\[[^\]]*\]\(\s*([^)\s]+)[^)]*\)/g)) {
    const [, imagen, destino] = m as unknown as [string, string, string];
    if (imagen) {
      const archivo = /^img\/([^/]+)$/.exec(destino)?.[1];
      if (!archivo) errores.push(`${donde}: la captura ${destino} tiene que estar en img/ de la misma sección`);
      else if (!imagenes.has(`${p.seccion}/${archivo}`)) errores.push(`${donde}: falta la captura ${p.seccion}/img/${archivo}`);
      continue;
    }
    if (!destino.startsWith('/help')) continue;
    const ruta = /^\/help\/([^/#?]+)\/([^/#?]+)(?:[#?].*)?$/.exec(destino);
    const destinoPag = ruta ? paginas.get(`${ruta[1]}/${ruta[2]}`) : undefined;
    if (destino === '/help' || /^\/help[#?]/.test(destino)) continue;
    if (!destinoPag) {
      errores.push(`${donde}: el link ${destino} no lleva a ninguna página del manual`);
      continue;
    }
    if (destinoPag.oculta && !p.oculta) errores.push(`${donde}: el link ${destino} lleva a una página oculta`);
    const sinVer = ROLES.filter((r) => seccionesDe(r).includes(p.seccion) && !seccionesDe(r).includes(destinoPag.seccion));
    if (sinVer.length) errores.push(`${donde}: el link ${destino} es de una sección que no ven todos (${sinVer.join(', ')})`);
  }
  return errores;
}

export type ManualIndice = {
  inicio: SeccionId;
  secciones: { id: SeccionId; titulo: string; paginas: { tarea: string; titulo: string; resumen: string }[] }[];
};

/** El índice de lo que ve ese rol, sin las páginas ocultas ni las secciones vacías. */
export function indiceDe(manual: Manual, role: string | null | undefined): ManualIndice {
  const ve = seccionesDe(role);
  const secciones = SECCIONES.filter((s) => ve.includes(s.id))
    .map((s) => ({
      id: s.id,
      titulo: s.titulo,
      paginas: [...manual.paginas.values()]
        .filter((p) => p.seccion === s.id && !p.oculta)
        .sort((a, b) => a.orden - b.orden || a.titulo.localeCompare(b.titulo, 'es'))
        .map(({ tarea, titulo, resumen }) => ({ tarea, titulo, resumen })),
    }))
    .filter((s) => s.paginas.length > 0);
  const inicio = inicioDe(role);
  return { inicio: secciones.some((s) => s.id === inicio) ? inicio : (secciones[0]?.id ?? 'jugador'), secciones };
}

/** La página si ese rol la puede ver; si no (otra sección, oculta o no existe), undefined. */
export function paginaPara(manual: Manual, role: string | null | undefined, seccion: string, tarea: string) {
  const p = manual.paginas.get(`${seccion}/${tarea}`);
  return p && !p.oculta && seccionesDe(role).includes(p.seccion) ? p : undefined;
}

/** La captura si ese rol ve su sección. */
export function imagenPara(manual: Manual, role: string | null | undefined, seccion: string, archivo: string) {
  const i = manual.imagenes.get(`${seccion}/${archivo}`);
  return i && seccionesDe(role).includes(i.seccion) ? i : undefined;
}

export const manualVacio = (): Manual => ({ paginas: new Map(), imagenes: new Map() });

// --- Valores de la configuración (plan docs/bitacora/2026-11-03-manual-valores-reales) ---------------------------------
// Una página escribe {{mm.aceptar}} y la API lo reemplaza por el valor vigente ("20 segundos"), que trae manual_valores()
// (replanteo 65) con las mismas claves. `defecto`: el valor si la base no responde y nunca se leyó.

type Formato =
  | { tipo: 'numero' }
  | { tipo: 'porcentaje' }
  | { tipo: 'cantidad'; singular: string; plural: string }
  | { tipo: 'duraciones' } // lista de minutos: "5 minutos, 15 minutos y 1 hora"
  | { tipo: 'primera_duracion' }
  | { tipo: 'ultima_duracion' };

export type ManualValores = Record<string, unknown>;

const SEGUNDOS: Formato = { tipo: 'cantidad', singular: 'segundo', plural: 'segundos' };
const MINUTOS: Formato = { tipo: 'cantidad', singular: 'minuto', plural: 'minutos' };
const ESCALERA = [5, 15, 60, 1440];

/** El catálogo. `clave`: la de manual_valores() si no es el mismo nombre del marcador. */
export const MARCADORES: Record<string, { clave?: string; formato: Formato; defecto: number | number[] }> = {
  'mm.grupo_max': { formato: { tipo: 'numero' }, defecto: 2 },
  'mm.grupo_dif_elo': { formato: { tipo: 'numero' }, defecto: 500 },
  'mm.aceptar': { formato: SEGUNDOS, defecto: 15 },
  'mm.veto': { formato: SEGUNDOS, defecto: 15 },
  'mm.conectar': { formato: MINUTOS, defecto: 5 },
  'mm.espera_servidor': { formato: MINUTOS, defecto: 3 },
  'mm.volver': { formato: MINUTOS, defecto: 3 },
  // (replanteo 75) Reemplazos.
  'mm.reemplazo_link': { formato: MINUTOS, defecto: 10 },
  'mm.reemplazo_voto': { formato: { tipo: 'porcentaje' }, defecto: 80 },
  'mm.reemplazo_rondas': { formato: { tipo: 'cantidad', singular: 'ronda', plural: 'rondas' }, defecto: 4 },
  'mm.sanciones': { formato: { tipo: 'duraciones' }, defecto: ESCALERA },
  'mm.sancion_min': { clave: 'mm.sanciones', formato: { tipo: 'primera_duracion' }, defecto: ESCALERA },
  'mm.sancion_max': { clave: 'mm.sanciones', formato: { tipo: 'ultima_duracion' }, defecto: ESCALERA },
  'equipo.max_miembros': { formato: { tipo: 'numero' }, defecto: 10 },
  'equipo.capitan_max': { formato: { tipo: 'cantidad', singular: 'equipo', plural: 'equipos' }, defecto: 1 },
  'equipo.dias_nombre': { formato: { tipo: 'cantidad', singular: 'día', plural: 'días' }, defecto: 30 },
  'clips.por_partida': { formato: { tipo: 'numero' }, defecto: 10 },
  'clips.por_jugador': { formato: { tipo: 'numero' }, defecto: 2 },
  'elo.min_pct': { formato: { tipo: 'porcentaje' }, defecto: 35 },
  'elo.full_pct': { formato: { tipo: 'porcentaje' }, defecto: 90 },
  'claim.max_steam_ids': { formato: { tipo: 'numero' }, defecto: 3 },
};

const MARCADOR_RE = /\{\{\s*([a-z_]+(?:\.[a-z_]+)*)\s*\}\}/g;

const numero = (n: number) => n.toLocaleString('es-AR');
const cantidad = (n: number, singular: string, plural: string) => `${numero(n)} ${n === 1 ? singular : plural}`;

/** Minutos en palabras: 45 → "45 minutos", 60 → "1 hora", 1440 → "24 horas", 2880 → "2 días", 90 → "90 minutos". */
export function duracion(min: number): string {
  if (min >= 2880 && min % 1440 === 0) return cantidad(min / 1440, 'día', 'días');
  if (min >= 60 && min % 60 === 0) return cantidad(min / 60, 'hora', 'horas');
  return cantidad(min, 'minuto', 'minutos');
}

/** "a", "a y b", "a, b y c". */
const lista = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);

/** El texto de un valor según su formato. null si el valor no tiene la forma esperada. */
export function formatearValor(formato: Formato, v: unknown): string | null {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : null;
  const arr = Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0) ? (v as number[]) : null;
  switch (formato.tipo) {
    case 'numero': return n === null ? null : numero(n);
    case 'porcentaje': return n === null ? null : `${numero(n)} %`;
    case 'cantidad': return n === null ? null : cantidad(n, formato.singular, formato.plural);
    case 'duraciones': return arr && lista(arr.map(duracion));
    case 'primera_duracion': return arr && duracion(arr[0]!);
    case 'ultima_duracion': return arr && duracion(arr.at(-1)!);
  }
}

/** Reemplaza cada marcador por su valor; si la base no lo trae o vino con otra forma, por el de por defecto. */
export function aplicarMarcadores(markdown: string, valores: ManualValores | null): string {
  return markdown.replace(MARCADOR_RE, (todo, nombre: string) => {
    const m = MARCADORES[nombre];
    if (!m) return todo;
    return formatearValor(m.formato, valores?.[m.clave ?? nombre]) ?? formatearValor(m.formato, m.defecto)!;
  });
}

/** Lo que está entre {{ }} y no es un marcador del catálogo (también lo mal escrito, como {{MM.Aceptar}}). */
export function marcadoresDesconocidos(texto: string): string[] {
  return [...texto.matchAll(/\{\{(.*?)\}\}/g)].map((m) => m[1]!.trim()).filter((n) => !(n in MARCADORES));
}
