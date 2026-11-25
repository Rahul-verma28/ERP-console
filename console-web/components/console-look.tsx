"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react"
import { useAuth } from "@/lib/auth"
import { applyBranding, type BrandLook } from "@/lib/theme"
import { cn } from "@/lib/utils"

// The Console's look (Settings › Appearance) for everyone in it. Light, dark or the device's
// setting is each person's own choice, kept on their device.

export function ConsoleLook() {
  const { me } = useAuth()
  const { brandColor, preset, font, density } = me?.appearance ?? {}
  React.useEffect(() => {
    if (!brandColor) return applyBranding(null)
    applyBranding({ brandColor, preset, font: font ?? "inter", density: density ?? "comfortable" })
    return () => applyBranding(null)
  }, [brandColor, preset, font, density])
  return null
}

/** Shows a look while it is being chosen; the saved one comes back when the page closes. */
export function useLookPreview(look: BrandLook | null) {
  const { me } = useAuth()
  const saved = React.useRef<BrandLook | null>(null)
  React.useEffect(() => {
    saved.current = me?.appearance ?? null
  })
  const { brandColor, preset, font, density } = look ?? {}
  React.useEffect(() => {
    if (!brandColor) return
    applyBranding({ brandColor, preset, font: font ?? "inter", density: density ?? "comfortable" })
    return () => applyBranding(saved.current)
  }, [brandColor, preset, font, density])
}

const MODES: { key: "light" | "dark" | "system"; label: string; icon: LucideIcon }[] = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "System", icon: Monitor },
]

/** Top bar: light, dark or the device's setting */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme()
  const current = (theme ?? "system") as (typeof MODES)[number]["key"]
  const now = MODES.find((m) => m.key === current) ?? MODES[2]
  const after = MODES[(MODES.indexOf(now) + 1) % MODES.length]
  return (
    <>
      <button type="button" onClick={() => setTheme(after.key)} aria-label={`Theme: ${now.label}. Switch to ${after.label}`} title={`Theme: ${now.label}`} className="grid size-9 place-items-center rounded-lg hover:bg-muted sm:hidden">
        <now.icon className="size-[18px]" />
      </button>
      <div role="radiogroup" aria-label="Theme" className="hidden items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5 sm:flex">
        {MODES.map((m) => (
          <button key={m.key} type="button" role="radio" aria-checked={current === m.key} aria-label={m.label} title={m.label} onClick={() => setTheme(m.key)} className={cn("grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground", current === m.key && "bg-card text-foreground shadow-sm")}>
            <m.icon className="size-3.5" />
          </button>
        ))}
      </div>
    </>
  )
}
