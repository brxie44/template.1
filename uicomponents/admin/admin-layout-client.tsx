"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { SidebarProvider } from "@/uicomponents/ui/sidebar"
import { AdminSidebar } from "./admin-sidebar"

interface User {
  id: string
  email?: string
  user_metadata?: {
    name?: string
  }
}

interface AdminLayoutClientProps {
  children: React.ReactNode
  initialUser: User | null
}

export function AdminLayoutClient({ children, initialUser }: AdminLayoutClientProps) {
  const [user, setUser] = useState<User | null>(initialUser)
  const [loading, setLoading] = useState(!initialUser)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    // If we already have a user from server, we're good
    if (initialUser) {
      setLoading(false)
      return
    }

    // Try to get user on client side
    const getUser = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()
        setUser(authUser)
      } catch (error) {
        console.log("Client auth check failed, using demo mode:", error)
        // Set demo user for demo mode
        setUser({
          id: "demo-user",
          email: "demo@example.com",
          user_metadata: { name: "Demo User" },
        })
      } finally {
        setLoading(false)
      }
    }

    getUser()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUser(session.user)
      } else if (event === "SIGNED_OUT") {
        setUser(null)
        router.push("/login")
      }
    })

    return () => subscription.unsubscribe()
  }, [initialUser, supabase.auth, router])

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  // If no user and not on login page, redirect to login
  if (!user && pathname !== "/login") {
    router.push("/login")
    return null
  }

  // If user exists or on login page, render the layout
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {user && <AdminSidebar />}
        <main className="flex-1">{children}</main>
      </div>
    </SidebarProvider>
  )
}
