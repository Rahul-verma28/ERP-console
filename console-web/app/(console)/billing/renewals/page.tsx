"use client"

import Link from "next/link"
import { CalendarClock, Eye } from "lucide-react"
import { EmptyState } from "@/components/common"
import { DataList, localList, type Column } from "@/components/data-list"
import { Pill } from "@/components/page-parts"
import { money, relDays } from "@/components/kit"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import { BUSINESS_PILL, billingMore } from "@/lib/pills"
import type { Renewal } from "@/lib/types"

// Paid plans ending in the next 30 days, and whether the renewal order has gone out.

const iconBtn = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4"
const load = localList<Renewal>(async () => (await api.get<{ data: Renewal[] }>("/billing/renewals")).data, (r, q) => r.name.toLowerCase().includes(q) || r.plan.toLowerCase().includes(q))

export default function RenewalsPage() {
  const { team } = useAuth()
  const columns: Column<Renewal>[] = [
    { key: "name", header: "Business", hideable: false, sort: (r) => r.name, csv: (r) => r.name, cell: (r) => <span className="font-semibold">{r.name}</span> },
    { key: "plan", header: "Plan", csv: (r) => `${r.plan} ${r.cycle}`, cell: (r) => <span className="capitalize">{r.plan} · {r.cycle}</span> },
    { key: "ends", header: "Period ends", sort: (r) => r.periodEnd, csv: (r) => formatDate(r.periodEnd), cell: (r) => <span className="grid"><span className="font-medium">{formatDate(r.periodEnd)}</span><span className="text-xs text-muted-foreground">{relDays(r.periodEnd)}</span></span> },
    { key: "status", header: "Status", csv: (r) => BUSINESS_PILL[r.status].label, cell: (r) => <Pill color={r.partnerBilled && r.status === "active" ? "emerald" : BUSINESS_PILL[r.status].color} dot>{r.partnerBilled && r.status === "active" ? "Live" : BUSINESS_PILL[r.status].label}</Pill> },
    { key: "renewal", header: "Renewal", csv: (r) => (r.partnerBilled ? "Partner bill" : r.renewalOrder ? "Link sent" : "Not yet"), cell: (r) => (r.partnerBilled ? <span className="text-sm text-muted-foreground">On the partner’s bill</span> : r.renewalOrder ? <Pill color="amber">Link sent · {money(r.renewalOrder.totalPaise)}</Pill> : <span className="text-sm text-muted-foreground">Goes out before {formatDate(r.periodEnd)}</span>) },
    { key: "actions", header: "Actions", hideable: false, cell: (r) => <span onClick={(e) => e.stopPropagation()}><Link href={`/businesses/${r.businessId}?tab=billing`} className={iconBtn} title="Open the business" aria-label={`Open ${r.name}`}><Eye /></Link></span> },
  ]
  return (
    <DataList<Renewal>
      id="renewals"
      load={load}
      header={{ title: "Renewals", description: "Paid plans ending in the next 30 days. The renewal order and its link go out by themselves before the end.", more: billingMore(team, "renewals") }}
      columns={columns}
      searchPlaceholder="Search business or plan"
      rowHref={(r) => `/businesses/${r.businessId}?tab=billing`}
      exportName="renewals"
      emptyState={<EmptyState icon={CalendarClock} title="No renewals in the next 30 days" description="Paid plans that end soon show here, with their renewal order." />}
    />
  )
}
