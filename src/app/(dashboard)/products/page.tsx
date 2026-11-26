import type { Metadata } from "next"
import { Suspense } from "react"

import { ProductCatalog } from "@/components/product-catalog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { listProducts } from "@/lib/products"

export const metadata: Metadata = {
  title: "Продукты",
}

export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Продукты</h1>
        <p className="text-sm text-muted-foreground">
          Все товары из Shopify: название, SKU и цена. Черновики тоже здесь.
        </p>
      </div>
      <Suspense fallback={<ListFallback />}>
        <ProductWorkspace />
      </Suspense>
    </div>
  )
}

async function ProductWorkspace() {
  const products = await listProducts()
  return <ProductCatalog products={products} />
}

function ListFallback() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Каталог</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  )
}
