"use client"

import { useRef, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]

export function DocumentRange({
  label,
  marked,
  emptyLabel,
  children,
}: {
  label: string
  marked: string[]
  emptyLabel: string
  children: ReactNode
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(startMonth(marked))
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [error, setError] = useState("")
  const markedDays = new Set(marked)
  const end = to || from

  function pick(day: string) {
    setError("")
    if (!from || to) {
      setFrom(day)
      setTo("")
      return
    }
    if (day < from) {
      setTo(from)
      setFrom(day)
      return
    }
    setTo(day)
  }

  function download() {
    if (!from) return
    const nodes = listRef.current?.querySelectorAll<HTMLElement>("[data-range-from]") ?? []
    let count = 0
    nodes.forEach((node) => {
      const start = node.dataset.rangeFrom ?? ""
      const finish = node.dataset.rangeTo ?? start
      const hit = start <= end && finish >= from
      if (hit) {
        delete node.dataset.printSkip
        count += 1
      } else {
        node.dataset.printSkip = "true"
      }
    })
    if (count === 0) {
      nodes.forEach((node) => delete node.dataset.printSkip)
      setError(emptyLabel)
      return
    }
    setError("")
    const done = () => {
      nodes.forEach((node) => delete node.dataset.printSkip)
      window.removeEventListener("afterprint", done)
    }
    window.addEventListener("afterprint", done)
    window.print()
  }

  return (
    <div className="flex flex-col gap-6">
      <style>{`
        @media print {
          [data-print-skip="true"] { display: none !important; }
        }
      `}</style>
      <div className="flex flex-col gap-3 print:hidden">
        <Button type="button" variant="outline" className="h-12 text-base" onClick={() => setOpen((current) => !current)}>
          {label}
        </Button>
        {open ? (
          <section className="rounded-xl bg-card p-3 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="size-11 rounded-xl border text-xl"
                aria-label="Vorheriger Monat"
                onClick={() => setMonth((current) => shiftMonth(current, -1))}
              >
                ‹
              </button>
              <h2 className="text-lg font-semibold">{monthTitle(month)}</h2>
              <button
                type="button"
                className="size-11 rounded-xl border text-xl"
                aria-label="Nächster Monat"
                onClick={() => setMonth((current) => shiftMonth(current, 1))}
              >
                ›
              </button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Erstes Datum ist der Anfang, zweites das Ende.
            </p>
            <p className="mt-1 text-sm">
              Von {from ? formatDay(from) : "…"}
              {to ? ` bis ${formatDay(to)}` : ""}
            </p>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthCells(month).map((day, index) => {
                if (!day) return <div key={`empty-${index}`} />
                const selected = day === from || day === end
                const inside = Boolean(from && end && day > from && day < end)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-label={formatDay(day)}
                    aria-pressed={selected || inside}
                    className={`flex h-11 flex-col items-center justify-center rounded-xl text-sm ${
                      selected ? "bg-primary text-primary-foreground" : inside ? "bg-primary/15" : "hover:bg-muted"
                    }`}
                    onClick={() => pick(day)}
                  >
                    <span>{Number(day.slice(8))}</span>
                    {markedDays.has(day) ? (
                      <span className={`mt-0.5 size-1.5 rounded-full ${selected ? "bg-primary-foreground" : "bg-primary"}`} />
                    ) : (
                      <span className="mt-0.5 size-1.5" />
                    )}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Punkt = Dokument an diesem Tag.</p>
            <Button type="button" className="mt-3 h-12 w-full text-base" disabled={!from} onClick={download}>
              Herunterladen
            </Button>
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
          </section>
        ) : null}
      </div>
      <div ref={listRef} className="flex flex-col gap-6">
        {children}
      </div>
    </div>
  )
}

function startMonth(marked: string[]) {
  const latest = [...marked].sort().at(-1)
  if (latest) return latest.slice(0, 7)
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
  }).format(new Date())
}

function formatDay(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  if (!year || !month || !day) return isoDate
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function monthCells(month: string) {
  const [year, monthNumber] = month.split("-").map(Number)
  if (!year || !monthNumber) return []
  const offset = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  const cells: Array<string | null> = Array.from({ length: offset }, () => null)
  for (let day = 1; day <= count; day += 1) {
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
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)))
}
