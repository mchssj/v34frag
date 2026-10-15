# Busca un texto dentro de .smx (cabecera de 24 bytes + secciones comprimidas con zlib).
import sys, zlib, struct, pathlib
needle = sys.argv[1].encode()
for p in sys.argv[2:]:
    b = pathlib.Path(p).read_bytes()
    magic, ver, comp, disk, image = struct.unpack_from('<IHBII', b, 0)
    data = b
    if comp == 1:
        off = struct.unpack_from('<I', b, 20)[0]
        data = b[:off] + zlib.decompress(b[off:])
    print(('SÍ ' if needle in data else 'no ') + pathlib.Path(p).name)
