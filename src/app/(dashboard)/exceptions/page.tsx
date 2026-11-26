import type { Metadata } from "next"

import { BAKERY_COLUMNS, closureRows } from "@/lib/bakery-closures"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "cn"

export const metadata: Metadata = {
  title: "Исключения",
}

export default function ExceptionsPage() {
  const rows = closureRows()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Исключения</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Выходные пекарен. Зелёная ячейка — пекарня работает. Красная — закрыта:
          клиентам с её товарами в этот день не везём. Дни повторяются каждый год.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Пекарни</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Дата</TableHead>
                {BAKERY_COLUMNS.map((bakery) => (
                  <TableHead key={bakery.code}>
                    <span className="block">{bakery.name}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {bakery.sheet}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="pl-4 font-medium">{row.label}</TableCell>
                  {BAKERY_COLUMNS.map((bakery) => {
                    const closed = row.closed.has(bakery.code)
                    return (
                      <TableCell key={bakery.code} className="p-1">
                        <span
                          className={cn(
                            "inline-flex min-w-24 rounded-md px-2 py-1 text-xs font-medium",
                            closed
                              ? "bg-red-100 text-red-900"
                              : "bg-green-100 text-green-900",
                          )}
                        >
                          {closed ? "закрыта" : "работает"}
                        </span>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
