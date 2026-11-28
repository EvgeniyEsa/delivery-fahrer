import { formatOrderClock } from "@/lib/order-changes"
import { lieferscheinNumber } from "@/lib/b2b-portals"
import { diffOrderLines } from "@/lib/order-changes"

export async function notifyLateHotelChange(input: {
  customerName: string
  deliveryDay: string
  mark?: string
  at: string
  before: Array<{ name: string; quantity: number }>
  after: Array<{ name: string; quantity: number }>
}) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return

  const number = lieferscheinNumber(input.deliveryDay, input.mark ?? "")
  const rows = diffOrderLines(input.before, input.after)
    .map((row) => `${row.name}: ${row.from} → ${row.to}`)
    .join("\n")
  const text = [
    `Поздняя правка: ${input.customerName}`,
    `Доставка ${input.deliveryDay}${number == null ? "" : `, Lieferschein ${number}`}`,
    `Время ${formatOrderClock(input.at)}`,
    rows,
  ]
    .filter(Boolean)
    .join("\n")

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      cache: "no-store",
    })
  } catch {
    // The hotel change is already saved. A missed Slack message stays on the office page.
  }
}
