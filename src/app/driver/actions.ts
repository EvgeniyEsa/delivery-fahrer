"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { storeBakeryNote } from "@/lib/bakery-notes"
import { saveDriverHome as writeDriverHome } from "@/lib/driver-home"
import { recordDeliveryTime } from "@/lib/delivery-log"
import { closeDriverSession, requireDriverSession } from "@/lib/driver-auth"
import { markOrderDelivered as saveDelivered } from "@/lib/orders"
import { bakeryFromName } from "@/lib/product-photos"

export async function saveStopDelivered(stopId: string, shopify: boolean) {
  await requireDriverSession()
  const id = stopId.trim()
  if (!id) return { ok: false as const, error: "Не указана остановка" }

  const saved = await recordDeliveryTime(id)
  if (!saved.ok) return { ok: false as const, error: saved.error }

  if (shopify) {
    const result = await saveDelivered(id)
    if (!result.ok) return { ok: false as const, error: result.error }
  }

  revalidatePath("/driver")
  return { ok: true as const, deliveredAt: saved.deliveredAt }
}

export async function confirmStopDelivered(formData: FormData) {
  await requireDriverSession()
  const stopId = String(formData.get("stopId") ?? "").trim()
  const shopifyOrder = formData.get("shopify") === "1"
  const rawDay = String(formData.get("day") ?? "")
  const day = /^\d{4}-\d{2}-\d{2}$/.test(rawDay) ? rawDay : ""
  const back = day ? `/driver?day=${day}` : "/driver"

  if (!stopId) redirect(`${back}${day ? "&" : "?"}error=save`)

  const saved = await recordDeliveryTime(stopId)
  if (!saved.ok) redirect(`${back}${day ? "&" : "?"}error=save`)

  if (shopifyOrder) {
    const result = await saveDelivered(stopId)
    if (!result.ok) redirect(`${back}${day ? "&" : "?"}error=save`)
  }

  revalidatePath("/driver")
  redirect(back)
}

export async function saveDriverHome(formData: FormData) {
  await requireDriverSession()
  const day = String(formData.get("day") ?? "")
  const back = /^\d{4}-\d{2}-\d{2}$/.test(day) ? `/driver?day=${day}` : "/driver"
  const name = String(formData.get("name") ?? "").trim()
  const address = String(formData.get("address") ?? "").trim()
  if (!name || !address) {
    redirect(`${back}${back.includes("?") ? "&" : "?"}error=home`)
  }

  const saved = await writeDriverHome(name, address)
  if (!saved.ok) redirect(`${back}${back.includes("?") ? "&" : "?"}error=home`)

  revalidatePath("/driver")
  redirect(back)
}

export async function saveBakeryNote(formData: FormData) {
  await requireDriverSession()
  const day = String(formData.get("day") ?? "")
  const bakery = bakeryFromName(String(formData.get("bakery") ?? ""))
  const photo = formData.get("photo")
  if (!bakery || !(photo instanceof File)) {
    return { ok: false as const, error: "Foto konnte nicht gelesen werden" }
  }
  return storeBakeryNote(day, bakery, new Uint8Array(await photo.arrayBuffer()))
}

export async function logoutDriver() {
  await closeDriverSession()
  redirect("/driver/login")
}
