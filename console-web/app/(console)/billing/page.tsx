"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { BadgeCheck, Ban, Clock, Copy, CreditCard, Eye, FileText, Hourglass, Send, Wallet } from "lucide-react"
import { ActionDialog } from "@/components/action-dialog"
import { EmptyState } from "@/components/common"
import { DataList, pagedList, type Column } from "@/components/data-list"
import { CancelDialog, PaymentDialog } from "@/components/order-actions"
import { ActionMenu, Pill } from "@/components/page-parts"
import { SummaryCards } from "@/components/summary-cards"
import { money, relDays } from "@/components/kit"
import { api, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import { ORDER_PILL, billingMore } from "@/lib/pills"
import type { Order } from "@/lib/types"

// Orders: what each order costs, who pays and whether it's paid. Approve a discount, send the
// link again, record money received outside the link, or cancel — from the row.

const iconBtn = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4"

export default function OrdersPage() {
  const { is, team } = useAuth()
  const [tick, setTick] = React.useState(0)
  const [act, setAct] = React.useState<{ kind: "cancel" | "pay" | "approve"; order: Order } | null>(null)
  const status = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("status")
  const load = React.useMemo(() => pagedList<Order>("/billing/orders"), [])
  const reload = () => setTick((t) => t + 1)

  const resend = async (o: Order) => {
    try {
      await api.post(`/billing/orders/${o.id}/link`)
      toast.success(`Payment link sent again to ${o.billTo.email}`)
      reload()
    } catch (x) {
      toast.error(errorMessage(x))
    }
  }

  const columns: Column<Order>[] = [
    { key: "business", header: "Business", hideable: false, csv: (o) => o.business?.name ?? "", cell: (o) => <span className="grid"><span className="font-semibold">{o.business?.name ?? "—"}</span><span className="text-xs text-muted-foreground">Bill to {o.billTo.name}</span></span> },
    { key: "plan", header: "Plan", csv: (o) => `${o.planKey} ${o.cycle}`, cell: (o) => <span className="grid"><span className="font-medium capitalize">{o.planKey} · {o.cycle}</span>{o.extraUsers > 0 && <span className="text-xs text-muted-foreground">+{o.extraUsers} users</span>}</span> },
    { key: "kind", header: "Kind", csv: (o) => o.kind, cell: (o) => <Pill color={o.kind === "renewal" ? "cyan" : o.kind === "change" ? "violet" : "blue"}>{o.kind === "renewal" ? "Renewal" : o.kind === "change" ? "Plan change" : "New"}</Pill> },
    { key: "discount", header: "Discount", csv: (o) => o.couponCode ?? (o.discountPct ? `${o.discountPct}%` : ""), cell: (o) => <span className="text-sm text-muted-foreground">{o.couponCode ? <span className="font-mono">{o.couponCode}</span> : o.discountPct ? `${o.discountPct}%` : "—"}</span> },
    { key: "total", header: "Total", align: "right", sort: (o) => o.totalPaise, csv: (o) => (o.totalPaise / 100).toFixed(2), cell: (o) => <span className="font-semibold tabular-nums">{money(o.totalPaise)}</span> },
    { key: "status", header: "Status", csv: (o) => ORDER_PILL[o.status].label, cell: (o) => <span className="grid justify-items-start gap-1"><Pill color={ORDER_PILL[o.status].color} dot>{ORDER_PILL[o.status].label}</Pill>{o.status === "awaiting_payment" && <span className="text-[11px] text-muted-foreground">link ends {relDays(o.expiresAt)}</span>}</span> },
    { key: "invoice", header: "Invoice", csv: (o) => o.invoice?.number ?? "", cell: (o) => (o.invoice ? <Link href={`/invoices/${o.invoice.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs text-primary hover:underline">{o.invoice.number}</Link> : <span className="text-muted-foreground">—</span>) },
    { key: "made", header: "Made", sort: (o) => o.createdAt, csv: (o) => formatDate(o.createdAt), cell: (o) => <span className="text-sm text-muted-foreground">{formatDate(o.createdAt)}</span> },
    {
      key: "actions", header: "Actions", hideable: false,
      cell: (o) => (
        <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Link href={`/businesses/${o.businessId}?tab=billing`} className={iconBtn} title="Open the business" aria-label="Open the business"><Eye /></Link>
          {o.status === "pending_approval" && is("admin") && <button type="button" className={iconBtn} title="Approve the discount" aria-label="Approve the discount" onClick={() => setAct({ kind: "approve", order: o })}><BadgeCheck /></button>}
          {o.status === "awaiting_payment" && team && <button type="button" className={iconBtn} title="Record a payment" aria-label="Record a payment" onClick={() => setAct({ kind: "pay", order: o })}><Wallet /></button>}
          <ActionMenu items={[
            o.invoice && { label: `Open invoice ${o.invoice.number}`, icon: FileText, href: `/invoices/${o.invoice.id}` },
            o.status === "awaiting_payment" && { label: "Send the payment link again", icon: Send, onClick: () => void resend(o) },
            o.status === "awaiting_payment" && o.linkUrl && { label: "Copy the payment link", icon: Copy, onClick: () => { void navigator.clipboard.writeText(o.linkUrl!); toast.success("Link copied") } },
            "-",
            (o.status === "awaiting_payment" || o.status === "pending_approval") && { label: "Cancel order", icon: Ban, destructive: true, onClick: () => setAct({ kind: "cancel", order: o }) },
          ]} />
        </span>
      ),
    },
  ]

  return (
    <>
      <DataList<Order>
        id="orders"
        load={load}
        params={{ v: String(tick) }}
        header={{ title: "Orders", description: "Every order for a plan: what it costs, who pays, and whether it’s paid. New orders are made from a business’s page.", more: billingMore(team, "orders") }}
        columns={columns}
        searchPlaceholder="Search business name"
        presets={[
          { key: "all", label: "All", params: {}, countKey: "all" },
          { key: "pending_approval", label: "Needs approval", params: { status: "pending_approval" }, countKey: "pending_approval" },
          { key: "awaiting_payment", label: "Awaiting payment", params: { status: "awaiting_payment" }, countKey: "awaiting_payment" },
          { key: "paid", label: "Paid", params: { status: "paid" }, countKey: "paid" },
          { key: "cancelled", label: "Cancelled", params: { status: "cancelled" }, countKey: "cancelled" },
          { key: "expired", label: "Expired", params: { status: "expired" }, countKey: "expired" },
        ]}
        defaultPreset={status ?? undefined}
        tabs
        filters={[{ key: "kind", label: "Kind", options: [{ value: "new", label: "New" }, { value: "renewal", label: "Renewal" }, { value: "change", label: "Plan change" }] }]}
        top={(res) => {
          const c = (res.counts ?? {}) as Record<string, number>
          return <SummaryCards items={[
            { label: "Orders", value: c.all ?? 0, hint: "All time", color: "blue", icon: CreditCard },
            { label: "Awaiting payment", value: c.awaiting_payment ?? 0, hint: "Link sent, not paid yet", color: "amber", icon: Hourglass },
            { label: "Needs approval", value: c.pending_approval ?? 0, hint: "Discount above the limit", color: "violet", icon: Clock },
            { label: "Paid", value: c.paid ?? 0, hint: `${c.cancelled ?? 0} cancelled · ${c.expired ?? 0} expired`, color: "emerald", icon: Wallet },
          ]} />
        }}
        rowHref={(o) => `/businesses/${o.businessId}?tab=billing`}
        exportName="orders"
        emptyState={<EmptyState icon={CreditCard} title="No orders yet" description="Orders are made from a business’s page, or when an owner picks a plan in the ERP." />}
      />
      {act?.kind === "approve" && (
        <ActionDialog open onOpenChange={() => setAct(null)} title="Approve this discount?" submitLabel="Approve and send link"
          description={`${act.order.business?.name}: ${act.order.couponCode ?? `${act.order.discountPct}% off`}, total ${money(act.order.totalPaise)}. The payment link goes to ${act.order.billTo.email}.`}
          onSubmit={async () => { await api.post(`/billing/orders/${act.order.id}/approve`); toast.success("Approved; the payment link is on its way"); reload() }} />
      )}
      {act?.kind === "cancel" && <CancelDialog order={act.order} onClose={() => setAct(null)} onDone={reload} />}
      {act?.kind === "pay" && <PaymentDialog order={act.order} onClose={() => setAct(null)} onDone={reload} />}
    </>
  )
}
