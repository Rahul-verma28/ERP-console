"use client"

import * as React from "react"
import { toast } from "sonner"
import { CalendarClock, CheckCircle2, Plus, TicketPercent } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Field } from "@/components/form"
import { NumberStepper } from "@/components/number-stepper"
import { ActionDialog, fieldErrors } from "@/components/action-dialog"
import { EmptyState } from "@/components/common"
import { DataList, countBy, localList, type Column } from "@/components/data-list"
import { Pill } from "@/components/page-parts"
import { SummaryCards } from "@/components/summary-cards"
import { api, errorMessage } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import { formatDate, formatPaise } from "@/lib/format"
import type { Plan } from "@/lib/types"

// Admin: discount codes. One discount per order: a coupon, or a percent within the person's limit.

interface Coupon { id: string; code: string; percentOff: number | null; amountOffPaise: number | null; validUntil: string | null; maxUses: number | null; used: number; planKeys: string[]; active: boolean; createdAt: string }
const expired = (c: Coupon) => !!c.validUntil && new Date(c.validUntil) < new Date()
const stateOf = (c: Coupon) => (!c.active ? "off" : expired(c) ? "expired" : c.maxUses && c.used >= c.maxUses ? "used_up" : "live")
const STATE: Record<string, { label: string; color: string }> = { live: { label: "Active", color: "emerald" }, off: { label: "Inactive", color: "slate" }, expired: { label: "Expired", color: "slate" }, used_up: { label: "Used up", color: "amber" } }
const load = localList<Coupon>(
  async () => (await api.get<{ data: Omit<Coupon, "id">[] }>("/catalog/coupons")).data.map((c) => ({ ...c, id: c.code })),
  (c, q) => c.code.toLowerCase().includes(q),
  { filter: (c, params) => !params.state || stateOf(c) === params.state, counts: (rows) => countBy(rows, stateOf), meta: (rows) => ({ uses: rows.reduce((t, c) => t + c.used, 0) }) },
)

export default function CouponsPage() {
  const plans = useApi<{ data: Plan[] }>("/catalog/plans")
  const [tick, setTick] = React.useState(0)
  const [adding, setAdding] = React.useState(false)
  const toggle = async (c: Coupon) => {
    try {
      await api.patch(`/catalog/coupons/${c.code}`, { active: !c.active })
      toast.success(c.active ? `${c.code} is inactive` : `${c.code} is active`)
      setTick((t) => t + 1)
    } catch (x) {
      toast.error(errorMessage(x))
    }
  }
  const planName = (k: string) => plans.data?.data.find((p) => p.key === k)?.name ?? k
  const columns: Column<Coupon>[] = [
    { key: "code", header: "Code", hideable: false, sort: (c) => c.code, csv: (c) => c.code, cell: (c) => <span className="font-mono font-semibold">{c.code}</span> },
    { key: "off", header: "Off", csv: (c) => (c.percentOff ? `${c.percentOff}%` : (c.amountOffPaise ?? 0) / 100), cell: (c) => <span className="font-semibold">{c.percentOff ? `${c.percentOff}%` : formatPaise(c.amountOffPaise ?? 0, true)}</span> },
    { key: "plans", header: "Plans", csv: (c) => c.planKeys.map(planName).join(" "), cell: (c) => <span className="text-sm text-muted-foreground">{c.planKeys.length ? c.planKeys.map(planName).join(", ") : "Any paid plan"}</span> },
    { key: "used", header: "Used", align: "right", sort: (c) => c.used, csv: (c) => c.used, cell: (c) => <span className="tabular-nums">{c.used}{c.maxUses ? <span className="text-muted-foreground"> / {c.maxUses}</span> : ""}</span> },
    { key: "until", header: "Valid until", sort: (c) => c.validUntil ?? "9999", csv: (c) => c.validUntil ?? "", cell: (c) => <span className="text-sm text-muted-foreground">{c.validUntil ? formatDate(c.validUntil) : "No end"}</span> },
    { key: "status", header: "Status", csv: (c) => STATE[stateOf(c)].label, cell: (c) => <Pill color={STATE[stateOf(c)].color} dot>{STATE[stateOf(c)].label}</Pill> },
    { key: "actions", header: "Active", hideable: false, cell: (c) => <span onClick={(e) => e.stopPropagation()}><Switch checked={c.active} onCheckedChange={() => void toggle(c)} aria-label={`${c.code} active`} /></span> },
  ]
  return (
    <>
      <DataList<Coupon>
        id="coupons"
        load={load}
        params={{ v: String(tick) }}
        header={{ title: "Coupons", description: "Discount codes owners type on the ERP’s plan page, and your team uses on orders. One discount per order.", primary: <Button className="h-10 rounded-xl px-4 font-semibold" onClick={() => setAdding(true)}><Plus /> Add coupon</Button>, more: [{ label: "Plans & pricing", href: "/plans" }] }}
        columns={columns}
        searchPlaceholder="Search code"
        presets={[
          { key: "all", label: "All", params: {}, countKey: "all" },
          { key: "live", label: "Active", params: { state: "live" }, countKey: "live" },
          { key: "used_up", label: "Used up", params: { state: "used_up" }, countKey: "used_up" },
          { key: "expired", label: "Expired", params: { state: "expired" }, countKey: "expired" },
          { key: "off", label: "Inactive", params: { state: "off" }, countKey: "off" },
        ]}
        tabs
        top={(res) => {
          const c = (res.counts ?? {}) as Record<string, number>
          return <SummaryCards items={[
            { label: "Coupons", value: c.all ?? 0, hint: `${c.live ?? 0} active`, color: "blue", icon: TicketPercent },
            { label: "Times used", value: (res.uses as number) ?? 0, hint: "On paid orders", color: "emerald", icon: CheckCircle2 },
            { label: "Expired or used up", value: (c.expired ?? 0) + (c.used_up ?? 0), hint: "No longer accepted", color: "amber", icon: CalendarClock },
          ]} />
        }}
        exportName="coupons"
        emptyState={<EmptyState icon={TicketPercent} title="No coupons yet" description="Make a code for a festival, a partner event or a campaign." action={<Button onClick={() => setAdding(true)}><Plus /> Add coupon</Button>} />}
      />
      {adding && <CouponDialog plans={plans.data?.data ?? []} onClose={() => setAdding(false)} onDone={() => setTick((t) => t + 1)} />}
    </>
  )
}

function CouponDialog({ plans, onClose, onDone }: { plans: Plan[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = React.useState({ code: "", kind: "percent" as "percent" | "amount", value: "", validUntil: "", maxUses: "", planKeys: new Set<string>() })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const today = new Date().toISOString().slice(0, 10)
  return (
    <ActionDialog open onOpenChange={() => onClose()} title="Add a coupon" submitLabel="Add coupon" description="Owners can type it on the ERP’s plan page; your team can use it on orders."
      onSubmit={async () => {
        const e: Record<string, string> = {}
        if (!/^[A-Z0-9-]{3,20}$/.test(f.code)) e.code = "3–20 letters, digits or -"
        const v = Number(f.value)
        if (f.kind === "percent" && !(v >= 1 && v <= 100)) e.percentOff = "From 1 to 100"
        if (f.kind === "amount" && !(v >= 1)) e.percentOff = "At least ₹1"
        if (f.validUntil && f.validUntil < today) e.validUntil = "Choose a date from today"
        setErrors(e)
        if (Object.keys(e).length) return e
        try {
          await api.post("/catalog/coupons", {
            code: f.code, percentOff: f.kind === "percent" ? v : null, amountOffPaise: f.kind === "amount" ? Math.round(v * 100) : null,
            validUntil: f.validUntil ? new Date(`${f.validUntil}T23:59:59+05:30`).toISOString() : null, maxUses: f.maxUses ? Number(f.maxUses) : null, planKeys: [...f.planKeys],
          })
          toast.success(`${f.code} added`)
          onDone()
        } catch (x) {
          const fe = fieldErrors(x)
          setErrors(fe)
          return fe
        }
      }}>
      <Field label="Code" required error={errors.code}><Input value={f.code} onChange={(e) => setF((x) => ({ ...x, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") }))} placeholder="e.g. DIWALI20" className="font-mono uppercase" maxLength={20} autoFocus /></Field>
      <Field label="Off" required error={errors.percentOff ?? errors.amountOffPaise}>
        <div className="flex gap-2">
          <select value={f.kind} onChange={(e) => setF((x) => ({ ...x, kind: e.target.value as "percent" | "amount" }))} className="h-10 rounded-xl border bg-background px-2 text-sm" aria-label="Kind of discount">
            <option value="percent">Percent</option>
            <option value="amount">Rupees</option>
          </select>
          <NumberStepper value={f.value} onChange={(v) => setF((x) => ({ ...x, value: v }))} min={1} max={f.kind === "percent" ? 100 : undefined} suffix={f.kind === "percent" ? "%" : undefined} aria-label="Amount off" />
        </div>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valid until" hint="Optional" error={errors.validUntil}><Input type="date" min={today} value={f.validUntil} onChange={(e) => setF((x) => ({ ...x, validUntil: e.target.value }))} /></Field>
        <Field label="Uses at most" hint="Optional" error={errors.maxUses}><NumberStepper value={f.maxUses} onChange={(v) => setF((x) => ({ ...x, maxUses: v }))} min={1} aria-label="Uses at most" /></Field>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium">Only for these plans <span className="font-normal text-muted-foreground">(none ticked = any plan)</span></p>
        <div className="flex flex-wrap gap-3">
          {plans.filter((p) => !p.isFree && p.monthlyPaise != null).map((p) => (
            <label key={p.key} className="flex items-center gap-2 text-sm">
              <Checkbox checked={f.planKeys.has(p.key)} onCheckedChange={(v) => setF((x) => { const s = new Set(x.planKeys); if (v) s.add(p.key); else s.delete(p.key); return { ...x, planKeys: s } })} />
              {p.name}
            </label>
          ))}
        </div>
      </div>
    </ActionDialog>
  )
}
