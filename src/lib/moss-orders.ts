import { addDays } from "@/lib/delivery-date"

// Order day → how many days later the bread is delivered.
// Clients must send a Moss order before 11:45 on that order day.
// Sunday's Wednesday order missed after 11:45 goes out on Monday.
const ORDER_OFFSETS: Record<number, number[]> = {
  0: [3],
  1: [2],
  2: [2],
  3: [2],
  4: [2, 3],
  5: [3, 4],
  6: [4],
}

const LATEST_LEAD: Record<number, number> = {
  0: 3,
  1: 3,
  2: 4,
  3: 2,
  4: 2,
  5: 2,
  6: 2,
}

export function mossOrderDeadline(deliveryDay: string) {
  const weekday = isoWeekday(deliveryDay)
  if (weekday == null) return ""
  return addDays(deliveryDay, -(LATEST_LEAD[weekday] ?? 0))
}

export function mossCutoffOpen(now = new Date()) {
  const { hour, minute } = berlinClock(now)
  return hour < 11 || (hour === 11 && minute < 45)
}

export function mossDeliveryStillOpen(deliveryDay: string, now = new Date()) {
  const deadline = mossOrderDeadline(deliveryDay)
  if (!deadline) return false
  const today = berlinDate(now)
  if (today < deadline) return true
  if (today > deadline) return false
  return mossCutoffOpen(now)
}

export function mossDeliveriesOrderedOn(orderDay: string, now = new Date()) {
  const weekday = isoWeekday(orderDay)
  if (weekday == null) return []
  if (weekday === 0 && berlinDate(now) === orderDay && !mossCutoffOpen(now)) return []
  return (ORDER_OFFSETS[weekday] ?? []).map((offset) => addDays(orderDay, offset))
}

export function sundayOrderOpen(now = new Date()) {
  return mossCutoffOpen(now)
}

function isoWeekday(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return null
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay()
}

function berlinDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(now)
}

function berlinClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0")
  return { hour: value("hour"), minute: value("minute") }
}
