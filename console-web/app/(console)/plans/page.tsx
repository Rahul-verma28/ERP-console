"use client"

import Link from "next/link"
import { Pencil } from "lucide-react"
import { MODULES } from "@contracts/modules"
import { buttonVariants } from "@/components/ui/button"
import { Pill } from "@/components/page-parts"
import { PageError, PageLoading } from "@/components/page-states"
import { useApi } from "@/lib/use-api"
import { formatNumber, formatPaise } from "@/lib/format"
import type { Plan } from "@/lib/types"
import { cn } from "@/lib/utils"

// Admin: what each plan costs and includes. A plan opens in its own editor; coupons have their page.

export default function PlansPage() {
  const plans = useApi<{ data: Plan[] }>("/catalog/plans")
  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-bold tracking-tight">Plans & pricing</h1>
          <p className="mt-1 text-sm text-muted-foreground">Prices before GST and what each plan includes. Open a plan to change it.</p>
        </div>
        <Link href="/coupons" className={buttonVariants({ variant: "outline" })}>Coupons</Link>
      </header>
      {plans.error && !plans.data ? <PageError error={plans.error} onRetry={plans.reload} /> : !plans.data ? <PageLoading /> : <PlanCards plans={plans.data.data} />}
    </div>
  )
}

function PlanCards({ plans }: { plans: Plan[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {plans.map((p) => (
        <Link key={p.key} href={`/plans/${p.key}`} className={cn("group flex flex-col ui-surface ui-lift p-5", p.key === "professional" && "ring-2 ring-primary/30")}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[15px] font-semibold">{p.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{p.tagline}</p>
            </div>
            {!p.active ? <Pill color="slate">Inactive</Pill> : !p.isPublic ? <Pill color="amber">Hidden</Pill> : <Pill color="emerald" dot>On sale</Pill>}
          </div>
          <p className="mt-4 text-[28px] leading-none font-semibold tracking-tight tabular-nums">{p.monthlyPaise == null ? "Quoted" : p.monthlyPaise === 0 ? "Free" : formatPaise(p.monthlyPaise, true)}<span className="text-sm font-normal text-muted-foreground">{p.monthlyPaise ? " /month" : ""}</span></p>
          <p className="mt-1 h-4 text-xs text-muted-foreground">{p.yearlyPaise ? `${formatPaise(p.yearlyPaise, true)} a year` : ""}</p>
          <dl className="mt-4 grid grid-cols-2 gap-y-1.5 border-t pt-3 text-[13px]">
            <dt className="text-muted-foreground">Users</dt><dd className="text-right tabular-nums">{p.limits.users}</dd>
            <dt className="text-muted-foreground">Branches</dt><dd className="text-right tabular-nums">{p.limits.branches}</dd>
            <dt className="text-muted-foreground">Invoices a month</dt><dd className="text-right tabular-nums">{p.limits.invoicesPerMonth == null ? "No limit" : formatNumber(p.limits.invoicesPerMonth)}</dd>
            <dt className="text-muted-foreground">Storage</dt><dd className="text-right tabular-nums">{formatNumber(Math.round(p.limits.storageMb / 1024))} GB</dd>
            <dt className="text-muted-foreground">Modules</dt><dd className="text-right tabular-nums">{p.modules.length} of {MODULES.length}</dd>
          </dl>
          <div className="mt-auto flex items-center justify-between pt-4 text-[13px]">
            <span className="text-muted-foreground">{p.businesses ?? 0} business{p.businesses === 1 ? "" : "es"} on it</span>
            <span className={buttonVariants({ size: "sm", variant: "outline" })}><Pencil /> Edit</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
