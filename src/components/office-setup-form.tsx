"use client"

import { useActionState, useEffect } from "react"

import { confirmOfficeTotp } from "@/app/office/actions"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { markOfficeTab } from "@/lib/office-tab"
import { cn } from "cn"

export function OfficeSetupForm({ qr }: { qr: string }) {
  const [error, action, pending] = useActionState(confirmOfficeTotp, null)
  const signedIn = error === "signed-in"

  useEffect(() => {
    if (signedIn) window.location.assign("/dashboard")
  }, [signedIn])

  return (
    <form
      action={action}
      className="flex flex-col gap-4"
      onSubmit={() => {
        try {
          markOfficeTab()
        } catch {
          // Opening the admin over the plain network address must still send the code.
        }
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm">
        6 цифр из Google Authenticator
        <Input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          className="h-12 text-center text-2xl tracking-[0.3em]"
        />
      </label>
      {error && !signedIn ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}
        disabled={pending || signedIn}
      >
        {pending || signedIn ? "Проверяем…" : "Подтвердить"}
      </button>
      <img src={qr} alt="" className="mx-auto size-52 rounded-xl bg-white p-2" />
      <p className="text-center text-sm text-muted-foreground">
        Если записи в приложении ещё нет, отсканируйте код и введите новые 6 цифр.
      </p>
    </form>
  )
}
