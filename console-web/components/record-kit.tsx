"use client"

import * as React from "react"
import { Check, Copy, History as HistoryIcon } from "lucide-react"
import { Spinner } from "@/components/common"
import { Avatar, Section } from "@/components/page-parts"
import { ErrorState } from "@/components/page-states"
import { formatDateTime } from "@/lib/format"
import { useApi } from "@/lib/use-api"
import type { Activity } from "@/lib/types"
import { cn } from "@/lib/utils"

// What every record page has besides its own content (same as the ERP's record kit): the record's
// history and an "About this record" card with who made it, when, and its ID to copy.

/** The History tab: what happened to the record, newest first, ending with when it was made */
export function RecordHistory({ businessId, created }: { businessId: string; created?: { at: string | null | undefined; by?: string | null } }) {
  const res = useApi<{ data: Activity[] }>(`/console/audit?businessId=${businessId}&limit=100`)
  const rows = res.data?.data ?? []
  return (
    <Section title="History" description="What happened to this record and who did it" flush>
      {res.error && !res.data ? <ErrorState error={res.error} onRetry={() => void res.reload()} /> : !res.data ? <div className="grid place-items-center py-10"><Spinner /></div> : (
        <ol className="relative grid gap-0 px-5 py-4">
          {rows.map((e) => (
            <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
              <span className="absolute top-8 bottom-0 left-4 w-px bg-border" aria-hidden />
              <Avatar name={e.actor ?? "AHEAD"} className="size-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{e.text}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(e.at)}</p>
              </div>
            </li>
          ))}
          {created?.at && (
            <li className="relative flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><HistoryIcon className="size-4" /></span>
              <div><p className="text-sm"><span className="font-semibold">Created</span>{created.by && <span className="text-muted-foreground"> by {created.by}</span>}</p><p className="text-xs text-muted-foreground">{formatDateTime(created.at)}</p></div>
            </li>
          )}
          {!rows.length && !created?.at && <p className="py-6 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>}
        </ol>
      )}
    </Section>
  )
}

/** Who made the record and when, and its ID to copy for support */
export function AboutCard({ id, createdAt, createdBy, extra, className }: { id: string; createdAt?: string | null; createdBy?: string | null; extra?: [string, React.ReactNode][]; className?: string }) {
  const [copied, setCopied] = React.useState(false)
  const copy = () => { void navigator.clipboard?.writeText(id).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }
  const rows: [string, React.ReactNode][] = [
    ...(extra ?? []),
    ...(createdBy ? [["Created by", createdBy] as [string, React.ReactNode]] : []),
    ...(createdAt ? [["Created on", formatDateTime(createdAt)] as [string, React.ReactNode]] : []),
  ]
  return (
    <Section title="About this record" className={className}>
      <dl className="grid gap-2.5 text-sm">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Record ID</dt>
          <dd><button type="button" onClick={copy} className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted", copied && "text-emerald-600")} title="Copy the ID">{copied ? <Check className="size-3" /> : <Copy className="size-3" />}{id.slice(0, 8)}…</button></dd>
        </div>
      </dl>
    </Section>
  )
}
