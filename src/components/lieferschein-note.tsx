import type { PortalNoteLine } from "@/lib/b2b-portals"
import type { OrderVersion } from "@/lib/order-changes"
import { OrderHistory } from "@/components/order-history"

export function LieferscheinNote({
  number,
  customerName,
  address,
  dayLabel,
  lines,
  versions = [],
}: {
  number: string | null
  customerName: string
  address: string
  dayLabel: string
  lines: PortalNoteLine[]
  versions?: OrderVersion[]
}) {
  return (
    <article className="rounded-xl bg-white px-4 py-5 text-zinc-900 ring-1 ring-zinc-200 print:break-after-page print:rounded-none print:ring-0">
      <header>
        <div className="flex items-center justify-between gap-4">
          <img src="/brand/brotli.png" alt="Brötli" className="h-8 w-auto" />
          <h2 className="text-2xl font-semibold leading-none tracking-tight">
            Lieferschein{number == null ? "" : ` ${number}`}
          </h2>
        </div>
        <p className="mt-1 text-right text-sm leading-5">Lieferdatum: {dayLabel}</p>
      </header>
      <div className="mt-4 text-sm leading-5">
        <div className="font-semibold">{customerName}</div>
        {address ? <div>{address}</div> : null}
      </div>
      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="py-2 font-medium">Produkt</th>
            <th className="py-2 text-right font-medium">Menge</th>
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td className="py-2 text-zinc-500" colSpan={2}>
                Noch keine Menge eingetragen.
              </td>
            </tr>
          ) : null}
          {lines.map((line) => (
            <tr key={`${line.name}-${line.quantity}`} className="border-t">
              <td className="py-2 pr-3">{line.name}</td>
              <td className="py-2 text-right tabular-nums">{line.quantity}</td>
            </tr>
          ))}
          <tr className="border-t">
            <td className="py-2 pr-3">Lieferung</td>
            <td className="py-2 text-right tabular-nums">1</td>
          </tr>
        </tbody>
      </table>
      <div className="mt-3 flex justify-between border-t pt-3 font-semibold">
        <span>Stück</span>
        <span className="tabular-nums">{lines.reduce((sum, line) => sum + line.quantity, 0)}</span>
      </div>
      <p className="mt-3 text-sm text-zinc-500">Die Rechnung stellen wir alle zwei Wochen aus.</p>
      <OrderHistory versions={versions} />
    </article>
  )
}
