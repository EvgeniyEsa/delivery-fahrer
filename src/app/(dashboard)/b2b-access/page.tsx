import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { B2bPasswordBoard } from "@/components/b2b-password-board"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { listB2bPortals } from "@/lib/b2b-portals"
import { listB2bPasswords } from "@/lib/b2b-passwords"
import { customerOrigin } from "@/lib/public-origin"
import { listSubscribers } from "@/lib/subscribers"

export const metadata: Metadata = {
  title: "Пароли B2B",
}

export default function B2bAccessPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Пароли B2B</h1>
        <p className="text-sm text-muted-foreground">
          Почта и пароль, с которыми клиент входит в заказ. Пока пароль не задан, секретная ссылка открывается как раньше.
        </p>
      </div>
      <Suspense fallback={<BoardFallback />}>
        <AccessBoard />
      </Suspense>
    </div>
  )
}

async function AccessBoard() {
  await connection()
  const [subscribers, passwords, portals] = await Promise.all([
    listSubscribers(),
    listB2bPasswords(),
    listB2bPortals(),
  ])
  const origin = await customerOrigin()
  const pathById = new Map(portals.map((portal) => [portal.subscriberId, `/order/${portal.token}`]))
  const clients = subscribers
    .filter((subscriber) => subscriber.segment === "b2b" && !subscriber.archivedAt)
    .map((subscriber) => ({
      id: subscriber.id,
      name: subscriber.name,
      address: subscriber.address,
      email: subscriber.email.trim().toLowerCase(),
    }))
  const emailCount = new Map<string, number>()
  for (const client of clients) {
    if (!client.email) continue
    emailCount.set(client.email, (emailCount.get(client.email) ?? 0) + 1)
  }
  const sharedEmail = new Set(
    [...emailCount].flatMap(([email, count]) => (count > 1 ? [email] : [])),
  )
  const rows = clients
    .map((client) => ({
      id: client.id,
      name: client.name,
      address: client.address,
      login: passwords[client.id]?.login || (sharedEmail.has(client.email) ? "" : client.email),
      password: passwords[client.id]?.password ?? "",
      hasPassword: Boolean(passwords[client.id]),
      href: `${origin}${pathById.get(client.id) ?? "/order/login"}`,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "ru"))

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Активных B2B-клиентов нет.</p>
  }

  return <B2bPasswordBoard clients={rows} />
}

function BoardFallback() {
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
