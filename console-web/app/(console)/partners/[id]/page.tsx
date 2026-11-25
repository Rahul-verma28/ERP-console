"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ActionDialog } from "@/components/action-dialog"
import { PageError, PageLoading } from "@/components/page-states"
import { ActionMenu, DetailHeader, Pill } from "@/components/page-parts"
import { PERSON_PILL } from "@/lib/pills"
import { Pencil, UserX, UserCheck, Users } from "lucide-react"
import { PartnerDialog } from "@/components/partner-dialog"
import { PartnerView, usePartner } from "@/components/partner-view"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"

export default function PartnerPage() {
  const { id } = useParams<{ id: string }>()
  const { is } = useAuth()
  const p = usePartner(id)
  const [dialog, setDialog] = React.useState<null | "edit" | "status">(null)
  if (p.error && !p.data) return <PageError error={p.error} onRetry={p.reload} />
  if (!p.data) return <PageLoading />
  const d = p.data
  const active = d.status === "active"
  return (
    <div className="grid gap-5">
      <DetailHeader
        initials={d.name}
        title={d.name}
        pills={<Pill color={PERSON_PILL[d.status]?.color} dot>{PERSON_PILL[d.status]?.label ?? d.status}</Pill>}
        subtitle={`${d.contactName} · ${d.mobile} · ${d.email}`}
        extra={<span className="flex flex-wrap gap-1.5"><Pill color="slate"><span className="font-mono">{d.code}</span></Pill>{d.gstin && <Pill color="slate">GSTIN {d.gstin}</Pill>}{d.city && <Pill color="slate">{d.city}</Pill>}</span>}
        actions={is("admin") ? (
          <>
            <Button className="h-10 rounded-xl px-4 font-semibold" onClick={() => setDialog("edit")}><Pencil /> Edit</Button>
            <ActionMenu trigger={<Button variant="outline" size="icon" className="size-10 rounded-xl" aria-label="More actions" />} items={[
              { label: "Clients in Businesses", icon: Users, href: `/businesses?partnerId=${d.id}` },
              "-",
              { label: active ? "Make inactive" : "Make active", icon: active ? UserX : UserCheck, destructive: active, onClick: () => setDialog("status") },
            ]} />
          </>
        ) : undefined}
      />
      <PartnerView p={d} reload={p.reload} />
      {dialog === "edit" && <PartnerDialog partner={{ ...d, businesses: d.businesses.length, people: d.people.length }} onClose={() => setDialog(null)} onSaved={() => { toast.success("Saved"); setDialog(null); void p.reload() }} />}
      <ActionDialog
        open={dialog === "status"} onOpenChange={(o) => !o && setDialog(null)} destructive={active}
        title={active ? `Make ${d.name} inactive?` : `Make ${d.name} active?`} submitLabel={active ? "Make inactive" : "Make active"}
        description={active ? "Its people are signed out and can’t sign in. Its clients keep working and are still billed to it." : "Its people can sign in again."}
        onSubmit={async () => { await api.patch(`/partners/${id}`, { status: active ? "disabled" : "active" }); toast.success(active ? `${d.name} is inactive` : `${d.name} is active`); void p.reload() }}
      />
    </div>
  )
}
