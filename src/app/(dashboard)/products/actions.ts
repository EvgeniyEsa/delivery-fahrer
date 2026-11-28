"use server"

import { refresh, revalidatePath } from "next/cache"

import { updateProduct, updateProductStatus } from "@/lib/products"
import type { CatalogProduct, ProductUpdate } from "@/lib/product-types"
import { requireOfficeSession } from "@/lib/office-session"

export async function setProductStatus(id: string, status: CatalogProduct["status"]) {
  await requireOfficeSession()
  const result = await updateProductStatus(id, status)
  if (result.ok) {
    revalidatePath("/products")
    refresh()
  }
  return result
}

export async function saveProduct(id: string, input: ProductUpdate) {
  await requireOfficeSession()
  const result = await updateProduct(id, input)
  if (result.ok) {
    revalidatePath("/products")
    refresh()
  }
  return result
}
