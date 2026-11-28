import type { DriverBakery } from "@/lib/product-photos"

export type LocalDelivery = { at: string; shopify: boolean }

export type TourPicks = {
  packing: DriverBakery | null
  taken: Record<string, string[]>
}

export type LocalPhoto = {
  id: string
  day: string
  bakery: DriverBakery
  createdAt: string
  blob: Blob
}

const EMPTY_PICKS: TourPicks = { packing: null, taken: {} }

function picksKey(day: string) {
  return `tour-picks:${day}`
}

function deliveriesKey(day: string) {
  return `tour-deliveries:${day}`
}

function isBakery(value: unknown): value is DriverBakery {
  return value === "Heidbüchel" || value === "Moss" || value === "Kockartz"
}

export function readPicks(day: string): TourPicks {
  try {
    const raw = localStorage.getItem(picksKey(day))
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== "object") return EMPTY_PICKS
    const taken: Record<string, string[]> = {}
    const source = parsed.taken
    if (source && typeof source === "object") {
      for (const [stopId, keys] of Object.entries(source)) {
        if (!Array.isArray(keys)) continue
        const kept = keys.filter((key) => typeof key === "string")
        if (kept.length > 0) taken[stopId] = kept
      }
    }
    return { packing: isBakery(parsed.packing) ? parsed.packing : null, taken }
  } catch {
    return EMPTY_PICKS
  }
}

export function writePicks(day: string, picks: TourPicks) {
  const empty = !picks.packing && Object.keys(picks.taken).length === 0
  if (empty) localStorage.removeItem(picksKey(day))
  else localStorage.setItem(picksKey(day), JSON.stringify(picks))
}

export function readDeliveries(day: string): Record<string, LocalDelivery> {
  try {
    const raw = localStorage.getItem(deliveriesKey(day))
    const parsed = raw ? JSON.parse(raw) : null
    if (!parsed || typeof parsed !== "object") return {}
    const deliveries: Record<string, LocalDelivery> = {}
    for (const [stopId, row] of Object.entries(parsed)) {
      if (!row || typeof row !== "object") continue
      const at = "at" in row && typeof row.at === "string" ? row.at : ""
      const shopify = "shopify" in row && row.shopify === true
      if (at) deliveries[stopId] = { at, shopify }
    }
    return deliveries
  } catch {
    return {}
  }
}

export function rememberDelivery(day: string, stopId: string, row: LocalDelivery) {
  const deliveries = readDeliveries(day)
  deliveries[stopId] = row
  localStorage.setItem(deliveriesKey(day), JSON.stringify(deliveries))
}

export function forgetDelivery(day: string, stopId: string) {
  const deliveries = readDeliveries(day)
  delete deliveries[stopId]
  if (Object.keys(deliveries).length === 0) localStorage.removeItem(deliveriesKey(day))
  else localStorage.setItem(deliveriesKey(day), JSON.stringify(deliveries))
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("driver-tour", 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos", { keyPath: "id" })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function rememberPhoto(photo: LocalPhoto) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite")
    tx.objectStore("photos").put(photo)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function listLocalPhotos(day?: string) {
  const db = await openDb()
  const rows = await new Promise<LocalPhoto[]>((resolve, reject) => {
    const tx = db.transaction("photos", "readonly")
    const request = tx.objectStore("photos").getAll()
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : [])
    request.onerror = () => reject(request.error)
  })
  db.close()
  return rows.filter((row) => row && typeof row.id === "string" && (!day || row.day === day) && isBakery(row.bakery))
}

export async function forgetPhoto(id: string) {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("photos", "readwrite")
    tx.objectStore("photos").delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
