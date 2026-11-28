"use server"

import { redirect } from "next/navigation"

import { checkDriverCredentials, openDriverSession } from "@/lib/driver-auth"

export async function loginDriver(_state: string | null, formData: FormData) {
  const login = String(formData.get("login") ?? "")
  const password = String(formData.get("password") ?? "")
  const result = checkDriverCredentials(login, password)
  if (result === "missing") return "Die Fahrer-Anmeldung ist noch nicht eingerichtet"
  if (result !== "ok" || !(await openDriverSession())) return "Name oder Passwort ist falsch"
  redirect("/driver")
}
