"use client"

import { useEffect } from "react"

export function ReleaseSiteWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return
    void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
      let removed = false
      for (const registration of registrations) {
        if (new URL(registration.scope).pathname !== "/") continue
        await registration.unregister()
        removed = true
      }
      if (!removed || !navigator.serviceWorker.controller) return
      if (sessionStorage.getItem("site-worker-released")) return
      sessionStorage.setItem("site-worker-released", "1")
      window.location.reload()
    })
  }, [])
  return null
}
