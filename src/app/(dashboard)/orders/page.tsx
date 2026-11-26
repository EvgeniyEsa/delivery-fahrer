import type { Metadata } from "next"
import { Suspense } from "react"

import { LiveOrderSync } from "@/components/live-order-sync"
import { StoredOrdersCard } from "@/components/stored-orders-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Заказы",
}

export default function OrdersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Заказы</h1>
        <p className="text-sm text-muted-foreground">
          Номер, имя, адрес и комментарий. Сверху самые новые. Заказы из Shopify
          подтягиваются при открытии страницы и дальше каждую минуту. Дату
          доставки можно изменить в таблице.
        </p>
      </div>
      <LiveOrderSync />
      <Suspense fallback={<OrdersFallback />}>
        <StoredOrdersCard title="Список заказов" />
      </Suspense>
    </div>
  )
}

function OrdersFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Список заказов</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  )
}
