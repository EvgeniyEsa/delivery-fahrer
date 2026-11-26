import Link from "next/link"

// Главная ведёт в панель. Отдельный коммит, чтобы Vercel пересобрал проект.
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
