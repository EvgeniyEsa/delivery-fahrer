import { parseShopifyDeliveryDate } from "@/lib/delivery-date"

const SHOPIFY_API_VERSION = "2026-10"
const DEFAULT_ORDER_LIMIT = 50

export type ShopifyShippingAddress = {
  address1: string | null
  address2: string | null
  city: string | null
  zip: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
}

export type ShopifyOrder = {
  id: string
  name: string
  customer: string | null
  phone: string | null
  deliveryDate: string | null
  shippingAddress: ShopifyShippingAddress | null
}

type ShopifyOrdersPayload = {
  data?: {
    orders?: {
      nodes?: Array<{
        legacyResourceId?: string | null
        id?: string | null
        name?: string | null
        phone?: string | null
        customer?: { displayName?: string | null } | null
        customAttributes?: Array<{ key?: string | null; value?: string | null }> | null
        shippingAddress?: {
          name?: string | null
          phone?: string | null
          address1?: string | null
          address2?: string | null
          city?: string | null
          zip?: string | null
          country?: string | null
          latitude?: number | null
          longitude?: number | null
        } | null
      }>
    }
  }
  errors?: Array<{ message?: string }>
}

const ORDERS_QUERY = `
  query RecentOrders($first: Int!) {
    orders(first: $first, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        legacyResourceId
        name
        phone
        customer {
          displayName
        }
        customAttributes {
          key
          value
        }
        shippingAddress {
          name
          phone
          address1
          address2
          city
          zip
          country
          latitude
          longitude
        }
      }
    }
  }
`

function getShopifyConfig() {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN

  if (!domain || !accessToken) {
    throw new Error("SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN must be set")
  }

  const host = domain.replace(/^https?:\/\//, "").replace(/\/$/, "")

  return { host, accessToken }
}

function orderId(node: { legacyResourceId?: string | null; id?: string | null }) {
  if (node.legacyResourceId) return node.legacyResourceId
  const match = node.id?.match(/(\d+)$/)
  return match?.[1] ?? null
}

export async function getShopifyOrders(
  limit = DEFAULT_ORDER_LIMIT,
): Promise<ShopifyOrder[]> {
  const { host, accessToken } = getShopifyConfig()
  const response = await fetch(
    `https://${host}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: ORDERS_QUERY,
        variables: { first: limit },
      }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200)
    throw new Error(
      `Shopify orders request failed (${response.status})${detail ? `: ${detail}` : ""}`,
    )
  }

  const payload = (await response.json()) as ShopifyOrdersPayload
  const nodes = payload.data?.orders?.nodes

  if (!nodes) {
    const message = payload.errors?.map((error) => error.message).filter(Boolean).join("; ")
    throw new Error(message || "Shopify не вернул заказы")
  }

  return nodes.flatMap((node) => {
    const id = orderId(node)
    if (!id) return []

    const shipping = node.shippingAddress
    const shippingAddress: ShopifyShippingAddress | null = shipping
      ? {
          address1: shipping.address1 ?? null,
          address2: shipping.address2 ?? null,
          city: shipping.city ?? null,
          zip: shipping.zip ?? null,
          country: shipping.country ?? null,
          latitude: shipping.latitude ?? null,
          longitude: shipping.longitude ?? null,
        }
      : null

    return [
      {
        id,
        name: node.name?.trim() || `#${id}`,
        customer:
          node.customer?.displayName?.trim() || shipping?.name?.trim() || null,
        phone: shipping?.phone?.trim() || node.phone?.trim() || null,
        deliveryDate: parseShopifyDeliveryDate(node.customAttributes ?? []),
        shippingAddress,
      },
    ]
  })
}

export function parseOrderComment(note: string | null | undefined) {
  if (!note) return ""
  const lines = note.split("\n")
  const infoIndex = lines.findIndex((line) => /^info\s*:/i.test(line.trim()))
  if (infoIndex <= 0) return ""

  return lines
    .slice(0, infoIndex)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
}

export type ShopifyOrderFacts = {
  deliveryDate: string | null
  comment: string
}

export async function getShopifyOrderFacts(shopifyOrderIds: string[]) {
  const facts = new Map<string, ShopifyOrderFacts>()
  const ids = [...new Set(shopifyOrderIds.filter(Boolean))]

  for (let index = 0; index < ids.length; index += 20) {
    const chunk = ids.slice(index, index + 20)
    const payload = await shopifyGraphql<{
      orders?: {
        nodes?: Array<{
          legacyResourceId?: string | null
          id?: string | null
          note?: string | null
          customAttributes?: Array<{ key?: string | null; value?: string | null }> | null
        }>
      }
    }>(
      `
        query OrderFacts($query: String!) {
          orders(first: 20, query: $query) {
            nodes {
              id
              legacyResourceId
              note
              customAttributes {
                key
                value
              }
            }
          }
        }
      `,
      { query: chunk.map((id) => `id:${id}`).join(" OR ") },
    )
    const nodes = payload.data?.orders?.nodes

    if (!nodes) {
      const message = payload.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join("; ")
      throw new Error(message || "Shopify не вернул даты доставки")
    }

    for (const node of nodes) {
      const id = orderId(node)
      if (!id) continue
      facts.set(id, {
        deliveryDate: parseShopifyDeliveryDate(node.customAttributes ?? []),
        comment: parseOrderComment(node.note),
      })
    }
  }

  return facts
}

export async function getShopifyDeliveryDates(shopifyOrderIds: string[]) {
  const facts = await getShopifyOrderFacts(shopifyOrderIds)
  return new Map(
    [...facts].map(([id, fact]) => [id, fact.deliveryDate]),
  )
}

export type ShopifyOrderItem = {
  name: string
  quantity: number
  sku: string
}

export async function getShopifyOrderItems(shopifyOrderIds: string[]) {
  const items = new Map<string, ShopifyOrderItem[]>()
  const ids = [...new Set(shopifyOrderIds.filter(Boolean))]

  for (let index = 0; index < ids.length; index += 20) {
    const chunk = ids.slice(index, index + 20)
    const payload = await shopifyGraphql<{
      orders?: {
        nodes?: Array<{
          legacyResourceId?: string | null
          id?: string | null
          lineItems?: {
            nodes?: Array<{
              name?: string | null
              quantity?: number | null
              sku?: string | null
            }>
          } | null
        }>
      }
    }>(
      `
        query OrderItems($query: String!) {
          orders(first: 20, query: $query) {
            nodes {
              id
              legacyResourceId
              lineItems(first: 40) {
                nodes {
                  name
                  quantity
                  sku
                }
              }
            }
          }
        }
      `,
      { query: chunk.map((id) => `id:${id}`).join(" OR ") },
    )
    const nodes = payload.data?.orders?.nodes
    if (!nodes) {
      const message = payload.errors
        ?.map((error) => error.message)
        .filter(Boolean)
        .join("; ")
      throw new Error(message || "Shopify не вернул товары заказа")
    }

    for (const node of nodes) {
      const id = orderId(node)
      if (!id) continue
      items.set(
        id,
        (node.lineItems?.nodes ?? []).flatMap((line) => {
          const name = line.name?.replace(/\s+-\s+Default Title$/i, "").trim() ?? ""
          const quantity = Number(line.quantity)
          if (!name || !Number.isFinite(quantity) || quantity <= 0) return []
          return [{ name, quantity, sku: line.sku?.trim() ?? "" }]
        }),
      )
    }
  }

  return items
}

export async function updateShopifyDeliveryDate(
  shopifyOrderId: string,
  isoDate: string,
) {
  const slash = formatSlashDate(isoDate)
  const dotted = formatDottedDate(isoDate)
  if (!slash || !dotted) {
    throw new Error("Некорректная дата доставки")
  }

  const gid = `gid://shopify/Order/${shopifyOrderId}`
  const current = await shopifyGraphql<{
    order?: {
      id?: string | null
      note?: string | null
      customAttributes?: Array<{ key?: string | null; value?: string | null }> | null
    } | null
  }>(
    `
      query OrderForDate($id: ID!) {
        order(id: $id) {
          id
          note
          customAttributes {
            key
            value
          }
        }
      }
    `,
    { id: gid },
  )
  const order = current.data?.order
  if (!order?.id) {
    const message = current.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join("; ")
    throw new Error(message || "Shopify не нашёл заказ")
  }

  const attributes = (order.customAttributes ?? []).flatMap((attribute) => {
    if (!attribute.key) return []
    if (attribute.key === "Liefertermin") return [{ key: attribute.key, value: slash }]
    if (attribute.key === "DeliveryData") {
      return [
        {
          key: attribute.key,
          value: replaceFirstDateLine(attribute.value ?? "", dotted),
        },
      ]
    }
    return [{ key: attribute.key, value: attribute.value ?? "" }]
  })

  if (!attributes.some((attribute) => attribute.key === "Liefertermin")) {
    attributes.push({ key: "Liefertermin", value: slash })
  }

  const updated = await shopifyGraphql<{
    orderUpdate?: {
      order?: { id?: string | null } | null
      userErrors?: Array<{ message?: string | null }>
    } | null
  }>(
    `
      mutation UpdateOrderDate($input: OrderInput!) {
        orderUpdate(input: $input) {
          order {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `,
    {
      input: {
        id: order.id,
        note: replaceFirstDateLine(order.note ?? "", dotted),
        customAttributes: attributes,
      },
    },
  )
  const userErrors = updated.data?.orderUpdate?.userErrors?.flatMap((error) =>
    error.message ? [error.message] : [],
  )
  if (userErrors && userErrors.length > 0) {
    throw new Error(userErrors.join("; "))
  }
  if (!updated.data?.orderUpdate?.order?.id) {
    const message = updated.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join("; ")
    throw new Error(message || "Shopify не сохранил дату доставки")
  }
}

function formatDottedDate(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return null
  return `${match[3]}.${match[2]}.${match[1]}`
}

function formatSlashDate(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return null
  return `${match[3]}/${match[2]}/${match[1].slice(2)}`
}

function replaceFirstDateLine(text: string, nextDate: string) {
  const lines = text.split("\n")
  const index = lines.findIndex((line) =>
    /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(line.trim()),
  )
  if (index === -1) return text
  lines[index] = nextDate
  return lines.join("\n")
}

async function shopifyGraphql<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<{ data?: T; errors?: Array<{ message?: string }> }> {
  const { host, accessToken } = getShopifyConfig()
  const response = await fetch(
    `https://${host}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200)
    throw new Error(
      `Shopify request failed (${response.status})${detail ? `: ${detail}` : ""}`,
    )
  }

  return (await response.json()) as {
    data?: T
    errors?: Array<{ message?: string }>
  }
}

export function formatShopifyAddress(
  address: ShopifyShippingAddress | null,
): string {
  if (!address) return ""

  const cityLine = [address.zip, address.city].filter(Boolean).join(" ")

  return [address.address1, address.address2, cityLine, address.country]
    .filter((part) => part && part.trim())
    .join(", ")
}
