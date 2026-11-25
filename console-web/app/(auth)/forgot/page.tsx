"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, MailCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field } from "@/components/form"
import { api, errorMessage } from "@/lib/api"

export default function ForgotPage() {
  const [email, setEmail] = React.useState("")
  const [sent, setSent] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const bad = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Enter a valid email" : null

  const send = async () => {
    if (!email || bad) return
    setBusy(true)
    setError(null)
    try {
      await api.post("/auth/forgot", { email: email.trim() })
      setSent(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="grid gap-4">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><MailCheck className="size-5" /></span>
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="text-sm text-muted-foreground">If <b className="text-foreground">{email.trim()}</b> has a Console account, a link to choose a new password is on its way. It works once, for 24 hours.</p>
        <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Back to sign in</Link>
      </div>
    )
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); void send() }} className="grid gap-5" noValidate>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Forgot your password?</h1>
        <p className="mt-1 text-sm text-muted-foreground">We’ll email you a link to choose a new one.</p>
      </div>
      <Field label="Email" error={bad}>
        <Input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@aheaderp.com" />
      </Field>
      {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" size="lg" disabled={busy || !email || !!bad}>{busy && <Loader2 className="animate-spin" />} Send link</Button>
      <Link href="/login" className="inline-flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Back to sign in</Link>
    </form>
  )
}
