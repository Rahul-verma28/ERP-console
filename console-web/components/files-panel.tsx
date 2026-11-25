"use client"

import * as React from "react"
import { toast } from "sonner"
import { FileText, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Panel } from "@/components/kit"
import { api, authHeader, errorMessage } from "@/lib/api"
import { useApi } from "@/lib/use-api"
import { formatDate } from "@/lib/format"
import type { ConsoleFile } from "@/lib/types"

// KYC papers of a partner or an application: PDF, JPG or PNG up to 5 MB, opened in a new tab.

const TYPES = ["application/pdf", "image/jpeg", "image/png"]

export async function openFile(id: string) {
  const res = await fetch(`/api/v1/files/${id}`, { headers: authHeader(), credentials: "include" })
  if (!res.ok) throw new Error("Couldn’t open the file")
  const url = URL.createObjectURL(await res.blob())
  window.open(url, "_blank", "noopener")
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function FilesPanel({ entityType, entityId, canUpload, title = "KYC papers", description = "PAN, GST certificate, cancelled cheque. PDF, JPG or PNG up to 5 MB." }: { entityType: "partner" | "application"; entityId: string; canUpload: boolean; title?: string; description?: string }) {
  const files = useApi<{ data: ConsoleFile[] }>(`/files?entityType=${entityType}&entityId=${entityId}`)
  const input = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)
  const upload = async (list: FileList | null) => {
    const f = list?.[0]
    if (!f) return
    if (!TYPES.includes(f.type)) return void toast.error("Choose a PDF, JPG or PNG")
    if (f.size > 5 * 1024 * 1024) return void toast.error("The file is over 5 MB")
    setBusy(true)
    try {
      await api.upload(`/files?entityType=${entityType}&entityId=${entityId}`, f, f.name)
      toast.success(`${f.name} added`)
      void files.reload()
    } catch (x) {
      toast.error(errorMessage(x))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ""
    }
  }
  return (
    <Panel title={title} description={description} action={canUpload ? (
      <>
        <input ref={input} type="file" accept={TYPES.join(",")} className="hidden" onChange={(e) => void upload(e.target.files)} />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 className="animate-spin" /> : <Upload />} Add a file</Button>
      </>
    ) : undefined}>
      {!files.data ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : files.data.data.length ? (
        <ul className="grid gap-1.5 text-sm">
          {files.data.data.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => void openFile(f.id).catch((x) => toast.error(errorMessage(x)))} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-muted">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-muted-foreground">{Math.max(1, Math.round(f.sizeBytes / 1024))} KB · {formatDate(f.createdAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No papers yet.</p>
      )}
    </Panel>
  )
}
