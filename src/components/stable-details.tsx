"use client"

import { useRef, type ComponentProps, type PointerEvent } from "react"

export function StableDetails({ style, onPointerDown, ...props }: ComponentProps<"details">) {
  const lock = useRef(0)

  function hold(event: PointerEvent<HTMLDetailsElement>) {
    const summary = event.currentTarget.querySelector("summary")
    if (!summary || !(event.target instanceof Node) || !summary.contains(event.target)) return
    const top = summary.getBoundingClientRect().top
    const id = lock.current + 1
    lock.current = id
    let frames = 0
    const correct = () => {
      if (lock.current !== id) return
      const delta = summary.getBoundingClientRect().top - top
      if (Math.abs(delta) > 1) {
        const scroller = scrollingParent(summary)
        if (scroller) scroller.scrollTop += delta
        else window.scrollBy(0, delta)
      }
      frames += 1
      if (frames < 12) requestAnimationFrame(correct)
    }
    requestAnimationFrame(correct)
  }

  return (
    <details
      {...props}
      style={{ overflowAnchor: "none", ...style }}
      onPointerDown={(event) => {
        onPointerDown?.(event)
        hold(event)
      }}
    />
  )
}

function scrollingParent(node: HTMLElement) {
  let current = node.parentElement
  while (current && current !== document.body && current !== document.documentElement) {
    const style = getComputedStyle(current)
    if (
      /(auto|scroll|overlay)/.test(style.overflowY) &&
      current.scrollHeight > current.clientHeight + 1
    ) {
      return current
    }
    current = current.parentElement
  }
  return null
}
