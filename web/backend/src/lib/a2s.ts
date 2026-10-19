/**
 * A2S_INFO: la consulta estándar de los servidores de Source (la del navegador de servidores del juego).
 * https://developer.valvesoftware.com/wiki/Server_queries
 *
 * El envío por UDP llega de afuera (UdpExchange), porque solo existe en Node: node.ts le pasa a la app el de
 * lib/udp-node.ts. En el Worker no hay UDP y la ruta responde 501.
 */

/** Un socket abierto hacia un servidor: send manda un paquete y espera la respuesta siguiente. */
export type UdpSession = { send(packet: Uint8Array): Promise<Uint8Array> };
/**
 * Abre un socket, corre la conversación y lo cierra. Rechaza si todo no termina en timeoutMs. El desafío de A2S
 * está atado al puerto de origen: los dos envíos tienen que salir del mismo socket.
 */
export type UdpExchange = <T>(host: string, port: number, timeoutMs: number, talk: (s: UdpSession) => Promise<T>) => Promise<T>;

export type A2sInfo = { name: string; map: string; players: number; max_players: number; bots: number };

const HEADER = [0xff, 0xff, 0xff, 0xff];
const QUERY = new TextEncoder().encode('Source Engine Query\0');
const S2A_INFO = 0x49;
const S2C_CHALLENGE = 0x41;

export class A2sError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'A2sError';
  }
}

export function infoRequest(challenge?: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + 1 + QUERY.length + (challenge?.length ?? 0));
  out.set(HEADER, 0);
  out[4] = 0x54;
  out.set(QUERY, 5);
  if (challenge) out.set(challenge, 5 + QUERY.length);
  return out;
}

/** "host:puerto" (o "host", con el 27015 de Source). null si no tiene forma de dirección. */
export function parseAddress(address: string | null | undefined): { host: string; port: number } | null {
  const a = (address ?? '').trim().replace(/^connect\s+/i, '');
  const m = /^([A-Za-z0-9.-]+)(?::(\d{1,5}))?$/.exec(a);
  if (!m) return null;
  const port = m[2] ? Number(m[2]) : 27015;
  return port > 0 && port < 65536 ? { host: m[1]!, port } : null;
}

/** Lee una respuesta S2A_INFO (0x49). Lanza A2sError si no lo es o viene cortada. */
export function parseInfo(buf: Uint8Array): A2sInfo {
  let i = 0;
  const need = (n: number) => {
    if (i + n > buf.length) throw new A2sError('respuesta cortada');
  };
  const byte = () => {
    need(1);
    return buf[i++]!;
  };
  const str = () => {
    const end = buf.indexOf(0, i);
    if (end === -1) throw new A2sError('respuesta cortada');
    const s = new TextDecoder().decode(buf.subarray(i, end));
    i = end + 1;
    return s;
  };
  need(4);
  if (buf[0] !== 0xff || buf[1] !== 0xff || buf[2] !== 0xff || buf[3] !== 0xff) throw new A2sError('no es una respuesta A2S');
  i = 4;
  if (byte() !== S2A_INFO) throw new A2sError('no es una respuesta S2A_INFO');
  byte(); // protocolo
  const name = str();
  const map = str();
  str(); // carpeta
  str(); // juego
  need(2);
  i += 2; // id de la app
  const players = byte();
  const max_players = byte();
  const bots = byte();
  return { name, map, players, max_players, bots };
}

/**
 * Consulta un servidor. Si responde con un desafío (el servidor real lo pide; el local de pruebas no), lo reenvía
 * por el mismo socket. El tiempo máximo es para todo, desafío incluido.
 */
export function a2sInfo(udp: UdpExchange, host: string, port: number, timeoutMs: number): Promise<A2sInfo> {
  return udp(host, port, timeoutMs, async (s) => {
    let res = await s.send(infoRequest());
    if (res.length >= 9 && res[4] === S2C_CHALLENGE) res = await s.send(infoRequest(res.subarray(5, 9)));
    return parseInfo(res);
  });
}
