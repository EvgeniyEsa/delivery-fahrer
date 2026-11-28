import { listB2bPortals } from "@/lib/b2b-portals"
import { subscriberClosedOn } from "@/lib/bakery-closures"
import { listDeliveryTimes } from "@/lib/delivery-log"
import { eveningOrderKey, listEveningOrders } from "@/lib/evening-orders"
import { readDriverHome, type DriverHome } from "@/lib/driver-home"
import { arrangeAroundAnchors } from "@/lib/routing"
import { listStoredOrders } from "@/lib/orders"
import { listLocatedPartners } from "@/lib/partners"
import { pickupStops } from "@/lib/partner-stops"
import {
  bakeryFromName,
  bakeryHint,
  catalogNameLookup,
  driverBakeryLookup,
  productPhotoLookup,
  productSkuLookup,
} from "@/lib/product-photos"
import type { DriverBakery } from "@/lib/product-photos"
import { isEggName } from "@/lib/product-article"
import { listProducts } from "@/lib/products"
import { expandForBakery } from "@/lib/set-parts"
import { subscriptionStops } from "@/lib/route-stops"
import { getShopifyOrderItems, type ShopifyOrderItem } from "@/lib/shopify"
import { listSubscribers } from "@/lib/subscribers"
import type { OrderStatus } from "@/lib/mock-orders"

export type DriverItem = {
  name: string
  quantity: number
  image: string
  amount?: number | null
  bakery: DriverBakery | ""
  article: string
}

export type DriverStop = {
  id: string
  number: string
  customer: string
  phone: string
  address: string
  latitude: number | null
  longitude: number | null
  summary: string
  status: OrderStatus
  deliveredAt: string | null
  canComplete: boolean
  bakery: DriverBakery | ""
  items: DriverItem[]
  deliveryPrice: number | null
}

const SUBSCRIPTION_ID = /^sub:([^:]+):/
const PICKUP_ID = /^pick:([^:]+):/

export async function listDriverStops(day: string): Promise<DriverStop[]> {
  const [orders, subscribers, partners, catalog, deliveredAt, home, eveningOrders, portals] =
    await Promise.all([
      listStoredOrders(),
      listSubscribers({ published: true }),
      listLocatedPartners(),
      listProducts(),
      listDeliveryTimes(),
      readDriverHome(),
      listEveningOrders(),
      listB2bPortals(),
    ])
  const portalBakery = new Map(portals.map((portal) => [portal.subscriberId, portal.bakery]))
  const photo = productPhotoLookup(catalog)
  const skuOf = productSkuLookup(catalog)
  const nameOf = catalogNameLookup(catalog)
  const bakeryOf = driverBakeryLookup(catalog)
  const subscriberById = new Map(subscribers.map((subscriber) => [subscriber.id, subscriber]))
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]))

  const todayOrders = orders.filter((order) => order.deliveryDate === day)
  let shopifyItems = new Map<string, ShopifyOrderItem[]>()
  try {
    shopifyItems = await getShopifyOrderItems(
      todayOrders.flatMap((order) => (order.shopifyOrderId ? [order.shopifyOrderId] : [])),
    )
  } catch (error) {
    console.error("[driver items]", error instanceof Error ? error.message : error)
  }

  function itemsFor(
    products: Array<{ name: string; quantity: number; article?: string; amount?: number | null }>,
    vendor = "",
  ): DriverItem[] {
    return products.flatMap((product) => {
      const name = product.name.trim()
      if (!name || product.quantity <= 0 || isDeliveryFee(name)) return []
      const tip = isTip(name)
      const egg = isEggName(name)
      const bakery = tip || egg ? "" : bakeryOf(product, vendor)
      return [
        {
          name: tip ? "Trinkgeld" : name,
          quantity: product.quantity,
          image: tip || egg ? "" : photo({ name, article: product.article, vendor }),
          amount: tip ? product.amount ?? null : null,
          bakery,
          article: tip || egg ? "" : skuOf({ name, article: product.article, bakery }),
        },
      ]
    })
  }

  const pickups: DriverStop[] = pickupStops(partners, [day])
    .map((stop): DriverStop => {
      const partnerId = PICKUP_ID.exec(stop.id)?.[1] ?? ""
      const partner = partnerById.get(partnerId)
      return {
        id: stop.id,
        number: stop.number,
        customer: stop.customer,
        phone: stop.phone,
        address: driverAddress(stop.address),
        latitude: stop.latitude,
        longitude: stop.longitude,
        summary: stop.summary,
        status: "pending" as const,
        deliveredAt: deliveredAt.get(stop.id) ?? null,
        canComplete: false,
        bakery: bakeryFromName(stop.customer) || bakeryFromName(partner?.comment ?? ""),
        items: partner ? itemsFor(partner.products, bakeryHint(partner.comment)) : [],
        deliveryPrice: null,
      }
    })

  const subscriptions: DriverStop[] = subscriptionStops(subscribers)
    .filter((stop) => stop.deliveryDate === day)
    .map((stop): DriverStop => {
      const subscriberId = SUBSCRIPTION_ID.exec(stop.id)?.[1] ?? ""
      const subscriber = subscriberById.get(subscriberId)
      return {
        id: stop.id,
        number: stop.number,
        customer: stop.customer,
        phone: stop.phone,
        address: driverAddress(stop.address),
        latitude: subscriber?.latitude ?? null,
        longitude: subscriber?.longitude ?? null,
        summary: stop.summary,
        status: "pending" as const,
        deliveredAt: deliveredAt.get(stop.id) ?? null,
        canComplete: false,
        bakery: "",
        items: subscriber
          ? itemsFor(
              eveningOrders.get(eveningOrderKey(subscriber.id, day)) ?? subscriber.products,
              eveningOrders.has(eveningOrderKey(subscriber.id, day))
                ? portalBakery.get(subscriber.id) ?? "Kockartz"
                : bakeryHint(subscriber.comment),
            )
          : [],
        deliveryPrice: subscriber?.deliveryPrice ?? null,
      }
    })

  const deliveries: DriverStop[] = todayOrders.map((order): DriverStop => ({
    id: order.id,
    number: order.number,
    customer: order.customer,
    phone: order.phone,
    address: driverAddress(order.address),
    latitude: order.latitude ?? null,
    longitude: order.longitude ?? null,
    summary: "",
    status: order.status,
    deliveredAt: deliveredAt.get(order.id) ?? null,
    canComplete: true,
    bakery: "",
    items: itemsFor(
      (shopifyItems.get(order.shopifyOrderId) ?? []).map((line: ShopifyOrderItem) => ({
        name: line.name,
        quantity: line.quantity,
        article: line.sku,
        amount: line.amount,
      })),
    ),
    deliveryPrice: null,
  }))

  const scheduled = new Set(subscriptions.map((stop) => stop.id))
  for (const [key, lines] of eveningOrders) {
    const split = key.lastIndexOf("|")
    const subscriberId = key.slice(0, split)
    const orderDay = key.slice(split + 1)
    if (orderDay !== day || lines.length === 0) continue
    const id = `sub:${subscriberId}:${day}`
    if (scheduled.has(id)) continue
    const subscriber = subscriberById.get(subscriberId)
    if (!subscriber || subscriberClosedOn(subscriber, orderDay)) continue
    const added: DriverStop = {
      id,
      number: "Або",
      customer: subscriber.name,
      phone: subscriber.phone,
      address: driverAddress(subscriber.address || "Адрес не указан"),
      latitude: subscriber.latitude,
      longitude: subscriber.longitude,
      summary: "",
      status: "pending",
      deliveredAt: deliveredAt.get(id) ?? null,
      canComplete: false,
      bakery: "",
      items: itemsFor(lines, portalBakery.get(subscriberId) ?? "Kockartz"),
      deliveryPrice: subscriber.deliveryPrice,
    }
    subscriptions.push(added)
  }

  const open = deliveries.filter((stop) => stop.status !== "delivered")
  const done = deliveries.filter((stop) => stop.status === "delivered")

  return arrangeDriverRoute(
    withBakeryInvoices(
      [...pickups, ...open, ...subscriptions, ...done],
      nameOf,
      skuOf,
      photo,
    ),
    home,
  )
}

function withBakeryInvoices(
  stops: DriverStop[],
  catalogName: (article: string, bakery: string) => string,
  articleForName: (input: { name: string; article?: string; bakery?: string }) => string,
  photo: (input: { name: string; article?: string; vendor?: string }) => string,
) {
  const totals = new Map<DriverBakery, Map<string, DriverItem>>()
  const eggs = new Map<string, DriverItem>()

  for (const stop of stops) {
    if (stop.id.startsWith("pick:")) continue
    for (const item of stop.items) {
      if (item.name === "Trinkgeld") continue
      if (isEggName(item.name)) {
        const key = item.name.toLocaleLowerCase("de-DE")
        const current = eggs.get(key)
        if (current) current.quantity += item.quantity
        else {
          eggs.set(key, {
            name: item.name,
            quantity: item.quantity,
            image: "",
            amount: null,
            bakery: "",
            article: "",
          })
        }
        continue
      }
      const pieces =
        expandForBakery(item, {
          nameForArticle: catalogName,
          articleForName: (name, bakery) => articleForName({ name, bakery }),
        }) ?? [item]
      for (const piece of pieces) {
        if (!piece.bakery) continue
        const rows = totals.get(piece.bakery) ?? new Map()
        const label = piece.article ? catalogName(piece.article, piece.bakery) : ""
        const key = label
          ? piece.article
          : `${piece.article}|${piece.name.toLocaleLowerCase("de-DE")}`
        const current = rows.get(key)
        if (current) {
          current.quantity += piece.quantity
          if (!current.article) current.article = piece.article
        } else {
          rows.set(key, {
            name: label || piece.name,
            quantity: piece.quantity,
            image: photo({ name: piece.name, article: piece.article, vendor: piece.bakery }),
            amount: null,
            bakery: piece.bakery,
            article: piece.article,
          })
        }
        totals.set(piece.bakery, rows)
      }
    }
  }

  return stops.map((stop) => {
    if (!stop.id.startsWith("pick:") || !stop.bakery) return stop
    const items = [...(totals.get(stop.bakery)?.values() ?? [])].sort(compareByArticle)
    if (stop.bakery === "Heidbüchel") {
      items.push(...[...eggs.values()].sort((left, right) => left.name.localeCompare(right.name, "de")))
    }
    return { ...stop, items }
  })
}

function compareByArticle(left: DriverItem, right: DriverItem) {
  const leftKey = articleKey(left.article)
  const rightKey = articleKey(right.article)
  if (leftKey.group !== rightKey.group) return leftKey.group - rightKey.group
  if (leftKey.number !== rightKey.number) return leftKey.number - rightKey.number
  return left.name.localeCompare(right.name, "de")
}

function articleKey(article: string) {
  const match = article.match(/^([A-Za-zА-Яа-я])?(\d+)(.*)$/)
  if (!article) return { group: 2, number: 0 }
  if (!match?.[2]) return { group: 1, number: 0 }
  return { group: 0, number: Number(match[2]) }
}

function arrangeDriverRoute(stops: DriverStop[], home: DriverHome) {
  const finished = stops
    .filter(isDelivered)
    .sort((left, right) => (left.deliveredAt ?? "").localeCompare(right.deliveredAt ?? ""))
  const pending = stops.filter((stop) => !isDelivered(stop))
  const anchors = pending.filter(isLocated).filter((stop) => stop.id.startsWith("pick:"))
  const visitors = pending.filter(isLocated).filter((stop) => !stop.id.startsWith("pick:"))
  const unlocated = pending.filter(
    (stop) => stop.latitude == null || stop.longitude == null,
  )
  const anchorByBakery = new Map(
    anchors.flatMap((stop) => (stop.bakery ? [[stop.bakery, stop.id] as const] : [])),
  )
  const end =
    home.latitude != null && home.longitude != null
      ? {
          id: "home",
          address: home.address,
          latitude: home.latitude,
          longitude: home.longitude,
        }
      : null
  const ordered = arrangeAroundAnchors(
    anchors,
    visitors.map((stop) => ({
      id: stop.id,
      address: stop.address,
      latitude: stop.latitude ?? 0,
      longitude: stop.longitude ?? 0,
      afterAnchorIds: pickupIdsBefore(stop, anchorByBakery),
    })),
    end,
  )
  const byId = new Map(pending.map((stop) => [stop.id, stop]))

  return [
    ...ordered.flatMap((stop) => {
      const found = byId.get(stop.id)
      return found ? [found] : []
    }),
    ...unlocated,
    ...finished,
  ]
}

function pickupIdsBefore(stop: DriverStop, anchorByBakery: Map<DriverBakery, string>) {
  const needed = bakeriesOn(stop)
  const bakeries = needed.length > 0 ? needed : [...anchorByBakery.keys()]
  return bakeries.flatMap((bakery) => {
    const anchorId = anchorByBakery.get(bakery)
    return anchorId ? [anchorId] : []
  })
}

function bakeriesOn(stop: DriverStop) {
  const names = new Set<DriverBakery>()
  let unknown = false
  if (stop.bakery) names.add(stop.bakery)
  for (const item of stop.items) {
    if (item.name === "Trinkgeld" || isDeliveryFee(item.name) || isEggName(item.name)) continue
    if (item.bakery) names.add(item.bakery)
    else unknown = true
  }
  if (unknown) return []
  return [...names]
}

function isDelivered(stop: DriverStop) {
  return Boolean(stop.deliveredAt) || (stop.canComplete && stop.status === "delivered")
}

function isLocated(stop: DriverStop): stop is DriverStop & { latitude: number; longitude: number } {
  return stop.latitude != null && stop.longitude != null
}

function driverAddress(address: string) {
  return address
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !/^(germany|deutschland|германия)$/i.test(part))
    .join(", ")
}

function isDeliveryFee(name: string) {
  return /^(lieferung|delivery)$/i.test(name)
}

function isTip(name: string) {
  return /^(tip|trinkgeld)$/i.test(name)
}
