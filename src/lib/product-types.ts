export type CatalogProduct = {
  id: string
  name: string
  sku: string
  price: number | null
  cost: number | null
  vendor: string
  type: string
  image: string
  status: "active" | "draft"
}

export type ProductUpdate = {
  name: string
  sku: string
  price: number | null
  cost: number | null
  vendor: string
  type: string
  image: string
}

const VENDOR_LABELS: Record<string, string> = {
  Heidbüchel: "Heidbüchel",
  Moss: "Moss",
  Kockartz: "Kockartz",
}

export function vendorLabel(vendor: string) {
  return VENDOR_LABELS[vendor] ?? (vendor || "—")
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(price)
}

export type CatalogSection = {
  id: string
  title: string
  products: CatalogProduct[]
  showVendor?: boolean
}

const BAKERY_SECTIONS = [
  { id: "heidbuechel", title: "Heidbüchel", vendor: "Heidbüchel" },
  { id: "kockartz", title: "Kockartz", vendor: "Kockartz" },
  { id: "moss", title: "Moss", vendor: "Moss" },
]

const VENDOR_RANK: Record<string, number> = {
  Heidbüchel: 0,
  Kockartz: 1,
  Moss: 2,
}

const OTHER_VENDORS = [
  "Malzers",
  "Brötli",
  "Maqii",
  "BeeBag",
  "Bioladung Hof Determeyer",
  "Lieferung",
]

export function catalogSections(products: CatalogProduct[]): CatalogSection[] {
  const printen = products.filter(isPrinten).sort(compareMixed)
  const sets = products.filter((product) => isSet(product) && !isPrinten(product)).sort(compareMixed)
  const flowers = products.filter(isFlower).sort(compareBySku)
  const rest = products.filter(
    (product) => !isPrinten(product) && !isSet(product) && !isFlower(product),
  )
  const sections: CatalogSection[] = BAKERY_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    products: rest.filter((product) => product.vendor === section.vendor).sort(compareBySku),
  }))
  sections.push(
    { id: "printen", title: "Printen", products: printen, showVendor: true },
    { id: "sets", title: "Сеты", products: sets, showVendor: true },
    { id: "flowers", title: "Цветы", products: flowers, showVendor: true },
  )

  const named = new Set(BAKERY_SECTIONS.map((section) => section.vendor))
  const others = [...new Set(rest.map((product) => product.vendor).filter((vendor) => !named.has(vendor)))]
  others.sort((left, right) => otherRank(left) - otherRank(right))
  for (const vendor of others) {
    sections.push({
      id: vendor || "other",
      title: vendorLabel(vendor),
      products: rest.filter((product) => product.vendor === vendor).sort(compareBySku),
    })
  }

  return sections.filter((section) => section.products.length > 0)
}

function isFlower(product: CatalogProduct) {
  return product.type === "Blumen"
}

function isPrinten(product: CatalogProduct) {
  return product.type === "Printen"
}

function isSet(product: CatalogProduct) {
  if (product.type === "Sets") return true
  return (
    product.vendor in VENDOR_RANK && /\bsets?\b/i.test(product.name)
  )
}

function compareMixed(left: CatalogProduct, right: CatalogProduct) {
  const vendor = (VENDOR_RANK[left.vendor] ?? 9) - (VENDOR_RANK[right.vendor] ?? 9)
  if (vendor !== 0) return vendor
  return compareBySku(left, right)
}

function otherRank(vendor: string) {
  const index = OTHER_VENDORS.indexOf(vendor)
  return index === -1 ? OTHER_VENDORS.length : index
}

function compareBySku(left: CatalogProduct, right: CatalogProduct) {
  const leftKey = skuKey(left.sku)
  const rightKey = skuKey(right.sku)
  if (leftKey.group !== rightKey.group) return leftKey.group - rightKey.group
  if (leftKey.number !== rightKey.number) return leftKey.number - rightKey.number
  const suffix = leftKey.suffix.localeCompare(rightKey.suffix, "de")
  if (suffix !== 0) return suffix
  return left.name.localeCompare(right.name, "de")
}

function skuKey(sku: string) {
  const match = sku.match(/^([A-Za-zА-Яа-я])?(\d+)(.*)$/)
  if (!sku) return { group: 2, number: 0, suffix: "" }
  if (!match?.[2]) return { group: 1, number: 0, suffix: sku }
  return { group: 0, number: Number(match[2]), suffix: match[3] ?? "" }
}
