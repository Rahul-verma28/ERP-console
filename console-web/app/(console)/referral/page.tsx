"use client"

import { toast } from "sonner"
import { Building2, Copy, Link2, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BusinessStatus, Empty, Failed, Loading, Page, Panel, Row, Stat, StatGrid, StatSkeletons, relDays } from "@/components/kit"
import { useApi } from "@/lib/use-api"
import { signupLink } from "@/lib/site"
import type { SubStatus } from "@/lib/types"

// Sales and vendors: their own link and code, and the businesses that came with them.

interface Referral {
  code: string
  businesses: number
  viaCode: number
  paying: number
  recent: { id: string; name: string; createdAt: string; referralCode: string | null; subscription: { status: SubStatus; plan: { name: string } } | null }[]
}

export default function ReferralPage() {
  const r = useApi<Referral>("/console/referral")
  const copy = (text: string, what: string) => {
    void navigator.clipboard.writeText(text)
    toast.success(`${what} copied`)
  }
  return (
    <Page eyebrow="Workspace" title="My link & code" subtitle="A business that signs up with your link or code is yours, with you as “Brought by”.">
      {r.error && !r.data && <Failed error={r.error} onRetry={r.reload} />}
      <StatGrid cols={3}>
        {r.data ? (
          <>
            <Stat icon={Building2} label="Businesses" value={r.data.businesses} hint="Added by you or with your code" />
            <Stat icon={Link2} label="Signed up with your code" value={r.data.viaCode} hint="On the website" />
            <Stat icon={Wallet} label="Paying" value={r.data.paying} hint="On a paid plan today" tone={r.data.paying ? "good" : undefined} />
          </>
        ) : <StatSkeletons n={3} />}
      </StatGrid>
      {!r.data ? <Loading /> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Share" description="The link opens the signup page with your code filled in.">
            <div className="grid gap-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Your code</p>
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-muted px-3 py-2 font-mono text-xl font-semibold tracking-wider">{r.data.code}</span>
                  <Button variant="outline" size="sm" onClick={() => copy(r.data!.code, "Code")}><Copy /> Copy</Button>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Your link</p>
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-sm">{signupLink(r.data.code)}</span>
                  <Button variant="outline" size="sm" onClick={() => copy(signupLink(r.data!.code), "Link")}><Copy /> Copy</Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">A business that signs up with your code also gets the welcome discount on its first payment.</p>
            </div>
          </Panel>
          <Panel title="Newest" padded={false}>
            <div className="px-3 pb-3">
              {r.data.recent.length ? (
                <div className="divide-y">
                  {r.data.recent.map((b) => <Row key={b.id} href={`/businesses/${b.id}`} icon={Building2} tone="grey" title={b.name} detail={`${b.referralCode ? "With your code" : "Added by you"} · ${relDays(b.createdAt)}`} right={b.subscription ? <BusinessStatus status={b.subscription.status} /> : undefined} />)}
                </div>
              ) : <Empty icon={Building2} title="No businesses yet" text="Share your link to get started." />}
            </div>
          </Panel>
        </div>
      )}
    </Page>
  )
}
