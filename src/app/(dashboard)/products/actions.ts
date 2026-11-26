"use server"

import { refresh, revalidatePath } from "next/cache"

import { updateProduct, updateProductStatus } from "@/lib/products"
import type { CatalogProduct, ProductUpdate } from "@/lib/product-types"

export async function setProductStatus(id: string, status: CatalogProduct["status"]) {
  const result = await updateProductStatus(id, status)
  if (result.ok) {
    revalidatePath("/products")
    refresh()
  }
  return result
}

export async function saveProduct(id: string, input: ProductUpdate) {
  const result = await updateProduct(id, input)
  if (result.ok) {
    revalidatePath("/products")
    refresh()
  }
  return result
}
