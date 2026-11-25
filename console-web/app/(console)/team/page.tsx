"use client"

import * as React from "react"
import { toast } from "sonner"
import { KeyRound, Mail, Plus, Send, ShieldCheck, ShieldOff, UserCheck, Users, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, NativeSelect } from "@/components/form"
import { ActionDialog, fieldErrors } from "@/components/action-dialog"
import { EmptyState } from "@/components/common"
import { DataList, countBy, localList, type Column } from "@/components/data-list"
import { ActionMenu, Avatar, Pill } from "@/components/page-parts"
import { SummaryCards } from "@/components/summary-cards"
import { api, errorMessage } from "@/lib/api"
import { ROLE_LABEL, useAuth, type Role } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { formatDate, formatDateTime } from "@/lib/format"
import { PERSON_PILL } from "@/lib/pills"
import type { Partner, Person } from "@/lib/types"

// Console people. Admin adds anyone; a partner owner adds their own staff. Each gets an invite link.

const ROLE_HINT: Record<Role, string> = {
  admin: "Everything, including plans, prices, settings and approvals",
  staff: "Every business, orders, partners and system health; no prices or settings",
  sales: "Businesses they bring, with a referral code",
  vendor: "Businesses they bring, with a referral code",
  partner_owner: "A partner’s clients, bills and people",
  partner_staff: "A partner’s clients",
}
const ROLE_COLOR: Record<Role, string> = { admin: "violet", staff: "blue", sales: "cyan", vendor: "amber", partner_owner: "emerald", partner_staff: "slate" }
const iconBtn = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-4"

const load = localList<Person>(
  async () => (await api.get<{ data: Person[] }>("/team")).data,
  (p, q) => [p.name, p.email, p.mobile ?? "", ROLE_LABEL[p.role], p.partner?.name ?? ""].some((v) => v.toLowerCase().includes(q)),
  {
    filter: (p, params) => (!params.status || p.status === params.status) && (!params.role || p.role === params.role),
    counts: (rows) => countBy(rows, (p) => p.status),
    meta: (rows) => ({ twoStep: rows.filter((p) => p.mfaEnabledAt).length, sellers: rows.filter((p) => p.role === "sales" || p.role === "vendor").length, partners: rows.filter((p) => p.partnerId).length }),
  },
)

export default function TeamPage() {
  const { me, is } = useAuth()
  const admin = is("admin")
  const partners = useApi<{ data: Partner[] }>(admin ? "/partners" : null)
  const [tick, setTick] = React.useState(0)
  const reload = () => setTick((t) => t + 1)
  const [dialog, setDialog] = React.useState<null | { kind: "invite" } | { kind: "role" | "status" | "mfa"; p: Person }>(() => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("invite") ? { kind: "invite" } : null))

  const resend = async (p: Person) => {
    try {
      await api.post(`/team/${p.id}/invite`)
      toast.success(`${p.status === "invited" ? "Invite" : "Password link"} sent to ${p.email}`)
    } catch (x) {
      toast.error(errorMessage(x))
    }
  }

  const columns: Column<Person>[] = [
    { key: "name", header: "Person", hideable: false, sort: (p) => p.name.toLowerCase(), csv: (p) => p.name, cell: (p) => <span className="flex items-center gap-3"><Avatar name={p.name} /><span className="grid"><span className="font-semibold">{p.name}{p.id === me!.id && <span className="font-normal text-muted-foreground"> (you)</span>}</span><span className="text-xs text-muted-foreground">{p.email}</span></span></span> },
    { key: "role", header: "Role", sort: (p) => ROLE_LABEL[p.role], csv: (p) => ROLE_LABEL[p.role], cell: (p) => <span className="grid justify-items-start gap-0.5"><Pill color={ROLE_COLOR[p.role]}>{ROLE_LABEL[p.role]}</Pill>{p.partner && <span className="text-[11px] text-muted-foreground">{p.partner.name}</span>}</span> },
    { key: "code", header: "Referral code", csv: (p) => p.referralCode ?? "", cell: (p) => <span className="font-mono text-xs">{p.referralCode ?? "—"}</span> },
    { key: "mobile", header: "Mobile", defaultHidden: true, csv: (p) => p.mobile ?? "", cell: (p) => <span className="text-sm">{p.mobile ?? "—"}</span> },
    { key: "mfa", header: "Two-step", csv: (p) => (p.mfaEnabledAt ? "On" : "Off"), cell: (p) => (p.mfaEnabledAt ? <Pill color="emerald">On</Pill> : p.role === "admin" || p.role === "staff" ? <Pill color="amber">At first sign-in</Pill> : <Pill color="slate">Off</Pill>) },
    { key: "last", header: "Last sign-in", sort: (p) => p.lastLoginAt ?? "", csv: (p) => p.lastLoginAt ?? "", cell: (p) => <span className="text-sm text-muted-foreground">{p.lastLoginAt ? formatDateTime(p.lastLoginAt) : `Never · added ${formatDate(p.createdAt)}`}</span> },
    { key: "status", header: "Status", csv: (p) => PERSON_PILL[p.status].label, cell: (p) => <Pill color={PERSON_PILL[p.status].color} dot>{PERSON_PILL[p.status].label}</Pill> },
    {
      key: "actions", header: "Actions", hideable: false,
      cell: (p) => p.id === me!.id ? <span className="text-xs text-muted-foreground">—</span> : (
        <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          {p.status !== "disabled" && <button type="button" className={iconBtn} title={p.status === "invited" ? "Send the invite again" : "Send a password link"} onClick={() => void resend(p)}><Mail /></button>}
          {admin && <button type="button" className={iconBtn} title="Change role" onClick={() => setDialog({ kind: "role", p })}><KeyRound /></button>}
          <ActionMenu items={[
            p.status !== "disabled" && { label: p.status === "invited" ? "Send the invite again" : "Send a password link", icon: Send, onClick: () => void resend(p) },
            admin && { label: "Change role", icon: KeyRound, onClick: () => setDialog({ kind: "role", p }) },
            admin && p.mfaEnabledAt && { label: "Reset two-step", icon: ShieldOff, onClick: () => setDialog({ kind: "mfa", p }) },
            "-",
            admin && { label: p.status === "disabled" ? "Make active" : "Make inactive", icon: p.status === "disabled" ? UserCheck : UserX, destructive: p.status !== "disabled", onClick: () => setDialog({ kind: "status", p }) },
          ]} />
        </span>
      ),
    },
  ]

  return (
    <>
      <DataList<Person>
        id="team"
        load={load}
        params={{ v: String(tick) }}
        header={{
          title: "Team",
          description: admin ? "Everyone who signs in to the Console, and what they can do." : `${me!.partner?.name}’s people in the partner portal.`,
          primary: <Button className="h-10 rounded-xl px-4 font-semibold" onClick={() => setDialog({ kind: "invite" })}><Plus /> Invite someone</Button>,
          more: admin ? [{ label: "Roles", href: "/roles" }] : undefined,
        }}
        columns={columns}
        searchPlaceholder="Search name, email, role or partner"
        presets={[
          { key: "all", label: "All", params: {}, countKey: "all" },
          { key: "active", label: "Active", params: { status: "active" }, countKey: "active" },
          { key: "invited", label: "Invited", params: { status: "invited" }, countKey: "invited" },
          { key: "disabled", label: "Inactive", params: { status: "disabled" }, countKey: "disabled" },
        ]}
        tabs
        filters={admin ? [{ key: "role", label: "Role", options: (Object.keys(ROLE_LABEL) as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] })) }] : []}
        top={(res) => {
          const c = (res.counts ?? {}) as Record<string, number>
          return <SummaryCards items={[
            { label: "People", value: c.all ?? 0, hint: `${c.active ?? 0} active · ${c.invited ?? 0} invited`, color: "blue", icon: Users },
            { label: "Two-step on", value: (res.twoStep as number) ?? 0, hint: "Required for Admin and Staff", color: "emerald", icon: ShieldCheck },
            ...(admin ? [
              { label: "Sales and vendors", value: (res.sellers as number) ?? 0, hint: "With their own referral code", color: "violet", icon: Send },
              { label: "Partner people", value: (res.partners as number) ?? 0, hint: "In partner portals", color: "amber", icon: Users },
            ] : []),
          ]} />
        }}
        exportName="team"
        emptyState={<EmptyState icon={Users} title="Nobody here yet" description="Invite someone: they get an email to set their own password." />}
      />
      {dialog?.kind === "invite" && <InviteDialog admin={admin} partners={partners.data?.data ?? []} onClose={() => setDialog(null)} onDone={reload} />}
      {dialog?.kind === "role" && <RoleDialog p={dialog.p} onClose={() => setDialog(null)} onDone={reload} />}
      {dialog?.kind === "mfa" && (
        <ActionDialog open onOpenChange={() => setDialog(null)} destructive title={`Reset two-step for ${dialog.p.name}?`} submitLabel="Reset two-step"
          description="For a lost phone. They’re signed out everywhere, and set two-step up again at their next sign-in."
          onSubmit={async () => { await api.post(`/team/${dialog.p.id}/reset-mfa`); toast.success("Two-step reset"); reload() }} />
      )}
      {dialog?.kind === "status" && (
        <ActionDialog open onOpenChange={() => setDialog(null)} destructive={dialog.p.status !== "disabled"}
          title={dialog.p.status === "disabled" ? `Make ${dialog.p.name} active?` : `Make ${dialog.p.name} inactive?`} submitLabel={dialog.p.status === "disabled" ? "Make active" : "Make inactive"}
          description={dialog.p.status === "disabled" ? "They can sign in again." : "They’re signed out everywhere at once and can’t sign in. Businesses they brought stay as they are."}
          onSubmit={async () => { await api.patch(`/team/${dialog.p.id}`, { status: dialog.p.status === "disabled" ? "active" : "disabled" }); toast.success("Saved"); reload() }} />
      )}
    </>
  )
}

function InviteDialog({ admin, partners, onClose, onDone }: { admin: boolean; partners: Partner[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = React.useState({ name: "", email: "", mobile: "", role: (admin ? "staff" : "partner_staff") as Role, partnerId: "" })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const forPartner = f.role === "partner_owner" || f.role === "partner_staff"
  const roles: Role[] = admin ? ["admin", "staff", "sales", "vendor", "partner_owner", "partner_staff"] : ["partner_staff"]
  return (
    <ActionDialog open onOpenChange={() => onClose()} title="Invite someone" submitLabel="Send invite" description="They get an email with a link to set their password."
      onSubmit={async () => {
        const e: Record<string, string> = {}
        if (f.name.trim().length < 2) e.name = "Enter the name"
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email"
        if (f.mobile && !/^(\+91)?[6-9]\d{9}$/.test(f.mobile.replace(/\s/g, ""))) e.mobile = "Enter a 10-digit mobile"
        if (admin && forPartner && !f.partnerId) e.partnerId = "Choose the partner"
        setErrors(e)
        if (Object.keys(e).length) return e
        try {
          await api.post("/team", { name: f.name.trim(), email: f.email.trim(), mobile: f.mobile.replace(/\s/g, "") || null, role: f.role, partnerId: admin && forPartner ? f.partnerId : null })
          toast.success(`Invite sent to ${f.email.trim()}`)
          onDone()
        } catch (x) {
          const fe = fieldErrors(x)
          setErrors(fe)
          return fe
        }
      }}>
      <Field label="Name" required error={errors.name}><Input value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="e.g. Priya Nair" autoFocus /></Field>
      <Field label="Email" required error={errors.email}><Input type="email" value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} placeholder="e.g. priya@ahead.in" /></Field>
      <Field label="Mobile" hint="Optional" error={errors.mobile}><Input mask="phone" value={f.mobile} onChange={(e) => setF((x) => ({ ...x, mobile: e.target.value }))} placeholder="e.g. 9876543210" /></Field>
      {admin && (
        <Field label="Role" hint={ROLE_HINT[f.role]} error={errors.role}>
          <NativeSelect value={f.role} onChange={(e) => setF((x) => ({ ...x, role: e.target.value as Role }))}>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </NativeSelect>
        </Field>
      )}
      {admin && forPartner && (
        <Field label="Partner" required error={errors.partnerId}>
          <NativeSelect value={f.partnerId} onChange={(e) => setF((x) => ({ ...x, partnerId: e.target.value }))}>
            <option value="">Choose…</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </NativeSelect>
        </Field>
      )}
    </ActionDialog>
  )
}

function RoleDialog({ p, onClose, onDone }: { p: Person; onClose: () => void; onDone: () => void }) {
  const partnerRole = p.role === "partner_owner" || p.role === "partner_staff"
  const roles: Role[] = partnerRole ? ["partner_owner", "partner_staff"] : ["admin", "staff", "sales", "vendor"]
  const [role, setRole] = React.useState<Role>(p.role)
  return (
    <ActionDialog open onOpenChange={() => onClose()} title={`Change ${p.name}’s role`} submitLabel="Save"
      onSubmit={async () => { await api.patch(`/team/${p.id}`, { role }); toast.success("Role changed"); onDone() }}>
      <Field label="Role" hint={ROLE_HINT[role]}>
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </NativeSelect>
      </Field>
    </ActionDialog>
  )
}
