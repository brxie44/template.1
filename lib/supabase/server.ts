import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseUrl === "https://your-project.supabase.co" ||
    supabaseAnonKey === "your-anon-key-here"
  ) {
    console.log("Supabase not configured, using mock client")
    // Return a mock client for demo mode
    return {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: "demo-user",
              email: "demo@example.com",
              user_metadata: { name: "Demo User" },
            },
          },
          error: null,
        }),
        signOut: async () => ({ error: null }),
        signInWithPassword: async () => ({
          data: {
            user: {
              id: "demo-user",
              email: "demo@example.com",
              user_metadata: { name: "Demo User" },
            },
          },
          error: null,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({ data: [], error: null }),
        }),
        insert: () => ({ data: null, error: null }),
        update: () => ({ data: null, error: null }),
        delete: () => ({ data: null, error: null }),
      }),
    }
  }

  try {
    return createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    })
  } catch (error) {
    console.error("Failed to create Supabase client:", error)
    // Return mock client as fallback
    return {
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: "demo-user",
              email: "demo@example.com",
              user_metadata: { name: "Demo User" },
            },
          },
          error: null,
        }),
        signOut: async () => ({ error: null }),
        signInWithPassword: async () => ({
          data: {
            user: {
              id: "demo-user",
              email: "demo@example.com",
              user_metadata: { name: "Demo User" },
            },
          },
          error: null,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({ data: [], error: null }),
        }),
        insert: () => ({ data: null, error: null }),
        update: () => ({ data: null, error: null }),
        delete: () => ({ data: null, error: null }),
      }),
    }
  }
}
