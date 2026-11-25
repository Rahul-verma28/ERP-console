import type { Metadata, Viewport } from "next"
import { DM_Sans, Geist_Mono, IBM_Plex_Sans, Inter, Lato, Manrope, Nunito_Sans, Open_Sans, Poppins, Public_Sans, Roboto, Source_Sans_3, Work_Sans } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/lib/auth"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })
// The fonts Settings › Appearance offers; only the chosen one is downloaded
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", preload: false })
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex", preload: false })
const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source", preload: false })
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto", preload: false })
const openSans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans", preload: false })
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-lato", preload: false })
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", preload: false })
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", preload: false })
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", preload: false })
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-work-sans", preload: false })
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans", preload: false })
const FONTS = [inter, mono, manrope, plex, sourceSans, roboto, openSans, lato, poppins, dmSans, publicSans, workSans, nunitoSans].map((f) => f.variable)

export const metadata: Metadata = {
  title: { default: "AHEAD Console", template: "%s · AHEAD Console" },
  description: "Run AHEAD: businesses, plans, billing, partners and the team.",
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfcfe" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("antialiased", ...FONTS, "font-sans")}>
      <body>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  )
}
