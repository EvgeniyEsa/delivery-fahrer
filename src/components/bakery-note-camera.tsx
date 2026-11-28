"use client"

import { Camera } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { saveBakeryNote, saveStopDelivered } from "@/app/driver/actions"
import { StartPackingButton, openFollowingBakery, useBakeryPickupReady } from "@/components/collected-goods"
import { paintLocalDelivery } from "@/components/confirm-stop-button"
import { formatDriverTime } from "@/lib/delivery-date"
import { buttonVariants } from "@/components/ui/button"
import type { BakeryNote } from "@/lib/bakery-notes"
import type { DriverBakery } from "@/lib/product-photos"
import {
  forgetDelivery,
  forgetPhoto,
  listLocalPhotos,
  readDeliveries,
  rememberDelivery,
  rememberPhoto,
} from "@/lib/tour-device"
import { cn } from "cn"

type ShownNote = BakeryNote & { localId?: string }

export function BakeryNoteCamera({
  day,
  bakery,
  notes,
  invoice,
  map,
  pickup,
}: {
  day: string
  bakery: DriverBakery
  notes: BakeryNote[]
  invoice: ReactNode
  map: ReactNode
  pickup: { stopId: string; shopify: boolean } | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [remind, setRemind] = useState(false)
  const [extra, setExtra] = useState<ShownNote[]>([])
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [localAt, setLocalAt] = useState<string | null>(null)
  const photos: ShownNote[] = [...notes, ...extra]
  const pickupReady = useBakeryPickupReady(bakery)
  const canFinish = pickup != null && pickupReady.ready

  useEffect(() => {
    if (!remind) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setRemind(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [remind])

  useEffect(() => {
    if (!pickup) return
    setLocalAt(readDeliveries(day)[pickup.stopId]?.at ?? null)
  }, [day, pickup])

  useEffect(() => {
    let cancel = false
    const urls: string[] = []
    listLocalPhotos(day)
      .then((rows) => {
        if (cancel) return
        const added = rows.flatMap((row) => {
          if (row.bakery !== bakery) return []
          const src = URL.createObjectURL(row.blob)
          urls.push(src)
          return [{ bakery, day, takenAt: row.createdAt, label: "", src, localId: row.id }]
        })
        if (added.length === 0) return
        setExtra((current) => {
          const known = new Set(current.map((note) => note.localId))
          return [...current, ...added.filter((note) => !known.has(note.localId))]
        })
      })
      .catch(() => {})
    return () => {
      cancel = true
      for (const url of urls) URL.revokeObjectURL(url)
    }
  }, [bakery, day])

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setError("")
    setPending(true)
    let stored = false
    try {
      const blob = await compressPhoto(file)
      const id = crypto.randomUUID()
      const createdAt = new Date().toISOString()
      const src = URL.createObjectURL(blob)
      setExtra((current) => [...current, { bakery, day, takenAt: createdAt, label: "", src, localId: id }])
      try {
        await rememberPhoto({ id, day, bakery, createdAt, blob })
        stored = true
      } catch {
        stored = false
      }
      const body = new FormData()
      body.set("day", day)
      body.set("bakery", bakery)
      body.set("photo", new File([blob], "note.jpg", { type: "image/jpeg" }))
      const result = await saveBakeryNote(body)
      if (!result.ok) {
        if (!stored) setError("Foto konnte nicht gespeichert werden")
        return
      }
      if (stored) await forgetPhoto(id).catch(() => {})
      setExtra((current) => current.map((note) => (note.localId === id ? result.note : note)))
    } catch {
      if (!stored) setError("Foto konnte nicht gespeichert werden")
    } finally {
      setPending(false)
      window.dispatchEvent(new Event("tour-queue"))
    }
  }

  return (
    <>
      <div className="mt-3">
        <p className="text-sm font-semibold">Lieferschein</p>
        {invoice}
        {photos.length > 0 ? (
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {photos.map((note) => (
              <a
                key={note.localId ?? note.src}
                href={note.src}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-24 shrink-0"
              >
                <img
                  src={note.src}
                  alt={`Lieferschein ${formatDriverTime(note.takenAt)}`}
                  className="h-24 w-24 rounded-md object-cover ring-1 ring-black/10"
                />
                <span className="mt-1 block text-xs leading-tight">{formatDriverTime(note.takenAt)}</span>
              </a>
            ))}
          </div>
        ) : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />
      <div className="mt-3 flex flex-col gap-2">
        <StartPackingButton bakery={bakery} />
        {map}
        {localAt ? (
          <p className="text-sm">Gespeichert auf dem Telefon {formatDriverTime(localAt)}.</p>
        ) : pickup && !canFinish ? (
          <p className="text-sm">
            {`Zuerst bei den Kunden „Ware abgeholt“ markieren. Noch ${pickupReady.left}.`}
          </p>
        ) : null}
        <div className={cn("flex items-stretch gap-2", !pickup && "justify-end")}>
          {pickup && !localAt ? (
            <button
              type="button"
              className={cn(buttonVariants({ size: "lg" }), "h-12 min-w-0 flex-1 text-base")}
              disabled={!canFinish}
              onClick={() => setRemind(true)}
            >
              Alle Brötchen abgeholt
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Lieferschein fotografieren"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12 w-12 shrink-0 px-0")}
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className={cn("size-5", pending && "animate-pulse")} />
          </button>
        </div>
      </div>
      {remind ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bakery-note-reminder"
          onClick={() => setRemind(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-background p-4 text-foreground shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="bakery-note-reminder" className="text-xl font-semibold">
              Lieferschein fotografieren
            </h2>
            <p className="mt-2 text-base">
              {`Die Brötchen bei ${bakery} sind abgeholt. Mach ein Foto vom Lieferschein, solange du in der Bäckerei bist.`}
            </p>
            {photos.length > 0 ? <p className="mt-2 text-sm text-muted-foreground">Foto gespeichert.</p> : null}
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}
                disabled={pending}
                onClick={() => inputRef.current?.click()}
              >
                <Camera className={cn("size-5", pending && "animate-pulse")} />
                Fotografieren
              </button>
              {pickup ? (
                <button
                  type="button"
                  className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12 w-full text-base")}
                  onClick={(event) => {
                    const at = new Date().toISOString()
                    rememberDelivery(day, pickup.stopId, { at, shopify: pickup.shopify })
                    setLocalAt(at)
                    setRemind(false)
                    const details = event.currentTarget.closest("details")
                    if (details instanceof HTMLDetailsElement) {
                      paintLocalDelivery(details, at)
                      details.open = false
                      openFollowingBakery(details.dataset.pickup ?? bakery)
                    }
                    window.dispatchEvent(new Event("tour-queue"))
                    void saveStopDelivered(pickup.stopId, pickup.shopify)
                      .then((result) => {
                        if (result.ok) forgetDelivery(day, pickup.stopId)
                      })
                      .catch(() => {})
                      .finally(() => window.dispatchEvent(new Event("tour-queue")))
                  }}
                >
                  Fertig
                </button>
              ) : null}
              <button
                type="button"
                className="h-12 w-full text-base text-muted-foreground"
                onClick={() => setRemind(false)}
              >
                Zurück
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

async function compressPhoto(file: File) {
  const bitmap = await createImageBitmap(file)
  const longest = Math.max(bitmap.width, bitmap.height)
  const scale = Math.min(1, 1600 / longest)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d")
  if (!context) return file
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.72),
  )
  bitmap.close()
  return blob ?? file
}
