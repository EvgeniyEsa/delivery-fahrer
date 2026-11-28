export function parseShopifyDeliveryDate(
  attributes: Array<{ key?: string | null; value?: string | null }>,
): string | null {
  const term = attributes
    .find((attribute) => attribute.key === "Liefertermin")
    ?.value?.trim()

  const slash = term?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (slash) {
    const [, day, month, year] = slash
    return toIsoDate(year, month, day)
  }

  const firstLine = attributes
    .find((attribute) => attribute.key === "DeliveryData")
    ?.value?.split("\n")[0]
    ?.trim()
  const dotted = firstLine?.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (dotted) {
    const [, day, month, year] = dotted
    return toIsoDate(year, month, day)
  }

  return null
}

const WEEKDAYS = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
]
const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
]

export function formatDeliveryDay(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return isoDate

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  const monthName = MONTHS[month - 1]
  if (!weekday || !monthName) return isoDate

  return `${weekday}, ${day} ${monthName}`
}

const SHORT_WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"]
const SHORT_MONTHS = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
]

export function formatDeliverySchedule(dates: string[]) {
  const parsed = dates
    .flatMap((iso) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
      if (!match) return []
      const year = Number(match[1])
      const month = Number(match[2])
      const day = Number(match[3])
      return [
        {
          time: Date.UTC(year, month - 1, day),
          weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
          label: `${day} ${SHORT_MONTHS[month - 1] ?? ""}`,
        },
      ]
    })
    .sort((left, right) => left.time - right.time)

  if (parsed.length === 0) return "—"
  const first = parsed[0]
  const last = parsed[parsed.length - 1]
  if (!first || !last) return "—"
  if (parsed.length === 1) return first.label

  const groups = new Map<number, number[]>()
  for (const date of parsed) {
    const times = groups.get(date.weekday) ?? []
    times.push(date.time)
    groups.set(date.weekday, times)
  }
  const weekly = [...groups.values()].every((times) =>
    times.every((time, index) => index === 0 || time - (times[index - 1] ?? time) === 604_800_000),
  )

  if (weekly && groups.size === 7) {
    return `каждый день · ${first.label} — ${last.label}`
  }

  if (weekly) {
    const days = [...groups.keys()]
      .sort((left, right) => ((left + 6) % 7) - ((right + 6) % 7))
      .map((weekday) => SHORT_WEEKDAYS[weekday])
      .filter(Boolean)
      .join(", ")
    return `каждый ${days} · ${first.label} — ${last.label}`
  }

  if (parsed.length <= 4) return parsed.map((date) => date.label).join(", ")
  return `${parsed.length} дат · ${first.label} — ${last.label}`
}

export function formatDriverDay(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return isoDate
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date)
}

export function formatDriverTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function formatDeliveredAt(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function todayInBerlin() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
  }).format(new Date())
}

export function addDays(isoDate: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return isoDate
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function driverDayBounds(today: string) {
  return { min: addDays(today, -1), max: addDays(today, 7) }
}

export function clampDriverDay(requested: string | undefined, today: string) {
  const { min, max } = driverDayBounds(today)
  if (!requested || !/^\d{4}-\d{2}-\d{2}$/.test(requested)) return today
  if (requested < min) return min
  if (requested > max) return max
  return requested
}

function toIsoDate(year: string | undefined, month: string | undefined, day: string | undefined) {
  if (!year || !month || !day) return null
  const fullYear = year.length === 2 ? `20${year}` : year
  const iso = `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  const parsed = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return iso
}
