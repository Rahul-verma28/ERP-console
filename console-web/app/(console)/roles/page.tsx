"use client"

import { Check, Minus } from "lucide-react"
import { Chip, Failed, Loading, Page, Panel } from "@/components/kit"
import { ROLE_LABEL, useAuth, type Role } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { cn } from "@/lib/utils"

// The six Console roles (approved 29 Oct 2026) and what each can do. Roles are fixed on purpose:
// one clear set is safer than custom roles nobody remembers. console-api enforces the same.

const ROLES: Role[] = ["admin", "staff", "sales", "vendor", "partner_owner", "partner_staff"]
const ABOUT: Record<Role, string> = {
  admin: "Runs AHEAD: everything, including prices, settings, people and approvals.",
  staff: "Looks after every business, order and partner; no prices, settings or people.",
  sales: "AHEAD’s salespeople: the businesses they bring, with their own code.",
  vendor: "Outside sellers: the businesses they bring, with their own code.",
  partner_owner: "A reseller’s owner: their clients, the monthly bill and their own staff.",
  partner_staff: "A reseller’s staff: their clients.",
}
type Can = boolean | "own" | "theirs"
const ROWS: { area: string; what: string; can: Record<Role, Can> }[] = [
  { area: "Businesses", what: "See businesses", can: { admin: true, staff: true, sales: "own", vendor: "own", partner_owner: "theirs", partner_staff: "theirs" } },
  { area: "Businesses", what: "Add a business", can: { admin: true, staff: true, sales: true, vendor: true, partner_owner: true, partner_staff: true } },
  { area: "Businesses", what: "Change plan", can: { admin: true, staff: true, sales: false, vendor: false, partner_owner: true, partner_staff: true } },
  { area: "Businesses", what: "Extend trial, switch modules, close or reopen", can: { admin: true, staff: true, sales: false, vendor: false, partner_owner: false, partner_staff: false } },
  { area: "Billing", what: "Make an order with a discount", can: { admin: true, staff: true, sales: true, vendor: true, partner_owner: false, partner_staff: false } },
  { area: "Billing", what: "Approve a discount above the limit", can: { admin: true, staff: false, sales: false, vendor: false, partner_owner: false, partner_staff: false } },
  { area: "Billing", what: "Record a payment", can: { admin: true, staff: true, sales: false, vendor: false, partner_owner: false, partner_staff: false } },
  { area: "Billing", what: "Issue a credit note", can: { admin: true, staff: false, sales: false, vendor: false, partner_owner: false, partner_staff: false } },
  { area: "Partners", what: "See partners and applications", can: { admin: true, staff: true, sales: false, vendor: false, partner_owner: "theirs", partner_staff: "theirs" } },
  { area: "Partners", what: "Add a partner, approve an application", can: { admin: true, staff: false, sales: false, vendor: false, partner_owner: false, partner_staff: false } },
  { area: "Partners", what: "Pay the monthly bill", can: { admin: false, staff: false, sales: false, vendor: false, partner_owner: true, partner_staff: false } },
  { area: "Product", what: "Edit plans, prices and coupons", can: { admin: true, staff: false, sales: false, vendor: false, partner_owner: false, partner_staff: false } },
  { area: "People", what: "Invite and manage people", can: { admin: true, staff: false, sales: false, vendor: false, partner_owner: "theirs", partner_staff: false } },
  { area: "People", what: "Read the audit trail", can: { admin: true, staff: false, sales: false, vendor: false, partner_owner: false, partner_staff: false } },
  { area: "Console", what: "Settings and appearance", can: { admin: true, staff: false, sales: false, vendor: false, partner_owner: false, partner_staff: false } },
]

export default function RolesPage() {
  const { team } = useAuth()
  const limits = useApi<Record<string, unknown>>(team ? "/console/settings" : null)
  const discount = (limits.data?.["discount.limits"] ?? null) as Record<Role, number> | null
  return (
    <Page eyebrow="People & access" title="Roles" subtitle="The six Console roles and what each can see and do. Admin and Staff always sign in with two-step.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{ROLE_LABEL[r]}</p>
              <span className="flex gap-1.5">{(r === "admin" || r === "staff") && <Chip tone="blue">Two-step</Chip>}{discount && <Chip tone="grey">Up to {discount[r] ?? 0}% off</Chip>}</span>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">{ABOUT[r]}</p>
          </div>
        ))}
      </div>
      {limits.error && team && !limits.data && limits.error.status !== 403 && <Failed error={limits.error} onRetry={limits.reload} />}
      <Panel title="What each role can do" padded={false}>
        {!ROWS ? <Loading /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="border-y px-4 py-2.5 font-medium">Area</th>
                  <th className="border-y px-3 py-2.5 font-medium">Can…</th>
                  {ROLES.map((r) => <th key={r} className="border-y px-3 py-2.5 text-center font-medium">{ROLE_LABEL[r]}</th>)}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr key={row.what} className="hover:bg-muted/40">
                    <td className="border-b px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{i === 0 || ROWS[i - 1].area !== row.area ? row.area : ""}</td>
                    <td className="border-b px-3 py-2.5">{row.what}</td>
                    {ROLES.map((r) => {
                      const c = row.can[r]
                      return (
                        <td key={r} className="border-b px-3 py-2.5 text-center">
                          {c === true ? <span className="inline-grid size-6 place-items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"><Check className="size-3.5" /></span>
                            : c ? <span className={cn("text-xs font-medium text-sky-700 dark:text-sky-300")}>{c === "own" ? "Their own" : "Their partner’s"}</span>
                              : <Minus className="mx-auto size-3.5 text-muted-foreground/50" />}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Page>
  )
}
