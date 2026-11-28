import { readFile } from "node:fs/promises"
import path from "node:path"

import { createClient } from "@supabase/supabase-js"

const BUCKET = "app-data"

export async function readDataText(name: string) {
  try {
    return await readFile(path.join(process.cwd(), "data", name), "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    const missing = new Error("data file is not on this machine") as NodeJS.ErrnoException
    missing.code = "ENOENT"
    throw missing
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.storage.from(BUCKET).download(name)
  if (error || !data) {
    const missing = new Error(error?.message || "data file is not on this machine") as NodeJS.ErrnoException
    missing.code = "ENOENT"
    throw missing
  }
  return data.text()
}
