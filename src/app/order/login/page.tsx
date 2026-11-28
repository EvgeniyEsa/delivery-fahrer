import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

import { B2bLoginForm } from "@/components/b2b-login-form"

export const metadata: Metadata = {
  title: "Anmeldung",
}

export default function B2bLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-lg px-4 py-8">Anmeldung wird geladen…</main>}>
      <LoginBody searchParams={searchParams} />
    </Suspense>
  )
}

async function LoginBody({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  await connection()
  const next = (await searchParams).next ?? ""

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <img src="/brand/brotli.png" alt="Brötli" className="h-12 w-auto self-start" />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Anmeldung</h1>
        <p className="text-sm text-muted-foreground">E-Mail und Passwort von Brötli.</p>
      </header>
      <B2bLoginForm next={next} />
    </main>
  )
}
