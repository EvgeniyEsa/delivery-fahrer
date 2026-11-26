"use client"

import { useState } from "react"
import { Popover } from "@base-ui/react/popover"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"

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

export function DeliveryDatePicker({
  value,
  disabled,
  orderNumber,
  onSelect,
}: {
  value: string
  disabled?: boolean
  orderNumber: string
  onSelect: (isoDate: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = parseIso(value)
  const [visible, setVisible] = useState(
    () => selected ?? currentMonth(),
  )
  const label = value ? formatDeliveryDay(value) : "Выбрать дату"

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setVisible(selected ?? currentMonth())
      }}
    >
      <Popover.Trigger
        disabled={disabled}
        aria-label={
          value
            ? `Дата доставки ${orderNumber}, ${label}. Открыть календарь`
            : `Дата доставки ${orderNumber}. Открыть календарь`
        }
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-auto min-h-8 min-w-44 justify-start py-1.5 font-normal whitespace-normal",
        )}
      >
        <Calendar />
        {label}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
          <Popover.Popup className="w-72 rounded-lg border bg-popover p-3 text-popover-foreground shadow-md outline-none">
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
                    aria-pressed={cell === value}
                    onClick={() => {
                      onSelect(cell)
                      setOpen(false)
                    }}
                    className={cn(
                      "h-8 rounded-md text-sm hover:bg-muted",
                      cell === value &&
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
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function currentMonth() {
  const today = new Date()
  return { year: today.getFullYear(), month: today.getMonth() + 1 }
}

function parseIso(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) }
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
