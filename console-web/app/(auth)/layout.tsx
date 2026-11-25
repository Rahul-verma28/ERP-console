export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#14213d] p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-white text-sm font-bold text-[#14213d]">A</span>
          <div>
            <p className="font-semibold">AHEAD Console</p>
            <p className="text-xs text-white/70">For the AHEAD team, vendors and partners</p>
          </div>
        </div>
        <div className="max-w-md">
          <p className="text-3xl leading-tight font-semibold">Every business on AHEAD, in one place.</p>
          <p className="mt-3 text-sm text-white/75">Add businesses, set their plans, send payment links, look after partners. Every change reaches the business’s ERP within seconds.</p>
        </div>
        <p className="text-xs text-white/50">Signed in people are protected with two-step sign-in.</p>
      </div>
      <div className="grid place-items-center p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
