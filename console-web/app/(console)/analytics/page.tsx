"use client"

import * as React from "react"
import { BadgeIndianRupee, Building2, Percent, TrendingUp } from "lucide-react"
import { MonthBars, ShareBars } from "@/components/charts"
import { Failed, Loading, Page, Panel, Stat, StatGrid, StatSkeletons, money } from "@/components/kit"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

// How AHEAD is doing over the last 3, 6 or 12 months, within the businesses the person can see.

interface Analytics {
  months: string[]
  newBusinesses: number[]
  firstPayments: number[]
  revenuePaise: number[]
  closed: number[]
  totals: { mrrPaise: number; paying: number; revenuePaise: number; newBusinesses: number; conversionPercent: number; closed: number }
  plans: { key: string; label: string; value: number }[]
  sources: { key: string; value: number }[]
  partners: { key: string; label: string; value: number }[]
}

const SOURCE: Record<string, string> = { website: "Website", team: "AHEAD team", sales: "Sales", vendor: "Vendors", partner: "Partners" }
const monthLabel = (k: string) => new Date(`${k}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short" })

export default function AnalyticsPage() {
  const { team, partner, is, me } = useAuth()
  const partnerInfo = useApi<{ discountPct: number }>(partner && me?.partner ? `/partners/${me.partner.id}` : null)
  const partnerDiscount = partnerInfo.data?.discountPct ?? 0
  const [months, setMonths] = React.useState<3 | 6 | 12>(6)
  const a = useApi<Analytics>(`/console/analytics?months=${months}`)
  const d = a.data
  const labels = d?.months.map(monthLabel) ?? []
  return (
    <Page
      eyebrow="Insights"
      title={is("sales", "vendor") ? "My numbers" : "Analytics"}
      subtitle={team ? "Growth, revenue and where businesses come from." : partner ? "Your clients over time." : "The businesses you brought, over time."}
      actions={
        <div role="radiogroup" aria-label="Period" className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
          {([3, 6, 12] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={months === m} onClick={() => setMonths(m)} className={cn("h-8 rounded-md px-3 text-[13px] font-medium text-muted-foreground", months === m && "bg-card text-foreground shadow-sm")}>{m} months</button>
          ))}
        </div>
      }
    >
      {a.error && !d && <Failed error={a.error} onRetry={a.reload} />}
      <StatGrid>
        {d ? (
          <>
            <Stat icon={TrendingUp} label={partner ? "Monthly value (list)" : "Monthly recurring revenue"} value={money(d.totals.mrrPaise)} hint={`${d.totals.paying} paying business${d.totals.paying === 1 ? "" : "es"}`} />
            {partner
              ? <Stat icon={BadgeIndianRupee} label="Your monthly bill (about)" value={money(Math.round(d.totals.mrrPaise * (1 - (me?.partner ? partnerDiscount : 0) / 100) * 1.18))} hint="List price less your discount, plus GST" />
              : <Stat icon={BadgeIndianRupee} label="Received" value={money(d.totals.revenuePaise)} hint={`Last ${months} months`} />}
            <Stat icon={Building2} label="New businesses" value={d.totals.newBusinesses} hint={`${d.totals.closed} closed in the same time`} />
            <Stat icon={Percent} label="Became paying" value={`${d.totals.conversionPercent}%`} hint="Of the businesses that joined" tone={d.totals.conversionPercent >= 20 ? "good" : undefined} />
          </>
        ) : <StatSkeletons />}
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="New businesses and first payments" description="Per month">
          {!d ? <Loading rows={3} /> : <MonthBars title="New businesses and first payments" labels={labels} series={[{ label: "New businesses", values: d.newBusinesses, fill: "fill-primary", swatch: "bg-primary" }, { label: "First payments", values: d.firstPayments, fill: "fill-emerald-500", swatch: "bg-emerald-500" }]} />}
        </Panel>
        {partner ? (
          <Panel title="Closed" description="Clients that closed, per month">
            {!d ? <Loading rows={3} /> : <MonthBars title="Closed" labels={labels} series={[{ label: "Closed", values: d.closed, fill: "fill-muted-foreground/50", swatch: "bg-muted-foreground/50" }]} />}
          </Panel>
        ) : (
          <Panel title="Money received" description="Per month, with GST">
            {!d ? <Loading rows={3} /> : <MonthBars title="Money received" labels={labels} series={[{ label: "Received", values: d.revenuePaise, fill: "fill-primary", swatch: "bg-primary" }]} format={(v) => money(v)} />}
          </Panel>
        )}
      </div>

      <div className={cn("grid gap-6", team ? "lg:grid-cols-3" : partner ? "lg:grid-cols-1" : "lg:grid-cols-2")}>
        <Panel title="Businesses by plan" description="Today, closed left out">
          {!d ? <Loading rows={3} /> : <ShareBars rows={d.plans.map((p) => ({ ...p, href: `/businesses?plan=${p.key}` }))} />}
        </Panel>
        {!partner && (
          <Panel title="Where they came from" description={`Joined in the last ${months} months`}>
            {!d ? <Loading rows={3} /> : <ShareBars rows={d.sources.map((s) => ({ key: s.key, label: SOURCE[s.key] ?? s.key, value: s.value, href: `/businesses?onboardedBy=${s.key}` }))} />}
          </Panel>
        )}
        {team && (
          <Panel title="Top partners" description="Live clients">
            {!d ? <Loading rows={3} /> : <ShareBars rows={d.partners.map((p) => ({ ...p, href: `/partners/${p.key}` }))} empty="No partner clients yet." />}
          </Panel>
        )}
      </div>

      <details className="rounded-xl border bg-card px-5 py-4 text-sm">
        <summary className="cursor-pointer font-medium">How these numbers are counted</summary>
        <ul className="mt-3 grid gap-1.5 text-muted-foreground">
          <li><strong className="text-foreground">Monthly recurring revenue:</strong> the list price of every paying plan; a yearly plan counts as a twelfth of its price. Before GST and discounts.</li>
          <li><strong className="text-foreground">Received:</strong> money that reached AHEAD on orders (online or recorded by the team), with GST.</li>
          <li><strong className="text-foreground">First payments:</strong> the first paid order of a business, in the month it was paid.</li>
          <li><strong className="text-foreground">Became paying:</strong> of the businesses that joined in the period, how many are paying today.</li>
          <li>Everything is within the businesses you can see.</li>
        </ul>
      </details>
    </Page>
  )
}
