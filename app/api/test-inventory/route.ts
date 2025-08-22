import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { productUuid, quantity = 1 } = body
    
    console.log(`=== TESTING INVENTORY UPDATE ===`)
    console.log(`Product UUID: ${productUuid}`)
    console.log(`Quantity to reduce: ${quantity}`)
    
    // Check if Zettle is configured
    const { isZettleConfigured } = await import("@/lib/zettle")
    if (!isZettleConfigured()) {
      return NextResponse.json({ error: "Zettle not configured" }, { status: 400 })
    }
    
    const { zettleAPI } = await import("@/lib/zettle")
    
    // Get current stock before update
    const currentStock = await zettleAPI.getProductStock(productUuid)
    console.log(`Current stock: ${currentStock}`)
    
    // Get the product to find the variant UUID
    const product = await zettleAPI.getProduct(productUuid)
    const variantUuid = product.variants?.[0]?.uuid
    
    if (!variantUuid) {
      return NextResponse.json({ error: "No variant found for product" }, { status: 400 })
    }
    
    console.log(`Variant UUID: ${variantUuid}`)
    
    // Test the new recordSale method
    await zettleAPI.recordSale(productUuid, variantUuid, quantity)
    
    // Get stock after update
    const newStock = await zettleAPI.getProductStock(productUuid)
    console.log(`New stock: ${newStock}`)
    
    return NextResponse.json({
      success: true,
      productUuid,
      variantUuid,
      quantity,
      currentStock,
      newStock,
      difference: currentStock - newStock,
      message: `Successfully reduced inventory by ${quantity}`
    })
    
  } catch (error) {
    console.error("Test inventory error:", error)
    return NextResponse.json({
      error: "Failed to test inventory update",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to test inventory update",
    usage: "POST /api/test-inventory with { productUuid, quantity }"
  })
}
