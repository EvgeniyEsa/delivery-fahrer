import type { Metadata } from "next"
import { Suspense } from "react"

import { DeliveryPlanner } from "@/components/delivery-planner"
import { LiveOrderSync } from "@/components/live-order-sync"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { listPlannableOrders } from "@/lib/orders"
import { pickupStops } from "@/lib/partner-stops"
import { listLocatedPartners } from "@/lib/partners"
import { listLocatedSubscribers } from "@/lib/subscribers"
import { subscriptionStops } from "@/lib/route-stops"

export const metadata: Metadata = {
  title: "Планирование доставок",
}

export default function RoutesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Планирование доставок
        </h1>
        <p className="text-sm text-muted-foreground">
          В день входят заказы, абонементы и заезды к партнёрам. Партнёры идут в заданном порядке, затем доставки.
        </p>
      </div>
      <LiveOrderSync />
      <Suspense fallback={<PlannerFallback />}>
        <PlannerSection />
      </Suspense>
    </div>
  )
}

async function PlannerSection() {
  const [orders, subscribers, partners] = await Promise.all([
    listPlannableOrders(),
    listLocatedSubscribers(),
    listLocatedPartners(),
  ])
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim() ?? ""
  const mapboxToken = token.startsWith("sk.") ? "" : token
  const subscriptions = subscriptionStops(subscribers)
  const days = [
    ...orders.map((order) => order.deliveryDate ?? ""),
    ...subscriptions.map((stop) => stop.deliveryDate ?? ""),
  ]
  return (
    <DeliveryPlanner
      orders={[
        ...orders,
        ...subscriptions,
        ...pickupStops(partners, days),
      ]}
      mapboxToken={mapboxToken}
    />
  )
}

function PlannerFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Доставки</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  )
}
