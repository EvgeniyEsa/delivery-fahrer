import type { Metadata } from "next"
import { Suspense } from "react"

import { PartnerBoard } from "@/components/partner-board"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { listPartners } from "@/lib/partners"

export const metadata: Metadata = {
  title: "Пекарня",
}

export default function BakeryPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Пекарня</h1>
        <p className="text-sm text-muted-foreground">
          Имя, телефон и адрес. Заезд каждый день. Комментарий видит водитель.
        </p>
      </div>
      <Suspense fallback={<BoardFallback />}>
        <PartnerWorkspace />
      </Suspense>
    </div>
  )
}

async function PartnerWorkspace() {
  const partners = await listPartners()
  return <PartnerBoard partners={partners} />
}

function BoardFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Партнёры</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  )
}
