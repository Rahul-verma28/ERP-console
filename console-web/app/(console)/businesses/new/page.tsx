"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Building2, Check, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, Mail, Rocket, Tags, UserRound } from "lucide-react"
import { gstin as gstinRule, gstinStateMismatch, stateName } from "@contracts/validation"
import { industryName } from "@contracts/workspace"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DiscardChangesDialog, Field, FormError, NativeSelect } from "@/components/form"
import { IndustrySelect, StateSelect } from "@/components/search-select"
import { NumberStepper } from "@/components/number-stepper"
import { Stepper, type Step } from "@/components/stepper"
import { Pill } from "@/components/page-parts"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { useUnsavedChanges } from "@/lib/use-unsaved"
import { formatPaise } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Partner, Plan } from "@/lib/types"

// Add a business — the ERP's long-form pattern: steps across the top, a live preview on the
// right, Previous / Next, each step checked before moving on, the last step saves. The ERP makes
// the workspace within seconds and the owner gets a link to set their password.

type Start = "trial" | "paid" | "partner_plan"
const STEPS: Step[] = [
  { key: "business", label: "Business", icon: Building2 },
  { key: "owner", label: "Owner", icon: UserRound },
  { key: "start", label: "Plan", icon: Tags },
  { key: "review", label: "Review", icon: ClipboardCheck },
]
const STEP_FIELDS: Record<string, string[]> = {
  business: ["name", "legalName", "industryKey", "gstin", "stateCode", "partnerId"],
  owner: ["owner.name", "owner.email", "owner.mobile"],
  start: ["start", "start.planKey", "couponCode", "discountPct", "extraUsers"],
}
const BLANK = { name: "", legalName: "", industryKey: "", gstin: "", stateCode: "", ownerName: "", ownerEmail: "", ownerMobile: "", partnerId: "", start: "trial" as Start, planKey: "standard", cycle: "monthly" as "monthly" | "yearly", extraUsers: "0", discount: "none" as "none" | "coupon" | "percent", coupon: "", pct: "" }
type Form = typeof BLANK

export default function NewBusinessPage() {
  const router = useRouter()
  const { me, team, partner, is } = useAuth()
  const plans = useApi<{ data: Plan[] }>("/catalog/plans")
  const partners = useApi<{ data: Partner[] }>(team ? "/partners" : null)
  const [f, setForm] = React.useState<Form>(BLANK)
  const [at, setAt] = React.useState(0)
  const [completed, setCompleted] = React.useState<Set<number>>(new Set())
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const dirty = JSON.stringify(f) !== JSON.stringify(BLANK) && !busy
  const guard = useUnsavedChanges(dirty)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((x) => ({ ...x, [k]: v }))

  const forPartner = partner || !!f.partnerId
  const paidPlans = (plans.data?.data ?? []).filter((p) => p.active && !p.isFree && p.monthlyPaise != null)
  const plan = paidPlans.find((p) => p.key === f.planKey)
  const partnerName = partner ? me?.partner?.name : partners.data?.data.find((p) => p.id === f.partnerId)?.name

  /** The fields of one step, checked here before Next (the server checks again on save) */
  const check = (step: string) => {
    const e: Record<string, string> = {}
    if (step === "business") {
      if (f.name.trim().length < 2) e.name = "Enter the business name"
      if (!f.industryKey) e.industryKey = "Choose the industry"
      if (!f.stateCode) e.stateCode = "Choose the state"
      if (f.gstin) {
        const g = gstinRule(f.gstin.toUpperCase()) ?? gstinStateMismatch(f.gstin.toUpperCase(), f.stateCode)
        if (g) e.gstin = g
      }
    }
    if (step === "owner") {
      if (f.ownerName.trim().length < 2) e["owner.name"] = "Enter the owner’s name"
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.ownerEmail.trim())) e["owner.email"] = "Enter a valid email"
      if (!/^(\+91)?[6-9]\d{9}$/.test(f.ownerMobile.replace(/\s/g, ""))) e["owner.mobile"] = "Enter a 10-digit mobile"
    }
    if (step === "start" && f.start !== "trial") {
      if (!plan) e["start.planKey"] = "Choose a plan"
      if (f.start === "paid" && f.discount === "coupon" && !f.coupon.trim()) e.couponCode = "Enter the coupon"
      if (f.start === "paid" && f.discount === "percent" && !(Number(f.pct) >= 1 && Number(f.pct) <= 100)) e.discountPct = "From 1 to 100"
    }
    return e
  }
  /** The first step that isn't filled in, up to `until` */
  const firstBad = (until: number) => {
    for (let s = 0; s < until; s++) {
      const e = check(STEPS[s].key)
      if (Object.keys(e).length) return { step: s, e }
    }
    return null
  }
  const next = () => {
    const e = check(STEPS[at].key)
    setErrors(e)
    if (!Object.keys(e).length) {
      setCompleted((prev) => new Set([...prev, at]))
      setAt(at + 1)
    }
  }
  const pick = (i: number) => {
    const bad = firstBad(i)
    if (bad) {
      setErrors(bad.e)
      setAt(bad.step)
    } else {
      setCompleted((prev) => new Set([...prev, at]))
      setAt(i)
    }
  }

  const save = async () => {
    const bad = firstBad(3)
    if (bad) {
      setErrors(bad.e)
      setAt(bad.step)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const startBody =
        f.start === "trial" ? { kind: "trial" }
          : f.start === "partner_plan" ? { kind: "partner_plan", planKey: f.planKey }
            : { kind: "paid", planKey: f.planKey, cycle: f.cycle, extraUsers: Number(f.extraUsers || 0), couponCode: f.discount === "coupon" ? f.coupon.trim().toUpperCase() : null, discountPct: f.discount === "percent" ? Number(f.pct) : null }
      const b = await api.post<{ id: string; firstOrder: { status: string; totalPaise: number } | null }>("/businesses", {
        name: f.name.trim(), legalName: f.legalName.trim() || null, industryKey: f.industryKey, gstin: f.gstin.trim().toUpperCase() || null, stateCode: f.stateCode,
        owner: { name: f.ownerName.trim(), email: f.ownerEmail.trim(), mobile: f.ownerMobile.replace(/\s/g, "") }, start: startBody, partnerId: team ? f.partnerId || null : undefined,
      })
      toast.success(
        b.firstOrder
          ? b.firstOrder.status === "pending_approval" ? `${f.name.trim()} added. The discount needs an Admin’s approval before the payment link goes out.` : `${f.name.trim()} added. The owner gets a login link, and a payment link for ${formatPaise(b.firstOrder.totalPaise)}.`
          : `${f.name.trim()} added. The owner gets a login link by email in a few seconds.`,
      )
      router.replace(`/businesses/${b.id}`)
    } catch (x) {
      if (x instanceof ApiError && Object.keys(x.fields).length) {
        setErrors(x.fields)
        const i = STEPS.findIndex((s) => Object.keys(x.fields).some((k) => STEP_FIELDS[s.key]?.includes(k)))
        if (i >= 0) setAt(i)
      }
      setError(errorMessage(x))
      setBusy(false)
    }
  }

  const current = STEPS[at].key
  const choice = (on: boolean) => cn("rounded-2xl border p-4 text-left transition-all", on ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:border-primary/40")
  const starts: { key: Start; label: string; hint: string }[] = forPartner
    ? [{ key: "trial", label: "Free trial", hint: "Every module for 14 days, then Free. Nothing on the bill until it’s on a plan." }, { key: "partner_plan", label: "On a plan now", hint: `Active at once; added to ${partnerName ?? "the partner"}’s monthly bill.` }]
    : [{ key: "trial", label: "Free trial", hint: "Every module for 14 days, then the Free plan unless they pay." }, { key: "paid", label: "Paid plan", hint: "The plan starts when the first payment is in. A payment link goes out now." }]

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-bold tracking-tight">{partner ? "Add client" : "Add business"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{partner ? `It joins ${me?.partner?.name}’s clients. ` : ""}The owner gets a link to set their password; the workspace is ready in seconds.</p>
        </div>
        <Link href="/businesses" className={buttonVariants({ variant: "outline" })}><ArrowLeft /> Back</Link>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="ui-surface grid gap-5 p-5 sm:p-6">
          <Stepper steps={STEPS} at={at} open={(i) => i <= at + 1 || completed.has(i)} onPick={pick} />

          {current === "business" && (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Business name" required error={errors.name}><Input value={f.name} onChange={(e) => set("name", e.target.value)} maxLength={100} placeholder="e.g. Sharma Electronics" autoFocus aria-label="Business name" /></Field>
              <Field label="Legal name" hint="As registered, if different" error={errors.legalName}><Input value={f.legalName} onChange={(e) => set("legalName", e.target.value)} maxLength={160} placeholder="e.g. Sharma Electronics Pvt Ltd" /></Field>
              <Field label="Industry" required error={errors.industryKey}><IndustrySelect value={f.industryKey} onChange={(v) => set("industryKey", v)} /></Field>
              <Field label="State" required hint="Sets GST on AHEAD’s invoices" error={errors.stateCode}><StateSelect value={f.stateCode} onChange={(v) => set("stateCode", v)} /></Field>
              <Field label="GSTIN" hint="Leave empty if not registered" error={errors.gstin}><Input mask="gstin" value={f.gstin} onChange={(e) => set("gstin", e.target.value)} maxLength={15} className="font-mono uppercase" placeholder="e.g. 27AAKFS1234L1Z5" /></Field>
              {team && (partners.data?.data.length ?? 0) > 0 && (
                <Field label="For a partner" hint="A partner’s client is billed to the partner, never to the business" error={errors.partnerId}>
                  <NativeSelect value={f.partnerId} onChange={(e) => setForm((x) => ({ ...x, partnerId: e.target.value, start: "trial" }))}>
                    <option value="">No — AHEAD’s own client</option>
                    {partners.data!.data.filter((p) => p.status === "active").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </NativeSelect>
                </Field>
              )}
            </div>
          )}

          {current === "owner" && (
            <div className="grid gap-4 md:grid-cols-2">
              <p className="rounded-2xl bg-muted/60 px-4 py-3 text-sm text-muted-foreground md:col-span-2">The owner gets the login link by email. One person can own several businesses with the same login.</p>
              <Field label="Owner’s name" required error={errors["owner.name"]}><Input value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} maxLength={100} placeholder="e.g. Ravi Sharma" autoFocus /></Field>
              <Field label="Mobile" required error={errors["owner.mobile"]}><Input mask="phone" value={f.ownerMobile} onChange={(e) => set("ownerMobile", e.target.value)} placeholder="e.g. 9876543210" /></Field>
              <Field label="Email" required hint="The login link goes here" error={errors["owner.email"]} className="md:col-span-2"><Input type="email" value={f.ownerEmail} onChange={(e) => set("ownerEmail", e.target.value)} maxLength={120} placeholder="e.g. ravi@sharmaelectronics.in" /></Field>
            </div>
          )}

          {current === "start" && (
            <div className="grid gap-5">
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="How it starts">
                {starts.map((s) => (
                  <button key={s.key} type="button" role="radio" aria-checked={f.start === s.key} onClick={() => set("start", s.key)} className={choice(f.start === s.key)}>
                    <span className="flex items-center justify-between gap-2 text-sm font-semibold">{s.label}{f.start === s.key && <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="size-3" /></span>}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{s.hint}</span>
                  </button>
                ))}
              </div>
              {f.start !== "trial" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2 md:col-span-2">
                    <p className="text-sm font-medium">Plan <span className="text-destructive">*</span></p>
                    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Plan">
                      {paidPlans.map((p) => (
                        <button key={p.key} type="button" role="radio" aria-checked={f.planKey === p.key} onClick={() => set("planKey", p.key)} className={choice(f.planKey === p.key)}>
                          <span className="block text-sm font-semibold">{p.name}</span>
                          <span className="block text-lg font-bold tabular-nums">{formatPaise(p.monthlyPaise!, true)}<span className="text-xs font-normal text-muted-foreground"> /month</span></span>
                          <span className="block text-xs text-muted-foreground">{p.limits.users} users · {p.modules.length} modules</span>
                        </button>
                      ))}
                    </div>
                    {errors["start.planKey"] && <p className="text-xs text-destructive">{errors["start.planKey"]}</p>}
                  </div>
                  {f.start === "paid" && (
                    <>
                      <Field label="Billed" required>
                        <NativeSelect value={f.cycle} onChange={(e) => set("cycle", e.target.value as "monthly" | "yearly")}>
                          <option value="monthly">Monthly · {formatPaise(plan?.monthlyPaise ?? 0, true)}</option>
                          <option value="yearly">Yearly · {formatPaise(plan?.yearlyPaise ?? 0, true)}</option>
                        </NativeSelect>
                      </Field>
                      <Field label="Extra users" hint={`${plan?.limits.users ?? 0} are included`} error={errors.extraUsers}><NumberStepper value={f.extraUsers} onChange={(v) => set("extraUsers", v)} min={0} max={500} aria-label="Extra users" className="w-36" /></Field>
                      <Field label="Discount" hint={is("admin") ? "One per order" : "One per order; above your limit an Admin approves"}>
                        <NativeSelect value={f.discount} onChange={(e) => set("discount", e.target.value as Form["discount"])}>
                          <option value="none">No discount</option>
                          <option value="coupon">A coupon</option>
                          <option value="percent">A percent off</option>
                        </NativeSelect>
                      </Field>
                      {f.discount === "coupon" && <Field label="Coupon code" required error={errors.couponCode}><Input value={f.coupon} onChange={(e) => set("coupon", e.target.value.toUpperCase())} placeholder="e.g. DIWALI20" className="font-mono uppercase" maxLength={20} /></Field>}
                      {f.discount === "percent" && <Field label="Percent off" required error={errors.discountPct}><NumberStepper value={f.pct} onChange={(v) => set("pct", v)} min={1} max={100} suffix="%" aria-label="Percent off" className="w-32" /></Field>}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {current === "review" && (
            <div className="grid gap-4">
              <dl className="grid gap-3 rounded-2xl border p-4 text-sm sm:grid-cols-2">
                <Pair k="Business" v={f.name} />
                {f.legalName && <Pair k="Legal name" v={f.legalName} />}
                <Pair k="Industry" v={industryName(f.industryKey)} />
                <Pair k="State" v={stateName(f.stateCode) ?? "—"} />
                <Pair k="GSTIN" v={f.gstin ? f.gstin.toUpperCase() : "Not registered"} />
                <Pair k="Owner" v={`${f.ownerName} · ${f.ownerMobile}`} />
                <Pair k="Email" v={f.ownerEmail} />
                <Pair k="Starts on" v={f.start === "trial" ? "Free trial, 14 days" : `${plan?.name ?? ""}${f.start === "paid" ? ` · ${f.cycle}` : " · on the partner’s bill"}`} />
                {f.start === "paid" && Number(f.extraUsers) > 0 && <Pair k="Extra users" v={`+${f.extraUsers} seats`} />}
                {f.start === "paid" && f.discount === "coupon" && f.coupon && <Pair k="Coupon" v={<span className="font-mono">{f.coupon.toUpperCase()}</span>} />}
                {f.start === "paid" && f.discount === "percent" && f.pct && <Pair k="Discount" v={`${f.pct}% off`} />}
                {partnerName && <Pair k="Partner" v={partnerName} />}
              </dl>
              <div className="rounded-2xl bg-muted/60 p-4 text-sm">
                <p className="mb-2 font-semibold">What happens next</p>
                <ol className="grid gap-1.5 text-muted-foreground">
                  <li className="flex gap-2"><Rocket className="mt-0.5 size-4 shrink-0 text-primary" /> The ERP makes the workspace within a few seconds.</li>
                  <li className="flex gap-2"><Mail className="mt-0.5 size-4 shrink-0 text-primary" /> {f.ownerName || "The owner"} gets a login link to set their password.</li>
                  {f.start === "paid" && <li className="flex gap-2"><Tags className="mt-0.5 size-4 shrink-0 text-primary" /> A payment link goes out; the plan starts when it’s paid.</li>}
                </ol>
              </div>
            </div>
          )}

          <FormError message={error} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-5">
            {at > 0 ? <Button type="button" variant="outline" onClick={() => setAt(at - 1)}><ChevronLeft /> Previous</Button> : <span />}
            {current !== "review" ? <Button type="button" onClick={next}>Next <ChevronRight /></Button> : <Button type="button" disabled={busy} onClick={() => void save()}>{busy && <Loader2 className="animate-spin" />} {busy ? "Adding…" : partner ? "Add client" : "Add business"}</Button>}
          </div>
        </section>

        <Preview f={f} plan={f.start === "trial" ? null : plan ?? null} partnerName={partnerName} />
      </div>
      <DiscardChangesDialog open={guard.leaving} onKeep={guard.stay} onDiscard={guard.leave} />
    </div>
  )
}

function Pair({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate font-medium">{v || "—"}</dd></div>
}

/** What the business will look like in the Console, filled in as you type */
function Preview({ f, plan, partnerName }: { f: Form; plan: Plan | null; partnerName?: string }) {
  const initials = f.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?"
  const price = plan ? (f.start === "paid" && f.cycle === "yearly" ? plan.yearlyPaise : plan.monthlyPaise) : null
  return (
    <aside className="ui-surface grid gap-4 p-5 xl:sticky xl:top-20 overflow-hidden">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Preview</p>
      <div className="flex items-center gap-3 min-w-0">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">{initials}</span>
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{f.name || "Business name"}</p>
          <p className="truncate text-sm text-muted-foreground">{f.industryKey ? industryName(f.industryKey) : "Industry"}{f.stateCode ? ` · ${stateName(f.stateCode)}` : ""}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Pill color={f.start === "trial" ? "blue" : f.start === "paid" ? "amber" : "emerald"} dot>{f.start === "trial" ? "Trial" : f.start === "paid" ? "Awaiting payment" : "Live"}</Pill>
        {partnerName && <Pill color="violet">{partnerName}</Pill>}
      </div>
      <dl className="grid gap-2.5 border-t pt-4 text-sm">
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Owner</dt><dd className="truncate text-right font-medium">{f.ownerName || "—"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Login link to</dt><dd className="truncate text-right font-medium">{f.ownerEmail || "—"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Plan</dt><dd className="text-right font-medium">{plan ? plan.name : "Free trial · 14 days"}</dd></div>
        {plan && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Users included</dt><dd className="text-right font-medium">{plan.limits.users}{f.start === "paid" && Number(f.extraUsers) > 0 ? ` + ${f.extraUsers}` : ""}</dd></div>}
      </dl>
      {plan && price != null && (
        <div className="rounded-2xl bg-muted/60 p-4">
          <p className="text-xs text-muted-foreground">{f.start === "paid" ? (f.cycle === "yearly" ? "List price a year" : "List price a month") : "List price a month (the partner pays less)"}</p>
          <p className="text-2xl font-bold tabular-nums">{formatPaise(price, true)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{f.start === "paid" ? "Before extra users, discount and GST. The exact amount is on the order." : "Billed on the partner’s monthly bill."}</p>
        </div>
      )}
    </aside>
  )
}
