import type React from "react"
import { createClient } from "@/lib/supabase/server"
import { AdminLayoutClient } from "@/uicomponents/admin/admin-layout-client"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Create Supabase client (will use mock if not configured)
  const supabase = await createClient()

  // Try to get user, but don't fail if it doesn't work
  let user = null
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    user = authUser
  } catch (error) {
    console.log("Auth check failed, proceeding with demo mode:", error)
  }

  return <AdminLayoutClient initialUser={user}>{children}</AdminLayoutClient>
}
