"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Building2, Copy, ExternalLink, Eye, Percent, ReceiptText, Send, Users, Wallet } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/form"
import { ActionDialog, fieldErrors } from "@/components/action-dialog"
import { EmptyState } from "@/components/common"
import { FilesPanel } from "@/components/files-panel"
import { ActionMenu, Avatar, Pill, Section, StatGrid, Tabs } from "@/components/page-parts"
import { useTab } from "@/components/kit"
import { api, errorMessage } from "@/lib/api"
import { ROLE_LABEL, useAuth, type Role } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { formatDate, formatDateTime, formatPaise } from "@/lib/format"
import { BILL_PILL, BUSINESS_PILL, PERSON_PILL } from "@/lib/pills"
import type { Partner, PartnerBill, SubStatus } from "@/lib/types"

// One partner, laid out like an ERP record page: key numbers, then tabs — monthly bills (with
// payment links), clients, people and KYC papers. The team sees it with edit and record payment;
// the partner's own people see it as their Monthly bill page.

export interface PartnerFull extends Omit<Partner, "businesses" | "people"> {
  people: { id: string; name: string; email: string; role: Role; status: string; lastLoginAt: string | null }[]
  businesses: { id: string; name: string; ownerName: string; createdAt: string; subscription: { status: SubStatus; planKey: string; trialEndsAt: string | null; plan: { name: string } } | null }[]
  bills: PartnerBill[]
  thisMonth: { lines: PartnerBill["lines"]; subtotalPaise: number; totalPaise: number } | null
}

const monthName = (m: string) => new Date(`${m.slice(0, 7)}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
const iconBtn = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4"
const TABS = ["bills", "clients", "people", "papers"] as const

export function usePartner(id: string | null) {
  return useApi<PartnerFull>(id ? `/partners/${id}` : null)
}

export function PartnerView({ p, reload }: { p: PartnerFull; reload: () => void }) {
  const { team, is } = useAuth()
  const [tab, setTab] = useTab(TABS, "bills")
  const [paying, setPaying] = React.useState<PartnerBill | null>(null)
  const unpaid = p.bills.filter((b) => b.status === "awaiting_payment")
  const live = p.businesses.filter((b) => b.subscription?.status === "active" || b.subscription?.status === "past_due").length

  const sendLink = async (b: PartnerBill) => {
    try {
      const out = await api.post<PartnerBill>(`/partners/bills/${b.id}/link`)
      toast.success(`Bill for ${monthName(b.month)} sent to ${p.email}`)
      if (out.linkUrl && !team) window.open(out.linkUrl, "_blank", "noopener")
      reload()
    } catch (x) {
      toast.error(errorMessage(x))
    }
  }

  return (
    <>
      <StatGrid items={[
        { label: "This month so far", value: p.thisMonth ? formatPaise(p.thisMonth.totalPaise, true) : "—", hint: p.thisMonth ? `${p.thisMonth.lines.length} paying client${p.thisMonth.lines.length === 1 ? "" : "s"} · with GST` : "No paying clients yet", icon: ReceiptText, color: "blue" },
        { label: "Unpaid", value: formatPaise(unpaid.reduce((t, b) => t + b.totalPaise, 0), true), hint: unpaid.length ? `${unpaid.length} bill${unpaid.length === 1 ? "" : "s"}; due ${formatDate(unpaid[unpaid.length - 1].dueAt)}` : "Nothing due", icon: Wallet, color: unpaid.length ? "rose" : "emerald" },
        { label: "Clients", value: p.businesses.length, hint: `${live} on a plan`, icon: Building2, color: "violet" },
        { label: "Discount", value: `${p.discountPct}%`, hint: "Off list price on each client", icon: Percent, color: "amber" },
      ]} />

      <Tabs<(typeof TABS)[number]> value={tab} onChange={setTab} tabs={[
        { key: "bills", label: "Monthly bills", count: p.bills.length },
        { key: "clients", label: "Clients", count: p.businesses.length },
        { key: "people", label: "People", count: p.people.length },
        { key: "papers", label: "KYC papers" },
      ]} />

      {tab === "bills" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Section title="Bills" description="One bill a month for every client on a paid plan, at list price less the discount, plus GST" flush>
            {p.bills.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-[13px]"><tr><th className="px-5 py-3 font-semibold">Month</th><th className="px-3 py-3 font-semibold">Clients</th><th className="px-3 py-3 text-right font-semibold">Total</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Due / paid</th><th className="px-5 py-3 font-semibold">Actions</th></tr></thead>
                  <tbody className="divide-y">
                    {p.bills.map((b) => (
                      <tr key={b.id} className="hover:bg-muted/40">
                        <td className="px-5 py-3 font-semibold">{monthName(b.month)}</td>
                        <td className="px-3 py-3">{b.lines.length}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatPaise(b.totalPaise)}</td>
                        <td className="px-3 py-3"><Pill color={BILL_PILL[b.status].color} dot>{BILL_PILL[b.status].label}</Pill></td>
                        <td className="px-3 py-3 text-muted-foreground">{b.status === "paid" ? `Paid ${b.paidAt ? formatDate(b.paidAt) : ""}${b.invoiceNumber ? ` · ${b.invoiceNumber}` : ""}` : `Due ${formatDate(b.dueAt)}`}</td>
                        <td className="px-5 py-3">
                          <span className="flex items-center gap-0.5">
                            {b.status === "awaiting_payment" && b.linkUrl && <button type="button" className={iconBtn} title={team ? "Open the payment link" : "Pay now"} onClick={() => window.open(b.linkUrl!, "_blank", "noopener")}><ExternalLink /></button>}
                            {team && b.status === "awaiting_payment" && <button type="button" className={iconBtn} title="Record a payment" onClick={() => setPaying(b)}><Wallet /></button>}
                            <ActionMenu items={[
                              b.status === "awaiting_payment" && b.linkUrl && { label: "Copy the payment link", icon: Copy, onClick: () => { void navigator.clipboard.writeText(b.linkUrl!); toast.success("Link copied") } },
                              b.status === "awaiting_payment" && (team || is("partner_owner")) && { label: "Email the bill again", icon: Send, onClick: () => void sendLink(b) },
                            ]} />
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={ReceiptText} title="No bills yet" description="The first bill is made on the 1st of next month, for every client on a paid plan." />}
          </Section>
          <Section title="This month so far" description="What the next bill will hold if nothing changes">
            {p.thisMonth?.lines.length ? (
              <dl className="grid gap-2 text-sm">
                {p.thisMonth.lines.map((l) => <div key={l.businessId} className="flex justify-between gap-3"><dt className="min-w-0 truncate">{l.name} <span className="text-muted-foreground">· {l.plan}</span></dt><dd className="tabular-nums">{formatPaise(l.chargePaise)}</dd></div>)}
                <div className="flex justify-between gap-3 border-t pt-2 text-muted-foreground"><dt>Before GST</dt><dd className="tabular-nums">{formatPaise(p.thisMonth.subtotalPaise)}</dd></div>
                <div className="flex justify-between gap-3 font-semibold"><dt>With GST</dt><dd className="tabular-nums">{formatPaise(p.thisMonth.totalPaise)}</dd></div>
              </dl>
            ) : <p className="text-sm text-muted-foreground">No client is on a paid plan yet.</p>}
          </Section>
        </div>
      )}

      {tab === "clients" && (
        <Section title="Clients" description="Businesses this partner looks after" action={!team ? <Link href="/businesses/new" className={buttonVariants({ size: "sm", variant: "outline" })}><Building2 /> Add client</Link> : <Link href={`/businesses?partnerId=${p.id}`} className="text-sm font-medium text-primary hover:underline">Open in Businesses</Link>} flush>
          {p.businesses.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-[13px]"><tr><th className="px-5 py-3 font-semibold">Business</th><th className="px-3 py-3 font-semibold">Owner</th><th className="px-3 py-3 font-semibold">Plan</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Added</th><th className="px-5 py-3 font-semibold">Actions</th></tr></thead>
                <tbody className="divide-y">
                  {p.businesses.map((b) => {
                    const pill = b.subscription ? (b.subscription.status === "active" ? { label: "Live", color: "emerald" } : BUSINESS_PILL[b.subscription.status]) : null
                    return (
                      <tr key={b.id} className="hover:bg-muted/40">
                        <td className="px-5 py-3"><span className="flex items-center gap-3"><Avatar name={b.name} /><span className="font-semibold">{b.name}</span></span></td>
                        <td className="px-3 py-3">{b.ownerName}</td>
                        <td className="px-3 py-3">{b.subscription?.plan.name ?? "—"}</td>
                        <td className="px-3 py-3">{pill && <Pill color={pill.color} dot>{pill.label}</Pill>}</td>
                        <td className="px-3 py-3 text-muted-foreground">{formatDate(b.createdAt)}</td>
                        <td className="px-5 py-3"><Link href={`/businesses/${b.id}`} className={iconBtn} title="Open"><Eye /></Link></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState icon={Building2} title="No clients yet" description="Clients this partner adds show here." />}
        </Section>
      )}

      {tab === "people" && (
        <Section title="People" description="Who signs in to the partner portal" action={is("partner_owner") ? <Link href="/team" className="text-sm font-medium text-primary hover:underline">Manage the team</Link> : undefined} flush>
          <ul className="divide-y">
            {p.people.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={u.name} />
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{u.name}</span><span className="block truncate text-xs text-muted-foreground">{ROLE_LABEL[u.role]} · {u.email} · {u.lastLoginAt ? `last in ${formatDateTime(u.lastLoginAt)}` : "never signed in"}</span></span>
                <Pill color={PERSON_PILL[u.status]?.color} dot>{PERSON_PILL[u.status]?.label ?? u.status}</Pill>
              </li>
            ))}
            {!p.people.length && <EmptyState icon={Users} title="Nobody yet" />}
          </ul>
        </Section>
      )}

      {tab === "papers" && <FilesPanel entityType="partner" entityId={p.id} canUpload={team || is("partner_owner")} />}

      {paying && <BillPaidDialog bill={paying} onClose={() => setPaying(null)} onDone={reload} />}
    </>
  )
}

function BillPaidDialog({ bill, onClose, onDone }: { bill: PartnerBill; onClose: () => void; onDone: () => void }) {
  const [reference, setReference] = React.useState("")
  const [error, setError] = React.useState<string>()
  return (
    <ActionDialog open onOpenChange={() => onClose()} title="Record a payment" submitLabel={`Record ${formatPaise(bill.totalPaise)}`}
      description={`The bill for ${monthName(bill.month)}, paid by bank transfer, UPI or cheque. The invoice is made at once.`}
      onSubmit={async () => {
        if (reference.trim().length < 3) { setError("Enter the UTR, UPI or cheque number"); return { reference: "x" } }
        try {
          await api.post(`/partners/bills/${bill.id}/paid`, { reference: reference.trim() })
          toast.success("Payment recorded")
          onDone()
        } catch (x) {
          const f = fieldErrors(x)
          setError(f.reference)
          return f
        }
      }}>
      <Field label="UTR / reference" required error={error}><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. HDFC0000123456" maxLength={60} className="font-mono" autoFocus /></Field>
    </ActionDialog>
  )
}
