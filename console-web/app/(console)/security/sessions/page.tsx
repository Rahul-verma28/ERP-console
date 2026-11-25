"use client"

import * as React from "react"
import { toast } from "sonner"
import { LogOut, MonitorSmartphone } from "lucide-react"
import { ActionDialog } from "@/components/action-dialog"
import { EmptyState } from "@/components/common"
import { DataList, localList, type Column } from "@/components/data-list"
import { Avatar, Pill } from "@/components/page-parts"
import { ago } from "@/components/kit"
import { api } from "@/lib/api"
import { ROLE_LABEL, useAuth, type Role } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"

// Admin: everyone signed in to the Console right now, and a way to end a session nobody recognises.

interface Session { id: string; ip: string | null; userAgent: string | null; createdAt: string; lastUsedAt: string; user: { id: string; name: string; email: string; role: Role } }

const device = (ua: string | null) => {
  if (!ua) return "Unknown device"
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser"
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : ""
  return os ? `${b} on ${os}` : b
}
const iconBtn = "grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive [&_svg]:size-4"
const load = localList<Session>(async () => (await api.get<{ data: Session[] }>("/console/sessions")).data, (s, q) => [s.user.name, s.user.email, s.ip ?? ""].some((v) => v.toLowerCase().includes(q)))

export default function SessionsPage() {
  const { me } = useAuth()
  const [tick, setTick] = React.useState(0)
  const [end, setEnd] = React.useState<Session | null>(null)
  const columns: Column<Session>[] = [
    { key: "person", header: "Person", hideable: false, sort: (s) => s.user.name, csv: (s) => s.user.name, cell: (s) => <span className="flex items-center gap-3"><Avatar name={s.user.name} /><span className="grid"><span className="font-semibold">{s.user.name}{s.user.id === me?.id && <span className="font-normal text-muted-foreground"> (you)</span>}</span><span className="text-xs text-muted-foreground">{s.user.email}</span></span></span> },
    { key: "role", header: "Role", csv: (s) => ROLE_LABEL[s.user.role], cell: (s) => <Pill color="slate">{ROLE_LABEL[s.user.role]}</Pill> },
    { key: "device", header: "Device", csv: (s) => device(s.userAgent), cell: (s) => <span className="text-sm">{device(s.userAgent)}</span> },
    { key: "ip", header: "IP", csv: (s) => s.ip ?? "", cell: (s) => <span className="font-mono text-xs">{s.ip ?? "—"}</span> },
    { key: "since", header: "Signed in", sort: (s) => s.createdAt, csv: (s) => s.createdAt, cell: (s) => <span className="text-sm text-muted-foreground">{formatDateTime(s.createdAt)}</span> },
    { key: "last", header: "Last used", sort: (s) => s.lastUsedAt, csv: (s) => s.lastUsedAt, cell: (s) => <span className="text-sm text-muted-foreground">{ago(s.lastUsedAt)}</span> },
    { key: "actions", header: "Actions", hideable: false, cell: (s) => (s.user.id === me?.id ? <span className="text-xs text-muted-foreground">—</span> : <button type="button" className={iconBtn} title="End this session" aria-label={`End ${s.user.name}’s session`} onClick={(e) => { e.stopPropagation(); setEnd(s) }}><LogOut /></button>) },
  ]
  return (
    <>
      <DataList<Session>
        id="sessions"
        load={load}
        params={{ v: String(tick) }}
        header={{ title: "Signed in now", description: "Everyone with an open Console session. End one you don’t recognise; they have to sign in again.", more: [{ label: "Audit trail", href: "/security" }] }}
        columns={columns}
        searchPlaceholder="Search person, email or IP"
        exportName="sessions"
        emptyState={<EmptyState icon={MonitorSmartphone} title="Nobody is signed in" />}
      />
      {end && (
        <ActionDialog open onOpenChange={() => setEnd(null)} destructive title={`End ${end.user.name}’s session?`} submitLabel="End session"
          description={`${device(end.userAgent)} · ${end.ip ?? "unknown IP"}. They have to sign in again on that device.`}
          onSubmit={async () => { await api.delete(`/console/sessions/${end.id}`); toast.success("Session ended"); setTick((t) => t + 1) }} />
      )}
    </>
  )
}
