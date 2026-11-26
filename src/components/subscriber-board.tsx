"use client"

import { useRef, useState, useTransition } from "react"

import { deleteSubscriber } from "@/app/(dashboard)/subscriptions/actions"
import { SubscriberForm } from "@/components/subscriber-form"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDeliveryDay, formatDeliverySchedule } from "@/lib/delivery-date"
import { describeProduct } from "@/lib/product-article"
import type { Subscriber } from "@/lib/subscriber-types"

function clientKey(name: string) {
  return name.trim().toLocaleLowerCase("ru")
}

function clientNumbers(subscribers: Subscriber[]) {
  const numbers = new Map<string, number>()
  const byId = new Map<string, number>()
  for (const subscriber of subscribers) {
    const key = clientKey(subscriber.name)
    let number = numbers.get(key)
    if (number === undefined) {
      number = numbers.size + 1
      numbers.set(key, number)
    }
    byId.set(subscriber.id, number)
  }
  return { byId, count: numbers.size }
}

function subscriptionCount(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} абонемент`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} абонемента`
  }
  return `${count} абонементов`
}

function ProductCells({ products }: { products: Subscriber["products"] }) {
  const lines = products.map((product) => describeProduct(product))
  if (lines.length === 0) {
    return (
      <>
        <TableCell>—</TableCell>
        <TableCell>—</TableCell>
        <TableCell>—</TableCell>
      </>
    )
  }

  return (
    <>
      <TableCell className="max-w-48 align-top">
        {lines.map((line, index) => (
          <div key={index} className="text-xs leading-5">
            {line.name} × {line.quantity}
          </div>
        ))}
      </TableCell>
      <TableCell className="align-top">
        {lines.map((line, index) => (
          <div key={index} className="text-xs leading-5 font-medium">
            {line.article || "—"}
          </div>
        ))}
      </TableCell>
      <TableCell className="align-top">
        {lines.map((line, index) => (
          <div key={index} className="text-xs leading-5 text-muted-foreground">
            {line.bakery || "—"}
          </div>
        ))}
      </TableCell>
    </>
  )
}

export function SubscriberBoard({ subscribers }: { subscribers: Subscriber[] }) {
  const formRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const editing = subscribers.find((subscriber) => subscriber.id === editingId) ?? null
  const clients = clientNumbers(subscribers)

  function startEdit(id: string) {
    setEditingId(id)
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function remove(subscriber: Subscriber) {
    if (!window.confirm(`Удалить ${subscriber.name}?`)) return
    setError(null)
    setPendingId(subscriber.id)
    startTransition(async () => {
      const result = await deleteSubscriber(subscriber.id)
      setPendingId(null)
      if (!result.ok) {
        setError(result.error)
        return
      }
      if (editingId === subscriber.id) setEditingId(null)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div ref={formRef}>
        <SubscriberForm
          key={editing?.id ?? "new"}
          subscriber={editing}
          onCancel={() => setEditingId(null)}
          onSaved={() => setEditingId(null)}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Клиенты</CardTitle>
          <CardDescription>
            {clients.count > 0
              ? subscriptionCount(clients.count)
              : "Пока никого нет."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {error ? <p className="px-4 pb-3 text-sm text-destructive">{error}</p> : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 pl-4 text-right">№</TableHead>
                <TableHead>Имя</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Почта</TableHead>
                <TableHead>Адрес</TableHead>
                <TableHead>Товары</TableHead>
                <TableHead>Артикул</TableHead>
                <TableHead>Пекарня</TableHead>
                <TableHead>Даты</TableHead>
                <TableHead>Доставка</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={12}
                    className="h-24 text-center text-muted-foreground"
                  >
                    Добавьте первого клиента формой выше.
                  </TableCell>
                </TableRow>
              ) : (
                subscribers.map((subscriber) => (
                  <TableRow
                    key={subscriber.id}
                    data-state={subscriber.id === editingId ? "selected" : undefined}
                  >
                    <TableCell className="pl-4 text-right tabular-nums text-muted-foreground">
                      {clients.byId.get(subscriber.id)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {subscriber.name}
                      {subscriber.segment === "b2b" ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">B2B</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{subscriber.phone || "—"}</TableCell>
                    <TableCell className="max-w-52 whitespace-normal">{subscriber.email || "—"}</TableCell>
                    <TableCell className="max-w-64 whitespace-normal">
                      {subscriber.address}
                    </TableCell>
                    <ProductCells products={subscriber.products} />
                    <TableCell
                      className="max-w-44 whitespace-normal text-xs"
                      title={subscriber.deliveryDates.map((date) => formatDeliveryDay(date)).join(", ")}
                    >
                      {formatDeliverySchedule(subscriber.deliveryDates)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {subscriber.deliveryPrice == null
                        ? "—"
                        : new Intl.NumberFormat("de-DE", {
                            style: "currency",
                            currency: "EUR",
                          }).format(subscriber.deliveryPrice)}
                    </TableCell>
                    <TableCell className="max-w-56 whitespace-pre-wrap text-muted-foreground">
                      {subscriber.comment || "—"}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(subscriber.id)}
                        >
                          Изменить
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={pendingId === subscriber.id}
                          onClick={() => remove(subscriber)}
                        >
                          {pendingId === subscriber.id ? "Удаляю…" : "Удалить"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
