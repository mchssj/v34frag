// PDF de una sola página con una imagen JPEG que la ocupa entera, sin librerías. Los objetos son los
// mínimos de PDF 1.4: catálogo, páginas, página, imagen (DCTDecode) y el contenido que la dibuja.

export async function jpegToPdf(
  jpeg: Blob,
  width: number,
  height: number
): Promise<Blob> {
  const img = new Uint8Array(await jpeg.arrayBuffer())
  // La página mide lo mismo que la imagen a 96 ppp (1 px = 0,75 pt).
  const pw = +(width * 0.75).toFixed(2)
  const ph = +(height * 0.75).toFixed(2)
  const draw = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`

  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let size = 0
  const push = (p: string | Uint8Array) => {
    const b = typeof p === "string" ? enc.encode(p) : p
    parts.push(b)
    size += b.length
  }
  const obj = (n: number, body: string) => {
    offsets[n] = size
    push(`${n} 0 obj\n${body}\nendobj\n`)
  }

  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>")
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`
  )
  offsets[4] = size
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`
  )
  push(img)
  push("\nendstream\nendobj\n")
  obj(5, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`)

  const xref = size
  push(`xref\n0 6\n0000000000 65535 f \n`)
  for (let n = 1; n <= 5; n++)
    push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`)
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return new Blob(parts as BlobPart[], { type: "application/pdf" })
}
