import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { InvoiceBoard } from "@/components/invoice-board"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { invoiceClients, listInvoices, mailingItems, mailingWindow, monthName } from "@/lib/invoices"
import { listSubscribers } from "@/lib/subscribers"

export const metadata: Metadata = {
  title: "Счета",
}

export default function InvoicesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Счета</h1>
        <p className="text-sm text-muted-foreground">
          Счёт для частного клиента. Номер ставится сам: в этом году с R26-1700,
          со следующего года серия начинается заново. Сохранённые счета лежат
          по месяцу выставления, внутри года. 1-го числа уходит рассылка за
          прошлый месяц. Цена как на сайте, налог отдельно не считается. Адрес
          берётся из абонемента.
        </p>
      </div>
      <Suspense fallback={<ListFallback />}>
        <InvoiceWorkspace />
      </Suspense>
    </div>
  )
}

async function InvoiceWorkspace() {
  await connection()
  let error = ""
  let invoices: Awaited<ReturnType<typeof listInvoices>> = []
  let clients: ReturnType<typeof invoiceClients> = []
  let subscribers: Awaited<ReturnType<typeof listSubscribers>> = []

  try {
    subscribers = await listSubscribers()
    invoices = await listInvoices()
    clients = invoiceClients(subscribers)
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Не удалось открыть счета"
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Счета</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  const range = berlinMonthRange()
  const window = mailingWindow(Number(range.year), Number(range.month), Number(range.day))
  return (
    <InvoiceBoard
      invoices={invoices}
      clients={clients}
      defaultFrom={range.from}
      defaultTo={range.to}
      currentYear={Number(range.year)}
      currentMonth={Number(range.month)}
      mailing={{
        year: window.year,
        month: window.month,
        label: `${monthName(window.month)} ${window.year}`,
        scheduled: window.scheduled,
        items: mailingItems(invoices, subscribers, window.year, window.month),
      }}
    />
  )
}

function berlinMonthRange(now = new Date()) {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
  const [year, month, day] = iso.split("-")
  const last = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(last).padStart(2, "0")}`,
    year,
    month,
    day,
  }
}

function ListFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Счета</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-40 w-full" />
      </CardContent>
    </Card>
  )
}
