export type PartnerProduct = {
  name: string
  quantity: number
}

export type Partner = {
  id: string
  name: string
  phone: string
  address: string
  comment: string
  products: PartnerProduct[]
  visitDates: string[]
  position: number
  latitude: number | null
  longitude: number | null
  createdAt: string | null
}

export type PartnerInput = {
  name: string
  phone: string
  address: string
  comment: string
}

export type SavePartnerResult = { ok: true } | { ok: false; error: string }
