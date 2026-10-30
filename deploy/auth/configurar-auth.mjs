// CMLeague: configura el Auth de un proyecto de Supabase para la web nueva (plan
// docs/bitacora/2026-10-28-despliegue-vps-ovh, sección 6): SMTP de Resend, Site URL, Redirect URLs y plantillas en español.
// Usa la Management API de Supabase. Se corre en el ensayo contra staging y en el corte contra producción.
//
// Uso (desde la raíz del repo):
//   node deploy/auth/configurar-auth.mjs STAGING_SUPABASE_URL           muestra qué cambiaría, sin tocar nada
//   node deploy/auth/configurar-auth.mjs STAGING_SUPABASE_URL --aplicar  lo aplica
// El argumento es el NOMBRE de la variable del .env con la URL del proyecto (de ahí sale el ref).
// Del .env lee además SUPABASE_ACCESS_TOKEN (de la cuenta dueña del proyecto) y RESEND_SMTP_KEY. No muestra secretos.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..');
const env = Object.fromEntries(
  readFileSync(join(raiz, '.env'), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^"|"$/g, '')]),
);

const [urlVar, flag] = process.argv.slice(2);
const aplicar = flag === '--aplicar';
const ref = env[urlVar]?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!ref) throw new Error(`Uso: node deploy/auth/configurar-auth.mjs <VARIABLE_CON_LA_URL> [--aplicar] (${urlVar ?? 'sin variable'} no es una URL de Supabase)`);
for (const k of ['SUPABASE_ACCESS_TOKEN', 'RESEND_SMTP_KEY']) if (!env[k]) throw new Error(`Falta ${k} en el .env`);

const SITIO = 'https://cmleague.lat';
const plantilla = (f) => readFileSync(join(aqui, 'plantillas', f), 'utf8');

const config = {
  site_url: SITIO,
  // La raíz es el FRONTEND_URL al que vuelve la confirmación del registro; /** cubre rutas futuras (recuperación).
  uri_allow_list: `${SITIO},${SITIO}/**`,
  smtp_host: 'smtp.resend.com',
  smtp_port: '465',
  smtp_user: 'resend',
  smtp_pass: env.RESEND_SMTP_KEY,
  smtp_admin_email: 'no-reply@cmleague.lat',
  smtp_sender_name: 'CMLeague',
  // Con SMTP propio Supabase permite subir el tope de correos por hora (con el incluido es 2).
  rate_limit_email_sent: 30,
  mailer_subjects_confirmation: 'Confirma tu cuenta de CMLeague',
  mailer_templates_confirmation_content: plantilla('confirmacion.html'),
  mailer_subjects_email_change: 'Confirma tu nuevo correo en CMLeague',
  mailer_templates_email_change_content: plantilla('cambio-email.html'),
  mailer_subjects_recovery: 'Cambia tu contraseña de CMLeague',
  mailer_templates_recovery_content: plantilla('recuperacion.html'),
};

const api = (metodo, body) =>
  fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: metodo,
    headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  }).then(async (r) => {
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Management API ${metodo}: HTTP ${r.status} ${j.message ?? ''}`);
    return j;
  });

const mostrar = (k, v) => (k === 'smtp_pass' ? (v ? '(cargada)' : null) : /_content$/.test(k) ? (v ? `${v.length} caracteres` : null) : v);
const actual = await api('GET');
console.log(`Proyecto ${ref}:`);
for (const [k, v] of Object.entries(config)) {
  const antes = mostrar(k, actual[k]);
  const igual = k === 'smtp_pass' ? false : actual[k] === v;
  console.log(`  ${igual ? '=' : '~'} ${k}: ${JSON.stringify(antes)}${igual ? '' : ` -> ${JSON.stringify(mostrar(k, v))}`}`);
}

if (!aplicar) {
  console.log('\nSin cambios (agregar --aplicar para aplicarlos).');
} else {
  const nuevo = await api('PATCH', config);
  const mal = Object.keys(config).filter((k) => k !== 'smtp_pass' && nuevo[k] !== config[k]);
  if (mal.length) throw new Error(`No quedaron como se pidió: ${mal.join(', ')}`);
  console.log('\nAplicado y comprobado.');
}
