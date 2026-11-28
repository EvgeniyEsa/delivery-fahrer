import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    template: "%s · Brötli",
    default: "Bestellung",
  },
  description: "Brötchenbestellung",
  manifest: "/order.webmanifest",
  openGraph: {
    siteName: "Brötli",
    description: "Brötchenbestellung",
  },
}

export default function OrderLayout({ children }: LayoutProps<"/order">) {
  return children
}
