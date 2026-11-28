"use client"

import Link from "next/link"
import { useState } from "react"

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

export function OrderCalendar({
  token,
  selected,
  min,
  max,
  ordered,
  closed,
  viewMax = max,
}: {
  token: string
  selected: string
  min: string
  max: string
  ordered: string[]
  closed: string[]
  viewMax?: string
}) {
  const [month, setMonth] = useState(selected.slice(0, 7))
  const orderedDays = new Set(ordered)
  const closedDays = new Set(closed)
  const cells = monthCells(month)
  const minMonth = min.slice(0, 7)
  const maxMonth = viewMax.slice(0, 7)

  return (
    <section className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="size-11 rounded-xl border text-xl disabled:opacity-40"
          aria-label="Vorheriger Monat"
          disabled={month <= minMonth}
          onClick={() => setMonth((current) => shiftMonth(current, -1))}
        >
          ‹
        </button>
        <h2 className="text-lg font-semibold">{monthTitle(month)}</h2>
        <button
          type="button"
          className="size-11 rounded-xl border text-xl disabled:opacity-40"
          aria-label="Nächster Monat"
          disabled={month >= maxMonth}
          onClick={() => setMonth((current) => shiftMonth(current, 1))}
        >
          ›
        </button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} />
          const number = Number(day.slice(8))
          const inRange = day >= min && day <= max
          const isClosed = closedDays.has(day)
          if (isClosed) {
            return (
              <div
                key={day}
                className="flex h-11 items-center justify-center rounded-xl text-sm font-medium text-red-700 line-through"
                aria-label={`${formatDay(day)}, geschlossen`}
              >
                {number}
              </div>
            )
          }
          if (!inRange) {
            return (
              <div key={day} className="flex h-11 items-center justify-center rounded-xl text-muted-foreground/50">
                {number}
              </div>
            )
          }
          const isSelected = day === selected
          return (
            <Link
              key={day}
              href={`/order/${token}?date=${day}`}
              aria-label={formatDay(day)}
              aria-current={isSelected ? "date" : undefined}
              className={`flex h-11 flex-col items-center justify-center rounded-xl text-sm ${
                isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              }`}
            >
              <span>{number}</span>
              {orderedDays.has(day) ? (
                <span
                  className={`mt-0.5 size-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-primary"}`}
                />
              ) : (
                <span className="mt-0.5 size-1.5" />
              )}
            </Link>
          )
        })}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Punkt = bereits bestellt. Durchgestrichene Tage: die Bäckerei hat geschlossen, eine Bestellung ist nicht möglich.
      </p>
    </section>
  )
}

function formatDay(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  if (!year || !month || !day) return isoDate
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Berlin",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

function monthCells(month: string) {
  const [year, monthNumber] = month.split("-").map(Number)
  if (!year || !monthNumber) return []
  const first = new Date(Date.UTC(year, monthNumber - 1, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const cells: Array<string | null> = Array.from({ length: offset }, () => null)
  for (let day = 1; day <= count; day++) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`)
  }
  return cells
}

function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number)
  if (!year || !monthNumber) return month
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function monthTitle(month: string) {
  const [year, monthNumber] = month.split("-").map(Number)
  if (!year || !monthNumber) return month
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1, 12)))
}
