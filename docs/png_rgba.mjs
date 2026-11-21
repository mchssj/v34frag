// PNG RGBA de 8 bits (leer y escribir) con zlib de Node, sin dependencias. Lo usan los scripts de la guía de arte.
import { readFileSync, writeFileSync } from "node:fs"
import { inflateSync, deflateSync } from "node:zlib"

export function readPng(path) {
  const buf = readFileSync(path)
  let w, h, depth, ctype
  const idat = []
  for (let p = 8; p < buf.length; ) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len)
    if (type === "IHDR") [w, h, depth, ctype] = [data.readUInt32BE(0), data.readUInt32BE(4), data[8], data[9]]
    if (type === "IDAT") idat.push(data)
    p += 12 + len
  }
  if (depth !== 8 || ctype !== 6) throw new Error(`solo PNG RGBA de 8 bits (llegó depth ${depth}, tipo ${ctype})`)
  const raw = inflateSync(Buffer.concat(idat)), stride = w * 4, px = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0, b = y ? px[(y - 1) * stride + x] : 0
      const c = x >= 4 && y ? px[(y - 1) * stride + x - 4] : 0
      const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c)
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]
      px[y * stride + x] = (line[x] + pred) & 255
    }
  }
  return { w, h, px }
}

const crc = (d) => { let c = ~0; for (const b of d) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1 } return ~c >>> 0 }
const chunk = (t, d) => {
  const l = Buffer.alloc(4), td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4)
  l.writeUInt32BE(d.length); c.writeUInt32BE(crc(td))
  return Buffer.concat([l, td, c])
}

export function writePng(path, w, h, px) {
  const stride = w * 4, raw = Buffer.alloc(h * (stride + 1))
  for (let y = 0; y < h; y++) px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]))
}
