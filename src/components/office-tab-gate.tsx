"use client"

import { useEffect, useState } from "react"

import { logoutOffice } from "@/app/office/actions"
import { officeTabStillOpen, releaseOfficeTab } from "@/lib/office-tab"

export function OfficeTabGate({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!officeTabStillOpen()) {
      void logoutOffice()
      return
    }
    setOpen(true)
    const timer = window.setInterval(() => {
      officeTabStillOpen()
    }, 1_000)
    const onHide = () => releaseOfficeTab()
    window.addEventListener("pagehide", onHide)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("pagehide", onHide)
    }
  }, [])

  if (!open) return <p className="p-6 text-muted-foreground">Проверяем вход…</p>
  return children
}
