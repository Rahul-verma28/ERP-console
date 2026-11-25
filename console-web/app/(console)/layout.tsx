"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CloudOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Shell } from "@/components/shell"
import { useAuth } from "@/lib/auth"

// Every signed-in page: a session is needed; without one, sign in first.
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const router = useRouter()
  React.useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`)
  }, [status, router])

  if (status === "unavailable") {
    return (
      <div className="grid min-h-svh place-items-center p-6 text-center text-sm text-muted-foreground">
        <div className="grid justify-items-center gap-3">
          <CloudOff className="size-6" />
          <p className="font-medium text-foreground">The Console can’t be reached right now</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    )
  }
  if (status !== "authenticated") return <div className="grid min-h-svh place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" /></div>
  return <Shell>{children}</Shell>
}
