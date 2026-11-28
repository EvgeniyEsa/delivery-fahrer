import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { formatDeliveredAt } from "@/lib/delivery-date"
import type { DriverBakery } from "@/lib/product-photos"

const BUCKET = "bakery-notes"
const MANIFEST = "manifest.json"
const LOCAL_DIR = path.join(process.cwd(), "data", "bakery-notes")
const LOCAL_MANIFEST = path.join(LOCAL_DIR, "manifest.json")
const NOTE_PATH = /^(\d{4}-\d{2}-\d{2})\/(heidbuechel|moss|kockartz)\/(\d+)\.jpg$/

const SLUG: Record<DriverBakery, string> = {
  Heidbüchel: "heidbuechel",
  Moss: "moss",
  Kockartz: "kockartz",
}

const BAKERY_BY_SLUG: Record<string, DriverBakery> = {
  heidbuechel: "Heidbüchel",
  moss: "Moss",
  kockartz: "Kockartz",
}

type Manifest = Record<string, string>

export type BakeryNote = {
  bakery: DriverBakery
  day: string
  takenAt: string
  label: string
  src: string
}

export async function listBakeryNotes(day?: string): Promise<BakeryNote[]> {
  const manifest = await readManifest()
  return Object.entries(manifest)
    .flatMap(([notePath, takenAt]) => {
      const parsed = parseNotePath(notePath)
      if (!parsed || (day && parsed.day !== day)) return []
      return [
        {
          bakery: parsed.bakery,
          day: parsed.day,
          takenAt,
          label: formatDeliveredAt(takenAt),
          src: `/bakery-notes?path=${encodeURIComponent(notePath)}`,
        },
      ]
    })
    .sort((left, right) => left.takenAt.localeCompare(right.takenAt))
}

export async function storeBakeryNote(day: string, bakery: DriverBakery, bytes: Uint8Array) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { ok: false as const, error: "Некорректная дата" }
  }
  if (bytes.byteLength === 0 || bytes.byteLength > 1_500_000) {
    return { ok: false as const, error: "Фото слишком большое" }
  }

  const notePath = `${day}/${SLUG[bakery]}/${Date.now()}.jpg`
  const takenAt = new Date().toISOString()
  const localOk = await writeLocalFile(notePath, bytes)
  const remoteOk = await writeRemoteFile(notePath, bytes)
  if (!localOk && !remoteOk) {
    return { ok: false as const, error: "Не удалось сохранить фото" }
  }

  await remember(notePath, takenAt)
  return {
    ok: true as const,
    note: {
      bakery,
      day,
      takenAt,
      label: formatDeliveredAt(takenAt),
      src: `/bakery-notes?path=${encodeURIComponent(notePath)}`,
    } satisfies BakeryNote,
  }
}

export async function readBakeryNote(notePath: string) {
  const parsed = parseNotePath(notePath)
  if (!parsed) return null
  const local = await readLocalFile(notePath)
  if (local) return local
  return readRemoteFile(notePath)
}

function parseNotePath(notePath: string) {
  const match = NOTE_PATH.exec(notePath)
  const day = match?.[1]
  const slug = match?.[2]
  const bakery = slug ? BAKERY_BY_SLUG[slug] : undefined
  if (!day || !bakery) return null
  return { day, bakery }
}

async function remember(notePath: string, takenAt: string) {
  const manifest = await readManifest()
  manifest[notePath] = takenAt
  await writeManifest(manifest)
}

async function readManifest(): Promise<Manifest> {
  const [remote, local] = await Promise.all([readRemoteManifest(), readLocalManifest()])
  return { ...remote, ...local }
}

async function writeManifest(manifest: Manifest) {
  const body = `${JSON.stringify(manifest, null, 2)}\n`
  await Promise.all([writeLocalManifest(body), writeRemoteManifest(body)])
}

async function readLocalManifest(): Promise<Manifest> {
  try {
    return parseManifest(JSON.parse(await readFile(LOCAL_MANIFEST, "utf8")))
  } catch {
    return {}
  }
}

async function writeLocalManifest(body: string) {
  try {
    await mkdir(LOCAL_DIR, { recursive: true })
    await writeFile(LOCAL_MANIFEST, body)
  } catch {
    return
  }
}

async function writeLocalFile(notePath: string, bytes: Uint8Array) {
  try {
    const file = path.join(LOCAL_DIR, notePath)
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, bytes)
    return true
  } catch {
    return false
  }
}

async function readLocalFile(notePath: string) {
  try {
    return new Uint8Array(await readFile(path.join(LOCAL_DIR, notePath)))
  } catch {
    return null
  }
}

function storage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return { url, key }
}

function storageHeaders(key: string, contentType?: string): HeadersInit {
  return {
    authorization: `Bearer ${key}`,
    apikey: key,
    ...(contentType ? { "content-type": contentType } : {}),
  }
}

let bucketReady: Promise<boolean> | null = null

function ensureBucket(url: string, key: string) {
  if (!bucketReady) {
    bucketReady = fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers: storageHeaders(key, "application/json"),
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false }),
      cache: "no-store",
    })
      .then(async (response) => {
        if (response.ok || response.status === 409) return true
        const text = await response.text().catch(() => "")
        if (/already exists|duplicate/i.test(text)) return true
        console.error("[bakery-notes] bucket", response.status)
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

async function readRemoteManifest(): Promise<Manifest> {
  const bytes = await readRemoteFile(MANIFEST)
  if (!bytes) return {}
  try {
    return parseManifest(JSON.parse(new TextDecoder().decode(bytes)))
  } catch {
    return {}
  }
}

async function writeRemoteManifest(body: string) {
  await writeRemoteFile(MANIFEST, new TextEncoder().encode(body), "application/json")
}

async function readRemoteFile(notePath: string) {
  const cfg = storage()
  if (!cfg || !(await ensureBucket(cfg.url, cfg.key))) return null
  try {
    const response = await fetch(
      `${cfg.url}/storage/v1/object/${BUCKET}/${notePath.split("/").map(encodeURIComponent).join("/")}`,
      { headers: storageHeaders(cfg.key), cache: "no-store" },
    )
    if (!response.ok) return null
    return new Uint8Array(await response.arrayBuffer())
  } catch {
    return null
  }
}

async function writeRemoteFile(notePath: string, bytes: Uint8Array, contentType = "image/jpeg") {
  const cfg = storage()
  if (!cfg || !(await ensureBucket(cfg.url, cfg.key))) return false
  try {
    const response = await fetch(
      `${cfg.url}/storage/v1/object/${BUCKET}/${notePath.split("/").map(encodeURIComponent).join("/")}`,
      {
        method: "POST",
        headers: {
          ...storageHeaders(cfg.key, contentType),
          "x-upsert": "true",
        },
        body: Buffer.from(bytes),
        cache: "no-store",
      },
    )
    if (!response.ok) {
      console.error("[bakery-notes] save", response.status)
      return false
    }
    return true
  } catch {
    return false
  }
}

function parseManifest(parsed: unknown): Manifest {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" &&
        NOTE_PATH.test(entry[0]) &&
        typeof entry[1] === "string",
    ),
  )
}
