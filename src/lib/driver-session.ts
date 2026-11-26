export const DRIVER_COOKIE = "driver_session"

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export function driverSessionMaxAge() {
  return MAX_AGE_SECONDS
}

export function sameText(left: string, right: string) {
  const a = new TextEncoder().encode(left)
  const b = new TextEncoder().encode(right)
  const length = Math.max(a.length, b.length)
  let diff = a.length === b.length ? 0 : 1
  for (let i = 0; i < length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

export async function createDriverSessionToken() {
  const secret = sessionSecret()
  if (!secret) return null
  const payload = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ role: "driver", exp: Date.now() + MAX_AGE_SECONDS * 1000 }),
    ),
  )
  return `${payload}.${await sign(secret, payload)}`
}

export async function verifyDriverSession(token: string | undefined) {
  if (!token) return false
  const secret = sessionSecret()
  if (!secret) return false
  const dot = token.indexOf(".")
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return false
  const payload = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  if (!sameText(signature, await sign(secret, payload))) return false
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)))
    if (!parsed || typeof parsed !== "object") return false
    const role = "role" in parsed ? parsed.role : null
    const exp = "exp" in parsed ? parsed.exp : null
    return role === "driver" && typeof exp === "number" && exp > Date.now()
  } catch {
    return false
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
