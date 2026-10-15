// Orígenes permitidos a partir de CORS_ORIGINS (lista separada por comas). Admite comodines:
//   https://*.csstv.pages.dev  → un nivel de subdominio (las previews de Pages)
//   http://localhost:*         → cualquier puerto
const PATTERN = /^(https?):\/\/([a-z0-9*.-]+)(?::(\d{1,5}|\*))?$/i;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function toRegex(pattern: string): RegExp {
  const m = PATTERN.exec(pattern);
  if (!m) throw new Error(`origen inválido "${pattern}" (formato: https://host[:puerto], con * como subdominio o puerto)`);
  const [, scheme, host = '', port] = m;
  const labels = host.split('.');
  if (labels.some((l) => l.includes('*') && l !== '*')) throw new Error(`origen inválido "${pattern}" (el * tiene que ser un subdominio completo)`);
  const hostRe = labels.map((l) => (l === '*' ? '[a-z0-9-]+' : escape(l))).join('\\.');
  const portRe = port === undefined ? '' : port === '*' ? ':\\d{1,5}' : `:${port}`;
  // Sin puerto en el patrón, también se acepta el origen sin puerto; con "*", el puerto es opcional.
  const tail = port === '*' ? `(?:${portRe})?` : portRe;
  return new RegExp(`^${scheme}://${hostRe}${tail}$`, 'i');
}

export function parseOrigins(list: string): RegExp[] {
  return list
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(toRegex);
}

export function isAllowedOrigin(origin: string, allowed: RegExp[]): boolean {
  return allowed.some((re) => re.test(origin));
}
