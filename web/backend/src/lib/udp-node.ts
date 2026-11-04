// Envío UDP de Node para A2S (lib/a2s.ts). Solo lo importa node.ts: el Worker no tiene UDP.
import { createSocket } from 'node:dgram';
import { isIPv6 } from 'node:net';
import { A2sError, type UdpExchange } from './a2s';

export const nodeUdp: UdpExchange = (host, port, timeoutMs, talk) => {
  const socket = createSocket(isIPv6(host) ? 'udp6' : 'udp4');
  // La respuesta que espera el send en curso (una a la vez).
  let waiting: { resolve: (b: Uint8Array) => void; reject: (e: Error) => void } | null = null;
  let failed: Error | null = null;
  const fail = (e: Error) => {
    failed ??= e;
    waiting?.reject(e);
    waiting = null;
  };
  socket.on('message', (msg) => {
    const w = waiting;
    waiting = null;
    w?.resolve(new Uint8Array(msg));
  });
  socket.on('error', (err) => fail(new A2sError(err.message)));
  const session = {
    send: (packet: Uint8Array) =>
      new Promise<Uint8Array>((resolve, reject) => {
        if (failed) return reject(failed);
        waiting = { resolve, reject };
        socket.send(packet, port, host, (err) => {
          if (err) fail(new A2sError(err.message));
        });
      }),
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const e = new A2sError('sin respuesta');
      fail(e);
      reject(e);
    }, timeoutMs);
  });
  return Promise.race([talk(session), timeout]).finally(() => {
    clearTimeout(timer);
    socket.close();
  });
};
