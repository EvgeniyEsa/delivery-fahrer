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

export type AnchoredStop = RouteStop & {
  afterAnchorIds?: string[]
}

export function arrangeAroundAnchors(
  anchors: RouteStop[],
  visitors: AnchoredStop[],
  end: RouteStop | null = null,
): RouteStop[] {
  if (anchors.length === 0) {
    return optimizeOpenGap(depotStop(), orderStopsFrom(depot, visitors), end)
  }

  const route: AnchoredStop[] = [...anchors]
  const pending = [...visitors]

  while (pending.length > 0) {
    let bestCustomer = 0
    let bestAt = route.length
    let bestCost = Number.POSITIVE_INFINITY

    pending.forEach((customer, customerIndex) => {
      const earliest = earliestSlot(route, customer.afterAnchorIds)
      for (let slot = earliest; slot <= route.length; slot += 1) {
        const from = slot === 0 ? depotStop() : route[slot - 1]
        const to = route[slot]
        if (!from) continue
        const cost = to
          ? haversineMeters(from, customer) +
            haversineMeters(customer, to) -
            haversineMeters(from, to)
          : end
            ? haversineMeters(from, customer) +
              haversineMeters(customer, end) -
              haversineMeters(from, end)
            : haversineMeters(from, customer)
        if (cost < bestCost) {
          bestCost = cost
          bestCustomer = customerIndex
          bestAt = slot
        }
      }
    })

    const [next] = pending.splice(bestCustomer, 1)
    if (!next) break
    route.splice(bestAt, 0, next)
  }

  return optimizeGaps(route, new Set(anchors.map((anchor) => anchor.id)), end)
}

function earliestSlot(route: RouteStop[], afterAnchorIds: string[] | undefined) {
  let slot = route.length > 0 ? 1 : 0
  for (const id of afterAnchorIds ?? []) {
    const index = route.findIndex((stop) => stop.id === id)
    if (index >= 0) slot = Math.max(slot, index + 1)
  }
  return slot
}

function optimizeGaps(route: RouteStop[], anchorIds: Set<string>, end: RouteStop | null) {
  const ordered: RouteStop[] = []
  let gap: RouteStop[] = []
  let before: RouteStop = depotStop()

  const flush = (after: RouteStop | null) => {
    ordered.push(...optimizeOpenGap(before, gap, after))
    gap = []
  }

  for (const stop of route) {
    if (!anchorIds.has(stop.id)) {
      gap.push(stop)
      continue
    }
    flush(stop)
    ordered.push(stop)
    before = stop
  }

  flush(end)
  return ordered
}

function optimizeOpenGap(
  before: RouteStop,
  gap: RouteStop[],
  after: RouteStop | null,
) {
  if (gap.length < 2) return gap

  const route = [...gap]
  let improved = true

  while (improved) {
    improved = false

    for (let start = 0; start < route.length - 1 && !improved; start += 1) {
      for (let end = start + 1; end < route.length; end += 1) {
        const left = start === 0 ? before : route[start - 1]
        const right = end === route.length - 1 ? after : route[end + 1]
        const first = route[start]
        const last = route[end]
        if (!left || !first || !last) continue
        if (!right && end !== route.length - 1) continue

        const current = right
          ? haversineMeters(left, first) + haversineMeters(last, right)
          : haversineMeters(left, first)
        const swapped = right
          ? haversineMeters(left, last) + haversineMeters(first, right)
          : haversineMeters(left, last)
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
  stops: AnchoredStop[],
  fixedOrder: string[] = [],
  end: RouteStop | null = null,
): Promise<PlannedRoute> {
  const byId = new Map(stops.map((stop) => [stop.id, stop]))
  const anchors = fixedOrder.flatMap((id) => {
    const stop = byId.get(id)
    return stop ? [stop] : []
  })
  const anchorIds = new Set(anchors.map((stop) => stop.id))
  const visitors = stops.filter((stop) => !anchorIds.has(stop.id))

  return measureRoadRoute(arrangeAroundAnchors(anchors, visitors, end))
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
  } catch (error) {
    console.error(
      "[route] road geometry unavailable",
      error instanceof Error ? error.message : error,
    )
    return straight
  }

  return straight
}

const DIRECTIONS_COORDINATE_LIMIT = 25

export async function planRoute(stops: RouteStop[]): Promise<PlannedRoute> {
  const token = process.env.MAPBOX_ACCESS_TOKEN

  if (!token) {
    throw new Error("MAPBOX_ACCESS_TOKEN must be set")
  }

  if (stops.length > DIRECTIONS_COORDINATE_LIMIT) {
    return planLongRoute(stops)
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

async function planLongRoute(stops: RouteStop[]): Promise<PlannedRoute> {
  const step = DIRECTIONS_COORDINATE_LIMIT - 1
  const chunks: RouteStop[][] = []
  for (let start = 0; start < stops.length - 1; start += step) {
    const chunk = stops.slice(start, start + DIRECTIONS_COORDINATE_LIMIT)
    if (chunk.length >= 2) chunks.push(chunk)
  }

  const parts = await Promise.all(chunks.map((chunk) => planRoute(chunk)))
  const coordinates: Array<[number, number]> = []
  let distanceMeters = 0
  let durationSeconds = 0

  for (const part of parts) {
    distanceMeters += part.distanceMeters
    durationSeconds += part.durationSeconds
    const line = part.geometry?.coordinates ?? []
    coordinates.push(...(coordinates.length > 0 ? line.slice(1) : line))
  }

  return {
    stops,
    distanceMeters,
    durationSeconds,
    geometry: coordinates.length > 1 ? { type: "LineString", coordinates } : null,
    roadRoute: coordinates.length > 1 && parts.every((part) => part.roadRoute),
  }
}
