"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

export function DriverPhoto({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  if (!src || failed) {
    return <span className="block size-20 shrink-0 rounded-lg bg-black/5" aria-hidden />
  }

  return (
    <>
      <button
        type="button"
        className="shrink-0 rounded-lg"
        aria-label={`Открыть фото: ${name}`}
        onClick={() => setOpen(true)}
      >
        <img
          src={src}
          alt=""
          className="size-20 rounded-lg object-cover"
          onError={() => setFailed(true)}
        />
      </button>
      {open
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
              role="dialog"
              aria-modal="true"
              aria-label={name}
              onClick={() => setOpen(false)}
            >
              <img
                src={src}
                alt={name}
                className="max-h-[85vh] max-w-[90vw] rounded-lg bg-white object-contain"
                onClick={(event) => event.stopPropagation()}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
