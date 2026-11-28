import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { DocumentRange } from "@/components/document-range"
import { LieferscheinNote } from "@/components/lieferschein-note"
import { Button } from "@/components/ui/button"
import { portalSessionMatches } from "@/lib/b2b-passwords"
import { clientOrderStillOpen } from "@/lib/order-changes"
import {
  formatPortalDay,
  lieferscheinMark,
  lieferscheinNumber,
  portalByToken,
  portalLieferscheine,
  portalNote,
  portalOrderDayAllowed,
  portalRolls,
  portalSubscriber,
} from "@/lib/b2b-portals"

export const metadata: Metadata = {
  title: "Lieferscheine",
}

export default function LieferscheinePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl px-4 py-8">Lieferscheine werden geladen…</main>}>
      <LieferscheineBody params={params} />
    </Suspense>
  )
}

async function LieferscheineBody({ params }: { params: Promise<{ token: string }> }) {
  await connection()
  const { token } = await params
  const portal = await portalByToken(token)
  if (!portal) notFound()
  if (!(await portalSessionMatches(portal.subscriberId))) {
    redirect(`/order/login?next=${encodeURIComponent(token)}`)
  }

  const subscriber = await portalSubscriber(portal.subscriberId)
  if (!subscriber) notFound()

  const [rolls, notes] = await Promise.all([
    portalRolls(portal.bakery),
    portalLieferscheine(portal.subscriberId),
  ])

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 print:max-w-none print:gap-0 print:px-0 print:py-0">
      <div className="flex flex-col gap-3 print:hidden">
        <Button variant="outline" className="h-11 w-fit" render={<Link href={`/order/${token}`} />}>
          Zurück zur Bestellung
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Alle Lieferscheine</h1>
          <p className="text-sm text-muted-foreground">{subscriber.name}</p>
        </div>
      </div>
      {notes.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-5 ring-1 ring-foreground/10">Noch keine Lieferscheine gesendet.</p>
      ) : (
        <DocumentRange
          label="Alle Lieferscheine herunterladen"
          marked={notes.map((note) => note.day)}
          emptyLabel="In diesem Zeitraum gibt es keine Lieferscheine."
        >
          {notes.map((note) => (
            <div key={note.day} data-range-from={note.day} data-range-to={note.day} className="flex flex-col gap-3">
              <LieferscheinNote
                number={lieferscheinNumber(note.day, lieferscheinMark(portal.subscriberId))}
                customerName={subscriber.name}
                address={subscriber.address}
                dayLabel={formatPortalDay(note.day)}
                lines={portalNote(rolls, note.lines)}
                versions={note.versions}
              />
              {portalOrderDayAllowed(note.day, portal.bakery) && clientOrderStillOpen(portal.bakery, note.day) ? (
                <Button
                  className="h-12 text-base print:hidden"
                  render={<Link href={`/order/${token}?date=${note.day}#top`} />}
                >
                  Lieferschein ändern
                </Button>
              ) : null}
            </div>
          ))}
        </DocumentRange>
      )}
    </main>
  )
}
