import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Админка",
  manifest: "/office.webmanifest",
}

export default function OfficeLayout({ children }: LayoutProps<"/office">) {
  return children
}
