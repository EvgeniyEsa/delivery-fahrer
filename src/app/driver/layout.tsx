import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Fahrer",
  manifest: "/driver.webmanifest",
}

export default function DriverLayout({ children }: LayoutProps<"/driver">) {
  return children
}
