"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Eye, Handshake, Pencil, Percent, Plus, Users, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common"
import { DataList, countBy, localList, type Column } from "@/components/data-list"
import { ActionMenu, Avatar, Pill } from "@/components/page-parts"
import { SummaryCards } from "@/components/summary-cards"
import { PartnerDialog } from "@/components/partner-dialog"
import { money } from "@/components/kit"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { PERSON_PILL } from "@/lib/pills"
import type { Partner } from "@/lib/types"

// Resellers: each brings its own clients and pays one monthly bill at list price less its discount.

const iconBtn = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4"
const load = localList<Partner>(
  async () => (await api.get<{ data: Partner[] }>("/partners")).data,
  (p, q) => [p.name, p.code, p.contactName, p.email, p.mobile, p.city ?? ""].some((v) => v.toLowerCase().includes(q)),
  {
    filter: (p, params) => !params.status || p.status === params.status,
    counts: (rows) => countBy(rows, (p) => p.status),
    meta: (rows) => ({ clients: rows.reduce((t, p) => t + (p.liveBusinesses ?? 0), 0), all: rows.reduce((t, p) => t + (p.businesses ?? 0), 0), unpaid: rows.reduce((t, p) => t + (p.unpaidPaise ?? 0), 0), owing: rows.filter((p) => (p.unpaidPaise ?? 0) > 0).length, avg: rows.length ? Math.round(rows.reduce((t, p) => t + p.discountPct, 0) / rows.length) : 0 }),
  },
)

export default function PartnersPage() {
  const router = useRouter()
  const { is } = useAuth()
  const admin = is("admin")
  const [tick, setTick] = React.useState(0)
  const [dialog, setDialog] = React.useState<null | { partner?: Partner }>(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("add") && is("admin") ? {} : null))

  const columns: Column<Partner>[] = [
    { key: "name", header: "Partner", hideable: false, sort: (p) => p.name.toLowerCase(), csv: (p) => p.name, cell: (p) => <span className="flex items-center gap-3"><Avatar name={p.name} /><span className="grid"><span className="font-semibold">{p.name}</span><span className="font-mono text-xs text-muted-foreground">{p.code}</span></span></span> },
    { key: "contact", header: "Contact", csv: (p) => p.contactName, cell: (p) => <span className="grid"><span className="font-medium">{p.contactName}</span><span className="text-xs text-muted-foreground">{p.mobile}</span></span> },
    { key: "email", header: "Email", defaultHidden: true, csv: (p) => p.email, cell: (p) => <span className="text-sm">{p.email}</span> },
    { key: "city", header: "City", defaultHidden: true, csv: (p) => p.city ?? "", cell: (p) => <span className="text-sm">{p.city ?? "—"}</span> },
    { key: "discount", header: "Discount", align: "right", sort: (p) => p.discountPct, csv: (p) => p.discountPct, cell: (p) => <span className="font-semibold tabular-nums">{p.discountPct}%</span> },
    { key: "clients", header: "Live clients", align: "right", sort: (p) => p.liveBusinesses ?? 0, csv: (p) => p.liveBusinesses ?? 0, cell: (p) => <span className="tabular-nums">{p.liveBusinesses ?? 0}<span className="text-muted-foreground"> / {p.businesses ?? 0}</span></span> },
    { key: "unpaid", header: "Unpaid", align: "right", sort: (p) => p.unpaidPaise ?? 0, csv: (p) => ((p.unpaidPaise ?? 0) / 100).toFixed(2), cell: (p) => (p.unpaidPaise ? <span className="font-semibold text-amber-700 tabular-nums dark:text-amber-400">{money(p.unpaidPaise)}</span> : <span className="text-muted-foreground">—</span>) },
    { key: "people", header: "People", align: "right", defaultHidden: true, csv: (p) => p.people ?? 0, cell: (p) => <span className="tabular-nums">{p.people ?? 0}</span> },
    { key: "status", header: "Status", csv: (p) => PERSON_PILL[p.status]?.label ?? p.status, cell: (p) => <Pill color={PERSON_PILL[p.status]?.color} dot>{PERSON_PILL[p.status]?.label ?? p.status}</Pill> },
    {
      key: "actions", header: "Actions", hideable: false,
      cell: (p) => (
        <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Link href={`/partners/${p.id}`} className={iconBtn} title="Open" aria-label={`Open ${p.name}`}><Eye /></Link>
          {admin && <button type="button" className={iconBtn} title="Edit" aria-label={`Edit ${p.name}`} onClick={() => setDialog({ partner: p })}><Pencil /></button>}
          <ActionMenu items={[{ label: "Clients", icon: Users, href: `/businesses?partnerId=${p.id}` }]} />
        </span>
      ),
    },
  ]

  return (
    <>
      <DataList<Partner>
        id="partners"
        load={load}
        params={{ v: String(tick) }}
        header={{
          title: "Partners",
          description: "Companies that sell AHEAD to their own clients and pay one monthly bill at their discount.",
          primary: admin && <Button className="h-10 rounded-xl px-4 font-semibold" onClick={() => setDialog({})}><Plus /> Add partner</Button>,
          more: [{ label: "Applications", href: "/applications" }],
        }}
        columns={columns}
        searchPlaceholder="Search name, code, contact, mobile or city"
        presets={[
          { key: "all", label: "All", params: {}, countKey: "all" },
          { key: "active", label: "Active", params: { status: "active" }, countKey: "active" },
          { key: "disabled", label: "Inactive", params: { status: "disabled" }, countKey: "disabled" },
        ]}
        tabs
        top={(res) => {
          const c = (res.counts ?? {}) as Record<string, number>
          return <SummaryCards items={[
            { label: "Partners", value: c.all ?? 0, hint: `${c.active ?? 0} active`, color: "blue", icon: Handshake },
            { label: "Live clients", value: (res.clients as number) ?? 0, hint: `${(res.all as number) ?? 0} in all`, color: "emerald", icon: Users },
            { label: "Unpaid bills", value: money((res.unpaid as number) ?? 0), hint: `${(res.owing as number) ?? 0} partners owe`, color: "amber", icon: Wallet },
            { label: "Average discount", value: `${(res.avg as number) ?? 0}%`, hint: "Off list price", color: "violet", icon: Percent },
          ]} />
        }}
        rowHref={(p) => `/partners/${p.id}`}
        exportName="partners"
        emptyState={<EmptyState icon={Handshake} title="No partners yet" description="Approve an application, or add a partner yourself. Its owner gets an invite to the partner portal." action={admin ? <Button onClick={() => setDialog({})}><Plus /> Add partner</Button> : undefined} />}
      />
      {dialog && (
        <PartnerDialog
          partner={dialog.partner}
          onClose={() => setDialog(null)}
          onSaved={(p) => {
            setDialog(null)
            if (dialog.partner) { toast.success("Saved"); setTick((t) => t + 1) }
            else { toast.success(`${p.name} added. Its owner gets an invite to set a password.`); router.push(`/partners/${p.id}`) }
          }}
        />
      )}
    </>
  )
}
