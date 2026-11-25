"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import QRCode from "qrcode"
import { KeyRound, Loader2, ShieldCheck, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/form"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"

// Sign in, one step at a time: email and password, then the two-step code — or, for Admin and Staff
// signing in the first time, setting up two-step with an authenticator app.

type Step = { kind: "password" } | { kind: "code"; mfaToken: string } | { kind: "setup"; setupToken: string; secret: string; qr: string }
type LoginAnswer = { accessToken?: string; mfaRequired?: true; mfaToken?: string; mfaSetupRequired?: true; setupToken?: string }

export default function LoginPage() {
  return (
    <React.Suspense>
      <Login />
    </React.Suspense>
  )
}

function Login() {
  const router = useRouter()
  const params = useSearchParams()
  const { status, signIn } = useAuth()
  const [step, setStep] = React.useState<Step>({ kind: "password" })
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [code, setCode] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [fields, setFields] = React.useState<Record<string, string>>({})
  const [busy, setBusy] = React.useState(false)
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/"

  React.useEffect(() => {
    if (status === "authenticated") router.replace(next)
  }, [status, router, next])

  const done = async (token: string) => {
    await signIn(token)
    router.replace(next)
  }

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    setFields({})
    try {
      await fn()
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) setFields(e.fields)
      else setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const submitPassword = () =>
    run(async () => {
      const r = await api.post<LoginAnswer>("/auth/login", { email: email.trim(), password })
      if (r.accessToken) return done(r.accessToken)
      if (r.mfaRequired && r.mfaToken) return setStep({ kind: "code", mfaToken: r.mfaToken })
      if (r.mfaSetupRequired && r.setupToken) {
        const s = await api.post<{ secret: string; otpauthUrl: string }>("/auth/mfa/setup", { setupToken: r.setupToken })
        setStep({ kind: "setup", setupToken: r.setupToken, secret: s.secret, qr: await QRCode.toDataURL(s.otpauthUrl, { margin: 1, width: 360 }) })
      }
    })

  const submitCode = () =>
    run(async () => {
      if (!/^\d{6}$/.test(code)) {
        setFields({ code: "Enter the 6-digit code" })
        return
      }
      const r =
        step.kind === "code"
          ? await api.post<{ accessToken: string }>("/auth/mfa", { mfaToken: step.mfaToken, code })
          : step.kind === "setup"
            ? await api.post<{ accessToken: string }>("/auth/mfa/enable", { setupToken: step.setupToken, code })
            : null
      if (r) await done(r.accessToken)
    }).finally(() => setCode(""))

  if (step.kind === "password") {
    return (
      <form onSubmit={(e) => { e.preventDefault(); void submitPassword() }} className="grid gap-5" noValidate>
        <div>
          <span className="mb-3 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound className="size-5" /></span>
          <h1 className="text-2xl font-bold tracking-tight">Sign in to the Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use the email AHEAD set up for you.</p>
        </div>
        <Field label="Email" error={fields.email}>
          <Input type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@aheaderp.com" />
        </Field>
        <Field label="Password" error={fields.password}>
          <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
        </Field>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" size="lg" disabled={busy || !email || !password}>{busy && <Loader2 className="animate-spin" />} {busy ? "Signing in…" : "Sign in"}</Button>
        <Link href="/forgot" className="text-center text-sm text-muted-foreground hover:text-foreground">Forgot password?</Link>
      </form>
    )
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submitCode() }} className="grid gap-5" noValidate>
      <div>
        <span className="mb-3 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">{step.kind === "setup" ? <ShieldCheck className="size-5" /> : <Smartphone className="size-5" />}</span>
        <h1 className="text-2xl font-bold tracking-tight">{step.kind === "setup" ? "Set up two-step sign-in" : "Enter your code"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {step.kind === "setup"
            ? "Your role needs it. Scan this with Google Authenticator, Microsoft Authenticator or any authenticator app, then type the 6-digit code it shows."
            : "Open your authenticator app and type the 6-digit code for AHEAD Console."}
        </p>
      </div>
      {step.kind === "setup" && (
        <div className="grid justify-items-center gap-2 rounded-xl border bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={step.qr} alt="Two-step sign-in QR code" width={180} height={180} />
          <p className="text-center text-xs text-neutral-600">Can’t scan? Type this key: <span className="font-mono break-all text-neutral-900">{step.secret}</span></p>
        </div>
      )}
      <Field label="6-digit code" error={fields.code}>
        <Input inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" className="font-mono tracking-[0.4em]" />
      </Field>
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" disabled={busy || code.length !== 6}>{busy && <Loader2 className="animate-spin" />} {busy ? "Checking…" : step.kind === "setup" ? "Turn on and sign in" : "Sign in"}</Button>
      <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => { setStep({ kind: "password" }); setCode(""); setError(null) }}>Start again</button>
    </form>
  )
}
