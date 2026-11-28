import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { officeIsProtected, readOfficeAuth } from "@/lib/office-store"

export const OFFICE_COOKIE = "office_session"
const MAX_AGE_SECONDS = 60 * 60 * 12

export async function hasOfficeSession() {
  const token = (await cookies()).get(OFFICE_COOKIE)?.value
  return verifyOfficeToken(token)
}

export async function requireOfficeSession() {
  const record = await readOfficeAuth()
  if (!officeIsProtected(record)) redirect("/office/setup")
  if (!(await hasOfficeSession())) redirect("/office/login")
}

export async function openOfficeSession() {
  const token = await createOfficeToken()
  if (!token) return false
  const jar = await cookies()
  jar.set(OFFICE_COOKIE, token, cookieOptions())
  return true
}

export async function closeOfficeSession() {
  const jar = await cookies()
  jar.set(OFFICE_COOKIE, "", cookieOptions(0))
}

async function createOfficeToken() {
  return signPayload({ role: "office", exp: Date.now() + MAX_AGE_SECONDS * 1000 })
}

async function verifyOfficeToken(token: string | undefined) {
  const payload = await readPayload(token)
  return payload?.role === "office"
}

async function signPayload(payload: Record<string, unknown>) {
  const secret = sessionSecret()
  if (!secret) return null
  const body = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  return `${body}.${await sign(secret, body)}`
}

async function readPayload(token: string | undefined) {
  if (!token) return null
  const secret = sessionSecret()
  if (!secret) return null
  const dot = token.indexOf(".")
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null
  const body = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  if (!sameText(signature, await sign(secret, body))) return null
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body)))
    if (!parsed || typeof parsed !== "object") return null
    const exp = "exp" in parsed ? parsed.exp : null
    if (typeof exp !== "number" || exp <= Date.now()) return null
    return parsed as { role?: string; challenge?: string; kind?: string; exp: number }
  } catch {
    return null
  }
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) return null
  return secret
}

function cookieOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(maxAge === undefined ? {} : { maxAge }),
  }
}

async function sign(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))
  return bytesToBase64Url(new Uint8Array(signature))
}

function sameText(left: string, right: string) {
  const a = new TextEncoder().encode(left)
  const b = new TextEncoder().encode(right)
  const length = Math.max(a.length, b.length)
  let diff = a.length === b.length ? 0 : 1
  for (let i = 0; i < length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "")
}

function base64UrlToBytes(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/")
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
