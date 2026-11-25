"use client"

import * as React from "react"
import { Bookmark, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Saved views on a list: name the filters you use often and open them with one click. Each
// person keeps their own, in this browser.

export type Filters = Record<string, string>
interface View { id: string; name: string; filters: Filters }

const clean = (f: Filters) => Object.fromEntries(Object.entries(f).filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b)))
const same = (a: Filters, b: Filters) => JSON.stringify(clean(a)) === JSON.stringify(clean(b))

function read(key: string): View[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as View[]
  } catch {
    return []
  }
}

export function SavedViews({ storeKey, allLabel, current, onApply }: { storeKey: string; allLabel: string; current: Filters; onApply: (f: Filters) => void }) {
  const [views, setViews] = React.useState<View[]>([])
  const [loaded, setLoaded] = React.useState(false)
  if (!loaded && typeof window !== "undefined") {
    setLoaded(true)
    setViews(read(storeKey))
  }
  const [naming, setNaming] = React.useState(false)
  const [name, setName] = React.useState("")
  const active = views.find((v) => same(v.filters, current))
  const hasFilters = Object.keys(clean(current)).length > 0

  const save = (next: View[]) => {
    setViews(next)
    try {
      localStorage.setItem(storeKey, JSON.stringify(next))
    } catch {
      /* private window */
    }
  }
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    save([...views, { id: `v${Date.now().toString(36)}`, name: name.trim(), filters: clean(current) }])
    setNaming(false)
    setName("")
  }

  const chip = (on: boolean) => cn("inline-flex h-7 items-center rounded-full border text-[13px] transition-colors", on ? "border-primary bg-accent font-medium text-accent-foreground" : "bg-card hover:border-primary/40")
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Saved views">
      <Bookmark className="size-4 text-muted-foreground" aria-hidden />
      <button type="button" onClick={() => onApply({})} className={cn(chip(!hasFilters), "px-3")}>{allLabel}</button>
      {views.map((v) => (
        <span key={v.id} className={chip(active?.id === v.id)}>
          <button type="button" onClick={() => onApply(v.filters)} className="h-full pr-1 pl-3">{v.name}</button>
          <button type="button" onClick={() => save(views.filter((x) => x.id !== v.id))} className="mr-0.5 grid size-6 place-items-center rounded-full text-muted-foreground opacity-60 hover:opacity-100 focus-visible:opacity-100" aria-label={`Remove view ${v.name}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      {naming ? (
        <form onSubmit={add} className="flex items-center gap-1.5">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Name this view" className="h-7 w-44 text-[13px]" aria-label="View name" />
          <Button type="submit" size="sm" className="h-7" disabled={!name.trim()}>Save</Button>
          <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setNaming(false)}>Cancel</Button>
        </form>
      ) : (
        hasFilters && !active && views.length < 12 && (
          <Button type="button" size="sm" variant="ghost" className="h-7 text-[13px]" onClick={() => setNaming(true)}>
            <Plus /> Save this view
          </Button>
        )
      )}
    </div>
  )
}
