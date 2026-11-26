import { listDeliveryTimes } from "@/lib/delivery-log"
import { listStoredOrders } from "@/lib/orders"
import { listPartners } from "@/lib/partners"
import { pickupStops } from "@/lib/partner-stops"
import { bakeryHint, productPhotoLookup } from "@/lib/product-photos"
import { listProducts } from "@/lib/products"
import { subscriptionStops } from "@/lib/route-stops"
import { getShopifyOrderItems } from "@/lib/shopify"
import { listSubscribers } from "@/lib/subscribers"
import type { OrderStatus } from "@/lib/mock-orders"

export type DriverItem = {
  name: string
  quantity: number
  image: string
  amount?: number | null
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
  items: DriverItem[]
  deliveryPrice: number | null
}

const SUBSCRIPTION_ID = /^sub:([^:]+):/
const PICKUP_ID = /^pick:([^:]+):/

export async function listDriverStops(day: string): Promise<DriverStop[]> {
  const [orders, subscribers, partners, catalog, deliveredAt] = await Promise.all([
    listStoredOrders(),
    listSubscribers({ published: true }),
    listPartners(),
    listProducts(),
    listDeliveryTimes(),
  ])
  const photo = productPhotoLookup(catalog)
  const subscriberById = new Map(subscribers.map((subscriber) => [subscriber.id, subscriber]))
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]))

  const todayOrders = orders.filter((order) => order.deliveryDate === day)
  let shopifyItems = new Map<string, { name: string; quantity: number; sku: string }[]>()
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
      return [
        {
          name: tip ? "Trinkgeld" : name,
          quantity: product.quantity,
          image: tip ? "" : photo({ name, article: product.article, vendor }),
          amount: tip ? product.amount ?? null : null,
        },
      ]
    })
  }

  const pickups = pickupStops(partners, [day])
    .map((stop) => {
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
        items: partner ? itemsFor(partner.products, bakeryHint(partner.comment)) : [],
        deliveryPrice: null,
      }
    })

  const subscriptions = subscriptionStops(subscribers)
    .filter((stop) => stop.deliveryDate === day)
    .map((stop) => {
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
        items: subscriber
          ? itemsFor(subscriber.products, bakeryHint(subscriber.comment))
          : [],
        deliveryPrice: subscriber?.deliveryPrice ?? null,
      }
    })

  const deliveries = todayOrders.map((order) => ({
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
    items: itemsFor(shopifyItems.get(order.shopifyOrderId) ?? []),
    deliveryPrice: null,
  }))

  const open = deliveries.filter((stop) => stop.status !== "delivered")
  const done = deliveries.filter((stop) => stop.status === "delivered")

  return [...pickups, ...open, ...subscriptions, ...done]
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
