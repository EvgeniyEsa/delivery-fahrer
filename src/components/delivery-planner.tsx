"use client"

import dynamic from "next/dynamic"
import { useMemo, useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

import {
  planDeliveries,
  remeasureDeliveries,
  type DeliveryPlanResult,
  type DeliveryStop,
} from "@/app/(dashboard)/routes/actions"
import type { RouteMapPoint } from "@/components/route-map"
import { depot, measureOrderedRoute } from "@/lib/routing"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { formatDeliveryDay, todayInBerlin } from "@/lib/delivery-date"
import type { PlannableOrder } from "@/lib/orders"

const RouteMap = dynamic(
  () => import("@/components/route-map").then((mod) => mod.RouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[32rem] animate-pulse rounded-lg bg-muted" />
    ),
  },
)

const MapboxRouteMap = dynamic(
  () =>
    import("@/components/mapbox-route-map").then((mod) => mod.MapboxRouteMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[32rem] animate-pulse rounded-lg bg-muted" />
    ),
  },
)

type ReadyPlan = Extract<DeliveryPlanResult, { ok: true }>

function deliveryKey(order: PlannableOrder) {
  return order.deliveryDate ?? ""
}

function defaultDeliveryDay(orders: PlannableOrder[]) {
  const today = todayInBerlin()
  const dates = [...new Set(orders.map(deliveryKey).filter(Boolean))].sort()
  return dates.find((date) => date >= today) ?? dates[0] ?? ""
}

function ordersOnDay(orders: PlannableOrder[], day: string) {
  return orders
    .filter((order) => deliveryKey(order) === day)
    .sort((left, right) => {
      if (left.source === "pickup" && right.source !== "pickup") return -1
      if (right.source === "pickup" && left.source !== "pickup") return 1
      if (left.source === "pickup" && right.source === "pickup") {
        return left.sequence - right.sequence
      }
      return 0
    })
}

function formatDistance(meters: number) {
  return `${(meters / 1000).toFixed(1)} км`
}

function formatDuration(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} мин`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} ч` : `${hours} ч ${rest} мин`
}

function withMeasuredOrder(plan: ReadyPlan, stops: DeliveryStop[]): ReadyPlan {
  const measured = measureOrderedRoute(
    stops.map((stop) => ({
      id: stop.id,
      address: stop.address,
      latitude: stop.latitude,
      longitude: stop.longitude,
    })),
  )

  return {
    ...plan,
    stops,
    distanceMeters: measured.distanceMeters,
    durationSeconds: measured.durationSeconds,
    geometry: measured.geometry?.coordinates ?? [],
  }
}

export function DeliveryPlanner({
  orders,
  mapboxToken,
}: {
  orders: PlannableOrder[]
  mapboxToken: string
}) {
  const [day, setDay] = useState(() => defaultDeliveryDay(orders))
  const [selected, setSelected] = useState(() =>
    ordersOnDay(orders, defaultDeliveryDay(orders))
      .filter((order) => order.latitude !== null && order.longitude !== null)
      .map((order) => order.id),
  )
  const [pending, startTransition] = useTransition()
  const [plan, setPlan] = useState<ReadyPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const visibleOrders = useMemo(
    () => ordersOnDay(orders, day),
    [orders, day],
  )
  const selectable = visibleOrders.filter(
    (order) => order.latitude !== null && order.longitude !== null,
  )
  const days = useMemo(() => {
    const counts = new Map<string, number>()
    for (const order of orders) {
      const key = deliveryKey(order)
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    return [...counts.entries()].sort(([left], [right]) => {
      if (!left) return 1
      if (!right) return -1
      return left.localeCompare(right)
    })
  }, [orders])

  function chooseDay(nextDay: string) {
    setDay(nextDay)
    setPlan(null)
    setError(null)
    setSelected(
      ordersOnDay(orders, nextDay)
        .filter((order) => order.latitude !== null && order.longitude !== null)
        .map((order) => order.id),
    )
  }

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      if (checked) return current.includes(id) ? current : [...current, id]
      return current.filter((item) => item !== id)
    })
  }

  const mapPoints = useMemo(() => {
    const depotPoint: RouteMapPoint = {
      id: depot.id,
      latitude: depot.latitude,
      longitude: depot.longitude,
      kind: "depot",
      label: "B",
      title: depot.name,
      detail: depot.address,
    }
    const stops: RouteMapPoint[] = plan
      ? plan.stops.map((stop, index) => ({
          id: stop.id,
          latitude: stop.latitude,
          longitude: stop.longitude,
          kind: "stop",
          label: String(index + 1),
          title: `${index + 1}. ${stop.number} · ${stop.customer}`,
          detail: stop.address,
        }))
      : visibleOrders.flatMap((order) => {
          if (!selectedSet.has(order.id)) return []
          if (order.latitude === null || order.longitude === null) return []

          return [
            {
              id: order.id,
              latitude: order.latitude,
              longitude: order.longitude,
              kind: "stop" as const,
              label: "•",
              title: `${order.number} · ${order.customer}`,
              detail: order.address,
            },
          ]
        })

    return [depotPoint, ...stops]
  }, [plan, visibleOrders, selectedSet])
  const mapPath = useMemo(
    () =>
      plan?.geometry.map(
        ([longitude, latitude]) => [latitude, longitude] as [number, number],
      ) ?? [],
    [plan],
  )

  function moveStop(fromId: string, toId: string) {
    if (!plan || fromId === toId) return
    const stops = [...plan.stops]
    const from = stops.findIndex((stop) => stop.id === fromId)
    const to = stops.findIndex((stop) => stop.id === toId)
    if (from < 0 || to < 0) return
    const [moved] = stops.splice(from, 1)
    if (!moved) return
    stops.splice(to, 0, moved)
    const orderKey = stops.map((stop) => stop.id).join("|")
    setPlan(withMeasuredOrder(plan, stops))
    if (!mapboxToken) return

    startTransition(async () => {
      const result = await remeasureDeliveries(stops)
      if (!result.ok) return
      setPlan((current) => {
        if (!current) return current
        if (current.stops.map((stop) => stop.id).join("|") !== orderKey) {
          return current
        }
        return {
          ...current,
          distanceMeters: result.distanceMeters,
          durationSeconds: result.durationSeconds,
          geometry: result.geometry,
          roadRoute: result.roadRoute,
        }
      })
    })
  }

  function buildPlan() {
    setError(null)
    startTransition(async () => {
      const result = await planDeliveries(selected)

      if (!result.ok) {
        setPlan(null)
        setError(result.error)
        return
      }

      setPlan(result)
    })
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Нет заказов для доставки</CardTitle>
          <CardDescription>
            Сначала синхронизируйте заказы на панели управления.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Доставки</CardTitle>
          <CardDescription>
            {day ? formatDeliveryDay(day) : "Без даты доставки"}. Выбрано{" "}
            {selected.length} из {selectable.length}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">День доставки</span>
            <select
              value={day}
              onChange={(event) => chooseDay(event.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2"
            >
              {days.map(([date, count]) => (
                <option key={date || "none"} value={date}>
                  {date ? formatDeliveryDay(date) : "Без даты"} · {count}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelected(selectable.map((order) => order.id))}
            >
              Выбрать все
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSelected([])
                setPlan(null)
                setError(null)
              }}
            >
              Сбросить
            </Button>
            <Button type="button" disabled={pending} onClick={buildPlan}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Построить маршрут
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto pr-1">
            {visibleOrders.map((order) => {
              const hasCoordinates =
                order.latitude !== null && order.longitude !== null

              return (
                <Label
                  key={order.id}
                  className="items-start gap-3 rounded-lg border px-3 py-3 font-normal"
                >
                  <Checkbox
                    checked={selectedSet.has(order.id)}
                    disabled={!hasCoordinates}
                    onCheckedChange={(checked) => toggle(order.id, checked)}
                  />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="font-medium">
                      {order.number} · {order.customer}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {order.address}
                    </span>
                    {order.summary ? (
                      <span className="text-xs text-muted-foreground">{order.summary}</span>
                    ) : null}
                    {!hasCoordinates ? (
                      <span className="text-xs text-destructive">
                        Нет координат
                      </span>
                    ) : null}
                  </span>
                </Label>
              )
            })}
          </div>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-6 lg:sticky lg:top-4">
        <Card>
          <CardHeader>
            <CardTitle>Карта</CardTitle>
            <CardDescription>
              {plan
                ? `${plan.deliveryDate ? `${formatDeliveryDay(plan.deliveryDate)} · ` : ""}${plan.stops.length} остановок · ${formatDistance(plan.distanceMeters)} · ${formatDuration(plan.durationSeconds)}${plan.roadRoute ? " · по дорогам" : ""}`
                : "На карте пекарня и выбранные адреса этого дня."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {mapboxToken ? (
              <MapboxRouteMap
                token={mapboxToken}
                points={mapPoints}
                path={plan?.geometry ?? []}
              />
            ) : (
              <RouteMap points={mapPoints} path={mapPath} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Порядок</CardTitle>
            <CardDescription>
              {plan
                ? "Потяните номер заказа, чтобы поменять остановки местами."
                : "Сначала постройте маршрут — потом порядок можно поменять вручную."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {plan ? (
              <ol className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                <li className="rounded-lg border px-3 py-2 text-sm">
                  <span className="font-medium">{plan.depotName}</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    Старт · {plan.depotAddress}
                  </span>
                </li>
                {plan.stops.map((stop, index) => (
                  <li
                    key={stop.id}
                    onDragOver={(event) => {
                      event.preventDefault()
                      setOverId(stop.id)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      const fromId =
                        draggingId || event.dataTransfer.getData("text/plain")
                      if (fromId) moveStop(fromId, stop.id)
                      setDraggingId(null)
                      setOverId(null)
                    }}
                    className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                      overId === stop.id ? "border-foreground bg-muted" : ""
                    } ${draggingId === stop.id ? "opacity-50" : ""}`}
                  >
                    <button
                      type="button"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move"
                        event.dataTransfer.setData("text/plain", stop.id)
                        setDraggingId(stop.id)
                      }}
                      onDragEnd={() => {
                        setDraggingId(null)
                        setOverId(null)
                      }}
                      className="flex shrink-0 cursor-grab items-center gap-2 rounded-md bg-foreground px-2 py-1 font-medium text-background active:cursor-grabbing"
                      aria-label={`Перетащить ${stop.number}, сейчас ${index + 1}-й`}
                    >
                      <span>{index + 1}</span>
                      <span>{stop.number}</span>
                    </button>
                    <span className="min-w-0">
                      <span className="block font-medium">{stop.customer}</span>
                      <span className="mt-0.5 block text-muted-foreground">
                        {stop.address}
                        {stop.phone ? ` · ${stop.phone}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
                <li className="rounded-lg border px-3 py-2 text-sm">
                  <span className="font-medium">{plan.depotName}</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    Возврат · {plan.depotAddress}
                  </span>
                </li>
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                Соседние адреса собираются в один заход, без лишних крюков по городу.
              </p>
            )}
            {plan && plan.skippedWithoutCoordinates > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Без координат пропущено: {plan.skippedWithoutCoordinates}.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
