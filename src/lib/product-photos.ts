import { normalizeArticle } from "@/lib/product-article"
import type { CatalogProduct } from "@/lib/product-types"

const VENDOR_RANK: Record<string, number> = {
  Heidbüchel: 0,
  Moss: 1,
  Kockartz: 2,
}

const NAME_ALIASES: Record<string, string> = {
  "bio broetchen": "biobroetchen",
  bergsteiger: "bergsteiger broetchen",
  "broetchenset 10er": "broetchen set 10er",
  "broetchenset 6er": "broetchen set 6er",
  "suesse broetchen": "suesses broetchen",
  "halbes oberlaender geschnitten": "oberlaender 1000g",
}

export function bakeryHint(comment: string) {
  const heidbuechel = /heidb|хальб/i.test(comment)
  const moss = /moss|мосс/i.test(comment)
  const kockartz = /kockartz|копкарц|kopkarz/i.test(comment)
  const hits = [
    heidbuechel ? "Heidbüchel" : "",
    moss ? "Moss" : "",
    kockartz ? "Kockartz" : "",
  ].filter(Boolean)
  return hits.length === 1 ? hits[0] : ""
}

function normalizeName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("de-DE")
    .replaceAll("ß", "ss")
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function choose(products: CatalogProduct[], vendor: string) {
  const withImage = products.filter((product) => product.image)
  const preferred = vendor
    ? withImage.filter((product) => product.vendor === vendor)
    : []
  const pool = preferred.length > 0 ? preferred : withImage
  const list = pool.length > 0 ? pool : products
  return [...list].sort((left, right) => {
    const vendorOrder =
      (VENDOR_RANK[left.vendor] ?? 9) - (VENDOR_RANK[right.vendor] ?? 9)
    if (vendorOrder !== 0) return vendorOrder
    return left.sku.localeCompare(right.sku, "de")
  })[0]
}

export function productPhotoLookup(catalog: CatalogProduct[]) {
  const bySku = new Map<string, CatalogProduct[]>()
  const byName = new Map<string, CatalogProduct[]>()

  for (const product of catalog) {
    const sku = product.sku.trim().toUpperCase()
    if (sku) {
      const group = bySku.get(sku) ?? []
      group.push(product)
      bySku.set(sku, group)
    }
    const name = normalizeName(product.name)
    if (!name) continue
    const named = byName.get(name) ?? []
    named.push(product)
    byName.set(name, named)
  }

  return function lookup(input: { name: string; article?: string; vendor?: string }) {
    const article = input.article?.trim()
    if (article) {
      const sku = normalizeArticle(article).toUpperCase()
      const matches = bySku.get(sku)
      const chosen = matches ? choose(matches, "") : undefined
      if (chosen?.image) return chosen.image
    }

    const normalized = normalizeName(input.name)
    const key = NAME_ALIASES[normalized] ?? normalized
    const matches = byName.get(key)
    if (!matches) return ""
    return choose(matches, input.vendor ?? "")?.image ?? ""
  }
}
