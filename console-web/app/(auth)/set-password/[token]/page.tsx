"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/form"
import { api, ApiError, errorMessage } from "@/lib/api"
import { useApi } from "@/lib/use-api"

// An invite (new account) or a reset link: choose a password, then sign in.

const problem = (pw: string, email: string) =>
  pw.length < 10 ? "Use at least 10 characters" : !/[a-z]/i.test(pw) || !/\d/.test(pw) ? "Use letters and at least one number" : pw.toLowerCase().includes(email.split("@")[0].toLowerCase()) ? "Don’t use your email name in the password" : null

export default function SetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = React.use(params)
  const router = useRouter()
  const link = useApi<{ name: string; email: string; purpose: "invite" | "reset" }>(`/auth/link/${token}`)
  const [pw, setPw] = React.useState("")
  const [again, setAgain] = React.useState("")
  const [shown, setShown] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [done, setDone] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (link.error) {
    return (
      <div className="grid gap-3">
        <h1 className="text-2xl font-bold tracking-tight">This link doesn’t work</h1>
        <p className="text-sm text-muted-foreground">{link.error.message}</p>
        <Link href="/forgot" className="text-sm font-medium text-primary hover:underline">Ask for a new link</Link>
      </div>
    )
  }
  if (!link.data) return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
  if (done) {
    return (
      <div className="grid gap-3">
        <CheckCircle2 className="size-8 text-emerald-600" />
        <h1 className="text-2xl font-bold tracking-tight">Password saved</h1>
        <p className="text-sm text-muted-foreground">Sign in with {link.data.email} and your new password.</p>
        <Button onClick={() => router.replace("/login")}>Sign in</Button>
      </div>
    )
  }
  const p = problem(pw, link.data.email)
  const mismatch = again && again !== pw ? "Passwords don’t match" : null
  const save = async () => {
    setShown(true)
    if (p || !again || mismatch) return
    setBusy(true)
    setError(null)
    try {
      await api.post(`/auth/link/${token}`, { password: pw })
      setDone(true)
    } catch (e) {
      setError(e instanceof ApiError && e.fields.password ? e.fields.password : errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); void save() }} className="grid gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{link.data.purpose === "invite" ? `Welcome, ${link.data.name.split(" ")[0]}` : "Choose a new password"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{link.data.purpose === "invite" ? "Choose the password for your AHEAD Console account." : `For ${link.data.email}.`}</p>
      </div>
      <Field label="Password" error={shown ? p : null} hint="10 or more characters, with letters and a number">
        <Input type="password" autoComplete="new-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 10 characters" />
      </Field>
      <Field label="Type it again" error={shown && !again ? "Type the password again" : mismatch}>
        <Input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} placeholder="Same password" />
      </Field>
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Save password</Button>
    </form>
  )
}
