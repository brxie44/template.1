import { NextResponse } from "next/server"

export async function GET() {
  try {
    console.log("Fetching low stock alerts...")

    // Check if Zettle is configured
    const zettleUrl = process.env.ZETTLE_PRODUCTS_URL
    if (!zettleUrl) {
      return NextResponse.json([
        {
          uuid: "demo-1",
          name: "Premium Ribeye Steak",
          price: 32.99,
          stock: 3,
          imageUrl: "/placeholder.svg?width=400&height=400",
          _alert: "Low stock - demo data",
        },
      ])
    }

    try {
      const { zettleAPI, convertZettleProduct } = await import("@/lib/zettle")
      const lowStockProducts = await zettleAPI.getLowStockProducts(5) // Threshold of 5
      const alerts = lowStockProducts.map(convertZettleProduct)

      console.log("Found", alerts.length, "low stock alerts")
      return NextResponse.json(alerts)
    } catch (zettleError) {
      console.error("Failed to fetch low stock alerts:", zettleError)

      // Return demo alert as fallback
      return NextResponse.json([
        {
          uuid: "demo-1",
          name: "Premium Ribeye Steak",
          price: 32.99,
          stock: 3,
          imageUrl: "/placeholder.svg?width=400&height=400",
          _alert: "Low stock - Zettle API error",
        },
      ])
    }
  } catch (error) {
    console.error("Low stock alerts error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch low stock alerts",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
