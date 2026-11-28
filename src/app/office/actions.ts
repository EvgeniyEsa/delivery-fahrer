"use server"

import { redirect } from "next/navigation"
import QRCode from "qrcode"

import { officeIsProtected, readOfficeAuth, writeOfficeAuth } from "@/lib/office-store"
import {
  closeOfficeSession,
  hasOfficeSession,
  openOfficeSession,
} from "@/lib/office-session"
import { createTotpSecret, totpAuthUrl, totpMatches } from "@/lib/totp"

export async function officeSetupView() {
  const record = await ensureSetupRecord()
  if (await hasOfficeSession() && officeIsProtected(record)) redirect("/dashboard")
  if (officeIsProtected(record)) redirect("/office/login")
  return {
    qr: await QRCode.toDataURL(totpAuthUrl(record.totpSecret), { margin: 1, width: 240 }),
  }
}

export async function confirmOfficeTotp(
  _previous: string | null,
  formData: FormData,
): Promise<string | null> {
  const record = await readOfficeAuth()
  if (!record || record.totpConfirmed) redirect("/office/login")
  if (!totpMatches(record.totpSecret, String(formData.get("code") ?? ""))) {
    return "Код не совпал. Введите текущие 6 цифр из Google Authenticator."
  }
  await writeOfficeAuth({ ...record, totpConfirmed: true })
  if (!(await openOfficeSession())) return "Сессия сервера не настроена."
  return "signed-in"
}

export async function loginOfficeWithCode(
  _previous: string | null,
  formData: FormData,
): Promise<string | null> {
  const record = await readOfficeAuth()
  if (!record) redirect("/office/setup")
  if (!totpMatches(record.totpSecret, String(formData.get("code") ?? ""))) {
    return "Код не совпал. Нажмите плюс в Google Authenticator, отсканируйте код на экране и введите 6 цифр из новой записи."
  }
  if (!record.totpConfirmed) await writeOfficeAuth({ ...record, totpConfirmed: true })
  if (!(await openOfficeSession())) return "Сессия сервера не настроена."
  return "signed-in"
}

export async function logoutOffice() {
  await closeOfficeSession()
  redirect("/office/login")
}

async function ensureSetupRecord() {
  const existing = await readOfficeAuth()
  if (existing) return existing
  const created = { totpSecret: createTotpSecret(), totpConfirmed: false }
  await writeOfficeAuth(created)
  return created
}
