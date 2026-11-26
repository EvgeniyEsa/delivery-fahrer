import nodemailer from "nodemailer"

import { formatEuro, formatInvoiceDate, invoiceTotals, type Invoice } from "@/lib/invoice-math"

const MAILBOX_MISSING = "Почтовый ящик для рассылки ещё не подключён."

export function invoiceLetter(invoice: Invoice) {
  const totals = invoiceTotals(invoice.lines)
  const lines = invoice.lines.map((line) => {
    const price = line.unitNet == null ? "—" : formatEuro(line.unitNet)
    const amount = line.amount == null ? "—" : formatEuro(line.amount)
    return `${line.name}: ${line.quantity} × ${price} = ${amount}`
  })
  return {
    subject: `Rechnung ${invoice.number}`,
    text: [
      `Guten Tag ${invoice.customerName},`,
      "",
      `anbei Ihre Rechnung ${invoice.number} für ${invoice.periodLabel}.`,
      "",
      ...lines,
      "",
      `Gesamt: ${formatEuro(totals.total)}`,
      `Bitte überweisen Sie den Betrag bis ${formatInvoiceDate(invoice.dueOn)}.`,
      "",
      "Bankverbindung: Evgenii Esaulko, Commerzbank",
      "IBAN DE10 3904 0013 0118 4407 00",
      "BIC COBADEFXXX",
      "",
      "Brötli",
      "Wolferskaul 4, 52078 Aachen",
      "info@broetli.com",
    ].join("\n"),
  }
}

export async function deliverInvoice(to: string, invoice: Invoice) {
  const host = process.env.SMTP_HOST?.trim()
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASSWORD
  const from = process.env.SMTP_FROM?.trim() || "Brötli <info@broetli.com>"
  const port = Number(process.env.SMTP_PORT || "465")
  if (!host || !user || !pass || !Number.isInteger(port)) {
    return { ok: false as const, error: MAILBOX_MISSING }
  }

  const letter = invoiceLetter(invoice)
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
  try {
    await transport.sendMail({ from, to, subject: letter.subject, text: letter.text })
    return { ok: true as const }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Письмо не ушло."
    return { ok: false as const, error: message }
  }
}
