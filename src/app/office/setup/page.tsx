import { connection } from "next/server"
import { Suspense } from "react"

import { officeSetupView } from "@/app/office/actions"
import { OfficeSetupForm } from "@/components/office-setup-form"

export default function OfficeSetupPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-10">
      <Suspense fallback={<p className="text-muted-foreground">Готовим защиту…</p>}>
        <Setup />
      </Suspense>
    </main>
  )
}

async function Setup() {
  await connection()
  const view = await officeSetupView()
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Защита админки</h1>
        <p className="text-sm text-muted-foreground">
          Введите 6 цифр из Google Authenticator. После этого админка откроется только с этим кодом.
        </p>
      </div>
      <OfficeSetupForm qr={view.qr} />
    </>
  )
}
