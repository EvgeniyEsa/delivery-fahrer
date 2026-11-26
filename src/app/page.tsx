import Link from "next/link"

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Link
        href="/dashboard"
        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        Перейти в панель управления
      </Link>
    </main>
  )
}
