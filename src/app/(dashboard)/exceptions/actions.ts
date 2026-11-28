"use server"

import { revalidatePath } from "next/cache"

import {
  blockOrderDay,
  toggleAnnualBakery,
  unblockOrderDay,
  type BakeryCode,
} from "@/lib/bakery-closures"
import { requireOfficeSession } from "@/lib/office-session"

export async function toggleBakeryStatus(monthDay: string, code: BakeryCode) {
  await requireOfficeSession()
  const result = await toggleAnnualBakery(monthDay, code)
  if (result.ok) refresh()
  return result
}

export async function closeOrderDay(isoDate: string) {
  await requireOfficeSession()
  const result = await blockOrderDay(isoDate)
  if (result.ok) refresh()
  return result
}

export async function openOrderDay(isoDate: string) {
  await requireOfficeSession()
  const result = await unblockOrderDay(isoDate)
  if (result.ok) refresh()
  return result
}

function refresh() {
  revalidatePath("/exceptions")
  revalidatePath("/driver")
  revalidatePath("/routes")
  revalidatePath("/subscriptions")
  revalidatePath("/invoices")
  revalidatePath("/order", "layout")
}
