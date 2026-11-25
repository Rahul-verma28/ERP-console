"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, ArrowLeft, BadgeIndianRupee, Blocks, ChevronLeft, ChevronRight, Eye, Gauge } from "lucide-react"
import { MODULES } from "@contracts/modules"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field } from "@/components/form"
import { NumberStepper } from "@/components/number-stepper"
import { Stepper, type Step } from "@/components/stepper"
import { Pill, Section } from "@/components/page-parts"
import { PageError, PageLoading } from "@/components/page-states"
import { SettingRow } from "@/components/settings-parts"
import { SaveBar } from "@/components/save-bar"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import { formatPaise } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Limits, Plan } from "@/lib/types"

// One plan: name, prices, limits and modules. Before saving, the impact: how many businesses are
// on it, which modules they lose or gain, and who would be over the new user limit. Modules and
// limits reach those businesses at once (a fresh licence); a new price applies from renewal.

const LIMITS: { key: keyof Limits; label: string; nullable?: boolean; min: number; hint?: string }[] = [
  { key: "users", label: "Users", min: 1 },
  { key: "branches", label: "Branches", min: 1 },
  { key: "contacts", label: "Contacts", nullable: true, min: 1, hint: "Empty = no limit" },
  { key: "items", label: "Items", nullable: true, min: 1, hint: "Empty = no limit" },
  { key: "invoicesPerMonth", label: "Invoices a month", nullable: true, min: 1, hint: "Empty = no limit" },
  { key: "storageMb", label: "Storage (MB)", min: 100, hint: "1024 MB = 1 GB" },
  { key: "aiCredits", label: "AI credits a month", min: 0 },
]
const rupees = (p: number | null) => (p == null ? "" : String(p / 100))
interface Impact { businesses: number; removed: string[]; added: string[]; overUsers: { id: string; name: string }[] }

export default function PlanEditorPage() {
  const { key } = useParams<{ key: string }>()
  const plans = useApi<{ data: Plan[] }>("/catalog/plans")
  const plan = plans.data?.data.find((p) => p.key === key)
  if (plans.error && !plans.data) return <PageError error={plans.error} onRetry={plans.reload} />
  if (!plans.data) return <PageLoading />
  if (!plan) return <PageError error={new Error("This plan doesn’t exist.")} />
  return <Editor key={plan.key} plan={plan} onSaved={plans.reload} />
}

function Editor({ plan, onSaved }: { plan: Plan; onSaved: () => void }) {
  const start = React.useMemo(() => ({
    name: plan.name, tagline: plan.tagline, monthly: rupees(plan.monthlyPaise), yearly: rupees(plan.yearlyPaise), isPublic: plan.isPublic, active: plan.active,
    limits: Object.fromEntries(LIMITS.map((l) => [l.key, plan.limits[l.key] == null ? "" : String(plan.limits[l.key])])) as Record<keyof Limits, string>,
    modules: [...plan.modules].sort(),
  }), [plan])
  const [f, setF] = React.useState(start)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [at, setAt] = React.useState(0)
  const [impact, setImpact] = React.useState<Impact | null>(null)
  const [busy, setBusy] = React.useState(false)
  const priced = plan.monthlyPaise != null && !plan.isFree
  const dirty = JSON.stringify(f) !== JSON.stringify(start)
  const limitsOut = () => Object.fromEntries(LIMITS.map((l) => [l.key, f.limits[l.key] === "" ? null : Number(f.limits[l.key])]))
  const reachChanged = JSON.stringify(f.modules) !== JSON.stringify(start.modules) || JSON.stringify(f.limits) !== JSON.stringify(start.limits)

  // The impact follows the edits, a moment after typing stops
  React.useEffect(() => {
    if (!reachChanged) return
    let live = true
    const t = setTimeout(() => {
      api.post<Impact>(`/catalog/plans/${plan.key}/impact`, { modules: f.modules, limits: limitsOut() }).then((r) => live && setImpact(r), () => live && setImpact(null))
    }, 400)
    return () => {
      live = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- limitsOut reads f
  }, [f.modules, f.limits, reachChanged, plan.key])

  const save = async () => {
    const e: Record<string, string> = {}
    if (f.name.trim().length < 2) e.name = "Enter the name"
    if (priced && !(Number(f.monthly) > 0)) e.monthlyPaise = "Enter the monthly price"
    if (priced && !(Number(f.yearly) > 0)) e.yearlyPaise = "Enter the yearly price"
    for (const l of LIMITS) if (!(l.nullable && f.limits[l.key] === "") && !(Number(f.limits[l.key]) >= l.min)) e[`limits.${l.key}`] = l.nullable ? `At least ${l.min}, or empty` : `At least ${l.min}`
    setErrors(e)
    const first = Object.keys(e)[0]
    if (first) {
      setAt(first.startsWith("limits.") ? 1 : 0)
      return
    }
    setBusy(true)
    try {
      await api.put(`/catalog/plans/${plan.key}`, {
        name: f.name.trim(), tagline: f.tagline.trim(), isPublic: f.isPublic, active: f.active,
        ...(priced ? { monthlyPaise: Math.round(Number(f.monthly) * 100), yearlyPaise: Math.round(Number(f.yearly) * 100) } : {}),
        ...(reachChanged ? { limits: limitsOut(), modules: f.modules } : {}),
      })
      toast.success(`${f.name.trim()} saved${reachChanged && impact?.businesses ? `; ${impact.businesses} business${impact.businesses === 1 ? "" : "es"} get the change now` : ""}`)
      onSaved()
    } catch (x) {
      if (x instanceof ApiError && Object.keys(x.fields).length) setErrors(x.fields)
      else toast.error(errorMessage(x))
    } finally {
      setBusy(false)
    }
  }
  const toggleModule = (k: string, on: boolean) => setF((x) => ({ ...x, modules: (on ? [...x.modules, k] : x.modules.filter((m) => m !== k)).sort() }))
  const name = (k: string) => MODULES.find((m) => m.key === k)?.name ?? k

  const steps: Step[] = [
    { key: "price", label: "Name & price", icon: BadgeIndianRupee },
    { key: "limits", label: "Limits", icon: Gauge },
    { key: "modules", label: "Modules", icon: Blocks },
    { key: "visibility", label: "Visibility", icon: Eye },
  ]
  const current = steps[at].key

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-[26px] leading-tight font-bold tracking-tight">Edit {plan.name} {!plan.active ? <Pill color="slate">Inactive</Pill> : !plan.isPublic ? <Pill color="amber">Hidden</Pill> : <Pill color="emerald" dot>On sale</Pill>}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{plan.businesses ?? 0} business{plan.businesses === 1 ? "" : "es"} on this plan. Modules and limits reach them at once; a new price applies from their next renewal.</p>
        </div>
        <Link href="/plans" className={buttonVariants({ variant: "outline" })}><ArrowLeft /> Back</Link>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="ui-surface grid gap-5 p-5 sm:p-6">
          <Stepper steps={steps} at={at} open={() => true} onPick={setAt} />

          {current === "price" && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Plan name" required error={errors.name}><Input value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} maxLength={40} placeholder="e.g. Standard" /></Field>
              <Field label="Tagline" hint="One line on the website and the ERP’s plan page" error={errors.tagline}><Input value={f.tagline} onChange={(e) => setF((x) => ({ ...x, tagline: e.target.value }))} maxLength={120} placeholder="e.g. Everything a small business runs on" /></Field>
              {priced ? (
                <>
                  <Field label="Monthly price" required hint="₹ before GST" error={errors.monthlyPaise}><Input inputMode="decimal" value={f.monthly} onChange={(e) => setF((x) => ({ ...x, monthly: e.target.value.replace(/[^\d.]/g, "") }))} placeholder="e.g. 999" /></Field>
                  <Field label="Yearly price" required hint={Number(f.monthly) > 0 && Number(f.yearly) > 0 ? `₹ before GST · ${Math.round((1 - Number(f.yearly) / (Number(f.monthly) * 12)) * 100)}% less than 12 months` : "₹ before GST"} error={errors.yearlyPaise}><Input inputMode="decimal" value={f.yearly} onChange={(e) => setF((x) => ({ ...x, yearly: e.target.value.replace(/[^\d.]/g, "") }))} placeholder="e.g. 9990" /></Field>
                </>
              ) : (
                <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground md:col-span-2">{plan.isFree ? "The Free plan costs nothing." : "This plan is quoted by AHEAD; it has no list price."}</p>
              )}
            </div>
          )}

          {current === "limits" && (
            <div className="grid gap-4 md:grid-cols-3">
              {LIMITS.map((l) => (
                <Field key={l.key} label={l.label} required={!l.nullable} hint={l.hint} error={errors[`limits.${l.key}`]}>
                  <NumberStepper value={f.limits[l.key]} onChange={(v) => setF((x) => ({ ...x, limits: { ...x.limits, [l.key]: v } }))} min={l.min} aria-label={l.label} />
                </Field>
              ))}
            </div>
          )}

          {current === "modules" && (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">{f.modules.length} of {MODULES.length} modules included. A business on a trial gets every module.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {MODULES.map((m) => {
                  const on = f.modules.includes(m.key)
                  return (
                    <label key={m.key} className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border px-3.5 py-3 transition-colors", on ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50")}>
                      <Checkbox checked={on} onCheckedChange={(v) => toggleModule(m.key, !!v)} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{m.name}</span>
                        <span className="block text-xs text-muted-foreground">{m.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {current === "visibility" && (
            <div className="grid">
              <SettingRow title="On sale" description="Shown on the website and on the ERP’s plan page"><Switch checked={f.isPublic} onCheckedChange={(v) => setF((x) => ({ ...x, isPublic: v }))} aria-label="On sale" /></SettingRow>
              <SettingRow title="Active" description="Can be chosen for new orders. Businesses already on it keep it either way."><Switch checked={f.active} onCheckedChange={(v) => setF((x) => ({ ...x, active: v }))} aria-label="Active" /></SettingRow>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-5">
            {at > 0 ? <Button type="button" variant="outline" onClick={() => setAt(at - 1)}><ChevronLeft /> Previous</Button> : <span />}
            {at < steps.length - 1 && <Button type="button" variant="outline" onClick={() => setAt(at + 1)}>Next <ChevronRight /></Button>}
          </div>
        </section>

        <aside className="grid gap-5 xl:sticky xl:top-20">
          <Section title="Impact" description="What saving does to businesses on this plan">
            {!reachChanged ? (
              <p className="text-sm text-muted-foreground">{dirty ? "Name, price or visibility only: nothing changes for businesses until they renew." : "Change the limits or modules to see who it reaches."}</p>
            ) : !impact ? (
              <PageLoading />
            ) : (
              <div className="grid gap-3 text-sm">
                <p><strong className="tabular-nums">{impact.businesses}</strong> business{impact.businesses === 1 ? "" : "es"} get the new modules and limits within seconds.</p>
                {impact.added.length > 0 && <div className="flex flex-wrap gap-1.5">{impact.added.map((k) => <Pill key={k} color="emerald">+ {name(k)}</Pill>)}</div>}
                {impact.removed.length > 0 && (
                  <div className="grid gap-1.5">
                    <div className="flex flex-wrap gap-1.5">{impact.removed.map((k) => <Pill key={k} color="rose">− {name(k)}</Pill>)}</div>
                    <p className="flex items-start gap-2 text-amber-800 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-4 shrink-0" /> A removed module turns read-only for businesses that used it; their data stays.</p>
                  </div>
                )}
                {impact.overUsers.length > 0 && <p className="text-amber-800 dark:text-amber-300">Over the new user limit: {impact.overUsers.map((b) => b.name).join(", ")}. They keep their users but can’t add more.</p>}
              </div>
            )}
          </Section>
          <Section title="Preview" description="How the plan reads on the website">
            <p className="font-semibold">{f.name || "Plan name"}</p>
            <p className="text-xs text-muted-foreground">{f.tagline}</p>
            <p className="mt-3 text-2xl font-bold tabular-nums">{priced ? formatPaise(Math.round(Number(f.monthly || 0) * 100), true) : plan.isFree ? "Free" : "Quoted"}{priced && <span className="text-sm font-normal text-muted-foreground"> /month</span>}</p>
            {priced && <p className="text-xs text-muted-foreground">{formatPaise(Math.round(Number(f.yearly || 0) * 100), true)} a year · with 18% GST {formatPaise(Math.round(Number(f.monthly || 0) * 118), true)} a month</p>}
            <ul className="mt-3 grid gap-1 border-t pt-3 text-sm">
              <li className="flex justify-between"><span className="text-muted-foreground">Users</span><span className="tabular-nums">{f.limits.users || "—"}</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Branches</span><span className="tabular-nums">{f.limits.branches || "—"}</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Invoices a month</span><span className="tabular-nums">{f.limits.invoicesPerMonth || "No limit"}</span></li>
              <li className="flex justify-between"><span className="text-muted-foreground">Modules</span><span className="tabular-nums">{f.modules.length} of {MODULES.length}</span></li>
            </ul>
          </Section>
        </aside>
      </div>

      <SaveBar dirty={dirty} saving={busy} saveLabel="Save plan" onSave={() => void save()} onDiscard={() => { setF(start); setErrors({}); setImpact(null) }} />
    </div>
  )
}
