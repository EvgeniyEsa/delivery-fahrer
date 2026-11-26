"use client"

import { useEffect, useMemo } from "react"
import L from "leaflet"
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet"
import "leaflet/dist/leaflet.css"

export type RouteMapPoint = {
  id: string
  latitude: number
  longitude: number
  kind: "depot" | "stop"
  label: string
  title: string
  detail: string
}

function markerIcon(point: RouteMapPoint) {
  const size = point.kind === "depot" ? 34 : 28
  const background = point.kind === "depot" ? "#b45309" : "#171717"

  return L.divIcon({
    className: "route-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<span style="display:flex;height:${size}px;width:${size}px;align-items:center;justify-content:center;border-radius:9999px;background:${background};color:#fff;font:600 12px/1 sans-serif;box-shadow:0 1px 4px rgb(0 0 0 / 35%)">${point.label}</span>`,
  })
}

function FitToPoints({ points }: { points: RouteMapPoint[] }) {
  const map = useMap()
  const signature = useMemo(
    () =>
      points
        .map((point) => `${point.latitude}@${point.longitude}`)
        .sort()
        .join("|"),
    [points],
  )

  useEffect(() => {
    const positions = signature
      .split("|")
      .filter(Boolean)
      .map((part) => {
        const [latitude, longitude] = part.split("@")
        return [Number(latitude), Number(longitude)] as [number, number]
      })
    if (positions.length === 0) return
    map.fitBounds(L.latLngBounds(positions).pad(0.25), {
      animate: false,
      maxZoom: 13,
    })
  }, [map, signature])

  return null
}

export function RouteMap({
  points,
  path,
  className,
}: {
  points: RouteMapPoint[]
  path: Array<[number, number]>
  className?: string
}) {
  const center = points[0] ?? {
    latitude: 50.7554848,
    longitude: 6.1676347,
  }

  return (
    <div className={`isolate overflow-hidden rounded-lg border ${className ?? "h-[32rem]"}`}>
      <style>{".route-marker{background:transparent;border:none}"}</style>
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom
        tapHold={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToPoints points={points} />
        {path.length > 1 ? (
          <Polyline
            positions={path}
            pathOptions={{ color: "#171717", weight: 3, opacity: 0.85 }}
          />
        ) : null}
        {points.map((point) => (
          <Marker
            key={`${point.id}-${point.label}`}
            position={[point.latitude, point.longitude]}
            icon={markerIcon(point)}
          >
            <Popup>
              <span className="font-medium">{point.title}</span>
              <span className="mt-1 block">{point.detail}</span>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
