"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

const REFRESH_MS = 60_000

export function LiveOrderSync() {
  const router = useRouter()

  useEffect(() => {
    const timer = window.setInterval(() => {
      router.refresh()
    }, REFRESH_MS)

    return () => window.clearInterval(timer)
  }, [router])

  return null
}
