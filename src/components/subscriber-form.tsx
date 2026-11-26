"use client"

import { useState, useTransition } from "react"
import { Loader2, Plus, X } from "lucide-react"

import { createSubscriber, updateSubscriber } from "@/app/(dashboard)/subscriptions/actions"
import { DeliveryDatesPicker } from "@/components/delivery-dates-picker"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { splitProductArticle } from "@/lib/product-article"
import type { Subscriber } from "@/lib/subscriber-types"

type ProductRow = {
  key: string
  name: string
  quantity: string
  article: string
}

function parseDeliveryPrice(value: string) {
  const trimmed = value.trim().replace(",", ".")
  if (!trimmed) return null
  const price = Number(trimmed)
  if (!Number.isFinite(price) || price < 0) return null
  return price
}

function productRow(key: string, name = "", quantity = "1", article = ""): ProductRow {
  return { key, name, quantity, article }
}

function rowsFromSubscriber(subscriber: Subscriber | null) {
  if (!subscriber || subscriber.products.length === 0) return [productRow("product-1")]
  return subscriber.products.map((product, index) => {
    const split = product.article
      ? { name: product.name, article: product.article }
      : splitProductArticle(product.name)
    return productRow(
      `product-${index + 1}`,
      split.name || product.name,
      String(product.quantity),
      split.article,
    )
  })
}

export function SubscriberForm({
  subscriber,
  onCancel,
  onSaved,
}: {
  subscriber: Subscriber | null
  onCancel: () => void
  onSaved: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(subscriber?.name ?? "")
  const [phone, setPhone] = useState(subscriber?.phone ?? "")
  const [email, setEmail] = useState(subscriber?.email ?? "")
  const [address, setAddress] = useState(subscriber?.address ?? "")
  const [comment, setComment] = useState(subscriber?.comment ?? "")
  const [products, setProducts] = useState<ProductRow[]>(() => rowsFromSubscriber(subscriber))
  const [deliveryDates, setDeliveryDates] = useState<string[]>(subscriber?.deliveryDates ?? [])
  const [deliveryPrice, setDeliveryPrice] = useState(
    subscriber?.deliveryPrice == null ? "" : String(subscriber.deliveryPrice).replace(".", ","),
  )

  function updateProduct(key: string, patch: Partial<ProductRow>) {
    setProducts((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const input = {
      name,
      phone,
      email,
      address,
      comment,
      products: products.map((product) => ({
        name: product.name,
        quantity: Number(product.quantity),
        article: product.article,
      })),
      deliveryDates,
      deliveryPrice: parseDeliveryPrice(deliveryPrice),
    }
    startTransition(async () => {
      const result = subscriber
        ? await updateSubscriber(subscriber.id, input)
        : await createSubscriber(input)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onSaved()
      if (!subscriber) {
        setName("")
        setPhone("")
        setEmail("")
        setAddress("")
        setComment("")
        setProducts([productRow("product-1")])
        setDeliveryDates([])
        setDeliveryPrice("")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{subscriber ? "Редактирование" : "Новый клиент"}</CardTitle>
        <CardDescription>
          {subscriber
            ? subscriber.name
            : "Имя, адрес, товары и дни, когда их нужно привезти."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor="subscriber-name">Имя</Label>
            <Input
              id="subscriber-name"
              name="name"
              value={name}
              required
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="subscriber-phone">Телефон</Label>
            <Input
              id="subscriber-phone"
              name="phone"
              value={phone}
              autoComplete="tel"
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="subscriber-email">Почта</Label>
            <Input
              id="subscriber-email"
              name="email"
              type="email"
              value={email}
              autoComplete="email"
              placeholder="name@example.de"
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="subscriber-address">Адрес</Label>
            <Input
              id="subscriber-address"
              name="address"
              value={address}
              required
              autoComplete="street-address"
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="subscriber-delivery-price">Цена доставки</Label>
            <Input
              id="subscriber-delivery-price"
              name="deliveryPrice"
              value={deliveryPrice}
              inputMode="decimal"
              placeholder="0,50"
              onChange={(event) => setDeliveryPrice(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="subscriber-comment">Комментарий</Label>
            <textarea
              id="subscriber-comment"
              name="comment"
              value={comment}
              rows={3}
              onChange={(event) => setComment(event.target.value)}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Товары</Label>
            <div className="grid gap-2">
              {products.map((product, index) => (
                <div key={product.key} className="flex items-center gap-2">
                  <Input
                    aria-label={`Товар ${index + 1}`}
                    value={product.name}
                    placeholder="Название"
                    onChange={(event) =>
                      updateProduct(product.key, { name: event.target.value })
                    }
                  />
                  <Input
                    aria-label={`Артикул, товар ${index + 1}`}
                    className="w-24"
                    value={product.article}
                    placeholder="M20"
                    onChange={(event) =>
                      updateProduct(product.key, { article: event.target.value })
                    }
                  />
                  <Input
                    aria-label={`Количество, товар ${index + 1}`}
                    className="w-20"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    type="number"
                    value={product.quantity}
                    onChange={(event) =>
                      updateProduct(product.key, { quantity: event.target.value })
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Удалить товар ${index + 1}`}
                    onClick={() =>
                      setProducts((rows) => rows.filter((row) => row.key !== product.key))
                    }
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setProducts((rows) => [...rows, productRow(crypto.randomUUID())])
                }
              >
                <Plus />
                Добавить товар
              </Button>
            </div>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Даты доставки</Label>
            <DeliveryDatesPicker value={deliveryDates} onChange={setDeliveryDates} />
          </div>
          {error ? (
            <p className="text-sm text-destructive sm:col-span-2">{error}</p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {subscriber ? "Сохранить" : "Добавить клиента"}
            </Button>
            {subscriber ? (
              <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
                Отмена
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
