"use client"

import { useRef, useState, useTransition } from "react"
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react"

import {
  createPartner,
  reorderPartners,
  updatePartner,
} from "@/app/(dashboard)/bakery/actions"
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
import type { Partner } from "@/lib/partner-types"

export function PartnerBoard({ partners }: { partners: Partner[] }) {
  const formRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const signature = partners.map((partner) => `${partner.id}:${partner.position}`).join()
  const [order, setOrder] = useState<string[] | null>(null)
  const [seen, setSeen] = useState(signature)
  if (seen !== signature) {
    setSeen(signature)
    setOrder(null)
  }

  const shown = (order ?? partners.map((partner) => partner.id)).flatMap((id) => {
    const partner = partners.find((item) => item.id === id)
    return partner ? [partner] : []
  })
  const editing = shown.find((partner) => partner.id === editingId) ?? null

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= shown.length) return
    const next = [...shown]
    const current = next[index]
    const swap = next[target]
    if (!current || !swap) return
    next[index] = swap
    next[target] = current
    const ids = next.map((partner) => partner.id)
    setOrder(ids)
    void reorderPartners(ids)
  }

  return (
    <div className="flex flex-col gap-6">
      <div ref={formRef}>
        <PartnerForm
          key={editing?.id ?? "new"}
          partner={editing}
          onCancel={() => setEditingId(null)}
          onSaved={() => setEditingId(null)}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Очередность заезда</CardTitle>
          <CardDescription>
            {shown.length > 0
              ? "Заезд каждый день. Сейчас порядок ручной: первый в списке — первый заезд."
              : "Пока никого нет."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Добавьте первого партнёра формой выше.
            </p>
          ) : (
            shown.map((partner, index) => (
              <div
                key={partner.id}
                className="flex items-start gap-3 rounded-lg border px-3 py-3"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground text-sm font-medium text-background">
                  {index + 1}
                </span>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="font-medium">{partner.name}</span>
                  {partner.phone ? (
                    <span className="text-sm text-muted-foreground">{partner.phone}</span>
                  ) : null}
                  <span className="text-sm text-muted-foreground">{partner.address}</span>
                  {partner.comment ? (
                    <span className="text-xs text-muted-foreground">{partner.comment}</span>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Раньше: ${partner.name}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ChevronUp />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`Позже: ${partner.name}`}
                    disabled={index === shown.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ChevronDown />
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingId(partner.id)
                    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }}
                >
                  Изменить
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PartnerForm({
  partner,
  onCancel,
  onSaved,
}: {
  partner: Partner | null
  onCancel: () => void
  onSaved: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(partner?.name ?? "")
  const [phone, setPhone] = useState(partner?.phone ?? "")
  const [address, setAddress] = useState(partner?.address ?? "")
  const [comment, setComment] = useState(partner?.comment ?? "")

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const input = {
      name,
      phone,
      address,
      comment,
    }
    startTransition(async () => {
      const result = partner
        ? await updatePartner(partner.id, input)
        : await createPartner(input)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onSaved()
      if (!partner) {
        setName("")
        setPhone("")
        setAddress("")
        setComment("")
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{partner ? "Редактирование" : "Новый партнёр"}</CardTitle>
        <CardDescription>
          {partner
            ? partner.name
            : "Имя, телефон, адрес и заметка для водителя. Заезд каждый день."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor="partner-name">Имя</Label>
            <Input
              id="partner-name"
              value={name}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="partner-phone">Телефон</Label>
            <Input
              id="partner-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="partner-address">Адрес</Label>
            <Input
              id="partner-address"
              value={address}
              required
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="partner-comment">Комментарий</Label>
            <textarea
              id="partner-comment"
              value={comment}
              rows={3}
              onChange={(event) => setComment(event.target.value)}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          {error ? <p className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {partner ? "Сохранить" : "Добавить партнёра"}
            </Button>
            {partner ? (
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
