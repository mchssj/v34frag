"""Cambia el nombre visible v34frag -> CMLeague en las fuentes de los plugins y en los cfgs del repo.
Uso: python renombrar_fuentes.py <carpeta server/ del repo>"""
import os, sys

BS = chr(92)
SERVER = sys.argv[1]
B = os.path.join(SERVER, 'addons', 'sourcemod', 'scripting')
EDITS = {
    os.path.join(B, 'csstv_reporter.sp'): [
        ('csstv/menu.inc (categoría v34frag del menú de admin)', 'csstv/menu.inc (categoría CMLeague del menú de admin)', 1),
        ('#define PLUGIN_VERSION "2.4.0"', '#define PLUGIN_VERSION "2.4.1"', 1),
        ('char g_sTag[32] = "v34frag";', 'char g_sTag[32] = "CMLeague";', 1),
        (f'char g_sPrefix[48] = "{BS}x04[v34frag]{BS}x01";', f'char g_sPrefix[48] = "{BS}x04[CMLeague]{BS}x01";', 1)],
    os.path.join(B, 'csstv', 'qol.inc'): [
        ('CreateConVar("csstv_chat_tag", "v34frag", "Texto del prefijo de los mensajes: [v34frag].")',
         'CreateConVar("csstv_chat_tag", "CMLeague", "Texto del prefijo de los mensajes: [CMLeague].")', 1),
        ('newValue[0] ? newValue : "v34frag"', 'newValue[0] ? newValue : "CMLeague"', 1),
        ('[v34frag] Damage', '[CMLeague] Damage', 2)],
    os.path.join(B, 'csstv', 'summary.inc'): [('[v34frag] ', '[CMLeague] ', 5)],
    os.path.join(B, 'csstv', 'maps.inc'): [
        ('"v34frag: votación de mapa de los jugadores"', '"CMLeague: votación de mapa de los jugadores"', 1)],
    os.path.join(B, 'csstv', 'menu.inc'): [
        (' * Categoría "v34frag" en el menú', ' * Categoría del servidor (csstv_chat_tag, hoy "CMLeague") en el menú', 1),
        ('vuelve a la categoría v34frag.', 'vuelve a la categoría del servidor.', 1)],
    os.path.join(B, 'csstv_sell.sp'): [
        ('#define PLUGIN_VERSION "1.0.0"', '#define PLUGIN_VERSION "1.0.1"', 1),
        ('author = "v34frag"', 'author = "CMLeague"', 1),
        ('con el prefijo [v34frag]', 'con el prefijo [CMLeague]', 1),
        ('tag[0] ? tag : "v34frag"', 'tag[0] ? tag : "CMLeague"', 1)],
    os.path.join(B, 'csstv_calladmin.sp'): [
        ('#define PLUGIN_VERSION   "1.0.0"', '#define PLUGIN_VERSION   "1.0.1"', 1),
        ('author = "v34frag"', 'author = "CMLeague"', 1),
        ('(ej. v34frag #1)', '(ej. CMLeague #1)', 1),
        ('con el prefijo [v34frag]', 'con el prefijo [CMLeague]', 1),
        ('tag[0] ? tag : "v34frag"', 'tag[0] ? tag : "CMLeague"', 1)],
    os.path.join(B, 'csstv_allchat.sp'): [
        ('#define PLUGIN_VERSION "1.0.1"', '#define PLUGIN_VERSION "1.0.2"', 1),
        ('author = "v34frag"', 'author = "CMLeague"', 1)],
    os.path.join(SERVER, 'cfg', 'sourcemod', 'csstv_reporter.cfg'): [
        ('csstv_chat_tag "v34frag"      // prefijo de los mensajes: [v34frag]',
         'csstv_chat_tag "CMLeague"     // prefijo de los mensajes: [CMLeague]', 1)],
    os.path.join(SERVER, 'cfg', 'sourcemod', 'csstv_calladmin.cfg'): [
        ('"v34frag #1" en el nuestro, "v34frag #2" en RBK.', '"CMLeague #1" en el nuestro, "CMLeague #2" en RBK.', 1)],
}

# Primero se comprueba todo; si algo no coincide, no se escribe nada.
new = {}
for path, pairs in EDITS.items():
    s = open(path, encoding='utf-8', newline='').read()
    for a, b, n in pairs:
        if s.count(a) != n:
            raise SystemExit(f'ABORTA: {path}: {a!r} aparece {s.count(a)} veces (se esperaban {n})')
        s = s.replace(a, b)
    new[path] = s
for path, s in new.items():
    open(path, 'w', encoding='utf-8', newline='').write(s)
    print('ok', os.path.relpath(path, SERVER))
