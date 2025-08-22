import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { action, productUuid, variantUuid, quantity, adjustment } = await request.json()

    console.log("Inventory management request:", { action, productUuid, variantUuid, quantity, adjustment })

    // Check if Zettle is configured
    const zettleUrl = process.env.ZETTLE_PRODUCTS_URL
    if (!zettleUrl) {
      return NextResponse.json(
        { error: "Zettle not configured", message: "ZETTLE_PRODUCTS_URL environment variable is not set" },
        { status: 500 },
      )
    }

    const { zettleAPI } = await import("@/lib/zettle")

    let result
    switch (action) {
      case "update":
        if (typeof quantity !== "number") {
          return NextResponse.json({ error: "Quantity is required for update action" }, { status: 400 })
        }
        await zettleAPI.updateInventory(productUuid, variantUuid, quantity)
        result = { success: true, message: `Inventory updated to ${quantity}`, newStock: quantity }
        break

      case "adjust":
        if (typeof adjustment !== "number") {
          return NextResponse.json({ error: "Adjustment is required for adjust action" }, { status: 400 })
        }
        const newStock = await zettleAPI.adjustInventory(productUuid, variantUuid, adjustment)
        result = { success: true, message: `Inventory adjusted by ${adjustment}`, newStock }
        break

      default:
        return NextResponse.json({ error: "Invalid action. Use 'update' or 'adjust'" }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Inventory management error:", error)
    return NextResponse.json(
      {
        error: "Failed to manage inventory",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
