import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { BakeryNoteCamera } from "@/components/bakery-note-camera"
import type { BakeryNote } from "@/lib/bakery-notes"
import { CollectedGoods, CollectGoodsButton, PackedLine } from "@/components/collected-goods"
import { ConfirmStopButton } from "@/components/confirm-stop-button"
import { TourSync } from "@/components/tour-sync"
import { StableDetails } from "@/components/stable-details"
import { DriverSearch } from "@/components/driver-search"
import { DriverOverview } from "@/components/driver-overview"
import { DriverPhoto } from "@/components/driver-photo"
import type { RouteMapPoint } from "@/components/route-map"
import { buttonVariants } from "@/components/ui/button"
import { formatDriverTime } from "@/lib/delivery-date"
import type { DriverHome } from "@/lib/driver-home"
import type { DriverItem, DriverStop } from "@/lib/driver-stops"
import { BAKERY_COLOR, type DriverBakery } from "@/lib/product-photos"
import { productSearchKey } from "@/lib/product-search"
import { drivingPath, type RouteStop } from "@/lib/routing"
import { cn } from "cn"

const BAKERY = "Wolferskaul 4, 52078 Aachen"

export async function DriverList({
  day,
  dayLabel,
  stops,
  notes,
  home,
  previousHref,
  nextHref,
  error,
}: {
  day: string
  dayLabel: string
  stops: DriverStop[]
  notes: BakeryNote[]
  home: DriverHome
  previousHref: string | null
  nextHref: string | null
  error: string | null
}) {
  const driveStops = stops.filter((stop) => !isDone(stop))
  const remaining = driveStops.length
  const points = routePoints(driveStops.length > 0 ? driveStops : stops, home)
  const path = await roadPath(points)
  const firstId = stops.find((stop) => !isDone(stop))?.id ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <DaySwitch href={previousHref} direction="back" />
        <div className="min-w-0 flex-1 text-center">
          <p className="text-base font-semibold leading-tight">{dayLabel}</p>
          <p className="text-sm text-muted-foreground">
            {stops.length === 0 ? "Keine Stopps." : `Noch ${remaining} von ${stops.length}.`}
          </p>
        </div>
        <DaySwitch href={nextHref} direction="forward" />
      </div>
      <TourSync day={day} />
      {path.length > 1 ? <DriverOverview points={points} path={path} /> : null}
      <BakeryLegend />
      {error ? (
        <p className="rounded-xl bg-destructive/10 px-4 py-3 text-base text-destructive">{error}</p>
      ) : null}
      {stops.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-8 text-center text-lg ring-1 ring-foreground/10">
          Für dieses Datum gibt es keine Stopps.
        </p>
      ) : (
        <DriverSearch>
        <CollectedGoods day={day} pending={pendingByBakery(stops)}>
        <ul className="flex flex-col gap-1">
          {stops.map((stop, index) => {
            const delivered = isDone(stop)
            const cardBakery = singleBakery(stop.items) || stop.bakery
            const mixed = cardBakery ? [] : bakeriesIn(stop.items)
            return (
              <li key={stop.id}>
                <StableDetails
                  name="stops"
                  open={!delivered && stop.id === firstId}
                  data-stop-id={stop.id}
                  data-pickup={isPickup(stop) ? stop.bakery : undefined}
                  data-stop=""
                  data-goods={searchGoods(stop)}
                  className={cn(
                    "group rounded-lg px-3 py-1.5 ring-1 ring-foreground/10",
                    cardBakery ? cn(BAKERY_COLOR[cardBakery], "text-neutral-950") : "bg-card",
                    delivered && "opacity-60 data-[hit=true]:opacity-100",
                    "data-[hit=true]:ring-2 data-[hit=true]:ring-amber-600 data-[dim=true]:opacity-40",
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
                        {stop.deliveredAt
                          ? formatDriverTime(stop.deliveredAt)
                          : isPickup(stop)
                            ? "Abgeholt"
                            : "Geliefert"}
                      </span>
                    ) : null}
                    <ChevronDown
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="mt-2 border-t pt-2">
                    <p className="text-xl font-bold leading-snug">
                      {stop.address === "Адрес не указан" ? "Adresse fehlt" : stop.address}
                    </p>
                    {stop.deliveredAt ? (
                      <p className="mt-1 text-sm">
                        {isPickup(stop) ? "Abgeholt" : "Geliefert"}{" "}
                        {formatDriverTime(stop.deliveredAt)}
                      </p>
                    ) : null}
                    {isPickup(stop) && stop.bakery ? (
                      <BakeryNoteCamera
                        day={day}
                        bakery={stop.bakery}
                        notes={notes.filter((note) => note.bakery === stop.bakery)}
                        invoice={
                          stop.items.length > 0 ? (
                            <StopItems items={stop.items} tintRows={false} invoice />
                          ) : (
                            <p className="mt-1 text-sm text-neutral-700">
                              Für diese Bäckerei sind keine Waren markiert.
                            </p>
                          )
                        }
                        map={
                          delivered ? null : mapDestination(stop) ? (
                            <a
                              className={cn(
                                buttonVariants({ size: "lg", variant: "outline" }),
                                "h-12 w-full text-base",
                              )}
                              href={googleMapsUrl(mapDestination(stop))}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Karte
                            </a>
                          ) : (
                            <p className="text-xs text-muted-foreground">Keine Adresse, die Karte öffnet sich nicht.</p>
                          )
                        }
                        pickup={
                          delivered ? null : { stopId: stop.id, shopify: stop.canComplete }
                        }
                      />
                    ) : (
                      <StopItems items={stop.items} stopId={stop.id} tintRows={!cardBakery} />
                    )}
                    {delivered || (isPickup(stop) && stop.bakery) ? null : (
                      <div className="mt-3 flex flex-col gap-2">
                        {stop.items.some((item) => item.name !== "Trinkgeld") ? (
                          <CollectGoodsButton stopId={stop.id} bakeries={bakeriesIn(stop.items)} />
                        ) : null}
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
                            Karte
                          </a>
                        ) : (
                          <p className="text-xs text-muted-foreground">Keine Adresse, die Karte öffnet sich nicht.</p>
                        )}
                        <ConfirmStopButton
                          stopId={stop.id}
                          shopify={stop.canComplete}
                          day={day}
                          label="Bestätigen"
                        />
                      </div>
                    )}
                  </div>
                </StableDetails>
              </li>
            )
          })}
        </ul>
        </CollectedGoods>
        </DriverSearch>
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

async function roadPath(points: RouteMapPoint[]) {
  if (points.length < 2) return []
  return drivingPath(
    points.flatMap((point) =>
      point.kind === "depot"
        ? []
        : [
            {
              id: point.id,
              address: point.detail,
              latitude: point.latitude,
              longitude: point.longitude,
            } satisfies RouteStop,
          ],
    ),
  )
}

function routePoints(stops: DriverStop[], home: DriverHome): RouteMapPoint[] {
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
      label: "B",
      title: "Brötli",
      detail: BAKERY,
    },
    ...places,
    ...(home.latitude != null && home.longitude != null
      ? [
          {
            id: "home",
            latitude: home.latitude,
            longitude: home.longitude,
            kind: "home" as const,
            label: "H",
            title: home.name || "Zuhause",
            detail: home.address,
          },
        ]
      : []),
  ]
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

function pendingByBakery(stops: DriverStop[]) {
  const pending = { Heidbüchel: [] as string[], Moss: [] as string[], Kockartz: [] as string[] }
  for (const stop of stops) {
    if (isPickup(stop) || isDone(stop)) continue
    for (const bakery of bakeriesIn(stop.items)) pending[bakery].push(stop.id)
  }
  return pending
}

function isDone(stop: DriverStop) {
  return Boolean(stop.deliveredAt) || (stop.canComplete && stop.status === "delivered")
}

function searchGoods(stop: DriverStop) {
  if (isPickup(stop)) return undefined
  const keys = stop.items.flatMap((item) =>
    item.name === "Trinkgeld" ? [] : [productSearchKey(`${item.name} ${item.article}`)],
  )
  return keys.join("|")
}

function isPickup(stop: DriverStop) {
  return stop.id.startsWith("pick:")
}

const BAKERY_LABEL: Record<DriverBakery, string> = {
  Heidbüchel: "Heidbüchel",
  Moss: "Moss",
  Kockartz: "Kockartz",
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

function StopItems({
  items,
  tintRows,
  invoice = false,
  stopId,
}: {
  items: DriverItem[]
  tintRows: boolean
  invoice?: boolean
  stopId?: string
}) {
  if (items.length === 0) return null

  return (
    <ul className="mt-3 flex flex-col gap-3">
      {items.map((item, index) => {
        const className = cn(
          "group/line flex items-center gap-2",
          "group-data-[hit=true]:data-[match=false]:opacity-40",
          "group-data-[hit=true]:data-[match=true]:text-neutral-950",
          tintRows && item.bakery && cn("rounded-md px-2 py-1 text-neutral-950", BAKERY_COLOR[item.bakery]),
        )
        const good =
          item.name === "Trinkgeld" ? undefined : productSearchKey(`${item.name} ${item.article}`)
        const row = (
          <>
            {item.name === "Trinkgeld" ? null : (
              <DriverPhoto name={item.name} src={item.image} compact={invoice} />
            )}
            {invoice ? (
              <span className="shrink-0 whitespace-nowrap text-base font-semibold tabular-nums">
                {item.article}
              </span>
            ) : null}
            <span
              lang="de"
              className={cn(
                "min-w-0 flex-1 break-words leading-snug",
                invoice ? "text-lg font-medium" : "text-xl font-semibold",
                "group-data-[hit=true]:group-data-[match=true]/line:text-neutral-950",
              )}
            >
              {item.name}
            </span>
            <span
              className={cn(
                "shrink-0 pl-1 font-semibold tabular-nums",
                invoice ? "text-lg" : "text-xl",
                "group-data-[hit=true]:group-data-[match=true]/line:text-neutral-950",
              )}
            >
              {item.amount == null ? `× ${item.quantity}` : formatEuro(item.amount)}
            </span>
          </>
        )
        if (!stopId) {
          return (
            <li key={`${item.name}-${index}`} data-good={good} className={className}>
              {row}
            </li>
          )
        }
        return (
          <PackedLine
            key={`${item.name}-${index}`}
            stopId={stopId}
            bakery={item.bakery}
            itemKey={`${item.bakery}|${item.article}|${item.name}|${index}`}
            data-good={good}
            className={className}
          >
            {row}
          </PackedLine>
        )
      })}
    </ul>
  )
}

function DaySwitch({
  href,
  direction,
}: {
  href: string | null
  direction: "back" | "forward"
}) {
  const className = cn(buttonVariants({ variant: "outline", size: "icon" }), "size-10")
  const label = direction === "back" ? "Zurück" : "Weiter"
  const icon = direction === "back" ? <ChevronLeft /> : <ChevronRight />

  if (!href) {
    return (
      <span className={cn(className, "opacity-40")} aria-disabled="true" aria-label={label}>
        {icon}
      </span>
    )
  }

  return (
    <a href={href} className={className} aria-label={label}>
      {icon}
    </a>
  )
}
