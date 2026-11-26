"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"

import { importShopifyOrders } from "@/app/(dashboard)/dashboard/actions"
import { Button } from "@/components/ui/button"

export function ImportOrdersButton() {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null)
          setMessage(null)
          startTransition(async () => {
            const result = await importShopifyOrders()

            if (!result.ok) {
              setError(result.error)
              return
            }

            if (result.slack === "failed") {
              setError(
                result.slackError ?? "Не удалось отправить сообщение в Slack",
              )
            }

            setMessage(
              result.imported === 0
                ? "Новых заказов нет"
                : `Синхронизировано заказов: ${result.imported}. Уже были: ${result.skipped}.${result.slack === "sent" ? " Сообщение отправлено в Slack." : ""}`,
            )
          })
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : null}
        Синхронизировать заказы
      </Button>
      {error ? <p className="max-w-sm text-sm text-destructive">{error}</p> : null}
      {message ? (
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  )
}
