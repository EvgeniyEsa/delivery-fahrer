export const VAT_RATE = 0.07

export type InvoiceLine = {
  name: string
  quantity: number
  unitNet: number | null
  tax: number | null
  amount: number | null
}

export type Invoice = {
  id: string
  number: string
  issuedOn: string
  dueOn: string
  periodFrom: string
  periodTo: string
  periodLabel: string
  customerName: string
  customerLines: string[]
  lines: InvoiceLine[]
  comment: string
  source: "example" | "subscription"
  taxMode: "separate" | "included"
  sentAt?: string | null
  sentTo?: string
}

export type InvoiceDraftLine = {
  key: string
  name: string
  quantity: number
  gross: string
  note: string
}

export type InvoiceDraft = {
  clientKey: string
  from: string
  to: string
  customerName: string
  customerLines: string[]
  issuedOn: string
  dueOn: string
  periodFrom: string
  periodTo: string
  periodLabel: string
  lines: InvoiceDraftLine[]
  warnings: string[]
}

export function roundMoney(value: number, digits = 2) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

export function formatEuro(value: number, digits = 2) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatInvoiceDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day) return iso
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function formatPeriod(from: string, to: string) {
  if (from === to) return formatShort(to, true)
  const [fromYear, fromMonth, fromDay] = from.split("-")
  const [toYear] = to.split("-")
  if (fromYear === toYear) return `${fromDay}.${fromMonth}. - ${formatShort(to, true)}`
  return `${formatShort(from, true)} - ${formatShort(to, true)}`
}

export function invoiceNumber(year: number, serial: number) {
  const suffix = String(year).slice(-2).padStart(2, "0")
  return `R${suffix}-${String(serial).padStart(4, "0")}`
}

export function firstInvoiceSerial(year: number) {
  return year === 2026 ? 1700 : 1
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day) return iso
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function parseGross(value: string) {
  const cleaned = value.trim().replaceAll("€", "").replaceAll(" ", "").replace(",", ".")
  if (!cleaned) return null
  const price = Number(cleaned)
  if (!Number.isFinite(price) || price < 0) return null
  return roundMoney(price)
}

export function formatGrossInput(value: number) {
  return value.toFixed(2).replace(".", ",")
}

export function lineFromGross(name: string, quantity: number, gross: number): InvoiceLine {
  return {
    name,
    quantity,
    unitNet: gross,
    tax: null,
    amount: roundMoney(quantity * gross),
  }
}

export function invoiceTotals(lines: InvoiceLine[]) {
  const total = roundMoney(lines.reduce((sum, line) => sum + (line.amount ?? 0), 0))
  return { net: total, tax: 0, total }
}

function formatShort(iso: string, withYear: boolean) {
  const [year, month, day] = iso.split("-")
  if (!year || !month || !day) return iso
  return withYear ? `${day}.${month}.${year}` : `${day}.${month}.`
}
