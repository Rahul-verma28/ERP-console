"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { LogOut, Menu, UserRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ConsoleLook, ThemeSwitch } from "@/components/console-look"
import { Palette } from "@/components/palette"
import { NotificationsBell } from "@/components/notifications-bell"
import { HelpPanel } from "@/components/help-panel"
import { useNav, type NavItem } from "@/components/nav"
import { ROLE_LABEL, useAuth } from "@/lib/auth"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

// The Console's frame: grouped sidebar, sticky top bar with Ctrl+K search, help, notifications
// and the account menu. Each person sees only the groups and pages their role allows.

/** The menu item a path belongs to: the longest matching href wins */
function useActive() {
  const pathname = usePathname()
  const { groups, settings } = useNav()
  const all = [...groups.flatMap((g) => g.items), ...(settings ? [settings] : [])]
  const match = all.filter((i) => (i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(`${i.href}/`))).sort((a, b) => b.href.length - a.href.length)[0]
  return match?.href ?? null
}

function Brand() {
  const { me } = useAuth()
  const partner = me?.partner
  return (
    <Link href="/" className="flex min-w-0 items-center gap-2 rounded-2xl px-2 py-1.5 hover:bg-muted">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-xs font-bold text-primary-foreground">
        {partner ? <span className="text-xs font-bold">{initials(partner.name)}</span> : <span className="text-sm font-bold">A</span>}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{partner ? partner.name : "AHEAD"}</span>
        <span className="block truncate text-xs text-muted-foreground">{partner ? "Partner portal" : "Console"} · {me && ROLE_LABEL[me.role]}</span>
      </span>
    </Link>
  )
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground", active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground")}
    >
      <item.icon className="size-4" /> {item.label}
    </Link>
  )
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { groups, settings } = useNav()
  const active = useActive()
  return (
    <>
      <nav className="flex flex-col gap-5" aria-label="Console">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-0.5">
            <div className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{g.label}</div>
            {g.items.map((item) => (
              <NavLink key={item.href} item={item} active={active === item.href} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>
      {settings && (
        <div className="mt-auto border-t pt-3">
          <NavLink item={settings} active={active === settings.href} onNavigate={onNavigate} />
        </div>
      )}
    </>
  )
}

function AccountMenu() {
  const { me, signOut } = useAuth()
  const router = useRouter()
  if (!me) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="grid size-9 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground outline-offset-2" aria-label="Account menu">
        {initials(me.name)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate text-sm font-medium text-foreground">{me.name}</span>
            <span className="block truncate text-xs font-normal">{me.email} · {ROLE_LABEL[me.role]}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/account")}>
          <UserRound className="size-4" /> My account
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut()
            router.replace("/login")
          }}
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-3">
      <Brand />
      <Nav onNavigate={onNavigate} />
    </div>
  )
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  return (
    <div className="flex min-h-svh bg-background">
      <ConsoleLook />
      <aside className="sticky top-0 hidden h-svh w-[272px] shrink-0 border-r border-sidebar-border bg-sidebar lg:block print:hidden">
        <SidebarBody />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-sidebar shadow-xl">
            <Button variant="ghost" size="icon" className="absolute top-4 right-3" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X className="size-4" />
            </Button>
            <SidebarBody onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-card px-4 print:hidden">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
          <Palette />
          <div className="flex-1" />
          <ThemeSwitch />
          <HelpPanel />
          <NotificationsBell />
          <AccountMenu />
        </header>
        <main className="w-full flex-1 px-4 py-5 sm:px-6">{children}</main>
      </div>
    </div>
  )
}
