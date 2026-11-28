import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { ExceptionsBoard } from "@/components/exceptions-board"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { blockedOrderDays, closureRows } from "@/lib/bakery-closures"
import { todayInBerlin } from "@/lib/delivery-date"

export const metadata: Metadata = {
  title: "Исключения",
}

export default function ExceptionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Исключения</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Зелёная ячейка — пекарня работает. Красная — закрыта: клиентам с её товарами в этот день не везём.
          Отдельный день в календаре закрывает заказы целиком.
        </p>
      </div>
      <Suspense fallback={<BoardFallback />}>
        <ExceptionsBody />
      </Suspense>
    </div>
  )
}

async function ExceptionsBody() {
  await connection()
  return <ExceptionsBoard rows={closureRows()} blocked={blockedOrderDays()} today={todayInBerlin()} />
}

function BoardFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Исключения</CardTitle>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-40 w-full" />
      </CardContent>
    </Card>
  )
}
