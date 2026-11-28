"use client"

import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react"

import { buttonVariants } from "@/components/ui/button"
import type { DriverBakery } from "@/lib/product-photos"
import { readPicks, writePicks } from "@/lib/tour-device"
import { cn } from "cn"

type Pending = Record<DriverBakery, string[]>

const BAKERIES: DriverBakery[] = ["Heidbüchel", "Moss", "Kockartz"]

type Packed = Record<string, DriverBakery[]>

const CollectedGoodsContext = createContext<{
  isPacked: (stopId: string, bakery: DriverBakery) => boolean
  toggle: (stopId: string, bakeries: DriverBakery[]) => void
  ready: (bakery: DriverBakery) => boolean
  left: (bakery: DriverBakery) => number
  packing: DriverBakery | null
  begin: (bakery: DriverBakery) => void
  nextId: (bakery: DriverBakery, afterId?: string) => string | null
  isTaken: (stopId: string, itemKey: string) => boolean
  toggleItem: (stopId: string, itemKey: string) => void
} | null>(null)

export function CollectedGoods({
  day,
  pending,
  children,
}: {
  day: string
  pending: Pending
  children: ReactNode
}) {
  const [packed, setPacked] = useState<Packed | null>(null)
  const [packing, setPacking] = useState<DriverBakery | null>(null)
  const [taken, setTaken] = useState<Record<string, string[]>>({})
  const packingRef = useRef<DriverBakery | null>(null)

  useEffect(() => {
    const picks = readPicks(day)
    packingRef.current = picks.packing
    setPacking(picks.packing)
    setTaken(picks.taken)
    setPacked(readPacked(day))
  }, [day])

  function begin(bakery: DriverBakery) {
    packingRef.current = bakery
    setPacking(bakery)
    writePicks(day, { packing: bakery, taken: readPicks(day).taken })
  }

  function toggle(stopId: string, bakeries: DriverBakery[]) {
    setPacked((current) => {
      const base = current ?? readPacked(day)
      const have = new Set(base[stopId] ?? [])
      if (bakeries.every((bakery) => have.has(bakery))) {
        for (const bakery of bakeries) have.delete(bakery)
      } else {
        for (const bakery of bakeries) have.add(bakery)
      }
      const next = { ...base }
      if (have.size === 0) delete next[stopId]
      else next[stopId] = BAKERIES.filter((bakery) => have.has(bakery))
      writePacked(day, next)
      return next
    })
  }

  function isPacked(stopId: string, bakery: DriverBakery) {
    return (packed?.[stopId] ?? []).includes(bakery)
  }

  function nextId(bakery: DriverBakery, afterId?: string) {
    const list = pending[bakery]
    const source = packed ?? readPacked(day)
    const done = (id: string) => id === afterId || (source[id] ?? []).includes(bakery)
    const start = afterId ? list.indexOf(afterId) + 1 : 0
    if (afterId && start === 0) return null
    return list.slice(Math.max(0, start)).find((id) => !done(id)) ?? null
  }

  return (
    <CollectedGoodsContext.Provider
      value={{
        isPacked,
        toggle,
        ready: (bakery) => pending[bakery].every((id) => (packed?.[id] ?? []).includes(bakery)),
        left: (bakery) => pending[bakery].filter((id) => !(packed?.[id] ?? []).includes(bakery)).length,
        packing,
        begin,
        nextId,
        isTaken: (stopId, itemKey) => (taken[stopId] ?? []).includes(itemKey),
        toggleItem(stopId, itemKey) {
          setTaken((current) => {
            const have = new Set(current[stopId] ?? [])
            if (have.has(itemKey)) have.delete(itemKey)
            else have.add(itemKey)
            const next = { ...current }
            if (have.size === 0) delete next[stopId]
            else next[stopId] = [...have]
            writePicks(day, { packing: packingRef.current, taken: next })
            return next
          })
        },
      }}
    >
      {children}
    </CollectedGoodsContext.Provider>
  )
}

export function CollectGoodsButton({
  stopId,
  bakeries,
}: {
  stopId: string
  bakeries: DriverBakery[]
}) {
  const collected = useContext(CollectedGoodsContext)
  if (!collected) return null
  const focus = collected.packing ?? (bakeries.length === 1 ? bakeries[0] : null)
  const marked = focus
    ? collected.isPacked(stopId, focus)
    : bakeries.length > 0 && bakeries.every((bakery) => collected.isPacked(stopId, bakery))
  return (
    <button
      type="button"
      aria-pressed={marked}
      className={cn(
        buttonVariants({ size: "lg", variant: marked ? "default" : "outline" }),
        "h-12 w-full text-base",
      )}
      onClick={(event) => {
        const bakery = collected.packing ?? (bakeries.length === 1 ? bakeries[0] : null)
        if (bakery) collected.begin(bakery)
        collected.toggle(stopId, bakery ? [bakery] : bakeries)
        if (marked) return
        const details = event.currentTarget.closest("details")
        if (!(details instanceof HTMLDetailsElement)) return
        details.open = false
        if (!bakery) {
          openNextCard(details)
          return
        }
        const id = collected.nextId(bakery, stopId)
        if (id) openStop(id)
        else openPickup(bakery)
      }}
    >
      {marked ? "Ware ist abgeholt" : "Ware abgeholt"}
    </button>
  )
}

export function StartPackingButton({ bakery }: { bakery: DriverBakery }) {
  const collected = useContext(CollectedGoodsContext)
  if (!collected || collected.left(bakery) === 0) return null
  return (
    <button
      type="button"
      className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}
      onClick={(event) => {
        collected.begin(bakery)
        const id = collected.nextId(bakery)
        const details = event.currentTarget.closest("details")
        if (details instanceof HTMLDetailsElement) details.open = false
        if (id) openStop(id)
      }}
    >
      Packen starten
    </button>
  )
}

function openStop(stopId: string) {
  const card = document.querySelector(`details[data-stop-id="${CSS.escape(stopId)}"]`)
  if (!(card instanceof HTMLDetailsElement)) return
  card.open = true
  const summary = card.querySelector("summary")
  if (summary instanceof HTMLElement) summary.scrollIntoView({ block: "start" })
}

export function openPickup(bakery: DriverBakery) {
  const card = pickupCard(bakery)
  if (!card) return
  card.open = true
  const button = [...card.querySelectorAll("button")].find((item) =>
    item.textContent?.includes("Alle Brötchen abgeholt"),
  )
  const target = button ?? card.querySelector("summary")
  if (target instanceof HTMLElement) target.scrollIntoView({ block: "center" })
}

export function openFollowingBakery(bakery: string) {
  const index = BAKERIES.indexOf(bakery as DriverBakery)
  if (index < 0) return
  for (const next of BAKERIES.slice(index + 1)) {
    const card = pickupCard(next)
    if (!card) continue
    card.open = true
    const summary = card.querySelector("summary")
    if (summary instanceof HTMLElement) summary.scrollIntoView({ block: "start" })
    return
  }
}

function pickupCard(bakery: DriverBakery) {
  const card = document.querySelector(`details[data-pickup="${CSS.escape(bakery)}"]`)
  return card instanceof HTMLDetailsElement ? card : null
}

function openNextCard(details: HTMLDetailsElement) {
  const next = details.closest("li")?.nextElementSibling?.querySelector("details")
  if (!(next instanceof HTMLDetailsElement)) return
  next.open = true
  const summary = next.querySelector("summary")
  if (summary instanceof HTMLElement) summary.scrollIntoView({ block: "start" })
}

export function useBakeryPickupReady(bakery: DriverBakery) {
  const collected = useContext(CollectedGoodsContext)
  if (!collected) return { ready: true, left: 0 }
  return { ready: collected.ready(bakery), left: collected.left(bakery) }
}

export function PackedLine({
  stopId,
  bakery,
  itemKey,
  className,
  children,
  ...props
}: ComponentProps<"li"> & { stopId: string; bakery: DriverBakery | ""; itemKey: string }) {
  const collected = useContext(CollectedGoodsContext)
  const packing = collected?.packing ?? null
  const done =
    packing != null &&
    bakery !== "" &&
    bakery !== packing &&
    collected?.isPacked(stopId, bakery) === true
  const now = packing != null && bakery === packing
  const picked = now && collected?.isTaken(stopId, itemKey) === true
  return (
    <li
      {...props}
      data-item-bakery={bakery || undefined}
      data-picked={picked ? "true" : undefined}
      aria-pressed={now ? picked : undefined}
      className={cn(
        className,
        now && "cursor-pointer rounded-md px-2 py-1",
        now && !picked && "bg-white ring-2 ring-neutral-950",
        (done || picked) && "rounded-md opacity-40",
      )}
      onClick={
        now
          ? (event) => {
              const target = event.target
              if (target instanceof Element && target.closest("button")) return
              collected?.toggleItem(stopId, itemKey)
            }
          : undefined
      }
    >
      {children}
    </li>
  )
}

function storageKey(day: string) {
  return `collected-goods:${day}`
}

function isBakery(value: unknown): value is DriverBakery {
  return value === "Heidbüchel" || value === "Moss" || value === "Kockartz"
}

function readPacked(day: string): Packed {
  try {
    const raw = localStorage.getItem(storageKey(day))
    const parsed = raw ? JSON.parse(raw) : {}
    if (Array.isArray(parsed)) {
      return Object.fromEntries(
        parsed.filter((id) => typeof id === "string").map((id) => [id, [...BAKERIES]]),
      )
    }
    if (!parsed || typeof parsed !== "object") return {}
    const packed: Packed = {}
    for (const [id, bakeries] of Object.entries(parsed)) {
      if (!Array.isArray(bakeries)) continue
      const kept = bakeries.filter(isBakery)
      if (kept.length > 0) packed[id] = kept
    }
    return packed
  } catch {
    return {}
  }
}

function writePacked(day: string, packed: Packed) {
  localStorage.setItem(storageKey(day), JSON.stringify(packed))
}
