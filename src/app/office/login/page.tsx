import { connection } from "next/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import QRCode from "qrcode"

import { OfficeLoginForm } from "@/components/office-login-form"
import { officeIsProtected, readOfficeAuth } from "@/lib/office-store"
import { hasOfficeSession } from "@/lib/office-session"
import { totpAuthUrl } from "@/lib/totp"

export default function OfficeLoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Suspense fallback={<p className="text-muted-foreground">Проверяем вход…</p>}>
        <Login />
      </Suspense>
    </main>
  )
}

async function Login() {
  await connection()
  const record = await readOfficeAuth()
  if (!record || !officeIsProtected(record)) redirect("/office/setup")
  if (await hasOfficeSession()) redirect("/dashboard")
  const qr = await QRCode.toDataURL(totpAuthUrl(record.totpSecret), { margin: 1, width: 240 })
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Админка</h1>
        <p className="text-sm text-muted-foreground">
          Введите 6 цифр из Google Authenticator. Если код не подходит, нажмите плюс и отсканируйте
          этот код ещё раз. Вводите цифры из новой записи, старую можно не удалять.
        </p>
      </div>
      <OfficeLoginForm qr={qr} />
    </>
  )
}
