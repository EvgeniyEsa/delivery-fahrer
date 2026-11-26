"use server"

import { refresh, revalidatePath } from "next/cache"

import { changeDeliveryDate as saveDeliveryDate } from "@/lib/orders"

export async function changeDeliveryDate(orderId: string, deliveryDate: string) {
  const result = await saveDeliveryDate(orderId, deliveryDate)

  if (result.ok) {
    revalidatePath("/dashboard")
    revalidatePath("/orders")
    revalidatePath("/routes")
    refresh()
  }

  return result
}
