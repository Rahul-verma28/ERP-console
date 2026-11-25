"use client"

import * as React from "react"
import { History } from "lucide-react"
import { EmptyState } from "@/components/common"
import { DataList, pagedList, type Column } from "@/components/data-list"
import { Avatar, Pill } from "@/components/page-parts"
import { SidePanel } from "@/components/side-panel"
import { ago } from "@/components/kit"
import { useApi } from "@/lib/use-api"
import { formatDateTime } from "@/lib/format"
import type { Activity, Person } from "@/lib/types"

// Admin: who changed what and when — the audit trail, with before and after on each entry.

const AREAS: [string, string][] = [["business", "Businesses"], ["order", "Orders"], ["invoice", "Invoices"], ["partner", "Partners"], ["application", "Applications"], ["plan", "Plans"], ["coupon", "Coupons"], ["settings", "Settings"], ["team", "Team"], ["auth", "Sign-ins"], ["session", "Sessions"], ["job", "Jobs"]]
const AREA_COLOR: Record<string, string> = { business: "blue", order: "amber", invoice: "amber", partner: "violet", application: "violet", plan: "emerald", coupon: "emerald", settings: "cyan", team: "violet", auth: "slate", session: "slate", job: "slate" }
const load = pagedList<Activity>("/console/audit")

export default function SecurityPage() {
  const people = useApi<{ data: Person[] }>("/team")
  const [open, setOpen] = React.useState<Activity | null>(null)
  const columns: Column<Activity>[] = [
    { key: "when", header: "When", csv: (a) => a.at, cell: (a) => <span className="grid"><span className="font-medium">{formatDateTime(a.at)}</span><span className="text-xs text-muted-foreground">{ago(a.at)}</span></span> },
    { key: "what", header: "What happened", hideable: false, csv: (a) => a.text, className: "min-w-[22rem] whitespace-normal", cell: (a) => <span>{a.text}</span> },
    { key: "area", header: "Area", csv: (a) => a.area, cell: (a) => <Pill color={AREA_COLOR[a.area] ?? "slate"}>{AREAS.find(([k]) => k === a.area)?.[1] ?? a.area}</Pill> },
    { key: "by", header: "By", csv: (a) => a.actor ?? "System", cell: (a) => <span className="flex items-center gap-2"><Avatar name={a.actor ?? "AHEAD"} className="size-7" /><span className="text-sm">{a.actor ?? "System"}</span></span> },
    { key: "ip", header: "IP", defaultHidden: true, csv: (a) => a.ip ?? "", cell: (a) => <span className="font-mono text-xs text-muted-foreground">{a.ip ?? "—"}</span> },
  ]
  return (
    <>
      <DataList<Activity>
        id="audit"
        load={load}
        header={{ title: "Security & audit", description: "Every change made in the Console: who did it, when, and what it was before and after.", more: [{ label: "Signed in now", href: "/security/sessions" }] }}
        columns={columns}
        noSearch
        filters={[
          { key: "area", label: "Area", options: AREAS.map(([value, label]) => ({ value, label })) },
          { key: "actorId", label: "Person", options: (people.data?.data ?? []).map((p) => ({ value: p.id, label: p.name })) },
        ]}
        rowClick={setOpen}
        exportName="audit-trail"
        emptyState={<EmptyState icon={History} title="Nothing recorded yet" description="Changes made in the Console show here." />}
      />
      <SidePanel open={!!open} onOpenChange={(o) => !o && setOpen(null)} eyebrow="Audit entry" title={open?.text ?? ""}>
        {open && (
          <div className="grid content-start gap-4 px-5 py-5 text-sm">
            <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
              <dt className="text-muted-foreground">When</dt><dd>{formatDateTime(open.at)}</dd>
              <dt className="text-muted-foreground">By</dt><dd>{open.actor ?? "System"}</dd>
              <dt className="text-muted-foreground">Action</dt><dd className="font-mono text-xs">{open.action}</dd>
              {open.ip && <><dt className="text-muted-foreground">IP</dt><dd className="font-mono text-xs">{open.ip}</dd></>}
            </dl>
            {open.before != null && <Json label="Before" value={open.before} />}
            {open.after != null && <Json label="After" value={open.after} />}
          </div>
        )}
      </SidePanel>
    </>
  )
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</h3>
      <pre className="max-h-72 overflow-auto rounded-xl bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>
    </section>
  )
}
