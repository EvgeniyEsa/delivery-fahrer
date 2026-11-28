"use client"

import { useActionState, useMemo, useState } from "react"

import { saveEveningOrder } from "@/app/(dashboard)/subscriptions/actions"
import { Button } from "@/components/ui/button"
import { formatDeliveryDay } from "@/lib/delivery-date"
import { mossDeliveryStillOpen, mossOrderDeadline } from "@/lib/moss-orders"
import { clientOrderStillOpen } from "@/lib/order-changes"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
type ClientOption = {
  id: string
  name: string
  segment: "b2c" | "b2b"
}

type ProductOption = {
  id: string
  sku: string
  name: string
  label: string
  vendor: string
}

type SavedLine = {
  name: string
  quantity: number
  article: string
}

type Row = {
  article: string
  quantity: string
}

function closedOrderText(vendor: string, day: string) {
  if (vendor === "Moss") {
    const deadline = mossOrderDeadline(day)
    const when = deadline ? ` ${formatDeliveryDay(deadline)}` : ""
    return `Доставка ${formatDeliveryDay(day)}: заказ Moss нужно внести до 11:45${when}. Срок прошёл.`
  }
  return `Доставка ${formatDeliveryDay(day)}: заказ ${vendor} нужно внести не позже 17:00 накануне. Срок прошёл.`
}

function productIdFor(products: ProductOption[], line: SavedLine) {
  const article = line.article.trim().toUpperCase()
  const named = products.find(
    (product) => product.sku.toUpperCase() === article && product.name === line.name,
  )
  return (named ?? products.find((product) => product.sku.toUpperCase() === article))?.id ?? ""
}

export function EveningOrderForm({
  clients,
  products,
  day,
  saved,
  mossIds,
}: {
  clients: ClientOption[]
  products: ProductOption[]
  day: string
  saved: Record<string, SavedLine[]>
  mossIds: string[]
}) {
  const [state, action, pending] = useActionState(saveEveningOrder, null)
  const [subscriberId, setSubscriberId] = useState("")
  const [deliveryDay, setDeliveryDay] = useState(day)
  const [rows, setRows] = useState<Row[]>([{ article: "", quantity: "1" }])
  const [loadedKey, setLoadedKey] = useState("")

  const selectionKey = subscriberId && deliveryDay ? `${subscriberId}|${deliveryDay}` : ""
  if (selectionKey !== loadedKey) {
    const existing = selectionKey ? saved[selectionKey] : undefined
    setLoadedKey(selectionKey)
    setRows(
      existing && existing.length > 0
        ? existing.map((line) => ({ article: productIdFor(products, line), quantity: String(line.quantity) }))
        : [{ article: "", quantity: "1" }],
    )
  }

  const mossClosed =
    mossIds.includes(subscriberId) && deliveryDay !== "" && !mossDeliveryStillOpen(deliveryDay)
  const mossDeadline = mossClosed ? mossOrderDeadline(deliveryDay) : ""
  const closedProduct = rows
    .map((row) => products.find((product) => product.id === row.article))
    .find((product) => {
      if (!product || !deliveryDay) return false
      if (product.vendor !== "Heidbüchel" && product.vendor !== "Moss" && product.vendor !== "Kockartz") return false
      return !clientOrderStillOpen(product.vendor, deliveryDay)
    })
  const orderClosed = mossClosed || Boolean(closedProduct)

  const orderedClients = useMemo(
    () =>
      [...clients].sort((left, right) => {
        if (left.segment !== right.segment) return left.segment === "b2b" ? -1 : 1
        return left.name.localeCompare(right.name, "ru")
      }),
    [clients],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Вечерний заказ</CardTitle>
        <CardDescription>
          Если утром булочек больше или меньше, чем обычно, внесите список сюда. Heidbüchel и
          Kockartz — не позже 17:00 накануне доставки. Moss — до 11:45 в день заказа пекарне.
          Водитель увидит это количество и фото по SKU только в выбранный день.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="subscriberId" value={subscriberId} />
          <input type="hidden" name="lines" value={JSON.stringify(rows)} />
          <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
            <label className="flex flex-col gap-1 text-sm">
              Клиент
              <select
                className="h-9 rounded-md border bg-background px-2"
                value={subscriberId}
                onChange={(event) => setSubscriberId(event.target.value)}
              >
                <option value="">Выберите клиента</option>
                {orderedClients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.segment === "b2b" ? "B2B · " : ""}
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Дата доставки
              <Input
                name="day"
                type="date"
                value={deliveryDay}
                onChange={(event) => setDeliveryDay(event.target.value)}
                required
              />
            </label>
          </div>
          <div className="flex flex-col gap-2">
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_6rem_auto] gap-2">
                <select
                  className="h-9 rounded-md border bg-background px-2"
                  value={row.article}
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, article: event.target.value } : item,
                      ),
                    )
                  }
                >
                  <option value="">Булочка</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.label}
                    </option>
                  ))}
                </select>
                <Input
                  inputMode="numeric"
                  value={row.quantity}
                  aria-label="Количество"
                  onChange={(event) =>
                    setRows((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, quantity: event.target.value } : item,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setRows((current) =>
                      current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  Убрать
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRows((current) => [...current, { article: "", quantity: "1" }])}
            >
              Добавить позицию
            </Button>
            <Button type="submit" disabled={pending || !subscriberId || orderClosed}>
              {pending ? "Сохраняю…" : "Сохранить на это утро"}
            </Button>
          </div>
          {orderClosed ? (
            <p className="text-sm text-destructive">
              {closedProduct
                ? closedOrderText(closedProduct.vendor, deliveryDay)
                : `Доставка ${formatDeliveryDay(deliveryDay)}: заказ Moss нужно внести до 11:45${mossDeadline ? ` ${formatDeliveryDay(mossDeadline)}` : ""}. Срок прошёл.`}
            </p>
          ) : null}
          {state?.ok === false ? <p className="text-sm text-destructive">{state.error}</p> : null}
          {state?.ok === true ? (
            <p className="text-sm text-muted-foreground">
              Заказ сохранён. Водитель увидит его в маршруте на эту дату.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}
