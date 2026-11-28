import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type MossClient = {
  id: string
  name: string
  lines: string
  changed: boolean
}

type MossDay = {
  day: string
  label: string
  clients: MossClient[]
}

export function MossOrderCard({
  summary,
  days,
}: {
  summary: string
  days: MossDay[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Заказ в Moss</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="max-w-3xl text-muted-foreground">{summary}</p>
        <ul className="grid gap-1 text-muted-foreground sm:grid-cols-2">
          <li>Понедельник — на среду</li>
          <li>Вторник — на четверг</li>
          <li>Среда — на пятницу</li>
          <li>Четверг — на субботу и воскресенье</li>
          <li>Пятница — на понедельник и вторник</li>
          <li>Суббота — на среду</li>
          <li>Воскресенье — на среду</li>
          <li>Заказ нужно внести до 11:45 в день отправки</li>
        </ul>
        {days.length === 0 ? (
          <p>Сегодня в Moss заказ для этих клиентов не отправляется.</p>
        ) : (
          days.map((day) => (
            <section key={day.day} className="flex flex-col gap-2">
              <h2 className="font-medium">{day.label}</h2>
              {day.clients.length === 0 ? (
                <p className="text-muted-foreground">На этот день доставок Moss нет.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {day.clients.map((client) => (
                    <li key={client.id}>
                      <span className="font-medium">{client.name}</span>
                      {client.changed ? (
                        <span className="text-muted-foreground"> · количество на это утро</span>
                      ) : null}
                      <span className="block text-muted-foreground">{client.lines}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))
        )}
      </CardContent>
    </Card>
  )
}
