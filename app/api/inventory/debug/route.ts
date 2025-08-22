import { NextResponse } from "next/server"

export async function GET() {
  try {
    console.log("=== DEBUG API: Starting comprehensive debug check ===")

    // Check if Zettle is configured
    const zettleUrl = process.env.ZETTLE_PRODUCTS_URL
    const clientId = process.env.ZETTLE_CLIENT_ID
    const assertion = process.env.ZETTLE_JWT_ASSERTION

    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      environment: {
        zettleConfigured: !!(zettleUrl && clientId && assertion),
        zettleUrl: zettleUrl ? `${zettleUrl.substring(0, 20)}...` : "Not set",
        clientIdSet: !!clientId,
        assertionSet: !!assertion,
      },
      apis: {},
      stockConsistency: {},
    }

    if (!zettleUrl || !clientId || !assertion) {
      console.log("DEBUG API: Zettle not configured, testing demo mode")

      // Test demo products
      const demoProducts = [
        {
          uuid: "demo-test-001",
          name: "Debug Test Product",
          price: 15.99,
          stock: 42,
          imageUrl: "/placeholder.svg?width=400&height=400&text=Debug+Test",
        },
      ]

      debugInfo.mode = "demo"
      debugInfo.demoProducts = demoProducts
      debugInfo.stockConsistency.demoMode = true

      return NextResponse.json(debugInfo)
    }

    try {
      console.log("DEBUG API: Zettle configured, testing real API...")
      const { zettleAPI, convertZettleProduct, convertToZettleProduct } = await import("@/lib/zettle")

      // Test 1: Fetch products from Zettle
      console.log("DEBUG API: Test 1 - Fetching products from Zettle...")
      const zettleProducts = await zettleAPI.getProducts()
      debugInfo.apis.zettleProductsCount = zettleProducts.length

      // Test 2: Convert Zettle products to our format
      console.log("DEBUG API: Test 2 - Converting Zettle products...")
      const convertedProducts = zettleProducts.map((zp) => {
        const converted = convertZettleProduct(zp)
        console.log(`DEBUG API: Converted ${zp.name}:`, {
          originalVariantInventory: zp.variants?.[0]?.inventory,
          convertedStock: converted.stock,
          stockType: typeof converted.stock,
        })
        return converted
      })

      debugInfo.apis.convertedProductsCount = convertedProducts.length
      debugInfo.stockConsistency.products = convertedProducts.map((p) => ({
        uuid: p.uuid,
        name: p.name,
        stock: p.stock,
        stockType: typeof p.stock,
        stockIsValid: typeof p.stock === "number" && !isNaN(p.stock) && p.stock >= 0,
      }))

      // Test 3: Test conversion round-trip
      console.log("DEBUG API: Test 3 - Testing conversion round-trip...")
      if (convertedProducts.length > 0) {
        const testProduct = convertedProducts[0]
        const backToZettle = convertToZettleProduct({
          name: testProduct.name,
          price: testProduct.price,
          stock: testProduct.stock,
          imageUrl: testProduct.imageUrl,
        })
        const backToOurs = convertZettleProduct(backToZettle)

        debugInfo.stockConsistency.roundTrip = {
          original: testProduct,
          zettle: backToZettle.variants?.[0]?.inventory,
          final: backToOurs,
          stockPreserved: testProduct.stock === backToOurs.stock,
        }
      }

      // Test 4: Test individual product fetch
      console.log("DEBUG API: Test 4 - Testing individual product fetch...")
      if (convertedProducts.length > 0) {
        const testUuid = convertedProducts[0].uuid
        try {
          const individualProduct = await zettleAPI.getProduct(testUuid)
          const convertedIndividual = convertZettleProduct(individualProduct)

          debugInfo.apis.individualProductTest = {
            uuid: testUuid,
            fetchSuccessful: true,
            originalStock: individualProduct.variants?.[0]?.inventory?.inStock,
            convertedStock: convertedIndividual.stock,
            stockMatches: individualProduct.variants?.[0]?.inventory?.inStock === convertedIndividual.stock,
          }
        } catch (error) {
          debugInfo.apis.individualProductTest = {
            uuid: testUuid,
            fetchSuccessful: false,
            error: error instanceof Error ? error.message : "Unknown error",
          }
        }
      }

      // Test 5: Stock statistics
      const totalStock = convertedProducts.reduce((sum, p) => sum + (p.stock || 0), 0)
      const stockDistribution = {
        totalProducts: convertedProducts.length,
        totalStock,
        averageStock: convertedProducts.length > 0 ? Math.round(totalStock / convertedProducts.length) : 0,
        inStock: convertedProducts.filter((p) => p.stock > 0).length,
        outOfStock: convertedProducts.filter((p) => p.stock === 0).length,
        lowStock: convertedProducts.filter((p) => p.stock > 0 && p.stock <= 5).length,
        stockTypes: convertedProducts.reduce(
          (acc, p) => {
            const type = typeof p.stock
            acc[type] = (acc[type] || 0) + 1
            return acc
          },
          {} as Record<string, number>,
        ),
      }

      debugInfo.stockConsistency.statistics = stockDistribution

      console.log("DEBUG API: All tests completed successfully")
      debugInfo.mode = "zettle"
      debugInfo.success = true
    } catch (zettleError) {
      console.error("DEBUG API: Zettle error:", zettleError)
      debugInfo.mode = "zettle_error"
      debugInfo.error = {
        message: zettleError instanceof Error ? zettleError.message : "Unknown Zettle error",
        type: "zettle_api_error",
      }
    }

    return NextResponse.json(debugInfo)
  } catch (error) {
    console.error("DEBUG API: Unexpected error:", error)
    return NextResponse.json(
      {
        error: "Debug API failed",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
