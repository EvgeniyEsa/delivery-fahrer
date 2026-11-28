"use client"

import { useActionState } from "react"

import { loginB2b } from "@/app/order/login/actions"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "cn"

export function B2bLoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(loginB2b, null)

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1.5 text-sm">
        E-Mail
        <Input
          name="login"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          required
          className="h-12 text-base"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Passwort
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 text-base"
        />
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}
        disabled={pending}
      >
        {pending ? "…" : "Anmelden"}
      </button>
    </form>
  )
}
