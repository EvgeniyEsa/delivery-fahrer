import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const FILE = path.join(process.cwd(), "data", "delivery-log.json")
const BUCKET = "delivery-log"
const OBJECT = "times.json"

type Log = Record<string, string>

export async function listDeliveryTimes() {
  const local = await readLocal()
  const remote = await readRemote()
  const merged = merge(remote, local)
  if (remoteBehind(remote, merged)) await writeRemote(merged)
  return new Map(Object.entries(merged))
}

export async function recordDeliveryTime(id: string) {
  const stopId = id.trim()
  if (!stopId) return { ok: false as const, error: "Не указана остановка" }

  const records = merge(await readRemote(), await readLocal())
  const existing = records[stopId]
  if (existing) return { ok: true as const, deliveredAt: existing }

  const deliveredAt = new Date().toISOString()
  records[stopId] = deliveredAt
  const remoteOk = await writeRemote(records)
  const localOk = await writeLocal(records)
  if (!remoteOk && !localOk) {
    return { ok: false as const, error: "Не удалось сохранить время доставки" }
  }
  return { ok: true as const, deliveredAt }
}

function merge(remote: Log, local: Log): Log {
  const records = { ...remote }
  for (const [id, time] of Object.entries(local)) {
    const current = records[id]
    if (!current || time < current) records[id] = time
  }
  return records
}

function remoteBehind(remote: Log, merged: Log) {
  return Object.entries(merged).some(([id, time]) => remote[id] !== time)
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
      .then((response) => response.ok || response.status === 409)
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
  if (!cfg || !(await ensureBucket(cfg.url, cfg.key))) return false
  try {
    const response = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}/${OBJECT}`, {
      method: "POST",
      headers: {
        ...storageHeaders(cfg.key, true),
        "x-upsert": "true",
      },
      body: JSON.stringify(records),
      cache: "no-store",
    })
    if (!response.ok) {
      console.error("[delivery-log] save", response.status)
      return false
    }
    return true
  } catch {
    return false
  }
}

function parseLog(parsed: unknown): Log {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string",
    ),
  )
}
