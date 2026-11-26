export const depot = {
  id: "depot",
  name: "Brötli",
  address: "Wolferskaul 4, 52078 Aachen",
  latitude: 50.7554848,
  longitude: 6.1676347,
}

export type RouteStop = {
  id: string
  address: string
  longitude: number
  latitude: number
}

export type RouteGeometry = {
  type: "LineString"
  coordinates: Array<[longitude: number, latitude: number]>
}

export type PlannedRoute = {
  stops: RouteStop[]
  distanceMeters: number
  durationSeconds: number
  geometry: RouteGeometry | null
  roadRoute: boolean
}

type MapboxDirectionsResponse = {
  routes?: Array<{
    distance: number
    duration: number
    geometry: RouteGeometry
  }>
}

const CITY_SPEED_METERS_PER_SECOND = 28_000 / 3600
const STOP_SERVICE_SECONDS = 4 * 60

function haversineMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const earthRadius = 6_371_000
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(to.latitude - from.latitude)
  const longitudeDelta = toRadians(to.longitude - from.longitude)
  const fromLatitude = toRadians(from.latitude)
  const toLatitude = toRadians(to.latitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2

  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(haversine)))
}

export function orderStopsFromDepot(stops: RouteStop[]): RouteStop[] {
  return orderStopsFrom(
    { latitude: depot.latitude, longitude: depot.longitude },
    stops,
  )
}

function orderStopsFrom(
  origin: { latitude: number; longitude: number },
  stops: RouteStop[],
): RouteStop[] {
  const remaining = [...stops]
  const ordered: RouteStop[] = []
  let current = origin

  while (remaining.length > 0) {
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY

    remaining.forEach((stop, index) => {
      const distance = haversineMeters(current, stop)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    const [next] = remaining.splice(nearestIndex, 1)
    if (!next) break
    ordered.push(next)
    current = next
  }

  return ordered
}

export function measureOrderedRoute(stops: RouteStop[]): PlannedRoute {
  const loop = [
    {
      id: depot.id,
      address: depot.address,
      latitude: depot.latitude,
      longitude: depot.longitude,
    },
    ...stops,
    {
      id: depot.id,
      address: depot.address,
      latitude: depot.latitude,
      longitude: depot.longitude,
    },
  ]
  let distanceMeters = 0

  for (let index = 1; index < loop.length; index += 1) {
    const previous = loop[index - 1]
    const current = loop[index]
    if (!previous || !current) continue
    distanceMeters += haversineMeters(previous, current)
  }

  return {
    stops,
    distanceMeters,
    durationSeconds:
      distanceMeters / CITY_SPEED_METERS_PER_SECOND +
      stops.length * STOP_SERVICE_SECONDS,
    geometry: {
      type: "LineString",
      coordinates: loop.map((stop) => [stop.longitude, stop.latitude]),
    },
    roadRoute: false,
  }
}

function depotStop(): RouteStop {
  return {
    id: depot.id,
    address: depot.address,
    latitude: depot.latitude,
    longitude: depot.longitude,
  }
}

export async function measureRoadRoute(stops: RouteStop[]): Promise<PlannedRoute> {
  if (!process.env.MAPBOX_ACCESS_TOKEN || stops.length === 0) {
    return measureOrderedRoute(stops)
  }

  const loop = [depotStop(), ...stops, depotStop()]

  if (loop.length > 25) {
    return measureOrderedRoute(stops)
  }

  try {
    const planned = await planRoute(loop)
    return {
      ...planned,
      stops,
      durationSeconds:
        planned.durationSeconds + stops.length * STOP_SERVICE_SECONDS,
    }
  } catch {
    return measureOrderedRoute(stops)
  }
}

function twoOpt(stops: RouteStop[], lockedCount = 0) {
  if (stops.length - lockedCount < 2) return stops
  if (lockedCount === 0 && stops.length < 4) return stops

  const route = [...stops]
  let improved = true

  while (improved) {
    improved = false

    for (let start = lockedCount; start < route.length - 1 && !improved; start += 1) {
      for (let end = start + 1; end < route.length; end += 1) {
        const before = start === 0 ? depotStop() : route[start - 1]
        const after = end === route.length - 1 ? depotStop() : route[end + 1]
        const first = route[start]
        const last = route[end]
        if (!before || !after || !first || !last) continue

        const current =
          haversineMeters(before, first) + haversineMeters(last, after)
        const swapped =
          haversineMeters(before, last) + haversineMeters(first, after)
        if (swapped + 50 >= current) continue

        const reversed = route.slice(start, end + 1).reverse()
        route.splice(start, reversed.length, ...reversed)
        improved = true
        break
      }
    }
  }

  return route
}

export async function buildDeliveryPlan(
  stops: RouteStop[],
  fixedOrder: string[] = [],
): Promise<PlannedRoute> {
  const byId = new Map(stops.map((stop) => [stop.id, stop]))
  const prefix = fixedOrder.flatMap((id) => {
    const stop = byId.get(id)
    return stop ? [stop] : []
  })
  const prefixIds = new Set(prefix.map((stop) => stop.id))
  const rest = stops.filter((stop) => !prefixIds.has(stop.id))
  const origin = prefix.at(-1) ?? {
    latitude: depot.latitude,
    longitude: depot.longitude,
  }

  return measureRoadRoute(
    twoOpt([...prefix, ...orderStopsFrom(origin, rest)], prefix.length),
  )
}

export async function drivingPath(
  stops: RouteStop[],
): Promise<Array<[latitude: number, longitude: number]>> {
  const sequence = [depotStop(), ...stops]
  const straight = sequence.map(
    (stop) => [stop.latitude, stop.longitude] as [number, number],
  )
  if (sequence.length < 2 || !process.env.MAPBOX_ACCESS_TOKEN) return straight

  try {
    const planned = await planRoute(sequence)
    const line = planned.geometry?.coordinates ?? []
    if (line.length > 1) {
      return line.map(([longitude, latitude]) => [latitude, longitude])
    }
  } catch {
    return straight
  }

  return straight
}

export async function planRoute(stops: RouteStop[]): Promise<PlannedRoute> {
  const token = process.env.MAPBOX_ACCESS_TOKEN

  if (!token) {
    throw new Error("MAPBOX_ACCESS_TOKEN must be set")
  }

  if (stops.length < 2) {
    return {
      stops,
      distanceMeters: 0,
      durationSeconds: 0,
      geometry: null,
      roadRoute: false,
    }
  }

  const coordinates = stops
    .map((stop) => `${stop.longitude},${stop.latitude}`)
    .join(";")
  const params = new URLSearchParams({
    access_token: token,
    overview: "full",
    geometries: "geojson",
  })

  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${params}`,
    { cache: "no-store" },
  )

  if (!response.ok) {
    throw new Error(`Mapbox directions request failed (${response.status})`)
  }

  const data = (await response.json()) as MapboxDirectionsResponse
  const route = data.routes?.[0]

  if (!route) {
    throw new Error("Mapbox returned no route")
  }

  return {
    stops,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: route.geometry,
    roadRoute: true,
  }
}
