import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"

import { DocumentRange } from "@/components/document-range"
import { InvoiceDocument } from "@/components/invoice-document"
import { Button } from "@/components/ui/button"
import { portalSessionMatches } from "@/lib/b2b-passwords"
import { portalByToken, portalSubscriber } from "@/lib/b2b-portals"
import { addDays } from "@/lib/invoice-math"
import { listInvoices } from "@/lib/invoices"

export const metadata: Metadata = {
  title: "Rechnungen",
}

export default function RechnungenPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-2xl px-4 py-8">Rechnungen werden geladen…</main>}>
      <RechnungenBody params={params} />
    </Suspense>
  )
}

async function RechnungenBody({ params }: { params: Promise<{ token: string }> }) {
  await connection()
  const { token } = await params
  const portal = await portalByToken(token)
  if (!portal) notFound()
  if (!(await portalSessionMatches(portal.subscriberId))) {
    redirect(`/order/login?next=${encodeURIComponent(token)}`)
  }

  const subscriber = await portalSubscriber(portal.subscriberId)
  if (!subscriber) notFound()

  const name = subscriber.name.trim().toLocaleLowerCase("de")
  const invoices = (await listInvoices()).filter(
    (invoice) => invoice.customerName.trim().toLocaleLowerCase("de") === name,
  )
  const marked = [...new Set(invoices.flatMap((invoice) => periodDays(invoice.periodFrom, invoice.periodTo)))]

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 print:max-w-none print:gap-0 print:px-0 print:py-0">
      <div className="flex flex-col gap-3 print:hidden">
        <Button variant="outline" className="h-11 w-fit" render={<Link href={`/order/${token}`} />}>
          Zurück zur Bestellung
        </Button>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Alle Rechnungen</h1>
          <p className="text-sm text-muted-foreground">{subscriber.name}</p>
        </div>
      </div>
      {invoices.length === 0 ? (
        <p className="rounded-xl bg-card px-4 py-5 ring-1 ring-foreground/10">Noch keine Rechnungen.</p>
      ) : (
        <DocumentRange
          label="Alle Rechnungen herunterladen"
          marked={marked}
          emptyLabel="In diesem Zeitraum gibt es keine Rechnungen."
        >
          {invoices.map((invoice) => (
            <div key={invoice.id} data-range-from={invoice.periodFrom} data-range-to={invoice.periodTo}>
              <InvoiceDocument invoice={invoice} htmlId={null} />
            </div>
          ))}
        </DocumentRange>
      )}
    </main>
  )
}

function periodDays(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return []
  const days: string[] = []
  let cursor = from
  while (cursor <= to && days.length < 370) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}
