import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

export type EveningLine = {
  name: string
  quantity: number
  article: string
}

export type EveningVersion = {
  at: string | null
  lines: EveningLine[]
}

export type EveningOrderRecord = {
  versions: EveningVersion[]
}

const FILE = path.join(process.cwd(), "data", "evening-orders.json")
const BUCKET = "evening-orders"
const OBJECT = "orders.json"

type Log = Record<string, EveningOrderRecord>

export function eveningOrderKey(subscriberId: string, day: string) {
  return `${subscriberId}|${day}`
}

export function currentEveningLines(record: EveningOrderRecord | undefined) {
  return record?.versions.at(-1)?.lines ?? []
}

export async function listEveningOrderRecords() {
  const [remote, local] = await Promise.all([readRemote(), readLocal()])
  return new Map(Object.entries({ ...remote, ...local }))
}

export async function listEveningOrders() {
  const records = await listEveningOrderRecords()
  return new Map([...records].map(([key, record]) => [key, currentEveningLines(record)]))
}

export async function saveEveningOrder(subscriberId: string, day: string, lines: EveningLine[]) {
  const key = eveningOrderKey(subscriberId, day)
  const [remote, local] = await Promise.all([readRemote(), readLocal()])
  const records = { ...remote, ...local }
  const existing = records[key]
  const changed = !existing || !sameLines(currentEveningLines(existing), lines)
  const now = new Date().toISOString()

  if (lines.length === 0) delete records[key]
  else if (!existing) records[key] = { versions: [{ at: now, lines }] }
  else if (changed) records[key] = { versions: [...existing.versions, { at: now, lines }] }

  const localOk = await writeLocal(records)
  if (!localOk) {
    const remoteResult = await writeRemote(records)
    if (remoteResult !== true) {
      return {
        ok: false as const,
        error: `Не удалось сохранить вечерний заказ${remoteResult ? ` (${remoteResult})` : ""}`,
      }
    }
  } else {
    void writeRemote(records)
  }

  return {
    ok: true as const,
    changed: lines.length > 0 && changed,
    record: records[key] ?? { versions: [] },
  }
}

function parseLines(value: unknown): EveningLine[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const line = item as Partial<EveningLine>
    const name = typeof line.name === "string" ? line.name.trim() : ""
    const article = typeof line.article === "string" ? line.article.trim() : ""
    const quantity = typeof line.quantity === "number" ? line.quantity : Number(line.quantity)
    if (!name || !article || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) return []
    return [{ name, article, quantity }]
  })
}

function parseRecord(value: unknown): EveningOrderRecord | null {
  if (Array.isArray(value)) {
    const lines = parseLines(value)
    return lines.length > 0 ? { versions: [{ at: null, lines }] } : null
  }
  if (!value || typeof value !== "object") return null
  const versions = (value as { versions?: unknown }).versions
  if (!Array.isArray(versions)) return null
  const parsed = versions.flatMap((version) => {
    if (!version || typeof version !== "object") return []
    const item = version as { at?: unknown; lines?: unknown }
    const lines = parseLines(item.lines)
    if (lines.length === 0) return []
    const at = typeof item.at === "string" && !Number.isNaN(Date.parse(item.at)) ? item.at : null
    return [{ at, lines }]
  })
  return parsed.length > 0 ? { versions: parsed } : null
}

function sameLines(left: EveningLine[], right: EveningLine[]) {
  const signature = (lines: EveningLine[]) =>
    lines
      .map((line) => `${line.article}\t${line.name}\t${line.quantity}`)
      .sort()
      .join("\n")
  return signature(left) === signature(right)
}

function parseLog(parsed: unknown): Log {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
  return Object.fromEntries(
    Object.entries(parsed).flatMap(([key, value]) => {
      if (!/^[^|]+\|\d{4}-\d{2}-\d{2}$/.test(key)) return []
      const record = parseRecord(value)
      return record ? [[key, record]] : []
    }),
  )
}

async function readLocal(): Promise<Log> {
  try {
    return parseLog(JSON.parse(await readFile(FILE, "utf8")))
  } catch {
    return {}
  }
}

async function writeLocal(records: Log) {
  try {
    await mkdir(path.dirname(FILE), { recursive: true })
    await writeFile(FILE, `${JSON.stringify(records, null, 2)}\n`)
    return true
  } catch {
    return false
  }
}

function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url, key }
}

function storageHeaders(key: string, json = false): HeadersInit {
  return {
    authorization: `Bearer ${key}`,
    apikey: key,
    ...(json ? { "content-type": "application/json" } : {}),
  }
}

let bucketReady: Promise<boolean> | null = null

function ensureBucket(url: string, key: string) {
  if (!bucketReady) {
    bucketReady = fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: storageHeaders(key, true),
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.ok || response.status === 409) return true
        const text = await response.text().catch(() => "")
        if (/already exists|duplicate/i.test(text)) return true
        console.error("[evening-orders] bucket", response.status)
        return false
      })
      .catch(() => false)
      .then((ok) => {
        if (!ok) bucketReady = null
        return ok
      })
  }
  return bucketReady
}

async function readRemote(): Promise<Log> {
  const cfg = storage()
  if (!cfg || !(await ensureBucket(cfg.url, cfg.key))) return {}
  try {
    const response = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${OBJECT}`, {
      headers: storageHeaders(cfg.key),
      cache: "no-store",
    })
    if (!response.ok) return {}
    return parseLog(JSON.parse(await response.text()))
  } catch {
    return {}
  }
}

async function writeRemote(records: Log) {
  const cfg = storage()
  if (!cfg) return "нет ключа"
  if (!(await ensureBucket(cfg.url, cfg.key))) return "хранилище недоступно"
  try {
    const response = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${OBJECT}`, {
      method: "POST",
      headers: { ...storageHeaders(cfg.key, true), "x-upsert": "true" },
      body: JSON.stringify(records),
      cache: "no-store",
    })
    if (!response.ok) {
      console.error("[evening-orders] save", response.status)
      return String(response.status)
    }
    return true
  } catch {
    return "сеть"
  }
}
