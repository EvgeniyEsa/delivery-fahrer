"use client"

import { useEffect, useState, useTransition } from "react"

import { closeOrderDay, openOrderDay, toggleBakeryStatus } from "@/app/(dashboard)/exceptions/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "cn"

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]

type BakeryCode = "H" | "M" | "K"

type Row = {
  key: string
  label: string
  closed: BakeryCode[]
}

const COLUMNS: Array<{ code: BakeryCode; name: string; sheet: string }> = [
  { code: "H", name: "Heidbüchel", sheet: "Heidbüchel" },
  { code: "M", name: "Moss", sheet: "Moss" },
  { code: "K", name: "Kockartz", sheet: "Kockartz" },
]

export function ExceptionsBoard({
  rows: initialRows,
  blocked: initialBlocked,
  today,
}: {
  rows: Row[]
  blocked: string[]
  today: string
}) {
  const [rows, setRows] = useState(initialRows)
  const [blocked, setBlocked] = useState(initialBlocked)
  const [month, setMonth] = useState(today.slice(0, 7))
  const blockedKey = initialBlocked.join("|")
  useEffect(() => {
    setBlocked(initialBlocked)
  }, [blockedKey, initialBlocked])
  const [selected, setSelected] = useState("")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const selectedClosed = blocked.includes(selected)

  function toggle(row: Row, code: BakeryCode) {
    setError("")
    startTransition(async () => {
      const result = await toggleBakeryStatus(row.key, code)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setRows((current) =>
        current.map((item) => {
          if (item.key !== row.key) return item
          const closed = new Set(item.closed)
          if (closed.has(code)) closed.delete(code)
          else closed.add(code)
          return { ...item, closed: COLUMNS.map((column) => column.code).filter((itemCode) => closed.has(itemCode)) }
        }),
      )
    })
  }

  function confirmDay() {
    if (!selected) return
    setError("")
    startTransition(async () => {
      const result = selectedClosed ? await openOrderDay(selected) : await closeOrderDay(selected)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setBlocked(result.blocked)
    })
  }

  function openListedDay(day: string) {
    setError("")
    setSelected(day)
    setMonth(day.slice(0, 7))
    startTransition(async () => {
      const result = await openOrderDay(day)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setBlocked(result.blocked)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>Закрыть заказы на день</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="max-w-xl text-sm text-muted-foreground">
            Выберите дату и подтвердите. В этот день пекарни не работают и Bestellung нет. Уже закрытый день можно открыть кнопкой в списке.
          </p>
          <div className="w-full max-w-sm rounded-xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                className="size-9 rounded-lg border text-lg"
                aria-label="Предыдущий месяц"
                onClick={() => setMonth((current) => shiftMonth(current, -1))}
              >
                ‹
              </button>
              <div className="text-sm font-medium">{monthTitle(month)}</div>
              <button
                type="button"
                className="size-9 rounded-lg border text-lg"
                aria-label="Следующий месяц"
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
              {monthCells(month).map((day, index) => {
                if (!day) return <div key={`empty-${index}`} />
                const closed = blocked.includes(day)
                const active = day === selected
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={active}
                    aria-label={formatDay(day)}
                    className={cn(
                      "flex h-10 flex-col items-center justify-center rounded-lg text-sm",
                      closed && "font-medium text-red-700 line-through",
                      active && !closed && "bg-primary text-primary-foreground",
                      active && closed && "bg-red-100 ring-2 ring-red-700",
                      !active && !closed && "hover:bg-muted",
                    )}
                    onClick={() => setSelected(day)}
                  >
                    {Number(day.slice(8))}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={!selected || pending} onClick={confirmDay}>
              {pending ? "Сохраняю…" : selectedClosed ? "Открыть день" : "Закрыть день"}
            </Button>
            <p className="text-sm text-muted-foreground">
              {selected ? formatDay(selected) : "Дата не выбрана"}
            </p>
          </div>
          {blocked.length > 0 ? (
            <ul className="flex max-w-md flex-col gap-2 text-sm">
              {blocked.map((day) => (
                <li key={day} className="flex items-center justify-between gap-3">
                  <span>
                    {formatDay(day)} — заказов нет
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => openListedDay(day)}
                  >
                    Открыть
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Пекарни</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <p className="px-4 pb-3 text-sm text-muted-foreground">
            Нажмите ячейку, чтобы переключить «закрыта» и «работает». Эти дни повторяются каждый год.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Дата</TableHead>
                {COLUMNS.map((bakery) => (
                  <TableHead key={bakery.code}>
                    <span className="block">{bakery.name}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{bakery.sheet}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="pl-4 font-medium">{row.label}</TableCell>
                  {COLUMNS.map((bakery) => {
                    const closed = row.closed.includes(bakery.code)
                    return (
                      <TableCell key={bakery.code} className="p-1">
                        <button
                          type="button"
                          disabled={pending}
                          aria-pressed={closed}
                          aria-label={`${bakery.name}, ${row.label}, ${closed ? "закрыта" : "работает"}`}
                          className={cn(
                            "inline-flex min-w-24 rounded-md px-2 py-1 text-xs font-medium",
                            closed ? "bg-red-100 text-red-900" : "bg-green-100 text-green-900",
                          )}
                          onClick={() => toggle(row, bakery.code)}
                        >
                          {closed ? "закрыта" : "работает"}
                        </button>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function formatDay(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number)
  if (!year || !month || !day) return isoDate
  return new Intl.DateTimeFormat("ru-RU", {
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
  for (let day = 1; day <= count; day += 1) cells.push(`${month}-${String(day).padStart(2, "0")}`)
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
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthNumber - 1, 1)),
  )
}
