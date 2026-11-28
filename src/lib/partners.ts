import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { geocodeAddress } from "@/lib/geocode"
import { readDataText } from "@/lib/stored-json"
import type {
  Partner,
  PartnerInput,
  PartnerProduct,
  SavePartnerResult,
} from "@/lib/partner-types"

export type { Partner, PartnerInput, PartnerProduct, SavePartnerResult } from "@/lib/partner-types"

const LOCAL_FILE = path.join(process.cwd(), "data", "partners.json")
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function listPartners(): Promise<Partner[]> {
  const partners = await readPartners()
  return [...partners].sort((left, right) => left.position - right.position)
}

export async function listLocatedPartners(): Promise<Partner[]> {
  const partners = await listPartners()
  const located = await Promise.all(
    partners.map(async (partner) => {
      if (partner.latitude !== null && partner.longitude !== null) return partner
      if (!partner.address) return partner
      const point = await geocodeAddress(partner.address)
      return point ? { ...partner, ...point } : partner
    }),
  )

  await persistCoordinates(located)
  return located
}

export async function createPartner(input: PartnerInput): Promise<SavePartnerResult> {
  const prepared = preparePartner(input)
  if (!prepared.ok) return prepared

  const rows = await readPartners()
  rows.push({
    id: randomUUID(),
    ...prepared.partner,
    position: rows.length,
    latitude: null,
    longitude: null,
    createdAt: new Date().toISOString(),
  })
  await writePartners(rows)
  return { ok: true }
}

export async function updatePartner(
  id: string,
  input: PartnerInput,
): Promise<SavePartnerResult> {
  const prepared = preparePartner(input)
  if (!prepared.ok) return prepared

  const rows = await readPartners()
  const index = rows.findIndex((row) => row.id === id)
  const current = rows[index]
  if (!current) return { ok: false, error: "Партнёр не найден" }

  const addressChanged = current.address !== prepared.partner.address
  rows[index] = {
    ...current,
    ...prepared.partner,
    latitude: addressChanged ? null : current.latitude,
    longitude: addressChanged ? null : current.longitude,
  }
  await writePartners(rows)
  return { ok: true }
}

export async function reorderPartners(ids: string[]): Promise<SavePartnerResult> {
  if (!Array.isArray(ids) || ids.length === 0) {
    return { ok: false, error: "Нет партнёров для сортировки" }
  }

  const rows = await readPartners()
  const order = new Map(ids.map((id, index) => [id, index]))
  const next = [...rows].sort(
    (left, right) =>
      (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  )
  next.forEach((partner, index) => {
    partner.position = index
  })
  await writePartners(next)
  return { ok: true }
}

async function persistCoordinates(partners: Partner[]) {
  const local = await readPartners()
  if (local.length === 0) return

  const byId = new Map(partners.map((partner) => [partner.id, partner]))
  let changed = false
  const next = local.map((row) => {
    const located = byId.get(row.id)
    if (!located || located.latitude === null || located.longitude === null) return row
    if (row.latitude === located.latitude && row.longitude === located.longitude) return row
    changed = true
    return { ...row, latitude: located.latitude, longitude: located.longitude }
  })

  if (changed) await writePartners(next)
}

async function readPartners(): Promise<Partner[]> {
  try {
    const raw = await readDataText("partners.json")
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.flatMap((row, index) => {
      if (!row || typeof row !== "object") return []
      const item = row as Partial<Partner>
      if (!item.id || !item.name) return []
      return [
        {
          id: String(item.id),
          name: String(item.name),
          phone: item.phone ? String(item.phone) : "",
          address: item.address ? String(item.address) : "",
          comment: item.comment ? String(item.comment) : "",
          products: readProducts(item.products),
          visitDates: readDates(item.visitDates),
          position: typeof item.position === "number" ? item.position : index,
          latitude: typeof item.latitude === "number" ? item.latitude : null,
          longitude: typeof item.longitude === "number" ? item.longitude : null,
          createdAt: item.createdAt ? String(item.createdAt) : null,
        },
      ]
    })
  } catch {
    return []
  }
}

async function writePartners(rows: Partner[]) {
  await mkdir(path.dirname(LOCAL_FILE), { recursive: true })
  await writeFile(LOCAL_FILE, `${JSON.stringify(rows, null, 2)}\n`)
}

function preparePartner(input: PartnerInput) {
  const name = input.name.trim()
  const address = input.address.trim()
  if (!name) return { ok: false as const, error: "Укажите имя партнёра" }
  if (!address) return { ok: false as const, error: "Укажите адрес" }

  return {
    ok: true as const,
    partner: {
      name,
      phone: input.phone.trim(),
      address,
      comment: input.comment.trim(),
      products: [] as PartnerProduct[],
      visitDates: [] as string[],
    },
  }
}

function readProducts(value: unknown): PartnerProduct[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return []
    const item = row as { name?: unknown; quantity?: unknown }
    const name = typeof item.name === "string" ? item.name.trim() : ""
    const quantity = Number(item.quantity)
    if (!name || !Number.isInteger(quantity) || quantity < 1) return []
    return [{ name, quantity }]
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
