export type NoteDocument = {
  title: string
  date: string
  customer: string
  address: string
  rows: Array<{ name: string; quantity: string }>
  totalLabel: string
  total: string
  notes: string[]
}

export type NoteLogo = {
  jpeg: Uint8Array
  width: number
  height: number
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 48
const RIGHT = PAGE_WIDTH - MARGIN

export function buildNotePdf(note: NoteDocument, logo: NoteLogo | null) {
  const pages: string[] = []
  let commands: string[] = []
  let y = PAGE_HEIGHT - MARGIN

  function newPage() {
    if (commands.length > 0) pages.push(commands.join("\n"))
    commands = []
    y = PAGE_HEIGHT - MARGIN
  }

  function ensure(height: number) {
    if (y - height >= MARGIN) return
    newPage()
    drawText(note.title, MARGIN, y, 12, true)
    y -= 22
  }

  function drawText(text: string, x: number, baseline: number, size: number, bold = false, gray = false) {
    commands.push(
      "BT",
      gray ? "0.35 0.35 0.35 rg" : "0 0 0 rg",
      `/${bold ? "F2" : "F1"} ${size} Tf`,
      `1 0 0 1 ${round(x)} ${round(baseline)} Tm`,
      `${pdfString(text)} Tj`,
      "ET",
    )
  }

  function drawRight(text: string, baseline: number, size: number, bold = false) {
    const x = Math.max(MARGIN, RIGHT - textWidth(text, size))
    drawText(text, x, baseline, size, bold)
  }

  if (logo) {
    const height = 22
    const width = (logo.width / logo.height) * height
    commands.push(
      "q",
      `${round(width)} 0 0 ${round(height)} ${MARGIN} ${round(y - height)} cm`,
      "/Im1 Do",
      "Q",
    )
  } else {
    drawText("Brötli", MARGIN, y - 14, 14, true)
  }
  drawRight(note.title, y - 14, 16, true)
  y -= 28
  if (note.date) {
    drawRight(note.date, y, 9)
    y -= 18
  }
  y -= 8
  if (note.customer) {
    drawText(note.customer, MARGIN, y, 11, true)
    y -= 15
  }
  if (note.address) {
    for (const line of wrap(note.address, 10, RIGHT - MARGIN)) {
      drawText(line, MARGIN, y, 10)
      y -= 13
    }
  }
  y -= 10
  drawText("Produkt", MARGIN, y, 9, false, true)
  drawRight("Menge", y, 9)
  y -= 6
  commands.push(`0.75 0.75 0.75 RG`, `${MARGIN} ${round(y)} m ${RIGHT} ${round(y)} l S`)
  y -= 16

  for (const row of note.rows) {
    const lines = wrap(row.name, 10, RIGHT - MARGIN - 70)
    ensure(lines.length * 14 + 4)
    lines.forEach((line, index) => {
      drawText(line, MARGIN, y, 10)
      if (index === 0) drawRight(row.quantity, y, 10)
      y -= 14
    })
    commands.push(`0.9 0.9 0.9 RG`, `${MARGIN} ${round(y + 4)} m ${RIGHT} ${round(y + 4)} l S`)
  }

  y -= 8
  ensure(20)
  drawText(note.totalLabel || "Stück", MARGIN, y, 11, true)
  drawRight(note.total, y, 11, true)
  y -= 22

  for (const noteLine of note.notes) {
    for (const line of wrap(noteLine, 9, RIGHT - MARGIN)) {
      ensure(14)
      drawText(line, MARGIN, y, 9, false, true)
      y -= 13
    }
    y -= 4
  }

  if (commands.length > 0) pages.push(commands.join("\n"))
  return assemble(pages.length > 0 ? pages : ["BT ET"], logo)
}

function assemble(pages: string[], logo: NoteLogo | null) {
  const objects: Uint8Array[] = []
  const pageCount = pages.length
  const pageIds = pages.map((_, index) => 3 + index)
  const contentIds = pages.map((_, index) => 3 + pageCount + index)
  const fontRegular = 3 + pageCount * 2
  const fontBold = fontRegular + 1
  const imageId = logo ? fontBold + 1 : 0

  objects.push(ascii(`<< /Type /Catalog /Pages 2 0 R >>`))
  objects.push(
    ascii(
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
    ),
  )

  pages.forEach((_, index) => {
    const resources = [`/Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >>`]
    if (logo) resources.push(`/XObject << /Im1 ${imageId} 0 R >>`)
    objects.push(
      ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << ${resources.join(" ")} >> /Contents ${contentIds[index]} 0 R >>`,
      ),
    )
  })

  for (const page of pages) {
    const stream = ascii(page)
    objects.push(concat([ascii(`<< /Length ${stream.length} >>\nstream\n`), stream, ascii(`\nendstream`)]))
  }

  objects.push(ascii(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`))
  objects.push(
    ascii(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`),
  )
  if (logo) {
    objects.push(
      concat([
        ascii(
          `<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.jpeg.length} >>\nstream\n`,
        ),
        logo.jpeg,
        ascii(`\nendstream`),
      ]),
    )
  }

  const chunks: Uint8Array[] = [ascii("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n")]
  const offsets: number[] = [0]
  let position = chunks[0].length
  objects.forEach((object, index) => {
    offsets.push(position)
    const wrapped = concat([ascii(`${index + 1} 0 obj\n`), object, ascii(`\nendobj\n`)])
    chunks.push(wrapped)
    position += wrapped.length
  })
  const xrefAt = position
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) xref += `${String(offset).padStart(10, "0")} 00000 n \n`
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`
  chunks.push(ascii(xref))
  return concat(chunks)
}

function wrap(text: string, size: number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (current && textWidth(next, size) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [""]
}

function textWidth(text: string, size: number) {
  let width = 0
  for (const char of text) {
    width += (char === " " ? 280 : /[0-9]/.test(char) ? 556 : /[A-ZÄÖÜ]/.test(char) ? 720 : /[ilj.,:]/.test(char) ? 280 : 520)
  }
  return (width / 1000) * size
}

const WIN_ANSI: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
  "¡": 0xa1,
  "¢": 0xa2,
  "£": 0xa3,
  "¤": 0xa4,
  "¥": 0xa5,
  "¦": 0xa6,
  "§": 0xa7,
  "¨": 0xa8,
  "©": 0xa9,
  "ª": 0xaa,
  "«": 0xab,
  "¬": 0xac,
  "®": 0xae,
  "¯": 0xaf,
  "°": 0xb0,
  "±": 0xb1,
  "²": 0xb2,
  "³": 0xb3,
  "´": 0xb4,
  "µ": 0xb5,
  "¶": 0xb6,
  "·": 0xb7,
  "¸": 0xb8,
  "¹": 0xb9,
  "º": 0xba,
  "»": 0xbb,
  "¼": 0xbc,
  "½": 0xbd,
  "¾": 0xbe,
  "¿": 0xbf,
  À: 0xc0,
  Á: 0xc1,
  Â: 0xc2,
  Ã: 0xc3,
  Ä: 0xc4,
  Å: 0xc5,
  Æ: 0xc6,
  Ç: 0xc7,
  È: 0xc8,
  É: 0xc9,
  Ê: 0xca,
  Ë: 0xcb,
  Ì: 0xcc,
  Í: 0xcd,
  Î: 0xce,
  Ï: 0xcf,
  Ñ: 0xd1,
  Ò: 0xd2,
  Ó: 0xd3,
  Ô: 0xd4,
  Õ: 0xd5,
  Ö: 0xd6,
  Ø: 0xd8,
  Ù: 0xd9,
  Ú: 0xda,
  Û: 0xdb,
  Ü: 0xdc,
  Ý: 0xdd,
  Þ: 0xde,
  ß: 0xdf,
  à: 0xe0,
  á: 0xe1,
  â: 0xe2,
  ã: 0xe3,
  ä: 0xe4,
  å: 0xe5,
  æ: 0xe6,
  ç: 0xe7,
  è: 0xe8,
  é: 0xe9,
  ê: 0xea,
  ë: 0xeb,
  ì: 0xec,
  í: 0xed,
  î: 0xee,
  ï: 0xef,
  ñ: 0xf1,
  ò: 0xf2,
  ó: 0xf3,
  ô: 0xf4,
  õ: 0xf5,
  ö: 0xf6,
  ø: 0xf8,
  ù: 0xf9,
  ú: 0xfa,
  û: 0xfb,
  ü: 0xfc,
  ý: 0xfd,
  þ: 0xfe,
  ÿ: 0xff,
}

function pdfString(text: string) {
  let out = ""
  for (const char of text.replaceAll("→", "->")) {
    const code = char.charCodeAt(0)
    const byte = code < 128 ? code : (WIN_ANSI[char] ?? 0x3f)
    if (byte === 0x28 || byte === 0x29 || byte === 0x5c) out += `\\${String.fromCharCode(byte)}`
    else if (byte < 32 || byte > 126) out += `\\${byte.toString(8).padStart(3, "0")}`
    else out += String.fromCharCode(byte)
  }
  return `(${out})`
}

function round(value: number) {
  return Math.round(value * 100) / 100
}

function ascii(value: string) {
  return new TextEncoder().encode(value)
}

function concat(parts: Uint8Array[]) {
  const size = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}
