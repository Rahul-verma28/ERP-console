"use client"

import { Activity, BarChart3, TicketPercent, CalendarClock, FileText, Wallet, Blocks, Building2, ClipboardCheck, CreditCard, Handshake, Inbox, KeyRound, LayoutDashboard, Link2, ReceiptText, Settings2, ShieldCheck, Tags, Users, type LucideIcon } from "lucide-react"
import { useAuth } from "@/lib/auth"

// The Console menu per role. Groups and items appear only for the roles that may open them;
// console-api checks the same on every request.

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  show: boolean
}
export interface NavGroup {
  label: string
  items: NavItem[]
}

export function useNav(): { groups: NavGroup[]; settings: NavItem | null } {
  const { me, is, partner } = useAuth()
  const clean = (groups: NavGroup[]) => groups.map((g) => ({ ...g, items: g.items.filter((i) => i.show) })).filter((g) => g.items.length)
  if (!me) return { groups: [], settings: null }

  if (partner) {
    return {
      groups: clean([
        {
          label: "Workspace",
          items: [
            { href: "/", label: "Overview", icon: LayoutDashboard, show: true },
            { href: "/businesses", label: "Clients", icon: Building2, show: true },
            { href: "/onboarding", label: "Onboarding", icon: ClipboardCheck, show: true },
            { href: "/bills", label: "Monthly bill", icon: ReceiptText, show: true },
          ],
        },
        { label: "People", items: [{ href: "/team", label: "Team", icon: Users, show: is("partner_owner") }] },
        { label: "Insights", items: [{ href: "/analytics", label: "Analytics", icon: BarChart3, show: true }] },
      ]),
      settings: null,
    }
  }
  if (is("sales", "vendor")) {
    return {
      groups: clean([
        {
          label: "Workspace",
          items: [
            { href: "/", label: "Overview", icon: LayoutDashboard, show: true },
            { href: "/businesses", label: "My businesses", icon: Building2, show: true },
            { href: "/onboarding", label: "Onboarding", icon: ClipboardCheck, show: true },
            { href: "/billing", label: "Orders", icon: CreditCard, show: true },
            { href: "/referral", label: "My link & code", icon: Link2, show: !!me.referralCode },
          ],
        },
        { label: "Insights", items: [{ href: "/analytics", label: "My numbers", icon: BarChart3, show: true }] },
      ]),
      settings: null,
    }
  }
  const admin = is("admin")
  return {
    groups: clean([
      {
        label: "Workspace",
        items: [
          { href: "/", label: "Overview", icon: LayoutDashboard, show: true },
          { href: "/businesses", label: "Businesses", icon: Building2, show: true },
          { href: "/onboarding", label: "Onboarding", icon: ClipboardCheck, show: true },
          { href: "/partners", label: "Partners", icon: Handshake, show: true },
        ],
      },
      {
        label: "Billing",
        items: [
          { href: "/billing", label: "Orders", icon: CreditCard, show: true },
          { href: "/billing/payments", label: "Payments", icon: Wallet, show: true },
          { href: "/billing/invoices", label: "Invoices", icon: FileText, show: true },
          { href: "/billing/renewals", label: "Renewals", icon: CalendarClock, show: true },
        ],
      },
      {
        label: "Product",
        items: [
          { href: "/plans", label: "Plans & pricing", icon: Tags, show: admin },
          { href: "/coupons", label: "Coupons", icon: TicketPercent, show: admin },
          { href: "/modules", label: "Modules", icon: Blocks, show: true },
        ],
      },
      {
        label: "People & access",
        items: [
          { href: "/team", label: "Team", icon: Users, show: admin },
          { href: "/roles", label: "Roles", icon: KeyRound, show: true },
          { href: "/applications", label: "Applications", icon: Inbox, show: true },
          { href: "/security", label: "Security & audit", icon: ShieldCheck, show: admin },
        ],
      },
      {
        label: "Insights",
        items: [
          { href: "/analytics", label: "Analytics", icon: BarChart3, show: true },
          { href: "/system", label: "System health", icon: Activity, show: true },
        ],
      },
    ]),
    settings: admin ? { href: "/settings", label: "Settings", icon: Settings2, show: true } : null,
  }
}
