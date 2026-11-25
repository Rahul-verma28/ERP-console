// What console-api answers, as the Console's pages use it.

export type SubStatus = "incomplete" | "trialing" | "active" | "past_due" | "free" | "closed"
export type Cycle = "monthly" | "yearly"

export interface Limits {
  users: number
  branches: number
  contacts: number | null
  items: number | null
  invoicesPerMonth: number | null
  storageMb: number
  aiCredits: number
}

export interface Plan {
  key: string
  name: string
  tagline: string
  monthlyPaise: number | null
  yearlyPaise: number | null
  limits: Limits
  modules: string[]
  isFree: boolean
  isTrial: boolean
  isPublic: boolean
  active: boolean
  sortOrder: number
  businesses?: number
}

export interface BusinessRow {
  id: string
  name: string
  ownerName: string
  ownerEmail: string
  ownerMobile: string
  gstin: string | null
  onboardedBy: "website" | "team" | "sales" | "vendor" | "partner"
  provisionedAt: string | null
  createdAt: string
  partner: { name: string } | null
  onboarder: { name: string } | null
  subscription: { status: SubStatus; planKey: string; trialEndsAt: string | null; periodEnd: string | null; cycle?: Cycle; plan: { name: string } } | null
  industryKey?: string
  partnerId?: string | null
  progress?: { signedIn: boolean; setupDone: boolean; lastActiveAt: string | null }
}

export interface ErpFacts {
  status: string
  owner: { name: string; email: string; mobile: string; lastLoginAt: string | null } | null
  ownerLink: { sentAt: string; usedAt: string | null } | null
  setupDone: boolean
  lastActiveAt: string | null
  team: { active: number; invited: number; branches: number }
  usage: { invoicesThisMonth: number; customers: number; storageBytes: number }
  licence: { seq: number; status: string; plan: string; expiresAt: string } | null
}

export interface BusinessDetail {
  id: string
  name: string
  legalName: string | null
  gstin: string | null
  stateCode: string | null
  industryKey: string
  ownerName: string
  ownerEmail: string
  ownerMobile: string
  onboardedBy: BusinessRow["onboardedBy"]
  referralCode: string | null
  provisionedAt: string | null
  ownerLinkSentAt: string | null
  createdAt: string
  partner: { id: string; name: string } | null
  onboarder: { id: string; name: string; role: string } | null
  subscription: { status: SubStatus; planKey: string; cycle: Cycle; trialEndsAt: string | null; periodStart: string | null; periodEnd: string | null; graceEndsAt: string | null; extraUsers: number; closedAt: string | null; purgeAt: string | null; plan: Plan } | null
  overrides: { moduleKey: string; state: "on" | "off"; until: string | null }[]
  notes: { id: string; text: string; createdAt: string; authorId: string }[]
  licences: { seq: number; status: string; planKey: string; issuedAt: string; expiresAt: string; deliveredAt: string | null }[]
  facts: ErpFacts | null
  factsLive: boolean
  pending: { kind: string; attempts: number; lastError: string | null; nextAttemptAt: string }[]
}

export interface Order {
  id: string
  businessId: string
  kind: "new" | "renewal" | "change"
  status: "pending_approval" | "awaiting_payment" | "paid" | "cancelled" | "expired"
  planKey: string
  cycle: Cycle
  extraUsers: number
  listPaise: number
  discountPct: number | null
  couponCode: string | null
  discountPaise: number
  taxablePaise: number
  totalPaise: number
  billTo: { name: string; email: string; kind: "business" | "partner" }
  expiresAt: string
  paidAt: string | null
  linkUrl: string | null
  linkSentAt: string | null
  cancelReason: string | null
  createdAt: string
  business?: { name: string }
  invoice?: { id: string; number: string } | null
}

export interface Quote {
  kind: "new" | "renewal" | "change"
  needsApproval: boolean
  listPaise: number
  discountPaise: number
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  totalPaise: number
  lines: { description: string; quantity: number; unitPaise: number; amountPaise: number }[]
  billTo: { name: string; kind: "business" | "partner" }
}

export interface Invoice {
  id: string
  number: string
  issuedAt: string
  totalPaise: number
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  businessId: string
  seller: { legalName: string; gstin: string; address: string; stateCode: string; sac: string }
  billTo: { name: string; gstin: string | null; stateCode: string | null; email: string }
  lines: { description: string; sac: string; quantity: number; unitPaise: number; amountPaise: number }[]
  creditNote: { number: string; reason: string; issuedAt: string } | null
  order?: { business?: { name: string }; payments?: { method: string; reference: string | null; receivedAt: string; amountPaise: number }[] }
}

export interface Partner {
  id: string
  name: string
  code: string
  contactName: string
  email: string
  mobile: string
  gstin: string | null
  stateCode: string | null
  city: string | null
  discountPct: number
  status: "active" | "disabled" | "invited"
  createdAt: string
  businesses?: number
  liveBusinesses?: number
  people?: number
  unpaidPaise?: number
}

export interface PartnerBill {
  id: string
  month: string
  status: "awaiting_payment" | "paid" | "cancelled"
  lines: { businessId: string; name: string; plan: string; extraUsers: number; listPaise: number; chargePaise: number }[]
  subtotalPaise: number
  totalPaise: number
  dueAt: string
  linkUrl: string | null
  paidAt: string | null
  paymentRef: string | null
  invoiceNumber: string | null
}

export interface Person {
  id: string
  name: string
  email: string
  mobile: string | null
  role: import("@/lib/auth").Role
  status: "invited" | "active" | "disabled"
  referralCode: string | null
  partnerId: string | null
  mfaEnabledAt: string | null
  lastLoginAt: string | null
  createdAt: string
  partner?: { name: string } | null
}

export interface Application {
  id: string
  kind: "vendor" | "partner"
  name: string
  company: string | null
  email: string
  mobile: string
  city: string | null
  stateCode: string | null
  gstin: string | null
  message: string | null
  status: "new" | "approved" | "rejected"
  decisionNote: string | null
  createdAt: string
  kycFiles: number
}

export interface ConsoleFile {
  id: string
  name: string
  mime: string
  sizeBytes: number
  createdAt: string
}

export interface Page<T> {
  data: T[]
  total: number
  page?: number
  pageSize?: number
  counts?: Record<string, number>
}

export interface HomeTodo { kind: "discount" | "unpaid" | "signin" | "trial" | "setup"; title: string; detail: string; href: string; action: string }
export interface Activity { id: string; at: string; action: string; area: string; text: string; href: string | null; actor: string | null; ip: string | null; before: unknown; after: unknown }

export interface ConsoleHome {
  stats: { key: string; label: string; value: number; money?: boolean; hint: string; href: string }[]
  todo: HomeTodo[]
  growth: { weekStart: string; newBusinesses: number; firstPayments: number }[]
  planMix: { key: string; name: string; count: number }[]
  onboarding: { id: string; name: string; createdAt: string; signedIn: boolean; percent: number }[]
  recent: { id: string; name: string; createdAt: string; industryKey: string; status: SubStatus | null }[]
  activity: Activity[]
  referral: { code: string; businesses: number; viaCode: number; paying: number } | null
}

export interface Payment {
  id: string
  method: string
  amountPaise: number
  reference: string | null
  receivedAt: string
  order: { id: string; planKey: string; cycle: Cycle; business: { id: string; name: string }; invoice: { id: string; number: string } | null }
}

export interface Renewal {
  id: string
  businessId: string
  name: string
  plan: string
  cycle: Cycle
  status: SubStatus
  periodEnd: string
  graceEndsAt: string | null
  partnerBilled: boolean
  renewalOrder: { id: string; totalPaise: number; linkUrl: string | null } | null
}
