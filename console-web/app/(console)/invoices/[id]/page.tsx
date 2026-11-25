"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { Printer } from "lucide-react"
import { GST_STATES } from "@contracts/validation"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/form"
import { ActionDialog, fieldErrors } from "@/components/action-dialog"
import { Failed, Loading, Page } from "@/components/kit"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { formatDate, formatPaise } from "@/lib/format"
import type { Invoice } from "@/lib/types"

const STATES = new Map(GST_STATES)
const stateName = (code: string | null) => (code ? STATES.get(code) ?? code : "—")

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>()
  const { is } = useAuth()
  const inv = useApi<Invoice>(`/billing/invoices/${id}`)
  const [credit, setCredit] = React.useState(false)
  if (inv.error && !inv.data) return <Failed error={inv.error} onRetry={inv.reload} />
  if (!inv.data) return <Loading />
  const i = inv.data
  const pay = i.order?.payments?.[0]
  return (
    <Page
      back={{ href: "/billing/invoices", label: "Invoices" }}
      title={`Invoice ${i.number}`}
      subtitle={`${i.order?.business?.name ?? i.billTo.name} · ${formatDate(i.issuedAt)}`}
      actions={
        <span className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}><Printer /> Print or save PDF</Button>
          {is("admin") && !i.creditNote && <Button variant="outline" onClick={() => setCredit(true)}>Credit note</Button>}
        </span>
      }
    >
      <article className="mx-auto max-w-3xl rounded-2xl border bg-white p-8 text-sm text-zinc-900 shadow-xs print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-wrap justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-lg font-bold">{i.seller.legalName}</p>
            <p className="max-w-xs whitespace-pre-line text-zinc-600">{i.seller.address}</p>
            <p className="text-zinc-600">GSTIN {i.seller.gstin} · {stateName(i.seller.stateCode)}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold tracking-tight">Tax invoice</p>
            <p className="font-mono">{i.number}</p>
            <p className="text-zinc-600">{formatDate(i.issuedAt)}</p>
          </div>
        </header>
        <section className="grid gap-1 border-b py-4">
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Bill to</p>
          <p className="font-semibold">{i.billTo.name}</p>
          <p className="text-zinc-600">{i.billTo.gstin ? `GSTIN ${i.billTo.gstin} · ` : ""}Place of supply: {stateName(i.billTo.stateCode)}</p>
          <p className="text-zinc-600">{i.billTo.email}</p>
        </section>
        <table className="mt-4 w-full">
          <thead className="border-b text-left text-xs text-zinc-500">
            <tr><th className="py-2">Description</th><th>SAC</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr>
          </thead>
          <tbody>
            {i.lines.map((l, n) => (
              <tr key={n} className="border-b border-zinc-100">
                <td className="py-2">{l.description}</td><td>{l.sac}</td><td className="text-right tabular-nums">{l.quantity}</td><td className="text-right tabular-nums">{formatPaise(l.unitPaise)}</td><td className="text-right tabular-nums">{formatPaise(l.amountPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-4 grid max-w-xs gap-1">
          {(() => {
            const subtotalPaise = i.lines.reduce((sum, l) => sum + l.amountPaise, 0)
            const discountPaise = subtotalPaise - i.taxablePaise
            const gstRate = i.igstPaise > 0
              ? Math.round((i.igstPaise / i.taxablePaise) * 100)
              : i.cgstPaise > 0
                ? Math.round(((i.cgstPaise + i.sgstPaise) / i.taxablePaise) * 100)
                : 0
            return (
              <>
                {discountPaise > 0 && (
                  <>
                    <Sum k="Subtotal" v={subtotalPaise} />
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <dt>Discount</dt>
                      <dd className="tabular-nums">−{formatPaise(discountPaise)}</dd>
                    </div>
                  </>
                )}
                <Sum k="Taxable value" v={i.taxablePaise} />
                {i.igstPaise > 0
                  ? <Sum k={gstRate ? `IGST @ ${gstRate}%` : "IGST"} v={i.igstPaise} />
                  : <><Sum k={gstRate ? `CGST @ ${gstRate / 2}%` : "CGST"} v={i.cgstPaise} /><Sum k={gstRate ? `SGST @ ${gstRate / 2}%` : "SGST"} v={i.sgstPaise} /></>
                }
                <div className="flex justify-between border-t pt-1 text-base font-bold"><dt>Total</dt><dd className="tabular-nums">{formatPaise(i.totalPaise)}</dd></div>
              </>
            )
          })()}
        </dl>
        {pay && <p className="mt-6 text-zinc-600">Paid {formatDate(pay.receivedAt)} by {pay.method}{pay.reference ? ` (${pay.reference})` : ""}.</p>}
        {i.creditNote && <p className="mt-3 rounded-lg bg-zinc-100 p-3">Cancelled by credit note {i.creditNote.number} on {formatDate(i.creditNote.issuedAt)}: {i.creditNote.reason}</p>}
      </article>
      {credit && <CreditDialog invoice={i} onClose={() => setCredit(false)} onDone={inv.reload} />}
    </Page>
  )
}

function Sum({ k, v }: { k: string; v: number }) {
  return <div className="flex justify-between"><dt className="text-zinc-600">{k}</dt><dd className="tabular-nums">{formatPaise(v)}</dd></div>
}

function CreditDialog({ invoice, onClose, onDone }: { invoice: Invoice; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = React.useState("")
  const [endPlan, setEndPlan] = React.useState(false)
  const [error, setError] = React.useState<string>()
  return (
    <ActionDialog open onOpenChange={() => onClose()} destructive title={`Credit note for ${invoice.number}`} submitLabel="Issue credit note"
      description={`Cancels the whole invoice (${formatPaise(invoice.totalPaise)}). Refund the money yourself; this records it for GST.`}
      onSubmit={async () => {
        if (reason.trim().length < 3) { setError("Say why"); return { reason: "Say why" } }
        try {
          const cn = await api.post<{ number: string }>(`/billing/invoices/${invoice.id}/credit-note`, { reason: reason.trim(), endPlan })
          toast.success(`Credit note ${cn.number} issued`)
          onDone()
        } catch (x) {
          const f = fieldErrors(x)
          setError(f.reason)
          return f
        }
      }}>
      <Field label="Why" required error={error}><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Charged twice for the same month" maxLength={300} autoFocus /></Field>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={endPlan} onCheckedChange={(v) => setEndPlan(!!v)} /> Also end the paid plan now (the business moves to Free)</label>
    </ActionDialog>
  )
}
