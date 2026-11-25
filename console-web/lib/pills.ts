// Status words and their colour, the same on every list and record page (colours from lib/tones).

export const BUSINESS_PILL: Record<string, { label: string; color: string }> = {
  incomplete: { label: "Awaiting payment", color: "amber" },
  trialing: { label: "Trial", color: "blue" },
  active: { label: "Paying", color: "emerald" },
  past_due: { label: "Overdue", color: "rose" },
  free: { label: "Free", color: "slate" },
  closed: { label: "Closed", color: "slate" },
}

export const ORDER_PILL: Record<string, { label: string; color: string }> = {
  pending_approval: { label: "Needs approval", color: "violet" },
  awaiting_payment: { label: "Awaiting payment", color: "amber" },
  paid: { label: "Paid", color: "emerald" },
  cancelled: { label: "Cancelled", color: "slate" },
  expired: { label: "Expired", color: "slate" },
}

export const PERSON_PILL: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "emerald" },
  invited: { label: "Invited", color: "blue" },
  disabled: { label: "Inactive", color: "slate" },
  new: { label: "New", color: "blue" },
  approved: { label: "Approved", color: "emerald" },
  rejected: { label: "Rejected", color: "slate" },
}

export const BILL_PILL: Record<string, { label: string; color: string }> = {
  awaiting_payment: { label: "Unpaid", color: "amber" },
  paid: { label: "Paid", color: "emerald" },
  cancelled: { label: "Cancelled", color: "slate" },
}

/** How the business came to AHEAD */
export const BY_PILL: Record<string, { label: string; color: string }> = {
  website: { label: "Website", color: "slate" },
  team: { label: "AHEAD team", color: "emerald" },
  sales: { label: "Sales", color: "blue" },
  vendor: { label: "Vendor", color: "amber" },
  partner: { label: "Partner", color: "violet" },
}

export const METHOD_LABEL: Record<string, string> = { online: "Online", bank: "Bank transfer", upi: "UPI", cheque: "Cheque", cash: "Cash" }

/** The other Billing lists, under the ⋯ menu of each */
export const billingMore = (team: boolean, here: "orders" | "payments" | "invoices" | "renewals") =>
  [
    { key: "orders", label: "Orders", href: "/billing" },
    { key: "payments", label: "Payments", href: "/billing/payments" },
    { key: "invoices", label: "Invoices", href: "/billing/invoices" },
    ...(team ? [{ key: "renewals", label: "Renewals", href: "/billing/renewals" }] : []),
  ].filter((x) => x.key !== here).map(({ label, href }) => ({ label, href }))
