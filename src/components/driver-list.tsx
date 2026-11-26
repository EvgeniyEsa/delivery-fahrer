import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { confirmStopDelivered } from "@/app/driver/actions"
import { DriverOverview } from "@/components/driver-overview"
import { DriverPhoto } from "@/components/driver-photo"
import type { RouteMapPoint } from "@/components/route-map"
import { buttonVariants } from "@/components/ui/button"
import { formatDeliveredAt } from "@/lib/delivery-date"
import type { DriverItem, DriverStop } from "@/lib/driver-stops"
import type { DriverBakery } from "@/lib/product-photos"
import { cn } from "cn"

const BAKERY = "Wolferskaul 4, 52078 Aachen"

export function DriverList({
  day,
  dayLabel,
  stops,
  path,
  previousHref,
  nextHref,
  error,
}: {
  day: string
  dayLabel: string
  stops: DriverStop[]
  path: Array<[number, number]>
  previousHref: string | null
  nextHref: string | null
  error: string | null
}) {
  const remaining = stops.filter((stop) => !isDone(stop)).length
  const points = routePoints(stops)
  const driveStops = stops.filter((stop) => !isDone(stop))
  const driveHref = mapsRouteUrl(driveStops.length > 0 ? driveStops : stops)
  const firstId = stops.find((stop) => !isDone(stop))?.id ?? null

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
          <DriverOverview points={points} path={path} />
          {driveHref ? (
            <a
              className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}
              href={driveHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              Как ехать
            </a>
          ) : null}
        </div>
      ) : null}
      <BakeryLegend />
      {error ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-base text-destructive">{error}</p>
      ) : null}
      {stops.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-8 text-center text-lg ring-1 ring-foreground/10">
          На эту дату остановок нет.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {stops.map((stop, index) => {
            const delivered = isDone(stop)
            const cardBakery = singleBakery(stop.items)
            const mixed = cardBakery ? [] : bakeriesIn(stop.items)
            return (
              <li key={stop.id}>
                <details
                  name="stops"
                  open={!delivered && stop.id === firstId}
                  className={cn(
                    "group rounded-lg px-3 py-1.5 ring-1 ring-foreground/10",
                    cardBakery ? cn(BAKERY_COLOR[cardBakery], "text-neutral-950") : "bg-card",
                    delivered && "opacity-60",
                  )}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
                    <span className="w-6 shrink-0 text-sm tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{stop.customer}</span>
                    {mixed.length > 0 ? (
                      <span className="flex shrink-0 gap-1" aria-hidden>
                        {mixed.map((bakery) => (
                          <span
                            key={bakery}
                            className={cn("size-3 rounded-full ring-1 ring-black/10", BAKERY_COLOR[bakery])}
                          />
                        ))}
                      </span>
                    ) : null}
                    {delivered ? (
                      <span className="max-w-40 shrink-0 text-right text-xs text-muted-foreground">
                        {stop.deliveredAt ? formatDeliveredAt(stop.deliveredAt) : "Доставлено"}
                      </span>
                    ) : null}
                    <ChevronDown
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="mt-2 border-t pt-2">
                    <p className="text-xl font-bold leading-snug">{stop.address}</p>
                    {stop.deliveredAt ? (
                      <p className="mt-1 text-sm">Доставлено {formatDeliveredAt(stop.deliveredAt)}</p>
                    ) : null}
                    <StopItems items={stop.items} tintRows={!cardBakery} />
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
                          >
                            Карта
                          </a>
                        ) : (
                          <p className="text-xs text-muted-foreground">Нет адреса, карта не откроется.</p>
                        )}
                        <form action={confirmStopDelivered}>
                          <input type="hidden" name="stopId" value={stop.id} />
                          <input type="hidden" name="shopify" value={stop.canComplete ? "1" : ""} />
                          <input type="hidden" name="day" value={day} />
                          <button
                            type="submit"
                            className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}
                          >
                            Подтвердить
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function tipTotal(stops: DriverStop[]) {
  return stops.reduce((sum, stop) => {
    for (const item of stop.items) {
      if (item.name === "Trinkgeld" && typeof item.amount === "number") sum += item.amount
    }
    return sum
  }, 0)
}

export function formatEuro(amount: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount)
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

function isDone(stop: DriverStop) {
  return Boolean(stop.deliveredAt) || (stop.canComplete && stop.status === "delivered")
}

const BAKERY_COLOR: Record<DriverBakery, string> = {
  Heidbüchel: "bg-[#fff3c4]",
  Moss: "bg-[#dff3d8]",
  Kockartz: "bg-[#e8c9a4]",
}

const BAKERY_LABEL: Record<DriverBakery, string> = {
  Heidbüchel: "Хайбюхель",
  Moss: "Мосс",
  Kockartz: "Кокарц",
}

function BakeryLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs text-neutral-950">
      {(Object.keys(BAKERY_LABEL) as DriverBakery[]).map((bakery) => (
        <span key={bakery} className={cn("rounded-full px-2.5 py-1", BAKERY_COLOR[bakery])}>
          {BAKERY_LABEL[bakery]}
        </span>
      ))}
    </div>
  )
}

function singleBakery(items: DriverItem[]) {
  const goods = items.filter((item) => item.name !== "Trinkgeld")
  const first = goods[0]?.bakery
  if (!first || goods.some((item) => item.bakery !== first)) return ""
  return first
}

function bakeriesIn(items: DriverItem[]) {
  return [...new Set(items.flatMap((item) => (item.bakery ? [item.bakery] : [])))]
}

function StopItems({ items, tintRows }: { items: DriverItem[]; tintRows: boolean }) {
  if (items.length === 0) return null

  return (
    <ul className="mt-2 flex flex-col gap-2">
      {items.map((item, index) => (
        <li
          key={`${item.name}-${index}`}
          className={cn(
            "flex items-center gap-3",
            tintRows && item.bakery && cn("rounded-md px-2 py-1 text-neutral-950", BAKERY_COLOR[item.bakery]),
          )}
        >
          {item.name === "Trinkgeld" ? null : <DriverPhoto name={item.name} src={item.image} />}
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
    <a href={href} className={className}>
      {content}
    </a>
  )
}
