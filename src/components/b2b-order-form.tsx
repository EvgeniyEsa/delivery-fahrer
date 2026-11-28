"use client"

import { Fragment, useActionState, useEffect, useRef, useState } from "react"

import { submitB2bOrder, type PortalOrderState } from "@/app/order/[token]/actions"
import { LieferscheinNote } from "@/components/lieferschein-note"
import { Button } from "@/components/ui/button"
import { formatOrderClock, type OrderVersion } from "@/lib/order-changes"

type Roll = {
  id: string
  name: string
  image: string
  group: string
  price: number | null
}

export function B2bOrderForm({
  token,
  rolls,
  saved,
  customerName,
  address,
  dayLabel,
  lieferscheinNumber,
  versions,
  day,
  orderOpen,
  closedMessage,
}: {
  token: string
  rolls: Roll[]
  saved: Record<string, number>
  customerName: string
  address: string
  dayLabel: string
  lieferscheinNumber: string | null
  versions: OrderVersion[]
  day: string
  orderOpen: boolean
  closedMessage: string
}) {
  const [state, action, pending] = useActionState(submitB2bOrder, null)
  const [quantities, setQuantities] = useState(saved)
  const lines = rolls.flatMap((roll) => {
    const quantity = quantities[roll.id] ?? 0
    if (quantity <= 0) return []
    return [{ name: roll.name, quantity, unitPrice: roll.price }]
  })
  const history = state?.ok ? state.versions : versions
  const savedAt = history.at(-1)?.at
  const hasLieferschein = history.length > 0
  const editing = hasLieferschein && quantitiesDiffer(rolls, quantities, committedQuantities(rolls, state, saved))
  const review = hasLieferschein && !editing
  const notice = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!state) return
    const show = () => {
      const element = notice.current
      if (!element) return
      element.focus({ preventScroll: true })
      element.scrollIntoView({ behavior: "smooth", block: "center" })
    }
    show()
    const timers = [250, 700].map((delay) => window.setTimeout(show, delay))
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [state])

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="day" value={day} />
      <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        <table className="w-full text-left">
          <thead className="bg-muted/60 text-sm">
            <tr>
              <th className="px-3 py-3 font-medium">Artikel</th>
              <th className="px-3 py-3 text-right font-medium">Menge</th>
            </tr>
          </thead>
          <tbody>
            {rolls.map((roll, index) => (
              <Fragment key={roll.id}>
                {index === 0 || rolls[index - 1]?.group !== roll.group ? (
                  <tr className="border-t bg-muted/40">
                    <td className="px-3 py-2 text-sm font-semibold" colSpan={2}>
                      {roll.group}
                    </td>
                  </tr>
                ) : null}
                <tr className="border-t">
                  <td className="px-3 py-3" colSpan={2}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        {roll.image ? (
                          <img
                            src={roll.image}
                            alt=""
                            className="size-16 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="block size-16 shrink-0 rounded-lg bg-black/5" />
                        )}
                        <span className="font-medium">{roll.name}</span>
                      </div>
                      <QuantityStepper
                        name={`qty-${roll.id}`}
                        label={roll.name}
                        value={quantities[roll.id] ?? 0}
                        onChange={(quantity) =>
                          setQuantities((current) => ({ ...current, [roll.id]: quantity }))
                        }
                      />
                    </div>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {state?.ok ? (
        <p
          ref={notice}
          tabIndex={-1}
          role="status"
          className="rounded-xl bg-green-100 px-4 py-3 text-green-950 outline-none"
        >
          {state.changed
            ? `${history.length > 1 ? "Änderung" : "Bestellung"} gespeichert${savedAt ? ` um ${formatOrderClock(savedAt)} Uhr` : ""}. Wir liefern am ${dayLabel}: ${state.pieces} Stück.`
            : "Die Mengen sind unverändert."}
        </p>
      ) : null}
      {state && !state.ok ? (
        <p ref={notice} tabIndex={-1} role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-destructive outline-none">
          {state.error}
        </p>
      ) : null}
      <LieferscheinNote
        number={lieferscheinNumber}
        customerName={customerName}
        address={address}
        dayLabel={dayLabel}
        lines={lines}
        versions={history}
      />
      {!orderOpen ? (
        <p className="rounded-xl bg-amber-100 px-4 py-3 text-amber-950">
          {closedMessage}
        </p>
      ) : null}
      <Button
        type={review || !orderOpen ? "button" : "submit"}
        size="lg"
        className="h-12 text-base"
        disabled={pending || !orderOpen}
        onClick={review && orderOpen ? () => window.scrollTo({ top: 0, behavior: "smooth" }) : undefined}
      >
        {pending
          ? hasLieferschein
            ? "Wird gespeichert…"
            : "Wird gesendet…"
          : !orderOpen
            ? "Bestellung geschlossen"
            : editing
            ? "Lieferschein speichern"
            : hasLieferschein
              ? "Lieferschein ändern"
              : "Bestellung senden"}
      </Button>
    </form>
  )
}

function committedQuantities(rolls: Roll[], state: PortalOrderState, saved: Record<string, number>) {
  if (!state?.ok) return saved
  const remaining = state.lines.map((line) => ({ name: line.name, quantity: line.quantity }))
  const committed: Record<string, number> = {}
  for (const roll of rolls) {
    const index = remaining.findIndex((line) => line.name === roll.name)
    committed[roll.id] = index === -1 ? 0 : (remaining.splice(index, 1)[0]?.quantity ?? 0)
  }
  return committed
}

function quantitiesDiffer(rolls: Roll[], current: Record<string, number>, committed: Record<string, number>) {
  return rolls.some((roll) => (current[roll.id] ?? 0) !== (committed[roll.id] ?? 0))
}

function QuantityStepper({
  name,
  label,
  value,
  onChange,
}: {
  name: string
  label: string
  value: number
  onChange: (quantity: number) => void
}) {
  function setQuantity(next: number) {
    if (!Number.isInteger(next)) return
    onChange(Math.min(999, Math.max(0, next)))
  }

  return (
    <div className="ml-auto flex items-center justify-end gap-2">
      <button
        type="button"
        aria-label={`${label} weniger`}
        disabled={value <= 0}
        onClick={() => setQuantity(value - 1)}
        className="size-14 shrink-0 rounded-xl border bg-background text-3xl leading-none disabled:opacity-40"
      >
        −
      </button>
      <input
        name={name}
        value={value === 0 ? "" : String(value)}
        inputMode="numeric"
        aria-label={`Menge ${label}`}
        onChange={(event) => {
          const raw = event.target.value.trim()
          if (raw === "") {
            setQuantity(0)
            return
          }
          if (!/^\d{1,3}$/.test(raw)) return
          setQuantity(Number(raw))
        }}
        className="h-14 w-16 rounded-xl border bg-background text-center text-xl tabular-nums"
      />
      <button
        type="button"
        aria-label={`${label} mehr`}
        onClick={() => setQuantity(value + 1)}
        className="size-14 shrink-0 rounded-xl border bg-background text-3xl leading-none"
      >
        +
      </button>
    </div>
  )
}
