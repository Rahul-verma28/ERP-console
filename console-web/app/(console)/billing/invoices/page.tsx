"use client"

import * as React from "react"
import Link from "next/link"
import { Eye, FileText, Printer } from "lucide-react"
import { EmptyState } from "@/components/common"
import { DataList, pagedList, type Column } from "@/components/data-list"
import { ActionMenu, Pill } from "@/components/page-parts"
import { money } from "@/components/kit"
import { useAuth } from "@/lib/auth"
import { formatDate } from "@/lib/format"
import { billingMore } from "@/lib/pills"
import type { Invoice } from "@/lib/types"

// AHEAD's GST invoices, one for every paid order, and the credit notes against them.

const iconBtn = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4"

export default function InvoicesPage() {
  const { team } = useAuth()
  const load = React.useMemo(() => pagedList<Invoice>("/billing/invoices"), [])
  const columns: Column<Invoice>[] = [
    { key: "number", header: "Invoice", hideable: false, csv: (i) => i.number, cell: (i) => <span className="font-mono text-[13px] font-semibold">{i.number}</span> },
    { key: "business", header: "Business", csv: (i) => i.order?.business?.name ?? i.billTo.name, cell: (i) => <span className="font-medium">{i.order?.business?.name ?? i.billTo.name}</span> },
    { key: "date", header: "Date", sort: (i) => i.issuedAt, csv: (i) => formatDate(i.issuedAt), cell: (i) => <span className="text-sm text-muted-foreground">{formatDate(i.issuedAt)}</span> },
    { key: "taxable", header: "Taxable", align: "right", defaultHidden: true, csv: (i) => (i.taxablePaise / 100).toFixed(2), cell: (i) => <span className="tabular-nums">{money(i.taxablePaise)}</span> },
    { key: "gst", header: "GST", align: "right", csv: (i) => ((i.cgstPaise + i.sgstPaise + i.igstPaise) / 100).toFixed(2), cell: (i) => <span className="tabular-nums text-muted-foreground">{money(i.cgstPaise + i.sgstPaise + i.igstPaise)}</span> },
    { key: "total", header: "Total", align: "right", sort: (i) => i.totalPaise, csv: (i) => (i.totalPaise / 100).toFixed(2), cell: (i) => <span className="font-semibold tabular-nums">{money(i.totalPaise)}</span> },
    { key: "status", header: "Status", csv: (i) => (i.creditNote ? `Credit note ${i.creditNote.number}` : "Issued"), cell: (i) => (i.creditNote ? <Pill color="slate">Credit note {i.creditNote.number}</Pill> : <Pill color="emerald" dot>Issued</Pill>) },
    {
      key: "actions", header: "Actions", hideable: false,
      cell: (i) => (
        <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Link href={`/invoices/${i.id}`} className={iconBtn} title="Open" aria-label={`Open ${i.number}`}><Eye /></Link>
          <ActionMenu items={[
            { label: "Print or save PDF", icon: Printer, href: `/invoices/${i.id}` },
            { label: "Open the business", icon: FileText, href: `/businesses/${i.businessId}?tab=billing` },
          ]} />
        </span>
      ),
    },
  ]
  return (
    <DataList<Invoice>
      id="invoices"
      load={load}
      header={{ title: "Invoices", description: "AHEAD’s GST invoices, one for every paid order, newest first.", more: billingMore(team, "invoices") }}
      columns={columns}
      searchPlaceholder="Search invoice number or business"
      rowHref={(i) => `/invoices/${i.id}`}
      exportName="invoices"
      emptyState={<EmptyState icon={FileText} title="No invoices yet" description="An invoice is made when an order is paid." />}
    />
  )
}
