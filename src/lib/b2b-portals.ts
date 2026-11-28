import path from "node:path"

import { addDays, todayInBerlin } from "@/lib/delivery-date"
import { closedBakeriesOn } from "@/lib/bakery-closures"
import { eveningOrderKey, listEveningOrderRecords, currentEveningLines, type EveningLine } from "@/lib/evening-orders"
import { mossOrderDeadline } from "@/lib/moss-orders"
import { clientOrderStillOpen } from "@/lib/order-changes"
import { listProducts } from "@/lib/products"
import { readDataText } from "@/lib/stored-json"
import { listSubscribers } from "@/lib/subscribers"

const FILE = path.join(process.cwd(), "data", "b2b-portals.json")

export type PortalBakery = "Kockartz" | "Moss"

export type B2bPortal = {
  token: string
  subscriberId: string
  bakery: PortalBakery
}

export type PortalProduct = {
  id: string
  sku: string
  name: string
  image: string
  group: string
  price: number | null
}

export type PortalNoteLine = {
  name: string
  quantity: number
  unitPrice: number | null
}

const KOCKARTZ_GROUPS = ["Brötchen", "Croissant", "Brot", "Fladen"]
const MOSS_GROUPS = [
  "Brötchen",
  "Süß Brötchen",
  "Croissant",
  "Brot",
  "Baguette",
  "Fladen",
  "Snack",
  "Süß",
  "Kuchen",
  "Sets",
]

export async function listB2bPortals(): Promise<B2bPortal[]> {
  try {
    const parsed = JSON.parse(await readDataText("b2b-portals.json")) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return []
      const portal = item as Partial<B2bPortal>
      const token = typeof portal.token === "string" ? portal.token.trim() : ""
      const subscriberId = typeof portal.subscriberId === "string" ? portal.subscriberId.trim() : ""
      const bakery = portal.bakery === "Moss" || portal.bakery === "Kockartz" ? portal.bakery : ""
      if (!token || !subscriberId || !bakery) return []
      return [{ token, subscriberId, bakery }]
    })
  } catch {
    return []
  }
}

export async function portalByToken(token: string) {
  const portals = await listB2bPortals()
  return portals.find((portal) => portal.token === token) ?? null
}

export function tomorrowInBerlin() {
  return addDays(todayInBerlin(), 1)
}

export function portalOrderBounds() {
  const today = todayInBerlin()
  const horizon = addDays(today, 31)
  const [year, month] = horizon.split("-").map(Number)
  if (!year || !month) return { min: today, max: horizon }
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { min: today, max: `${horizon.slice(0, 7)}-${String(endDay).padStart(2, "0")}` }
}

export function portalDayClosed(isoDate: string, bakery: PortalBakery = "Kockartz") {
  return closedBakeriesOn(isoDate).has(bakery === "Moss" ? "M" : "K")
}

export function portalOrderDayAllowed(isoDate: string, bakery: PortalBakery = "Kockartz") {
  const { min, max } = portalOrderBounds()
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) && isoDate >= min && isoDate <= max && !portalDayClosed(isoDate, bakery)
}

export function defaultPortalOrderDay(bakery: PortalBakery = "Kockartz") {
  const tomorrow = tomorrowInBerlin()
  const { max } = portalOrderBounds()
  if (bakery === "Moss") {
    for (let day = tomorrow; day <= max; day = addDays(day, 1)) {
      if (portalOrderDayAllowed(day, bakery) && clientOrderStillOpen("Moss", day)) return day
    }
  }
  if (portalOrderDayAllowed(tomorrow, bakery)) return tomorrow
  for (let day = tomorrow; day <= max; day = addDays(day, 1)) {
    if (portalOrderDayAllowed(day, bakery)) return day
  }
  return tomorrow
}

export function chosenPortalOrderDay(requested: string | undefined, bakery: PortalBakery = "Kockartz") {
  if (requested && portalOrderDayAllowed(requested, bakery)) return requested
  return defaultPortalOrderDay(bakery)
}

export function portalOrderHint(bakery: PortalBakery, day: string) {
  if (bakery === "Moss") {
    const deadline = formatPortalDay(mossOrderDeadline(day))
    return `Datum wählen, bis zu einem Monat im Voraus. Änderungen sind bis 11:45 Uhr am ${deadline || "Bestelltag"} möglich.`
  }
  return "Datum wählen, bis zu einem Monat im Voraus. Änderungen sind bis 17:00 Uhr am Vortag möglich."
}

export function portalClosedMessage(bakery: PortalBakery, day: string) {
  if (bakery === "Moss") {
    const deadline = formatPortalDay(mossOrderDeadline(day))
    return `Die Bestellung muss bis 11:45 Uhr am ${deadline || "Bestelltag"} eingehen. Die Zeit ist vorbei.`
  }
  return "Die Bestellung muss bis 17:00 Uhr am Vortag eingehen. Die Zeit ist vorbei."
}

export function formatPortalDay(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  if (!year || !month || !day) return isoDate
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Berlin",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

const LIEFERSCHEIN_MARK: Record<string, string> = {
  "f95481a9-ec47-4a79-8136-0a4fef277b7f": "B",
  "957e1f2d-d8f7-43de-869b-d508ecdbd53f": "L",
}

export function lieferscheinMark(subscriberId: string) {
  return LIEFERSCHEIN_MARK[subscriberId] ?? ""
}

export function lieferscheinNumber(isoDate: string, mark = "") {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  const start = Date.UTC(year, 0, 1)
  const current = Date.UTC(year, month - 1, day)
  const dayOfYear = Math.round((current - start) / 86_400_000) + 1
  if (dayOfYear < 1 || dayOfYear > 366) return null
  // 28 Nov 2026 is slip 318, fourteen behind the calendar day. The rest of 2026 follows.
  const number = year === 2026 ? dayOfYear - 14 : dayOfYear
  if (number < 1 || number > 366) return null
  const yearLabel = String(year % 100).padStart(2, "0")
  const label = `${yearLabel}/${String(number).padStart(3, "0")}`
  const letter = mark.trim().toUpperCase()
  return letter ? `${label} ${letter}` : label
}

export async function portalLieferscheine(subscriberId: string) {
  const orders = await listEveningOrderRecords()
  const prefix = `${subscriberId}|`
  return [...orders.entries()]
    .flatMap(([key, record]) => {
      if (!key.startsWith(prefix)) return []
      const day = key.slice(prefix.length)
      const lines = currentEveningLines(record)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || lines.length === 0) return []
      return [
        {
          day,
          lines,
          versions: record.versions.map((version) => ({
            at: version.at,
            lines: version.lines.map(({ name, quantity }) => ({ name, quantity })),
          })),
        },
      ]
    })
    .sort((left, right) => right.day.localeCompare(left.day))
}

export async function portalRolls(bakery: B2bPortal["bakery"]): Promise<PortalProduct[]> {
  const catalog = await listProducts()
  return catalog
    .flatMap((product) => {
      if (product.vendor !== bakery || tooSlowToCollect(product.name)) return []
      const name = product.name.trim()
      if (!name) return []
      const sku = product.sku.trim()
      if (bakery === "Kockartz") {
        const group = KOCKARTZ_GROUPS.find((item) => item === product.type) ?? ""
        if (!group || !sku || isSet(product) || (group !== "Brot" && product.status !== "active")) return []
        return [portalProduct(product, sku, name, group)]
      }
      return [portalProduct(product, sku, name, product.type.trim() || "Weitere")]
    })
    .sort(
      (left, right) =>
        groupOrder(left.group, bakery) - groupOrder(right.group, bakery) ||
        articleNumber(left.sku) - articleNumber(right.sku) ||
        left.name.localeCompare(right.name, "de"),
    )
}

function portalProduct(
  product: { id: string; image: string; price: number | null },
  sku: string,
  name: string,
  group: string,
): PortalProduct {
  return {
    id: product.id,
    sku,
    name,
    image: product.image,
    group,
    price: typeof product.price === "number" ? product.price : null,
  }
}

export function portalNote(products: PortalProduct[], lines: EveningLine[]): PortalNoteLine[] {
  const used = new Set<number>()
  const note: PortalNoteLine[] = []
  for (const line of lines) {
    const index = products.findIndex((product, productIndex) => {
      if (used.has(productIndex)) return false
      return product.name === line.name && product.sku === line.article
    })
    const fallback =
      index === -1
        ? products.findIndex(
            (product, productIndex) => !used.has(productIndex) && product.sku === line.article,
          )
        : index
    if (fallback !== -1) used.add(fallback)
    note.push({
      name: line.name,
      quantity: line.quantity,
      unitPrice: fallback === -1 ? null : products[fallback]?.price ?? null,
    })
  }
  return note
}

export function portalSavedQuantities(products: PortalProduct[], lines: EveningLine[]) {
  const saved: Record<string, number> = {}
  const used = new Set<number>()
  for (const product of products) {
    const sameSku = products.filter((item) => item.sku === product.sku).length
    const index = lines.findIndex((line, lineIndex) => {
      if (used.has(lineIndex)) return false
      if (line.name === product.name && line.article === product.sku) return true
      return sameSku === 1 && line.article === product.sku
    })
    if (index === -1) continue
    used.add(index)
    saved[product.id] = lines[index]?.quantity ?? 0
  }
  return saved
}

export async function portalOrder(subscriberId: string, day: string) {
  const orders = await listEveningOrderRecords()
  return currentEveningLines(orders.get(eveningOrderKey(subscriberId, day)))
}

export async function portalOrderVersions(subscriberId: string, day: string) {
  const orders = await listEveningOrderRecords()
  const record = orders.get(eveningOrderKey(subscriberId, day))
  return (record?.versions ?? []).map((version) => ({
    at: version.at,
    lines: version.lines.map(({ name, quantity }) => ({ name, quantity })),
  }))
}

export async function portalSubscriber(subscriberId: string) {
  const subscribers = await listSubscribers()
  return subscribers.find((subscriber) => subscriber.id === subscriberId && !subscriber.archivedAt) ?? null
}

const TOO_SLOW = new Set(["himbeer auf reis", "quark mit johannisbeeren"])

function isSet(product: { sku: string; name: string; type: string }) {
  return product.type === "Sets" || /set/i.test(product.name) || /s$/i.test(product.sku.trim())
}

function tooSlowToCollect(name: string) {
  return TOO_SLOW.has(name.trim().toLocaleLowerCase("de-DE"))
}

function groupOrder(group: string, bakery: PortalBakery) {
  const groups = bakery === "Moss" ? MOSS_GROUPS : KOCKARTZ_GROUPS
  const index = groups.indexOf(group)
  return index === -1 ? groups.length : index
}

function articleNumber(sku: string) {
  const match = sku.match(/(\d+)/)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}
