"use server"

import { refresh, revalidatePath } from "next/cache"

import { formatDeliveryDay } from "@/lib/delivery-date"
import { saveEveningOrder as storeEveningOrder } from "@/lib/evening-orders"
import { mossOrderDeadline } from "@/lib/moss-orders"
import { clientOrderStillOpen, type ClientBakery } from "@/lib/order-changes"
import { bakeryForArticle, normalizeArticle } from "@/lib/product-article"
import { listProducts } from "@/lib/products"
import {
  createSubscriber as saveSubscriber,
  deleteSubscriber as removeSubscriber,
  listSubscribers,
  setSubscriberArchived,
  updateSubscriber as saveSubscriberUpdate,
} from "@/lib/subscribers"
import type { SubscriberInput } from "@/lib/subscriber-types"
import { requireOfficeSession } from "@/lib/office-session"

export async function createSubscriber(input: SubscriberInput) {
  await requireOfficeSession()
  const result = await saveSubscriber(input)

  if (result.ok) {
    revalidatePath("/subscriptions")
    refresh()
  }

  return result
}

export async function updateSubscriber(id: string, input: SubscriberInput) {
  await requireOfficeSession()
  const result = await saveSubscriberUpdate(id, input)

  if (result.ok) {
    revalidatePath("/subscriptions")
    refresh()
  }

  return result
}

export async function deleteSubscriber(id: string) {
  await requireOfficeSession()
  const result = await removeSubscriber(id)

  if (result.ok) {
    revalidatePath("/subscriptions")
    revalidatePath("/routes")
    revalidatePath("/driver")
    revalidatePath("/invoices")
    refresh()
  }

  return result
}

export async function archiveSubscriber(id: string) {
  await requireOfficeSession()
  const result = await setSubscriberArchived(id, true)
  if (result.ok) revalidateSubscriberViews()
  return result
}

export async function restoreSubscriber(id: string) {
  await requireOfficeSession()
  const result = await setSubscriberArchived(id, false)
  if (result.ok) revalidateSubscriberViews()
  return result
}

function revalidateSubscriberViews() {
  revalidatePath("/subscriptions")
  revalidatePath("/routes")
  revalidatePath("/driver")
  revalidatePath("/invoices")
  refresh()
}

export async function saveEveningOrder(
  _previous: { ok: true } | { ok: false; error: string } | null,
  formData: FormData,
) {
  await requireOfficeSession()
  const subscriberId = String(formData.get("subscriberId") ?? "").trim()
  const day = String(formData.get("day") ?? "").trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { ok: false as const, error: "Укажите дату доставки." }
  }

  let raw: unknown
  try {
    raw = JSON.parse(String(formData.get("lines") ?? "[]"))
  } catch {
    return { ok: false as const, error: "Список не прочитан." }
  }
  if (!Array.isArray(raw)) return { ok: false as const, error: "Список не прочитан." }

  const [subscribers, catalog] = await Promise.all([listSubscribers(), listProducts()])
  const subscriber = subscribers.find((item) => item.id === subscriberId)
  if (!subscriber) return { ok: false as const, error: "Выберите клиента." }
  const bakeries = new Set(["Heidbüchel", "Moss", "Kockartz"])
  const byId = new Map(
    catalog
      .filter((product) => bakeries.has(product.vendor) && product.sku.trim() && product.id)
      .map((product) => [product.id, product]),
  )
  const lines = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const record = item as { article?: unknown; quantity?: unknown }
    const product = byId.get(String(record.article ?? "").trim())
    const quantity = Number(record.quantity)
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      return {
        ok: false as const,
        error: "У каждой строки выберите булочку и количество.",
      }
    }
    lines.push({ name: product.name, quantity, article: normalizeArticle(product.sku) })
  }

  const closed = lines.find((line) => {
    const bakery = bakeryForArticle(line.article)
    if (bakery !== "Heidbüchel" && bakery !== "Moss" && bakery !== "Kockartz") return false
    return !clientOrderStillOpen(bakery, day)
  })
  if (closed) {
    const bakery = bakeryForArticle(closed.article)
    if (bakery === "Heidbüchel" || bakery === "Moss" || bakery === "Kockartz") {
      return { ok: false as const, error: orderClosedMessage(bakery, day) }
    }
  }

  const result = await storeEveningOrder(subscriberId, day, lines)
  if (result.ok) {
    revalidatePath("/subscriptions")
    revalidatePath("/driver")
    refresh()
    return { ok: true as const }
  }
  return result
}

function orderClosedMessage(bakery: ClientBakery, day: string) {
  if (bakery === "Moss") {
    const deadline = mossOrderDeadline(day)
    const when = deadline ? ` ${formatDeliveryDay(deadline)}` : ""
    return `Доставка ${formatDeliveryDay(day)}: заказ Moss нужно внести до 11:45${when}. Срок прошёл.`
  }
  return `Доставка ${formatDeliveryDay(day)}: заказ ${bakery} нужно внести не позже 17:00 накануне. Срок прошёл.`
}
