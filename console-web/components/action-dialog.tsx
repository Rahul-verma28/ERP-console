"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ApiError, errorMessage } from "@/lib/api"

// The one dialog every Console action uses: a title, a few fields, one button. The action runs once
// on submit; field errors from the server come back to the fields, anything else is a toast.

export function ActionDialog({
  open, onOpenChange, title, description, children, submitLabel, onSubmit, destructive, wide,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  submitLabel: string
  /** Return field errors to show them; throw for anything else */
  onSubmit: () => Promise<Record<string, string> | void>
  destructive?: boolean
  wide?: boolean
}) {
  const [busy, setBusy] = React.useState(false)
  const run = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const fields = await onSubmit()
      if (!fields || !Object.keys(fields).length) onOpenChange(false)
    } catch (x) {
      toast.error(errorMessage(x))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className={wide ? "sm:max-w-2xl" : "sm:max-w-md"}>
        <form onSubmit={(e) => void run(e)} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={busy}>{busy && <Loader2 className="animate-spin" />} {submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Field errors of a failed call, or rethrow when it failed for another reason */
export function fieldErrors(x: unknown): Record<string, string> {
  if (x instanceof ApiError && Object.keys(x.fields).length) return x.fields
  throw x
}
