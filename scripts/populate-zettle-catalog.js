// Script to populate Zettle with meat products
// Run with: node scripts/populate-zettle-catalog.js

import fetch from "node-fetch"
import { v1 as uuidv1 } from "uuid"

// Environment variables - make sure these are set
const ZETTLE_AUTH_URL = process.env.ZETTLE_AUTH_URL || "https://oauth.izettletest.com"
const ZETTLE_CLIENT_ID = process.env.ZETTLE_CLIENT_ID || ""
const ZETTLE_JWT_ASSERTION =
  process.env.ZETTLE_JWT_ASSERTION ||
  ""
const ZETTLE_PRODUCTS_URL = process.env.ZETTLE_PRODUCTS_URL || "https://products.izettletest.com"

// Zettle API class
class ZettleAPI {
  constructor() {
    this.accessToken = null
    this.tokenExpiry = 0
  }

  async getAccessToken() {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      console.log("🔑 Using cached access token")
      return this.accessToken
    }

    console.log("🔑 Getting new access token from Zettle...")

    const response = await fetch(`${ZETTLE_AUTH_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        client_id: ZETTLE_CLIENT_ID,
        assertion: ZETTLE_JWT_ASSERTION,
      }),
    })

    console.log("🔑 Auth response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("❌ Auth error response:", errorText)
      throw new Error(`Zettle auth failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    console.log("✅ Auth success, token expires in:", data.expires_in, "seconds")

    this.accessToken = data.access_token
    // Set expiry to 5 minutes before actual expiry for safety
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000

    return this.accessToken
  }

  async createProduct(product) {
    const token = await this.getAccessToken()

    const response = await fetch(`${ZETTLE_PRODUCTS_URL}/organizations/self/products`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(product),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create product: ${response.status} ${response.statusText} - ${errorText}`)
    }

    return response.json()
  }
}

// Helper function to convert our Product type to Zettle product
function convertToZettleProduct(product) {
  const productUuid = uuidv1() // Generate UUID v1 for product
  const variantUuid = uuidv1() // Generate UUID v1 for variant

  return {
    uuid: productUuid,
    name: product.name,
    description: `Premium quality ${product.name} from Prime Cuts Butchery`,
    presentation: {
      imageUrl: product.imageUrl,
      backgroundColor: "#dc2626", // Red theme for meat
      textColor: "#ffffff",
    },
    variants: [
      {
        uuid: variantUuid,
        name: product.name,
        description: `Premium ${product.name}`,
        sku: `MEAT-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        price: {
          amount: Math.round(product.price * 100), // Convert to cents
          currencyId: "USD",
        },
        inventory: {
          tracked: true,
          inStock: product.stock,
          lowStock: 5,
        },
      },
    ],
    // Remove vatPercentage for sales tax users - not compatible with US accounts
    // vatPercentage: 0,
  }
}

const meatCatalog = [
  {
    name: "Premium Ribeye Steak",
    price: 32.99,
    stock: 12,
    imageUrl: "https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400&h=400&fit=crop",
  },
  {
    name: "Grass-Fed Ground Beef",
    price: 8.99,
    stock: 25,
    imageUrl: "https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400&h=400&fit=crop",
  },
  {
    name: "Free-Range Chicken Breast",
    price: 12.99,
    stock: 18,
    imageUrl: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=400&fit=crop",
  },
  {
    name: "Pork Tenderloin",
    price: 15.99,
    stock: 14,
    imageUrl: "https://images.unsplash.com/photo-1602470520998-f4a52199a3d6?w=400&h=400&fit=crop",
  },
  {
    name: "Lamb Chops",
    price: 28.99,
    stock: 8,
    imageUrl: "https://images.unsplash.com/photo-1574781330855-d0db2706b3d0?w=400&h=400&fit=crop",
  },
  {
    name: "Italian Sausage Links",
    price: 9.99,
    stock: 20,
    imageUrl: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=400&h=400&fit=crop",
  },
  {
    name: "Bacon Strips",
    price: 11.99,
    stock: 30,
    imageUrl: "https://images.unsplash.com/photo-1528607929212-2636ec44b982?w=400&h=400&fit=crop",
  },
  {
    name: "Whole Chicken",
    price: 14.99,
    stock: 15,
    imageUrl: "https://images.unsplash.com/photo-1598103442097-8b74394b95c6?w=400&h=400&fit=crop",
  },
  {
    name: "New York Strip Steak",
    price: 29.99,
    stock: 10,
    imageUrl: "https://images.unsplash.com/photo-1558030006-450675393462?w=400&h=400&fit=crop",
  },
  {
    name: "Bratwurst",
    price: 7.99,
    stock: 22,
    imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=400&fit=crop",
  },
  {
    name: "Beef Brisket",
    price: 18.99,
    stock: 6,
    imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop",
  },
  {
    name: "Chicken Thighs",
    price: 9.99,
    stock: 24,
    imageUrl: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=400&h=400&fit=crop",
  },
]

async function populateZettleCatalog() {
  console.log("🥩 Starting to populate Zettle catalog with meat products...")
  console.log("📡 Connecting to Zettle API...")
  console.log("🔗 Auth URL:", ZETTLE_AUTH_URL)
  console.log("🔗 Products URL:", ZETTLE_PRODUCTS_URL)
  console.log("🆔 Client ID:", ZETTLE_CLIENT_ID.substring(0, 8) + "...")
  console.log("🔑 JWT Assertion:", ZETTLE_JWT_ASSERTION ? "SET" : "NOT SET")
  console.log("")

  const zettleAPI = new ZettleAPI()
  let successCount = 0
  let errorCount = 0
  const results = []

  for (const [index, product] of meatCatalog.entries()) {
    try {
      console.log(`\n📦 [${index + 1}/${meatCatalog.length}] Creating product: ${product.name}`)

      const zettleProductData = convertToZettleProduct(product)
      console.log("   💰 Price: $" + product.price)
      console.log("   📊 Stock: " + product.stock)
      console.log("   🆔 Product UUID v1: " + zettleProductData.uuid)
      console.log("   🔗 Variant UUID v1: " + zettleProductData.variants[0].uuid)
      console.log("   🏷️  SKU: " + zettleProductData.variants[0].sku)

      const createdProduct = await zettleAPI.createProduct(zettleProductData)
      console.log(`   ✅ Successfully created: ${product.name}`)
      console.log(`   🆔 Confirmed UUID: ${createdProduct.uuid}`)

      results.push({
        name: product.name,
        status: "success",
        uuid: createdProduct.uuid,
        price: product.price,
        stock: product.stock,
      })

      successCount++

      // Add a delay to avoid rate limiting
      if (index < meatCatalog.length - 1) {
        console.log("   ⏳ Waiting 2 seconds to avoid rate limiting...")
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    } catch (error) {
      console.error(`   ❌ Failed to create ${product.name}:`, error.message)
      results.push({
        name: product.name,
        status: "error",
        error: error.message,
        price: product.price,
        stock: product.stock,
      })
      errorCount++

      // Continue with next product even if one fails
      if (index < meatCatalog.length - 1) {
        console.log("   ⏳ Waiting 1 second before next attempt...")
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  console.log(`\n🎉 Catalog population complete!`)
  console.log(`✅ Successfully created: ${successCount} products`)
  console.log(`❌ Failed to create: ${errorCount} products`)
  console.log(`📊 Total attempted: ${meatCatalog.length} products`)

  // Show detailed results
  console.log("\n📋 Detailed Results:")
  console.log("=".repeat(80))
  results.forEach((result, index) => {
    const status = result.status === "success" ? "✅" : "❌"
    console.log(`${status} ${index + 1}. ${result.name} - $${result.price} (${result.stock} stock)`)
    if (result.status === "success") {
      console.log(`     UUID: ${result.uuid}`)
    } else {
      console.log(`     Error: ${result.error}`)
    }
  })

  if (successCount > 0) {
    console.log("\n🛒 Your Zettle catalog is now populated with meat products!")
    console.log("🔗 Visit your admin dashboard at /dashboard to manage these products.")
    console.log("🏪 Visit your store at / to see the products live.")
  }

  if (errorCount > 0) {
    console.log("\n⚠️  Some products failed to create. Check the errors above.")
    console.log("💡 Common issues:")
    console.log("   - JWT token expired (generate a new one)")
    console.log("   - Network connectivity issues")
    console.log("   - Zettle API rate limiting")
    console.log("   - Invalid product data format")
  }

  console.log("\n🔄 You can run this script again to retry failed products.")
  console.log("📝 Script completed at:", new Date().toISOString())
}

// Run the script
populateZettleCatalog().catch((error) => {
  console.error("💥 Script failed:", error.message)
  console.error("🔍 Full error:", error)
  process.exit(1)
})
