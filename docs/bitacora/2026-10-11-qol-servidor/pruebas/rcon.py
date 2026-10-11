"""Cliente RCON mínimo (protocolo Source). Uso: python rcon.py host:port password "comando" ["comando" ...]"""
import socket, struct, sys, time


def pkt(i, t, body):
    b = struct.pack('<ii', i, t) + body.encode('utf-8') + b'\x00\x00'
    return struct.pack('<i', len(b)) + b


def recv(s):
    def n(k):
        d = b''
        while len(d) < k:
            c = s.recv(k - len(d))
            if not c:
                raise ConnectionError('cerrado')
            d += c
        return d
    size = struct.unpack('<i', n(4))[0]
    d = n(size)
    i, t = struct.unpack('<ii', d[:8])
    return i, t, d[8:-2].decode('utf-8', 'replace')


def main():
    host, port = sys.argv[1].split(':')
    s = socket.create_connection((host, int(port)), timeout=10)
    s.sendall(pkt(1, 3, sys.argv[2]))
    while True:
        i, t, _ = recv(s)
        if t == 2:
            if i == -1:
                sys.exit('clave rcon incorrecta')
            break
    for k, cmd in enumerate(sys.argv[3:], start=10):
        if cmd.startswith('sleep:'):
            time.sleep(float(cmd[6:]))
            continue
        s.sendall(pkt(k, 2, cmd))
        s.sendall(pkt(k + 1000, 2, ''))   # marcador para saber cuándo terminó la respuesta
        out = []
        while True:
            i, t, body = recv(s)
            if i == k + 1000:
                break
            out.append(body)
        text = ''.join(out).strip()
        print('> ' + cmd + ('\n' + text if text else ''))


if __name__ == '__main__':
    main()
