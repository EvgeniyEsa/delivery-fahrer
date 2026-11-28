"use client"

import { Button } from "@/components/ui/button"

export function PrintLieferscheineButton() {
  return (
    <Button type="button" variant="outline" className="h-12 text-base" onClick={() => window.print()}>
      Speichern oder drucken
    </Button>
  )
}
