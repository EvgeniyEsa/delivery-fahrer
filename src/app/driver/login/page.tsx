import type { Metadata } from "next"

import { DriverLoginForm } from "@/components/driver-login-form"

export const metadata: Metadata = {
  title: "Anmeldung",
}

export default function DriverLoginPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">Delivery Manager</p>
        <h1 className="text-3xl font-semibold tracking-tight">Anmeldung für den Fahrer</h1>
      </header>
      <DriverLoginForm />
    </main>
  )
}
