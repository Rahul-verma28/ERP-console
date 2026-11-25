"use client"

import * as React from "react"
import { api, refreshAccessToken, serverUnavailable, setAccessToken } from "@/lib/api"

// Who is signed in to the Console. The access token lives in memory; the refresh cookie brings the
// session back after a reload. Roles (approved 29 Oct 2026): Admin, Staff, Sales, Vendor, Partner
// owner, Partner staff. Partner people see the partner portal; everyone else the AHEAD Console.

export type Role = "admin" | "staff" | "sales" | "vendor" | "partner_owner" | "partner_staff"

export interface Me {
  id: string
  name: string
  email: string
  mobile: string | null
  role: Role
  referralCode: string | null
  mfaEnabled: boolean
  partner: { id: string; name: string; code: string } | null
  /** Settings › Appearance: the Console's look for everyone (null = the default) */
  appearance: { preset: string; brandColor: string; font: string; density: "comfortable" | "compact" } | null
}

type Status = "loading" | "anonymous" | "authenticated" | "unavailable"

interface AuthState {
  status: Status
  me: Me | null
  /** After a successful sign-in step that returned an access token */
  signIn: (accessToken: string) => Promise<void>
  signOut: () => Promise<void>
  reload: () => Promise<void>
  /** The person's role is one of these */
  is: (...roles: Role[]) => boolean
  /** Admin or Staff: AHEAD's own team running everything */
  team: boolean
  partner: boolean
}

const Ctx = React.createContext<AuthState | null>(null)

export const ROLE_LABEL: Record<Role, string> = { admin: "Admin", staff: "Staff", sales: "Sales", vendor: "Vendor", partner_owner: "Partner owner", partner_staff: "Partner staff" }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<Status>("loading")
  const [me, setMe] = React.useState<Me | null>(null)

  const load = React.useCallback(async () => {
    try {
      setMe(await api.get<Me>("/me"))
      setStatus("authenticated")
    } catch {
      setMe(null)
      setStatus("anonymous")
    }
  }, [])

  React.useEffect(() => {
    let live = true
    refreshAccessToken().then((token) => {
      if (!live) return
      if (token) void load()
      else setStatus(serverUnavailable ? "unavailable" : "anonymous")
    })
    return () => {
      live = false
    }
  }, [load])

  const value = React.useMemo<AuthState>(() => {
    const role = me?.role
    return {
      status,
      me,
      signIn: async (token) => {
        setAccessToken(token)
        await load()
      },
      signOut: async () => {
        await api.post("/auth/logout").catch(() => undefined)
        setAccessToken(null)
        setMe(null)
        setStatus("anonymous")
      },
      reload: load,
      is: (...roles) => !!role && roles.includes(role),
      team: role === "admin" || role === "staff",
      partner: role === "partner_owner" || role === "partner_staff",
    }
  }, [status, me, load])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = React.useContext(Ctx)
  if (!v) throw new Error("useAuth outside AuthProvider")
  return v
}
