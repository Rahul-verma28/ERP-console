"use client"

import * as React from "react"
import Link from "next/link"
import { Banknote, Eye, FileText, Landmark, Smartphone, Wallet } from "lucide-react"
import { EmptyState } from "@/components/common"
import { DataList, pagedList, type Column } from "@/components/data-list"
import { ActionMenu, Pill } from "@/components/page-parts"
import { SummaryCards } from "@/components/summary-cards"
import { money } from "@/components/kit"
import { useAuth } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import { METHOD_LABEL, billingMore } from "@/lib/pills"
import type { Payment } from "@/lib/types"

// Money AHEAD received: online through the payment link, or recorded by the team.

const iconBtn = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4"
const METHOD_COLOR: Record<string, string> = { online: "blue", bank: "emerald", upi: "violet", cheque: "amber", cash: "slate" }

export default function PaymentsPage() {
  const { team } = useAuth()
  const load = React.useMemo(() => pagedList<Payment>("/billing/payments"), [])
  const columns: Column<Payment>[] = [
    { key: "date", header: "Received", sort: (p) => p.receivedAt, csv: (p) => formatDate(p.receivedAt), cell: (p) => <span className="font-medium">{formatDate(p.receivedAt)}</span> },
    { key: "business", header: "Business", hideable: false, csv: (p) => p.order.business.name, cell: (p) => <span className="font-semibold">{p.order.business.name}</span> },
    { key: "for", header: "For", csv: (p) => `${p.order.planKey} ${p.order.cycle}`, cell: (p) => <span className="text-sm capitalize text-muted-foreground">{p.order.planKey} · {p.order.cycle}</span> },
    { key: "method", header: "Paid by", csv: (p) => METHOD_LABEL[p.method] ?? p.method, cell: (p) => <Pill color={METHOD_COLOR[p.method] ?? "slate"}>{METHOD_LABEL[p.method] ?? p.method}</Pill> },
    { key: "ref", header: "Reference", csv: (p) => p.reference ?? "", cell: (p) => <span className="font-mono text-xs text-muted-foreground">{p.reference ?? "—"}</span> },
    { key: "amount", header: "Amount", align: "right", sort: (p) => p.amountPaise, csv: (p) => (p.amountPaise / 100).toFixed(2), cell: (p) => <span className="font-semibold tabular-nums">{money(p.amountPaise)}</span> },
    { key: "invoice", header: "Invoice", csv: (p) => p.order.invoice?.number ?? "", cell: (p) => (p.order.invoice ? <Link href={`/invoices/${p.order.invoice.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs text-primary hover:underline">{p.order.invoice.number}</Link> : "—") },
    {
      key: "actions", header: "Actions", hideable: false,
      cell: (p) => (
        <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Link href={`/businesses/${p.order.business.id}?tab=billing`} className={iconBtn} title="Open the business" aria-label="Open the business"><Eye /></Link>
          <ActionMenu items={[p.order.invoice && { label: "Open the invoice", icon: FileText, href: `/invoices/${p.order.invoice.id}` }]} />
        </span>
      ),
    },
  ]
  return (
    <DataList<Payment>
      id="payments"
      load={load}
      header={{ title: "Payments", description: "Money AHEAD received: online through the payment link, or recorded by the team.", more: billingMore(team, "payments") }}
      columns={columns}
      searchPlaceholder="Search business name"
      filters={[{ key: "method", label: "Paid by", options: Object.entries(METHOD_LABEL).map(([value, label]) => ({ value, label })) }]}
      top={(res) => {
        const sum = (res.sumPaise as number | undefined) ?? 0
        const n = (res.total as number | undefined) ?? 0
        const m = (res.byMethod ?? {}) as Record<string, { paise: number; count: number }>
        const of = (...keys: string[]) => keys.reduce((t, k) => ({ paise: t.paise + (m[k]?.paise ?? 0), count: t.count + (m[k]?.count ?? 0) }), { paise: 0, count: 0 })
        const online = of("online")
        const bank = of("bank", "upi")
        const other = of("cheque", "cash")
        return <SummaryCards items={[
          { label: "Received", value: money(sum), hint: `${n} payment${n === 1 ? "" : "s"}`, color: "emerald", icon: Wallet },
          { label: "Online", value: money(online.paise), hint: `${online.count} through the payment link`, color: "blue", icon: Smartphone },
          { label: "Bank transfer or UPI", value: money(bank.paise), hint: `${bank.count} recorded by the team`, color: "violet", icon: Landmark },
          { label: "Cheque or cash", value: money(other.paise), hint: `${other.count} recorded by the team`, color: "amber", icon: Banknote },
        ]} />
      }}
      rowHref={(p) => `/businesses/${p.order.business.id}?tab=billing`}
      exportName="payments"
      emptyState={<EmptyState icon={Wallet} title="No payments yet" description="Payments through the link, and the ones your team records, show here." />}
    />
  )
}
