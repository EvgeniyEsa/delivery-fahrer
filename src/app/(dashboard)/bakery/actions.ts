"use server"

import { refresh, revalidatePath } from "next/cache"

import type { PartnerInput } from "@/lib/partner-types"
import {
  createPartner as savePartner,
  reorderPartners as savePartnerOrder,
  updatePartner as savePartnerUpdate,
} from "@/lib/partners"

function refreshBakery(ok: boolean) {
  if (!ok) return
  revalidatePath("/bakery")
  revalidatePath("/routes")
  refresh()
}

export async function createPartner(input: PartnerInput) {
  const result = await savePartner(input)
  refreshBakery(result.ok)
  return result
}

export async function updatePartner(id: string, input: PartnerInput) {
  const result = await savePartnerUpdate(id, input)
  refreshBakery(result.ok)
  return result
}

export async function reorderPartners(ids: string[]) {
  const result = await savePartnerOrder(ids)
  refreshBakery(result.ok)
  return result
}
