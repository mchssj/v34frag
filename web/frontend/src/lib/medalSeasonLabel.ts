// Las medallas de temporada traen "S1" en la etiqueta de arriba. Esto cambia ese texto por la temporada
// que corresponda y ajusta el ancho de la etiqueta, con las mismas medidas que el generador de los SVG.

const SVG_NS = "http://www.w3.org/2000/svg"

export function withSeasonLabel(svg: string, label: string): string {
  const doc = new DOMParser().parseFromString(svg, "image/svg+xml")
  const group = [...doc.getElementsByTagNameNS(SVG_NS, "g")].find(
    (g) => g.id === "etiqueta" || g.id === "temporada"
  )
  const rect = group?.getElementsByTagNameNS(SVG_NS, "rect")[0]
  const text = group?.getElementsByTagNameNS(SVG_NS, "text")[0]
  if (!rect || !text || !/^S\d+$/.test(text.textContent?.trim() ?? "")) return svg

  const fs = label.length <= 3 ? 15 : 11.5
  const width = Math.max(52, label.length * fs * 0.78 + 22)
  const y = Number(rect.getAttribute("y"))
  rect.setAttribute("x", (130 - width / 2).toFixed(1))
  rect.setAttribute("width", width.toFixed(1))
  text.setAttribute("font-size", String(fs))
  text.setAttribute("y", String(y + (fs === 15 ? 16.5 : 15.3)))
  text.textContent = label
  return new XMLSerializer().serializeToString(doc)
}
