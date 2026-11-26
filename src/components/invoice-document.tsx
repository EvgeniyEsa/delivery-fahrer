import {
  formatEuro,
  formatInvoiceDate,
  invoiceTotals,
  type Invoice,
  type InvoiceLine,
} from "@/lib/invoice-math"

const SELLER = [
  "Brötli",
  "Wolferskaul 4",
  "52078 Aachen",
  "NRW Deutschland",
  "DE VAT DE329269618",
]

const COMPANY = [
  "Evgenii Esaulko",
  "Wolferskaul 4, 52078 Aachen",
  "NRW Deutschland",
  "USt-IdNr. DE329269618",
  "info@broetli.com",
  "+49 241 95 87 4000",
]

export function InvoiceDocument({ invoice }: { invoice: Invoice }) {
  const totals = invoiceTotals(invoice.lines)

  return (
    <article
      id="rechnung"
      className="mx-auto w-full max-w-[52rem] bg-white px-5 py-8 text-zinc-900 shadow-sm ring-1 ring-zinc-200 sm:px-12 sm:py-10 print:max-w-none print:shadow-none print:ring-0"
    >
      <header className="flex items-start justify-between gap-6">
        <img src="/brand/brotli.png" alt="Brötli" className="h-14 w-auto" />
        <h2 className="text-4xl font-bold tracking-tight">Rechnung</h2>
      </header>

      <div className="mt-8 text-sm leading-5">
        {SELLER.map((line, index) => (
          <div key={line} className={index === 0 ? "font-semibold" : undefined}>
            {line}
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 text-sm sm:grid-cols-2">
        <div className="leading-5">
          <div className="font-semibold">Rechnung an</div>
          <div>{invoice.customerName}</div>
          {invoice.customerLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:justify-self-end">
          <dt className="font-semibold">Rechnungsnummer</dt>
          <dd>{invoice.number}</dd>
          <dt className="font-semibold">Rechnungsdatum</dt>
          <dd>{formatInvoiceDate(invoice.issuedOn)}</dd>
          <dt className="font-semibold">Fälligkeitsdatum</dt>
          <dd>{formatInvoiceDate(invoice.dueOn)}</dd>
          <dt className="font-semibold">Liefertermine</dt>
          <dd>{invoice.periodLabel}</dd>
        </dl>
      </div>

      <div className="mt-8 flex items-baseline justify-between border-t border-zinc-900 pt-2 text-sm">
        <span className="font-semibold">Gesamt</span>
        <span className="font-semibold tabular-nums">{formatEuro(totals.total)}</span>
      </div>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-zinc-100 text-left text-[11px] tracking-wide text-zinc-600">
            <th className="px-3 py-2 font-medium">PRODUKTE & DIENSTLEISTUNGEN</th>
            <th className="px-3 py-2 text-right font-medium">MENGE</th>
            <th className="px-3 py-2 text-right font-medium">EINZELPREIS</th>
            <th className="px-3 py-2 text-right font-medium">BETRAG</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, index) => (
            <tr key={`${line.name}-${index}`} className="border-b border-zinc-200">
              <td className="px-3 py-3 whitespace-normal">{line.name}</td>
              <td className="px-3 py-3 text-right tabular-nums">{line.quantity}</td>
              <td className="px-3 py-3 text-right tabular-nums">{money(line.unitNet, 2)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{money(line.amount, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 ml-auto w-full max-w-xs border border-zinc-300 text-sm">
        <TotalRow label="Gesamt" value={formatEuro(totals.total)} bold />
      </div>

      <footer className="mt-12 border-t border-zinc-200 pt-4 text-xs leading-5 text-zinc-600">
        <div className="font-semibold text-zinc-900">Brötli</div>
        {COMPANY.map((line) => (
          <div key={line}>{line}</div>
        ))}
        <div className="mt-3 font-semibold text-zinc-900">Bankverbindung</div>
        <div>Evgenii Esaulko, Commerzbank</div>
        <div>IBAN DE10 3904 0013 0118 4407 00</div>
        <div>BIC COBADEFXXX</div>
      </footer>
    </article>
  )
}

function TotalRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between gap-4 border-b border-zinc-300 px-3 py-2 last:border-b-0 ${bold ? "font-semibold" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

function money(value: InvoiceLine["amount"], digits: number) {
  if (value == null) return "—"
  return formatEuro(value, digits)
}
