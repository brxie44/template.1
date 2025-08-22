import { NextResponse } from "next/server"

export async function GET() {
  try {
    console.log("Generating inventory report...")

    // Check if Zettle is configured
    const zettleUrl = process.env.ZETTLE_PRODUCTS_URL
    if (!zettleUrl) {
      return NextResponse.json({
        totalProducts: 4,
        totalVariants: 4,
        totalStock: 69,
        lowStockCount: 1,
        outOfStockCount: 0,
        averageStock: 17,
        isDemo: true,
        message: "Demo report - Zettle not configured",
      })
    }

    try {
      const { zettleAPI } = await import("@/lib/zettle")
      const report = await zettleAPI.getInventoryReport()

      console.log("Generated inventory report:", report)
      return NextResponse.json({
        ...report,
        isDemo: false,
        message: "Live inventory report from Zettle",
      })
    } catch (zettleError) {
      console.error("Failed to generate Zettle inventory report:", zettleError)

      // Return demo report as fallback
      return NextResponse.json({
        totalProducts: 4,
        totalVariants: 4,
        totalStock: 69,
        lowStockCount: 1,
        outOfStockCount: 0,
        averageStock: 17,
        isDemo: true,
        error: "Failed to connect to Zettle",
        message: "Demo report - Zettle API error",
      })
    }
  } catch (error) {
    console.error("Inventory report error:", error)
    return NextResponse.json(
      {
        error: "Failed to generate inventory report",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
