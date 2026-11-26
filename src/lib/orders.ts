import { createClient } from "@supabase/supabase-js"
import { connection } from "next/server"

import { listDeliveryTimes } from "@/lib/delivery-log"
import type { Order, OrderStatus } from "@/lib/mock-orders"
import { notifyNewOrders } from "@/lib/slack"
import {
  formatShopifyAddress,
  getShopifyDeliveryDates,
  getShopifyOrderFacts,
  getShopifyOrders,
  updateShopifyDeliveryDate,
  type ShopifyOrder,
} from "@/lib/shopify"

type StoredOrderRow = {
  id: string | number
  shopify_order_id: string | number | null
  order_number: string | null
  customer_name: string | null
  customer_phone: string | null
  address: string | null
  status: string | null
}

export type ImportOrdersResult =
  | {
      ok: true
      imported: number
      skipped: number
      slack: "sent" | "skipped" | "failed"
      slackError?: string
    }
  | { ok: false; error: string }

const ORDER_COLUMNS =
  "id, shopify_order_id, order_number, customer_name, customer_phone, address, status"
const PLANNABLE_COLUMNS =
  "id, shopify_order_id, order_number, customer_name, customer_phone, address, status, lat, lng"

function normalizeStatus(status: string | null): OrderStatus {
  if (status === "pending" || status === "in_transit" || status === "delivered") {
    return status
  }

  return "pending"
}

function toOrder(
  row: StoredOrderRow,
  facts?: { deliveryDate: string | null; comment: string },
  deliveredAt?: string | null,
): Order {
  return {
    id: String(row.id),
    shopifyOrderId:
      row.shopify_order_id == null ? "" : String(row.shopify_order_id),
    number: row.order_number?.trim() || "—",
    customer: row.customer_name?.trim() || "Без имени",
    phone: row.customer_phone?.trim() || "",
    address: row.address?.trim() || "Адрес не указан",
    status: normalizeStatus(row.status),
    window: "—",
    deliveryDate: facts?.deliveryDate ?? null,
    deliveredAt: deliveredAt ?? null,
    comment: facts?.comment ?? "",
  }
}

function toInsert(order: ShopifyOrder) {
  const latitude = order.shippingAddress?.latitude
  const longitude = order.shippingAddress?.longitude

  return {
    shopify_order_id: order.id,
    order_number: order.name,
    customer_name: order.customer || "Без имени",
    customer_phone: order.phone,
    address: formatShopifyAddress(order.shippingAddress) || "Адрес не указан",
    status: "pending",
    ...(typeof latitude === "number" ? { lat: latitude } : {}),
    ...(typeof longitude === "number" ? { lng: longitude } : {}),
  }
}

function createOrdersClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and a Supabase key must be set",
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function finishImport(
  saved: ShopifyOrder[],
  imported: number,
  skipped: number,
): Promise<ImportOrdersResult> {
  if (imported === 0) {
    return { ok: true, imported, skipped, slack: "skipped" }
  }

  try {
    await notifyNewOrders(saved)
    return { ok: true, imported, skipped, slack: "sent" }
  } catch (error) {
    return {
      ok: true,
      imported,
      skipped,
      slack: "failed",
      slackError:
        error instanceof Error
          ? error.message
          : "Не удалось отправить сообщение в Slack",
    }
  }
}

function readableDatabaseError(message: string, code?: string) {
  if (code === "42501") {
    return "Supabase запретил запись в orders для публичного ключа. Добавьте SUPABASE_SERVICE_ROLE_KEY в .env.local или политику INSERT."
  }

  return message
}

export type PlannableOrder = {
  id: string
  shopifyOrderId: string
  number: string
  customer: string
  phone: string
  address: string
  status: OrderStatus
  deliveryDate: string | null
  latitude: number | null
  longitude: number | null
  source: "shopify" | "subscription" | "pickup"
  summary: string
  sequence: number
}

function toPlannableOrder(
  row: {
    id: string | number
    shopify_order_id: string | number | null
    order_number: string | null
    customer_name: string | null
    customer_phone: string | null
    address: string | null
    status: string | null
    lat: number | null
    lng: number | null
  },
  deliveryDate: string | null,
): PlannableOrder {
  return {
    id: String(row.id),
    shopifyOrderId: row.shopify_order_id == null ? "" : String(row.shopify_order_id),
    number: row.order_number?.trim() || "—",
    customer: row.customer_name?.trim() || "Без имени",
    phone: row.customer_phone?.trim() || "",
    address: row.address?.trim() || "Адрес не указан",
    status: normalizeStatus(row.status),
    deliveryDate,
    latitude: typeof row.lat === "number" ? row.lat : null,
    longitude: typeof row.lng === "number" ? row.lng : null,
    source: "shopify",
    summary: "",
    sequence: 0,
  }
}

async function withDeliveryDates(
  rows: Parameters<typeof toPlannableOrder>[0][],
): Promise<PlannableOrder[]> {
  const dates = await getShopifyDeliveryDates(
    rows.flatMap((row) =>
      row.shopify_order_id == null ? [] : [String(row.shopify_order_id)],
    ),
  )

  return rows.map((row) =>
    toPlannableOrder(
      row,
      row.shopify_order_id == null
        ? null
        : (dates.get(String(row.shopify_order_id)) ?? null),
    ),
  )
}

let shopifySync: Promise<void> | null = null

async function syncNewShopifyOrders() {
  if (shopifySync) return shopifySync

  shopifySync = (async () => {
    await connection()
    const result = await importShopifyOrders()
    if (!result.ok) console.error("[shopify sync]", result.error)
  })().finally(() => {
    shopifySync = null
  })

  return shopifySync
}

export async function listPlannableOrders(): Promise<PlannableOrder[]> {
  await syncNewShopifyOrders()
  const supabase = createOrdersClient()
  const { data, error } = await supabase
    .from("orders")
    .select(PLANNABLE_COLUMNS)
    .neq("status", "delivered")
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(readableDatabaseError(error.message, error.code))
  }

  return withDeliveryDates(
    (data ?? []) as Parameters<typeof toPlannableOrder>[0][],
  )
}

export async function listOrdersByIds(ids: string[]): Promise<PlannableOrder[]> {
  if (ids.length === 0) return []

  const supabase = createOrdersClient()
  const { data, error } = await supabase
    .from("orders")
    .select(PLANNABLE_COLUMNS)
    .in("id", ids)

  if (error) {
    throw new Error(readableDatabaseError(error.message, error.code))
  }

  return withDeliveryDates(
    (data ?? []) as Parameters<typeof toPlannableOrder>[0][],
  )
}

export async function listStoredOrders(): Promise<Order[]> {
  await syncNewShopifyOrders()
  const supabase = createOrdersClient()
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(readableDatabaseError(error.message, error.code))
  }

  const rows = (data ?? []) as StoredOrderRow[]
  const [facts, deliveredAt] = await Promise.all([
    getShopifyOrderFacts(
      rows.flatMap((row) =>
        row.shopify_order_id == null ? [] : [String(row.shopify_order_id)],
      ),
    ),
    listDeliveryTimes(),
  ])

  return rows
    .map((row) =>
      toOrder(
        row,
        row.shopify_order_id == null
          ? undefined
          : facts.get(String(row.shopify_order_id)),
        deliveredAt.get(String(row.id)) ?? null,
      ),
    )
    .sort((left, right) => orderRank(right.number) - orderRank(left.number))
}

function orderRank(number: string) {
  const value = Number(number.replace(/\D/g, ""))
  return Number.isFinite(value) ? value : 0
}

export async function markOrderDelivered(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!orderId) {
    return { ok: false, error: "Не указан заказ" }
  }

  const supabase = createOrdersClient()
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "delivered" })
    .eq("id", orderId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, error: readableDatabaseError(error.message, error.code) }
  }

  if (!data) {
    return { ok: false, error: "Заказ не найден" }
  }

  return { ok: true }
}

export async function changeDeliveryDate(
  orderId: string,
  deliveryDate: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
    return { ok: false, error: "Некорректная дата доставки" }
  }

  const supabase = createOrdersClient()
  const { data, error } = await supabase
    .from("orders")
    .select("shopify_order_id")
    .eq("id", orderId)
    .maybeSingle()

  if (error) {
    return { ok: false, error: readableDatabaseError(error.message, error.code) }
  }

  if (!data?.shopify_order_id) {
    return { ok: false, error: "У заказа нет номера Shopify" }
  }

  try {
    await updateShopifyDeliveryDate(String(data.shopify_order_id), deliveryDate)
    return { ok: true }
  } catch (caught) {
    return {
      ok: false,
      error:
        caught instanceof Error
          ? caught.message
          : "Не удалось сохранить дату доставки",
    }
  }
}

export async function importShopifyOrders(): Promise<ImportOrdersResult> {
  try {
    const shopifyOrders = await getShopifyOrders()
    const supabase = createOrdersClient()
    const { data: existing, error: readError } = await supabase
      .from("orders")
      .select("shopify_order_id")

    if (readError) {
      return {
        ok: false,
        error: readableDatabaseError(readError.message, readError.code),
      }
    }

    const known = new Set(
      (existing ?? []).map((row) => String(row.shopify_order_id)),
    )
    const fresh = shopifyOrders.filter((order) => !known.has(order.id))
    const skipped = shopifyOrders.length - fresh.length

    if (fresh.length === 0) {
      return { ok: true, imported: 0, skipped, slack: "skipped" }
    }

    const { error: insertError } = await supabase
      .from("orders")
      .insert(fresh.map(toInsert))

    if (!insertError) {
      return finishImport(fresh, fresh.length, skipped)
    }

    if (insertError.code !== "23505") {
      return {
        ok: false,
        error: readableDatabaseError(insertError.message, insertError.code),
      }
    }

    const saved: ShopifyOrder[] = []
    let duplicates = skipped

    for (const order of fresh) {
      const { error } = await supabase.from("orders").insert(toInsert(order))

      if (!error) {
        saved.push(order)
        continue
      }

      if (error.code === "23505") {
        duplicates += 1
        continue
      }

      return {
        ok: false,
        error: readableDatabaseError(error.message, error.code),
      }
    }

    return finishImport(saved, saved.length, duplicates)
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Не удалось загрузить заказы из Shopify",
    }
  }
}
