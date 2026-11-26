"use server"

import { refresh, revalidatePath } from "next/cache"

import { importShopifyOrders as saveShopifyOrders } from "@/lib/orders"

export async function importShopifyOrders() {
  const result = await saveShopifyOrders()

  if (result.ok) {
    revalidatePath("/dashboard")
    revalidatePath("/orders")
    refresh()
  }

  return result
}
