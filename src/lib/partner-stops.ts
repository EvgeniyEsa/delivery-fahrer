import type { PlannableOrder } from "@/lib/orders"
import type { Partner } from "@/lib/partner-types"
import { listLocatedPartners } from "@/lib/partners"

const STOP_ID = /^pick:([^:]+):(\d{4}-\d{2}-\d{2})$/

export function pickupStops(partners: Partner[], days: string[]): PlannableOrder[] {
  const dates = [...new Set(days.filter(Boolean))].sort()
  return [...partners]
    .sort((left, right) => left.position - right.position)
    .flatMap((partner, sequence) =>
      dates.map((visitDate) => toPickupStop(partner, visitDate, sequence + 1)),
    )
}

export async function listPickupStopsByIds(ids: string[]): Promise<PlannableOrder[]> {
  const wanted = ids.flatMap((id) => {
    const match = STOP_ID.exec(id)
    if (!match?.[1] || !match[2]) return []
    return [{ partnerId: match[1], visitDate: match[2] }]
  })
  if (wanted.length === 0) return []

  const partners = await listLocatedPartners()
  const byId = new Map(partners.map((partner) => [partner.id, partner]))
  const sequence = new Map(partners.map((partner, index) => [partner.id, index + 1]))

  return wanted.flatMap((stop) => {
    const partner = byId.get(stop.partnerId)
    if (!partner) return []
    return [toPickupStop(partner, stop.visitDate, sequence.get(partner.id) ?? 0)]
  })
}

function toPickupStop(partner: Partner, visitDate: string, sequence: number): PlannableOrder {
  return {
    id: `pick:${partner.id}:${visitDate}`,
    shopifyOrderId: "",
    number: `Забор ${sequence}`,
    customer: partner.name,
    phone: partner.phone,
    address: partner.address || "Адрес не указан",
    status: "pending",
    deliveryDate: visitDate,
    latitude: partner.latitude,
    longitude: partner.longitude,
    source: "pickup",
    sequence,
    summary: partner.comment,
  }
}
