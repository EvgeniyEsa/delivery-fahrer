import { readFileSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { bakeryCodeForArticle, splitProductArticle, type BakeryCode } from "@/lib/product-article"
import type { Subscriber, SubscriberProduct } from "@/lib/subscriber-types"

export type { BakeryCode }

export const BAKERY_COLUMNS: Array<{ code: BakeryCode; name: string; sheet: string }> = [
  { code: "H", name: "Heidbüchel", sheet: "Heidbüchel" },
  { code: "M", name: "Moss", sheet: "Moss" },
  { code: "K", name: "Kockartz", sheet: "Kockartz" },
]

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
]

// Month and day repeat every year. The source sheet stored these holidays as year 2000.
const CLOSURE_DAYS: Array<{ month: number; day: number; closed: BakeryCode[] }> = [
  { month: 1, day: 1, closed: ["H", "M", "K"] },
  { month: 4, day: 1, closed: ["H"] },
  { month: 4, day: 6, closed: ["H", "M"] },
  { month: 4, day: 18, closed: ["H", "M"] },
  { month: 4, day: 21, closed: ["H", "M"] },
  { month: 5, day: 1, closed: ["M"] },
  { month: 5, day: 14, closed: ["M"] },
  { month: 5, day: 20, closed: ["H"] },
  { month: 5, day: 25, closed: ["H", "M"] },
  { month: 5, day: 29, closed: ["M"] },
  { month: 6, day: 4, closed: ["M"] },
  { month: 6, day: 9, closed: ["H", "M"] },
  { month: 6, day: 19, closed: ["M"] },
  { month: 8, day: 12, closed: ["M"] },
  { month: 10, day: 3, closed: ["M"] },
  { month: 11, day: 1, closed: ["M"] },
  { month: 12, day: 25, closed: ["H", "M", "K"] },
  { month: 12, day: 26, closed: ["H", "M", "K"] },
  { month: 12, day: 27, closed: ["H"] },
]

const FILE = path.join(process.cwd(), "data", "bakery-closures.json")
const BAKERY_CODES: BakeryCode[] = ["H", "M", "K"]

type Store = {
  annual: Record<string, BakeryCode[]>
  blocked: string[]
}

const CLOSED_BY_MONTH_DAY = new Map(
  CLOSURE_DAYS.map((entry) => [monthDayKey(entry.month, entry.day), entry.closed]),
)

export function closureRows() {
  const store = readStore()
  return CLOSURE_DAYS.map((entry) => {
    const key = monthDayKey(entry.month, entry.day)
    const closed = store.annual[key] ?? entry.closed
    return {
      key,
      label: `${entry.day} ${MONTHS[entry.month - 1]}`,
      closed,
    }
  })
}

export function blockedOrderDays() {
  return readStore().blocked
}

export function closedBakeriesOn(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match?.[2] || !match[3]) return new Set<BakeryCode>()
  const store = readStore()
  if (store.blocked.includes(isoDate)) return new Set<BakeryCode>(BAKERY_CODES)
  const key = `${match[2]}-${match[3]}`
  if (Object.prototype.hasOwnProperty.call(store.annual, key)) return new Set(store.annual[key] ?? [])
  return new Set(CLOSED_BY_MONTH_DAY.get(key) ?? [])
}

export function subscriberClosedOn(subscriber: Subscriber, isoDate: string) {
  if (blockedOrderDays().includes(isoDate)) return true
  const closed = closedBakeriesOn(isoDate)
  if (closed.size === 0) return false
  const codes = subscriberBakeryCodes(subscriber)
  return codes.length > 0 && codes.every((code) => closed.has(code))
}

export function subscriberUsesMoss(subscriber: Subscriber) {
  if (subscriber.segment !== "b2b" || subscriber.archivedAt) return false
  const codes = subscriberBakeryCodes(subscriber)
  return codes.length > 0 && codes.every((code) => code === "M")
}

export async function toggleAnnualBakery(monthDay: string, code: BakeryCode) {
  if (!/^\d{2}-\d{2}$/.test(monthDay) || !CLOSED_BY_MONTH_DAY.has(monthDay)) {
    return { ok: false as const, error: "Этот день нельзя переключить." }
  }
  if (!BAKERY_CODES.includes(code)) return { ok: false as const, error: "Пекарня не найдена." }
  const store = readStore()
  const current = new Set(store.annual[monthDay] ?? CLOSED_BY_MONTH_DAY.get(monthDay) ?? [])
  if (current.has(code)) current.delete(code)
  else current.add(code)
  store.annual[monthDay] = BAKERY_CODES.filter((item) => current.has(item))
  const written = await writeStore(store)
  if (!written) return { ok: false as const, error: "Не удалось сохранить статус." }
  return { ok: true as const }
}

export async function blockOrderDay(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return { ok: false as const, error: "Выберите дату." }
  const store = readStore()
  if (!store.blocked.includes(isoDate)) store.blocked.push(isoDate)
  store.blocked.sort()
  const written = await writeStore(store)
  if (!written) return { ok: false as const, error: "Не удалось закрыть день." }
  return { ok: true as const, blocked: store.blocked }
}

export async function unblockOrderDay(isoDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return { ok: false as const, error: "Выберите дату." }
  const store = readStore()
  store.blocked = store.blocked.filter((day) => day !== isoDate)
  const written = await writeStore(store)
  if (!written) return { ok: false as const, error: "Не удалось открыть день." }
  return { ok: true as const, blocked: store.blocked }
}

function readStore(): Store {
  try {
    const parsed: unknown = JSON.parse(readFileSync(FILE, "utf8"))
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { annual: {}, blocked: [] }
    const record = parsed as { annual?: unknown; blocked?: unknown }
    const annual: Record<string, BakeryCode[]> = {}
    if (record.annual && typeof record.annual === "object" && !Array.isArray(record.annual)) {
      for (const [key, value] of Object.entries(record.annual)) {
        if (!/^\d{2}-\d{2}$/.test(key) || !Array.isArray(value)) continue
        annual[key] = value.filter((code): code is BakeryCode => code === "H" || code === "M" || code === "K")
      }
    }
    const blocked = Array.isArray(record.blocked)
      ? record.blocked.filter((day): day is string => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day))
      : []
    return { annual, blocked: [...new Set(blocked)].sort() }
  } catch {
    return { annual: {}, blocked: [] }
  }
}

async function writeStore(store: Store) {
  try {
    await mkdir(path.dirname(FILE), { recursive: true })
    await writeFile(FILE, `${JSON.stringify(store, null, 2)}\n`)
    return true
  } catch {
    return false
  }
}

function subscriberBakeryCodes(subscriber: Subscriber) {
  const fromProducts = unique(
    subscriber.products.flatMap((product) => {
      const code = productBakeryCode(product)
      return code ? [code] : []
    }),
  )
  if (fromProducts.length > 0) return fromProducts
  return bakeriesInText(subscriber.comment)
}

function productBakeryCode(product: SubscriberProduct): BakeryCode | "" {
  const article = product.article.trim()
    ? product.article
    : splitProductArticle(product.name).article
  return bakeryCodeForArticle(article)
}

function bakeriesInText(text: string): BakeryCode[] {
  const value = text.toLowerCase()
  const codes: BakeryCode[] = []
  if (/heidb|хальб/.test(value)) codes.push("H")
  if (/moss|мосс/.test(value)) codes.push("M")
  if (/kockartz|копкарц|kopkarz/.test(value)) codes.push("K")
  return codes
}

function unique(codes: BakeryCode[]) {
  return [...new Set(codes)]
}

function monthDayKey(month: number, day: number) {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}
