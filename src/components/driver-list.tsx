"use client"

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useRef, useState, useTransition } from "react"
import { createPortal } from "react-dom"

import type { RouteMapPoint } from "@/components/route-map"

const OverviewMap = dynamic(
  () => import("@/components/route-map").then((mod) => mod.RouteMap),
  {
    ssr: false,
    loading: () => <div className="h-72 animate-pulse rounded-lg bg-muted" />,
  },
)

const BAKERY = "Wolferskaul 4, 52078 Aachen"

import { confirmStopDelivered } from "@/app/driver/actions"
import { buttonVariants } from "@/components/ui/button"
import { formatDeliveredAt } from "@/lib/delivery-date"
import type { DriverItem, DriverStop } from "@/lib/driver-stops"
import { cn } from "cn"

export function DriverList({
  dayLabel,
  stops,
  path,
  previousHref,
  nextHref,
}: {
  dayLabel: string
  stops: DriverStop[]
  path: Array<[number, number]>
  previousHref: string | null
  nextHref: string | null
}) {
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<Set<string>>(() => new Set())
  const [times, setTimes] = useState<Record<string, string>>({})
  const [openId, setOpenId] = useState<string | null>(() => firstOpen(stops, new Set(), {}))
  const [, startTransition] = useTransition()
  const cards = useRef(new Map<string, HTMLLIElement>())

  const remaining = stops.filter((stop) => !isDone(stop, confirmed, times)).length
  const points = routePoints(stops)
  const driveStops = stops.filter((stop) => !isDone(stop, confirmed, times))
  const driveHref = mapsRouteUrl(driveStops.length > 0 ? driveStops : stops)

  useEffect(() => {
    if (!openId) return
    cards.current.get(openId)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [openId])

  function confirm(id: string) {
    const stop = stops.find((item) => item.id === id)
    if (!stop || isDone(stop, confirmed, times)) return
    setError(null)
    setPendingId(id)
    startTransition(async () => {
      try {
        const result = await confirmStopDelivered(stop.id, stop.canComplete)
        if (!result.ok) {
          setError(result.error)
          return
        }
        const nextTimes = { ...times, [id]: result.deliveredAt }
        const done = new Set(confirmed).add(id)
        setTimes(nextTimes)
        setConfirmed(done)
        setOpenId(nextStop(stops, id, done, nextTimes))
      } catch {
        setError("Не удалось сохранить время доставки")
      } finally {
        setPendingId(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <DaySwitch href={previousHref} direction="back">
          Назад
        </DaySwitch>
        <DaySwitch href={nextHref} direction="forward">
          Дальше
        </DaySwitch>
      </div>
      <p className="text-lg text-muted-foreground">
        {dayLabel}.{" "}
        {stops.length === 0
          ? "Остановок нет."
          : `Осталось ${remaining} из ${stops.length}.`}
      </p>
      {points.length > 1 ? (
        <div className="flex flex-col gap-2">
          <OverviewMap points={points} path={path} className="h-72" />
          {driveHref ? (
            <a
              className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}
              href={driveHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => openRouteInAppleMaps(event, driveStops.length > 0 ? driveStops : stops)}
            >
              Как ехать
            </a>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-base text-destructive">
          {error}
        </p>
      ) : null}
      {stops.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-8 text-center text-lg ring-1 ring-foreground/10">
          На эту дату остановок нет.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {stops.map((stop, index) => {
            const delivered = isDone(stop, confirmed, times)
            const deliveredAt = times[stop.id] ?? stop.deliveredAt
            const saving = pendingId === stop.id
            const open = openId === stop.id

            return (
              <li
                key={stop.id}
                ref={(node) => {
                  if (node) cards.current.set(stop.id, node)
                  else cards.current.delete(stop.id)
                }}
                className={cn(
                  "rounded-lg bg-card px-3 py-1.5 ring-1 ring-foreground/10",
                  delivered && "opacity-60",
                )}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : stop.id)}
                  >
                    <span className="w-6 shrink-0 text-sm tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{stop.customer}</span>
                    <ChevronDown
                      className={cn(
                        "size-4 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>
                  {delivered ? (
                    <span className="max-w-40 shrink-0 text-right text-xs text-muted-foreground">
                      {deliveredAt ? formatDeliveredAt(deliveredAt) : "Доставлено"}
                    </span>
                  ) : null}
                </div>
                {open ? (
                  <div className="mt-2 border-t pt-2">
                    <p className="text-xl font-bold leading-snug">{stop.address}</p>
                    {deliveredAt ? (
                      <p className="mt-1 text-sm">Доставлено {formatDeliveredAt(deliveredAt)}</p>
                    ) : null}
                    <StopItems items={stop.items} quietEmpty />
                    {delivered ? null : (
                      <div className="mt-3 flex flex-col gap-2">
                        {mapDestination(stop) ? (
                          <a
                            className={cn(
                              buttonVariants({ size: "lg", variant: "outline" }),
                              "h-12 w-full text-base",
                            )}
                            href={googleMapsUrl(mapDestination(stop))}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => openAppleMaps(event, stop)}
                          >
                            Карта
                          </a>
                        ) : (
                          <button
                            type="button"
                            className={cn(
                              buttonVariants({ size: "lg", variant: "outline" }),
                              "h-12 w-full text-base",
                            )}
                            disabled
                          >
                            Карта
                          </button>
                        )}
                        {mapDestination(stop) ? null : (
                          <p className="text-xs text-muted-foreground">Нет адреса, карта не откроется.</p>
                        )}
                        <button
                          type="button"
                          className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}
                          disabled={saving}
                          onClick={() => confirm(stop.id)}
                        >
                          {saving ? "…" : "Подтвердить"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function routePoints(stops: DriverStop[]): RouteMapPoint[] {
  const places = stops.flatMap((stop, index) => {
    if (stop.latitude == null || stop.longitude == null) return []
    return [
      {
        id: stop.id,
        latitude: stop.latitude,
        longitude: stop.longitude,
        kind: "stop" as const,
        label: String(index + 1),
        title: stop.customer,
        detail: stop.address,
      },
    ]
  })
  if (places.length === 0) return []
  return [
    {
      id: "depot",
      latitude: 50.7554848,
      longitude: 6.1676347,
      kind: "depot",
      label: "П",
      title: "Brötli",
      detail: BAKERY,
    },
    ...places,
  ]
}

function mapsRouteUrl(stops: DriverStop[]) {
  const points = [BAKERY, ...stops.map(mapDestination).filter(Boolean)]
  if (points.length < 2) return ""
  return `https://www.google.com/maps/dir/${points.map((point) => encodeURIComponent(point)).join("/")}`
}

function openRouteInAppleMaps(
  event: { preventDefault(): void },
  stops: DriverStop[],
) {
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) return
  const destinations = stops.map(mapDestination).filter(Boolean)
  if (destinations.length === 0) return
  event.preventDefault()
  const stopsQuery = destinations
    .map((destination) => `&daddr=${encodeURIComponent(destination)}`)
    .join("")
  window.open(
    `https://maps.apple.com/?dirflg=d&saddr=${encodeURIComponent(BAKERY)}${stopsQuery}`,
    "_blank",
    "noopener,noreferrer",
  )
}

function mapDestination(stop: DriverStop) {
  if (stop.latitude != null && stop.longitude != null) {
    return `${stop.latitude},${stop.longitude}`
  }
  const address = stop.address.trim()
  if (!address || address === "Адрес не указан") return ""
  return address
}

function googleMapsUrl(destination: string) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`
}

function openAppleMaps(event: { preventDefault(): void }, stop: DriverStop) {
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) return
  const destination = mapDestination(stop)
  if (!destination) return
  event.preventDefault()
  window.open(
    `https://maps.apple.com/?daddr=${encodeURIComponent(destination)}&dirflg=d`,
    "_blank",
    "noopener,noreferrer",
  )
}

function isDone(
  stop: DriverStop,
  confirmed: Set<string>,
  times: Record<string, string>,
) {
  return (
    confirmed.has(stop.id) ||
    Boolean(times[stop.id] ?? stop.deliveredAt) ||
    (stop.canComplete && stop.status === "delivered")
  )
}

function firstOpen(
  stops: DriverStop[],
  confirmed: Set<string>,
  times: Record<string, string>,
) {
  return stops.find((stop) => !isDone(stop, confirmed, times))?.id ?? null
}

function nextStop(
  stops: DriverStop[],
  currentId: string,
  confirmed: Set<string>,
  times: Record<string, string>,
) {
  const index = stops.findIndex((stop) => stop.id === currentId)
  return stops.slice(index + 1).find((stop) => !isDone(stop, confirmed, times))?.id ?? null
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount)
}

function StopItems({
  items,
  quietEmpty = false,
}: {
  items: DriverItem[]
  quietEmpty?: boolean
}) {
  if (items.length === 0) {
    if (quietEmpty) return null
    return <p className="text-sm text-muted-foreground">В заказе нет списка товаров.</p>
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={`${item.name}-${index}`} className="flex items-center gap-3">
          {item.name === "Trinkgeld" ? null : (
            <ItemPhoto name={item.name} src={item.image} />
          )}
          <span className="min-w-0 flex-1 text-sm">{item.name}</span>
          <span
            className={cn(
              "shrink-0 text-sm tabular-nums",
              item.amount == null ? "text-muted-foreground" : "font-semibold",
            )}
          >
            {item.amount == null ? `× ${item.quantity}` : formatEuro(item.amount)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ItemPhoto({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  if (!src || failed) {
    return <span className="block size-20 shrink-0 rounded-lg bg-black/5" aria-hidden />
  }

  return (
    <>
      <button
        type="button"
        className="shrink-0 rounded-lg"
        aria-label={`Открыть фото: ${name}`}
        onClick={() => setOpen(true)}
      >
        <img
          src={src}
          alt=""
          className="size-20 rounded-lg object-cover"
          onError={() => setFailed(true)}
        />
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              role="dialog"
              aria-modal="true"
              aria-label={name}
              onClick={() => setOpen(false)}
            >
              <img
                src={src}
                alt={name}
                className="max-h-[85vh] max-w-[90vw] rounded-lg bg-white object-contain"
                onClick={(event) => event.stopPropagation()}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function DaySwitch({
  href,
  direction,
  children,
}: {
  href: string | null
  direction: "back" | "forward"
  children: string
}) {
  const className = cn(buttonVariants({ variant: "outline", size: "lg" }), "h-12 w-full text-base")
  const icon = direction === "back" ? <ChevronLeft /> : <ChevronRight />
  const content = (
    <>
      {direction === "back" ? icon : null}
      {children}
      {direction === "forward" ? icon : null}
    </>
  )

  if (!href) {
    return (
      <span className={cn(className, "opacity-40")} aria-disabled="true">
        {content}
      </span>
    )
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  )
}
