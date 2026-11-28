import { subscriberClosedOn } from "@/lib/bakery-closures"
import type { PlannableOrder } from "@/lib/orders"
import { describeProduct } from "@/lib/product-article"
import { listLocatedSubscribers } from "@/lib/subscribers"
import type { Subscriber } from "@/lib/subscriber-types"

const STOP_ID = /^sub:([^:]+):(\d{4}-\d{2}-\d{2})$/

export function subscriptionStopId(subscriberId: string, deliveryDate: string) {
  return `sub:${subscriberId}:${deliveryDate}`
}

export function subscriptionStops(subscribers: Subscriber[]): PlannableOrder[] {
  return subscribers.flatMap((subscriber) => {
    if (subscriber.archivedAt) return []
    return subscriber.deliveryDates.flatMap((deliveryDate) => {
      const stop = toSubscriptionStop(subscriber, deliveryDate)
      return stop ? [stop] : []
    })
  })
}

export async function listSubscriptionStopsByIds(ids: string[]): Promise<PlannableOrder[]> {
  const wanted = ids.flatMap((id) => {
    const match = STOP_ID.exec(id)
    if (!match?.[1] || !match[2]) return []
    return [{ id, subscriberId: match[1], deliveryDate: match[2] }]
  })
  if (wanted.length === 0) return []

  const subscribers = new Map(
    (await listLocatedSubscribers()).map((subscriber) => [subscriber.id, subscriber]),
  )

  return wanted.flatMap((stop) => {
    const subscriber = subscribers.get(stop.subscriberId)
    if (!subscriber || subscriber.archivedAt || !subscriber.deliveryDates.includes(stop.deliveryDate)) {
      return []
    }
    const planned = toSubscriptionStop(subscriber, stop.deliveryDate)
    return planned ? [planned] : []
  })
}

function toSubscriptionStop(
  subscriber: Subscriber,
  deliveryDate: string,
): PlannableOrder | null {
  if (subscriberClosedOn(subscriber, deliveryDate)) return null

  return {
    id: subscriptionStopId(subscriber.id, deliveryDate),
    shopifyOrderId: "",
    number: "Або",
    customer: subscriber.name,
    phone: subscriber.phone,
    address: subscriber.address || "Адрес не указан",
    status: "pending",
    deliveryDate,
    latitude: subscriber.latitude,
    longitude: subscriber.longitude,
    source: "subscription",
    sequence: 0,
    summary: [
      subscriber.products.map((product) => describeProduct(product).line).join(", "),
      subscriber.deliveryPrice == null
        ? ""
        : `Доставка ${new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(subscriber.deliveryPrice)}`,
      subscriber.comment,
    ]
      .filter(Boolean)
      .join(" · "),
  }
}
