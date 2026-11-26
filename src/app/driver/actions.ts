"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { recordDeliveryTime } from "@/lib/delivery-log"
import { closeDriverSession, requireDriverSession } from "@/lib/driver-auth"
import { markOrderDelivered as saveDelivered } from "@/lib/orders"

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
  revalidatePath("/dashboard")
  revalidatePath("/orders")
  revalidatePath("/routes")
  redirect(back)
}

export async function logoutDriver() {
  await closeDriverSession()
  redirect("/driver/login")
}
