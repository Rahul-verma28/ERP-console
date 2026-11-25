// Addresses outside the Console: the public website (where businesses sign up).

export const WEBSITE_URL = (process.env.NEXT_PUBLIC_WEBSITE_URL ?? "http://localhost:3000").replace(/\/$/, "")

/** The signup page with a vendor's or salesperson's code filled in */
export const signupLink = (code: string) => `${WEBSITE_URL}/signup?ref=${encodeURIComponent(code)}`
