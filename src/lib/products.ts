import { createClient } from "@supabase/supabase-js"

import type { CatalogProduct, ProductUpdate } from "@/lib/product-types"

const BUCKET = "catalog"
const OBJECT = "products.json"

const VENDOR_ORDER = [
  "Heidbüchel",
  "Moss",
  "Kockartz",
  "Malzers",
  "Brötli",
  "Maqii",
  "BeeBag",
  "Bioladung Hof Determeyer",
  "Lieferung",
]

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and a Supabase key must be set")
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function readRows() {
  const { data, error } = await supabase().storage.from(BUCKET).download(OBJECT)
  if (error || !data) throw new Error(error?.message || "Каталог не прочитан")
  const parsed = JSON.parse(await data.text()) as unknown
  if (!Array.isArray(parsed)) throw new Error("Каталог не прочитан")
  return parsed
}

async function writeRows(rows: unknown[]) {
  const { error } = await supabase()
    .storage.from(BUCKET)
    .upload(OBJECT, `${JSON.stringify(rows, null, 2)}\n`, {
      contentType: "application/json",
      upsert: true,
    })
  if (error) throw new Error(error.message)
}

export async function updateProductStatus(
  id: string,
  status: CatalogProduct["status"],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (status !== "active" && status !== "draft") {
    return { ok: false, error: "Неизвестный статус" }
  }
  try {
    const parsed = await readRows()
    const index = parsed.findIndex(
      (item) => item && typeof item === "object" && (item as { id?: unknown }).id === id,
    )
    const current = parsed[index]
    if (!current || typeof current !== "object") return { ok: false, error: "Продукт не найден" }
    parsed[index] = { ...current, status }
    await writeRows(parsed)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Каталог не прочитан" }
  }
}

export async function updateProduct(
  id: string,
  input: ProductUpdate,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = input.name.trim()
  const price = Number(input.price)
  const image = input.image.trim()
  if (!name) return { ok: false, error: "Укажите название" }
  if (!Number.isFinite(price) || price < 0) return { ok: false, error: "Укажите цену" }
  if (image && !/^https?:\/\//i.test(image)) {
    return { ok: false, error: "Ссылка на фото должна начинаться с http" }
  }

  try {
    const parsed = await readRows()
    const index = parsed.findIndex(
      (item) => item && typeof item === "object" && (item as { id?: unknown }).id === id,
    )
    const current = parsed[index]
    if (!current || typeof current !== "object") return { ok: false, error: "Продукт не найден" }
    parsed[index] = {
      ...current,
      name,
      sku: input.sku.trim(),
      price,
      vendor: input.vendor.trim(),
      type: input.type.trim(),
      image,
    }
    await writeRows(parsed)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Каталог не прочитан" }
  }
}

export async function listProducts(): Promise<CatalogProduct[]> {
  const parsed = await readRows()
  return parsed.flatMap(readProduct).sort(compareProducts)
}

function readProduct(item: unknown): CatalogProduct[] {
  if (!item || typeof item !== "object") return []
  const record = item as Partial<CatalogProduct>
  const name = typeof record.name === "string" ? record.name.trim() : ""
  const price = Number(record.price)
  if (!name || !Number.isFinite(price)) return []
  return [
    {
      id: typeof record.id === "string" && record.id ? record.id : name,
      name,
      sku: typeof record.sku === "string" ? record.sku.trim() : "",
      price,
      vendor: typeof record.vendor === "string" ? record.vendor.trim() : "",
      type: typeof record.type === "string" ? record.type.trim() : "",
      image: typeof record.image === "string" ? record.image.trim() : "",
      status: record.status === "draft" ? "draft" : "active",
    },
  ]
}

function compareProducts(left: CatalogProduct, right: CatalogProduct) {
  const vendor = vendorRank(left.vendor) - vendorRank(right.vendor)
  if (vendor !== 0) return vendor
  const name = left.name.localeCompare(right.name, "de")
  if (name !== 0) return name
  return left.sku.localeCompare(right.sku, "de")
}

function vendorRank(vendor: string) {
  const index = VENDOR_ORDER.indexOf(vendor)
  return index === -1 ? VENDOR_ORDER.length : index
}
