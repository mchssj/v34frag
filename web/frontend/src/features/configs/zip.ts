// Leer y armar .zip en el navegador, sin librerías (docs/bitacora/2026-10-29-configs-jugadores en
// kyan/pruebas). Alcanza para configs: archivos chicos, sin cifrado y sin zip64. Los .rar no se pueden abrir
// acá: los abre el servidor.

export interface ArchiveFile {
  path: string
  size: number
  /** El contenido, si se pudo leer. */
  data?: Uint8Array
}

const u16 = (b: DataView, o: number) => b.getUint16(o, true)
const u32 = (b: DataView, o: number) => b.getUint32(o, true)

async function inflateRaw(data: Uint8Array) {
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export const isZip = (b: Uint8Array) =>
  b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04
/** "Rar!\x1a\x07": RAR 4 y RAR 5. */
export const isRar = (b: Uint8Array) =>
  b[0] === 0x52 &&
  b[1] === 0x61 &&
  b[2] === 0x72 &&
  b[3] === 0x21 &&
  b[4] === 0x1a &&
  b[5] === 0x07

/** Lista los archivos de un .zip con su contenido (stored o deflate). Tira error si el zip está roto. */
export async function readZip(buf: Uint8Array): Promise<ArchiveFile[]> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  // Fin del directorio central: firma 0x06054b50 en los últimos 64 KB.
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error("No es un .zip válido.")
  const count = u16(view, eocd + 10)
  let p = u32(view, eocd + 16)
  const out: ArchiveFile[] = []
  const dec = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (u32(view, p) !== 0x02014b50)
      throw new Error("El directorio del .zip está roto.")
    const flags = u16(view, p + 8)
    const method = u16(view, p + 10)
    const csize = u32(view, p + 20)
    const size = u32(view, p + 24)
    const nameLen = u16(view, p + 28)
    const extraLen = u16(view, p + 30)
    const commentLen = u16(view, p + 32)
    const local = u32(view, p + 42)
    const path = dec.decode(buf.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commentLen
    if (path.endsWith("/")) continue // carpeta
    const dataStart = local + 30 + u16(view, local + 26) + u16(view, local + 28)
    const raw = buf.subarray(dataStart, dataStart + csize)
    let data: Uint8Array | undefined
    if (!(flags & 1)) {
      if (method === 0) data = raw
      else if (method === 8) data = await inflateRaw(raw)
    }
    out.push({ path, size, data })
  }
  return out
}

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(d: Uint8Array) {
  let c = 0xffffffff
  for (const x of d) c = CRC[(c ^ x) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Arma un .zip sin comprimir (stored) con los archivos dados. */
export function writeZip(files: { path: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.path)
    const crc = crc32(f.data)
    const head = new Uint8Array(30 + name.length)
    const h = new DataView(head.buffer)
    h.setUint32(0, 0x04034b50, true)
    h.setUint16(4, 20, true)
    h.setUint16(6, 0x0800, true) // nombres en UTF-8
    h.setUint32(14, crc, true)
    h.setUint32(18, f.data.length, true)
    h.setUint32(22, f.data.length, true)
    h.setUint16(26, name.length, true)
    head.set(name, 30)
    const cen = new Uint8Array(46 + name.length)
    const c = new DataView(cen.buffer)
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(4, 20, true)
    c.setUint16(6, 20, true)
    c.setUint16(8, 0x0800, true)
    c.setUint32(16, crc, true)
    c.setUint32(20, f.data.length, true)
    c.setUint32(24, f.data.length, true)
    c.setUint16(28, name.length, true)
    c.setUint32(42, offset, true)
    cen.set(name, 46)
    parts.push(head, f.data)
    central.push(cen)
    offset += head.length + f.data.length
  }
  const size = central.reduce((s, x) => s + x.length, 0)
  const end = new Uint8Array(22)
  const e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true)
  e.setUint16(8, files.length, true)
  e.setUint16(10, files.length, true)
  e.setUint32(12, size, true)
  e.setUint32(16, offset, true)
  return new Blob([...parts, ...central, end] as BlobPart[], {
    type: "application/zip",
  })
}
