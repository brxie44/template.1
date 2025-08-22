import { NextResponse } from "next/server"

export async function POST() {
  try {
    console.log("=== POPULATE API: Starting catalog population ===")

    // Check if Zettle is configured
    const zettleUrl = process.env.ZETTLE_PRODUCTS_URL
    if (!zettleUrl) {
      console.log("POPULATE API: Zettle not configured")
      return NextResponse.json(
        { error: "Zettle not configured", message: "Please configure Zettle environment variables" },
        { status: 400 },
      )
    }

    try {
      const { zettleAPI, convertToZettleProduct } = await import("@/lib/zettle")

      // Sample products to populate
      const sampleProducts = [
        {
          name: "Premium Ribeye Steak",
          price: 32.99,
          stock: 12,
          imageUrl: "/placeholder.svg?width=400&height=400&text=Ribeye+Steak",
        },
        {
          name: "Grass-Fed Ground Beef",
          price: 8.99,
          stock: 25,
          imageUrl: "/placeholder.svg?width=400&height=400&text=Ground+Beef",
        },
        {
          name: "Free-Range Chicken Breast",
          price: 12.99,
          stock: 18,
          imageUrl: "/placeholder.svg?width=400&height=400&text=Chicken+Breast",
        },
        {
          name: "Pork Tenderloin",
          price: 15.99,
          stock: 14,
          imageUrl: "/placeholder.svg?width=400&height=400&text=Pork+Tenderloin",
        },
        {
          name: "Lamb Chops",
          price: 28.99,
          stock: 3,
          imageUrl: "/placeholder.svg?width=400&height=400&text=Lamb+Chops",
        },
      ]

      console.log(`POPULATE API: Creating ${sampleProducts.length} products in Zettle...`)

      const createdProducts = []
      for (const productData of sampleProducts) {
        try {
          console.log(`POPULATE API: Creating ${productData.name}...`)

          // Convert to Zettle format
          const zettleProductData = convertToZettleProduct(productData)

          // Create in Zettle
          const createdProduct = await zettleAPI.createProduct(zettleProductData)
          createdProducts.push(createdProduct)

          console.log(`POPULATE API: Successfully created ${productData.name} with UUID ${createdProduct.uuid}`)
        } catch (productError) {
          console.error(`POPULATE API: Failed to create ${productData.name}:`, productError)
          // Continue with other products even if one fails
        }
      }

      console.log(
        `POPULATE API: Successfully created ${createdProducts.length} out of ${sampleProducts.length} products`,
      )

      return NextResponse.json({
        success: true,
        created: createdProducts.length,
        total: sampleProducts.length,
        message: `Successfully populated ${createdProducts.length} products in Zettle catalog`,
      })
    } catch (zettleError) {
      console.error("POPULATE API: Zettle error:", zettleError)
      return NextResponse.json(
        {
          error: "Zettle API Error",
          message: zettleError instanceof Error ? zettleError.message : "Failed to connect to Zettle",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("POPULATE API: Unexpected error:", error)
    return NextResponse.json(
      {
        error: "Population failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
