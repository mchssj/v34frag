"""Genera .dev.vars (secretos de `wrangler dev`) a partir del .env de la raíz del repo. No imprime valores.

Uso (desde cloudflare/demo-worker):  python scripts/dev-vars.py
ADMIN_KEY (protege /run) se genera al azar la primera vez y se conserva después.
"""
import os, re, secrets

here = os.path.dirname(os.path.abspath(__file__))
worker = os.path.dirname(here)
env_path = os.path.join(worker, '..', '..', '.env')
out_path = os.path.join(worker, '.dev.vars')

env = {}
for line in open(env_path, encoding='utf-8'):
    m = re.match(r'\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$', line)
    if m:
        env[m.group(1)] = m.group(2).strip('"\'')

old = {}
if os.path.exists(out_path):
    for line in open(out_path, encoding='utf-8'):
        m = re.match(r'\s*([A-Za-z0-9_]+)\s*=\s*"?(.*?)"?\s*$', line)
        if m:
            old[m.group(1)] = m.group(2)

vals = {
    'PTERO_PANEL_API_KEY': env.get('PTERO_PANEL_API_KEY', ''),
    # Key del panel del #1 (MVZG, panel-mvzg.com), desde el 2026-11-03.
    'PTERO_KEY_157703b5': env.get('SFTP_CSS_API_KEY', ''),
    # Key del panel de flow (#2, panel-mvzg.com), desde el 2026-11-02. Sin ella, sus demos van por SFTP.
    'PTERO_KEY_f337a7d9': env.get('SERVER2_PANEL_API_KEY', ''),
    'ADMIN_KEY': old.get('ADMIN_KEY') or old.get('PROBE_KEY') or secrets.token_urlsafe(24),
    'DEMO_WORKER_TOKEN': env.get('DEMO_WORKER_TOKEN', ''),
}
missing = [k for k, v in vals.items() if not v]
with open(out_path, 'w', encoding='utf-8', newline='\n') as fh:
    for k, v in vals.items():
        fh.write('%s="%s"\n' % (k, v))
print('.dev.vars escrito con:', ', '.join(k for k in vals if vals[k]), '| faltan:', ', '.join(missing) or 'nada')
