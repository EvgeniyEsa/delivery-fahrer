"use server"

import { refresh, revalidatePath } from "next/cache"

import {
  createSubscriber as saveSubscriber,
  deleteSubscriber as removeSubscriber,
  updateSubscriber as saveSubscriberUpdate,
} from "@/lib/subscribers"
import type { SubscriberInput } from "@/lib/subscriber-types"

export async function createSubscriber(input: SubscriberInput) {
  const result = await saveSubscriber(input)

  if (result.ok) {
    revalidatePath("/subscriptions")
    refresh()
  }

  return result
}

export async function updateSubscriber(id: string, input: SubscriberInput) {
  const result = await saveSubscriberUpdate(id, input)

  if (result.ok) {
    revalidatePath("/subscriptions")
    refresh()
  }

  return result
}

export async function deleteSubscriber(id: string) {
  const result = await removeSubscriber(id)

  if (result.ok) {
    revalidatePath("/subscriptions")
    revalidatePath("/routes")
    revalidatePath("/driver")
    refresh()
  }

  return result
}
