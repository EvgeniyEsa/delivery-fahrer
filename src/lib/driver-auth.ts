import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import {
  DRIVER_COOKIE,
  createDriverSessionToken,
  driverSessionMaxAge,
  sameText,
  verifyDriverSession,
} from "@/lib/driver-session"

export async function requireDriverSession() {
  const token = (await cookies()).get(DRIVER_COOKIE)?.value
  if (!(await verifyDriverSession(token))) redirect("/driver/login")
}

export function checkDriverCredentials(login: string, password: string) {
  const expectedLogin = process.env.DRIVER_LOGIN?.trim() ?? ""
  const expectedPassword = process.env.DRIVER_PASSWORD ?? ""
  if (!expectedLogin || !expectedPassword || !process.env.SESSION_SECRET) return "missing" as const
  const loginOk = sameText(login.trim(), expectedLogin)
  const passwordOk = sameText(password, expectedPassword)
  return loginOk && passwordOk ? ("ok" as const) : ("invalid" as const)
}

export async function openDriverSession() {
  const token = await createDriverSessionToken()
  if (!token) return false
  const jar = await cookies()
  jar.set(DRIVER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: driverSessionMaxAge(),
  })
  return true
}

export async function closeDriverSession() {
  const jar = await cookies()
  jar.set(DRIVER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
}
