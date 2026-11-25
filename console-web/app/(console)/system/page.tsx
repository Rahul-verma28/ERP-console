"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Activity, CheckCircle2, Clock, Loader2, Play, RotateCw, Send, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Chip, Failed, Loading, Page, Panel, Row, Stat, StatGrid, StatSkeletons, ago } from "@/components/kit"
import { api, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { formatDateTime } from "@/lib/format"

// Is the ERP answering, are changes reaching it, and did the scheduled jobs run.

interface Health {
  erp: { reachable: boolean; ms: number }
  deliveries: { waiting: number; stuck: { id: string; kind: string; businessId: string; lastError: string | null; createdAt: string }[] }
  jobs: { name: string; lastStartedAt: string | null; lastFinishedAt: string | null; lastError: string | null; lastSummary: string | null }[]
}

const KIND: Record<string, string> = { provision: "Create the workspace", licence: "Send the licence", owner_link: "Send the owner’s login link" }
const JOB: Record<string, { label: string; text: string }> = {
  billing: { label: "Billing", text: "Renewal orders, payment reminders, overdue plans moved to Free, unpaid first orders closed, partner bills" },
  licences: { label: "Licences and trials", text: "Ends trials that ran out and sends each business a fresh licence before the old one ends" },
}

export default function SystemPage() {
  const { is } = useAuth()
  const h = useApi<Health>("/system/health")
  const [running, setRunning] = React.useState<string | null>(null)
  const retry = async (id: string) => {
    try {
      await api.post(`/system/deliveries/${id}/retry`)
      toast.success("Trying again now")
      setTimeout(() => void h.reload(), 4000)
    } catch (x) {
      toast.error(errorMessage(x))
    }
  }
  const run = async (name: string) => {
    setRunning(name)
    try {
      const r = await api.post<{ lastSummary: string | null }>(`/system/jobs/${name}/run`)
      toast.success(`${JOB[name]?.label ?? name}: ${r.lastSummary ?? "done"}`)
      void h.reload()
    } catch (x) {
      toast.error(errorMessage(x))
    } finally {
      setRunning(null)
    }
  }
  return (
    <Page eyebrow="Insights" title="System health" subtitle="The ERP connection and the work the Console does in the background." actions={<Button variant="outline" onClick={() => void h.reload()}><RotateCw /> Check again</Button>}>
      {h.error && !h.data && <Failed error={h.error} onRetry={h.reload} />}
      <StatGrid cols={3}>
        {h.data ? (
          <>
            <Stat icon={h.data.erp.reachable ? CheckCircle2 : XCircle} label="ERP" value={h.data.erp.reachable ? "Answering" : "Not answering"} hint={`${h.data.erp.ms} ms`} tone={h.data.erp.reachable ? "good" : "warn"} />
            <Stat icon={Send} label="Changes on their way" value={h.data.deliveries.waiting} hint="Retried by themselves with growing waits" />
            <Stat icon={Activity} label="Changes that gave up" value={h.data.deliveries.stuck.length} hint="After 12 tries; fix the cause, then try again" tone={h.data.deliveries.stuck.length ? "warn" : "good"} />
          </>
        ) : <StatSkeletons n={3} />}
      </StatGrid>
      {!h.data ? <Loading /> : (
        <>
          {h.data.deliveries.stuck.length > 0 && (
            <Panel title="Changes that couldn’t reach the ERP" padded={false}>
              <div className="divide-y px-3 pb-3">
                {h.data.deliveries.stuck.map((d) => (
                  <Row key={d.id} icon={XCircle} tone="red" title={<span>{KIND[d.kind] ?? d.kind} · <Link href={`/businesses/${d.businessId}`} className="text-primary hover:underline">open the business</Link></span>} detail={`${formatDateTime(d.createdAt)}${d.lastError ? ` · ${d.lastError}` : ""}`} right={<Button size="sm" variant="outline" onClick={() => void retry(d.id)}>Try again</Button>} />
                ))}
              </div>
            </Panel>
          )}
          <Panel title="Scheduled jobs" description="Each runs every hour and only acts on what is due, so running one again is safe." padded={false}>
            <div className="divide-y px-3 pb-3">
              {Object.keys(JOB).map((name) => {
                const j = h.data!.jobs.find((x) => x.name === name)
                return (
                  <Row key={name} icon={Clock} tone={j?.lastError ? "red" : j ? "green" : "grey"}
                    title={<span className="flex items-center gap-2">{JOB[name].label}{j?.lastError ? <Chip tone="red">Failed</Chip> : j?.lastFinishedAt ? <Chip tone="green">OK</Chip> : <Chip tone="grey">Not run yet</Chip>}</span>}
                    detail={j ? `${j.lastError ?? j.lastSummary ?? JOB[name].text} · ${j.lastFinishedAt ? `finished ${ago(j.lastFinishedAt)}` : j.lastStartedAt ? `started ${ago(j.lastStartedAt)}` : ""}` : JOB[name].text}
                    right={is("admin") ? <Button size="sm" variant="outline" disabled={!!running} onClick={() => void run(name)}>{running === name ? <Loader2 className="animate-spin" /> : <Play />} Run now</Button> : undefined} />
                )
              })}
            </div>
          </Panel>
        </>
      )}
    </Page>
  )
}
