import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { CatalogProduct, ProductUpdate } from "@/lib/product-types"

const LOCAL_FILE = path.join(process.cwd(), "data", "products.json")

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

export async function updateProductStatus(
  id: string,
  status: CatalogProduct["status"],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (status !== "active" && status !== "draft") {
    return { ok: false, error: "Неизвестный статус" }
  }
  const raw = await readFile(LOCAL_FILE, "utf8")
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) return { ok: false, error: "Каталог не прочитан" }
  const index = parsed.findIndex(
    (item) => item && typeof item === "object" && (item as { id?: unknown }).id === id,
  )
  const current = parsed[index]
  if (!current || typeof current !== "object") return { ok: false, error: "Продукт не найден" }
  parsed[index] = { ...current, status }
  await writeFile(LOCAL_FILE, `${JSON.stringify(parsed, null, 2)}\n`, "utf8")
  return { ok: true }
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

  const raw = await readFile(LOCAL_FILE, "utf8")
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) return { ok: false, error: "Каталог не прочитан" }
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
  await writeFile(LOCAL_FILE, `${JSON.stringify(parsed, null, 2)}\n`, "utf8")
  return { ok: true }
}

export async function listProducts(): Promise<CatalogProduct[]> {
  const raw = await readFile(LOCAL_FILE, "utf8")
  const parsed = JSON.parse(raw) as unknown
  if (!Array.isArray(parsed)) return []
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
