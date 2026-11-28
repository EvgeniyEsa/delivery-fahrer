import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

export function createTotpSecret() {
  return base32Encode(randomBytes(20))
}

export function totpAuthUrl(secret: string) {
  // The colon stays literal. Encoding the whole label, especially with Cyrillic,
  // makes Google Authenticator import a different secret than the one on screen.
  const label = "Delivery%20Manager:office"
  const issuer = "Delivery%20Manager"
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}`
}

export function totpMatches(secret: string, code: string, now = Date.now()) {
  const entered = code.replace(/\s/g, "")
  if (!/^\d{6}$/.test(entered)) return false
  const key = base32Decode(secret)
  if (!key) return false
  const step = Math.floor(now / 30_000)
  const expected = Buffer.from(entered)
  for (let offset = -10; offset <= 10; offset++) {
    const counter = step + offset
    if (counter < 0) continue
    const candidate = Buffer.from(hotp(key, counter))
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) return true
  }
  return false
}

function hotp(key: Buffer, counter: number) {
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac("sha1", key).update(message).digest()
  const offset = digest[digest.length - 1]! & 0xf
  const binary = digest.readUInt32BE(offset) & 0x7fffffff
  return String(binary % 1_000_000).padStart(6, "0")
}

function base32Encode(bytes: Buffer) {
  let bits = 0
  let value = 0
  let output = ""
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31]
  return output
}

function base32Decode(secret: string) {
  const clean = secret.replace(/=+$/g, "").toUpperCase()
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of clean) {
    const index = ALPHABET.indexOf(char)
    if (index < 0) return null
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}
