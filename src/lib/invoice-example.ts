import type { Invoice } from "@/lib/invoice-math"

// The Rechnung the bakery already sent: R25-1607, 16–30 September 2026.
export const EXAMPLE_INVOICE: Invoice = {
  id: "r25-1607",
  number: "R25-1607",
  issuedOn: "2026-09-30",
  dueOn: "2026-10-07",
  periodFrom: "2026-09-16",
  periodTo: "2026-09-30",
  periodLabel: "16.09. - 30.09.2026",
  customerName: "B&B Hotels Germany GmbH",
  customerLines: ["Altkönigstr 10", "65239 Hochheim am Main", "NRW Deutschland"],
  lines: [
    { name: "Brötchen", quantity: 374, unitNet: 0.446, tax: 11.68, amount: 166.8 },
    { name: "Roggenbrötchen", quantity: 149, unitNet: 0.558, tax: 5.82, amount: 83.14 },
    {
      name: "Weltmeisterbrötchen Heidbüchel",
      quantity: 143,
      unitNet: 0.837,
      tax: 8.38,
      amount: 119.69,
    },
    { name: "Mohnbrötchen", quantity: 155, unitNet: 0.605, tax: 6.56, amount: 93.78 },
    { name: "Sonnenblümenbrot 500g", quantity: 14, unitNet: 3.255, tax: 3.19, amount: 45.57 },
    { name: "Versand", quantity: 15, unitNet: 1.488, tax: 1.56, amount: 22.32 },
  ],
  comment: "",
  source: "example",
  taxMode: "separate",
}
