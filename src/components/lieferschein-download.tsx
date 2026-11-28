"use client"

import { ArrowDown, Printer } from "lucide-react"

import { buildNotePdf, type NoteDocument, type NoteLogo } from "@/lib/note-pdf"

const square =
  "inline-flex size-8 shrink-0 items-center justify-center border border-zinc-300 text-zinc-900"

export function LieferscheinDownload() {
  return (
    <span className="inline-flex items-center gap-1 print:hidden">
      <button
        type="button"
        aria-label="Herunterladen"
        title="Herunterladen"
        className={square}
        onClick={(event) => void saveNote(event.currentTarget)}
      >
        <ArrowDown className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Drucken"
        title="Drucken"
        className={square}
        onClick={(event) => printNote(event.currentTarget)}
      >
        <Printer className="size-4" aria-hidden />
      </button>
    </span>
  )
}

async function saveNote(button: HTMLButtonElement) {
  const article = button.closest("article")
  if (!article) return
  const note = readNote(article)
  const bytes = buildNotePdf(note, await loadLogo())
  const file = new Blob([new Uint8Array(bytes)], { type: "application/pdf" })
  const url = URL.createObjectURL(file)
  const link = document.createElement("a")
  link.href = url
  link.download = `${(note.title || "Lieferschein").replaceAll("/", "-")}.pdf`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function readNote(article: HTMLElement): NoteDocument {
  const title = article.querySelector("h2")?.textContent?.trim() || "Lieferschein"
  const date = article.querySelector("header p")?.textContent?.trim() || ""
  const customerBlock = article.querySelector("header")?.nextElementSibling
  const customerLines = customerBlock
    ? [...customerBlock.querySelectorAll("div")]
        .map((node) => node.textContent?.trim() || "")
        .filter(Boolean)
    : []
  const rows = [...article.querySelectorAll("tbody tr")].flatMap((row) => {
    const cells = [...row.querySelectorAll("td")]
    const name = cells[0]?.textContent?.trim() || ""
    if (!name || cells.length < 2) return []
    return [{ name, quantity: cells[1]?.textContent?.trim() || "" }]
  })
  const total = article.querySelector("table")?.nextElementSibling
  const totals = total ? [...total.querySelectorAll("span")].map((node) => node.textContent?.trim() || "") : []
  const notes = [
    ...[...article.querySelectorAll("p")]
      .filter((node) => !node.closest("header"))
      .map((node) => node.textContent?.replace(/\s+/g, " ").trim() || ""),
    ...[...article.querySelectorAll("li")].map((node) => node.textContent?.replace(/\s+/g, " ").trim() || ""),
  ].filter(Boolean)
  return {
    title,
    date,
    customer: customerLines[0] || "",
    address: customerLines.slice(1).join(", "),
    rows,
    totalLabel: totals[0] || "Stück",
    total: totals[1] || "",
    notes,
  }
}

async function loadLogo(): Promise<NoteLogo | null> {
  try {
    const image = new Image()
    image.src = "/brand/brotli.png"
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext("2d")
    if (!context) return null
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)
    const binary = atob(canvas.toDataURL("image/jpeg", 0.9).split(",")[1] ?? "")
    const jpeg = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) jpeg[index] = binary.charCodeAt(index)
    return { jpeg, width: image.naturalWidth, height: image.naturalHeight }
  } catch {
    return null
  }
}

function printNote(button: HTMLButtonElement) {
  const article = button.closest("article")
  if (!article) return
  const host = document.createElement("div")
  host.id = "lieferschein-print"
  const copy = article.cloneNode(true)
  if (!(copy instanceof HTMLElement)) return
  copy.querySelectorAll("button").forEach((node) => node.remove())
  host.append(copy)
  const style = document.createElement("style")
  style.textContent = `
    @media print {
      html, body { height: auto !important; min-height: 0 !important; }
      body > *:not(#lieferschein-print) { display: none !important; }
      #lieferschein-print { display: block !important; }
      #lieferschein-print article {
        break-after: auto !important;
        page-break-after: auto !important;
      }
    }
  `
  document.head.append(style)
  document.body.append(host)
  const done = () => {
    host.remove()
    style.remove()
    window.removeEventListener("afterprint", done)
  }
  window.addEventListener("afterprint", done)
  window.print()
}
