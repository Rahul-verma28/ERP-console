"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { CircleHelp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SidePanel } from "@/components/side-panel"

// The "?" in the top bar: a short guide for the page you are on — what it is for, how to do the
// usual things, and what to know. Plain words, the same for the team, vendors and partners.

interface Help {
  title: string
  about: string
  steps: string[]
  notes?: string[]
}

const HELP: [RegExp, Help][] = [
  [/^\/$/, { title: "Overview", about: "What changed, what needs you, and how things are going today.", steps: ["Start with “Needs attention”: unpaid orders, owners who haven’t signed in, discounts to approve, trials ending.", "Click any number to open the list behind it.", "Press Ctrl K to jump to a business or a page."] }],
  [/^\/businesses\/new/, { title: "Add a business", about: "Add a business and its owner. The ERP makes the workspace within seconds and the owner gets a link to set their password.", steps: ["Fill in the business and owner details.", "Pick a free trial, or a paid plan (the payment link goes out at once).", "A partner’s client is billed to the partner, never to the business."], notes: ["“Brought by” is set to you automatically and can’t be changed later."] }],
  [/^\/businesses\/[^/]+/, { title: "A business", about: "Everything about one business: its plan, modules, payments, progress and history.", steps: ["Use the tabs to move between overview, plan & modules, billing and activity.", "Send a new login link if the owner lost theirs; the old one stops working.", "Change the plan, extend a trial or close the business from the ⋮ menu."], notes: ["You see account facts only, never the business’s own customers or invoices."] }],
  [/^\/businesses/, { title: "Businesses", about: "One table with every business you can see.", steps: ["Use the state tabs and filters; save a set you use often with “Save view”.", "Tick rows to send login links or export them.", "Click a row to open the business."] }],
  [/^\/onboarding/, { title: "Onboarding", about: "New businesses that aren’t fully running yet, and the step each one is on.", steps: ["Link sent → owner signed in → setup finished → first payment.", "Send the login link again to an owner who hasn’t signed in.", "A business leaves this list once it is set up (and paid, unless a partner pays)."] }],
  [/^\/billing|^\/invoices/, { title: "Billing", about: "Orders, payments AHEAD received, AHEAD’s invoices and renewals due.", steps: ["Approve a discount above someone’s limit from Orders.", "Record a bank transfer, UPI or cheque on an order: the plan starts and the invoice is made.", "Renewals shows paid plans ending in the next 30 days."], notes: ["Every order has one discount: a coupon, or a percent within the person’s limit."] }],
  [/^\/bills/, { title: "Monthly bill", about: "What AHEAD bills you each month for your clients, after your partner discount.", steps: ["Each client on a paid plan is a line at list price less your discount.", "Pay with the link on the bill; the invoice comes by email.", "Plan changes you make apply from the next bill."] }],
  [/^\/partners/, { title: "Partners", about: "Resellers, their clients, their discount and their monthly bill.", steps: ["Add a partner, or approve one from Applications.", "Open a partner to change its discount, see its bills or make it inactive."] }],
  [/^\/plans/, { title: "Plans & pricing", about: "What each plan includes and costs, and the coupons.", steps: ["Open a plan to change its price, limits or modules.", "Check the impact before saving: who is on the plan and who would lose a module.", "New prices apply to new orders and renewals; modules and limits reach the businesses at once."] }],
  [/^\/modules/, { title: "Modules", about: "Every module, which plans include it and how many businesses have it.", steps: ["Change a plan’s modules in Plans & pricing.", "Turn a module on or off for one business from that business’s Plan & modules tab."] }],
  [/^\/settings/, { title: "Settings", about: "AHEAD’s details on invoices, billing rules and the Console’s look.", steps: ["Pick a section, change what you need and press Save changes.", "Appearance is the look of the Console for everyone in it; light or dark is each person’s own."], notes: ["Every change is kept in the audit trail."] }],
  [/^\/team/, { title: "Team", about: "People who sign in to the Console, and their role.", steps: ["Invite someone: they get an email to set their own password.", "Change a role, make someone inactive, or reset their two-step if they lost their phone."] }],
  [/^\/roles/, { title: "Roles", about: "What each of the six Console roles can see and do.", steps: ["Give each person the smallest role that does their job.", "Discount limits per role are in Settings › Billing."] }],
  [/^\/security/, { title: "Security & audit", about: "Who changed what and when, and who is signed in.", steps: ["Filter the audit trail by area or person.", "Open an entry to see the before and after values.", "End a session you don’t recognise."] }],
  [/^\/applications/, { title: "Applications", about: "People who applied on the website to become a vendor or a partner.", steps: ["Read the application and check the details.", "A partner needs KYC papers before approval.", "Approve: the vendor or partner is made and gets an invite."] }],
  [/^\/analytics/, { title: "Analytics", about: "How AHEAD is doing over the last 3, 6 or 12 months, within the businesses you can see.", steps: ["Switch the period at the top.", "Read “How these numbers are counted” at the bottom for each definition."] }],
  [/^\/system/, { title: "System health", about: "The ERP connection and the work the Console does in the background.", steps: ["Changes that couldn’t reach the ERP retry by themselves; Try again once the cause is fixed.", "Scheduled jobs run every hour; an Admin can run one now."] }],
  [/^\/referral/, { title: "My link & code", about: "Your own link and code. Businesses that sign up with them are yours.", steps: ["Share the link, or give the code to type at signup.", "They appear under My businesses with you as “Brought by”."] }],
  [/^\/account/, { title: "My account", about: "Your name, password, two-step sign-in and devices.", steps: ["Turn on two-step sign-in for extra safety.", "Sign out of devices you no longer use.", "Switch between light, dark and system with the icons in the top bar."] }],
]

const FALLBACK: Help = { title: "Help", about: "Each Console page has a short guide here.", steps: ["Use the menu on the left to move between areas.", "Press Ctrl K to search businesses and pages."] }

export function HelpPanel() {
  const path = usePathname()
  const [open, setOpen] = React.useState(false)
  const help = HELP.find(([re]) => re.test(path))?.[1] ?? FALLBACK
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Help for this page" title="Help for this page">
        <CircleHelp className="size-5" />
      </Button>
      <SidePanel open={open} onOpenChange={setOpen} eyebrow="Help" title={help.title}>
        <div className="grid content-start gap-5 px-5 py-5 text-sm">
          <p className="text-muted-foreground">{help.about}</p>
          <section>
            <h3 className="mb-2 font-medium">How to</h3>
            <ol className="grid gap-2">
              {help.steps.map((s, i) => (
                <li key={s} className="grid grid-cols-[1.5rem_1fr] gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </section>
          {help.notes && (
            <section className="rounded-lg bg-muted/60 p-3">
              <h3 className="mb-1 font-medium">Good to know</h3>
              <ul className="grid gap-1 text-muted-foreground">{help.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </section>
          )}
          <p className="text-xs text-muted-foreground">Press Ctrl K anywhere to search businesses and pages.</p>
        </div>
      </SidePanel>
    </>
  )
}
