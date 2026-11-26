import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const FILE = path.join(process.cwd(), "data", "delivery-log.json")

export async function listDeliveryTimes() {
  const records = await readLog()
  return new Map(Object.entries(records))
}

export async function recordDeliveryTime(id: string) {
  const stopId = id.trim()
  if (!stopId) return { ok: false as const, error: "Не указана остановка" }

  const records = await readLog()
  const existing = records[stopId]
  if (existing) return { ok: true as const, deliveredAt: existing }

  const deliveredAt = new Date().toISOString()
  records[stopId] = deliveredAt
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, `${JSON.stringify(records, null, 2)}\n`)
  return { ok: true as const, deliveredAt }
}

async function readLog(): Promise<Record<string, string>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(FILE, "utf8"))
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" && typeof entry[1] === "string",
      ),
    )
  } catch {
    return {}
  }
}
