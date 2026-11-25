"use client"

import * as React from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Field, NativeSelect } from "@/components/form"
import { ActionDialog, fieldErrors } from "@/components/action-dialog"
import { api } from "@/lib/api"
import { formatPaise } from "@/lib/format"
import type { Order } from "@/lib/types"

// Order actions shared by Billing and a business's page: cancel, and record money received
// outside the payment link (the plan starts and the invoice is made at once).

export function CancelDialog({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string>()
  return (
    <ActionDialog open onOpenChange={() => onClose()} destructive title="Cancel this order?" submitLabel="Cancel order"
      description={`${order.business?.name} · ${formatPaise(order.totalPaise)}. The payment link stops working.`}
      onSubmit={async () => {
        if (reason.trim().length < 3) { setError("Say why"); return { reason: "Say why" } }
        try {
          await api.post(`/billing/orders/${order.id}/cancel`, { reason: reason.trim() })
          toast.success("Order cancelled")
          onDone()
        } catch (x) {
          const f = fieldErrors(x)
          setError(f.reason)
          return f
        }
      }}>
      <Field label="Why" required error={error}><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Owner chose the yearly plan instead" maxLength={200} autoFocus /></Field>
    </ActionDialog>
  )
}

export function PaymentDialog({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [f, setF] = React.useState({ method: "bank", reference: "", receivedAt: today })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  return (
    <ActionDialog open onOpenChange={() => onClose()} title="Record a payment" submitLabel={`Record ${formatPaise(order.totalPaise)}`}
      description={`Money for ${order.business?.name} received outside the link. The plan starts and the invoice is made at once.`}
      onSubmit={async () => {
        const e: Record<string, string> = {}
        if (f.method !== "cash" && f.reference.trim().length < 3) e.reference = "Enter the UTR, UPI or cheque number"
        if (!f.receivedAt || f.receivedAt > today) e.receivedAt = "Choose a date up to today"
        setErrors(e)
        if (Object.keys(e).length) return e
        try {
          const out = await api.post<{ invoice: string }>(`/billing/orders/${order.id}/payments`, { method: f.method, reference: f.reference.trim() || null, receivedAt: new Date(`${f.receivedAt}T12:00:00+05:30`).toISOString(), amountPaise: order.totalPaise })
          toast.success(`Payment recorded; invoice ${out.invoice}`)
          onDone()
        } catch (x) {
          const fe = fieldErrors(x)
          setErrors(fe)
          return fe
        }
      }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Paid by">
          <NativeSelect value={f.method} onChange={(e) => setF((x) => ({ ...x, method: e.target.value }))}>
            <option value="bank">Bank transfer</option>
            <option value="upi">UPI</option>
            <option value="cheque">Cheque</option>
            <option value="cash">Cash</option>
          </NativeSelect>
        </Field>
        <Field label="Received on" error={errors.receivedAt}><Input type="date" value={f.receivedAt} max={today} onChange={(e) => setF((x) => ({ ...x, receivedAt: e.target.value }))} /></Field>
        {f.method !== "cash" && <Field label={f.method === "cheque" ? "Cheque number" : "UTR / reference"} required error={errors.reference} className="sm:col-span-2"><Input value={f.reference} onChange={(e) => setF((x) => ({ ...x, reference: e.target.value }))} placeholder="e.g. HDFC0000123456" maxLength={60} className="font-mono" /></Field>}
      </div>
    </ActionDialog>
  )
}
