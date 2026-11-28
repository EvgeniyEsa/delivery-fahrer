"use client"

import { Menu } from "@base-ui/react/menu"
import { Ellipsis } from "lucide-react"

export function OrderDocumentsMenu({ token }: { token: string }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Menü"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground hover:bg-muted"
      >
        <Ellipsis className="size-5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <Menu.Popup className="min-w-52 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md outline-none">
            <Menu.LinkItem
              href={`/order/${token}/lieferscheine`}
              closeOnClick
              className="block rounded-md px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-muted"
            >
              Alle Lieferscheine
            </Menu.LinkItem>
            <Menu.LinkItem
              href={`/order/${token}/rechnungen`}
              closeOnClick
              className="block rounded-md px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-muted"
            >
              Alle Rechnungen
            </Menu.LinkItem>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
