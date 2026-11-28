import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

import { geocodeAddress } from "@/lib/geocode"
import { readDataText } from "@/lib/stored-json"

const FILE = path.join(process.cwd(), "data", "driver.json")

export type DriverHome = {
  name: string
  address: string
  latitude: number | null
  longitude: number | null
}

const EMPTY: DriverHome = {
  name: "",
  address: "",
  latitude: null,
  longitude: null,
}

export async function readDriverHome(): Promise<DriverHome> {
  try {
    return parseHome(JSON.parse(await readDataText("driver.json")))
  } catch {
    return EMPTY
  }
}

export async function saveDriverHome(name: string, address: string) {
  const point = await geocodeAddress(address)
  if (!point) return { ok: false as const, error: "Adresse nicht gefunden. Straße und Ort angeben." }

  const home: DriverHome = { name, address, ...point }
  try {
    await mkdir(path.dirname(FILE), { recursive: true })
    await writeFile(FILE, `${JSON.stringify(home, null, 2)}\n`)
  } catch {
    return { ok: false as const, error: "Die Fahreradresse konnte nicht gespeichert werden." }
  }

  return { ok: true as const, home }
}

function parseHome(parsed: unknown): DriverHome {
  if (!parsed || typeof parsed !== "object") return EMPTY
  const record = parsed as Record<string, unknown>
  const latitude = typeof record.latitude === "number" ? record.latitude : null
  const longitude = typeof record.longitude === "number" ? record.longitude : null
  return {
    name: typeof record.name === "string" ? record.name.trim() : "",
    address: typeof record.address === "string" ? record.address.trim() : "",
    latitude,
    longitude,
  }
}
