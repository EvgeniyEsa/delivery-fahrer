const TAB_KEY = "office-tab"
const LIVE_KEY = "office-tabs"
const STALE_MS = 2_000

type LiveTabs = Record<string, number>

function readTabs(): LiveTabs {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LIVE_KEY) ?? "{}")
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => typeof entry[0] === "string" && typeof entry[1] === "number",
      ),
    )
  } catch {
    return {}
  }
}

function writeTabs(tabs: LiveTabs) {
  localStorage.setItem(LIVE_KEY, JSON.stringify(tabs))
}

function randomId() {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function freshTabs(now: number) {
  const tabs = readTabs()
  for (const [id, seen] of Object.entries(tabs)) {
    if (now - seen > STALE_MS) delete tabs[id]
  }
  return tabs
}

export function markOfficeTab() {
  const id = sessionStorage.getItem(TAB_KEY) ?? randomId()
  sessionStorage.setItem(TAB_KEY, id)
  const tabs = freshTabs(Date.now())
  tabs[id] = Date.now()
  writeTabs(tabs)
}

export function officeTabStillOpen() {
  const now = Date.now()
  const tabs = freshTabs(now)
  const current = sessionStorage.getItem(TAB_KEY)
  if (!current) {
    if (Object.keys(tabs).length === 0) {
      writeTabs(tabs)
      return false
    }
    const id = randomId()
    sessionStorage.setItem(TAB_KEY, id)
    tabs[id] = now
    writeTabs(tabs)
    return true
  }
  tabs[current] = now
  writeTabs(tabs)
  return true
}

export function releaseOfficeTab() {
  const id = sessionStorage.getItem(TAB_KEY)
  if (!id) return
  const tabs = readTabs()
  delete tabs[id]
  writeTabs(tabs)
}
