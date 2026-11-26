import type { Metadata } from "next"
import { Suspense } from "react"

import { SubscriberBoard } from "@/components/subscriber-board"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { listSubscribers } from "@/lib/subscribers"

export const metadata: Metadata = {
  title: "Абонементы",
}

export default function SubscriptionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Абонементы</h1>
        <p className="text-sm text-muted-foreground">
          Клиенты с постоянной доставкой. Карточку можно изменить в списке.
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

  return <SubscriberBoard subscribers={subscribers} />
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
