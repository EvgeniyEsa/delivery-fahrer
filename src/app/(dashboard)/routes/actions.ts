"use server"

import { eveningOrderKey, listEveningOrders } from "@/lib/evening-orders"
import { readDriverHome } from "@/lib/driver-home"
import { listOrdersByIds, type PlannableOrder } from "@/lib/orders"
import { listPickupStopsByIds } from "@/lib/partner-stops"
import { isEggName } from "@/lib/product-article"
import { bakeryFromName, bakeryHint, driverBakeryLookup, type DriverBakery } from "@/lib/product-photos"
import { listProducts } from "@/lib/products"
import { listSubscriptionStopsByIds } from "@/lib/route-stops"
import {
  buildDeliveryPlan,
  depot,
  measureRoadRoute,
  type AnchoredStop,
} from "@/lib/routing"
import { getShopifyOrderItems, type ShopifyOrderItem } from "@/lib/shopify"
import { listSubscribers } from "@/lib/subscribers"
import { requireOfficeSession } from "@/lib/office-session"

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
  await requireOfficeSession()
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

  const afterAnchor = await anchorsBeforeDelivery(orders)
  const ready = orders.flatMap((order) => {
    if (order.latitude === null || order.longitude === null) return []

    const stop: AnchoredStop & DeliveryStop = {
      id: order.id,
      number: order.number,
      customer: order.customer,
      phone: order.phone,
      address: order.address,
      latitude: order.latitude,
      longitude: order.longitude,
      afterAnchorIds: afterAnchor.get(order.id) ?? [],
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
  const home = await readDriverHome()
  const plan = await buildDeliveryPlan(
    ready,
    pickupOrder,
    home.latitude != null && home.longitude != null
      ? {
          id: "home",
          address: home.address,
          latitude: home.latitude,
          longitude: home.longitude,
        }
      : null,
  )
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
  await requireOfficeSession()
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

async function anchorsBeforeDelivery(orders: PlannableOrder[]) {
  const anchorByBakery = new Map<DriverBakery, string>()
  for (const order of orders) {
    if (order.source !== "pickup") continue
    const bakery = bakeryFromName(order.customer)
    if (bakery) anchorByBakery.set(bakery, order.id)
  }

  const deliveries = orders.filter((order) => order.source !== "pickup")
  const [catalog, subscribers, eveningOrders] = await Promise.all([
    listProducts(),
    listSubscribers(),
    listEveningOrders(),
  ])
  const bakeryOf = driverBakeryLookup(catalog)
  const subscriberById = new Map(subscribers.map((subscriber) => [subscriber.id, subscriber]))
  let shopifyItems = new Map<string, ShopifyOrderItem[]>()
  try {
    shopifyItems = await getShopifyOrderItems(
      deliveries.flatMap((order) => (order.shopifyOrderId ? [order.shopifyOrderId] : [])),
    )
  } catch (error) {
    console.error("[route bakeries]", error instanceof Error ? error.message : error)
  }

  const result = new Map<string, string[]>()
  for (const order of deliveries) {
    const lines = linesFor(order, subscriberById, eveningOrders, shopifyItems)
    const needed = new Set<DriverBakery>()
    const goods = lines.filter((line) => !isEggName(line.name))
    let unknown = goods.length === 0 && lines.length === 0
    for (const line of goods) {
      const bakery = bakeryOf(line, line.hint)
      if (bakery) needed.add(bakery)
      else unknown = true
    }
    const bakeries = unknown ? [...anchorByBakery.keys()] : [...needed]
    result.set(
      order.id,
      bakeries.flatMap((bakery) => {
        const anchorId = anchorByBakery.get(bakery)
        return anchorId ? [anchorId] : []
      }),
    )
  }
  return result
}

function linesFor(
  order: PlannableOrder,
  subscriberById: Map<string, Awaited<ReturnType<typeof listSubscribers>>[number]>,
  eveningOrders: Awaited<ReturnType<typeof listEveningOrders>>,
  shopifyItems: Map<string, ShopifyOrderItem[]>,
) {
  const subscription = /^sub:([^:]+):(\d{4}-\d{2}-\d{2})$/.exec(order.id)
  if (subscription?.[1] && subscription[2]) {
    const subscriber = subscriberById.get(subscription[1])
    if (!subscriber) return []
    const evening = eveningOrders.get(eveningOrderKey(subscriber.id, subscription[2]))
    const products = evening && evening.length > 0 ? evening : subscriber.products
    const hint = evening && evening.length > 0 ? "Kockartz" : bakeryHint(subscriber.comment)
    return products.flatMap((product) => {
      const name = product.name.trim()
      if (!name || product.quantity <= 0 || isFeeOrTip(name)) return []
      return [{ name, article: product.article, hint }]
    })
  }

  return (shopifyItems.get(order.shopifyOrderId) ?? []).flatMap((line) => {
    const name = line.name.trim()
    if (!name || isFeeOrTip(name)) return []
    return [{ name, article: line.sku, hint: "" }]
  })
}

function isFeeOrTip(name: string) {
  return /^(lieferung|delivery|tip|trinkgeld)$/i.test(name.trim())
}
