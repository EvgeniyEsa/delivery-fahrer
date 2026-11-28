"use server"

import { revalidatePath } from "next/cache"

import { portalByToken, portalClosedMessage, portalNote, portalOrderVersions, portalRolls, portalSubscriber, chosenPortalOrderDay, lieferscheinMark, type PortalNoteLine } from "@/lib/b2b-portals"
import { saveEveningOrder } from "@/lib/evening-orders"
import { notifyLateHotelChange } from "@/lib/hotel-change-notice"
import { orderChangeIsLate, clientOrderStillOpen, type OrderVersion } from "@/lib/order-changes"

export type PortalOrderState =
  | { ok: true; pieces: number; lines: PortalNoteLine[]; versions: OrderVersion[]; changed: boolean }
  | { ok: false; error: string }
  | null

export async function submitB2bOrder(
  _previous: PortalOrderState,
  formData: FormData,
): Promise<PortalOrderState> {
  const token = String(formData.get("token") ?? "").trim()
  const portal = await portalByToken(token)
  if (!portal) return { ok: false, error: "Dieser Bestelllink ist ungültig." }

  const rolls = await portalRolls(portal.bakery)
  const lines = []
  for (const roll of rolls) {
    const raw = String(formData.get(`qty-${roll.id}`) ?? "").trim()
    if (!raw) continue
    const quantity = Number(raw)
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 999) {
      return { ok: false, error: "Bitte ganze Mengen von 0 bis 999 eintragen." }
    }
    if (quantity === 0) continue
    lines.push({ name: roll.name, quantity, article: roll.sku })
  }

  if (lines.length === 0) {
    return { ok: false, error: "Bitte mindestens eine Menge eintragen." }
  }

  const day = chosenPortalOrderDay(String(formData.get("day") ?? ""), portal.bakery)
  if (String(formData.get("day") ?? "") !== day) {
    return { ok: false, error: "Dieses Datum kann nicht bestellt werden." }
  }
  if (!clientOrderStillOpen(portal.bakery, day)) {
    return { ok: false, error: portalClosedMessage(portal.bakery, day) }
  }
  const previous = await portalOrderVersions(portal.subscriberId, day)
  const saved = await saveEveningOrder(portal.subscriberId, day, lines)
  if (!saved.ok) return { ok: false, error: "Die Bestellung konnte nicht gespeichert werden." }

  const versions: OrderVersion[] = saved.record.versions.map((version) => ({
    at: version.at,
    lines: version.lines.map(({ name, quantity }) => ({ name, quantity })),
  }))
  const latest = versions.at(-1)
  if (saved.changed && latest?.at && orderChangeIsLate(day, latest.at) && previous.length > 0) {
    const subscriber = await portalSubscriber(portal.subscriberId)
    await notifyLateHotelChange({
      customerName: subscriber?.name ?? "Hotel",
      deliveryDay: day,
      mark: lieferscheinMark(portal.subscriberId),
      at: latest.at,
      before: previous.at(-1)?.lines ?? [],
      after: latest.lines,
    })
  }

  revalidatePath("/driver")
  revalidatePath("/routes")
  revalidatePath("/subscriptions")
  revalidatePath(`/order/${token}`)
  revalidatePath(`/order/${token}/lieferscheine`)
  return {
    ok: true,
    pieces: lines.reduce((sum, line) => sum + line.quantity, 0),
    lines: portalNote(rolls, lines),
    versions,
    changed: saved.changed,
  }
}
