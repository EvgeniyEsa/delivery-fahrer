import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { logoutDriver } from "@/app/driver/actions"
import { DriverList } from "@/components/driver-list"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDeliveryDay, todayInBerlin } from "@/lib/delivery-date"
import { requireDriverSession } from "@/lib/driver-auth"
import { listDriverStops } from "@/lib/driver-stops"

export const metadata: Metadata = {
  title: "Водитель",
}

export default function DriverPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-muted-foreground">Delivery Manager</p>
          <h1 className="text-3xl font-semibold tracking-tight">Водитель</h1>
        </div>
        <form action={logoutDriver}>
          <button type="submit" className="text-sm text-muted-foreground">
            Выйти
          </button>
        </form>
      </header>
      <Suspense fallback={<DriverFallback />}>
        <DriverToday />
      </Suspense>
    </main>
  )
}

async function DriverToday() {
  await connection()
  await requireDriverSession()
  const today = todayInBerlin()

  try {
    const stops = await listDriverStops(today)
    return <DriverList dayLabel={formatDeliveryDay(today)} stops={stops} />
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
