"""Nicks raros en el motor: lo que pide la web, lo que tiene que quedar. Uso: nombres.py <rcon.py> <clave> <ip:puerto> [base]
Con "base": build de prueba (los bots piden a la base con csstv_test_steam), pares steam64=esperado por la entrada."""
import sys, subprocess, os, re, time
RC, PW, A = sys.argv[1:4]
def rcon(c): return subprocess.run([sys.executable, '-X', 'utf8', RC, A, PW, c], capture_output=True, env={**os.environ, 'PYTHONUTF8': '1'}).stdout.decode('utf8', 'replace')
def bot():
    l = [x for x in rcon('status').split('\n') if ' BOT' in x and x.startswith('#')][-1]
    m = re.match(r'# *(\d+) "(.*)" +BOT', l); return m[1], m[2]
ok = mal = 0
def ver(que, esp, fin):
    global ok, mal
    b = fin == esp; ok += b; mal += not b
    print('  OK  ' if b else '  FALLA', repr(que), '->', repr(fin), '' if b else 'esperado ' + repr(esp), flush=True)
if len(sys.argv) > 4:
    for l in sys.stdin.read().split('\n'):
        if '\t' not in l: continue
        st, que, esp = l.rstrip('\r').split('\t'); u, _ = bot()
        rcon(f'csstv_test_steam {st}'); rcon(f'csstv_webnick_req {u}'); time.sleep(2); ver(que, esp, bot()[1])
else:
    L = [('nedvěd',)*2, ('zgalact1ck¡?',)*2, ('Pegaré?',)*2, ('🌷͙֒ Artemis ഒ˚₊🎀', 'Artemis ഒ˚₊'), ('fl1ckz;;',)*2, ('Uru - Matía',)*2,
         ('ñ0nk',)*2, ('New™ chori',)*2, ('ST$M Matasiete #EnJesusC',)*2, ('ST$M tommy',)*2, ('lephyxzx',)*2, ('✿ Artemis ✿',)*2,
         ('a%sb', 'asb'), ('%xy', 'xy'), ('#hola', 'hola'), ('ho#la',)*2, ('~xy', 'xy'), ('a~b', 'ab'), ('a{b}c', 'a(b)c'), ('&amp', 'amp'),
         ('a&#b', 'a#b'), ('Tom & Jerry',)*2, ('  dos  ', 'dos'), ('uno   dos', 'uno dos'), ('a\u00a0b', 'a b'), ('a\u200bb', 'ab'),
         ('\u202eabc', 'abc'), ('(1)pepe',)*2, ('\u30e6\u30fc\u30b6',)*2, ('é'*24, 'é'*15), ('日本語プレイヤー名前テスト', '日本語プレイヤー名前'), ('Z͑ͫ̓a͊l̈g̐o', 'Zalgo'), ('кириллица',)*2, ('𝓐bc', 'bc')]
    for q, e in L:
        u, _ = bot(); rcon(f'csstv_webnick_fake {u} "{q}"'); time.sleep(.8); ver(q, e, bot()[1])
    print('  Nada que se lea: sigue con el suyo')
    for q in ('🌷🌷🌷', '\u3164\u3164', '🎀x', '\u200b\u200b'):
        u, _ = bot(); rcon(f'csstv_webnick_fake {u} "SuNombre"'); time.sleep(.6); rcon(f'csstv_webnick_fake {u} "{q}"'); time.sleep(.6); ver(q, 'SuNombre', bot()[1])
print(f'== {ok} bien, {mal} fallas')
