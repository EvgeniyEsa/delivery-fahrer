import { randomUUID } from "node:crypto"
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

import { listB2bPortals } from "@/lib/b2b-portals"
import { closedBakeriesOn, subscriberClosedOn } from "@/lib/bakery-closures"
import { eveningOrderKey, listEveningOrders } from "@/lib/evening-orders"
import {
  addDays,
  firstInvoiceSerial,
  formatGrossInput,
  formatPeriod,
  invoiceNumber,
  lineFromGross,
  parseGross,
  type Invoice,
  type InvoiceDraft,
  type InvoiceLine,
} from "@/lib/invoice-math"
import { bakeryHint } from "@/lib/product-photos"
import { bakeryCodeForArticle, bakeryForArticle, describeProduct, normalizeArticle } from "@/lib/product-article"
import { formatPrice, type CatalogProduct } from "@/lib/product-types"
import { deliverInvoice } from "@/lib/invoice-mail"
import { listProducts } from "@/lib/products"
import { listSubscribers } from "@/lib/subscribers"
import type { Subscriber, SubscriberProduct } from "@/lib/subscriber-types"

const INVOICE_DIR = path.join(process.cwd(), "data", "invoices")
const SEQUENCE_FILE = path.join(INVOICE_DIR, "sequence.json")

const NAME_ALIASES: Record<string, string> = {
  "bio broetchen": "biobroetchen",
  bergsteiger: "bergsteiger broetchen",
  "broetchenset 10er": "broetchen set 10er",
  "broetchenset 6er": "broetchen set 6er",
  "suesse broetchen": "suesses broetchen",
  "halbes oberlaender geschnitten": "oberlaender 1000g",
  "schoko streusel brotchen": "schoko streuselbrotchen",
}

const VENDOR_RANK: Record<string, number> = {
  Heidbüchel: 0,
  Moss: 1,
  Kockartz: 2,
}

type Quote = {
  vendor: string
  price: number
}

export function invoiceClients(subscribers: Subscriber[]) {
  const clients: Array<{ key: string; number: number; name: string }> = []
  const seen = new Set<string>()
  for (const subscriber of subscribers) {
    if (subscriber.archivedAt) continue
    const key = clientKey(subscriber.name)
    if (seen.has(key)) continue
    seen.add(key)
    clients.push({ key, number: clients.length + 1, name: subscriber.name.trim() })
  }
  return clients
}

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
]

export function mailingWindow(year: number, month: number, day: number) {
  if (day === 1) {
    return month === 1
      ? { year: year - 1, month: 12, scheduled: true }
      : { year, month: month - 1, scheduled: true }
  }
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { year, month, scheduled: day === last }
}

export function monthName(month: number) {
  return MONTH_NAMES[month - 1] ?? String(month)
}

export function mailingItems(invoices: Invoice[], subscribers: Subscriber[], year: number, month: number) {
  const emails = new Map<string, string>()
  for (const subscriber of subscribers) {
    const key = clientKey(subscriber.name)
    if (!subscriber.email || emails.has(key)) continue
    emails.set(key, subscriber.email)
  }
  return invoices.flatMap((invoice) => {
    const [invoiceYear, invoiceMonth] = invoice.issuedOn.split("-").map(Number)
    if (invoiceYear !== year || invoiceMonth !== month) return []
    return [
      {
        id: invoice.id,
        number: invoice.number,
        customerName: invoice.customerName,
        email: emails.get(clientKey(invoice.customerName)) ?? "",
        sentAt: invoice.sentAt ?? null,
      },
    ]
  })
}

export async function sendMonthInvoices(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false as const, error: "Неизвестный месяц." }
  }
  const [invoices, subscribers] = await Promise.all([listInvoices(), listSubscribers()])
  const items = mailingItems(invoices, subscribers, year, month)
  const pending = items.filter((item) => item.email && !item.sentAt)
  if (pending.length === 0) {
    return {
      ok: false as const,
      error: items.length === 0
        ? "За этот месяц ещё нет сохранённых счетов."
        : "Нет новых счетов с почтой. Без адреса письмо не уходит.",
    }
  }

  let sent = 0
  for (const item of pending) {
    const invoice = invoices.find((entry) => entry.id === item.id)
    if (!invoice) continue
    const result = await deliverInvoice(item.email, invoice)
    if (!result.ok) {
      if (sent === 0) return result
      break
    }
    invoice.sentAt = new Date().toISOString()
    invoice.sentTo = item.email
    const file = invoiceFile(invoice)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, `${JSON.stringify(invoice, null, 2)}\n`, "utf8")
    sent += 1
  }
  return {
    ok: true as const,
    sent,
    skipped: items.filter((item) => !item.email).length,
  }
}

export async function listInvoices() {
  const invoices = await readInvoices()
  return invoices.sort((left, right) => invoiceOrder(right.number) - invoiceOrder(left.number))
}

export async function buildInvoiceDraft(input: {
  clientKey: string
  from: string
  to: string
}): Promise<{ ok: true; draft: InvoiceDraft } | { ok: false; error: string }> {
  if (!isIsoDate(input.from) || !isIsoDate(input.to) || input.from > input.to) {
    return { ok: false, error: "Укажите период: дата «с» не позже даты «по»." }
  }

  let subscribers: Subscriber[]
  let catalog: CatalogProduct[]
  try {
    ;[subscribers, catalog] = await Promise.all([listSubscribers(), listProducts()])
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось прочитать данные"
    return { ok: false, error: message }
  }

  const named = subscribers.filter((subscriber) => clientKey(subscriber.name) === input.clientKey)
  if (named.length === 0) return { ok: false, error: "Клиент не найден." }
  const cards = named.filter((subscriber) => !subscriber.archivedAt)
  if (cards.length === 0) {
    return { ok: false, error: "Клиент в архиве. Верните карточку, чтобы выставить счёт." }
  }

  const index = priceIndex(catalog)
  const [portals, eveningOrders] = await Promise.all([listB2bPortals(), listEveningOrders()])
  const portalBakery = new Map(portals.map((portal) => [portal.subscriberId, portal.bakery]))
  const hotelIds = new Set(
    portals.filter((portal) => portal.bakery === "Kockartz").map((portal) => portal.subscriberId),
  )
  const deliveryDays = new Set<string>()
  const buckets = new Map<
    string,
    { key: string; name: string; quantity: number; quotes: Quote[]; missing: boolean }
  >()
  const active: Subscriber[] = []

  function addProduct(product: SubscriberProduct, times: number, hint: string) {
    if (product.quantity <= 0 || times <= 0) return
    const described = describeProduct(product)
    const name = described.name || product.name.trim()
    const key = `product:${normalizeName(name)}`
    const vendor = described.bakery || hint
    const quotes = quotesFor(index, product, vendor)
    const bucket = buckets.get(key) ?? { key, name, quantity: 0, quotes: [], missing: false }
    bucket.quantity += product.quantity * times
    if (quotes.length === 0) bucket.missing = true
    else bucket.quotes.push(...quotes)
    buckets.set(key, bucket)
  }

  for (const card of cards) {
    const hint = bakeryHint(card.comment)
    if (hotelIds.has(card.id)) {
      let ordered = false
      for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
        const lines = eveningOrders.get(eveningOrderKey(card.id, date)) ?? []
        if (lines.length === 0 || lieferscheinClosed(lines, date)) continue
        ordered = true
        deliveryDays.add(date)
        for (const line of lines) addProduct(line, 1, "Kockartz")
      }
      if (ordered) active.push(card)
      continue
    }

    const dates = card.deliveryDates.filter(
      (date) => date >= input.from && date <= input.to && !subscriberClosedOn(card, date),
    )
    if (dates.length > 0) {
      active.push(card)
      for (const date of dates) deliveryDays.add(date)
      for (const product of card.products) addProduct(product, dates.length, hint)
    }
    if (portalBakery.get(card.id) !== "Moss") continue
    const standing = new Set(dates)
    let extra = false
    for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
      if (standing.has(date)) continue
      const lines = eveningOrders.get(eveningOrderKey(card.id, date)) ?? []
      if (lines.length === 0 || lieferscheinClosed(lines, date)) continue
      extra = true
      deliveryDays.add(date)
      for (const line of lines) addProduct(line, 1, "Moss")
    }
    if (extra && !active.includes(card)) active.push(card)
  }

  if (deliveryDays.size === 0) {
    return { ok: false, error: "В этом периоде нет доставок. Закрытые дни пекарни не считаются." }
  }

  const days = [...deliveryDays].sort()
  const periodFrom = days[0] ?? input.from
  const periodTo = days[days.length - 1] ?? input.to
  const deliveryPrices = [
    ...new Set(active.map((card) => card.deliveryPrice).filter((price) => price != null)),
  ]
  const lines: InvoiceDraft["lines"] = [...buckets.values()].map((bucket) => {
    const prices = uniqueQuotes(bucket.quotes)
    const ready = !bucket.missing && prices.length === 1
    return {
      key: bucket.key,
      name: bucket.name,
      quantity: bucket.quantity,
      gross: ready && prices[0] ? formatGrossInput(prices[0].price) : "",
      note: ready ? "" : priceNote(bucket.missing, prices),
    }
  })

  lines.push({
    key: "versand",
    name: "Versand",
    quantity: days.length,
    gross: deliveryPrices.length === 1 && deliveryPrices[0] != null ? formatGrossInput(deliveryPrices[0]) : "",
    note:
      deliveryPrices.length === 1
        ? ""
        : deliveryPrices.length === 0
          ? "Цена доставки не указана — впишите обещанную."
          : "На карточках разные цены доставки — укажите одну.",
  })

  const addresses = [
    ...new Set(
      [...active, ...cards].map((card) => card.address.trim()).filter(Boolean),
    ),
  ]
  const warnings = [
    addresses.length > 1 ? "У клиента несколько адресов. В счёте указан первый." : "",
    addresses.length === 0 ? "В абонементе нет адреса." : "",
  ].filter(Boolean)

  return {
    ok: true,
    draft: {
      clientKey: input.clientKey,
      from: input.from,
      to: input.to,
      customerName: active[0]?.name.trim() || cards[0]?.name.trim() || "",
      customerLines: addressLines(addresses[0] ?? ""),
      issuedOn: periodTo,
      dueOn: addDays(periodTo, 7),
      periodFrom,
      periodTo,
      periodLabel: formatPeriod(periodFrom, periodTo),
      lines,
      warnings,
    },
  }
}

export async function saveInvoice(input: {
  clientKey: string
  from: string
  to: string
  prices: Record<string, string>
}): Promise<{ ok: true; invoice: Invoice } | { ok: false; error: string }> {
  const built = await buildInvoiceDraft(input)
  if (!built.ok) return built

  const lines: InvoiceLine[] = []
  for (const line of built.draft.lines) {
    const gross = parseGross(input.prices[line.key] ?? "")
    if (gross == null) return { ok: false, error: `Укажите цену: ${line.name}.` }
    lines.push(lineFromGross(line.name, line.quantity, gross))
  }

  const number = await reserveInvoiceNumber(built.draft.issuedOn)
  const invoice: Invoice = {
    id: randomUUID(),
    number,
    issuedOn: built.draft.issuedOn,
    dueOn: built.draft.dueOn,
    periodFrom: built.draft.periodFrom,
    periodTo: built.draft.periodTo,
    periodLabel: built.draft.periodLabel,
    customerName: built.draft.customerName,
    customerLines: built.draft.customerLines,
    lines,
    comment: "",
    source: "subscription",
    taxMode: "included",
  }
  const file = invoiceFile(invoice)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(invoice, null, 2)}\n`, "utf8")
  return { ok: true, invoice }
}

export async function removeInvoice(id: string) {
  if (!id) return { ok: false as const, error: "Счёт не найден." }
  const invoices = await readInvoices()
  const invoice = invoices.find((item) => item.id === id)
  if (!invoice) return { ok: false as const, error: "Счёт не найден." }
  await unlink(invoiceFile(invoice))
  return { ok: true as const }
}

function lieferscheinClosed(
  lines: Array<{ article: string }>,
  date: string,
) {
  const closed = closedBakeriesOn(date)
  if (closed.size === 0) return false
  const codes = lines.flatMap((line) => {
    const code = bakeryCodeForArticle(line.article)
    return code ? [code] : []
  })
  return codes.length > 0 && codes.every((code) => closed.has(code))
}

function clientKey(name: string) {
  return name.trim().toLocaleLowerCase("ru")
}

function priceIndex(catalog: CatalogProduct[]) {
  const bySku = new Map<string, CatalogProduct[]>()
  const byName = new Map<string, CatalogProduct[]>()
  for (const product of catalog) {
    const sku = product.sku.trim().toUpperCase()
    if (sku) {
      const group = bySku.get(sku) ?? []
      group.push(product)
      bySku.set(sku, group)
    }
    const name = normalizeName(product.name)
    if (!name) continue
    const named = byName.get(name) ?? []
    named.push(product)
    byName.set(name, named)
  }
  return { bySku, byName }
}

function quotesFor(
  index: ReturnType<typeof priceIndex>,
  product: SubscriberProduct,
  vendor: string,
): Quote[] {
  const described = describeProduct(product)
  let matches: CatalogProduct[] = []
  if (described.article) {
    matches = index.bySku.get(normalizeArticle(described.article).toUpperCase()) ?? []
  }
  if (matches.length === 0) {
    const normalized = normalizeName(described.name || product.name)
    const key = NAME_ALIASES[normalized] ?? normalized
    matches = index.byName.get(key) ?? []
  }
  const bakery = described.bakery || vendor || bakeryForArticle(described.article)
  if (bakery) {
    const same = matches.filter((item) => item.vendor === bakery)
    if (same.length > 0) matches = same
  }
  const active = matches.filter((item) => item.status === "active")
  const list = active.length > 0 ? active : matches
  return uniqueQuotes(
    list.flatMap((item) =>
      item.price == null ? [] : [{ vendor: item.vendor, price: item.price }],
    ),
  )
}

function uniqueQuotes(quotes: Quote[]) {
  const seen = new Set<string>()
  const unique: Quote[] = []
  for (const quote of [...quotes].sort(
    (left, right) => (VENDOR_RANK[left.vendor] ?? 9) - (VENDOR_RANK[right.vendor] ?? 9),
  )) {
    const key = `${quote.vendor}:${quote.price}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(quote)
  }
  return unique
}

function priceNote(missing: boolean, quotes: Quote[]) {
  if (quotes.length === 0) return "Нет в каталоге — укажите цену."
  const listed = quotes.map((quote) => `${quote.vendor} ${formatPrice(quote.price)}`).join(", ")
  if (missing) return `Не у всех одинаковая цена. В каталоге: ${listed}.`
  return `В каталоге несколько цен: ${listed}.`
}

function normalizeName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de-DE")
    .replaceAll("ß", "ss")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function invoiceOrder(number: string) {
  const match = /^R(\d+)-(\d+)$/.exec(number)
  if (!match?.[1] || !match[2]) return 0
  return Number(match[1]) * 100000 + Number(match[2])
}

function invoiceFile(invoice: { number: string; issuedOn: string }) {
  const [year, month] = invoice.issuedOn.split("-")
  return path.join(INVOICE_DIR, year || "unknown", month || "00", `${invoice.number}.json`)
}

async function readInvoices() {
  let names: string[]
  try {
    names = await readdir(INVOICE_DIR, { recursive: true })
  } catch (error) {
    if (isMissingFile(error)) return []
    return []
  }
  const invoices: Invoice[] = []
  for (const name of names) {
    if (!name.endsWith(".json") || name.endsWith("sequence.json")) continue
    try {
      const parsed: unknown = JSON.parse(await readFile(path.join(INVOICE_DIR, name), "utf8"))
      const invoice = parseInvoice(parsed)
      if (invoice) invoices.push(invoice)
    } catch {
      continue
    }
  }
  return invoices
}

async function reserveInvoiceNumber(issuedOn: string) {
  const year = Number(issuedOn.slice(0, 4))
  const sequence = await readSequence()
  const serial = sequence[year] ?? firstInvoiceSerial(year)
  sequence[year] = serial + 1
  await mkdir(INVOICE_DIR, { recursive: true })
  await writeFile(SEQUENCE_FILE, `${JSON.stringify(sequence, null, 2)}\n`, "utf8")
  return invoiceNumber(year, serial)
}

async function readSequence() {
  try {
    const parsed: unknown = JSON.parse(await readFile(SEQUENCE_FILE, "utf8"))
    if (!parsed || typeof parsed !== "object") return {}
    const sequence: Record<number, number> = {}
    for (const [year, serial] of Object.entries(parsed)) {
      const yearNumber = Number(year)
      if (Number.isInteger(yearNumber) && typeof serial === "number" && serial >= 1) {
        sequence[yearNumber] = Math.floor(serial)
      }
    }
    return sequence
  } catch (error) {
    if (isMissingFile(error)) return {}
    return {}
  }
}

function parseInvoice(value: unknown): Invoice | null {
  if (!value || typeof value !== "object") return null
  const record = value as Partial<Invoice>
  if (!record.id || !record.number || !record.customerName || !Array.isArray(record.lines)) return null
  const lines = record.lines.flatMap((line) => {
    if (!line || typeof line !== "object") return []
    const item = line as Partial<InvoiceLine>
    if (!item.name || typeof item.quantity !== "number") return []
    if (typeof item.unitNet !== "number" || typeof item.amount !== "number") return []
    return [
      {
        name: item.name,
        quantity: item.quantity,
        unitNet: item.unitNet,
        tax: typeof item.tax === "number" ? item.tax : null,
        amount: item.amount,
      },
    ]
  })
  if (lines.length !== record.lines.length || lines.length === 0) return null
  return {
    id: String(record.id),
    number: String(record.number),
    issuedOn: String(record.issuedOn ?? ""),
    dueOn: String(record.dueOn ?? ""),
    periodFrom: String(record.periodFrom ?? ""),
    periodTo: String(record.periodTo ?? ""),
    periodLabel: String(record.periodLabel ?? ""),
    customerName: String(record.customerName),
    customerLines: Array.isArray(record.customerLines) ? record.customerLines.map(String) : [],
    lines,
    comment: record.comment ? String(record.comment) : "",
    source: "subscription",
    taxMode: record.taxMode === "separate" ? "separate" : "included",
    sentAt: record.sentAt ? String(record.sentAt) : null,
    sentTo: record.sentTo ? String(record.sentTo) : "",
  }
}

function addressLines(address: string) {
  return address
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function isMissingFile(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT")
}
