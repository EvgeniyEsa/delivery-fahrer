import type { Metadata } from "next"
import { Suspense } from "react"

import { ImportOrdersButton } from "@/components/import-orders-button"
import { LiveOrderSync } from "@/components/live-order-sync"
import { StoredOrdersCard } from "@/components/stored-orders-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Панель управления",
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Панель управления доставками
          </h1>
          <p className="text-sm text-muted-foreground">
            Заказы из Shopify подтягиваются сами при открытии страницы и дальше
            каждую минуту.
          </p>
        </div>
        <ImportOrdersButton />
      </div>
      <LiveOrderSync />
      <Suspense fallback={<OrdersFallback />}>
        <StoredOrdersCard title="Заказы" />
      </Suspense>
    </div>
  )
}

function OrdersFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Заказы</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  )
}
