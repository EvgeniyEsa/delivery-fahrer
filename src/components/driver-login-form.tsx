"use client"

import { useActionState } from "react"

import { loginDriver } from "@/app/driver/login/actions"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "cn"

export function DriverLoginForm() {
  const [error, action, pending] = useActionState(loginDriver, null)

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Имя
        <Input
          name="login"
          autoComplete="username"
          autoCapitalize="none"
          required
          className="h-12 text-base"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Пароль
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
        {pending ? "…" : "Войти"}
      </button>
    </form>
  )
}
