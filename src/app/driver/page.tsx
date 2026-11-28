import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { listBakeryNotes } from "@/lib/bakery-notes"
import { readDriverHome } from "@/lib/driver-home"
import { DriverHeader } from "@/components/driver-header"
import { DriverList, formatEuro, tipTotal } from "@/components/driver-list"
import { Skeleton } from "@/components/ui/skeleton"
import {
  addDays,
  clampDriverDay,
  driverDayBounds,
  formatDriverDay,
  todayInBerlin,
} from "@/lib/delivery-date"
import { requireDriverSession } from "@/lib/driver-auth"
import { listDriverStops } from "@/lib/driver-stops"

export const metadata: Metadata = {
  title: "Fahrer",
}

export default function DriverPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string | string[]; error?: string | string[] }>
}) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-5">
      <Suspense fallback={<DriverFallback />}>
        <DriverToday searchParams={searchParams} />
      </Suspense>
    </main>
  )
}

async function DriverToday({
  searchParams,
}: {
  searchParams: Promise<{ day?: string | string[]; error?: string | string[] }>
}) {
  await connection()
  await requireDriverSession()
  const today = todayInBerlin()
  const params = await searchParams
  const requested = Array.isArray(params.day) ? params.day[0] : params.day
  const reportedError = Array.isArray(params.error) ? params.error[0] : params.error
  const day = clampDriverDay(requested, today)
  const { min, max } = driverDayBounds(today)

  try {
    const [stops, notes, home] = await Promise.all([
      listDriverStops(day),
      listBakeryNotes(day),
      readDriverHome(),
    ])
    return (
      <>
        <DriverHeader
          day={day}
          home={home}
          tipLabel={day === today ? "Trinkgeld heute" : "Trinkgeld"}
          tipAmount={formatEuro(tipTotal(stops))}
          settingsOpen={reportedError === "home"}
        />
        <DriverList
          key={day}
          day={day}
          dayLabel={formatDriverDay(day)}
          stops={stops}
          notes={notes}
          home={home}
          previousHref={day > min ? `/driver?day=${addDays(day, -1)}` : null}
          nextHref={day < max ? `/driver?day=${addDays(day, 1)}` : null}
          error={
            reportedError === "save"
              ? "Lieferzeit konnte nicht gespeichert werden"
              : reportedError === "home"
                ? "Adresse nicht gefunden. Straße und Ort angeben."
                : null
          }
        />
      </>
    )
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Aufträge konnten nicht geladen werden"
    return (
      <p className="rounded-xl bg-destructive/10 px-4 py-3 text-base text-destructive">
        {message}
      </p>
    )
  }
}

function DriverFallback() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  )
}
