"use server"

import { listOrdersByIds, type PlannableOrder } from "@/lib/orders"
import { listPickupStopsByIds } from "@/lib/partner-stops"
import { listSubscriptionStopsByIds } from "@/lib/route-stops"
import {
  buildDeliveryPlan,
  depot,
  measureRoadRoute,
  type RouteStop,
} from "@/lib/routing"

export type DeliveryStop = {
  id: string
  number: string
  customer: string
  phone: string
  address: string
  latitude: number
  longitude: number
}

export type DeliveryPlanResult =
  | {
      ok: true
      depotName: string
      depotAddress: string
      deliveryDate: string | null
      stops: DeliveryStop[]
      skippedWithoutCoordinates: number
      distanceMeters: number
      durationSeconds: number
      geometry: Array<[number, number]>
      roadRoute: boolean
    }
  | { ok: false; error: string }

const MAX_STOPS = 50

export async function planDeliveries(
  orderIds: string[],
): Promise<DeliveryPlanResult> {
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return { ok: false, error: "Выберите хотя бы одну доставку" }
  }

  const uniqueIds = [...new Set(orderIds.map(String))]

  if (uniqueIds.length > MAX_STOPS) {
    return {
      ok: false,
      error: `За один маршрут можно выбрать не больше ${MAX_STOPS} заказов`,
    }
  }

  const orderIdsOnly = uniqueIds.filter(
    (id) => !id.startsWith("sub:") && !id.startsWith("pick:"),
  )
  const subscriptionIds = uniqueIds.filter((id) => id.startsWith("sub:"))
  const pickupIds = uniqueIds.filter((id) => id.startsWith("pick:"))
  let orders: PlannableOrder[]

  try {
    const [storedOrders, subscriptionOrders, pickupOrders] = await Promise.all([
      listOrdersByIds(orderIdsOnly),
      listSubscriptionStopsByIds(subscriptionIds),
      listPickupStopsByIds(pickupIds),
    ])
    orders = [...storedOrders, ...subscriptionOrders, ...pickupOrders]
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Не удалось прочитать доставки",
    }
  }

  if (orders.length === 0) {
    return { ok: false, error: "Выбранные доставки не найдены" }
  }

  const deliveryDates = new Set(orders.map((order) => order.deliveryDate ?? ""))
  if (deliveryDates.size > 1) {
    return {
      ok: false,
      error: "Маршрут можно собрать только из доставок на один день",
    }
  }

  const ready = orders.flatMap((order) => {
    if (order.latitude === null || order.longitude === null) return []

    const stop: RouteStop & DeliveryStop = {
      id: order.id,
      number: order.number,
      customer: order.customer,
      phone: order.phone,
      address: order.address,
      latitude: order.latitude,
      longitude: order.longitude,
    }

    return [stop]
  })

  if (ready.length === 0) {
    return { ok: false, error: "У выбранных заказов нет координат" }
  }

  const pickupOrder = orders
    .filter((order) => order.source === "pickup")
    .sort((left, right) => left.sequence - right.sequence)
    .map((order) => order.id)
  const plan = await buildDeliveryPlan(ready, pickupOrder)
  const stopsById = new Map(ready.map((stop) => [stop.id, stop]))

  return {
    ok: true,
    depotName: depot.name,
    depotAddress: depot.address,
    deliveryDate: orders[0]?.deliveryDate ?? null,
    stops: plan.stops.flatMap((stop) => {
      const order = stopsById.get(stop.id)
      return order ? [order] : []
    }),
    skippedWithoutCoordinates: orders.length - ready.length,
    distanceMeters: plan.distanceMeters,
    durationSeconds: plan.durationSeconds,
    geometry: plan.geometry?.coordinates ?? [],
    roadRoute: plan.roadRoute,
  }
}

export async function remeasureDeliveries(
  stops: DeliveryStop[],
): Promise<
  | {
      ok: true
      distanceMeters: number
      durationSeconds: number
      geometry: Array<[number, number]>
      roadRoute: boolean
    }
  | { ok: false; error: string }
> {
  if (!Array.isArray(stops) || stops.length === 0) {
    return { ok: false, error: "В маршруте нет остановок" }
  }

  if (stops.length > MAX_STOPS) {
    return {
      ok: false,
      error: `За один маршрут можно выбрать не больше ${MAX_STOPS} заказов`,
    }
  }

  const routeStops = stops.flatMap((stop) => {
    if (
      typeof stop.latitude !== "number" ||
      typeof stop.longitude !== "number" ||
      !Number.isFinite(stop.latitude) ||
      !Number.isFinite(stop.longitude)
    ) {
      return []
    }

    return [
      {
        id: String(stop.id),
        address: String(stop.address ?? ""),
        latitude: stop.latitude,
        longitude: stop.longitude,
      },
    ]
  })

  if (routeStops.length !== stops.length) {
    return { ok: false, error: "У остановки нет координат" }
  }

  const plan = await measureRoadRoute(routeStops)

  return {
    ok: true,
    distanceMeters: plan.distanceMeters,
    durationSeconds: plan.durationSeconds,
    geometry: plan.geometry?.coordinates ?? [],
    roadRoute: plan.roadRoute,
  }
}
