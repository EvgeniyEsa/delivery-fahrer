"use client"

import { useState } from "react"

import { logoutDriver, saveDriverHome } from "@/app/driver/actions"
import { buttonVariants } from "@/components/ui/button"
import type { DriverHome } from "@/lib/driver-home"
import { cn } from "cn"

export function DriverHeader({
  day,
  home,
  tipLabel,
  tipAmount,
  settingsOpen,
}: {
  day: string
  home: DriverHome
  tipLabel: string
  tipAmount: string
  settingsOpen: boolean
}) {
  const [open, setOpen] = useState(settingsOpen)

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
      <p className="text-sm font-medium text-muted-foreground">Delivery Manager</p>
      <div className="flex items-center justify-self-end gap-3">
        <button
          type="button"
          className="text-sm text-muted-foreground"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          Einstellungen
        </button>
        <form action={logoutDriver}>
          <button type="submit" className="text-sm text-muted-foreground">
            Abmelden
          </button>
        </form>
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">Fahrer</h1>
      <div className="justify-self-end text-right">
        <p className="text-sm font-medium leading-tight">{tipLabel}</p>
        <p className="text-base font-semibold tabular-nums leading-tight">{tipAmount}</p>
      </div>
      {open ? (
        <form
          action={saveDriverHome}
          className="col-span-2 mt-2 flex flex-col gap-2 rounded-lg bg-card px-3 py-3 ring-1 ring-foreground/10"
        >
          <p className="text-sm font-medium">Zuhause</p>
          <input type="hidden" name="day" value={day} />
          <input
            name="name"
            defaultValue={home.name}
            required
            placeholder="Name"
            className="h-11 rounded-md border bg-background px-3 text-base"
          />
          <input
            name="address"
            defaultValue={home.address}
            required
            placeholder="Straße, PLZ, Ort"
            className="h-11 rounded-md border bg-background px-3 text-base"
          />
          <button type="submit" className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}>
            Speichern
          </button>
        </form>
      ) : null}
    </header>
  )
}
