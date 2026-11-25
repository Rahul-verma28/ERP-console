"use client"

import { PageError, PageLoading } from "@/components/page-states"
import { PartnerView, usePartner } from "@/components/partner-view"
import { useAuth } from "@/lib/auth"

// The partner portal's money page: this month so far, every monthly bill with its payment link.

export default function BillsPage() {
  const { me } = useAuth()
  const p = usePartner(me?.partner?.id ?? null)
  if (!me?.partner) return <PageError error={new Error("Only a partner’s people have bills.")} />
  if (p.error && !p.data) return <PageError error={p.error} onRetry={p.reload} />
  if (!p.data) return <PageLoading />
  return (
    <div className="grid gap-5">
      <header>
        <h1 className="text-[26px] leading-tight font-bold tracking-tight">Monthly bill</h1>
        <p className="mt-1 text-sm text-muted-foreground">{p.data.name} pays AHEAD once a month for its clients, at {p.data.discountPct}% off list price.</p>
      </header>
      <PartnerView p={p.data} reload={p.reload} />
    </div>
  )
}
