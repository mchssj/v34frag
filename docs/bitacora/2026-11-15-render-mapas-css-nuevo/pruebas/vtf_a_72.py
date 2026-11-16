"""Copia de un .bsp con las texturas VTF 7.3+ de su pakfile pasadas a 7.2 (las que lee el CS:S v34).

Uso: python -I vtf_a_72.py <entrada.bsp> <salida.bsp>
Solo reescribe la cabecera: la imagen (y la imagen chica, si hay) se copian tal cual.

Prueba del 2026-11-15, NO SIRVIÓ: con de_tuscan_ob convertido, el tono morado en el arma siguió igual (Daniel).
Se guarda para que no se vuelva a intentar. El arreglo que quedó es mat_specular 0 en el render.
"""
import io, struct, sys, zipfile


def to_72(b):
    major, minor = struct.unpack_from('<II', b, 4)
    if major != 7 or minor < 3:
        return None
    hs = struct.unpack_from('<I', b, 12)[0]
    nres = struct.unpack_from('<I', b, 68)[0]
    res = []
    for i in range(nres):
        tag = b[80 + 8 * i:83 + 8 * i]
        flags = b[83 + 8 * i]
        off = struct.unpack_from('<I', b, 84 + 8 * i)[0]
        res.append((tag, flags, off))
    data = {}
    blobs = sorted((off, tag) for tag, flags, off in res if not flags & 2)
    for i, (off, tag) in enumerate(blobs):
        end = blobs[i + 1][0] if i + 1 < len(blobs) else len(b)
        data[tag] = b[off:end]
    unknown = [tag for tag, flags, off in res if not flags & 2 and tag not in (b'\x01\0\0', b'0\0\0')]
    if unknown:
        raise ValueError('recursos que 7.2 no tiene: %r' % unknown)
    if b'0\0\0' not in data:
        raise ValueError('sin imagen')
    hdr = bytearray(b[:80])
    struct.pack_into('<II', hdr, 4, 7, 2)
    struct.pack_into('<I', hdr, 12, 80)
    hdr[65:80] = b'\0' * 15  # en 7.2 es relleno (en 7.3+ ahí va la cantidad de recursos)
    return bytes(hdr) + data.get(b'\x01\0\0', b'') + data[b'0\0\0']


def main(src, dst):
    with open(src, 'rb') as f:
        bsp = bytearray(f.read())
    off, ln = struct.unpack_from('<ii', bsp, 8 + 16 * 40)
    zin = zipfile.ZipFile(io.BytesIO(bytes(bsp[off:off + ln])))
    out = io.BytesIO()
    n = 0
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_STORED) as zout:
        for info in zin.infolist():
            b = zin.read(info)
            if info.filename.lower().endswith('.vtf'):
                c = to_72(b)
                if c is not None:
                    b = c
                    n += 1
            zi = zipfile.ZipInfo(info.filename, info.date_time)
            zi.compress_type = zipfile.ZIP_STORED
            zout.writestr(zi, b)
    pak = out.getvalue()
    if off + ln == len(bsp):        # el pakfile es lo último: se reemplaza ahí mismo
        new = bsp[:off] + pak
        newoff = off
    else:                           # si no, va al final y el viejo queda sin usar
        newoff = (len(bsp) + 3) & ~3
        new = bsp + b'\0' * (newoff - len(bsp)) + pak
    new = bytearray(new)
    struct.pack_into('<ii', new, 8 + 16 * 40, newoff, len(pak))
    with open(dst, 'wb') as f:
        f.write(new)
    print('%s: %d texturas pasadas a 7.2, pakfile %d -> %d bytes' % (dst, n, ln, len(pak)))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
