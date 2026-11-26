import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { createClient } from "@supabase/supabase-js"

import { geocodeAddress } from "@/lib/geocode"

import { splitProductArticle, normalizeArticle } from "@/lib/product-article"
import type {
  SaveSubscriberResult,
  Subscriber,
  SubscriberInput,
  SubscriberProduct,
} from "@/lib/subscriber-types"

export type {
  SaveSubscriberResult,
  Subscriber,
  SubscriberInput,
  SubscriberProduct,
} from "@/lib/subscriber-types"

const COLUMNS = "id, name, phone, address, comment, created_at"
const LOCAL_FILE = path.join(process.cwd(), "data", "subscribers.json")

function createSubscribersClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and a Supabase key must be set")
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function isMissingTable(code?: string, message?: string) {
  return code === "PGRST205" || /schema cache/i.test(message ?? "")
}

function readableDatabaseError(message: string, code?: string) {
  if (code === "42501") {
    return "Supabase запретил запись абонементов. Проверьте ключ сервиса."
  }

  return message
}

async function readLocalSubscribers(): Promise<Subscriber[]> {
  try {
    const raw = await readFile(LOCAL_FILE, "utf8")
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((row) => {
      if (!row || typeof row !== "object") return []
      const item = row as Partial<Subscriber>
      if (!item.id || !item.name) return []
      const record = item as Partial<Subscriber> & { products?: unknown; deliveryDates?: unknown }
      return [
        {
          id: String(item.id),
          name: String(item.name),
          phone: item.phone ? String(item.phone) : "",
          email: item.email ? String(item.email) : "",
          address: item.address ? String(item.address) : "",
          segment: item.segment === "b2b" ? "b2b" : "b2c",
          comment: item.comment ? String(item.comment) : "",
          products: readProducts(record.products),
          deliveryDates: readDates(record.deliveryDates),
          deliveryPrice: readDeliveryPrice(record.deliveryPrice),
          latitude: typeof record.latitude === "number" ? record.latitude : null,
          longitude: typeof record.longitude === "number" ? record.longitude : null,
          createdAt: item.createdAt ? String(item.createdAt) : null,
        },
      ]
    })
  } catch {
    return []
  }
}

async function writeLocalSubscribers(rows: Subscriber[]) {
  await mkdir(path.dirname(LOCAL_FILE), { recursive: true })
  await writeFile(LOCAL_FILE, `${JSON.stringify(rows, null, 2)}\n`)
}

export async function listSubscribers(): Promise<Subscriber[]> {
  const supabase = createSubscribersClient()
  const { data, error } = await supabase
    .from("subscribers")
    .select(COLUMNS)
    .order("created_at", { ascending: false })

  if (error) {
    if (isMissingTable(error.code, error.message)) return readLocalSubscribers()
    throw new Error(readableDatabaseError(error.message, error.code))
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: row.name?.trim() || "Без имени",
    phone: row.phone?.trim() || "",
    email: "",
    address: row.address?.trim() || "",
    segment: "b2c",
    comment: row.comment?.trim() || "",
    products: [],
    deliveryDates: [],
    deliveryPrice: null,
    latitude: null,
    longitude: null,
    createdAt: row.created_at ?? null,
  }))
}

function canGeocode(address: string) {
  return (
    /\s/.test(address) &&
    (/\b\d{5}\b/.test(address) || /\b[A-Za-zÄÖÜäöüß]{5,}\b/.test(address))
  )
}

export async function listLocatedSubscribers(): Promise<Subscriber[]> {
  const subscribers = await listSubscribers()
  const located = await Promise.all(
    subscribers.map(async (subscriber) => {
      if (subscriber.latitude !== null && subscriber.longitude !== null) return subscriber
      if (!subscriber.address || !canGeocode(subscriber.address)) return subscriber
      const point = await geocodeAddress(subscriber.address)
      return point ? { ...subscriber, ...point } : subscriber
    }),
  )

  await persistCoordinates(located)
  return located
}

async function persistCoordinates(subscribers: Subscriber[]) {
  const local = await readLocalSubscribers()
  if (local.length === 0) return

  const byId = new Map(subscribers.map((subscriber) => [subscriber.id, subscriber]))
  let changed = false
  const next = local.map((row) => {
    const located = byId.get(row.id)
    if (!located || located.latitude === null || located.longitude === null) return row
    if (row.latitude === located.latitude && row.longitude === located.longitude) return row
    changed = true
    return { ...row, latitude: located.latitude, longitude: located.longitude }
  })

  if (changed) await writeLocalSubscribers(next)
}

export async function createSubscriber(
  input: SubscriberInput,
): Promise<SaveSubscriberResult> {
  const prepared = prepareSubscriber(input)
  if (!prepared.ok) return prepared

  const supabase = createSubscribersClient()
  const { name, phone, email, address, comment, products, deliveryDates, deliveryPrice } = prepared
  const { error } = await supabase.from("subscribers").insert({
    name,
    phone: phone || null,
    address,
    comment: comment || null,
  })

  if (error) {
    if (!isMissingTable(error.code, error.message)) {
      return { ok: false, error: readableDatabaseError(error.message, error.code) }
    }

    const rows = await readLocalSubscribers()
    rows.unshift({
      id: randomUUID(),
      name,
      phone,
      email,
      address,
      segment: "b2c",
      comment,
      products,
      deliveryDates,
      deliveryPrice,
      latitude: null,
      longitude: null,
      createdAt: new Date().toISOString(),
    })
    await writeLocalSubscribers(rows)
    return { ok: true }
  }

  return { ok: true }
}

export async function updateSubscriber(
  id: string,
  input: SubscriberInput,
): Promise<SaveSubscriberResult> {
  const prepared = prepareSubscriber(input)
  if (!prepared.ok) return prepared

  const supabase = createSubscribersClient()
  const { error } = await supabase
    .from("subscribers")
    .update({
      name: prepared.name,
      phone: prepared.phone || null,
      address: prepared.address,
      comment: prepared.comment || null,
    })
    .eq("id", id)

  if (!error) return { ok: true }
  if (!isMissingTable(error.code, error.message)) {
    return { ok: false, error: readableDatabaseError(error.message, error.code) }
  }

  const rows = await readLocalSubscribers()
  const index = rows.findIndex((row) => row.id === id)
  const current = rows[index]
  if (!current) return { ok: false, error: "Клиент не найден" }

  rows[index] = {
    ...current,
    name: prepared.name,
    phone: prepared.phone,
    email: prepared.email,
    address: prepared.address,
    comment: prepared.comment,
    products: prepared.products,
    deliveryDates: prepared.deliveryDates,
    deliveryPrice: prepared.deliveryPrice,
    latitude: current.address === prepared.address ? current.latitude : null,
    longitude: current.address === prepared.address ? current.longitude : null,
  }
  await writeLocalSubscribers(rows)
  return { ok: true }
}

export async function deleteSubscriber(id: string): Promise<SaveSubscriberResult> {
  if (!id) return { ok: false, error: "Клиент не найден" }

  const supabase = createSubscribersClient()
  const { error } = await supabase.from("subscribers").delete().eq("id", id)

  if (error && !isMissingTable(error.code, error.message)) {
    return { ok: false, error: readableDatabaseError(error.message, error.code) }
  }

  const rows = await readLocalSubscribers()
  const next = rows.filter((row) => row.id !== id)
  if (next.length === rows.length) {
    return error ? { ok: false, error: "Клиент не найден" } : { ok: true }
  }

  await writeLocalSubscribers(next)
  return { ok: true }
}

function prepareSubscriber(input: SubscriberInput) {
  const name = input.name.trim()
  const address = input.address.trim()
  const phone = input.phone.trim()
  const email = normalizeEmail(input.email)
  if (email == null) return { ok: false as const, error: "Укажите почту целиком, с @ и доменом." }
  const comment = input.comment.trim()

  if (!name) return { ok: false as const, error: "Укажите имя клиента" }
  if (!address) return { ok: false as const, error: "Укажите адрес" }

  const products = normalizeProducts(input.products)
  if (!products.ok) return products

  return {
    ok: true as const,
    name,
    phone,
    email,
    address,
    comment,
    products: products.products,
    deliveryDates: normalizeDates(input.deliveryDates),
    deliveryPrice: normalizeDeliveryPrice(input.deliveryPrice),
  }
}

function normalizeEmail(value: string) {
  const email = value.trim()
  if (!email) return ""
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  return email
}

function readDeliveryPrice(value: unknown) {
  return normalizeDeliveryPrice(typeof value === "number" ? value : null)
}

function normalizeDeliveryPrice(value: number | null) {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100) / 100
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function readProducts(value: unknown): SubscriberProduct[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const item = row as { name?: unknown; quantity?: unknown; article?: unknown }
    const rawName = typeof item.name === "string" ? item.name.trim() : ""
    const storedArticle = typeof item.article === "string" ? item.article.trim() : ""
    const split = storedArticle
      ? { name: rawName, article: normalizeArticle(storedArticle) }
      : splitProductArticle(rawName)
    const name = split.name || rawName
    const quantity = Number(item.quantity)
    if (!name || !Number.isInteger(quantity) || quantity < 1) return []
    return [{ name, quantity, article: split.article }]
  })
}

function readDates(value: unknown) {
  if (!Array.isArray(value)) return []
  return [
    ...new Set(
      value.filter((date): date is string => typeof date === "string" && ISO_DATE.test(date)),
    ),
  ].sort()
}

function normalizeProducts(
  products: SubscriberProduct[],
): { ok: true; products: SubscriberProduct[] } | { ok: false; error: string } {
  const normalized: SubscriberProduct[] = []

  for (const product of products) {
    const quantity = Number(product.quantity)
    const split = product.article?.trim()
      ? { name: product.name.trim(), article: normalizeArticle(product.article) }
      : splitProductArticle(product.name)
    const name = split.name || product.name.trim()
    if (!name) continue
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { ok: false, error: "Количество товара должно быть целым числом от 1" }
    }
    normalized.push({ name, quantity, article: split.article })
  }

  return { ok: true, products: normalized }
}

function normalizeDates(dates: string[]) {
  return readDates(dates)
}
