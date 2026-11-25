"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BadgeCheck, Eye, FileText, Handshake, Inbox, Store, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/form"
import { NumberStepper } from "@/components/number-stepper"
import { ActionDialog, fieldErrors } from "@/components/action-dialog"
import { EmptyState } from "@/components/common"
import { DataList, countBy, localList, type Column } from "@/components/data-list"
import { FilesPanel } from "@/components/files-panel"
import { ActionMenu, Avatar, DetailList, Pill } from "@/components/page-parts"
import { SidePanel } from "@/components/side-panel"
import { SummaryCards } from "@/components/summary-cards"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { formatDateTime, GST_STATES } from "@/lib/format"
import { PERSON_PILL } from "@/lib/pills"
import type { Application } from "@/lib/types"

// People who asked on the website to sell AHEAD. A vendor gets a login and a referral code;
// a partner needs its KYC papers first, then becomes a partner with its owner invited.

const STATES = new Map(GST_STATES)
const iconBtn = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4"
const load = localList<Application>(
  async () => (await Promise.all(["new", "approved", "rejected"].map((s) => api.get<{ data: Application[] }>(`/applications?status=${s}`)))).flatMap((r) => r.data),
  (a, q) => [a.name, a.company ?? "", a.email, a.mobile, a.city ?? ""].some((v) => v.toLowerCase().includes(q)),
  { filter: (a, params) => (!params.status || a.status === params.status) && (!params.kind || a.kind === params.kind), counts: (rows) => countBy(rows, (a) => a.status), meta: (rows) => ({ vendors: rows.filter((a) => a.kind === "vendor").length, partners: rows.filter((a) => a.kind === "partner").length }) },
)

export default function ApplicationsPage() {
  const router = useRouter()
  const { is } = useAuth()
  const admin = is("admin")
  const [tick, setTick] = React.useState(0)
  const reload = () => setTick((t) => t + 1)
  const [open, setOpen] = React.useState<Application | null>(null)
  const [act, setAct] = React.useState<{ kind: "approve" | "reject"; a: Application } | null>(null)

  const columns: Column<Application>[] = [
    { key: "name", header: "Applicant", hideable: false, sort: (a) => (a.company ?? a.name).toLowerCase(), csv: (a) => a.company ?? a.name, cell: (a) => <span className="flex items-center gap-3"><Avatar name={a.company ?? a.name} /><span className="grid"><span className="font-semibold">{a.kind === "partner" ? a.company : a.name}</span><span className="text-xs text-muted-foreground">{a.kind === "partner" ? `${a.name} · ` : ""}{a.email}</span></span></span> },
    { key: "kind", header: "Wants to be", csv: (a) => a.kind, cell: (a) => <Pill color={a.kind === "partner" ? "violet" : "amber"}>{a.kind === "partner" ? "Partner" : "Vendor"}</Pill> },
    { key: "mobile", header: "Mobile", csv: (a) => a.mobile, cell: (a) => <span className="text-sm">{a.mobile}</span> },
    { key: "where", header: "Where", csv: (a) => [a.city, a.stateCode ? STATES.get(a.stateCode) : ""].filter(Boolean).join(", "), cell: (a) => <span className="text-sm text-muted-foreground">{[a.city, a.stateCode ? STATES.get(a.stateCode) : null].filter(Boolean).join(", ") || "—"}</span> },
    { key: "kyc", header: "KYC papers", csv: (a) => a.kycFiles, cell: (a) => (a.kind === "partner" ? a.kycFiles ? <Pill color="emerald">{a.kycFiles} added</Pill> : <Pill color="rose">Needed</Pill> : <span className="text-muted-foreground">—</span>) },
    { key: "date", header: "Applied", sort: (a) => a.createdAt, csv: (a) => a.createdAt, cell: (a) => <span className="text-sm text-muted-foreground">{formatDateTime(a.createdAt)}</span> },
    { key: "status", header: "Status", csv: (a) => PERSON_PILL[a.status].label, cell: (a) => <Pill color={PERSON_PILL[a.status].color} dot>{PERSON_PILL[a.status].label}</Pill> },
    {
      key: "actions", header: "Actions", hideable: false,
      cell: (a) => (
        <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" className={iconBtn} title="Open" aria-label="Open" onClick={() => setOpen(a)}><Eye /></button>
          {admin && a.status === "new" && <button type="button" className={iconBtn} title="Approve" aria-label="Approve" onClick={() => setAct({ kind: "approve", a })}><BadgeCheck /></button>}
          <ActionMenu items={[
            a.kind === "partner" && a.status === "new" && { label: "KYC papers", icon: FileText, onClick: () => setOpen(a) },
            "-",
            admin && a.status === "new" && { label: "Reject", icon: X, destructive: true, onClick: () => setAct({ kind: "reject", a }) },
          ]} />
        </span>
      ),
    },
  ]

  return (
    <>
      <DataList<Application>
        id="applications"
        load={load}
        params={{ v: String(tick) }}
        header={{ title: "Applications", description: "People who asked on the website to become a vendor or a partner.", more: [{ label: "Partners", href: "/partners" }] }}
        columns={columns}
        searchPlaceholder="Search name, company, email, mobile or city"
        presets={[
          { key: "new", label: "New", params: { status: "new" }, countKey: "new" },
          { key: "approved", label: "Approved", params: { status: "approved" }, countKey: "approved" },
          { key: "rejected", label: "Rejected", params: { status: "rejected" }, countKey: "rejected" },
          { key: "all", label: "All", params: {}, countKey: "all" },
        ]}
        tabs
        filters={[{ key: "kind", label: "Wants to be", options: [{ value: "vendor", label: "Vendor" }, { value: "partner", label: "Partner" }] }]}
        top={(res) => {
          const c = (res.counts ?? {}) as Record<string, number>
          return <SummaryCards items={[
            { label: "New", value: c.new ?? 0, hint: "Waiting for a decision", color: "blue", icon: Inbox },
            { label: "Vendors", value: (res.vendors as number) ?? 0, hint: "Bring businesses with a code", color: "amber", icon: Store },
            { label: "Partners", value: (res.partners as number) ?? 0, hint: "Resell under their own name", color: "violet", icon: Handshake },
            { label: "Approved", value: c.approved ?? 0, hint: `${c.rejected ?? 0} rejected`, color: "emerald", icon: BadgeCheck },
          ]} />
        }}
        rowClick={setOpen}
        exportName="applications"
        emptyState={<EmptyState icon={Inbox} title="No applications yet" description="People who fill the website’s sell-AHEAD form show here." />}
      />

      <SidePanel open={!!open} onOpenChange={(o) => !o && setOpen(null)} eyebrow={open?.kind === "partner" ? "Partner application" : "Vendor application"} title={open ? (open.kind === "partner" ? open.company ?? open.name : open.name) : ""}
        action={open && admin && open.status === "new" ? <span className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => setAct({ kind: "reject", a: open })}>Reject</Button><Button size="sm" onClick={() => setAct({ kind: "approve", a: open })}>Approve</Button></span> : undefined}>
        {open && (
          <div className="grid content-start gap-5 px-5 py-5">
            <div className="flex flex-wrap gap-1.5"><Pill color={PERSON_PILL[open.status].color} dot>{PERSON_PILL[open.status].label}</Pill><Pill color={open.kind === "partner" ? "violet" : "amber"}>{open.kind === "partner" ? "Partner" : "Vendor"}</Pill></div>
            <DetailList items={[
              ["Name", open.name],
              ["Company", open.company],
              ["Email", open.email],
              ["Mobile", open.mobile],
              ["City", open.city],
              ["State", open.stateCode ? STATES.get(open.stateCode) : null],
              ["GSTIN", open.gstin],
              ["Applied", formatDateTime(open.createdAt)],
            ]} />
            {open.message && <div className="rounded-2xl bg-muted/60 p-4 text-sm whitespace-pre-wrap">{open.message}</div>}
            {open.decisionNote && <p className="text-sm text-muted-foreground">Note: {open.decisionNote}</p>}
            {open.kind === "partner" && open.status === "new" && <FilesPanel entityType="application" entityId={open.id} canUpload description="Needed before approving: PAN, GST certificate or the signed agreement." />}
          </div>
        )}
      </SidePanel>

      {act?.kind === "approve" && <ApproveDialog a={act.a} onClose={() => setAct(null)} onDone={(r) => { setOpen(null); reload(); if (r.kind === "partner") router.push(`/partners/${r.resultId}`) }} />}
      {act?.kind === "reject" && <RejectDialog a={act.a} onClose={() => setAct(null)} onDone={() => { setOpen(null); reload() }} />}
    </>
  )
}

function ApproveDialog({ a, onClose, onDone }: { a: Application; onClose: () => void; onDone: (r: { kind: string; resultId: string }) => void }) {
  const [pct, setPct] = React.useState("20")
  const [error, setError] = React.useState<string>()
  const partner = a.kind === "partner"
  return (
    <ActionDialog open onOpenChange={() => onClose()} title={`Approve ${partner ? a.company : a.name}?`} submitLabel="Approve and invite"
      description={partner ? `${a.company} becomes a partner, and ${a.name} gets an invite as its owner.` : `${a.name} gets a Vendor login and a referral code. Businesses that sign up with it are theirs.`}
      onSubmit={async () => {
        try {
          const r = await api.post<{ kind: string; resultId: string }>(`/applications/${a.id}/approve`, { discountPct: partner ? Number(pct) : 0 })
          toast.success(`Approved. ${a.name} gets an invite by email.`)
          onDone(r)
        } catch (x) {
          const f = fieldErrors(x)
          setError(f.discountPct ?? f.kyc)
          return f
        }
      }}>
      {partner && <Field label="Partner discount" hint="Off list price on every client, each month" error={error}><NumberStepper value={pct} onChange={setPct} min={0} max={90} suffix="%" aria-label="Partner discount" className="w-32" /></Field>}
    </ActionDialog>
  )
}

function RejectDialog({ a, onClose, onDone }: { a: Application; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = React.useState("")
  return (
    <ActionDialog open onOpenChange={() => onClose()} destructive title={`Reject ${a.kind === "partner" ? a.company : a.name}?`} submitLabel="Reject"
      description="Nothing is sent to them. They can apply again later."
      onSubmit={async () => { await api.post(`/applications/${a.id}/reject`, { note: note.trim() || null }); toast.success("Rejected"); onDone() }}>
      <Field label="Note for your team" hint="Optional"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Not in our service area yet" maxLength={300} /></Field>
    </ActionDialog>
  )
}
