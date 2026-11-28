"use server"

import { refresh, revalidatePath } from "next/cache"

import { buildInvoiceDraft, removeInvoice, saveInvoice, sendMonthInvoices } from "@/lib/invoices"
import { requireOfficeSession } from "@/lib/office-session"

export async function prepareInvoiceDraft(input: { clientKey: string; from: string; to: string }) {
  await requireOfficeSession()
  return buildInvoiceDraft(input)
}

export async function createInvoice(input: {
  clientKey: string
  from: string
  to: string
  prices: Record<string, string>
}) {
  await requireOfficeSession()
  const result = await saveInvoice(input)
  if (result.ok) {
    revalidatePath("/invoices")
    refresh()
  }
  return result
}

export async function sendMonthlyInvoices(year: number, month: number) {
  await requireOfficeSession()
  const result = await sendMonthInvoices(year, month)
  if (result.ok) {
    revalidatePath("/invoices")
    refresh()
  }
  return result
}

export async function deleteInvoice(id: string) {
  await requireOfficeSession()
  const result = await removeInvoice(id)
  if (result.ok) {
    revalidatePath("/invoices")
    refresh()
  }
  return result
}
