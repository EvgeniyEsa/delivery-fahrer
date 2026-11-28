"use server"

import { refresh, revalidatePath } from "next/cache"

import { importShopifyOrders as saveShopifyOrders } from "@/lib/orders"
import { requireOfficeSession } from "@/lib/office-session"

export async function importShopifyOrders() {
  await requireOfficeSession()
  const result = await saveShopifyOrders()

  if (result.ok) {
    revalidatePath("/dashboard")
    revalidatePath("/orders")
    refresh()
  }

  return result
}
