import { NextResponse } from "next/server"
import { getZettleProducts } from "@/lib/zettle"

export async function GET() {
  try {
    console.log("=== INVENTORY API: GET ===")

    const products = await getZettleProducts()
    console.log(`INVENTORY API: Successfully fetched ${products.length} products`)

    // Sort products: in-stock first, then out-of-stock
    const sortedProducts = products.sort((a, b) => {
      // First sort by stock availability (in-stock first)
      if (a.stock > 0 && b.stock === 0) return -1
      if (a.stock === 0 && b.stock > 0) return 1

      // Then sort by stock quantity (higher stock first)
      if (a.stock !== b.stock) return b.stock - a.stock

      // Finally sort by name alphabetically
      return a.name.localeCompare(b.name)
    })

    const timestamp = new Date().toISOString()
    return NextResponse.json(
      {
        products: sortedProducts,
        total: sortedProducts.length,
        timestamp: timestamp,
        source: "store-api",
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      },
    )
  } catch (error) {
    console.error("INVENTORY API: GET Error:", error)

    let errorMessage = "Failed to fetch products"
    let statusCode = 500

    if (error instanceof Error) {
      errorMessage = error.message

      // Handle specific error types
      if (error.message.includes("Authentication failed")) {
        statusCode = 401
      } else if (error.message.includes("Access forbidden")) {
        statusCode = 403
      }
    }

    return NextResponse.json(
      {
        error: "Failed to fetch products",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
      {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}
