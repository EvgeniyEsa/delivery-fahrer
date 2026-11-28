"use client"

import { useActionState, useEffect } from "react"

import { loginOfficeWithCode } from "@/app/office/actions"
import { buttonVariants } from "@/components/ui/button"
import { markOfficeTab } from "@/lib/office-tab"
import { cn } from "cn"

export function OfficeLoginForm({ qr }: { qr: string }) {
  const [error, action, pending] = useActionState(loginOfficeWithCode, null)
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
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          className="h-12 w-full rounded-lg border border-input bg-transparent px-2.5 text-center text-2xl tracking-[0.3em] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>
      {error && !signedIn ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}
        disabled={pending || signedIn}
      >
        {pending || signedIn ? "Проверяем…" : "Войти"}
      </button>
      <img src={qr} alt="" className="mx-auto size-52 rounded-xl bg-white p-2" />
    </form>
  )
}
