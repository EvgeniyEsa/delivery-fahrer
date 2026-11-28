import type { Metadata } from "next"
import { Suspense } from "react"

import { EveningOrderForm } from "@/components/evening-order-form"
import { MossOrderCard } from "@/components/moss-order-card"
import { SubscriberBoard } from "@/components/subscriber-board"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { subscriberClosedOn, subscriberUsesMoss } from "@/lib/bakery-closures"
import { listB2bPortals } from "@/lib/b2b-portals"
import { addDays, formatDeliveryDay, todayInBerlin } from "@/lib/delivery-date"
import { eveningOrderKey, listEveningOrderRecords, listEveningOrders } from "@/lib/evening-orders"
import { mossDeliveriesOrderedOn, sundayOrderOpen } from "@/lib/moss-orders"
import { diffOrderLines, formatOrderClock, orderChangeIsLate } from "@/lib/order-changes"
import { normalizeArticle } from "@/lib/product-article"
import { listProducts } from "@/lib/products"
import { customerOrigin } from "@/lib/public-origin"
import { listSubscribers } from "@/lib/subscribers"
import type { Subscriber } from "@/lib/subscriber-types"

export const metadata: Metadata = {
  title: "Абонементы",
}

export default function SubscriptionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Абонементы</h1>
        <p className="text-sm text-muted-foreground">
          Клиенты с постоянной доставкой. Карточку можно изменить, убрать в архив или удалить.
        </p>
      </div>
      <Suspense fallback={<ListFallback />}>
        <SubscriberWorkspace />
      </Suspense>
    </div>
  )
}

async function SubscriberWorkspace() {
  let error: string | null = null
  let subscribers: Awaited<ReturnType<typeof listSubscribers>> = []

  try {
    subscribers = await listSubscribers()
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Не удалось прочитать абонементы"
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Клиенты</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  const [catalog, eveningOrders] = await Promise.all([listProducts(), listEveningOrders()])
  const bakeryOrder = ["Heidbüchel", "Moss", "Kockartz"]
  const products = catalog
    .filter(
      (product) =>
        bakeryOrder.includes(product.vendor) && product.status === "active" && product.sku.trim(),
    )
    .map((product) => ({
      id: product.id,
      sku: normalizeArticle(product.sku),
      name: product.name,
      label: `${normalizeArticle(product.sku)} ${product.name} · ${product.vendor}`,
      vendor: product.vendor,
    }))
    .sort((left, right) => {
      const bakery = bakeryOrder.indexOf(left.vendor) - bakeryOrder.indexOf(right.vendor)
      const leftNumber = Number(left.sku.slice(1))
      const rightNumber = Number(right.sku.slice(1))
      return bakery || leftNumber - rightNumber || left.name.localeCompare(right.name, "de")
    })

  const today = todayInBerlin()
  const mossDays = mossDeliveriesOrderedOn(today)
  const mossClients = subscribers.filter(subscriberUsesMoss)

  return (
    <div className="flex flex-col gap-6">
      <MossOrderCard
        summary={mossSummary(today, mossDays)}
        days={mossDays.map((day) => ({
          day,
          label: formatDeliveryDay(day),
          clients: mossClients.flatMap((subscriber) => {
            if (!subscriber.deliveryDates.includes(day) || subscriberClosedOn(subscriber, day)) return []
            const evening = eveningOrders.get(eveningOrderKey(subscriber.id, day))
            const lines = evening && evening.length > 0 ? evening : subscriber.products
            if (lines.length === 0) return []
            return [
              {
                id: subscriber.id,
                name: subscriber.name,
                changed: Boolean(evening && evening.length > 0),
                lines: lines.map((line) => `${line.name}${line.article ? ` ${line.article}` : ""} × ${line.quantity}`).join(", "),
              },
            ]
          }),
        }))}
      />
      <PortalLinks subscribers={subscribers} />
      <HotelChanges subscribers={subscribers} />
      <EveningOrderForm
        clients={subscribers
          .filter((subscriber) => !subscriber.archivedAt)
          .map((subscriber) => ({
            id: subscriber.id,
            name: subscriber.name,
            segment: subscriber.segment,
          }))}
        products={products}
        day={addDays(today, 1)}
        saved={Object.fromEntries(eveningOrders)}
        mossIds={mossClients.map((subscriber) => subscriber.id)}
      />
      <SubscriberBoard subscribers={subscribers} />
    </div>
  )
}

function mossSummary(today: string, days: string[]) {
  if (days.length > 0) {
    return `Сегодня в Moss отправляем заказ на ${days.map((day) => formatDeliveryDay(day)).join(" и ")}. Клиенты с товарами Moss должны внести заказ до 11:45.`
  }
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
  if (weekday === 0 && !sundayOrderOpen()) {
    return "Сегодня воскресенье, после 11:45. Заказ Moss на среду отправляется в понедельник."
  }
  return "Сегодня в Moss заказ для B2B не отправляется."
}

async function PortalLinks({ subscribers }: { subscribers: Subscriber[] }) {
  const portals = await listB2bPortals()
  if (portals.length === 0) return null

  const origin = await customerOrigin()
  const byId = new Map(subscribers.map((subscriber) => [subscriber.id, subscriber.name]))
  const links = portals.map((portal) => ({
    name: byId.get(portal.subscriberId) ?? "Клиент",
    bakery: portal.bakery,
    href: `${origin}/order/${portal.token}`,
  }))
  const hasMoss = links.some((link) => link.bakery === "Moss")

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ссылки для заказа</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">
          Kockartz: булочки, хлеб, круассаны и фладен, без сетов, до 17:00 накануне. Счёт отелям выставляется раз в две недели по этим накладным, не по постоянной корзине.
          {hasMoss
            ? " Moss: весь каталог пекарни. Заказ нужно внести до 11:45 в день, когда Moss принимает заказ на эту доставку."
            : ""}
        </p>
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.href} className="flex flex-col gap-1">
              <span className="font-medium">
                {link.name}
                {link.bakery === "Moss" ? " · Moss" : ""}
              </span>
              <a href={link.href} className="break-all text-primary underline-offset-4 hover:underline">
                {link.href}
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

async function HotelChanges({ subscribers }: { subscribers: Subscriber[] }) {
  const [portals, records] = await Promise.all([listB2bPortals(), listEveningOrderRecords()])
  const names = new Map(subscribers.map((subscriber) => [subscriber.id, subscriber.name]))
  const changes = portals
    .flatMap((portal) => {
      const prefix = `${portal.subscriberId}|`
      return [...records.entries()].flatMap(([key, record]) => {
        if (!key.startsWith(prefix) || record.versions.length < 2) return []
        const day = key.slice(prefix.length)
        return record.versions.slice(1).flatMap((version, index) => {
          const previous = record.versions[index]
          if (!previous || !version.at) return []
          return [
            {
              key: `${key}|${version.at}`,
              name: names.get(portal.subscriberId) ?? "Отель",
              day,
              at: version.at,
              late: orderChangeIsLate(day, version.at),
              rows: diffOrderLines(previous.lines, version.lines),
            },
          ]
        })
      })
    })
    .sort((left, right) => right.at.localeCompare(left.at))

  if (changes.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Правки отелей</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {changes.map((change) => (
          <div key={change.key}>
            <p className="font-medium">
              {change.name} · {change.day}
              {change.late ? " · после 17:00" : ""}
            </p>
            <p className="text-muted-foreground">{formatOrderClock(change.at)}</p>
            <ul className="mt-1">
              {change.rows.map((row) => (
                <li key={row.name}>
                  {row.name}: {row.from} → {row.to}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ListFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Клиенты</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  )
}
