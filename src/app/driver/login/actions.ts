"use server"

import { redirect } from "next/navigation"

import { checkDriverCredentials, openDriverSession } from "@/lib/driver-auth"

export async function loginDriver(_state: string | null, formData: FormData) {
  const login = String(formData.get("login") ?? "")
  const password = String(formData.get("password") ?? "")
  const result = checkDriverCredentials(login, password)
  if (result === "missing") return "Вход водителя ещё не настроен"
  if (result !== "ok" || !(await openDriverSession())) return "Неверное имя или пароль"
  redirect("/driver")
}
