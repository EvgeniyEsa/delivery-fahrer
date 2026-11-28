"use server"

import { redirect } from "next/navigation"

import { listB2bPortals, portalByToken } from "@/lib/b2b-portals"
import { verifyB2bLogin } from "@/lib/b2b-passwords"
import { openB2bSession } from "@/lib/b2b-session"

export async function loginB2b(_previous: string | null, formData: FormData) {
  const record = await verifyB2bLogin(
    String(formData.get("login") ?? ""),
    String(formData.get("password") ?? ""),
  )
  if (!record) return "E-Mail oder Passwort ist falsch."

  const opened = await openB2bSession(record.subscriberId)
  if (!opened) return "Anmeldung ist vorübergehend nicht möglich."

  const next = String(formData.get("next") ?? "").trim()
  const portal = next ? await portalByToken(next) : null
  if (portal && portal.subscriberId === record.subscriberId) {
    redirect(`/order/${portal.token}`)
  }

  const own = (await listB2bPortals()).find((item) => item.subscriberId === record.subscriberId)
  if (!own) return "Das Passwort stimmt. Für dieses Konto gibt es noch keine Bestellseite."
  redirect(`/order/${own.token}`)
}
