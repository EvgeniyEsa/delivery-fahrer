"use client"

import { useEffect, useState } from "react"

import { saveBakeryNote, saveStopDelivered } from "@/app/driver/actions"
import { paintLocalDelivery } from "@/components/confirm-stop-button"
import {
  forgetDelivery,
  forgetPhoto,
  listLocalPhotos,
  readDeliveries,
  type LocalPhoto,
} from "@/lib/tour-device"

export function TourSync({ day }: { day: string }) {
  const [offline, setOffline] = useState(false)
  const [waiting, setWaiting] = useState(0)

  useEffect(() => {
    let cancel = false
    const deliveries = readDeliveries(day)
    for (const [stopId, row] of Object.entries(deliveries)) {
      const card = document.querySelector(`details[data-stop-id="${CSS.escape(stopId)}"]`)
      if (card instanceof HTMLDetailsElement) paintLocalDelivery(card, row.at)
    }
    const open = document.querySelector("details[data-local-delivered='true'][open]")
    if (open instanceof HTMLDetailsElement) {
      open.open = false
      let sibling = open.closest("li")?.nextElementSibling
      while (sibling) {
        const card = sibling.querySelector("details")
        if (
          card instanceof HTMLDetailsElement &&
          card.dataset.localDelivered !== "true" &&
          !card.classList.contains("opacity-60")
        ) {
          card.open = true
          break
        }
        sibling = sibling.nextElementSibling
      }
    }

    async function flush() {
      const queued = readDeliveries(day)
      for (const [stopId, row] of Object.entries(queued)) {
        try {
          const result = await saveStopDelivered(stopId, row.shopify)
          if (result.ok) forgetDelivery(day, stopId)
        } catch {
          // The phone keeps the stop until the server accepts it.
        }
      }
      let photos: LocalPhoto[] = []
      try {
        photos = await listLocalPhotos(day)
      } catch {
        photos = []
      }
      for (const photo of photos) {
        try {
          const body = new FormData()
          body.set("day", photo.day)
          body.set("bakery", photo.bakery)
          body.set("photo", new File([photo.blob], "note.jpg", { type: "image/jpeg" }))
          const result = await saveBakeryNote(body)
          if (result.ok) await forgetPhoto(photo.id)
        } catch {
          // Keep the photo in IndexedDB.
        }
      }
      if (cancel) return
      const left = Object.keys(readDeliveries(day)).length
      let photoCount = 0
      try {
        photoCount = (await listLocalPhotos(day)).length
      } catch {
        photoCount = photos.length
      }
      setWaiting(left + photoCount)
    }

    function online() {
      setOffline(false)
      void flush()
    }
    function offline() {
      setOffline(true)
    }

    function queued() {
      void flush()
    }

    setOffline(typeof navigator !== "undefined" && !navigator.onLine)
    void flush()
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/driver/sw.js").catch(() => {})
    }
    window.addEventListener("online", online)
    window.addEventListener("offline", offline)
    window.addEventListener("tour-queue", queued)
    return () => {
      cancel = true
      window.removeEventListener("online", online)
      window.removeEventListener("offline", offline)
      window.removeEventListener("tour-queue", queued)
    }
  }, [day])

  if (!offline && waiting === 0) return null
  return (
    <p className="rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-950">
      {offline ? "Keine Verbindung. " : ""}
      Die Tour bleibt auf dem Telefon und wird gesendet, sobald die Verbindung da ist.
    </p>
  )
}
