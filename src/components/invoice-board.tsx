"use client"

import { useState, useTransition, type FormEvent } from "react"
import { Folder } from "lucide-react"

import { createInvoice, deleteInvoice, prepareInvoiceDraft, sendMonthlyInvoices } from "@/app/(dashboard)/invoices/actions"
import { InvoiceDocument } from "@/components/invoice-document"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  formatEuro,
  invoiceTotals,
  lineFromGross,
  parseGross,
  type Invoice,
  type InvoiceDraft,
} from "@/lib/invoice-math"
import { cn } from "cn"

export function InvoiceBoard({
  invoices,
  clients,
  defaultFrom,
  defaultTo,
  currentYear,
  currentMonth,
  mailing,
}: {
  invoices: Invoice[]
  clients: Array<{ key: string; number: number; name: string }>
  defaultFrom: string
  defaultTo: string
  currentYear: number
  currentMonth: number
  mailing: {
    year: number
    month: number
    label: string
    scheduled: boolean
    items: Array<{
      id: string
      number: string
      customerName: string
      email: string
      sentAt: string | null
    }>
  }
}) {
  const [clientKey, setClientKey] = useState(clients[0]?.key ?? "")
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [draft, setDraft] = useState<InvoiceDraft | null>(null)
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState("")
  const [extra, setExtra] = useState<Invoice[]>([])
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [error, setError] = useState("")
  const [newestFirst, setNewestFirst] = useState(true)
  const [pending, startTransition] = useTransition()

  const known = new Set(invoices.map((invoice) => invoice.id))
  const saved = [...invoices, ...extra.filter((invoice) => !known.has(invoice.id))].filter(
    (invoice) => !removed.has(invoice.id),
  )
  const preview = draft ? draftInvoice(draft, prices) : null
  const shown =
    selected === "draft" && preview
      ? preview
      : saved.find((invoice) => invoice.id === selected) ?? null
  const missingPrice = draft
    ? draft.lines.filter((line) => parseGross(prices[line.key] ?? "") == null).length
    : 0

  function assemble(event: FormEvent) {
    event.preventDefault()
    setError("")
    startTransition(async () => {
      const result = await prepareInvoiceDraft({ clientKey, from, to })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDraft(result.draft)
      setPrices(Object.fromEntries(result.draft.lines.map((line) => [line.key, line.gross])))
      setSelected("draft")
    })
  }

  function save() {
    if (!draft) return
    setError("")
    startTransition(async () => {
      const result = await createInvoice({
        clientKey: draft.clientKey,
        from: draft.from,
        to: draft.to,
        prices,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setExtra((current) => [result.invoice, ...current])
      setDraft(null)
      setSelected(result.invoice.id)
    })
  }

  function remove(id: string) {
    if (!window.confirm("Удалить этот счёт?")) return
    setError("")
    startTransition(async () => {
      const result = await deleteInvoice(id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setRemoved((current) => new Set(current).add(id))
      setExtra((current) => current.filter((invoice) => invoice.id !== id))
      setSelected("")
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #rechnung, #rechnung * { visibility: visible; }
          #rechnung {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            max-width: none;
            box-shadow: none;
          }
        }
      `}</style>
      <form onSubmit={assemble} className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex min-w-56 flex-1 flex-col gap-1 text-sm">
          <Label htmlFor="invoice-client">Клиент</Label>
          <select
            id="invoice-client"
            value={clientKey}
            onChange={(event) => setClientKey(event.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            {clients.map((client) => (
              <option key={client.key} value={client.key}>
                {client.number}. {client.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <Label htmlFor="invoice-from">С</Label>
          <Input id="invoice-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <Label htmlFor="invoice-to">По</Label>
          <Input id="invoice-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <Button type="submit" disabled={pending || !clientKey}>
          Собрать
        </Button>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          Печать
        </Button>
      </form>
      {error ? <p className="text-sm text-destructive print:hidden">{error}</p> : null}
      <InvoiceMailing mailing={mailing} />

      <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 print:hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium">Папка счетов</div>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setNewestFirst((current) => !current)}
            >
              {newestFirst ? "Новые годы сверху" : "Старые годы сверху"}
            </Button>
          </div>
          {draft ? (
            <InvoicePick
              active={selected === "draft"}
              number="Черновик"
              customer={draft.customerName}
              detail={draft.periodLabel}
              onClick={() => setSelected("draft")}
            />
          ) : null}
          <InvoiceFolder
            years={invoiceYears(saved, currentYear, currentMonth, newestFirst)}
            activeId={shown?.id ?? ""}
            onSelect={setSelected}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {selected === "draft" && draft ? (
            <div className="flex flex-col gap-3 print:hidden">
              {draft.warnings.map((warning) => (
                <p key={warning} className="text-sm text-muted-foreground">
                  {warning}
                </p>
              ))}
              <div className="grid grid-cols-[minmax(0,1fr)_4rem_7rem] gap-2 text-xs text-muted-foreground">
                <span>Позиция</span>
                <span className="text-right">Кол-во</span>
                <span className="text-right">Цена</span>
              </div>
              {draft.lines.map((line) => (
                <div key={line.key} className="grid grid-cols-[minmax(0,1fr)_4rem_7rem] items-center gap-2">
                  <div className="min-w-0">
                    <div className="text-sm">{line.name}</div>
                    {line.note ? <div className="text-xs text-muted-foreground">{line.note}</div> : null}
                  </div>
                  <div className="text-right text-sm tabular-nums">{line.quantity}</div>
                  <Input
                    value={prices[line.key] ?? ""}
                    inputMode="decimal"
                    aria-label={`Цена ${line.name}`}
                    onChange={(event) =>
                      setPrices((current) => ({ ...current, [line.key]: event.target.value }))
                    }
                  />
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" disabled={pending || missingPrice > 0} onClick={save}>
                  Сохранить счёт
                </Button>
                <p className="text-xs text-muted-foreground">
                  Цена как на сайте. В счёте она такая же.
                </p>
              </div>
            </div>
          ) : null}
          {shown ? (
            <div className="overflow-x-auto">
              <InvoiceDocument invoice={shown} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Соберите счёт: выберите клиента и период.
            </p>
          )}
          {shown && shown.source === "subscription" && shown.id !== "draft" ? (
            <div className="print:hidden">
              <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => remove(shown.id)}>
                Удалить
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
]

function InvoiceMailing({
  mailing,
}: {
  mailing: {
    year: number
    month: number
    label: string
    scheduled: boolean
    items: Array<{
      id: string
      number: string
      customerName: string
      email: string
      sentAt: string | null
    }>
  }
}) {
  const [pending, startTransition] = useTransition()
  const [notice, setNotice] = useState("")
  const ready = mailing.items.filter((item) => item.email && !item.sentAt).length
  const missing = mailing.items.filter((item) => !item.email).length

  function send() {
    setNotice("")
    startTransition(async () => {
      const result = await sendMonthlyInvoices(mailing.year, mailing.month)
      if (!result.ok) {
        setNotice(result.error)
        return
      }
      const skipped = result.skipped ? ` Без почты: ${result.skipped}.` : ""
      setNotice(`Отправлено писем: ${result.sent}.${skipped}`)
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">
            {mailing.scheduled ? `Рассылка: ${mailing.label}` : `Счета за ${mailing.label}`}
          </div>
          <p className="text-xs text-muted-foreground">
            {mailing.scheduled
              ? "Сегодня день рассылки. Уходят все сохранённые счета этого месяца."
              : "1-го числа уходят счета за прошлый месяц. Отправить можно и раньше."}
          </p>
        </div>
        <Button type="button" disabled={pending || ready === 0} onClick={send}>
          Отправить счета
        </Button>
      </div>
      {mailing.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">За этот месяц ещё нет сохранённых счетов.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {mailing.items.map((item) => (
            <li key={item.id} className="flex flex-wrap gap-x-3">
              <span className="font-medium">{item.number}</span>
              <span>{item.customerName}</span>
              <span className="text-muted-foreground">
                {item.sentAt ? "отправлен" : item.email || "нет почты"}
              </span>
            </li>
          ))}
        </ul>
      )}
      {missing > 0 ? (
        <p className="text-xs text-muted-foreground">Без почты на карточке счёт не отправляется.</p>
      ) : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
    </section>
  )
}

function invoiceYears(
  invoices: Invoice[],
  currentYear: number,
  currentMonth: number,
  newestFirst: boolean,
) {
  const buckets = new Map<string, Invoice[]>()
  const add = (year: number, month: number, invoice?: Invoice) => {
    const key = `${year}-${month}`
    const items = buckets.get(key) ?? []
    if (invoice) items.push(invoice)
    buckets.set(key, items)
  }
  add(currentYear, currentMonth)
  for (const invoice of invoices) {
    const date = invoice.issuedOn || invoice.periodFrom
    const [yearText, monthText] = date.split("-")
    const year = Number(yearText)
    const month = Number(monthText)
    if (!year || month < 1 || month > 12) continue
    add(year, month, invoice)
  }
  const years = new Map<number, Array<{ month: number; label: string; invoices: Invoice[] }>>()
  for (const [key, items] of buckets) {
    const [yearText, monthText] = key.split("-")
    const year = Number(yearText)
    const month = Number(monthText)
    const months = years.get(year) ?? []
    months.push({
      month,
      label: MONTHS[month - 1] ?? String(month),
      invoices: [...items].sort((left, right) => right.number.localeCompare(left.number)),
    })
    years.set(year, months)
  }
  const direction = newestFirst ? -1 : 1
  return [...years.entries()]
    .sort((left, right) => (left[0] - right[0]) * direction)
    .map(([year, months]) => ({
      year,
      months: months.sort((left, right) => (left.month - right.month) * direction),
    }))
}

function InvoiceFolder({
  years,
  activeId,
  onSelect,
}: {
  years: ReturnType<typeof invoiceYears>
  activeId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {years.map((year) => (
        <div key={year.year} className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1 text-sm font-medium">
            <Folder className="size-4 text-muted-foreground" />
            <span>{year.year}</span>
          </div>
          {year.months.map((month) => (
            <div key={`${year.year}-${month.month}`} className="overflow-hidden rounded-xl border bg-card">
              <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
                <Folder className="size-4 text-muted-foreground" />
                <span>{month.label}</span>
                <span className="text-xs text-muted-foreground">{month.invoices.length}</span>
              </div>
              {month.invoices.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted-foreground">Счетов за этот месяц пока нет.</p>
              ) : (
                <div className="flex flex-col p-1">
                  {month.invoices.map((invoice) => (
                    <InvoicePick
                      key={invoice.id}
                      active={activeId === invoice.id}
                      number={invoice.number}
                      customer={invoice.customerName}
                      detail={`${invoice.periodLabel} · ${formatEuro(invoiceTotals(invoice.lines).total)}`}
                      onClick={() => onSelect(invoice.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function InvoicePick({
  active,
  number,
  customer,
  detail,
  onClick,
}: {
  active: boolean
  number: string
  customer: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-3 py-2 text-left",
        active ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted",
      )}
    >
      <div className="text-sm font-medium">{number}</div>
      <div className="truncate text-xs text-muted-foreground">{customer}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </button>
  )
}

function draftInvoice(draft: InvoiceDraft, prices: Record<string, string>): Invoice {
  return {
    id: "draft",
    number: "—",
    issuedOn: draft.issuedOn,
    dueOn: draft.dueOn,
    periodFrom: draft.periodFrom,
    periodTo: draft.periodTo,
    periodLabel: draft.periodLabel,
    customerName: draft.customerName,
    customerLines: draft.customerLines,
    lines: draft.lines.map((line) => {
      const gross = parseGross(prices[line.key] ?? "")
      if (gross == null) {
        return { name: line.name, quantity: line.quantity, unitNet: null, tax: null, amount: null }
      }
      return lineFromGross(line.name, line.quantity, gross)
    }),
    comment: "",
    source: "subscription",
    taxMode: "included",
  }
}
