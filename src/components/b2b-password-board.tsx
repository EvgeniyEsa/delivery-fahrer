"use client"

import { useActionState, useState } from "react"

import { removeB2bAccess, saveB2bAccess, type PasswordState } from "@/app/(dashboard)/b2b-access/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type B2bAccessClient = {
  id: string
  name: string
  address: string
  login: string
  password: string
  hasPassword: boolean
  href: string
}

export function B2bPasswordBoard({ clients }: { clients: B2bAccessClient[] }) {
  return (
    <div className="flex flex-col gap-4">
      {clients.map((client) => (
        <PasswordCard key={client.id} client={client} />
      ))}
    </div>
  )
}

function PasswordCard({ client }: { client: B2bAccessClient }) {
  const [state, save, pending] = useActionState(saveB2bAccess, null)
  const [login, setLogin] = useState(client.login)
  const [password, setPassword] = useState(client.password)
  const [copied, setCopied] = useState<"yes" | "no" | "">("")

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <form action={save} className="flex flex-col gap-3">
        <input type="hidden" name="subscriberId" value={client.id} />
        <div className="flex flex-col gap-1">
          <div className="font-medium">{client.name}</div>
          {client.address ? <div className="text-sm text-muted-foreground">{client.address}</div> : null}
          <div className="text-sm">{client.hasPassword ? "Пароль задан" : "Пароля ещё нет"}</div>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          Почта для входа
          <Input
            name="login"
            type="email"
            autoComplete="off"
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            className="h-11"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          Пароль
          <Input
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="off"
            className="h-11"
            placeholder={client.hasPassword ? "Оставьте пустым, чтобы не менять" : "Минимум 8 знаков"}
          />
        </label>
        {client.hasPassword && !client.password ? (
          <p className="text-sm text-muted-foreground">
            Этот пароль задан, но его текст раньше не сохранялся. Введите его ещё раз и нажмите «Сохранить», чтобы он остался на карточке.
          </p>
        ) : null}
        <a
          href={client.href}
          target="_blank"
          rel="noreferrer"
          className="break-all text-sm text-primary underline underline-offset-4"
        >
          {client.href}
        </a>
        {client.href.endsWith("/order/login") ? (
          <p className="text-sm text-muted-foreground">
            Страницы заказа нет. Почта и пароль подходят, но после входа открывать нечего.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => setPassword(createPassword())}>
            Сгенерировать
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (copyWithCommand(client.href)) {
                setCopied("yes")
                return
              }
              const writing = navigator.clipboard?.writeText(client.href)
              if (!writing) {
                setCopied("no")
                return
              }
              writing.then(
                () => setCopied("yes"),
                () => setCopied("no"),
              )
            }}
          >
            {copied === "yes" ? "Ссылка скопирована" : "Копировать ссылку"}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Сохраняю…" : "Сохранить"}
          </Button>
        </div>
        {copied === "no" ? <p className="text-sm text-destructive">Не удалось скопировать ссылку.</p> : null}
        <Status state={state} />
      </form>
      {client.hasPassword ? <RemoveButton subscriberId={client.id} /> : null}
    </div>
  )
}

function RemoveButton({ subscriberId }: { subscriberId: string }) {
  const [state, remove, pending] = useActionState(removeB2bAccess, null)

  return (
    <form action={remove}>
      <input type="hidden" name="subscriberId" value={subscriberId} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Убираю…" : "Убрать пароль"}
      </Button>
      <Status state={state} />
    </form>
  )
}

function Status({ state }: { state: PasswordState }) {
  if (!state) return null
  if (state.ok) return <p className="text-sm text-green-700">{state.message}</p>
  return <p className="text-sm text-destructive">{state.error}</p>
}

function createPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("")
}

function copyWithCommand(value: string) {
  const field = document.createElement("textarea")
  field.value = value
  field.setAttribute("readonly", "")
  field.style.position = "fixed"
  field.style.left = "-9999px"
  document.body.appendChild(field)
  field.focus()
  field.select()
  let copied = false
  try {
    copied = document.execCommand("copy")
  } catch {
    copied = false
  }
  field.remove()
  return copied
}
