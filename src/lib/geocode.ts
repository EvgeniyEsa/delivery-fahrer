import { depot } from "@/lib/routing"

export async function geocodeAddress(address: string) {
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim()
  const query = address.trim()
  if (!token || token.startsWith("sk.") || !query) return null

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  )
  url.searchParams.set("access_token", token)
  url.searchParams.set("limit", "1")
  url.searchParams.set("country", "de")
  url.searchParams.set("language", "de")
  url.searchParams.set("proximity", `${depot.longitude},${depot.latitude}`)

  const response = await fetch(url)
  if (!response.ok) return null

  const body = (await response.json()) as {
    features?: Array<{ center?: [number, number] }>
  }
  const center = body.features?.[0]?.center
  if (!center) return null

  const [longitude, latitude] = center
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  return { latitude, longitude }
}
