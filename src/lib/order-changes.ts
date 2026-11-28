import { addDays } from "@/lib/delivery-date"
import { mossDeliveryStillOpen } from "@/lib/moss-orders"

export const ORDER_CHANGE_DEADLINE_HOUR = 17

export type ClientBakery = "Heidbüchel" | "Moss" | "Kockartz"

export type OrderQuantity = {
  name: string
  quantity: number
}

export type OrderVersion = {
  at: string | null
  lines: OrderQuantity[]
}

export function diffOrderLines(before: OrderQuantity[], after: OrderQuantity[]) {
  const earlier = new Map(before.map((line) => [line.name, line.quantity]))
  const later = new Map(after.map((line) => [line.name, line.quantity]))
  const names = [...new Set([...earlier.keys(), ...later.keys()])].sort((left, right) =>
    left.localeCompare(right, "de"),
  )
  return names.flatMap((name) => {
    const from = earlier.get(name) ?? 0
    const to = later.get(name) ?? 0
    if (from === to) return []
    return [{ name, from, to }]
  })
}

export function formatOrderClock(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function clientOrderStillOpen(bakery: ClientBakery, deliveryDay: string, now = new Date()) {
  if (bakery === "Moss") return mossDeliveryStillOpen(deliveryDay, now)
  const deadlineDay = addDays(deliveryDay, -1)
  const today = berlinDate(now)
  if (today < deadlineDay) return true
  if (today > deadlineDay) return false
  const { hour, minute } = berlinClock(now)
  return hour < ORDER_CHANGE_DEADLINE_HOUR || (hour === ORDER_CHANGE_DEADLINE_HOUR && minute === 0)
}

export function orderChangeIsLate(deliveryDay: string, atIso: string) {
  const date = new Date(atIso)
  if (Number.isNaN(date.getTime())) return false
  const clock = berlinParts(date)
  if (clock.day >= deliveryDay) return true
  if (clock.day !== addDays(deliveryDay, -1)) return false
  return clock.hour > ORDER_CHANGE_DEADLINE_HOUR || (clock.hour === ORDER_CHANGE_DEADLINE_HOUR && clock.minute > 0)
}

function berlinDate(now: Date) {
  return berlinParts(now).day
}

function berlinClock(now: Date) {
  const clock = berlinParts(now)
  return { hour: clock.hour, minute: clock.minute }
}

function berlinParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
  return {
    day: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  }
}
