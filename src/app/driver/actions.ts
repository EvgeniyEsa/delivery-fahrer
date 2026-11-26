"use server"

import { refresh, revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { recordDeliveryTime } from "@/lib/delivery-log"
import { closeDriverSession, requireDriverSession } from "@/lib/driver-auth"
import { markOrderDelivered as saveDelivered } from "@/lib/orders"

export async function confirmStopDelivered(stopId: string, shopifyOrder: boolean) {
  await requireDriverSession()
  try {
    const saved = await recordDeliveryTime(stopId)
    if (!saved.ok) return saved

    if (shopifyOrder) {
      const result = await saveDelivered(stopId)
      if (!result.ok) return result
    }

    revalidatePath("/driver")
    revalidatePath("/dashboard")
    revalidatePath("/orders")
    revalidatePath("/routes")
    refresh()
    return saved
  } catch {
    return { ok: false as const, error: "Не удалось сохранить время доставки" }
  }
}

export async function logoutDriver() {
  await closeDriverSession()
  redirect("/driver/login")
}
