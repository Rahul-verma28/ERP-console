"use client"

import Link from "next/link"
import { Check, Minus } from "lucide-react"
import { MODULES } from "@contracts/modules"
import { Chip, Failed, Loading, Page, Panel } from "@/components/kit"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

// Every module: which plans include it and how many businesses have it. Plans change in Plans &
// pricing; one business's module is turned on or off from that business's page.

interface Modules {
  plans: { key: string; name: string; active: boolean }[]
  data: { key: string; plans: string[]; businesses: number; switchedOn: number; switchedOff: number }[]
}

export default function ModulesPage() {
  const { is } = useAuth()
  const m = useApi<Modules>("/catalog/modules")
  return (
    <Page eyebrow="Product" title="Modules" subtitle="Every module, which plans include it, and how many businesses have it today.">
      {m.error && !m.data ? <Failed error={m.error} onRetry={m.reload} /> : !m.data ? <Loading rows={6} /> : (
        <Panel padded={false} description={is("admin") ? <>Change a plan’s modules in <Link href="/plans" className="font-medium text-primary hover:underline">Plans & pricing</Link>.</> : undefined} title="Modules by plan">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="border-y px-4 py-2.5 font-medium">Module</th>
                  {m.data.plans.map((p) => <th key={p.key} className="border-y px-3 py-2.5 text-center font-medium">{p.name}{!p.active && <span className="block text-[10px] font-normal">inactive</span>}</th>)}
                  <th className="border-y px-3 py-2.5 text-right font-medium">Businesses</th>
                  <th className="border-y px-4 py-2.5 font-medium">Switched for one business</th>
                </tr>
              </thead>
              <tbody>
                {MODULES.map((mod) => {
                  const row = m.data!.data.find((d) => d.key === mod.key)
                  return (
                    <tr key={mod.key} className="hover:bg-muted/40">
                      <td className="border-b px-4 py-3">
                        <span className="block font-medium">{mod.name}</span>
                        <span className="block max-w-xs truncate text-xs text-muted-foreground">{mod.description}</span>
                      </td>
                      {m.data!.plans.map((p) => {
                        const on = row?.plans.includes(p.key)
                        return (
                          <td key={p.key} className="border-b px-3 py-3 text-center">
                            <span className={cn("inline-grid size-6 place-items-center rounded-full", on ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "text-muted-foreground/50")}>{on ? <Check className="size-3.5" /> : <Minus className="size-3.5" />}</span>
                          </td>
                        )
                      })}
                      <td className="border-b px-3 py-3 text-right tabular-nums">{row?.businesses ?? 0}</td>
                      <td className="border-b px-4 py-3">
                        <span className="flex gap-1.5">
                          {row?.switchedOn ? <Chip tone="green">{row.switchedOn} on</Chip> : null}
                          {row?.switchedOff ? <Chip tone="grey">{row.switchedOff} off</Chip> : null}
                          {!row?.switchedOn && !row?.switchedOff && <span className="text-muted-foreground">—</span>}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="px-5 pt-3 pb-4 text-xs text-muted-foreground">“Businesses” counts those on a plan with the module, plus every business on a free trial (a trial opens all modules).</p>
        </Panel>
      )}
    </Page>
  )
}
