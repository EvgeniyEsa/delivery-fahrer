"use server"

import { refresh, revalidatePath } from "next/cache"

import { changeDeliveryDate as saveDeliveryDate } from "@/lib/orders"
import { requireOfficeSession } from "@/lib/office-session"

export async function changeDeliveryDate(orderId: string, deliveryDate: string) {
  await requireOfficeSession()
  const result = await saveDeliveryDate(orderId, deliveryDate)

  if (result.ok) {
    revalidatePath("/dashboard")
    revalidatePath("/orders")
    revalidatePath("/routes")
    refresh()
  }

  return result
}
