"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Ban, CalendarClock, CalendarPlus, Copy, Eye, FileText, KeyRound, Lock, Plus, ReceiptText, RefreshCw, RotateCcw, Tags, Users, Wallet } from "lucide-react"
import { MODULES } from "@contracts/modules"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Field, NativeSelect } from "@/components/form"
import { NumberStepper } from "@/components/number-stepper"
import { ActionDialog, fieldErrors } from "@/components/action-dialog"
import { EmptyState } from "@/components/common"
import { PageError, PageLoading } from "@/components/page-states"
import { ActionMenu, DetailHeader, DetailList, Pill, Section, StatGrid, Steps, Tabs } from "@/components/page-parts"
import { AboutCard, RecordHistory } from "@/components/record-kit"
import { OrderDialog } from "@/components/order-dialog"
import { CancelDialog, PaymentDialog } from "@/components/order-actions"
import { ago, industryLabel, money, useTab } from "@/components/kit"
import { api, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { formatDate, formatDateTime, formatNumber } from "@/lib/format"
import { BUSINESS_PILL, BY_PILL, ORDER_PILL } from "@/lib/pills"
import { cn } from "@/lib/utils"
import type { BusinessDetail, Order, Page as ListPage, Plan } from "@/lib/types"

// One business, laid out like every record page of the ERP: header with status and actions,
// key numbers, the onboarding progress, then tabs (Overview, Plan & modules, Orders, Notes,
// History). Account facts only — never the business's own customers or invoices.

type Dialog = null | "plan" | "trial" | "close" | "reopen" | "order"
const TABS = ["overview", "plan", "billing", "notes", "history"] as const

export default function BusinessPage() {
  const { id } = useParams<{ id: string }>()
  const { team, partner } = useAuth()
  const b = useApi<BusinessDetail>(`/businesses/${id}`)
  const plans = useApi<{ data: Plan[] }>("/catalog/plans")
  const [tab, setTab] = useTab(TABS, "overview")
  const [dialog, setDialog] = React.useState<Dialog>(null)

  if (b.error && !b.data) return <PageError error={b.error} onRetry={b.reload} />
  if (!b.data) return <PageLoading />
  const d = b.data
  const s = d.subscription
  const f = d.facts
  const closed = s?.status === "closed"
  const signedIn = d.onboardedBy === "website" || !!(f?.owner?.lastLoginAt || f?.ownerLink?.usedAt)
  const reload = () => void b.reload()
  const pill = s ? (d.partner && s.status === "active" ? { label: "Live", color: "emerald" } : BUSINESS_PILL[s.status]) : null
  const by = d.partner ? "partner" : d.onboardedBy

  const ownerLink = async () => {
    try {
      await api.post(`/businesses/${id}/owner-link`)
      toast.success(`A new login link is on its way to ${d.ownerEmail}`)
      reload()
    } catch (x) {
      toast.error(errorMessage(x))
    }
  }

  const paying = s?.status === "active" || s?.status === "past_due"
  const steps = [
    { key: "made", label: "Workspace made", done: !!d.provisionedAt },
    { key: "link", label: "Login link sent", done: !!d.ownerLinkSentAt || signedIn },
    { key: "signin", label: "Owner signed in", done: signedIn },
    { key: "setup", label: "Setup finished", done: !!f?.setupDone },
    ...(d.partner ? [] : [{ key: "paid", label: "First payment", done: paying }]),
  ]
  const at = steps.findIndex((x) => !x.done)

  return (
    <div className="grid gap-5">
      <DetailHeader
        initials={d.name}
        title={d.name}
        pills={<>{pill && <Pill color={pill.color} dot>{pill.label}</Pill>}{!signedIn && !closed && <Pill color="rose">Owner not signed in</Pill>}</>}
        subtitle={`${industryLabel(d.industryKey)} · ${d.ownerName} · added ${formatDate(d.createdAt)}`}
        extra={<Pill color={BY_PILL[by].color}>{BY_PILL[by].label}{(d.partner?.name ?? d.onboarder?.name) ? ` · ${d.partner?.name ?? d.onboarder?.name}` : ""}</Pill>}
        actions={
          <>
            {!d.partner && !closed && !partner && <Button className="h-10 rounded-xl px-4 font-semibold" onClick={() => setDialog("order")}><Plus /> New order</Button>}
            <Button variant="outline" className="h-10 rounded-xl" onClick={() => void ownerLink()} disabled={closed}><KeyRound /> Send login link</Button>
            <ActionMenu trigger={<Button variant="outline" size="icon" className="size-10 rounded-xl" aria-label="More actions" />} items={[
              (team || partner) && !closed && { label: "Change plan", icon: Tags, onClick: () => setDialog("plan") },
              team && s?.status === "trialing" && { label: "Extend the trial", icon: CalendarPlus, onClick: () => setDialog("trial") },
              { label: "Copy business ID", icon: Copy, onClick: () => { void navigator.clipboard.writeText(d.id); toast.success("Business ID copied") } },
              "-",
              team && !closed && { label: "Close the business", icon: Lock, destructive: true, onClick: () => setDialog("close") },
              team && closed && { label: "Reopen the business", icon: RotateCcw, onClick: () => setDialog("reopen") },
            ]} />
          </>
        }
      />

      {(d.pending?.length ?? 0) > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3.5 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <p>{d.pending?.length ?? 0} change{(d.pending?.length ?? 0) === 1 ? " hasn’t" : "s haven’t"} reached the ERP yet. It tries again by itself{d.pending?.[0]?.lastError ? `; last error: ${d.pending?.[0]?.lastError}` : ""}.{team && <> <Link href="/system" className="font-medium underline">System health</Link></>}</p>
        </div>
      )}

      <StatGrid items={[
        { label: "Plan", value: s?.plan.name ?? "—", hint: s ? `${s.cycle}${s.extraUsers ? ` · +${s.extraUsers} users` : ""}` : undefined, icon: Tags, color: "blue" },
        { label: s?.status === "trialing" ? "Trial ends" : s?.status === "past_due" ? "Moves to Free" : closed ? "Data deleted on" : "Paid until", value: s?.status === "trialing" && s.trialEndsAt ? formatDate(s.trialEndsAt) : s?.status === "past_due" && s.graceEndsAt ? formatDate(s.graceEndsAt) : closed && s?.purgeAt ? formatDate(s.purgeAt) : s?.periodEnd ? formatDate(s.periodEnd) : "—", icon: CalendarClock, color: s?.status === "past_due" ? "rose" : "emerald" },
        { label: "Users", value: f ? `${f.team?.active ?? "…"} of ${(s?.plan.limits.users ?? 0) + (s?.extraUsers ?? 0)}` : "—", hint: f ? `${f.team?.invited ?? 0} invited · ${f.team?.branches ?? 0} branch${(f.team?.branches ?? 0) === 1 ? "" : "es"}` : "The ERP hasn’t answered yet", icon: Users, color: "violet" },
        { label: "Last active", value: f?.lastActiveAt ? ago(f.lastActiveAt) : "Never", hint: f?.usage ? `${formatNumber(f.usage.invoicesThisMonth)} invoices this month` : undefined, icon: Wallet, color: "amber" },
      ]} />

      <Steps label="Onboarding" steps={steps.map((x, i) => ({ key: x.key, label: x.label, state: x.done ? "done" : i === at ? "current" : "todo" }))} />

      <Tabs<(typeof TABS)[number]> value={tab} onChange={setTab} tabs={[
        { key: "overview", label: "Overview" },
        { key: "plan", label: "Plan & modules" },
        { key: "billing", label: d.partner ? "Billing" : "Orders & invoices" },
        { key: "notes", label: "Notes", count: d.notes.length, hidden: partner },
        { key: "history", label: "History" },
      ]} />

      {tab === "overview" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid content-start gap-5">
            <Section title="Business">
              <DetailList items={[
                ["Business name", d.name],
                ["Legal name", d.legalName],
                ["Industry", industryLabel(d.industryKey)],
                ["GSTIN", d.gstin ? <span className="font-mono">{d.gstin}</span> : "Not registered"],
                ["Referral code used", d.referralCode],
                ["Brought by", d.partner?.name ?? d.onboarder?.name ?? BY_PILL[by].label],
              ]} />
            </Section>
            <Section title="In the ERP" description={d.factsLive ? "Live from the ERP" : f ? "Last known; the ERP didn’t answer just now" : undefined}>
              {!d.provisionedAt ? (
                <p className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400"><RefreshCw className="size-4 animate-spin" /> Setting up the workspace…</p>
              ) : !f ? (
                <p className="text-sm text-muted-foreground">The ERP hasn’t answered yet.</p>
              ) : (
                <DetailList cols={3} items={[
                  ["Active users", f.team.active],
                  ["Invited", f.team.invited],
                  ["Branches", f.team.branches],
                  ["Invoices this month", formatNumber(f.usage?.invoicesThisMonth ?? 0)],
                  ["Customers", formatNumber(f.usage?.customers ?? 0)],
                  ["Storage used", `${((f.usage?.storageBytes ?? 0) / 1048576).toFixed(1)} MB of ${formatNumber(Math.round((s?.plan.limits.storageMb ?? 0) / 1024))} GB`],
                  ["Setup", f.setupDone ? "Finished" : "Not finished"],
                  ["Last active", f.lastActiveAt ? formatDateTime(f.lastActiveAt) : "Never"],
                  ["Licence", d.licences[0] ? `#${d.licences[0].seq} · ${d.licences[0].deliveredAt ? "delivered" : "waiting"}` : "—"],
                ]} />
              )}
            </Section>
          </div>
          <div className="grid content-start gap-5">
            <Section title="Owner" action={<Button size="sm" variant="ghost" onClick={() => void ownerLink()} disabled={closed}><KeyRound /> Send link</Button>}>
              <DetailList cols={1} items={[
                ["Name", d.ownerName],
                ["Email", d.ownerEmail],
                ["Mobile", d.ownerMobile],
                ["Login link", f?.ownerLink ? (f.ownerLink.usedAt ? `Used ${formatDate(f.ownerLink.usedAt)}` : `Sent ${formatDate(f.ownerLink.sentAt)}, not used yet`) : d.ownerLinkSentAt ? `Sent ${formatDate(d.ownerLinkSentAt)}` : d.onboardedBy === "website" ? "Signed up on the website" : "Not sent yet"],
                ["Last sign-in", f?.owner?.lastLoginAt ? formatDateTime(f.owner.lastLoginAt) : signedIn ? "—" : "Never"],
              ]} />
            </Section>
            <AboutCard id={d.id} createdAt={d.createdAt} createdBy={d.onboarder?.name ?? (d.onboardedBy === "website" ? "The owner, on the website" : null)} extra={[["Licence ends", d.licences[0] ? formatDate(d.licences[0].expiresAt) : "—"]]} />
          </div>
        </div>
      )}
      {tab === "plan" && <PlanTab d={d} onReload={reload} onChange={() => setDialog("plan")} />}
      {tab === "billing" && <BillingTab d={d} onOrder={() => setDialog("order")} />}
      {tab === "notes" && !partner && <NotesTab d={d} onAdd={reload} />}
      {tab === "history" && <RecordHistory businessId={d.id} created={{ at: d.createdAt, by: d.onboarder?.name }} />}

      {dialog === "plan" && <PlanDialog onClose={() => setDialog(null)} d={d} plans={plans.data?.data ?? []} onDone={reload} />}
      {dialog === "trial" && <TrialDialog onClose={() => setDialog(null)} id={id} onDone={reload} />}
      <ActionDialog
        open={dialog === "close"} onOpenChange={(o) => !o && setDialog(null)} destructive title={`Close ${d.name}?`} submitLabel="Close business"
        description="People can’t sign in to it any more and nothing is billed. Its data is kept, and it can be reopened until it’s deleted."
        onSubmit={async () => { await api.post(`/businesses/${id}/close`); toast.success(`${d.name} is closed`); reload() }}
      />
      <ActionDialog
        open={dialog === "reopen"} onOpenChange={(o) => !o && setDialog(null)} title={`Reopen ${d.name}?`} submitLabel="Reopen"
        description="It opens on the Free plan with its data as it was. The owner can choose a plan from the ERP."
        onSubmit={async () => { await api.post(`/businesses/${id}/reopen`); toast.success(`${d.name} is open again`); reload() }}
      />
      {dialog === "order" && <OrderDialog businessId={id} businessName={d.name} plans={plans.data?.data ?? []} currentPlan={s?.planKey} onClose={() => setDialog(null)} onDone={reload} />}
    </div>
  )
}

function PlanTab({ d, onReload, onChange }: { d: BusinessDetail; onReload: () => void; onChange: () => void }) {
  const { team, partner } = useAuth()
  const s = d.subscription
  const [busy, setBusy] = React.useState<string | null>(null)
  const planMods = new Set(s?.plan.modules ?? [])
  const set = async (key: string, state: "on" | "off" | null) => {
    setBusy(key)
    try {
      await api.put(`/businesses/${d.id}/modules/${key}`, { state, until: null })
      toast.success(state === null ? "Back to what the plan gives" : state === "on" ? "Turned on for this business" : "Turned off for this business")
      onReload()
    } catch (x) {
      toast.error(errorMessage(x))
    } finally {
      setBusy(null)
    }
  }
  if (!s) return <Section><p className="text-sm text-muted-foreground">No plan yet.</p></Section>
  return (
    <div className="grid gap-5">
      <Section title={`${s.plan.name} · ${s.cycle}`} description={s.plan.tagline} action={(team || partner) && s.status !== "closed" ? <Button size="sm" variant="outline" onClick={onChange}><Tags /> Change plan</Button> : undefined}>
        <DetailList cols={3} items={[
          ["Users", formatNumber(s.plan.limits.users + s.extraUsers)],
          ["Branches", formatNumber(s.plan.limits.branches)],
          ["Invoices a month", s.plan.limits.invoicesPerMonth == null ? "No limit" : formatNumber(s.plan.limits.invoicesPerMonth)],
          ["Contacts", s.plan.limits.contacts == null ? "No limit" : formatNumber(s.plan.limits.contacts)],
          ["Items", s.plan.limits.items == null ? "No limit" : formatNumber(s.plan.limits.items)],
          ["Storage", `${formatNumber(Math.round(s.plan.limits.storageMb / 1024))} GB`],
        ]} />
      </Section>
      <Section title="Modules" description={team ? "What the plan gives, and any module turned on or off for this business alone." : "What the plan gives this business."}>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((m) => {
            const o = d.overrides.find((x) => x.moduleKey === m.key)
            const on = s.status === "trialing" ? true : o ? o.state === "on" : planMods.has(m.key)
            return (
              <li key={m.key} className={cn("flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-3", on ? "bg-card" : "bg-muted/40")}>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold"><span className={cn("size-2 rounded-full", on ? "bg-emerald-500" : "bg-muted-foreground/40")} />{m.name}</span>
                  <span className="block text-xs text-muted-foreground">{o ? `${o.state === "on" ? "On" : "Off"} for this business${o.until ? ` until ${formatDate(o.until)}` : ""}` : s.status === "trialing" ? "Open during the trial" : on ? "In the plan" : "Not in the plan"}</span>
                </span>
                {team && (
                  <NativeSelect aria-label={`${m.name} module`} value={o?.state ?? "plan"} disabled={busy === m.key || s.status === "closed"} onChange={(e) => void set(m.key, e.target.value === "plan" ? null : (e.target.value as "on" | "off"))} className="w-28">
                    <option value="plan">As plan</option>
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </NativeSelect>
                )}
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}

function BillingTab({ d, onOrder }: { d: BusinessDetail; onOrder: () => void }) {
  const orders = useApi<ListPage<Order>>(d.partner ? null : `/billing/orders?businessId=${d.id}&limit=50`)
  const [act, setAct] = React.useState<{ kind: "pay" | "cancel"; order: Order } | null>(null)
  if (d.partner) return <Section><p className="text-sm text-muted-foreground">Billed to {d.partner.name} on its monthly bill, at list price less the partner’s discount. <Link className="font-medium text-primary hover:underline" href={`/partners/${d.partner.id}`}>Open the partner</Link></p></Section>
  return (
    <Section title="Orders" description="Every order for this business: what it cost and whether it’s paid" action={d.subscription?.status !== "closed" ? <Button size="sm" variant="outline" onClick={onOrder}><Plus /> New order</Button> : undefined} flush>
      {orders.error ? (
        <PageError error={orders.error} onRetry={orders.reload} />
      ) : !orders.data ? (
        <div className="p-5"><PageLoading /></div>
      ) : orders.data.data.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr className="text-[13px]"><th className="px-5 py-3 font-semibold">Plan</th><th className="px-3 py-3 font-semibold">Kind</th><th className="px-3 py-3 font-semibold">Discount</th><th className="px-3 py-3 text-right font-semibold">Total</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Invoice</th><th className="px-3 py-3 font-semibold">Made</th><th className="px-5 py-3 font-semibold">Actions</th></tr>
            </thead>
            <tbody className="divide-y">
              {orders.data.data.map((o) => (
                <tr key={o.id} className="hover:bg-muted/40">
                  <td className="px-5 py-3 font-medium capitalize">{o.planKey} · {o.cycle}{o.extraUsers ? <span className="block text-xs font-normal text-muted-foreground">+{o.extraUsers} users</span> : null}</td>
                  <td className="px-3 py-3">{o.kind === "renewal" ? "Renewal" : o.kind === "change" ? "Plan change" : "New"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{o.couponCode ?? (o.discountPct ? `${o.discountPct}%` : "—")}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{money(o.totalPaise)}</td>
                  <td className="px-3 py-3"><Pill color={ORDER_PILL[o.status].color} dot>{ORDER_PILL[o.status].label}</Pill></td>
                  <td className="px-3 py-3">{o.invoice ? <Link href={`/invoices/${o.invoice.id}`} className="font-mono text-xs text-primary hover:underline">{o.invoice.number}</Link> : "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{formatDate(o.createdAt)}</td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-0.5">
                      {o.invoice && <Link href={`/invoices/${o.invoice.id}`} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4" title="Open the invoice"><Eye /></Link>}
                      <ActionMenu items={[
                        o.status === "awaiting_payment" && o.linkUrl && { label: "Copy the payment link", icon: Copy, onClick: () => { void navigator.clipboard.writeText(o.linkUrl!); toast.success("Payment link copied") } },
                        o.status === "awaiting_payment" && { label: "Record a payment", icon: Wallet, onClick: () => setAct({ kind: "pay", order: o }) },
                        o.invoice && { label: "Open the invoice", icon: FileText, href: `/invoices/${o.invoice.id}` },
                        (o.status === "awaiting_payment" || o.status === "pending_approval") && { label: "Cancel order", icon: Ban, destructive: true, onClick: () => setAct({ kind: "cancel", order: o }) },
                        { label: "All orders", icon: ReceiptText, href: "/billing" },
                      ]} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={FileText} title="No orders yet" description="Make an order to send the owner a payment link." action={d.subscription?.status !== "closed" ? <Button onClick={onOrder}><Plus /> New order</Button> : undefined} />
      )}
      {act?.kind === "pay" && <PaymentDialog order={act.order} onClose={() => setAct(null)} onDone={orders.reload} />}
      {act?.kind === "cancel" && <CancelDialog order={act.order} onClose={() => setAct(null)} onDone={orders.reload} />}
    </Section>
  )
}

function NotesTab({ d, onAdd }: { d: BusinessDetail; onAdd: () => void }) {
  const [text, setText] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const add = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      await api.post(`/businesses/${d.id}/notes`, { text: text.trim() })
      setText("")
      onAdd()
    } catch (x) {
      toast.error(errorMessage(x))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Section title="Notes" description="Calls, promises, anything your team should know. Only the Console sees these." flush>
        {d.notes.length ? (
          <ul className="divide-y">
            {d.notes.map((n) => (
              <li key={n.id} className="px-5 py-3.5">
                <p className="text-sm whitespace-pre-wrap">{n.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={FileText} title="No notes yet" description="Write what was said on a call, so the next person knows." />}
      </Section>
      <Section title="Add a note">
        <div className="grid gap-3">
          <Field label="Note" required><Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Called the owner; wants a demo of GST returns on Friday" maxLength={2000} rows={5} /></Field>
          <Button className="justify-self-end" disabled={busy || !text.trim()} onClick={() => void add()}><Plus /> Add note</Button>
        </div>
      </Section>
    </div>
  )
}

function PlanDialog({ onClose, d, plans, onDone }: { onClose: () => void; d: BusinessDetail; plans: Plan[]; onDone: () => void }) {
  const [planKey, setPlanKey] = React.useState(d.subscription?.planKey ?? "")
  const [cycle, setCycle] = React.useState(d.subscription?.cycle ?? "monthly")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const choices = plans.filter((p) => p.active && !p.isTrial)
  const unchanged = planKey === d.subscription?.planKey && cycle === d.subscription?.cycle
  return (
    <ActionDialog
      open onOpenChange={(o) => !o && onClose()} title="Change plan" submitLabel="Change plan"
      description={d.partner ? `Takes effect now; ${d.partner.name}’s next bill uses the new plan.` : "Takes effect now with no payment. To charge for it, make an order instead."}
      onSubmit={async () => {
        if (unchanged) { setErrors({ planKey: "Choose a different plan or billing" }); return { planKey: "x" } }
        try {
          await api.post(`/businesses/${d.id}/plan`, { planKey, cycle })
          toast.success("Plan changed. The ERP gets the new licence in a few seconds.")
          onDone()
        } catch (x) {
          const fe = fieldErrors(x)
          setErrors(fe)
          return fe
        }
      }}
    >
      <Field label="Plan" required error={errors.planKey}>
        <NativeSelect value={planKey} onChange={(e) => setPlanKey(e.target.value)}>
          {choices.map((p) => <option key={p.key} value={p.key}>{p.name}{p.monthlyPaise ? ` · ${money(p.monthlyPaise)}/month` : ""}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Billed" required>
        <NativeSelect value={cycle} onChange={(e) => setCycle(e.target.value as "monthly" | "yearly")}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </NativeSelect>
      </Field>
    </ActionDialog>
  )
}

function TrialDialog({ onClose, id, onDone }: { onClose: () => void; id: string; onDone: () => void }) {
  const [days, setDays] = React.useState("7")
  const [error, setError] = React.useState<string>()
  return (
    <ActionDialog
      open onOpenChange={(o) => !o && onClose()} title="Extend the trial" submitLabel="Extend"
      description="Adds days to the end of the trial. Every module stays open until then."
      onSubmit={async () => {
        try {
          await api.post(`/businesses/${id}/trial`, { days: Number(days) })
          toast.success(`Trial extended by ${days} days`)
          onDone()
        } catch (x) {
          const fe = fieldErrors(x)
          setError(fe.days)
          return fe
        }
      }}
    >
      <Field label="Days to add" required error={error}><NumberStepper value={days} onChange={setDays} min={1} max={60} aria-label="Days to add" className="w-36" /></Field>
    </ActionDialog>
  )
}

