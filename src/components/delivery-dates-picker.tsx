"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { formatDeliveryDay } from "@/lib/delivery-date"
import { cn } from "cn"

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]
const MONTHS = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
]

export function DeliveryDatesPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (dates: string[]) => void
}) {
  const [visible, setVisible] = useState(() => monthOf(value[0]) ?? currentMonth())
  const selected = new Set(value)

  function toggle(isoDate: string) {
    const next = selected.has(isoDate)
      ? value.filter((date) => date !== isoDate)
      : [...value, isoDate]
    onChange([...next].sort())
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {value.length === 0
          ? "Даты не выбраны. Нажмите дни в календаре."
          : `Выбрано ${value.length}. Нажмите отмеченный день, чтобы убрать его.`}
      </p>
      <div className="w-80 rounded-lg border p-3">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            aria-label="Предыдущий месяц"
            onClick={() => setVisible((month) => shiftMonth(month, -1))}
          >
            <ChevronLeft />
          </button>
          <span className="text-sm font-medium capitalize">
            {MONTHS[visible.month - 1]} {visible.year}
          </span>
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
            aria-label="Следующий месяц"
            onClick={() => setVisible((month) => shiftMonth(month, 1))}
          >
            <ChevronRight />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {WEEKDAYS.map((weekday) => (
            <span key={weekday} className="py-1">
              {weekday}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {monthCells(visible).map((cell, index) =>
            cell ? (
              <button
                key={cell}
                type="button"
                aria-label={formatDeliveryDay(cell)}
                aria-pressed={selected.has(cell)}
                onClick={() => toggle(cell)}
                className={cn(
                  "h-8 rounded-md text-sm hover:bg-muted",
                  selected.has(cell) &&
                    "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                {Number(cell.slice(8))}
              </button>
            ) : (
              <span key={`empty-${index}`} />
            ),
          )}
        </div>
      </div>
    </div>
  )
}

function monthOf(isoDate: string | undefined) {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate ?? "")
  if (!match?.[1] || !match[2]) return null
  return { year: Number(match[1]), month: Number(match[2]) }
}

function currentMonth() {
  const today = new Date()
  return { year: today.getFullYear(), month: today.getMonth() + 1 }
}

function shiftMonth(month: { year: number; month: number }, delta: number) {
  const next = new Date(Date.UTC(month.year, month.month - 1 + delta, 1))
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 }
}

function monthCells(month: { year: number; month: number }) {
  const count = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate()
  const offset = (new Date(Date.UTC(month.year, month.month - 1, 1)).getUTCDay() + 6) % 7
  const cells: Array<string | null> = Array.from({ length: offset }, () => null)

  for (let day = 1; day <= count; day += 1) {
    cells.push(
      `${month.year}-${String(month.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    )
  }

  return cells
}
