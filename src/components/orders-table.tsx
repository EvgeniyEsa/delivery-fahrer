"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

import { changeDeliveryDate } from "@/app/(dashboard)/orders/actions"
import { DeliveryDatePicker } from "@/components/delivery-date-picker"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDeliveredAt } from "@/lib/delivery-date"
import type { Order, OrderStatus } from "@/lib/mock-orders"

const statusLabels: Record<
  OrderStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  pending: { label: "Ожидает", variant: "outline" },
  in_transit: { label: "В пути", variant: "default" },
  delivered: { label: "Доставлен", variant: "secondary" },
}

export function OrdersTable({ orders }: { orders: Order[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [dates, setDates] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function saveDate(order: Order, deliveryDate: string) {
    if (!order.shopifyOrderId || !deliveryDate) return
    setDates((current) => ({ ...current, [order.id]: deliveryDate }))
    setError(null)
    setPendingId(order.id)
    startTransition(async () => {
      const result = await changeDeliveryDate(order.id, deliveryDate)
      setPendingId(null)
      if (!result.ok) {
        setDates((current) => {
          const next = { ...current }
          delete next[order.id]
          return next
        })
        setError(result.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="px-4 text-sm text-destructive">{error}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Заказ</TableHead>
            <TableHead>Имя</TableHead>
            <TableHead>Адрес</TableHead>
            <TableHead>Комментарий</TableHead>
            <TableHead>Дата</TableHead>
            <TableHead className="pr-4">Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="h-24 text-center text-muted-foreground"
              >
                Заказов нет
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => {
              const status = statusLabels[order.status]
              const date = dates[order.id] ?? order.deliveryDate ?? ""

              return (
                <TableRow key={order.id}>
                  <TableCell className="pl-4 font-medium">{order.number}</TableCell>
                  <TableCell>
                    <span className="block">{order.customer}</span>
                    {order.phone ? (
                      <span className="text-xs text-muted-foreground">
                        {order.phone}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal">
                    {order.address}
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-pre-wrap text-muted-foreground">
                    {order.comment || "—"}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <DeliveryDatePicker
                        value={date}
                        orderNumber={order.number}
                        disabled={!order.shopifyOrderId || pendingId === order.id}
                        onSelect={(deliveryDate) => saveDate(order, deliveryDate)}
                      />
                      {pendingId === order.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell className="pr-4">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {order.deliveredAt ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {formatDeliveredAt(order.deliveredAt)}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
