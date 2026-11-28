import type { Metadata } from "next"
import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"

import { B2bOrderForm } from "@/components/b2b-order-form"
import { OrderDocumentsMenu } from "@/components/order-documents-menu"
import { OrderCalendar } from "@/components/order-calendar"
import { blockedOrderDays } from "@/lib/bakery-closures"
import { portalSessionMatches } from "@/lib/b2b-passwords"
import { addDays } from "@/lib/delivery-date"
import { clientOrderStillOpen } from "@/lib/order-changes"
import {
  chosenPortalOrderDay,
  formatPortalDay,
  lieferscheinMark,
  lieferscheinNumber,
  portalByToken,
  portalClosedMessage,
  portalDayClosed,
  portalLieferscheine,
  portalOrder,
  portalOrderBounds,
  portalOrderHint,
  portalOrderVersions,
  portalRolls,
  portalSavedQuantities,
  portalSubscriber,
} from "@/lib/b2b-portals"

export const metadata: Metadata = {
  title: "Bestellung",
}

function calendarViewMax(orderMax: string) {
  let last = orderMax
  for (const day of blockedOrderDays()) {
    if (day > last) last = day
  }
  const [year, month] = last.split("-").map(Number)
  if (!year || !month) return orderMax
  const endDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${last.slice(0, 7)}-${String(endDay).padStart(2, "0")}`
}

export default function B2bOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ date?: string }>
}) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl px-4 py-8">Bestellung wird geladen…</main>}>
      <OrderBody params={params} searchParams={searchParams} />
    </Suspense>
  )
}

async function OrderBody({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ date?: string }>
}) {
  await connection()
  const { token } = await params
  const portal = await portalByToken(token)
  if (!portal) notFound()
  if (!(await portalSessionMatches(portal.subscriberId))) {
    redirect(`/order/login?next=${encodeURIComponent(token)}`)
  }

  const subscriber = await portalSubscriber(portal.subscriberId)
  if (!subscriber) notFound()

  const day = chosenPortalOrderDay((await searchParams).date, portal.bakery)
  const bounds = portalOrderBounds()
  const [rolls, existing, versions, notes] = await Promise.all([
    portalRolls(portal.bakery),
    portalOrder(portal.subscriberId, day),
    portalOrderVersions(portal.subscriberId, day),
    portalLieferscheine(portal.subscriberId),
  ])
  const saved = portalSavedQuantities(rolls, existing)
  const ordered = notes.map((note) => note.day).filter((date) => date >= bounds.min && date <= bounds.max)
  const viewMax = calendarViewMax(bounds.max)
  const closed = []
  for (let date = `${bounds.min.slice(0, 7)}-01`; date <= viewMax; date = addDays(date, 1)) {
    if (portalDayClosed(date, portal.bakery)) closed.push(date)
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm text-muted-foreground">{portal.bakery} · Bestellung</p>
          <h1 className="text-2xl font-semibold tracking-tight">{subscriber.name}</h1>
          <p className="text-lg">{formatPortalDay(day)}</p>
          <p className="text-sm text-muted-foreground">{portalOrderHint(portal.bakery, day)}</p>
        </div>
        <OrderDocumentsMenu token={token} />
      </div>
      <OrderCalendar
        token={token}
        selected={day}
        min={bounds.min}
        max={bounds.max}
        ordered={ordered}
        closed={closed}
        viewMax={viewMax}
      />
      <B2bOrderForm
        key={day}
        token={token}
        day={day}
        rolls={rolls.map(({ id, name, image, group, price }) => ({ id, name, image, group, price }))}
        saved={saved}
        customerName={subscriber.name}
        address={subscriber.address}
        dayLabel={formatPortalDay(day)}
        lieferscheinNumber={lieferscheinNumber(day, lieferscheinMark(portal.subscriberId))}
        versions={versions}
        orderOpen={clientOrderStillOpen(portal.bakery, day)}
        closedMessage={portalClosedMessage(portal.bakery, day)}
      />
    </main>
  )
}
