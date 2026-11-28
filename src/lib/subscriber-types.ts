export type SubscriberProduct = {
  name: string
  quantity: number
  article: string
}

export type SubscriberSegment = "b2c" | "b2b"

export type Subscriber = {
  id: string
  name: string
  phone: string
  email: string
  address: string
  segment: SubscriberSegment
  comment: string
  products: SubscriberProduct[]
  deliveryDates: string[]
  deliveryPrice: number | null
  latitude: number | null
  longitude: number | null
  createdAt: string | null
  archivedAt: string | null
}

export type SubscriberInput = {
  name: string
  phone: string
  email: string
  address: string
  comment: string
  products: SubscriberProduct[]
  deliveryDates: string[]
  deliveryPrice: number | null
}

export type SaveSubscriberResult =
  | { ok: true }
  | { ok: false; error: string }
