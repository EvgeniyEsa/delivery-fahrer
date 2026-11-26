type SlackOrder = {
  name: string
  customer: string | null
}

export async function notifyNewOrders(orders: SlackOrder[]) {
  if (orders.length === 0) return

  const webhookUrl = process.env.SLACK_WEBHOOK_URL

  if (!webhookUrl) {
    throw new Error("SLACK_WEBHOOK_URL is not set")
  }

  const text = orders
    .map(
      (order) =>
        `Новый заказ ${order.name} — ${order.customer?.trim() || "Без имени"}`,
    )
    .join("\n")

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    cache: "no-store",
  })

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200)
    throw new Error(
      `Slack webhook failed (${response.status})${detail ? `: ${detail}` : ""}`,
    )
  }
}
