import { OrdersTable } from "@/components/orders-table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { mockOrders, type Order } from "@/lib/mock-orders"
import { listStoredOrders } from "@/lib/orders"

export async function StoredOrdersCard({ title }: { title: string }) {
  let stored: Order[] = []
  let error: string | null = null

  try {
    stored = await listStoredOrders()
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Не удалось прочитать заказы"
  }

  const orders = error || stored.length > 0 ? stored : mockOrders
  const description = error
    ? error
    : stored.length > 0
      ? `${stored.length} заказов из Supabase`
      : "Тестовые данные, пока в Supabase нет заказов."

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className={error ? "text-destructive" : undefined}>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <OrdersTable orders={orders} />
      </CardContent>
    </Card>
  )
}
