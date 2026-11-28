"use client"

import { useEffect, useRef, useState } from "react"
import mapboxgl, { type GeoJSONSource } from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"

import type { RouteMapPoint } from "@/components/route-map"

function popupContent(point: RouteMapPoint) {
  const node = document.createElement("div")
  const title = document.createElement("strong")
  title.textContent = point.title
  const detail = document.createElement("div")
  detail.textContent = point.detail
  node.append(title, detail)
  return node
}

function markerElement(point: RouteMapPoint) {
  const size = point.kind === "stop" ? 28 : 34
  const element = document.createElement("div")
  element.textContent = point.label
  element.style.cssText = [
    "display:flex",
    `height:${size}px`,
    `width:${size}px`,
    "align-items:center",
    "justify-content:center",
    "border-radius:9999px",
    `background:${point.kind === "depot" ? "#b45309" : point.kind === "home" ? "#1d4ed8" : "#171717"}`,
    "color:#fff",
    "font:600 12px/1 sans-serif",
    "box-shadow:0 1px 4px rgb(0 0 0 / 35%)",
  ].join(";")
  return element
}

export function MapboxRouteMap({
  token,
  points,
  path,
}: {
  token: string
  points: RouteMapPoint[]
  path: Array<[number, number]>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const fittedRef = useRef("")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [6.1676347, 50.7554848],
      zoom: 11,
    })
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "top-left",
    )
    mapRef.current = map
    map.on("load", () => setReady(true))

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [token])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = points.map((point) =>
      new mapboxgl.Marker({ element: markerElement(point) })
        .setLngLat([point.longitude, point.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 16 }).setDOMContent(popupContent(point)),
        )
        .addTo(map),
    )

    const data: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: path,
      },
    }
    const source = map.getSource("route")
    if (source) {
      ;(source as GeoJSONSource).setData(data)
    } else if (path.length > 1) {
      map.addSource("route", { type: "geojson", data })
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#171717",
          "line-width": 4,
          "line-opacity": 0.85,
        },
      })
    }

    const signature = points
      .map((point) => `${point.latitude}@${point.longitude}`)
      .sort()
      .join("|")
    if (points.length > 0 && fittedRef.current !== signature) {
      fittedRef.current = signature
      const bounds = new mapboxgl.LngLatBounds()
      for (const point of points) {
        bounds.extend([point.longitude, point.latitude])
      }
      map.fitBounds(bounds, { padding: 48, maxZoom: 13, animate: false })
    }
  }, [points, path, ready])

  return <div ref={containerRef} className="h-[32rem] w-full" />
}
