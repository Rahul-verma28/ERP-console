"use client"

import * as React from "react"
import { toast } from "sonner"
import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, NativeSelect } from "@/components/form"
import { NumberStepper } from "@/components/number-stepper"
import { ActionDialog, fieldErrors } from "@/components/action-dialog"
import { api, ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatPaise } from "@/lib/format"
import type { Order, Plan, Quote } from "@/lib/types"

// A new order for a business: plan, period, extra users and one discount, with the exact amount
// worked out by console-api as the seller types. Making it sends the owner the payment link.

export function OrderDialog({ businessId, businessName, plans, currentPlan, onClose, onDone }: { businessId: string; businessName: string; plans: Plan[]; currentPlan?: string; onClose: () => void; onDone: () => void }) {
  const { is } = useAuth()
  const paid = plans.filter((p) => p.active && !p.isFree && p.monthlyPaise != null)
  const [planKey, setPlanKey] = React.useState(paid.find((p) => p.key === currentPlan)?.key ?? paid[0]?.key ?? "")
  const [cycle, setCycle] = React.useState<"monthly" | "yearly">("monthly")
  const [extraUsers, setExtraUsers] = React.useState("0")
  const [kind, setKind] = React.useState<"none" | "coupon" | "percent">("none")
  const [coupon, setCoupon] = React.useState("")
  const [pct, setPct] = React.useState("")
  const [quote, setQuote] = React.useState<Quote | null>(null)
  const [quoteError, setQuoteError] = React.useState<string | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [made, setMade] = React.useState<Order | null>(null)

  const body = React.useMemo(
    () => ({ planKey, cycle, extraUsers: Number(extraUsers || 0), couponCode: kind === "coupon" && coupon.trim() ? coupon.trim().toUpperCase() : null, discountPct: kind === "percent" && Number(pct) >= 1 ? Number(pct) : null }),
    [planKey, cycle, extraUsers, kind, coupon, pct],
  )

  React.useEffect(() => {
    if (!planKey) return
    let gone = false
    const t = setTimeout(() => {
      api.post<Quote>(`/billing/businesses/${businessId}/quote`, body).then(
        (q) => { if (!gone) { setQuote(q); setQuoteError(null) } },
        (x) => { if (!gone) { setQuote(null); setQuoteError(x instanceof ApiError ? (Object.values(x.fields)[0] ?? x.message) : "Couldn’t work out the amount") } },
      )
    }, 300)
    return () => { gone = true; clearTimeout(t) }
  }, [businessId, body, planKey])

  if (made)
    return (
      <ActionDialog open onOpenChange={(o) => { if (!o) { onDone(); onClose() } }} title="Order made" submitLabel="Done" onSubmit={async () => undefined}>
        {made.status === "pending_approval" ? (
          <p className="text-sm">The discount is above your limit, so an Admin approves it first. The payment link goes to the owner as soon as they do.</p>
        ) : (
          <div className="grid gap-2 text-sm">
            <p>The payment link for {formatPaise(made.totalPaise)} is on its way to {made.billTo.email}. You can also share it yourself:</p>
            {made.linkUrl && (
              <div className="flex gap-2">
                <Input readOnly value={made.linkUrl} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                <Button type="button" variant="outline" size="sm" onClick={() => { void navigator.clipboard.writeText(made.linkUrl!); toast.success("Link copied") }}><Copy /> Copy</Button>
              </div>
            )}
          </div>
        )}
      </ActionDialog>
    )

  return (
    <ActionDialog
      open onOpenChange={(o) => !o && onClose()} wide title={`New order for ${businessName}`} submitLabel="Make order and send link"
      description="The plan starts when the payment is in. The link is valid for the days set in Settings."
      onSubmit={async () => {
        if (kind === "coupon" && !body.couponCode) { setErrors({ couponCode: "Enter the coupon" }); return { couponCode: "x" } }
        if (kind === "percent" && !body.discountPct) { setErrors({ discountPct: "From 1 to 100" }); return { discountPct: "x" } }
        try {
          const o = await api.post<Order>(`/billing/businesses/${businessId}/orders`, body)
          setMade(o)
          return { keepOpen: "1" }
        } catch (x) {
          const f = fieldErrors(x)
          setErrors(f)
          return f
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plan" error={errors.planKey}>
          <NativeSelect value={planKey} onChange={(e) => setPlanKey(e.target.value)}>
            {paid.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Billed">
          <NativeSelect value={cycle} onChange={(e) => setCycle(e.target.value as "monthly" | "yearly")}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly (2 months free)</option>
          </NativeSelect>
        </Field>
        <Field label="Extra users" error={errors.extraUsers}><NumberStepper value={extraUsers} onChange={setExtraUsers} min={0} max={500} aria-label="Extra users" className="w-36" /></Field>
        <Field label="Discount" hint={is("admin") ? "One per order" : "Above your limit, an Admin approves"} error={errors.couponCode ?? errors.discountPct}>
          <div className="flex gap-2">
            <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="w-32">
              <option value="none">None</option>
              <option value="coupon">Coupon</option>
              <option value="percent">Percent</option>
            </NativeSelect>
            {kind === "coupon" && <Input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="CODE" className="font-mono uppercase" maxLength={20} />}
            {kind === "percent" && <NumberStepper value={pct} onChange={setPct} min={1} max={100} suffix="%" aria-label="Percent off" className="w-28" />}
          </div>
        </Field>
      </div>
      <div className="rounded-xl bg-muted/60 p-3 text-sm">
        {quoteError ? (
          <p className="text-destructive">{quoteError}</p>
        ) : !quote ? (
          <p className="text-muted-foreground">Working out the amount…</p>
        ) : (
          <dl className="grid gap-1">
            {quote.lines.map((l, i) => <div key={i} className="flex justify-between gap-3"><dt>{l.description}{l.quantity > 1 ? ` × ${l.quantity}` : ""}</dt><dd className="tabular-nums">{formatPaise(l.amountPaise)}</dd></div>)}
            {quote.discountPaise > 0 && <div className="flex justify-between gap-3 text-emerald-700 dark:text-emerald-400"><dt>Discount</dt><dd className="tabular-nums">−{formatPaise(quote.discountPaise)}</dd></div>}
            {quote.igstPaise > 0 ? <div className="flex justify-between gap-3 text-muted-foreground"><dt>IGST</dt><dd className="tabular-nums">{formatPaise(quote.igstPaise)}</dd></div> : <div className="flex justify-between gap-3 text-muted-foreground"><dt>CGST + SGST</dt><dd className="tabular-nums">{formatPaise(quote.cgstPaise + quote.sgstPaise)}</dd></div>}
            <div className="flex justify-between gap-3 border-t pt-1 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatPaise(quote.totalPaise)}</dd></div>
            {quote.needsApproval && <p className="text-xs text-violet-700 dark:text-violet-300">This discount needs an Admin’s approval before the link goes out.</p>}
          </dl>
        )}
      </div>
    </ActionDialog>
  )
}
