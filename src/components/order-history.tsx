import { LieferscheinDownload } from "@/components/lieferschein-download"
import type { OrderVersion } from "@/lib/order-changes"
import { diffOrderLines, formatOrderClock } from "@/lib/order-changes"

export function OrderHistory({ versions }: { versions: OrderVersion[] }) {
  if (versions.length === 0) return null
  const [first, ...changes] = versions
  if (!first) return null

  return (
    <section className="mt-4 border-t pt-3 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <span>{first.at ? `Bestellt um ${formatOrderClock(first.at)} Uhr` : "Bestellt"}</span>
        <LieferscheinDownload />
      </p>
      {changes.map((version, index) => {
        const previous = versions[index]
        if (!previous || !version.at) return null
        const rows = diffOrderLines(previous.lines, version.lines)
        return (
          <div key={version.at} className="mt-3">
            <p className="font-medium">Geändert um {formatOrderClock(version.at)} Uhr</p>
            <ul className="mt-1 text-zinc-700">
              {rows.map((row) => (
                <li key={row.name}>
                  {row.name}: {row.from} → {row.to}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
