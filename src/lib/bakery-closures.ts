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

const CLOSED_BY_MONTH_DAY = new Map(
  CLOSURE_DAYS.map((entry) => [monthDayKey(entry.month, entry.day), new Set(entry.closed)]),
)

export function closureRows() {
  return CLOSURE_DAYS.map((entry) => ({
    label: `${entry.day} ${MONTHS[entry.month - 1]}`,
    closed: new Set(entry.closed),
  }))
}

export function closedBakeriesOn(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match?.[2] || !match[3]) return new Set<BakeryCode>()
  return CLOSED_BY_MONTH_DAY.get(`${match[2]}-${match[3]}`) ?? new Set<BakeryCode>()
}

export function subscriberClosedOn(subscriber: Subscriber, isoDate: string) {
  const closed = closedBakeriesOn(isoDate)
  if (closed.size === 0) return false
  const codes = subscriberBakeryCodes(subscriber)
  return codes.length > 0 && codes.every((code) => closed.has(code))
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
