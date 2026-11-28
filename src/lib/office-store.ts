import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const FILE = path.join(process.cwd(), "data", "office-auth.json")

export type OfficeAuthRecord = {
  totpSecret: string
  totpConfirmed: boolean
}

export function officeIsProtected(record: OfficeAuthRecord | null) {
  return record?.totpConfirmed === true
}

export async function readOfficeAuth(): Promise<OfficeAuthRecord | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(FILE, "utf8"))
    if (!parsed || typeof parsed !== "object") return null
    const record = parsed as Partial<OfficeAuthRecord>
    if (typeof record.totpSecret !== "string" || !record.totpSecret) return null
    return {
      totpSecret: record.totpSecret,
      totpConfirmed: record.totpConfirmed === true,
    }
  } catch {
    return null
  }
}

export async function writeOfficeAuth(record: OfficeAuthRecord) {
  await mkdir(path.dirname(FILE), { recursive: true })
  await writeFile(FILE, `${JSON.stringify(record, null, 2)}\n`)
}
