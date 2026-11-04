#!/usr/bin/env python3
# Prueba de punta a punta en producción con cuentas temporales. Nunca imprime contraseñas ni tokens. Borra todo al final.
import json, secrets, subprocess, time, urllib.error, urllib.parse, urllib.request

API = 'http://127.0.0.1:8787'
KONG = 'http://127.0.0.1:8000'
ts = str(int(time.time()))[-7:]
fallos = []


def sh(*a):
    return subprocess.run(a, stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=120).stdout.strip()


def sql(q):
    return sh('sudo', 'docker', 'exec', 'supabase-db', 'psql', '-X', '-At', '-U', 'supabase_admin', '-d', 'postgres', '-c', q)


env = dict(l.split('=', 1) for l in sh('sudo', 'cat', '/etc/cmleague/supabase.env').splitlines() if '=' in l and not l.startswith('#'))
SK = env['SERVICE_ROLE_KEY']


def req(url, method='GET', body=None, headers=None):
    h = {'Content-Type': 'application/json', 'x-forwarded-for': '127.0.0.77', **(headers or {})}
    r = urllib.request.Request(url, method=method, data=None if body is None else json.dumps(body).encode(), headers=h)
    try:
        with urllib.request.urlopen(r, timeout=30) as x:
            t = x.read().decode()
            return x.status, (json.loads(t) if t else None), dict(x.headers)
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try:
            return e.code, json.loads(t), dict(e.headers)
        except Exception:
            return e.code, t[:120], dict(e.headers)


def check(nombre, ok, extra=''):
    print(('  OK   ' if ok else '  MAL  ') + nombre + (f'  [{extra}]' if extra else ''))
    if not ok:
        fallos.append(nombre)


creadas = []


def crear(email, tag, pw):
    s, d, _ = req(KONG + '/auth/v1/admin/users', 'POST', {'email': email, 'password': pw, 'email_confirm': True, 'user_metadata': {'tag': tag}},
                  {'apikey': SK, 'Authorization': 'Bearer ' + SK})
    assert s == 200, (s, d)
    creadas.append(d['id'])
    return d['id']


def login(email, pw):
    return req(API + '/auth/login', 'POST', {'email': email, 'password': pw})


def err(d):
    return (d or {}).get('error', {}).get('code') if isinstance(d, dict) else ''


try:
    pw = lambda: secrets.token_hex(10)
    A_mail, T1_mail, T2_mail, T3_mail = f'cm-prueba-a{ts}@cmleague.lat', f'delivered+t1{ts}@resend.dev', f'delivered+t2{ts}@resend.dev', f'delivered+t3{ts}@resend.dev'
    A_pw, T1_pw, T2_pw, T3_pw, T1_new = pw(), pw(), pw(), pw(), pw()
    A = crear(A_mail, f'pruebaA{ts}', A_pw)
    T1 = crear(T1_mail, f'pruebaB{ts}', T1_pw)
    T2 = crear(T2_mail, f'pruebaC{ts}', T2_pw)
    sql(f"update public.profiles set role='admin' where id='{A}'")

    print('== Recuperar la contraseña')
    s, d, _ = req(API + '/auth/password/forgot', 'POST', {'email': T1_mail})
    check('pedir el correo', s == 202, str(s))
    th = ''
    for _ in range(15):
        time.sleep(1)
        th = sql(f"select recovery_token from auth.users where id='{T1}'")
        if th:
            break
    check('GoTrue generó el token y envió', bool(th))
    s, d, _ = req(API + '/auth/password/reset', 'POST', {'token_hash': th, 'new_password': T1_new})
    check('elegir la nueva con el link', s == 200 and isinstance(d, dict) and 'access_token' in d, str(s))
    check('entra con la nueva', login(T1_mail, T1_new)[0] == 200)
    check('rechaza la vieja', login(T1_mail, T1_pw)[0] == 401)
    s, d, _ = req(API + '/auth/password/reset', 'POST', {'token_hash': th, 'new_password': pw()})
    check('el link no sirve dos veces', s == 400 and err(d) == 'INVALID_LINK', f'{s} {err(d)}')

    print('== Acciones de admin')
    s, d, _ = login(A_mail, A_pw)
    assert s == 200, s
    H = {'Authorization': 'Bearer ' + d['access_token']}
    base = f'{API}/api/v1/admin/users/{T2}'
    s, d, _ = req(base + '/account', headers=H)
    check('estado de la cuenta', s == 200 and d.get('confirmed') is True, str(s))
    s, d, _ = req(base + '/resend-confirmation', 'POST', headers=H)
    check('reenviar a una confirmada da 409', s == 409, f'{s} {err(d)}')
    s, d, _ = req(base + '/send-password-reset', 'POST', headers=H)
    check('correo de contraseña', s == 204, f'{s} {err(d)}')
    check('la contraseña actual sigue valiendo', login(T2_mail, T2_pw)[0] == 200)
    s, d, _ = login(T2_mail, T2_pw)
    old_refresh = d.get('refresh_token') if isinstance(d, dict) else None
    s, d, h = req(base + '/random-password', 'POST', headers=H)
    check('contraseña aleatoria con la clave de administrador', s == 200, f'{s} {err(d)}')
    if s == 200:
        rp = d['password']
        check('16 caracteres, sesiones cerradas y sin caché', len(rp) == 16 and d['sessions_closed'] is True and h.get('Cache-Control', h.get('cache-control')) == 'no-store')
        check('rechaza la anterior', login(T2_mail, T2_pw)[0] == 401)
        s2, _, _ = req(API + '/auth/refresh', 'POST', {'refresh_token': old_refresh})
        check('la sesión anterior ya no se renueva', s2 in (400, 401), str(s2))
        check('entra con la aleatoria', login(T2_mail, rp)[0] == 200)
    s, d, _ = req(f'{API}/api/v1/admin/users/{A}/random-password', 'POST', headers=H)
    check('no se puede usar en la propia cuenta', s == 403, str(s))
    check('registro de acciones', sql(f"select count(*) from public.account_admin_actions where admin_id='{A}'") == '2')
    check('el registro no guarda contraseñas', 'password' not in sql("select string_agg(column_name,' ') from information_schema.columns where table_name='account_admin_actions'"))

    print('== Encender la confirmación del correo')
    print('  ' + sh('sudo', 'sb', 'confirmar-correo', 'on').splitlines()[-2])
    for _ in range(20):
        time.sleep(1)
        if req(KONG + '/auth/v1/health', headers={'apikey': SK})[0] == 200:
            break
    s, d, _ = req(API + '/auth/signup', 'POST', {'email': T3_mail, 'password': T3_pw, 'tag': f'pruebaD{ts}'})
    check('el registro pide confirmar', s == 201 and isinstance(d, dict) and d.get('needsConfirmation') is True, f'{s} {err(d)}')
    T3 = sql(f"select id from auth.users where email='{T3_mail}'")
    if T3:
        creadas.append(T3)
    s, d, _ = login(T3_mail, T3_pw)
    check('sin confirmar no entra', s == 403 and err(d) == 'EMAIL_NOT_CONFIRMED', f'{s} {err(d)}')
    s, d, _ = login(A_mail, A_pw)
    H = {'Authorization': 'Bearer ' + d['access_token']}
    s, d, _ = req(f'{API}/api/v1/admin/users/{T3}/account', headers=H)
    check('el panel la ve sin confirmar', s == 200 and d.get('confirmed') is False, str(s))
    print('  (esperando 65 s por el límite de un correo por minuto de GoTrue)')
    time.sleep(65)
    s, d, _ = req(f'{API}/api/v1/admin/users/{T3}/resend-confirmation', 'POST', headers=H)
    check('reenviar la activación', s == 204, f'{s} {err(d)}')
    tok = sql(f"select confirmation_token from auth.users where id='{T3}'")
    check('hay token de activación', bool(tok))

    class NoRedir(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None
    q = urllib.parse.urlencode({'token': tok, 'type': 'signup', 'redirect_to': 'https://cmleague.lat'})
    code, loc = 0, ''
    try:
        urllib.request.build_opener(NoRedir).open(f'https://db.cmleague.lat/auth/v1/verify?{q}', timeout=30)
    except urllib.error.HTTPError as e:
        code, loc = e.code, e.headers.get('Location', '')
    check('el link de activación vuelve a la web', code in (302, 303) and loc.startswith('https://cmleague.lat'), f'{code} {loc[:24]}')
    check('confirmada: ya entra', login(T3_mail, T3_pw)[0] == 200)
finally:
    print('== Limpieza')
    for u in creadas:
        sql(f"delete from public.account_admin_actions where admin_id='{u}' or user_id='{u}'")
        s, _, _ = req(f'{KONG}/auth/v1/admin/users/{u}', 'DELETE', headers={'apikey': SK, 'Authorization': 'Bearer ' + SK})
        print('  cuenta borrada' if s == 200 else f'  NO SE BORRÓ {u}: {s}')
    print('  quedan cuentas de prueba: ' + sql(f"select count(*) from auth.users where email like '%{ts}@%'"))
    print('  filas en el registro: ' + sql('select count(*) from public.account_admin_actions'))

print('\nRESULTADO: ' + ('todo OK' if not fallos else 'FALLOS: ' + '; '.join(fallos)))
