import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
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
        signInWithPassword: async (credentials: any) => ({
          data: {
            user: {
              id: "demo-user",
              email: credentials.email || "demo@example.com",
              user_metadata: { name: "Demo User" },
            },
          },
          error: null,
        }),
        onAuthStateChange: (callback: any) => {
          // Call callback immediately with demo user
          callback("SIGNED_IN", {
            id: "demo-user",
            email: "demo@example.com",
            user_metadata: { name: "Demo User" },
          })
          return { data: { subscription: { unsubscribe: () => {} } } }
        },
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
    return createBrowserClient(supabaseUrl, supabaseAnonKey)
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
        signInWithPassword: async (credentials: any) => ({
          data: {
            user: {
              id: "demo-user",
              email: credentials.email || "demo@example.com",
              user_metadata: { name: "Demo User" },
            },
          },
          error: null,
        }),
        onAuthStateChange: (callback: any) => {
          callback("SIGNED_IN", {
            id: "demo-user",
            email: "demo@example.com",
            user_metadata: { name: "Demo User" },
          })
          return { data: { subscription: { unsubscribe: () => {} } } }
        },
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
