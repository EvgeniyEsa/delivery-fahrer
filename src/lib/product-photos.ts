import { describeProduct, normalizeArticle } from "@/lib/product-article"
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
  laugenecken: "laugenecke",
  "kaeseroetchen gebacken": "kaesebroetchen gebacken",
  "suesse broetchen": "suesses broetchen",
  "halbes oberlaender geschnitten": "oberlaender 1000g",
}

const BAKERIES = ["Heidbüchel", "Moss", "Kockartz"] as const

export type DriverBakery = (typeof BAKERIES)[number]

export const BAKERY_COLOR: Record<DriverBakery, string> = {
  Heidbüchel: "bg-[#fff3c4]",
  Moss: "bg-[#dff3d8]",
  Kockartz: "bg-[#e8c9a4]",
}

export function bakeryFromName(name: string): DriverBakery | "" {
  const hint = bakeryHint(name)
  return isDriverBakery(hint) ? hint : ""
}

export function bakeryHint(comment: string) {
  const heidbuechel = /heidb|хальб|хайб/i.test(comment)
  const moss = /moss|мосс/i.test(comment)
  const kockartz = /kockartz|копкарц|кокарц|kopkarz/i.test(comment)
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

export function driverBakeryLookup(catalog: CatalogProduct[]) {
  const byName = new Map<string, Set<DriverBakery>>()
  for (const product of catalog) {
    if (!BAKERIES.includes(product.vendor as DriverBakery)) continue
    const name = normalizeName(product.name)
    if (!name) continue
    const vendors = byName.get(name) ?? new Set()
    vendors.add(product.vendor as DriverBakery)
    byName.set(name, vendors)
  }

  return function lookup(
    input: { name: string; article?: string },
    hint: string,
  ): DriverBakery | "" {
    const fromArticle = describeProduct({
      name: input.name,
      quantity: 1,
      article: input.article,
    }).bakery
    if (isDriverBakery(fromArticle)) return fromArticle

    const normalized = normalizeName(input.name)
    const key = NAME_ALIASES[normalized] ?? normalized
    const vendors = [...(byName.get(key) ?? [])]
    if (vendors.length === 1) return vendors[0]
    if (isDriverBakery(hint) && (vendors.length === 0 || vendors.includes(hint))) return hint
    return ""
  }
}

function isDriverBakery(value: string): value is DriverBakery {
  return BAKERIES.includes(value as DriverBakery)
}

export function catalogNameLookup(catalog: CatalogProduct[]) {
  const bySku = new Map<string, CatalogProduct[]>()

  for (const product of catalog) {
    const sku = normalizeArticle(product.sku.trim()).toUpperCase()
    if (!sku) continue
    const group = bySku.get(sku) ?? []
    group.push(product)
    bySku.set(sku, group)
  }

  return function lookup(article: string, bakery: string) {
    const sku = normalizeArticle(article).toUpperCase()
    const matches = (bySku.get(sku) ?? []).filter((product) => product.vendor === bakery)
    return matches.length === 1 ? matches[0].name : ""
  }
}

export function productSkuLookup(catalog: CatalogProduct[]) {
  const byName = new Map<string, CatalogProduct[]>()

  for (const product of catalog) {
    const sku = product.sku.trim()
    const name = normalizeName(product.name)
    if (!sku || !name) continue
    const named = byName.get(name) ?? []
    named.push(product)
    byName.set(name, named)
  }

  return function lookup(input: { name: string; article?: string; bakery?: string }) {
    const article = input.article?.trim()
    if (article) return normalizeArticle(article)

    const normalized = normalizeName(input.name)
    const key = NAME_ALIASES[normalized] ?? normalized
    const matches = (byName.get(key) ?? []).filter(
      (product) => !input.bakery || product.vendor === input.bakery,
    )
    const skus = [...new Set(matches.map((product) => normalizeArticle(product.sku.trim())))]
    return skus.length === 1 ? skus[0] : ""
  }
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
      if (matches?.length) {
        const wanted = normalizeName(input.name)
        const named = wanted
          ? matches.filter((product) => normalizeName(product.name) === wanted)
          : []
        const chosen = choose(named.length > 0 ? named : matches, input.vendor ?? "")
        if (chosen?.image) return chosen.image
      }
    }

    const normalized = normalizeName(input.name)
    const key = NAME_ALIASES[normalized] ?? normalized
    const matches = byName.get(key)
    if (!matches) return ""
    return choose(matches, input.vendor ?? "")?.image ?? ""
  }
}
