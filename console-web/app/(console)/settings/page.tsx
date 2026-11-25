"use client"

import * as React from "react"
import { toast } from "sonner"
import { BadgePercent, CalendarClock, Palette, Receipt, Wallet } from "lucide-react"
import { gstin as gstinRule } from "@contracts/validation"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field } from "@/components/form"
import { StateSelect } from "@/components/search-select"
import { NumberStepper } from "@/components/number-stepper"
import { PageError, PageLoading } from "@/components/page-states"
import { SettingRow, SettingsCard } from "@/components/settings-parts"
import { SaveBar } from "@/components/save-bar"
import { BrandFields, type BrandValue } from "@/components/brand-editor"
import { useLookPreview } from "@/components/console-look"
import { useAuth } from "@/lib/auth"
import { api, ApiError, errorMessage } from "@/lib/api"
import { ROLE_LABEL, type Role } from "@/lib/auth"
import { useApi } from "@/lib/use-api"

// Admin: AHEAD's own details on its invoices, and the few rules billing runs on. One page,
// one Save that appears only when something changed, and sends only what changed.

interface Seller { legalName: string; gstin: string; stateCode: string; address: string; email?: string; sac: string; gstRateBp: number }
interface Settings {
  seller: Seller
  "trial.days": number
  "extra_user.monthly_paise": number
  "extra_user.yearly_paise": number
  "discount.limits": Record<Role, number>
  "referral.welcome_discount_percent": number
  "orders.pay_within_days": number
  "renewal.notice_days": number
  "renewal.grace_days": number
  "closed.keep_days": number
  appearance?: BrandValue | null
}

type Form = {
  seller: Omit<Seller, "gstRateBp"> & { gstRate: string }
  num: Record<string, string>
  limits: Record<Role, string>
  look: BrandValue
}

const SECTIONS = [{ id: "invoices", label: "AHEAD on invoices", icon: Receipt }, { id: "billing", label: "Billing", icon: Wallet }, { id: "discounts", label: "Discount limits", icon: BadgePercent }, { id: "lifecycle", label: "Trials & renewals", icon: CalendarClock }, { id: "appearance", label: "Appearance", icon: Palette }]
const ROLES: Role[] = ["admin", "staff", "sales", "vendor", "partner_owner", "partner_staff"]
const NUMS: { key: keyof Settings; label: string; hint: string; min: number; max: number; rupees?: boolean; suffix?: string; section: "billing" | "lifecycle" }[] = [
  { key: "extra_user.monthly_paise", label: "Extra user, monthly", hint: "₹ before GST, per user per month", min: 0, max: 100000, rupees: true, section: "billing" },
  { key: "extra_user.yearly_paise", label: "Extra user, yearly", hint: "₹ before GST, per user per year", min: 0, max: 1000000, rupees: true, section: "billing" },
  { key: "referral.welcome_discount_percent", label: "Referral welcome discount", hint: "Off the first payment of a business that signed up with a code", min: 0, max: 50, suffix: "%", section: "billing" },
  { key: "orders.pay_within_days", label: "Payment link valid for", hint: "Days before an unpaid order lapses", min: 1, max: 60, suffix: "days", section: "billing" },
  { key: "trial.days", label: "Trial length", hint: "Days of every module for a new business", min: 1, max: 90, suffix: "days", section: "lifecycle" },
  { key: "renewal.notice_days", label: "Renewal notice", hint: "Days before the period ends that the renewal link goes out", min: 1, max: 30, suffix: "days", section: "lifecycle" },
  { key: "renewal.grace_days", label: "Grace after a missed renewal", hint: "Days paid modules stay open before Free", min: 0, max: 30, suffix: "days", section: "lifecycle" },
  { key: "closed.keep_days", label: "Keep a closed business", hint: "Days its data is kept before it’s deleted", min: 30, max: 365, suffix: "days", section: "lifecycle" },
]

const toForm = (s: Settings): Form => ({
  seller: { legalName: s.seller?.legalName ?? "", gstin: s.seller?.gstin ?? "", stateCode: s.seller?.stateCode ?? "", address: s.seller?.address ?? "", email: s.seller?.email ?? "", sac: s.seller?.sac ?? "998314", gstRate: String((s.seller?.gstRateBp ?? 1800) / 100) },
  num: Object.fromEntries(NUMS.map((n) => [n.key, String(n.rupees ? ((s[n.key] as number) ?? 0) / 100 : ((s[n.key] as number) ?? ""))])),
  limits: Object.fromEntries(ROLES.map((r) => [r, String(s["discount.limits"]?.[r] ?? 0)])) as Record<Role, string>,
  look: { preset: "default", brandColor: "#2450D8", font: "inter", density: "comfortable", ...(s.appearance ?? {}) },
})

export default function SettingsPage() {
  const s = useApi<Settings>("/console/settings")
  const [base, setBase] = React.useState<Form | null>(null)
  const [f, setF] = React.useState<Form | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const { reload: reloadMe } = useAuth()
  // The chosen look shows on the whole Console while it is being picked
  useLookPreview(f && base && JSON.stringify(f.look) !== JSON.stringify(base.look) ? f.look : null)

  if (s.data && !base) {
    const form = toForm(s.data)
    setBase(form)
    setF(form)
  }
  if (s.error && !s.data) return <PageError error={s.error} onRetry={s.reload} />
  if (!f || !base) return <PageLoading />

  const sellerDirty = JSON.stringify(f.seller) !== JSON.stringify(base.seller)
  const dirtyNums = NUMS.filter((n) => f.num[n.key] !== base.num[n.key])
  const limitsDirty = JSON.stringify(f.limits) !== JSON.stringify(base.limits)
  const lookDirty = JSON.stringify(f.look) !== JSON.stringify(base.look)
  const dirty = sellerDirty || dirtyNums.length > 0 || limitsDirty || lookDirty

  const save = async () => {
    const e: Record<string, string> = {}
    if (sellerDirty) {
      if (f.seller.legalName.trim().length < 2) e["seller.legalName"] = "Enter the legal name"
      if (f.seller.gstin) { const g = gstinRule(f.seller.gstin.toUpperCase()); if (g) e["seller.gstin"] = g; else if (f.seller.stateCode && f.seller.gstin.slice(0, 2) !== f.seller.stateCode) e["seller.gstin"] = "The GSTIN is from another state" }
      if (!/^99\d{4}$/.test(f.seller.sac)) e["seller.sac"] = "SAC has 6 digits and starts with 99"
      if (!(Number(f.seller.gstRate) >= 0 && Number(f.seller.gstRate) <= 28)) e["seller.gstRateBp"] = "From 0 to 28"
    }
    for (const n of dirtyNums) { const v = Number(f.num[n.key]); if (f.num[n.key] === "" || !(v >= n.min && v <= n.max)) e[n.key] = `From ${n.min} to ${n.max}` }
    for (const r of ROLES) { const v = Number(f.limits[r]); if (!(v >= 0 && v <= 100)) e[`discount.limits.${r}`] = "0 to 100" }
    setErrors(e)
    if (Object.keys(e).length) {
      toast.error("Please fix the highlighted errors before saving.")
      setTimeout(() => {
        const first = document.querySelector('[aria-invalid="true"]') as HTMLElement | null
        first?.scrollIntoView({ behavior: "smooth", block: "center" })
        first?.focus()
      }, 50)
      return
    }
    const body: Record<string, unknown> = {}
    if (sellerDirty) body.seller = { legalName: f.seller.legalName.trim(), gstin: f.seller.gstin.trim().toUpperCase(), stateCode: f.seller.stateCode, address: f.seller.address.trim(), email: f.seller.email?.trim(), sac: f.seller.sac, gstRateBp: Math.round(Number(f.seller.gstRate) * 100) }
    for (const n of dirtyNums) body[n.key] = n.rupees ? Math.round(Number(f.num[n.key]) * 100) : Number(f.num[n.key])
    if (limitsDirty) body["discount.limits"] = Object.fromEntries(ROLES.map((r) => [r, Number(f.limits[r])]))
    if (lookDirty) body.appearance = f.look
    setBusy(true)
    try {
      const out = await api.put<Settings>("/console/settings", body)
      const form = toForm(out)
      setBase(form)
      setF(form)
      if (lookDirty) await reloadMe()
      toast.success("Settings saved")
    } catch (x) {
      if (x instanceof ApiError && Object.keys(x.fields).length) setErrors(x.fields)
      else toast.error(errorMessage(x))
    } finally {
      setBusy(false)
    }
  }

  const setSeller = (k: keyof Form["seller"]) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => x && { ...x, seller: { ...x.seller, [k]: e.target.value } })
  const numRow = (n: (typeof NUMS)[number]) => (
    <SettingRow key={n.key} title={n.label} description={n.hint} error={errors[n.key]}>
      {n.rupees
        ? <div className="relative w-36"><span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">₹</span><Input inputMode="decimal" aria-label={n.label} className="pl-7 text-right tabular-nums" value={f.num[n.key]} onChange={(e) => setF((x) => x && { ...x, num: { ...x.num, [n.key]: e.target.value.replace(/[^\d.]/g, "") } })} /></div>
        : <NumberStepper value={f.num[n.key]} onChange={(v) => setF((x) => x && { ...x, num: { ...x.num, [n.key]: v } })} min={n.min} max={n.max} suffix={n.suffix} aria-label={n.label} className="w-36" />}
    </SettingRow>
  )
  const changed: Record<string, boolean> = { invoices: sellerDirty, billing: NUMS.some((n) => n.section === "billing" && f.num[n.key] !== base.num[n.key]), discounts: limitsDirty, lifecycle: NUMS.some((n) => n.section === "lifecycle" && f.num[n.key] !== base.num[n.key]), appearance: lookDirty }

  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-[26px] leading-tight font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">AHEAD’s details on invoices, the rules billing follows, and the Console’s look. Nothing saves until you press Save changes.</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="hidden lg:block">
          <ul className="ui-surface sticky top-20 grid gap-0.5 p-2 text-sm">
            {SECTIONS.map((x) => (
              <li key={x.id}>
                <a href={`#${x.id}`} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-foreground/80 hover:bg-muted hover:text-foreground">
                  <x.icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">{x.label}</span>
                  {changed[x.id] && <span className="size-2 rounded-full bg-amber-500" title="Changed, not saved" />}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid min-w-0 gap-5">
          <SettingsCard id="invoices" icon={Receipt} title="AHEAD on invoices" description="Printed on every invoice and credit note AHEAD sends. Changes apply to new ones only.">
            <div className="grid gap-4 pt-1 sm:grid-cols-2">
              <Field label="Legal name" required error={errors["seller.legalName"]}><Input value={f.seller.legalName} onChange={setSeller("legalName")} placeholder="e.g. AHEAD Software Pvt Ltd" /></Field>
              <Field label="Billing email" error={errors["seller.email"]}><Input type="email" value={f.seller.email} onChange={setSeller("email")} placeholder="e.g. billing@ahead.in" /></Field>
              <Field label="State" hint="Decides CGST + SGST or IGST" error={errors["seller.stateCode"]}><StateSelect value={f.seller.stateCode} onChange={(v) => setF((x) => x && { ...x, seller: { ...x.seller, stateCode: v } })} /></Field>
              <Field label="GSTIN" hint="Empty: invoices go out without GST" error={errors["seller.gstin"]}><Input mask="gstin" value={f.seller.gstin} onChange={setSeller("gstin")} maxLength={15} className="font-mono uppercase" placeholder="e.g. 09AAKCA1234L1Z5" /></Field>
              {!f.seller.gstin.trim() && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 sm:col-span-2">
                  <span className="mt-0.5 shrink-0">⚠️</span>
                  <p>No GSTIN set — invoices will be issued without GST. Add your GSTIN to generate compliant tax invoices.</p>
                </div>
              )}
              <Field label="Address" className="sm:col-span-2" error={errors["seller.address"]}><Textarea value={f.seller.address} onChange={setSeller("address")} maxLength={300} placeholder="e.g. 4th floor, Tower B, Sector 62, Noida 201301" /></Field>
            </div>
            <div className="mt-2">
              <SettingRow title="SAC" description="998314 for IT services" error={errors["seller.sac"]}><Input value={f.seller.sac} aria-label="SAC" onChange={(e) => setF((x) => x && { ...x, seller: { ...x.seller, sac: e.target.value.replace(/\D/g, "").slice(0, 6) } })} className="w-36 font-mono" /></SettingRow>
              <SettingRow title="GST rate" description="18% for software services" error={errors["seller.gstRateBp"]}><NumberStepper value={f.seller.gstRate} onChange={(v) => setF((x) => x && { ...x, seller: { ...x.seller, gstRate: v } })} min={0} max={28} suffix="%" aria-label="GST rate" className="w-36" /></SettingRow>
            </div>
          </SettingsCard>

          <SettingsCard id="billing" icon={Wallet} title="Billing" description="Prices and rules used on every order.">
            {NUMS.filter((n) => n.section === "billing").map(numRow)}
          </SettingsCard>

          <SettingsCard id="discounts" icon={BadgePercent} title="Discount limits" description="The most each role can give on one order. Above it, the order waits for an Admin’s approval.">
            {ROLES.map((r) => (
              <SettingRow key={r} title={ROLE_LABEL[r]} error={errors[`discount.limits.${r}`]}>
                <NumberStepper value={f.limits[r]} onChange={(v) => setF((x) => x && { ...x, limits: { ...x.limits, [r]: v } })} min={0} max={100} suffix="%" aria-label={`${ROLE_LABEL[r]} discount limit`} className="w-36" />
              </SettingRow>
            ))}
          </SettingsCard>

          <SettingsCard id="lifecycle" icon={CalendarClock} title="Trials, renewals and closing" description="What happens when a trial ends, a renewal is missed, or a business closes.">
            {NUMS.filter((n) => n.section === "lifecycle").map(numRow)}
          </SettingsCard>

          <SettingsCard id="appearance" icon={Palette} title="Appearance" description="The Console’s look for everyone in it, the partner portal too. Light or dark stays each person’s own choice in the top bar.">
            <div className="pt-1"><BrandFields value={f.look} onChange={(look) => setF((x) => x && { ...x, look })} /></div>
          </SettingsCard>

          <SaveBar dirty={dirty} saving={busy} onSave={() => void save()} onDiscard={() => { setF(base); setErrors({}) }} />
        </div>
      </div>
    </div>
  )
}
