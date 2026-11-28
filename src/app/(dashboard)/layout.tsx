import type { Metadata } from "next"
import { connection } from "next/server"
import { Suspense } from "react"

export const metadata: Metadata = {
  manifest: "/office.webmanifest",
}

import { logoutOffice } from "@/app/office/actions"
import { OfficeTabGate } from "@/components/office-tab-gate"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { requireOfficeSession } from "@/lib/office-session"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <Suspense fallback={<p className="p-6 text-muted-foreground">Проверяем вход…</p>}>
      <GuardedOffice>{children}</GuardedOffice>
    </Suspense>
  )
}

async function GuardedOffice({ children }: { children: React.ReactNode }) {
  await connection()
  await requireOfficeSession()
  return (
    <OfficeTabGate>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
              <SidebarTrigger />
              <form action={logoutOffice} className="ml-auto">
                <button type="submit" className="text-sm text-muted-foreground">
                  Выйти
                </button>
              </form>
            </header>
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </OfficeTabGate>
  )
}
