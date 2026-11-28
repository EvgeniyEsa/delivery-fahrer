"use client"

import { Search, X } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"

import { productSearchKey } from "@/lib/product-search"

export function DriverSearch({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("")
  const [count, setCount] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const needle = productSearchKey(query)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const cards = [...root.querySelectorAll<HTMLElement>("details[data-stop]")]
    let matches = 0
    let first: HTMLElement | null = null

    for (const card of cards) {
      const goods = card.dataset.goods ?? ""
      const hit =
        needle.length > 0 && goods.split("|").some((part) => part.includes(needle))
      card.dataset.hit = hit ? "true" : "false"
      card.dataset.dim = needle.length > 0 && !hit ? "true" : "false"
      for (const row of card.querySelectorAll<HTMLElement>("[data-good]")) {
        const good = row.dataset.good ?? ""
        row.dataset.match = needle.length > 0 && good.includes(needle) ? "true" : "false"
      }
      if (!hit) continue
      matches += 1
      first ??= card
    }

    setCount(matches)
    if (first) first.scrollIntoView({ block: "nearest" })
  }, [needle])

  return (
    <div className="flex flex-col gap-2">
      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Brötchen suchen"
          className="h-12 w-full rounded-md border bg-background pr-10 pl-10 text-base"
        />
        {query ? (
          <button
            type="button"
            aria-label="Suche löschen"
            className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center text-muted-foreground"
            onClick={() => setQuery("")}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </label>
      {needle ? (
        <p className="text-sm text-muted-foreground">
          {count === 0 ? "Dieses Brötchen gibt es nicht." : `Kunden mit diesem Brötchen: ${count}.`}
        </p>
      ) : null}
      <div ref={rootRef}>{children}</div>
    </div>
  )
}
