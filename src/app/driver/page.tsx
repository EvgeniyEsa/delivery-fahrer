import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { logoutDriver } from "@/app/driver/actions"
import { DriverList, formatEuro, tipTotal } from "@/components/driver-list"
import { Skeleton } from "@/components/ui/skeleton"
import {
  addDays,
  clampDriverDay,
  driverDayBounds,
  formatDeliveryDay,
  todayInBerlin,
} from "@/lib/delivery-date"
import { requireDriverSession } from "@/lib/driver-auth"
import { listDriverStops } from "@/lib/driver-stops"
import { drivingPath } from "@/lib/routing"

export const metadata: Metadata = {
  title: "Водитель",
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
    const stops = await listDriverStops(day)
    const located = stops.flatMap((stop) => {
      if (stop.latitude == null || stop.longitude == null) return []
      return [
        {
          id: stop.id,
          address: stop.address,
          latitude: stop.latitude,
          longitude: stop.longitude,
        },
      ]
    })
    const path = await drivingPath(located)
    return (
      <>
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <p className="text-sm font-medium text-muted-foreground">Delivery Manager</p>
          <form action={logoutDriver} className="justify-self-end">
            <button type="submit" className="text-sm text-muted-foreground">
              Выйти
            </button>
          </form>
          <h1 className="text-3xl font-semibold tracking-tight">Водитель</h1>
          <div className="justify-self-end text-right">
            <p className="text-sm font-medium leading-tight">
              {day === today ? "Trinkgeld heute" : "Trinkgeld"}
            </p>
            <p className="text-base font-semibold tabular-nums leading-tight">
              {formatEuro(tipTotal(stops))}
            </p>
          </div>
        </header>
        <DriverList
          key={day}
          day={day}
          dayLabel={formatDeliveryDay(day)}
          stops={stops}
          path={path}
          previousHref={day > min ? `/driver?day=${addDays(day, -1)}` : null}
          nextHref={day < max ? `/driver?day=${addDays(day, 1)}` : null}
          error={reportedError ? "Не удалось сохранить время доставки" : null}
        />
      </>
    )
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Не удалось загрузить заказы"
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
