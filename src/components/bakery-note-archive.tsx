import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { listBakeryNotes, type BakeryNote } from "@/lib/bakery-notes"
import { formatDeliveryDay } from "@/lib/delivery-date"
import type { DriverBakery } from "@/lib/product-photos"

const ORDER: DriverBakery[] = ["Heidbüchel", "Moss", "Kockartz"]
const LABEL: Record<DriverBakery, string> = {
  Heidbüchel: "Хайбюхель",
  Moss: "Мосс",
  Kockartz: "Кокарц",
}

export async function BakeryNoteArchive() {
  const notes = await listBakeryNotes()
  const days = [...new Set(notes.map((note) => note.day))].sort().reverse()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Фото накладных</CardTitle>
        <CardDescription>
          Снимки водителя для бухгалтерии. Новый снимок — когда накладную дописали от руки.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока нет фото накладных.</p>
        ) : (
          days.map((day) => (
            <section key={day} className="flex flex-col gap-3">
              <h2 className="text-sm font-medium">{formatDeliveryDay(day)}</h2>
              {ORDER.map((bakery) => {
                const photos = notes.filter((note) => note.day === day && note.bakery === bakery)
                if (photos.length === 0) return null
                return <NoteRow key={bakery} bakery={bakery} photos={photos} />
              })}
            </section>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function NoteRow({ bakery, photos }: { bakery: DriverBakery; photos: BakeryNote[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{LABEL[bakery]}</p>
      <div className="flex gap-2 overflow-x-auto">
        {photos.map((note) => (
          <a
            key={note.src}
            href={note.src}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-28 shrink-0"
          >
            <img
              src={note.src}
              alt={`${LABEL[bakery]}, ${note.label}`}
              className="h-28 w-28 rounded-md object-cover ring-1 ring-foreground/10"
            />
            <span className="mt-1 block text-xs text-muted-foreground">{note.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
