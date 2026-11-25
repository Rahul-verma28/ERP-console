"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle, ArrowLeft, ArrowRight, Check, type LucideIcon } from "lucide-react"
import { industryName } from "@contracts/workspace"
import { Button } from "@/components/ui/button"
import { formatPaise } from "@/lib/format"
import type { SubStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

// The Console's building blocks — one look for the AHEAD team, vendors and partners: page header
// with the group as eyebrow, KPI cards, panels, tabs, status chips, empty and error states.

export const money = (paise: number) => formatPaise(paise, false)

// ── Page (the ERP's page header: 26 px bold title, one line under it, actions on the right) ──

export function Page({ title, subtitle, back, actions, children }: { title: React.ReactNode; subtitle?: React.ReactNode; back?: { href: string; label: string }; eyebrow?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div className="min-w-0">
          {back && (
            <Link href={back.href} className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" /> {back.label}
            </Link>
          )}
          <h1 className="text-[26px] leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  )
}

// ── Panel (the ERP's Section: a surface card with a title row) ──

export function Panel({ title, description, action, children, className, padded = true, id }: { title?: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; padded?: boolean; id?: string }) {
  return (
    <section id={id} className={cn("ui-surface min-w-0 scroll-mt-20 overflow-hidden", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-3.5">
          <div className="min-w-0">
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn(padded ? "p-5" : "py-1")}>{children}</div>
    </section>
  )
}

export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
      {children} <ArrowRight className="size-3.5" />
    </Link>
  )
}

// ── Numbers (the ERP's tinted cards) ──

const TINT: Record<string, string> = {
  blue: "from-blue-50 to-blue-100/60 border-blue-200 text-blue-700 dark:from-blue-500/10 dark:to-blue-500/5 dark:border-blue-500/25 dark:text-blue-300",
  emerald: "from-emerald-50 to-emerald-100/60 border-emerald-200 text-emerald-700 dark:from-emerald-500/10 dark:to-emerald-500/5 dark:border-emerald-500/25 dark:text-emerald-300",
  violet: "from-violet-50 to-violet-100/60 border-violet-200 text-violet-700 dark:from-violet-500/10 dark:to-violet-500/5 dark:border-violet-500/25 dark:text-violet-300",
  amber: "from-amber-50 to-amber-100/60 border-amber-200 text-amber-700 dark:from-amber-500/10 dark:to-amber-500/5 dark:border-amber-500/25 dark:text-amber-300",
  rose: "from-rose-50 to-rose-100/60 border-rose-200 text-rose-700 dark:from-rose-500/10 dark:to-rose-500/5 dark:border-rose-500/25 dark:text-rose-300",
}
const ORDER = ["blue", "emerald", "violet", "amber"]

export function Stat({ label, value, hint, href, icon: Icon, tone, color, index = 0 }: { label: string; value: React.ReactNode; hint?: React.ReactNode; href?: string; icon?: LucideIcon; tone?: "warn" | "good"; color?: string; index?: number }) {
  const c = color ?? (tone === "warn" ? "amber" : tone === "good" ? "emerald" : ORDER[index % ORDER.length])
  const body = (
    <>
      <div className="flex items-start justify-between gap-2"><p className="text-xs font-medium">{label}</p>{Icon && <Icon className="size-5 opacity-80" aria-hidden />}</div>
      <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {hint && <p className="text-[11px] opacity-80">{hint}</p>}
    </>
  )
  const cls = cn("grid min-w-0 gap-1 rounded-2xl border bg-gradient-to-br p-4 transition-shadow", TINT[c] ?? TINT.blue, href && "hover:shadow-md")
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 3 | 4 }) {
  // Cards without a colour take blue, emerald, violet, amber in turn
  const items = React.Children.toArray(children).map((ch, i) => (React.isValidElement<{ index?: number }>(ch) && ch.type === Stat ? React.cloneElement(ch, { index: i }) : ch))
  return <div className={cn("grid grid-cols-2 gap-3", cols === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>{items}</div>
}

export function StatSkeletons({ n = 4 }: { n?: number }) {
  return <>{Array.from({ length: n }, (_, i) => <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-muted" />)}</>
}

// ── Status chips ──

const TONE = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-600/15 dark:bg-emerald-950/60 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300",
  red: "bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-950/60 dark:text-red-300",
  blue: "bg-accent text-accent-foreground ring-primary/15",
  violet: "bg-violet-50 text-violet-800 ring-violet-600/15 dark:bg-violet-950/60 dark:text-violet-300",
  grey: "bg-muted text-foreground/75 ring-foreground/10",
} as const
const DOT = { green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500", blue: "bg-primary", violet: "bg-violet-500", grey: "bg-muted-foreground/60" } as const
export type Tone = keyof typeof TONE

export function Chip({ tone = "grey", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", TONE[tone], className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])} />
      {children}
    </span>
  )
}

/** A business's state in plain words: what it means for it today */
export const BUSINESS_STATUS: Record<SubStatus, { label: string; tone: Tone }> = {
  incomplete: { label: "Waiting for payment", tone: "amber" },
  trialing: { label: "Free trial", tone: "blue" },
  active: { label: "Paying", tone: "green" },
  past_due: { label: "Payment overdue", tone: "red" },
  free: { label: "Free plan", tone: "grey" },
  closed: { label: "Closed", tone: "grey" },
}

export function BusinessStatus({ status, suffix, partnerBilled }: { status: SubStatus; suffix?: string; partnerBilled?: boolean }) {
  // A partner's client doesn't pay AHEAD itself: it is simply live
  const s = partnerBilled && status === "active" ? { label: "Live", tone: "green" as Tone } : BUSINESS_STATUS[status]
  return (
    <Chip tone={s.tone}>
      {s.label}
      {suffix ? ` · ${suffix}` : ""}
    </Chip>
  )
}

/** The state with "Not signed in" first: nothing else matters until the owner signs in */
export function BusinessStateChip({ status, signedIn, trialEndsAt, partnerBilled }: { status: SubStatus; signedIn?: boolean; trialEndsAt?: string | null; partnerBilled?: boolean }) {
  if (signedIn === false && status !== "closed") return <Chip tone="red">Owner not signed in</Chip>
  let suffix: string | undefined
  if (status === "trialing" && trialEndsAt) {
    const d = daysFrom(trialEndsAt) ?? 0
    suffix = d <= 0 ? "ends today" : `${d} day${d === 1 ? "" : "s"} left`
  }
  return <BusinessStatus status={status} suffix={suffix} partnerBilled={partnerBilled} />
}

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending_approval: { label: "Needs approval", tone: "violet" },
  awaiting_payment: { label: "Awaiting payment", tone: "amber" },
  paid: { label: "Paid", tone: "green" },
  cancelled: { label: "Cancelled", tone: "grey" },
  expired: { label: "Expired", tone: "grey" },
}
export const PERSON_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "green" },
  invited: { label: "Invited", tone: "blue" },
  disabled: { label: "Inactive", tone: "grey" },
  paused: { label: "Inactive", tone: "grey" },
  new: { label: "New", tone: "blue" },
  approved: { label: "Approved", tone: "green" },
  rejected: { label: "Rejected", tone: "grey" },
}
export function StateChip({ map, value }: { map: Record<string, { label: string; tone: Tone }>; value: string }) {
  const s = map[value] ?? { label: value.replace(/_/g, " "), tone: "grey" as Tone }
  return <Chip tone={s.tone}>{s.label}</Chip>
}

/** How the business came to AHEAD; set automatically from who added it or whose code it used */
const ONBOARDED: Record<string, { label: string; tone: Tone }> = {
  website: { label: "Website", tone: "grey" },
  team: { label: "AHEAD team", tone: "green" },
  sales: { label: "Sales", tone: "blue" },
  vendor: { label: "Vendor", tone: "amber" },
  partner: { label: "Partner", tone: "violet" },
}
export function OnboardedChip({ kind, name }: { kind: string; name?: string | null }) {
  const o = ONBOARDED[kind] ?? ONBOARDED.website
  const text = name ? `${o.label} · ${name}` : o.label
  return (
    <Chip tone={o.tone} className="max-w-full">
      <span className="min-w-0 truncate" title={text}>{text}</span>
    </Chip>
  )
}

/** Link sent → Owner signed in → Setup finished → First payment */
export function ProgressSteps({ steps }: { steps: { label: string; done: boolean }[] }) {
  return (
    <ol className="grid gap-2 text-sm">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-2.5">
          <span className={cn("grid size-5 shrink-0 place-items-center rounded-full text-[11px]", s.done ? "bg-emerald-600 text-white" : "ring-1 ring-border ring-inset")}>{s.done ? <Check className="size-3" /> : ""}</span>
          <span className={s.done ? "" : "text-muted-foreground"}>{s.label}</span>
        </li>
      ))}
    </ol>
  )
}

// ── States ──

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="size-5" />
      </span>
      <p className="mt-1 text-[15px] font-semibold">{title}</p>
      {text && <div className="max-w-sm text-sm text-muted-foreground">{text}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Loading({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("grid gap-3", className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  )
}

export function Failed({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const status = (error as { status?: number }).status
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3 text-sm dark:border-red-900 dark:bg-red-950/30">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
      <div className="flex-1">
        <p className="font-medium">{status === 403 ? "Your role can’t open this" : "Couldn’t load this"}</p>
        <p className="text-muted-foreground">{error.message}</p>
      </div>
      {onRetry && status !== 403 && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

// ── Lists ──

/** A row with an icon, a title, a line of detail and something on the right */
export function Row({ icon: Icon, tone = "blue", title, detail, right, href }: { icon?: LucideIcon; tone?: Tone; title: React.ReactNode; detail?: React.ReactNode; right?: React.ReactNode; href?: string }) {
  const inner = (
    <>
      {Icon && (
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset", TONE[tone])}>
          <Icon className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {detail && <span className="block truncate text-[13px] text-muted-foreground">{detail}</span>}
      </span>
      {right && <span className="shrink-0">{right}</span>}
    </>
  )
  const cls = "flex min-w-0 items-center gap-3 rounded-xl px-2 py-2.5"
  return href ? (
    <Link href={href} className={cn(cls, "hover:bg-muted/70")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

/** Label / value pairs, read-only */
export function Facts({ items, className }: { items: ({ label: string; value: React.ReactNode } | false | null | undefined)[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-4 sm:grid-cols-2", className)}>
      {items.filter((i): i is { label: string; value: React.ReactNode } => !!i).map((i) => (
        <div key={i.label} className="min-w-0">
          <dt className="text-xs font-medium text-muted-foreground">{i.label}</dt>
          <dd className="mt-1 text-sm break-words">{i.value === null || i.value === undefined || i.value === "" ? <span className="text-muted-foreground">—</span> : i.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// ── Tabs: each tab has its own link, ?tab=key ──

export function PageTabs<K extends string>({ tabs, active, onChange }: { tabs: { key: K; label: string; count?: number }[]; active: K; onChange: (k: K) => void }) {
  return (
    <div className="-mt-2 flex gap-1 overflow-x-auto overflow-y-hidden border-b [scrollbar-width:none]" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={cn("shrink-0 border-b-2 px-3 py-2.5 text-[13.5px] font-medium transition-colors", active === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** ?tab= kept in the address, so a tab can be linked and survives a reload */
export function useTab<K extends string>(keys: readonly K[], fallback: K): [K, (k: K) => void] {
  // Console pages render only in the browser (after the session check), so the address is there
  const [tab, setTabState] = React.useState<K>(() => {
    const t = (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tab")) as K | null
    return t && keys.includes(t) ? t : fallback
  })
  const setTab = (k: K) => {
    setTabState(k)
    const u = new URL(window.location.href)
    u.searchParams.set("tab", k)
    window.history.replaceState(null, "", u)
  }
  return [tab, setTab]
}

// ── Small helpers ──

export function daysFrom(iso: string | null | undefined) {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)
}

/** "today", "in 3 days", "2 days ago" */
export function relDays(iso: string | null | undefined) {
  const d = daysFrom(iso)
  if (d === null) return "—"
  if (d === 0) return "today"
  if (d === 1) return "tomorrow"
  if (d === -1) return "yesterday"
  return d > 0 ? `in ${d} days` : `${-d} days ago`
}

/** "8 min ago", "3 h ago", "4 d ago" */
export function ago(iso: string | null | undefined) {
  if (!iso) return "Never"
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 2) return "Just now"
  if (min < 60) return `${min} min ago`
  if (min < 48 * 60) return `${Math.round(min / 60)} h ago`
  return `${Math.round(min / 1440)} d ago`
}

export const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

export const industryLabel = (key: string | null | undefined) => industryName(key)
