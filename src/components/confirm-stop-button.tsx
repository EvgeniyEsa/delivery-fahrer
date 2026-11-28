"use client"

import { useEffect, useState } from "react"

import { saveStopDelivered } from "@/app/driver/actions"
import { buttonVariants } from "@/components/ui/button"
import { formatDriverTime } from "@/lib/delivery-date"
import { forgetDelivery, readDeliveries, rememberDelivery } from "@/lib/tour-device"
import { cn } from "cn"

export function ConfirmStopButton({
  stopId,
  shopify,
  day,
  label,
}: {
  stopId: string
  shopify: boolean
  day: string
  label: string
}) {
  const [localAt, setLocalAt] = useState<string | null>(null)

  useEffect(() => {
    setLocalAt(readDeliveries(day)[stopId]?.at ?? null)
  }, [day, stopId])

  if (localAt) {
    return <p className="text-sm">Gespeichert auf dem Telefon {formatDriverTime(localAt)}.</p>
  }

  return (
    <button
      type="button"
      className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}
      onClick={(event) => {
        const at = new Date().toISOString()
        rememberDelivery(day, stopId, { at, shopify })
        setLocalAt(at)
        const details = event.currentTarget.closest("details")
        if (details instanceof HTMLDetailsElement) {
          paintLocalDelivery(details, at)
          details.open = false
          const next = details.closest("li")?.nextElementSibling?.querySelector("details")
          if (next instanceof HTMLDetailsElement) {
            next.open = true
            next.scrollIntoView({ block: "nearest" })
          }
        }
        window.dispatchEvent(new Event("tour-queue"))
        void saveStopDelivered(stopId, shopify)
          .then((result) => {
            if (result.ok) forgetDelivery(day, stopId)
          })
          .catch(() => {})
          .finally(() => window.dispatchEvent(new Event("tour-queue")))
      }}
    >
      {label}
    </button>
  )
}

export function paintLocalDelivery(details: HTMLDetailsElement, at: string) {
  details.classList.add("opacity-60")
  details.dataset.localDelivered = "true"
  const summary = details.querySelector("summary")
  if (!summary || summary.querySelector("[data-local-time]")) return
  const stamp = document.createElement("span")
  stamp.dataset.localTime = "true"
  stamp.className = "max-w-40 shrink-0 text-right text-xs text-muted-foreground"
  stamp.textContent = formatDriverTime(at)
  const chevron = summary.querySelector("svg")
  if (chevron) summary.insertBefore(stamp, chevron)
  else summary.append(stamp)
}
