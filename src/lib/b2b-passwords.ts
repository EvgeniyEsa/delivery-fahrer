import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { hasB2bSession } from "@/lib/b2b-session"

const FILE = path.join(process.cwd(), "data", "b2b-passwords.json")

export type B2bPasswordRecord = {
  subscriberId: string
  login: string
  salt: string
  hash: string
  password: string
  updatedAt: string
}

type Store = Record<string, B2bPasswordRecord>

export async function listB2bPasswords() {
  return readStore()
}

export async function b2bPasswordFor(subscriberId: string) {
  const store = await readStore()
  return store[subscriberId] ?? null
}

export async function portalSessionMatches(subscriberId: string) {
  const record = await b2bPasswordFor(subscriberId)
  if (!record) return true
  return hasB2bSession(subscriberId)
}

export async function saveB2bPassword(input: {
  subscriberId: string
  login: string
  password: string
}) {
  const login = normalizeLogin(input.login)
  if (!login) return { ok: false as const, error: "Укажите почту для входа целиком, с @ и доменом." }
  const password = input.password
  const store = await readStore()
  const current = store[input.subscriberId]
  if (!password && !current) {
    return { ok: false as const, error: "Придумайте пароль. Минимум 8 знаков." }
  }
  if (password && password.length < 8) {
    return { ok: false as const, error: "Пароль должен быть не короче 8 знаков." }
  }
  const duplicate = Object.values(store).find(
    (record) => record.subscriberId !== input.subscriberId && record.login === login,
  )
  if (duplicate) return { ok: false as const, error: "Эта почта уже используется для другого клиента." }

  const next = password
    ? { ...hashPassword(password), password }
    : { salt: current?.salt ?? "", hash: current?.hash ?? "", password: current?.password ?? "" }
  store[input.subscriberId] = {
    subscriberId: input.subscriberId,
    login,
    salt: next.salt,
    hash: next.hash,
    password: next.password,
    updatedAt: new Date().toISOString(),
  }
  const written = await writeStore(store)
  if (!written) return { ok: false as const, error: "Не удалось сохранить пароль." }
  return { ok: true as const, login, passwordSet: Boolean(password || current) }
}

export async function clearB2bPassword(subscriberId: string) {
  const store = await readStore()
  delete store[subscriberId]
  const written = await writeStore(store)
  if (!written) return { ok: false as const, error: "Не удалось убрать пароль." }
  return { ok: true as const }
}

export async function verifyB2bLogin(login: string, password: string) {
  const normalized = normalizeLogin(login)
  if (!normalized || !password) return null
  const store = await readStore()
  const record = Object.values(store).find((item) => item.login === normalized)
  if (!record) return null
  return verifyPassword(password, record.salt, record.hash) ? record : null
}

function normalizeLogin(value: string) {
  const login = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login)) return ""
  return login
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url")
  const hash = scryptSync(password, salt, 32).toString("base64url")
  return { salt, hash }
}

function verifyPassword(password: string, salt: string, hash: string) {
  const actual = scryptSync(password, salt, 32)
  const expected = Buffer.from(hash, "base64url")
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

async function readStore(): Promise<Store> {
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8")) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([subscriberId, value]) => {
        if (!value || typeof value !== "object") return []
        const record = value as Partial<B2bPasswordRecord>
        const login = typeof record.login === "string" ? record.login : ""
        const salt = typeof record.salt === "string" ? record.salt : ""
        const hash = typeof record.hash === "string" ? record.hash : ""
        const password = typeof record.password === "string" ? record.password : ""
        const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : ""
        if (!login || !salt || !hash) return []
        return [[subscriberId, { subscriberId, login, salt, hash, password, updatedAt }]]
      }),
    )
  } catch {
    return {}
  }
}

async function writeStore(store: Store) {
  try {
    await mkdir(path.dirname(FILE), { recursive: true })
    await writeFile(FILE, `${JSON.stringify(store, null, 2)}\n`)
    return true
  } catch {
    return false
  }
}
