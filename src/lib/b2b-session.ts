import { cookies } from "next/headers"

const COOKIE = "b2b_session"
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export async function openB2bSession(subscriberId: string) {
  const token = await createToken(subscriberId)
  if (!token) return false
  const jar = await cookies()
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
  return true
}

export async function hasB2bSession(subscriberId: string) {
  const token = (await cookies()).get(COOKIE)?.value
  const session = await readToken(token)
  return session?.subscriberId === subscriberId
}

async function createToken(subscriberId: string) {
  const secret = sessionSecret()
  if (!secret) return null
  const payload = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        role: "b2b",
        subscriberId,
        exp: Date.now() + MAX_AGE_SECONDS * 1000,
      }),
    ),
  )
  return `${payload}.${await sign(secret, payload)}`
}

async function readToken(token: string | undefined) {
  if (!token) return null
  const secret = sessionSecret()
  if (!secret) return null
  const dot = token.indexOf(".")
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return null
  const payload = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  if (!(await signaturesMatch(signature, await sign(secret, payload)))) return null
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)))
    if (!parsed || typeof parsed !== "object") return null
    const role = "role" in parsed ? parsed.role : null
    const subscriberId = "subscriberId" in parsed ? parsed.subscriberId : null
    const exp = "exp" in parsed ? parsed.exp : null
    if (role !== "b2b" || typeof subscriberId !== "string" || typeof exp !== "number") return null
    if (exp <= Date.now()) return null
    return { subscriberId }
  } catch {
    return null
  }
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) return null
  return secret
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

async function signaturesMatch(left: string, right: string) {
  const a = new TextEncoder().encode(left)
  const b = new TextEncoder().encode(right)
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
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
