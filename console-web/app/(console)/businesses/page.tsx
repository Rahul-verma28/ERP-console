"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Building2, CalendarClock, Eye, KeyRound, Plus, ReceiptText, TrendingUp, Wallet } from "lucide-react"
import { NumberStepper } from "@/components/number-stepper"
import { Field } from "@/components/form"
import { ActionDialog } from "@/components/action-dialog"
import { EmptyState } from "@/components/common"
import { DataList, HeaderLink, pagedList, type BulkAction, type Column } from "@/components/data-list"
import { ActionMenu, Avatar, Pill } from "@/components/page-parts"
import { SummaryCards } from "@/components/summary-cards"
import { api, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { formatDate } from "@/lib/format"
import { ago, industryLabel } from "@/components/kit"
import { BUSINESS_PILL, BY_PILL } from "@/lib/pills"
import type { BusinessRow, Partner, Plan } from "@/lib/types"

// Every business the person can see: the ERP's list — state tabs with counts, summary cards,
// search, Filters (plan, brought by, partner), columns, row actions, bulk actions, export.

const iconBtn = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4"

export default function BusinessesPage() {
  const { team, partner, is } = useAuth()
  const plans = useApi<{ data: Plan[] }>("/catalog/plans")
  const partners = useApi<{ data: Partner[] }>(team ? "/partners" : null)
  const [tick, setTick] = React.useState(0)
  const [dialog, setDialog] = React.useState<null | { kind: "link" | "days"; rows: BusinessRow[] }>(null)
  const status = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("status")
  const load = React.useMemo(() => pagedList<BusinessRow>("/businesses"), [])

  const sendLink = async (r: BusinessRow) => {
    try {
      await api.post(`/businesses/${r.id}/owner-link`)
      toast.success(`A new login link is on its way to ${r.ownerEmail}`)
    } catch (x) {
      toast.error(errorMessage(x))
    }
  }

  const columns: Column<BusinessRow>[] = [
    {
      key: "name", header: "Business", hideable: false, sort: (r) => r.name.toLowerCase(), csv: (r) => r.name,
      cell: (r) => (
        <span className="flex items-center gap-3">
          <Avatar name={r.name} />
          <span className="min-w-0"><span className="block font-semibold">{r.name}</span><span className="block text-xs text-muted-foreground">{r.provisionedAt ? industryLabel(r.industryKey) : "Setting up in the ERP…"}</span></span>
        </span>
      ),
    },
    { key: "owner", header: "Owner", csv: (r) => r.ownerName, cell: (r) => <span className="grid"><span className="font-medium">{r.ownerName}</span><span className="text-xs text-muted-foreground">{r.ownerMobile}</span></span> },
    { key: "email", header: "Email", defaultHidden: true, csv: (r) => r.ownerEmail, cell: (r) => <span className="text-sm">{r.ownerEmail}</span> },
    { key: "plan", header: "Plan", csv: (r) => r.subscription?.plan.name ?? "", cell: (r) => r.subscription ? <span className="grid"><span className="font-medium">{r.subscription.plan.name}</span><span className="text-xs text-muted-foreground capitalize">{r.subscription.cycle ?? ""}</span></span> : "—" },
    {
      key: "status", header: "Status", csv: (r) => (r.subscription ? BUSINESS_PILL[r.subscription.status].label : ""),
      cell: (r) => {
        if (!r.subscription) return "—"
        const p = r.partner && r.subscription.status === "active" ? { label: "Live", color: "emerald" } : BUSINESS_PILL[r.subscription.status]
        const days = r.subscription.status === "trialing" && r.subscription.trialEndsAt ? Math.max(0, Math.ceil((new Date(r.subscription.trialEndsAt).getTime() - Date.now()) / 86_400_000)) : null
        return <span className="grid justify-items-start gap-1"><Pill color={p.color} dot>{p.label}</Pill>{days !== null && <span className="text-[11px] text-muted-foreground">{days ? `${days} day${days === 1 ? "" : "s"} left` : "ends today"}</span>}</span>
      },
    },
    { key: "signin", header: "Owner signed in", csv: (r) => (r.progress?.signedIn ? "Yes" : "No"), cell: (r) => (r.progress?.signedIn ? <Pill color="emerald">Yes</Pill> : <Pill color="rose">Not yet</Pill>) },
    { key: "by", header: "Brought by", csv: (r) => r.partner?.name ?? r.onboarder?.name ?? r.onboardedBy, cell: (r) => { const k = r.partner ? "partner" : r.onboardedBy; return <span className="grid justify-items-start gap-0.5"><Pill color={BY_PILL[k].color}>{BY_PILL[k].label}</Pill>{(r.partner?.name ?? r.onboarder?.name) && <span className="text-[11px] text-muted-foreground">{r.partner?.name ?? r.onboarder?.name}</span>}</span> } },
    { key: "active", header: "Last active", csv: (r) => r.progress?.lastActiveAt ?? "", cell: (r) => <span className="text-sm text-muted-foreground">{r.progress?.lastActiveAt ? ago(r.progress.lastActiveAt) : "—"}</span> },
    { key: "gstin", header: "GSTIN", defaultHidden: true, csv: (r) => r.gstin ?? "", cell: (r) => <span className="font-mono text-xs">{r.gstin ?? "—"}</span> },
    { key: "added", header: "Added", sort: (r) => r.createdAt, csv: (r) => formatDate(r.createdAt), cell: (r) => <span className="text-sm text-muted-foreground">{formatDate(r.createdAt)}</span> },
    {
      key: "actions", header: "Actions", hideable: false,
      cell: (r) => (
        <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Link href={`/businesses/${r.id}`} className={iconBtn} title="Open" aria-label={`Open ${r.name}`}><Eye /></Link>
          <ActionMenu items={[
            r.subscription?.status !== "closed" && { label: "Send a login link", icon: KeyRound, onClick: () => void sendLink(r) },
            !r.partner && r.subscription?.status !== "closed" && !partner && { label: "New order", icon: ReceiptText, href: `/businesses/${r.id}?tab=billing` },
            team && r.subscription?.status === "trialing" && { label: "Extend the trial", icon: CalendarClock, onClick: () => setDialog({ kind: "days", rows: [r] }) },
          ]} />
        </span>
      ),
    },
  ]

  const bulk: BulkAction<BusinessRow>[] = [
    { label: "Send login links", run: (rows) => setDialog({ kind: "link", rows: rows.filter((r) => !r.progress?.signedIn && r.subscription?.status !== "closed") }) },
    ...(team ? [{ label: "Extend trials", run: (rows: BusinessRow[]) => setDialog({ kind: "days", rows: rows.filter((r) => r.subscription?.status === "trialing") }) }] : []),
  ]

  return (
    <>
      <DataList<BusinessRow>
        id="businesses"
        load={load}
        params={{ v: String(tick) }}
        header={{
          title: partner ? "Clients" : is("sales", "vendor") ? "My businesses" : "Businesses",
          description: partner ? "Your clients on AHEAD. You pay for them in one monthly bill." : "Every business you can see, with its plan, status and progress.",
          primary: <HeaderLink href="/businesses/new" primary><Plus /> {partner ? "Add client" : "Add business"}</HeaderLink>,
        }}
        columns={columns}
        searchPlaceholder="Search name, owner, email, mobile or GSTIN"
        presets={[
          { key: "all", label: "All", params: {}, countKey: "all" },
          { key: "trialing", label: "Trial", params: { status: "trialing" }, countKey: "trialing" },
          { key: "active", label: partner ? "Live" : "Paying", params: { status: "active" }, countKey: "active" },
          ...(partner ? [] : [{ key: "past_due", label: "Overdue", params: { status: "past_due" }, countKey: "past_due" }, { key: "incomplete", label: "Awaiting payment", params: { status: "incomplete" }, countKey: "incomplete" }]),
          { key: "free", label: "Free", params: { status: "free" }, countKey: "free" },
          { key: "closed", label: "Closed", params: { status: "closed" }, countKey: "closed" },
        ]}
        defaultPreset={status ?? undefined}
        tabs
        filters={[
          { key: "plan", label: "Plan", options: (plans.data?.data ?? []).map((p) => ({ value: p.key, label: p.name })) },
          ...(partner ? [] : [{ key: "onboardedBy", label: "Brought by", options: Object.entries(BY_PILL).map(([k, v]) => ({ value: k, label: v.label })) }]),
          ...(team && (partners.data?.data.length ?? 0) > 0 ? [{ key: "partnerId", label: "Partner", options: partners.data!.data.map((p) => ({ value: p.id, label: p.name })) }] : []),
          { key: "notSignedIn", label: "Owner signed in", options: [{ value: "1", label: "Not yet" }] },
        ]}
        top={(res) => {
          const c = (res.counts ?? {}) as Record<string, number>
          const all = c.all ?? 0
          return (
            <SummaryCards items={[
              { label: "Businesses", value: all - (c.closed ?? 0), hint: `${c.closed ?? 0} closed`, color: "blue", icon: Building2 },
              { label: partner ? "Live on a plan" : "Paying", value: c.active ?? 0, hint: c.past_due ? `${c.past_due} overdue` : "All paid up", color: "emerald", icon: Wallet },
              { label: "On trial", value: c.trialing ?? 0, hint: "Every module open", color: "violet", icon: CalendarClock },
              { label: "On Free", value: c.free ?? 0, hint: partner ? "Not on your bill" : "Can upgrade any time", color: "amber", icon: TrendingUp },
            ]} />
          )
        }}
        rowHref={(r) => `/businesses/${r.id}`}
        bulkActions={bulk}
        exportName="businesses"
        emptyState={<EmptyState icon={Building2} title={partner ? "No clients yet" : "No businesses yet"} description="Add a business and its owner. The ERP makes the workspace in seconds and the owner gets a login link." action={<HeaderLink href="/businesses/new" primary><Plus /> {partner ? "Add client" : "Add business"}</HeaderLink>} />}
      />
      {dialog?.kind === "link" && <BulkLinks rows={dialog.rows} onClose={() => setDialog(null)} onDone={() => setTick((t) => t + 1)} />}
      {dialog?.kind === "days" && <BulkDays rows={dialog.rows} onClose={() => setDialog(null)} onDone={() => setTick((t) => t + 1)} />}
    </>
  )
}

/** One at a time, so each is checked and recorded like a single change; says which failed */
async function each(rows: BusinessRow[], fn: (r: BusinessRow) => Promise<unknown>) {
  const failed: string[] = []
  for (const r of rows) {
    try {
      await fn(r)
    } catch (e) {
      failed.push(`${r.name}: ${errorMessage(e)}`)
    }
  }
  return failed
}

function BulkLinks({ rows, onClose, onDone }: { rows: BusinessRow[]; onClose: () => void; onDone: () => void }) {
  return (
    <ActionDialog open onOpenChange={() => onClose()} title={rows.length ? `Send ${rows.length} login link${rows.length === 1 ? "" : "s"}?` : "Nothing to send"} submitLabel="Send links"
      description={rows.length ? "Each owner who hasn’t signed in gets a fresh link by email; their old link stops working." : "Every owner you picked has signed in already."}
      onSubmit={async () => {
        if (!rows.length) return
        const failed = await each(rows, (r) => api.post(`/businesses/${r.id}/owner-link`))
        if (failed.length) toast.error(failed.join("\n"))
        else toast.success(`${rows.length} link${rows.length === 1 ? "" : "s"} sent`)
        onDone()
      }}>
      <ul className="max-h-40 overflow-y-auto text-sm text-muted-foreground">{rows.map((r) => <li key={r.id}>{r.name} · {r.ownerEmail}</li>)}</ul>
    </ActionDialog>
  )
}

function BulkDays({ rows, onClose, onDone }: { rows: BusinessRow[]; onClose: () => void; onDone: () => void }) {
  const [days, setDays] = React.useState("7")
  const [error, setError] = React.useState<string>()
  return (
    <ActionDialog open onOpenChange={() => onClose()} title={rows.length === 1 ? `Extend ${rows[0].name}’s trial` : `Extend ${rows.length} trials`} submitLabel="Extend"
      description={rows.length ? "Adds days to the end of each trial. Every module stays open until then." : "None of the businesses you picked is on a trial."}
      onSubmit={async () => {
        const n = Number(days)
        if (!(n >= 1 && n <= 60)) { setError("From 1 to 60 days"); return { days: "x" } }
        const failed = await each(rows, (r) => api.post(`/businesses/${r.id}/trial`, { days: n }))
        if (failed.length) toast.error(failed.join("\n"))
        else toast.success(`${rows.length} trial${rows.length === 1 ? "" : "s"} extended by ${n} days`)
        onDone()
      }}>
      {rows.length > 0 && <Field label="Days to add" required error={error}><NumberStepper value={days} onChange={setDays} min={1} max={60} aria-label="Days to add" className="w-36" /></Field>}
    </ActionDialog>
  )
}
