"use client"

import { Fragment, useEffect, useMemo, useState, useTransition, type FormEvent } from "react"
import { createPortal } from "react-dom"

import { saveProduct, setProductStatus } from "@/app/(dashboard)/products/actions"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  catalogSections,
  formatPrice,
  vendorLabel,
  type CatalogProduct,
  type ProductUpdate,
} from "@/lib/product-types"

function productCount(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  const word =
    mod10 === 1 && mod100 !== 11
      ? "продукт"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "продукта"
        : "продуктов"
  return `${count} ${word}`
}

function ProductPhoto({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  if (!src || failed) {
    return <span className="block size-10 rounded-md bg-black/5" aria-hidden />
  }

  return (
    <>
      <button
        type="button"
        className="block size-10 overflow-hidden rounded-md"
        aria-label={name ? `Открыть фото: ${name}` : "Открыть фото"}
        onClick={() => setOpen(true)}
      >
        <img
          src={src}
          alt=""
          className="size-10 object-cover"
          onError={() => setFailed(true)}
        />
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
              role="dialog"
              aria-modal="true"
              aria-label={name || "Фото"}
              onClick={() => setOpen(false)}
            >
              <img
                src={src}
                alt={name}
                className="max-h-[85vh] max-w-[90vw] rounded-lg bg-white object-contain"
                onClick={(event) => event.stopPropagation()}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

function ProductEditor({
  product,
  vendors,
  pending,
  onToggle,
  onCancel,
  onSave,
}: {
  product: CatalogProduct
  vendors: string[]
  pending: boolean
  onToggle: (product: CatalogProduct) => void
  onCancel: () => void
  onSave: (input: ProductUpdate) => void
}) {
  const [name, setName] = useState(product.name)
  const [sku, setSku] = useState(product.sku)
  const [price, setPrice] = useState(String(product.price))
  const [vendor, setVendor] = useState(product.vendor)
  const [image, setImage] = useState(product.image)
  const choices = vendors.includes(vendor) ? vendors : [vendor, ...vendors]
  const draft = product.status === "draft"

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = Number(price.replace(",", "."))
    onSave({
      name,
      sku,
      price: value,
      type: product.type,
      vendor,
      image,
    })
  }

  return (
    <TableRow className="bg-background hover:bg-background">
      <TableCell colSpan={5} className="p-4">
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1 text-sm">
            <Label>Название</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <Label>SKU</Label>
            <Input value={sku} onChange={(event) => setSku(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <Label>Цена</Label>
            <Input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="decimal" />
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <Label>Пекарня</Label>
            <select
              value={vendor}
              onChange={(event) => setVendor(event.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            >
              {choices.map((name) => (
                <option key={name} value={name}>
                  {vendorLabel(name)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-3">
            <Label>Фото</Label>
            <div className="flex items-center gap-3">
              <ProductPhoto src={image.trim()} name={name} />
              <Input
                value={image}
                onChange={(event) => setImage(event.target.value)}
                placeholder="https://"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              aria-pressed={!draft}
              onClick={() => onToggle(product)}
            >
              {draft ? "Черновик" : "В продаже"}
            </Button>
            <Button type="submit" size="sm" disabled={pending}>
              Сохранить
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancel}>
              Отмена
            </Button>
          </div>
        </form>
      </TableCell>
    </TableRow>
  )
}

function SectionRows({
  title,
  products,
  showVendor,
  vendors,
  pendingId,
  editingId,
  onToggle,
  onEdit,
  onCancel,
  onSave,
}: {
  title: string
  products: CatalogProduct[]
  showVendor?: boolean
  vendors: string[]
  pendingId: string | null
  editingId: string | null
  onToggle: (product: CatalogProduct) => void
  onEdit: (id: string) => void
  onCancel: () => void
  onSave: (product: CatalogProduct, input: ProductUpdate) => void
}) {
  return (
    <>
      <TableRow className="border-t-2 border-foreground/20 bg-muted/60 hover:bg-muted/60">
        <TableCell colSpan={5} className="py-2 pl-4 text-sm font-semibold">
          {title}
        </TableCell>
      </TableRow>
      {products.map((product) => {
        const draft = product.status === "draft"
        return (
          <Fragment key={product.id}>
          <TableRow
            className={
              draft
                ? "bg-zinc-200/80 transition-none hover:bg-zinc-200/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-800/80"
                : "bg-green-100 transition-none hover:bg-green-100 dark:bg-green-950/50 dark:hover:bg-green-950/50"
            }
          >
            <TableCell
              className="w-16 max-w-16 truncate px-0 font-medium tabular-nums"
              title={product.sku || undefined}
            >
              {product.sku || "—"}
            </TableCell>
            <TableCell className="w-14 px-1">
              <div className="flex justify-center">
                <ProductPhoto src={product.image} name={product.name} />
              </div>
            </TableCell>
            <TableCell className="font-medium whitespace-normal">
              {product.name}
              {showVendor ? (
                <span className="ml-2 font-normal text-muted-foreground">
                  {vendorLabel(product.vendor)}
                </span>
              ) : null}
            </TableCell>
            <TableCell className="whitespace-nowrap tabular-nums">
              {formatPrice(product.price)}
            </TableCell>
            <TableCell className="pr-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onEdit(product.id)}
              >
                Изменить
              </Button>
            </TableCell>
          </TableRow>
          {editingId === product.id ? (
            <ProductEditor
              key={product.id}
              product={product}
              vendors={vendors}
              pending={pendingId === product.id}
              onToggle={onToggle}
              onCancel={onCancel}
              onSave={(input) => onSave(product, input)}
            />
          ) : null}
          </Fragment>
        )
      })}
    </>
  )
}

export function ProductCatalog({ products }: { products: CatalogProduct[] }) {
  const [items, setItems] = useState(products)
  const [seen, setSeen] = useState(products)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  if (seen !== products) {
    setSeen(products)
    setItems(products)
  }
  const [query, setQuery] = useState("")
  const [vendor, setVendor] = useState("")
  const [status, setStatus] = useState("")
  const vendors = useMemo(() => {
    const names = new Set(products.map((product) => product.vendor).filter(Boolean))
    return [...names].sort(
      (left, right) =>
        products.findIndex((product) => product.vendor === left) -
        products.findIndex((product) => product.vendor === right),
    )
  }, [products])
  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru")
    return items.filter((product) => {
      if (vendor && product.vendor !== vendor) return false
      if (status && product.status !== status) return false
      if (!needle) return true
      const haystack = [product.name, product.sku, product.type, vendorLabel(product.vendor)]
        .join(" ")
        .toLocaleLowerCase("ru")
      return haystack.includes(needle)
    })
  }, [items, query, status, vendor])
  const sections = useMemo(() => catalogSections(shown), [shown])
  const onSale = items.filter((product) => product.status === "active").length

  function toggle(product: CatalogProduct) {
    const next = product.status === "draft" ? "active" : "draft"
    setError(null)
    setPendingId(product.id)
    setItems((current) =>
      current.map((item) => (item.id === product.id ? { ...item, status: next } : item)),
    )
    startTransition(async () => {
      const result = await setProductStatus(product.id, next)
      setPendingId(null)
      if (!result.ok) {
        setItems((current) =>
          current.map((item) =>
            item.id === product.id ? { ...item, status: product.status } : item,
          ),
        )
        setError(result.error)
      }
    })
  }

  function save(product: CatalogProduct, input: ProductUpdate) {
    setError(null)
    setPendingId(product.id)
    setItems((current) =>
      current.map((item) => (item.id === product.id ? { ...item, ...input } : item)),
    )
    setEditingId(null)
    startTransition(async () => {
      const result = await saveProduct(product.id, input)
      setPendingId(null)
      if (!result.ok) {
        setItems((current) =>
          current.map((item) => (item.id === product.id ? product : item)),
        )
        setEditingId(product.id)
        setError(result.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Каталог</CardTitle>
        <CardDescription>
          {shown.length === items.length
            ? `${productCount(items.length)}, ${onSale} в продаже`
            : `${productCount(shown.length)} из ${items.length}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="grid gap-3 px-4 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название или SKU"
            aria-label="Поиск продукта"
          />
          <select
            value={vendor}
            onChange={(event) => setVendor(event.target.value)}
            aria-label="Пекарня"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">Все пекарни</option>
            {vendors.map((name) => (
              <option key={name} value={name}>
                {vendorLabel(name)}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Статус"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="">Все статусы</option>
            <option value="active">В продаже</option>
            <option value="draft">Черновик</option>
          </select>
        </div>
        {error ? <p className="px-4 text-sm text-destructive">{error}</p> : null}
        <Table className="min-w-[40rem]">
          <colgroup>
            <col className="w-16" />
            <col className="w-14" />
            <col />
            <col className="w-24" />
            <col className="w-28" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="truncate px-0">SKU</TableHead>
              <TableHead className="px-1">Фото</TableHead>
              <TableHead>Название</TableHead>
              <TableHead>Цена</TableHead>
              <TableHead className="pr-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  Ничего не нашлось.
                </TableCell>
              </TableRow>
            ) : (
              sections.map((section) => (
                <SectionRows
                  key={section.id}
                  title={section.title}
                  products={section.products}
                  showVendor={section.showVendor}
                  vendors={vendors}
                  pendingId={pendingId}
                  editingId={editingId}
                  onToggle={toggle}
                  onEdit={setEditingId}
                  onCancel={() => setEditingId(null)}
                  onSave={save}
                />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
