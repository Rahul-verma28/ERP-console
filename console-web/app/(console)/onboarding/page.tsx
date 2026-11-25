"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Check, ClipboardCheck, Eye, KeyRound, Plus, Settings2, Wallet } from "lucide-react"
import { EmptyState } from "@/components/common"
import { DataList, HeaderLink, countBy, localList, type Column } from "@/components/data-list"
import { ActionMenu, Avatar, Pill } from "@/components/page-parts"
import { SummaryCards } from "@/components/summary-cards"
import { relDays } from "@/components/kit"
import { api, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import type { BusinessRow, Page as ListPage } from "@/lib/types"
import { cn } from "@/lib/utils"

// New businesses on their way to running, and the step each one is on:
// link sent → owner signed in → setup finished → first payment (unless a partner pays).
// The owner sets the business up in their own ERP; the Console never touches a business's data.

type Step = "link" | "signin" | "setup" | "payment"
const STEPS: { key: Step; label: string }[] = [
  { key: "link", label: "Workspace made" },
  { key: "signin", label: "Owner signed in" },
  { key: "setup", label: "Setup finished" },
  { key: "payment", label: "First payment" },
]
const NOW: Record<Step, { label: string; color: string }> = {
  link: { label: "Setting up in the ERP", color: "slate" },
  signin: { label: "Waiting for the owner", color: "rose" },
  setup: { label: "Setting up", color: "blue" },
  payment: { label: "Waiting for payment", color: "amber" },
}
const paying = (r: BusinessRow) => r.subscription?.status === "active" || r.subscription?.status === "past_due"
/** The first step not done yet; null when the business is fully running */
function stepOf(r: BusinessRow): Step | null {
  if (!r.provisionedAt) return "link"
  if (!r.progress?.signedIn) return "signin"
  if (!r.progress.setupDone) return "setup"
  if (!r.partner && !paying(r) && r.subscription?.status === "incomplete") return "payment"
  return null
}
const iconBtn = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4"
const load = localList<BusinessRow & { step: Step }>(
  async () => (await api.get<ListPage<BusinessRow>>("/businesses?limit=100&sort=newest")).data.filter((r) => r.subscription?.status !== "closed" && stepOf(r)).map((r) => ({ ...r, step: stepOf(r)! })),
  (r, q) => [r.name, r.ownerName, r.ownerMobile].some((v) => v.toLowerCase().includes(q)),
  { filter: (r, params) => !params.step || r.step === params.step, counts: (rows) => countBy(rows, (r) => r.step) },
)

export default function OnboardingPage() {
  const { partner } = useAuth()
  const sendLink = async (r: BusinessRow) => {
    try {
      await api.post(`/businesses/${r.id}/owner-link`)
      toast.success(`A new login link is on its way to ${r.ownerEmail}`)
    } catch (x) {
      toast.error(errorMessage(x))
    }
  }
  const columns: Column<BusinessRow & { step: Step }>[] = [
    { key: "name", header: "Business", hideable: false, sort: (r) => r.name.toLowerCase(), csv: (r) => r.name, cell: (r) => <span className="flex items-center gap-3"><Avatar name={r.name} /><span className="grid"><span className="font-semibold">{r.name}</span><span className="text-xs text-muted-foreground">{r.ownerName} · {r.ownerMobile}</span></span></span> },
    {
      key: "progress", header: "Progress", csv: (r) => NOW[r.step].label, cell: (r) => {
        const steps = STEPS.filter((s) => s.key !== "payment" || (!r.partner && r.subscription?.status === "incomplete"))
        const at = steps.findIndex((s) => s.key === r.step)
        return (
          <ol className="flex items-center gap-1.5" aria-label="Progress">
            {steps.map((s, i) => (
              <li key={s.key} className="flex items-center gap-1.5" title={s.label}>
                <span className={cn("grid size-6 place-items-center rounded-full text-[11px] font-semibold", i < at ? "bg-emerald-600 text-white" : i === at ? "bg-primary/10 text-primary ring-2 ring-primary" : "bg-muted text-muted-foreground")}>{i < at ? <Check className="size-3.5" /> : i + 1}</span>
                {i < steps.length - 1 && <span className={cn("h-0.5 w-5 rounded-full", i < at ? "bg-emerald-600" : "bg-border")} />}
              </li>
            ))}
          </ol>
        )
      },
    },
    { key: "now", header: "Now", csv: (r) => NOW[r.step].label, cell: (r) => <Pill color={NOW[r.step].color} dot>{NOW[r.step].label}</Pill> },
    { key: "plan", header: "Plan", csv: (r) => r.subscription?.plan.name ?? "", cell: (r) => <span className="font-medium">{r.subscription?.plan.name ?? "—"}</span> },
    { key: "added", header: "Added", sort: (r) => r.createdAt, csv: (r) => r.createdAt, cell: (r) => <span className="text-sm text-muted-foreground">{relDays(r.createdAt)}</span> },
    {
      key: "actions", header: "Actions", hideable: false,
      cell: (r) => (
        <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Link href={`/businesses/${r.id}`} className={iconBtn} title="Open" aria-label={`Open ${r.name}`}><Eye /></Link>
          {r.step === "signin" && <button type="button" className={iconBtn} title="Send the login link again" onClick={() => void sendLink(r)}><KeyRound /></button>}
          <ActionMenu items={[r.step === "payment" && { label: "Orders", icon: Wallet, href: `/businesses/${r.id}?tab=billing` }, { label: "Send the login link again", icon: KeyRound, onClick: () => void sendLink(r) }]} />
        </span>
      ),
    },
  ]
  return (
    <DataList<BusinessRow & { step: Step }>
      id="onboarding"
      load={load}
      header={{ title: "Onboarding", description: "New businesses on their way to running, and the step each one is on.", primary: <HeaderLink href="/businesses/new" primary><Plus /> {partner ? "Add client" : "Add business"}</HeaderLink> }}
      columns={columns}
      searchPlaceholder="Search business, owner or mobile"
      presets={[
        { key: "all", label: "All", params: {}, countKey: "all" },
        { key: "signin", label: "Owner not signed in", params: { step: "signin" }, countKey: "signin" },
        { key: "setup", label: "Setting up", params: { step: "setup" }, countKey: "setup" },
        ...(partner ? [] : [{ key: "payment", label: "Waiting for payment", params: { step: "payment" }, countKey: "payment" }]),
      ]}
      tabs
      top={(res) => {
        const c = (res.counts ?? {}) as Record<string, number>
        return <SummaryCards items={[
          { label: "In onboarding", value: c.all ?? 0, hint: "Of the last 100 businesses", color: "blue", icon: ClipboardCheck },
          { label: "Owner not signed in", value: (c.signin ?? 0) + (c.link ?? 0), hint: "Send the login link again", color: "rose", icon: KeyRound },
          { label: "Setting up", value: c.setup ?? 0, hint: "Signed in, setup not finished", color: "violet", icon: Settings2 },
          ...(partner ? [] : [{ label: "Waiting for payment", value: c.payment ?? 0, hint: "First order not paid", color: "amber", icon: Wallet }]),
        ]} />
      }}
      rowHref={(r) => `/businesses/${r.id}`}
      exportName="onboarding"
      emptyState={<EmptyState icon={ClipboardCheck} title="Everyone is set up" description="New businesses show here until their owner signs in and finishes setting up." />}
    />
  )
}
