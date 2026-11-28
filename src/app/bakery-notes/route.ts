import { readBakeryNote } from "@/lib/bakery-notes"

export async function GET(request: Request) {
  const notePath = new URL(request.url).searchParams.get("path") ?? ""
  const bytes = await readBakeryNote(notePath)
  if (!bytes) return new Response("Фото не найдено", { status: 404 })

  return new Response(Buffer.from(bytes), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "private, max-age=86400",
    },
  })
}
