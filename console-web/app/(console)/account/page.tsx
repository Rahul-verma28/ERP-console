"use client"

import * as React from "react"
import { toast } from "sonner"
import { Copy, KeyRound, Loader2, MonitorSmartphone, ShieldCheck, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/form"
import { Avatar, Pill } from "@/components/page-parts"
import { InlineSave } from "@/components/save-bar"
import { SettingsCard } from "@/components/settings-parts"
import { ActionDialog, fieldErrors } from "@/components/action-dialog"
import QRCode from "qrcode"
import { api, ApiError, errorMessage } from "@/lib/api"
import { ROLE_LABEL, useAuth } from "@/lib/auth"
import { useApi } from "@/lib/use-api"
import { formatDateTime } from "@/lib/format"

// One page for the signed-in person: their details, password, two-step and where they're signed in.

interface Session { id: string; ip: string | null; userAgent: string | null; createdAt: string; current: boolean }

const device = (ua: string | null) => {
  if (!ua) return "Unknown device"
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser"
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : ""
  return os ? `${b} on ${os}` : b
}

export default function AccountPage() {
  const { me, reload } = useAuth()
  const sessions = useApi<{ data: Session[] }>("/me/sessions")
  const [profile, setProfile] = React.useState({ name: me!.name, mobile: me!.mobile ?? "" })
  const [pErr, setPErr] = React.useState<Record<string, string>>({})
  const [pBusy, setPBusy] = React.useState(false)
  const [pw, setPw] = React.useState({ current: "", password: "", confirm: "" })
  const [wErr, setWErr] = React.useState<Record<string, string>>({})
  const [wBusy, setWBusy] = React.useState(false)
  const dirty = profile.name.trim() !== me!.name || (profile.mobile.replace(/\s/g, "") || null) !== (me!.mobile ?? null)

  const saveProfile = async () => {
    const errs: Record<string, string> = {}
    if (profile.name.trim().length < 2) errs.name = "Enter your name"
    if (profile.mobile && !/^(\+91)?[6-9]\d{9}$/.test(profile.mobile.replace(/\s/g, ""))) errs.mobile = "Enter a 10-digit mobile"
    setPErr(errs)
    if (Object.keys(errs).length) return
    setPBusy(true)
    try {
      await api.patch("/me", { name: profile.name.trim(), mobile: profile.mobile.replace(/\s/g, "") || null })
      await reload()
      toast.success("Saved")
    } catch (x) {
      if (x instanceof ApiError && Object.keys(x.fields).length) setPErr(x.fields)
      else toast.error(errorMessage(x))
    } finally {
      setPBusy(false)
    }
  }

  const savePassword = async () => {
    const errs: Record<string, string> = {}
    if (!pw.current) errs.current = "Enter your current password"
    if (pw.password.length < 10) errs.password = "Use at least 10 characters"
    else if (!/[a-z]/i.test(pw.password) || !/\d/.test(pw.password)) errs.password = "Use letters and at least one number"
    if (pw.confirm !== pw.password) errs.confirm = "The two passwords don’t match"
    setWErr(errs)
    if (Object.keys(errs).length) return
    setWBusy(true)
    try {
      await api.post("/me/password", { current: pw.current, password: pw.password })
      setPw({ current: "", password: "", confirm: "" })
      toast.success("Password changed. You’re signed out everywhere else.")
      void sessions.reload()
    } catch (x) {
      if (x instanceof ApiError && Object.keys(x.fields).length) setWErr(x.fields)
      else toast.error(errorMessage(x))
    } finally {
      setWBusy(false)
    }
  }

  const signOutOthers = async () => {
    try {
      const r = await api.post<{ ended: number }>("/me/sessions/sign-out-others")
      toast.success(r.ended ? `Signed out of ${r.ended} other session${r.ended === 1 ? "" : "s"}` : "No other sessions")
      void sessions.reload()
    } catch (x) {
      toast.error(errorMessage(x))
    }
  }

  const others = sessions.data?.data.filter((s) => !s.current).length ?? 0
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <header className="ui-surface flex flex-wrap items-center gap-4 p-5">
        <Avatar name={me!.name} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] leading-tight font-bold tracking-tight">{me!.name}</h1>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{me!.email}{me!.mobile ? ` · ${me!.mobile}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill color="violet">{ROLE_LABEL[me!.role]}</Pill>
          <Pill color="slate">{me!.partner ? me!.partner.name : "AHEAD"}</Pill>
          <Pill color={me!.mfaEnabled ? "emerald" : "amber"} dot>{me!.mfaEnabled ? "Two-step on" : "Two-step off"}</Pill>
        </div>
      </header>

      <SettingsCard icon={UserRound} title="Your details" description="Your email is your login; an Admin can change it.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" required error={pErr.name}><Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} /></Field>
          <Field label="Mobile" error={pErr.mobile}><Input mask="phone" value={profile.mobile} onChange={(e) => setProfile((p) => ({ ...p, mobile: e.target.value }))} placeholder="e.g. 9876543210" /></Field>
          <Field label="Email"><Input value={me!.email} disabled /></Field>
          {me!.referralCode && (
            <Field label="Your referral code">
              <div className="flex h-10 items-center gap-2 rounded-xl border bg-muted/40 px-3">
                <span className="flex-1 font-mono font-semibold tracking-wider">{me!.referralCode}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => { void navigator.clipboard.writeText(me!.referralCode!); toast.success("Code copied") }}><Copy /> Copy</Button>
              </div>
            </Field>
          )}
        </div>
        <InlineSave className="mt-4" dirty={dirty} saving={pBusy} onSave={() => void saveProfile()} onDiscard={() => { setProfile({ name: me!.name, mobile: me!.mobile ?? "" }); setPErr({}) }} />
      </SettingsCard>

      <SettingsCard id="security" icon={KeyRound} title="Password" description="10 or more characters with letters and a number. Changing it signs you out everywhere else.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Current password" error={wErr.current}><Input type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} /></Field>
          <Field label="New password" error={wErr.password}><Input type="password" autoComplete="new-password" value={pw.password} onChange={(e) => setPw((p) => ({ ...p, password: e.target.value }))} /></Field>
          <Field label="New password again" error={wErr.confirm}><Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} /></Field>
        </div>
        <InlineSave className="mt-4" dirty={!!(pw.current || pw.password || pw.confirm)} saving={wBusy} saveLabel="Change password" onSave={() => void savePassword()} onDiscard={() => { setPw({ current: "", password: "", confirm: "" }); setWErr({}) }} />
      </SettingsCard>

      <TwoStep />

      <SettingsCard icon={MonitorSmartphone} title="Where you’re signed in" description="Every browser with your Console session open." right={others > 0 ? <Button size="sm" variant="outline" onClick={() => void signOutOthers()}>Sign out everywhere else</Button> : undefined}>
        {!sessions.data ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</p>
        ) : (
          <ul className="divide-y rounded-xl border">
            {sessions.data.data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground"><MonitorSmartphone className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{device(s.userAgent)}</span>
                  <span className="block text-xs text-muted-foreground">{s.ip ?? "Unknown IP"} · since {formatDateTime(s.createdAt)}</span>
                </span>
                {s.current && <Pill color="emerald" dot>This device</Pill>}
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </div>
  )
}

/** Two-step sign-in: on with a code from an authenticator app; off (not for Admin and Staff) with the password */
function TwoStep() {
  const { me, reload } = useAuth()
  const [setup, setSetup] = React.useState<{ secret: string; qr: string } | null>(null)
  const [code, setCode] = React.useState("")
  const [error, setError] = React.useState<string>()
  const [off, setOff] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [pwError, setPwError] = React.useState<string>()
  const must = me!.role === "admin" || me!.role === "staff"
  const start = async () => {
    try {
      const s = await api.post<{ secret: string; otpauthUrl: string }>("/me/mfa/setup")
      setSetup({ secret: s.secret, qr: await QRCode.toDataURL(s.otpauthUrl, { margin: 1, width: 320 }) })
      setCode("")
      setError(undefined)
    } catch (x) {
      toast.error(errorMessage(x))
    }
  }
  return (
    <SettingsCard icon={ShieldCheck} title="Two-step sign-in" description="A code from an authenticator app (Google Authenticator, Microsoft Authenticator…) at every sign-in." right={<Pill color={me!.mfaEnabled ? "emerald" : "slate"} dot>{me!.mfaEnabled ? "On" : "Off"}</Pill>}>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <ShieldCheck className={me!.mfaEnabled ? "size-5 text-emerald-600" : "size-5 text-muted-foreground"} />
        <span className="flex-1">{me!.mfaEnabled ? (must ? "On. Admin and Staff always keep it on; if you lose your phone, another Admin resets it." : "On. Each sign-in asks for a code from your app.") : "Off. Turn it on so a stolen password alone can’t get in."}</span>
        {!me!.mfaEnabled && <Button onClick={() => void start()}>Turn on</Button>}
        {me!.mfaEnabled && !must && <Button variant="outline" onClick={() => { setOff(true); setPassword(""); setPwError(undefined) }}>Turn off</Button>}
      </div>
      {setup && (
        <ActionDialog open onOpenChange={() => setSetup(null)} title="Turn on two-step sign-in" submitLabel="Turn on"
          description="Scan the code with your authenticator app, then type the 6-digit code it shows."
          onSubmit={async () => {
            if (!/^\d{6}$/.test(code)) { setError("Enter the 6-digit code"); return { code: "x" } }
            try {
              await api.post("/me/mfa/enable", { code })
              await reload()
              toast.success("Two-step sign-in is on")
            } catch (x) {
              const f = fieldErrors(x)
              setError(f.code)
              return f
            }
          }}>
          <div className="grid justify-items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL made on this page */}
            <img src={setup.qr} alt="QR code for your authenticator app" className="size-48 rounded-lg border bg-white p-2" />
            <p className="text-xs text-muted-foreground">Can’t scan? Type this key: <span className="font-mono font-semibold tracking-wider text-foreground">{setup.secret}</span></p>
          </div>
          <Field label="6-digit code" error={error}><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="font-mono tracking-widest" autoFocus /></Field>
        </ActionDialog>
      )}
      {off && (
        <ActionDialog open onOpenChange={() => setOff(false)} destructive title="Turn off two-step sign-in?" submitLabel="Turn off"
          description="Your password alone will open your account."
          onSubmit={async () => {
            try {
              await api.post("/me/mfa/disable", { password })
              await reload()
              toast.success("Two-step sign-in is off")
            } catch (x) {
              const f = fieldErrors(x)
              setPwError(f.password)
              return f
            }
          }}>
          <Field label="Your password" error={pwError}><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></Field>
        </ActionDialog>
      )}
    </SettingsCard>
  )
}
