"""Resumen de un volcado (.dmp) de Accelerator: dónde fue el crash y qué hay en la pila.

Uso (en un entorno virtual con `pip install minidump pyelftools`):
    python leer_volcado.py <volcado.dmp> [carpeta con los .so del servidor]

Muestra la excepción, el módulo y el desplazamiento donde ocurrió, y las direcciones de la pila
que caen dentro de algún módulo. Es una heurística: no reconstruye la pila exacta, pero alcanza
para ver qué módulos y funciones estaban en juego.

Si se pasa la carpeta con los binarios de Linux (server_i486.so, engine_i486.so, extensiones),
traduce cada dirección al nombre de la función usando la tabla de símbolos del .so.
"""
import bisect, os, struct, sys

from minidump.minidumpfile import MinidumpFile

dump = MinidumpFile.parse(sys.argv[1])
bins = sys.argv[2] if len(sys.argv) > 2 else None
mods = sorted(dump.modules.modules, key=lambda m: m.baseaddress)
_syms = {}


def symbols(name):
    """Funciones de un .so ordenadas por dirección (vacío si no está o no tiene símbolos)."""
    if name in _syms:
        return _syms[name]
    out = []
    path = os.path.join(bins, name) if bins else None
    if path and os.path.exists(path):
        from elftools.elf.elffile import ELFFile
        with open(path, 'rb') as f:
            elf = ELFFile(f)
            for sec in ('.symtab', '.dynsym'):
                tab = elf.get_section_by_name(sec)
                if tab:
                    out += [(s['st_value'], s.name) for s in tab.iter_symbols()
                            if s['st_info']['type'] == 'STT_FUNC' and s['st_value']]
    out.sort()
    _syms[name] = out
    return out


def where(addr):
    for m in mods:
        if m.baseaddress <= addr < m.endaddress:
            name = os.path.basename(m.name.replace('\\', '/'))
            off = addr - m.baseaddress
            syms = symbols(name)
            i = bisect.bisect_right(syms, (off, '￿')) - 1
            fn = f' ({syms[i][1]}+0x{off - syms[i][0]:x})' if i >= 0 else ''
            return f'{name}+0x{off:x}{fn}'
    return None


exc = dump.exception.exception_records[0] if dump.exception else None
if not exc:
    sys.exit('El volcado no tiene excepción.')
rec = exc.ExceptionRecord
code = rec.ExceptionCode if isinstance(rec.ExceptionCode, int) else rec.ExceptionCode.value
print(f'Excepción 0x{code:x} en 0x{rec.ExceptionAddress:x} -> {where(rec.ExceptionAddress)}')

thread = next(t for t in dump.threads.threads if t.ThreadId == exc.ThreadId)
regs = thread.ContextObject
eip = getattr(regs, 'Eip', None)
esp = getattr(regs, 'Esp', None)
if eip is not None:
    print(f'EIP 0x{eip:x} -> {where(eip)}')
if esp is None:
    sys.exit()
reader = dump.get_reader()
stack = reader.read(esp, 0x1000)
print('Pila (direcciones dentro de módulos):')
shown = 0
for i in range(0, len(stack) - 3, 4):
    w = where(struct.unpack_from('<I', stack, i)[0])
    if w and shown < 40:
        print(f'  [esp+0x{i:x}] {w}')
        shown += 1
