// Conversión con ffmpeg para lo propio animado (lib/media.ts). Solo la importa node.ts: el Worker no tiene procesos.
// En el VPS hay que instalar ffmpeg (sudo apt install ffmpeg); sin él, available() da false y la API no cobra nada.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppError } from './errors';
import { COSMETICS_MAX_BYTES, filterChain, type MediaConverter } from './media';

const TIMEOUT_MS = 90_000;
/**
 * Una conversión a la vez y con 2 hilos: ffmpeg corre dentro del límite de memoria del servicio (MemoryMax de
 * cmleague-api.service, 768 MB), junto con la API y los sockets del matchmaking, y el VPS también corre la base.
 */
const AT_ONCE = 1;

function run(bin: string, args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    p.stderr.on('data', (d: Buffer) => {
      if (stderr.length < 4000) stderr += d.toString();
    });
    const timer = setTimeout(() => p.kill('SIGKILL'), TIMEOUT_MS);
    p.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

export function nodeMedia(bin = 'ffmpeg'): MediaConverter {
  let ok: Promise<boolean> | null = null;
  let running = 0;
  const waiting: (() => void)[] = [];
  const slot = async () => {
    if (running >= AT_ONCE) await new Promise<void>((r) => waiting.push(r));
    running++;
  };
  const free = () => {
    running--;
    waiting.shift()?.();
  };

  return {
    available() {
      ok ??= run(bin, ['-hide_banner', '-version']).then(
        (r) => r.code === 0,
        () => false,
      );
      return ok;
    },
    async animate(input, source, o) {
      await slot();
      const dir = await mkdtemp(join(tmpdir(), 'cmleague-media-'));
      try {
        const src = join(dir, `in.${source.ext}`);
        const video = join(dir, 'out.webm');
        const poster = join(dir, 'out.webp');
        await writeFile(src, input);
        const vf = filterChain(o);
        const conv = await run(bin, [
          '-v', 'error', '-y', '-i', src, '-t', String(o.maxSeconds), '-vf', vf, '-an',
          '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-row-mt', '1', '-threads', '2', '-deadline', 'good', video,
        ]);
        if (conv.code !== 0) {
          console.error(`ffmpeg (${source.ext}): ${conv.stderr.trim()}`);
          throw new AppError(400, 'INVALID_FILE', 'No se pudo leer la animación. Prueba con otro archivo.');
        }
        // La imagen fija: un cuadro representativo de los primeros (filtro thumbnail), del mismo WebM.
        const still = await run(bin, [
          '-v', 'error', '-y', '-i', video, '-vf', 'thumbnail=n=60', '-frames:v', '1', '-c:v', 'libwebp', '-quality', '80', poster,
        ]);
        if (still.code !== 0) {
          console.error(`ffmpeg (imagen fija): ${still.stderr.trim()}`);
          throw new AppError(500, 'INTERNAL', 'No se pudo armar la imagen fija.');
        }
        const out = { video: new Uint8Array(await readFile(video)), poster: new Uint8Array(await readFile(poster)) };
        if (out.video.length > COSMETICS_MAX_BYTES) {
          throw new AppError(413, 'FILE_TOO_LARGE', 'La animación quedó muy pesada. Prueba con una más corta o más simple.');
        }
        return out;
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => {});
        free();
      }
    },
  };
}
