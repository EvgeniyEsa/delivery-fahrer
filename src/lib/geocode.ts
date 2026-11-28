import { depot } from "@/lib/routing"

const MAX_DISTANCE_METERS = 80_000

export function coordinatesNearDepot(latitude: number, longitude: number) {
  return distanceMeters(latitude, longitude) <= MAX_DISTANCE_METERS
}

export async function geocodeAddress(address: string) {
  const token = process.env.MAPBOX_ACCESS_TOKEN?.trim()
  const query = address
    .trim()
    .replace(/\bB-(\d{4})\b/gi, "$1")
  if (!token || token.startsWith("sk.") || !query) return null

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  )
  url.searchParams.set("access_token", token)
  url.searchParams.set("limit", "1")
  url.searchParams.set("country", "de,be,nl")
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
  if (!coordinatesNearDepot(latitude, longitude)) return null

  return { latitude, longitude }
}

function distanceMeters(latitude: number, longitude: number) {
  const earth = 6_371_000
  const toRadians = (value: number) => (value * Math.PI) / 180
  const latitudeDelta = toRadians(latitude - depot.latitude)
  const longitudeDelta = toRadians(longitude - depot.longitude)
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(depot.latitude)) *
      Math.cos(toRadians(latitude)) *
      Math.sin(longitudeDelta / 2) ** 2
  return 2 * earth * Math.asin(Math.sqrt(a))
}
