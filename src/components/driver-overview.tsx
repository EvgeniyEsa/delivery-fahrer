"use client"

import dynamic from "next/dynamic"

import type { RouteMapPoint } from "@/components/route-map"

const OverviewMap = dynamic(
  () => import("@/components/route-map").then((mod) => mod.RouteMap),
  {
    ssr: false,
    loading: () => <div className="h-72 animate-pulse rounded-lg bg-muted" />,
  },
)

export function DriverOverview({
  points,
  path,
}: {
  points: RouteMapPoint[]
  path: Array<[number, number]>
}) {
  if (points.length < 2) return null
  return <OverviewMap points={points} path={path} className="h-72" />
}
