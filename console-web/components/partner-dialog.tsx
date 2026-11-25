"use client"

import * as React from "react"
import { gstin as gstinRule, gstinStateMismatch } from "@contracts/validation"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/form"
import { StateSelect } from "@/components/search-select"
import { NumberStepper } from "@/components/number-stepper"
import { ActionDialog, fieldErrors } from "@/components/action-dialog"
import { api } from "@/lib/api"
import type { Partner } from "@/lib/types"

// Add a partner (its owner gets an invite) or edit one. One call on save.

export function PartnerDialog({ partner, onClose, onSaved }: { partner?: Partner; onClose: () => void; onSaved: (p: Partner) => void }) {
  const [f, setF] = React.useState({
    name: partner?.name ?? "", contactName: partner?.contactName ?? "", email: partner?.email ?? "", mobile: partner?.mobile ?? "",
    gstin: partner?.gstin ?? "", stateCode: partner?.stateCode ?? "", city: partner?.city ?? "", discountPct: String(partner?.discountPct ?? 20),
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }))
  const check = () => {
    const e: Record<string, string> = {}
    if (f.name.trim().length < 2) e.name = "Enter the company name"
    if (f.contactName.trim().length < 2) e.contactName = "Enter the contact person"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email"
    if (!/^(\+91)?[6-9]\d{9}$/.test(f.mobile.replace(/\s/g, ""))) e.mobile = "Enter a 10-digit mobile"
    if (f.gstin) {
      const g = gstinRule(f.gstin.toUpperCase()) ?? (f.stateCode ? gstinStateMismatch(f.gstin.toUpperCase(), f.stateCode) : null)
      if (g) e.gstin = g
    }
    const d = Number(f.discountPct)
    if (!(d >= 0 && d <= 90)) e.discountPct = "From 0 to 90"
    return e
  }
  return (
    <ActionDialog
      open onOpenChange={() => onClose()} wide title={partner ? `Edit ${partner.name}` : "Add a partner"} submitLabel={partner ? "Save" : "Add partner"}
      description={partner ? "A new discount applies from the next monthly bill." : "The contact becomes the partner’s owner in the Console and gets an invite by email."}
      onSubmit={async () => {
        const e = check()
        setErrors(e)
        if (Object.keys(e).length) return e
        const body = { name: f.name.trim(), contactName: f.contactName.trim(), email: f.email.trim(), mobile: f.mobile.replace(/\s/g, ""), gstin: f.gstin.trim().toUpperCase() || null, city: f.city.trim() || null, discountPct: Number(f.discountPct), ...(partner ? {} : { stateCode: f.stateCode || null }) }
        try {
          onSaved(partner ? await api.patch<Partner>(`/partners/${partner.id}`, body) : await api.post<Partner>("/partners", body))
        } catch (x) {
          const fe = fieldErrors(x)
          setErrors(fe)
          return fe
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company name" required error={errors.name}><Input value={f.name} onChange={set("name")} placeholder="e.g. Kumar IT Solutions" autoFocus /></Field>
        <Field label="Contact person" required error={errors.contactName}><Input value={f.contactName} onChange={set("contactName")} placeholder="e.g. Anil Kumar" /></Field>
        <Field label="Email" required error={errors.email}><Input type="email" value={f.email} onChange={set("email")} placeholder="e.g. anil@kumarit.in" /></Field>
        <Field label="Mobile" required error={errors.mobile}><Input mask="phone" value={f.mobile} onChange={set("mobile")} placeholder="e.g. 9876543210" /></Field>
        {!partner && <Field label="State" error={errors.stateCode}><StateSelect value={f.stateCode} onChange={(v) => setF((x) => ({ ...x, stateCode: v }))} /></Field>}
        <Field label="City" error={errors.city}><Input value={f.city} onChange={set("city")} placeholder="e.g. Pune" maxLength={60} /></Field>
        <Field label="GSTIN" hint="Printed on its monthly invoice" error={errors.gstin}><Input mask="gstin" value={f.gstin} onChange={set("gstin")} maxLength={15} className="font-mono uppercase" placeholder="e.g. 27AAKFK1234L1Z5" /></Field>
        <Field label="Discount" hint="Off list price on every client, each month" error={errors.discountPct}><NumberStepper value={f.discountPct} onChange={(v) => setF((x) => ({ ...x, discountPct: v }))} min={0} max={90} suffix="%" aria-label="Discount" className="w-32" /></Field>
      </div>
    </ActionDialog>
  )
}
