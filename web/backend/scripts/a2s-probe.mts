// Consulta A2S a mano (no es una prueba automática): pnpm exec tsx scripts/a2s-probe.mts host:puerto [archivo.bin]
// Muestra el tipo de la primera respuesta (0x49 = datos; 0x41 = pide desafío) y lo que lee la API.
import { writeFileSync } from 'node:fs';
import { a2sInfo, infoRequest, parseAddress } from '../src/lib/a2s';
import { nodeUdp } from '../src/lib/udp-node';

const addr = parseAddress(process.argv[2]);
if (!addr) throw new Error('uso: host:puerto');
const raw = await nodeUdp(addr.host, addr.port, 1500, (s) => s.send(infoRequest()));
console.log('primera respuesta, tipo 0x' + raw[4]!.toString(16), raw.length, 'bytes');
if (process.argv[3]) writeFileSync(process.argv[3], raw);
console.log(await a2sInfo(nodeUdp, addr.host, addr.port, 1500));
