"use server"

import { revalidatePath } from "next/cache"

import { clearB2bPassword, saveB2bPassword } from "@/lib/b2b-passwords"
import { listSubscribers } from "@/lib/subscribers"
import { requireOfficeSession } from "@/lib/office-session"

export type PasswordState = { ok: true; message: string } | { ok: false; error: string } | null

export async function saveB2bAccess(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  await requireOfficeSession()
  const subscriberId = String(formData.get("subscriberId") ?? "").trim()
  const subscribers = await listSubscribers()
  const subscriber = subscribers.find((item) => item.id === subscriberId && item.segment === "b2b" && !item.archivedAt)
  if (!subscriber) return { ok: false, error: "Клиент не найден." }

  const result = await saveB2bPassword({
    subscriberId,
    login: String(formData.get("login") ?? ""),
    password: String(formData.get("password") ?? ""),
  })
  if (!result.ok) return result

  revalidatePath("/b2b-access")
  return {
    ok: true,
    message: String(formData.get("password") ?? "").trim()
      ? `Пароль для ${subscriber.name} сохранён. Передайте его клиенту.`
      : `Почта для ${subscriber.name} обновлена.`,
  }
}

export async function removeB2bAccess(
  _previous: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  await requireOfficeSession()
  const subscriberId = String(formData.get("subscriberId") ?? "").trim()
  const result = await clearB2bPassword(subscriberId)
  if (!result.ok) return result
  revalidatePath("/b2b-access")
  return { ok: true, message: "Пароль убран. Ссылка снова открывается без входа." }
}
