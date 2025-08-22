// Zettle API integration for inventory management
import { v1 as uuidv1 } from "uuid"
import type { Product } from "./types"

// Environment variables
const ZETTLE_AUTH_URL = process.env.ZETTLE_AUTH_URL || "https://oauth.izettletest.com"
const ZETTLE_CLIENT_ID = process.env.ZETTLE_CLIENT_ID || ""
const ZETTLE_JWT_ASSERTION = process.env.ZETTLE_JWT_ASSERTION || ""
const ZETTLE_PRODUCTS_URL = process.env.ZETTLE_PRODUCTS_URL || "https://products.izettletest.com"
const ZETTLE_INVENTORY_URL = process.env.ZETTLE_INVENTORY_URL || "https://inventory.izettletest.com"

// Check if Zettle is configured
export function isZettleConfigured(): boolean {
  return !!(ZETTLE_AUTH_URL && ZETTLE_CLIENT_ID && ZETTLE_JWT_ASSERTION && ZETTLE_PRODUCTS_URL)
}

// Fallback products for when Zettle is not available
const FALLBACK_PRODUCTS: Product[] = [
  {
    uuid: "demo-salmon-001",
    name: "Atlantic Salmon Fillet",
    description: "Fresh Atlantic salmon, sustainably sourced",
    price: 24.99,
    stock: 15,
    imageUrl: "/placeholder.svg?height=300&width=300&text=Salmon",
    sku: "SALM-001",
    tracked: true,
  },
  {
    uuid: "demo-cod-002",
    name: "Fresh Cod Fillet",
    description: "Premium cod fillet, perfect for fish and chips",
    price: 18.99,
    stock: 8,
    imageUrl: "/placeholder.svg?height=300&width=300&text=Cod",
    sku: "COD-002",
    tracked: true,
  },
  {
    uuid: "demo-shrimp-003",
    name: "Jumbo Shrimp",
    description: "Large, succulent shrimp, peeled and deveined",
    price: 32.99,
    stock: 0,
    imageUrl: "/placeholder.svg?height=300&width=300&text=Shrimp",
    sku: "SHRMP-003",
    tracked: true,
  },
  {
    uuid: "demo-tuna-004",
    name: "Yellowfin Tuna Steak",
    description: "Sushi-grade yellowfin tuna steaks",
    price: 28.99,
    stock: 12,
    imageUrl: "/placeholder.svg?height=300&width=300&text=Tuna",
    sku: "TUNA-004",
    tracked: true,
  },
  {
    uuid: "demo-lobster-005",
    name: "Maine Lobster Tail",
    description: "Fresh Maine lobster tails, 6-8oz each",
    price: 45.99,
    stock: 0,
    imageUrl: "/placeholder.svg?height=300&width=300&text=Lobster",
    sku: "LOBS-005",
    tracked: true,
  },
]

interface ZettleAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface ZettleAuthError {
  error: string
  error_description: string
}

interface ZettleProduct {
  uuid?: string
  name: string
  description?: string
  imageLookupKeys?: string[]
  presentation?: {
    imageUrl?: string
    backgroundColor?: string
    textColor?: string
  }
  variants?: Array<{
    uuid?: string
    name?: string
    description?: string
    sku?: string
    barcode?: string
    price?: {
      amount: number
      currencyId: string
    }
    costPrice?: {
      amount: number
      currencyId: string
    }
    inventory?: {
      tracked: boolean
      inStock?: number
      lowStock?: number
    }
  }>
  vatPercentage?: number
  etag?: string
  updatedAt?: string
  updatedBy?: string
  createdAt?: string
  category?: {
    uuid: string
    name: string
  }
}

interface ZettleInventoryBalance {
  variantUuid: string
  trackedQuantity: number
  locationUuid?: string
}

interface ZettleInventory {
  uuid: string
  name: string
  type: string
}

interface ZettleMovement {
  productUuid: string
  variantUuid: string
  from: string
  to: string
  change: number
}

interface ZettleImageUploadRequest {
  imageFormat: "JPEG" | "PNG" | "GIF"
  imageUrl: string
}

interface ZettleImageUploadResponse {
  imageLookupKey: string
  imageUrls: string[]
}

class ZettleAPI {
  private accessToken: string | null = null
  private tokenExpiry = 0
  private authenticationFailed = false
  private inventoryUuids: { supplier?: string; store?: string } = {}
  private inventorySupported = true // Track if inventory operations are supported
  private productCache: Map<string, Product> = new Map()
  private cacheExpiry = 0
  private readonly CACHE_DURATION = 30000 // 30 seconds
  private movementCallCount = new Map<string, number>() // Track movement calls
  private pendingMovements = new Set<string>() // Track pending movements to prevent duplicates

  private validateConfiguration(): { isValid: boolean; error?: string } {
    const authUrl = process.env.ZETTLE_AUTH_URL || "https://oauth.izettletest.com"
    const clientId = process.env.ZETTLE_CLIENT_ID || ""
    const assertion = process.env.ZETTLE_JWT_ASSERTION || ""

    if (!authUrl) {
      return { isValid: false, error: "ZETTLE_AUTH_URL environment variable is not set" }
    }

    if (!clientId) {
      return { isValid: false, error: "ZETTLE_CLIENT_ID environment variable is not set" }
    }

    if (!assertion) {
      return { isValid: false, error: "ZETTLE_JWT_ASSERTION environment variable is not set" }
    }

    // Basic validation of client ID format (should be a UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(clientId)) {
      return { isValid: false, error: "ZETTLE_CLIENT_ID appears to be invalid (should be a UUID)" }
    }

    return { isValid: true }
  }

  // Reset authentication state
  public resetAuthState(): void {
    this.authenticationFailed = false
    this.accessToken = null
    this.tokenExpiry = 0
    console.log("ZettleAPI: Authentication state reset")
  }

  // Clear product cache
  public clearProductCache(): void {
    this.productCache.clear()
    this.cacheExpiry = 0
    console.log("ZettleAPI: Product cache cleared")
  }

  // Clear movement call tracking (called after successful operations)
  public clearMovementTracking(): void {
    this.movementCallCount.clear()
    this.pendingMovements.clear()
    console.log("ZettleAPI: Movement call tracking and pending movements cleared")
  }

  // Check if cache is valid
  private isCacheValid(): boolean {
    return Date.now() < this.cacheExpiry && this.productCache.size > 0
  }

  // Public method to access cache validation
  public isCacheValidPublic(): boolean {
    return this.isCacheValid()
  }

  // Public method to get cached products
  public getCachedProducts(): Product[] {
    return Array.from(this.productCache.values())
  }

  public async getAccessToken(): Promise<string> {
    // If authentication previously failed, don't retry immediately
    if (this.authenticationFailed) {
      throw new Error("Authentication previously failed - check Zettle configuration")
    }

    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      console.log("Using cached access token")
      return this.accessToken
    }

    console.log("Getting new access token from Zettle...")

    // Validate configuration first
    const configValidation = this.validateConfiguration()
    if (!configValidation.isValid) {
      this.authenticationFailed = true
      throw new Error(`Configuration error: ${configValidation.error}`)
    }

    const authUrl = process.env.ZETTLE_AUTH_URL || "https://oauth.izettletest.com"
    const clientId = process.env.ZETTLE_CLIENT_ID || ""
    const assertion = process.env.ZETTLE_JWT_ASSERTION || ""

    try {
      const response = await fetch(`${authUrl}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          client_id: clientId,
          assertion: assertion,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Auth error response:", errorText)

        let errorData: ZettleAuthError
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: "unknown_error", error_description: errorText }
        }

        this.authenticationFailed = true

        // Provide specific error messages for common issues
        if (errorData.error === "invalid_client") {
          throw new Error(
            `Invalid client_id. Please check your ZETTLE_CLIENT_ID environment variable. Current value appears to be: ${clientId.substring(0, 8)}...`,
          )
        }

        if (errorData.error === "invalid_grant") {
          throw new Error(
            `JWT assertion is invalid or expired. Please generate a new JWT assertion at https://developer.zettle.com/. Error: ${errorData.error_description}`,
          )
        }

        throw new Error(`Zettle authentication failed: ${errorData.error} - ${errorData.error_description}`)
      }

      const data: ZettleAuthResponse = await response.json()
      console.log("Auth success, token expires in:", data.expires_in, "seconds")

      this.accessToken = data.access_token
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000
      this.authenticationFailed = false // Reset failure flag on success

      return this.accessToken
    } catch (error) {
      console.error("Failed to get Zettle access token:", error)
      this.authenticationFailed = true
      throw error
    }
  }

  // Get inventory UUIDs for stock movements - Enhanced with better validation
  async getInventoryUuids(): Promise<{ supplier?: string; store?: string }> {
    // If inventory operations are not supported, return empty object
    if (!this.inventorySupported) {
      console.log("ZettleAPI: Inventory operations not supported, skipping UUID fetch")
      return {}
    }

    if (this.inventoryUuids.supplier && this.inventoryUuids.store) {
      console.log("ZettleAPI: Using cached inventory UUIDs:", this.inventoryUuids)
      return this.inventoryUuids
    }

    try {
      const token = await this.getAccessToken()
      const inventoryUrl = process.env.ZETTLE_INVENTORY_URL || "https://inventory.izettletest.com"

      console.log("ZettleAPI: Fetching inventory UUIDs from:", `${inventoryUrl}/organizations/self/locations`)
      const response = await fetch(`${inventoryUrl}/organizations/self/locations`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      console.log("ZettleAPI: Inventory response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("ZettleAPI: Failed to fetch inventories:", errorText)

        // Mark inventory as not supported for certain error codes
        if (response.status === 404 || response.status === 403 || response.status === 501) {
          console.log("ZettleAPI: Inventory operations not supported in this environment")
          this.inventorySupported = false
          return {}
        }

        throw new Error(`Failed to fetch inventories: ${response.status} ${response.statusText}`)
      }

      const inventories: ZettleInventory[] = await response.json()
      console.log("ZettleAPI: Available inventories:", inventories)

      if (!Array.isArray(inventories) || inventories.length === 0) {
        console.log("ZettleAPI: No inventories found, inventory operations not supported")
        this.inventorySupported = false
        return {}
      }

      // Find supplier and store inventories
      const supplierInventory = inventories.find(
        (inv) => inv.type === "SUPPLIER" || inv.name.toLowerCase().includes("supplier"),
      )
      const storeInventory = inventories.find((inv) => inv.type === "STORE" || inv.name.toLowerCase().includes("store"))

      if (supplierInventory) {
        this.inventoryUuids.supplier = supplierInventory.uuid
        console.log("ZettleAPI: Found supplier inventory:", supplierInventory.uuid)
      }

      if (storeInventory) {
        this.inventoryUuids.store = storeInventory.uuid
        console.log("ZettleAPI: Found store inventory:", storeInventory.uuid)
      }

      // If we don't find specific types, use the first available inventories
      if (!this.inventoryUuids.supplier && inventories.length > 0) {
        this.inventoryUuids.supplier = inventories[0].uuid
        console.log("ZettleAPI: Using first inventory as supplier:", inventories[0].uuid)
      }

      if (!this.inventoryUuids.store && inventories.length > 1) {
        this.inventoryUuids.store = inventories[1].uuid
        console.log("ZettleAPI: Using second inventory as store:", inventories[1].uuid)
      } else if (!this.inventoryUuids.store && inventories.length > 0) {
        this.inventoryUuids.store = inventories[0].uuid
        console.log("ZettleAPI: Using first inventory as store:", inventories[0].uuid)
      }

      console.log("ZettleAPI: Final inventory UUIDs:", this.inventoryUuids)
      return this.inventoryUuids
    } catch (error) {
      console.error("ZettleAPI: Error fetching inventory UUIDs:", error)
      this.inventorySupported = false
      return {}
    }
  }

  // Enable inventory tracking using the official Zettle API
  async enableInventoryTracking(productUuid: string): Promise<void> {
    try {
      console.log(`ZettleAPI: Enabling inventory tracking for product ${productUuid}`)

      const token = await this.getAccessToken()
      const productsUrl = process.env.ZETTLE_PRODUCTS_URL || "https://products.izettletest.com"

      // Use the official Zettle tracking API endpoint - try different request formats
      const trackingRequest = [
        {
          productUuid: productUuid,
          tracking: "enable"
        }
      ]

      // Alternative format based on documentation
      const alternativeRequest = {
        products: [
          {
            productUuid: productUuid,
            tracking: "enable"
          }
        ]
      }

      console.log("ZettleAPI: Sending tracking enable request:", JSON.stringify(trackingRequest, null, 2))
      console.log("ZettleAPI: Alternative tracking request:", JSON.stringify(alternativeRequest, null, 2))
      console.log("ZettleAPI: Tracking API URL:", `${productsUrl}/organizations/self/products/tracking`)

      // Try the first format
      let response = await fetch(`${productsUrl}/organizations/self/products/tracking`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(trackingRequest),
      })

      // If first format fails, try alternative format and endpoints
      if (!response.ok) {
        console.log("ZettleAPI: First format failed, trying alternative format...")
        response = await fetch(`${productsUrl}/organizations/self/products/tracking`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(alternativeRequest),
        })

        // If still failing, try inventory endpoint
        if (!response.ok) {
          console.log("ZettleAPI: Alternative format failed, trying inventory endpoint...")
          const inventoryUrl = process.env.ZETTLE_INVENTORY_URL || "https://inventory.izettletest.com"
          response = await fetch(`${inventoryUrl}/organizations/self/products/tracking`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(trackingRequest),
          })
        }
      }

      console.log("ZettleAPI: Enable tracking response status:", response.status)
      console.log("ZettleAPI: Enable tracking response headers:", Object.fromEntries(response.headers.entries()))

      if (response.status === 204) {
        console.log("ZettleAPI: ✅ Inventory tracking enabled successfully (204 No Content)")

        // Verify tracking was actually enabled by getting the product
        try {
          await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
          const verifyProduct = await this.getProduct(productUuid)
          const isTracked = verifyProduct.variants?.[0]?.inventory?.tracked
          console.log("ZettleAPI: 🔍 Verification - Product tracking status:", isTracked)
        } catch (verifyError) {
          console.warn("ZettleAPI: Could not verify tracking status:", verifyError)
        }
      } else if (response.ok) {
        const responseText = await response.text()
        console.log("ZettleAPI: ✅ Inventory tracking enabled successfully")
        console.log("ZettleAPI: Tracking response:", responseText)

        // Verify tracking was actually enabled
        try {
          await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
          const verifyProduct = await this.getProduct(productUuid)
          const isTracked = verifyProduct.variants?.[0]?.inventory?.tracked
          console.log("ZettleAPI: 🔍 Verification - Product tracking status:", isTracked)
        } catch (verifyError) {
          console.warn("ZettleAPI: Could not verify tracking status:", verifyError)
        }
      } else {
        const errorText = await response.text()
        console.error("ZettleAPI: ❌ Failed to enable inventory tracking:", errorText)
        console.error("ZettleAPI: Response status:", response.status)
        console.error("ZettleAPI: Request URL:", `${productsUrl}/organizations/self/products/tracking`)
        console.error("ZettleAPI: Request payload:", JSON.stringify(trackingRequest, null, 2))

        // Try to parse error details
        try {
          const errorData = JSON.parse(errorText)
          console.error("ZettleAPI: Error details:", errorData)
        } catch (e) {
          console.error("ZettleAPI: Raw error response:", errorText)
        }

        // Don't throw error - continue with product creation but log the issue
        console.warn("ZettleAPI: ⚠️ Continuing with product creation despite tracking enablement failure")
      }
    } catch (error) {
      console.warn("ZettleAPI: Error enabling inventory tracking:", error)
      // Don't throw error - continue with product creation
    }
  }

  // Upload image to Zettle using the official Image API
  async uploadImageToZettle(imageUrl: string): Promise<string | null> {
    try {
      console.log(`ZettleAPI: Attempting to upload image to Zettle: ${imageUrl}`)

      // Note: Zettle may require publicly accessible URLs, but let's try the upload anyway
      // If it fails due to accessibility, we'll handle the error gracefully

      console.log(`ZettleAPI: Uploading image to Zettle: ${imageUrl}`)

      const token = await this.getAccessToken()
      const productsUrl = process.env.ZETTLE_PRODUCTS_URL || "https://products.izettletest.com"

      // Determine image format from URL
      const imageFormat = this.getImageFormat(imageUrl)
      if (!imageFormat) {
        console.error("ZettleAPI: Unsupported image format for URL:", imageUrl)
        return null
      }

      const uploadRequest: ZettleImageUploadRequest = {
        imageFormat: imageFormat,
        imageUrl: imageUrl
      }

      console.log("ZettleAPI: Image upload request:", JSON.stringify(uploadRequest, null, 2))

      const response = await fetch(`${productsUrl}/v2/images/organizations/self/products`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(uploadRequest),
      })

      console.log("ZettleAPI: Image upload response status:", response.status)

      if (response.ok) {
        const uploadResponse: ZettleImageUploadResponse = await response.json()
        console.log("ZettleAPI: Image upload successful:", uploadResponse)

        // Return the first image URL from the response
        const zettleImageUrl = uploadResponse.imageUrls?.[0]
        if (zettleImageUrl) {
          console.log("ZettleAPI: ✅ Image uploaded successfully, Zettle URL:", zettleImageUrl)
          return zettleImageUrl
        } else {
          console.error("ZettleAPI: No image URL returned from Zettle")
          return null
        }
      } else {
        const errorText = await response.text()
        console.error("ZettleAPI: Image upload failed:", errorText)
        console.error("ZettleAPI: Response status:", response.status)

        // Parse error for more details
        try {
          const errorData = JSON.parse(errorText)
          console.error("ZettleAPI: Error details:", errorData)
        } catch (e) {
          console.error("ZettleAPI: Raw error response:", errorText)
        }

        return null
      }
    } catch (error) {
      console.error("ZettleAPI: Error uploading image to Zettle:", error)
      return null
    }
  }

  // Helper method to check if URL is local/localhost
  private isLocalUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname.toLowerCase()

      // Check for localhost, local IPs, and local domains
      return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.') ||
        hostname.endsWith('.local') ||
        !hostname.includes('.')  // No domain extension
      )
    } catch (e) {
      // If URL parsing fails, assume it's not a valid public URL
      return true
    }
  }

  // Helper method to determine image format from URL
  private getImageFormat(imageUrl: string): "JPEG" | "PNG" | "GIF" | null {
    const url = imageUrl.toLowerCase()
    if (url.includes('.jpg') || url.includes('.jpeg')) {
      return "JPEG"
    } else if (url.includes('.png')) {
      return "PNG"
    } else if (url.includes('.gif')) {
      return "GIF"
    }

    // Default to JPEG if we can't determine
    console.log("ZettleAPI: Could not determine image format, defaulting to JPEG")
    return "JPEG"
  }

  // Enable tracking for multiple products at once
  async enableInventoryTrackingBatch(productUuids: string[]): Promise<void> {
    try {
      console.log(`ZettleAPI: Enabling inventory tracking for ${productUuids.length} products`)

      const token = await this.getAccessToken()
      const productsUrl = process.env.ZETTLE_PRODUCTS_URL || "https://products.izettletest.com"

      // Use the official Zettle tracking API endpoint for batch operations
      const trackingRequest = productUuids.map(uuid => ({
        productUuid: uuid,
        tracking: "enable"
      }))

      console.log("ZettleAPI: Sending batch tracking enable request:", JSON.stringify(trackingRequest, null, 2))

      const response = await fetch(`${productsUrl}/organizations/self/products/tracking`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(trackingRequest),
      })

      console.log("ZettleAPI: Batch enable tracking response status:", response.status)

      if (response.status === 204) {
        console.log("ZettleAPI: ✅ Batch inventory tracking enabled successfully (204 No Content)")
      } else if (response.ok) {
        const responseText = await response.text()
        console.log("ZettleAPI: ✅ Batch inventory tracking enabled successfully")
        console.log("ZettleAPI: Tracking response:", responseText)
      } else {
        const errorText = await response.text()
        console.warn("ZettleAPI: Failed to enable batch inventory tracking:", errorText)
        console.warn("ZettleAPI: Response status:", response.status)
      }
    } catch (error) {
      console.warn("ZettleAPI: Error enabling batch inventory tracking:", error)
    }
  }

  // Create stock movement for admin inventory management - sets exact stock balance
  async setStockBalance(productUuid: string, variantUuid: string, targetStock: number): Promise<void> {
    // Prevent duplicate calls
    const operationKey = `setStock-${productUuid}-${targetStock}-${Date.now()}`
    if (this.pendingMovements.has(operationKey)) {
      console.log(`🚫 DUPLICATE setStockBalance CALL BLOCKED: ${operationKey}`)
      return
    }
    this.pendingMovements.add(operationKey)
    try {
      console.log(`🔄 ADMIN INVENTORY: Setting exact stock balance to ${targetStock} for product ${productUuid}`)
      console.log(`🔍 DEBUG: Received targetStock type: ${typeof targetStock}, value: ${targetStock}`)

      // Clear any cache to ensure fresh data
      this.clearProductCache()

      // First get the product to find variant UUID
      console.log("🔍 Getting product details to find variant UUID...")
      let actualVariantUuid = variantUuid
      try {
        const product = await this.getProduct(productUuid)
        actualVariantUuid = product.variants?.[0]?.uuid || variantUuid
        console.log(`📋 PRODUCT VARIANT UUID: ${actualVariantUuid}`)
      } catch (error) {
        console.warn("Could not get product details, using provided variant UUID")
      }

      // Get current stock from Zettle using the working stock details method
      console.log("🔍 Getting current stock from Zettle using stock details...")
      const stockMap = await this.getStockDetails()

      // Try to find stock using different UUID approaches
      let currentStock = 0
      const stockFromProduct = stockMap.get(productUuid)
      const stockFromVariant = actualVariantUuid ? stockMap.get(actualVariantUuid) : undefined

      // Use the most reliable source
      currentStock = stockFromVariant ?? stockFromProduct ?? 0

      console.log(`📊 STOCK FROM PRODUCT UUID: ${stockFromProduct}`)
      console.log(`📊 STOCK FROM VARIANT UUID: ${stockFromVariant}`)
      console.log(`📊 FINAL CURRENT STOCK: ${currentStock} (type: ${typeof currentStock})`)

      console.log(`📊 TARGET STOCK: ${targetStock} (type: ${typeof targetStock})`)

      // Calculate the EXACT difference needed to reach target stock
      const stockDifference = targetStock - currentStock
      console.log(`🧮 DIFFERENCE CALCULATION: ${targetStock} - ${currentStock} = ${stockDifference}`)

      if (stockDifference === 0) {
        console.log("✅ NO CHANGE NEEDED: Stock already at target quantity")
        return
      }

      console.log(`📈📉 MOVEMENT REQUIRED: ${stockDifference > 0 ? 'ADD' : 'REMOVE'} ${Math.abs(stockDifference)} units`)
      console.log(`🎯 EXPECTED FINAL RESULT: ${currentStock} + (${stockDifference}) = ${targetStock}`)

      // Ensure we only pass the exact difference amount to the movement API
      const changeAmount = Math.abs(stockDifference)
      console.log(`🔢 CHANGE AMOUNT TO PASS TO MOVEMENT API: ${changeAmount}`)

      const token = await this.getAccessToken()
      const inventoryUrl = process.env.ZETTLE_INVENTORY_URL || "https://inventory.izettletest.com"

      // Get inventory location UUIDs
      const inventoryUuids = await this.getInventoryUuids()
      const storeUuid = inventoryUuids.store
      const supplierUuid = inventoryUuids.supplier

      if (!storeUuid || !supplierUuid) {
        console.warn("ZettleAPI: Missing required location UUIDs for admin stock adjustment")
        return
      }

      // Create movement payload for admin inventory management
      // INCREASE stock: move FROM supplier TO store
      // DECREASE stock: move FROM store TO supplier
      const movementPayload = {
        movements: [
          {
            productUuid: productUuid,
            variantUuid: variantUuid,
            from: stockDifference > 0 ? supplierUuid : storeUuid,
            to: stockDifference > 0 ? storeUuid : supplierUuid,
            change: changeAmount, // Use the exact calculated difference
            reason: stockDifference > 0 ? "ADMIN_RESTOCK" : "ADMIN_ADJUSTMENT",
            timestamp: new Date().toISOString()
          }
        ]
      }

      console.log("🔥 ADMIN INVENTORY: Movement payload:", JSON.stringify(movementPayload, null, 2))
      console.log(`📋 SUMMARY: Moving ${changeAmount} units ${stockDifference > 0 ? 'FROM supplier TO store' : 'FROM store TO supplier'} to change stock from ${currentStock} to ${targetStock}`)

      const response = await fetch(`${inventoryUrl}/v3/movements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(movementPayload),
      })

      console.log("ZettleAPI: Admin stock adjustment response status:", response.status)

      if (response.ok || response.status === 204) {
        console.log(`✅ ADMIN INVENTORY: Movement completed successfully`)

        // Verify the update
        const newStock = await this.getProductStock(productUuid)
        console.log(`📊 VERIFICATION: Expected ${targetStock}, Actual ${newStock}`)

        if (newStock !== targetStock) {
          console.error(`🚨 STOCK MISMATCH! Expected ${targetStock} but got ${newStock}`)
          console.error(`🚨 This suggests there might be multiple movements or incorrect calculation`)
        } else {
          console.log(`✅ STOCK VERIFIED: Successfully set to ${targetStock}`)
        }
      } else {
        const errorText = await response.text()
        console.error("ZettleAPI: Admin stock adjustment failed:", errorText)
        throw new Error(`Failed to adjust stock: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      console.error("ZettleAPI: Error in admin stock adjustment:", error)
      throw error
    } finally {
      // Always remove from pending operations
      this.pendingMovements.delete(operationKey)
    }
  }

  // Create stock movement using official Zettle API: POST https://inventory.izettle.com/v3/movements
  async createStockMovement(productUuid: string, variantUuid: string, quantity: number, reason: string = "ADJUSTMENT"): Promise<void> {
    // Create a unique key for this movement to prevent duplicates
    const movementKey = `${productUuid}-${variantUuid}-${quantity}-${reason}-${Date.now()}`
    const duplicateKey = `${productUuid}-${variantUuid}-${quantity}-${reason}`

    try {

      // Check if this exact movement is already pending
      if (this.pendingMovements.has(duplicateKey)) {
        console.log(`🚫 DUPLICATE MOVEMENT BLOCKED: ${duplicateKey}`)
        console.log(`🚫 Movement already in progress, skipping duplicate`)
        return
      }

      // Mark this movement as pending
      this.pendingMovements.add(duplicateKey)

      // Track and log duplicate calls
      const currentCount = this.movementCallCount.get(duplicateKey) || 0
      this.movementCallCount.set(duplicateKey, currentCount + 1)

      // Log the call stack to see where this is being called from
      const stack = new Error().stack
      console.log(`🔥 ZettleAPI.createStockMovement CALLED #${currentCount + 1}: product=${productUuid}, variant=${variantUuid}, quantity=${quantity}, reason=${reason}`)

      if (currentCount > 0) {
        console.log(`🚨 DUPLICATE CALL DETECTED! This is call #${currentCount + 1} for the same movement`)
        console.log(`🔥 CALL STACK:`, stack?.split('\n').slice(1, 8).join('\n'))
      } else {
        console.log(`🔥 CALL STACK:`, stack?.split('\n').slice(1, 5).join('\n'))
      }

      const token = await this.getAccessToken()
      const inventoryUrl = process.env.ZETTLE_INVENTORY_URL || "https://inventory.izettletest.com"

      // Get inventory location UUIDs
      const inventoryUuids = await this.getInventoryUuids()
      const storeUuid = inventoryUuids.store
      const supplierUuid = inventoryUuids.supplier

      if (!storeUuid || !supplierUuid) {
        console.warn("ZettleAPI: Missing required location UUIDs for stock movement")
        console.warn("ZettleAPI: Store UUID:", storeUuid, "Supplier UUID:", supplierUuid)
        return
      }

      // Create the movement payload according to Zettle API specification
      // Both "from" and "to" must be valid location UUIDs
      // For INCREASE (positive): move FROM supplier TO store (adds to store inventory)
      // For DECREASE (negative): move FROM store TO supplier (removes from store inventory)
      const movementPayload = {
        movements: [
          {
            productUuid: productUuid,
            variantUuid: variantUuid,
            from: quantity > 0 ? supplierUuid : storeUuid,  // INCREASE: supplier→store, DECREASE: store→supplier
            to: quantity > 0 ? storeUuid : supplierUuid,    // INCREASE: supplier→store, DECREASE: store→supplier
            change: Math.abs(quantity), // The actual quantity change (always positive)
            reason: reason,
            timestamp: new Date().toISOString()
          }
        ]
      }

      console.log("🔥 ZettleAPI.createStockMovement: Final movement payload:", JSON.stringify(movementPayload, null, 2))

      // Get current stock BEFORE the movement
      const stockBefore = await this.getProductStock(productUuid)
      console.log(`📊 STOCK BEFORE MOVEMENT: ${stockBefore} for product ${productUuid}`)

      const response = await fetch(`${inventoryUrl}/v3/movements`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(movementPayload),
      })

      console.log("ZettleAPI: Stock movement response status:", response.status)

      if (response.ok || response.status === 204) {
        const responseText = response.status === 204 ? "No Content" : await response.text()
        console.log("ZettleAPI: ✅ Stock movement created successfully")
        console.log("ZettleAPI: Movement response:", responseText)

        // Get stock AFTER the movement to see the actual change
        const stockAfter = await this.getProductStock(productUuid)
        const actualChange = stockAfter - stockBefore
        console.log(`📊 STOCK AFTER MOVEMENT: ${stockAfter} for product ${productUuid}`)
        console.log(`📊 ACTUAL STOCK CHANGE: ${actualChange} (expected: ${quantity})`)

        if (Math.abs(actualChange) !== Math.abs(quantity)) {
          console.log(`🚨 UNEXPECTED STOCK CHANGE! Expected ${quantity}, but got ${actualChange}`)
        }

        // Remove from pending movements on success
        this.pendingMovements.delete(duplicateKey)
        console.log(`✅ Movement completed and removed from pending: ${duplicateKey}`)
      } else {
        const errorText = await response.text()
        console.error("ZettleAPI: Stock movement creation failed:", errorText)
        console.error("ZettleAPI: Response status:", response.status)

        // Remove from pending movements on failure too
        this.pendingMovements.delete(duplicateKey)
        console.log(`❌ Movement failed and removed from pending: ${duplicateKey}`)

        // Parse error for more details
        try {
          const errorData = JSON.parse(errorText)
          console.error("ZettleAPI: Error details:", errorData)
        } catch (e) {
          console.error("ZettleAPI: Raw error response:", errorText)
        }

        throw new Error(`Failed to create stock movement: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      // Remove from pending movements on any error
      this.pendingMovements.delete(duplicateKey)
      console.log(`❌ Movement errored and removed from pending: ${duplicateKey}`)

      console.error("ZettleAPI: Error creating stock movement:", error)
      throw error
    }
  }

  // Deprecated method - use enableInventoryTracking instead
  async startInventoryTracking(productUuid: string, variantUuid: string): Promise<void> {
    console.log("ZettleAPI: startInventoryTracking is deprecated, using enableInventoryTracking instead")
    await this.enableInventoryTracking(productUuid)
  }

  // Reduce inventory for sold items using official Zettle movements API
  async recordSale(productUuid: string, variantUuid: string, quantity: number): Promise<void> {
    try {
      console.log(`ZettleAPI: Recording sale of ${quantity} items for product ${productUuid}, variant ${variantUuid}`)

      // Use the official Zettle movements API to adjust stock after sale
      await this.createStockMovement(productUuid, variantUuid, -quantity, "SALE")
      console.log("✅ ZettleAPI: Stock movement for sale recorded successfully")

    } catch (error) {
      console.error("ZettleAPI: Error recording sale:", error)
      // Don't throw error to avoid breaking the checkout process
      console.log("ZettleAPI: Continuing without inventory update")
    }
  }

  // Update inventory balance directly using the correct Zettle API
  async updateInventoryBalanceDirectly(productUuid: string, variantUuid: string, newBalance: number): Promise<void> {
    try {
      console.log(`🔥 ZettleAPI.updateInventoryBalanceDirectly: product=${productUuid}, variant=${variantUuid}, newBalance=${newBalance}`)

      // Get current stock BEFORE the update
      const stockBefore = await this.getProductStock(productUuid)
      console.log(`📊 STOCK BEFORE DIRECT UPDATE: ${stockBefore} for product ${productUuid}`)

      const token = await this.getAccessToken()
      const inventoryUrl = process.env.ZETTLE_INVENTORY_URL || "https://inventory.izettletest.com"

      // Get inventory UUIDs
      const inventoryUuids = await this.getInventoryUuids()
      const locationUuid = inventoryUuids.store || inventoryUuids.supplier

      if (!locationUuid) {
        console.warn("ZettleAPI: No location UUID available for balance update")
        return
      }

      // Use the balance update approach with correct format
      const balanceUpdate = {
        productUuid: productUuid,
        variantUuid: variantUuid,
        locationUuid: locationUuid,
        trackedQuantity: Math.max(0, newBalance)
      }

      console.log("🔥 ZettleAPI.updateInventoryBalanceDirectly: Sending direct balance update:", JSON.stringify(balanceUpdate, null, 2))

      const response = await fetch(`${inventoryUrl}/organizations/self/inventory/balance`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(balanceUpdate),
      })

      console.log("ZettleAPI: Direct balance update response status:", response.status)

      if (response.ok || response.status === 204) {
        const responseText = response.status === 204 ? "No Content" : await response.text()
        console.log("ZettleAPI: ✅ Direct balance update successful")
        console.log("ZettleAPI: Balance response:", responseText)

        // Get stock AFTER the update to verify the change
        const stockAfter = await this.getProductStock(productUuid)
        console.log(`📊 STOCK AFTER DIRECT UPDATE: ${stockAfter} for product ${productUuid}`)
        console.log(`📊 EXPECTED STOCK: ${newBalance}, ACTUAL STOCK: ${stockAfter}`)

        if (stockAfter !== newBalance) {
          console.log(`🚨 STOCK MISMATCH! Expected ${newBalance}, but got ${stockAfter}`)
        }
      } else {
        const errorText = await response.text()
        console.warn("ZettleAPI: Direct balance update failed:", errorText)
        console.warn("ZettleAPI: Response status:", response.status)

        // Parse error for more details
        try {
          const errorData = JSON.parse(errorText)
          console.warn("ZettleAPI: Error details:", errorData)
        } catch (e) {
          console.warn("ZettleAPI: Raw error response:", errorText)
        }

        throw new Error(`Failed to update inventory balance: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      console.error("ZettleAPI: Error in direct balance update:", error)
      throw error
    }
  }

  // Legacy balance update method as fallback
  async updateInventoryBalanceLegacy(productUuid: string, variantUuid: string, quantityChange: number): Promise<void> {
    try {
      console.log(`ZettleAPI: Using legacy balance update for product ${productUuid}, quantity change ${quantityChange}`)

      // Get current stock
      const currentStock = await this.getProductStock(productUuid)
      const newBalance = Math.max(0, currentStock + quantityChange)

      console.log(`ZettleAPI: Current stock: ${currentStock}, change: ${quantityChange}, new balance: ${newBalance}`)

      const token = await this.getAccessToken()
      const inventoryUrl = process.env.ZETTLE_INVENTORY_URL || "https://inventory.izettletest.com"

      // Get inventory UUIDs
      const inventoryUuids = await this.getInventoryUuids()
      const targetLocationUuid = inventoryUuids.store || inventoryUuids.supplier

      if (!targetLocationUuid) {
        console.warn("ZettleAPI: No location UUID available for balance update")
        return
      }

      // Try balance update approach
      const balanceUpdate = {
        productUuid: productUuid,
        variantUuid: variantUuid,
        locationUuid: targetLocationUuid,
        trackedQuantity: newBalance
      }

      console.log("ZettleAPI: Sending balance update:", JSON.stringify(balanceUpdate, null, 2))

      const response = await fetch(`${inventoryUrl}/organizations/self/inventory/balance`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(balanceUpdate),
      })

      console.log("ZettleAPI: Balance update response status:", response.status)

      if (response.ok) {
        const responseText = await response.text()
        console.log("ZettleAPI: ✅ Legacy balance update successful")
        console.log("ZettleAPI: Balance response:", responseText)
      } else {
        const errorText = await response.text()
        console.warn("ZettleAPI: Legacy balance update failed:", errorText)
      }
    } catch (error) {
      console.error("ZettleAPI: Error in legacy balance update:", error)
    }
  }

  // Update inventory balance - now uses the movements API
  async updateInventoryBalance(productUuid: string, variantUuid: string, newBalance: number, locationUuid?: string): Promise<void> {
    try {
      // Get current stock to calculate the change needed
      const currentStock = await this.getProductStock(productUuid)
      const quantityChange = newBalance - currentStock

      console.log(`ZettleAPI: Updating inventory - current: ${currentStock}, target: ${newBalance}, change: ${quantityChange}`)

      if (quantityChange === 0) {
        console.log("ZettleAPI: No inventory change needed")
        return
      }

      // Use the movements API for the update
      await this.updateStockViaMovement(productUuid, variantUuid, newBalance)

    } catch (error) {
      console.error("ZettleAPI: Error updating inventory balance:", error)
      throw error
    }
  }

  async updateInventory(productUuid: string, variantUuid: string, quantity: number) {

  }

  // Adjust inventory by a specific quantity using movements API
  async adjustInventory(productUuid: string, variantUuid: string, quantityChange: number): Promise<void> {
    try {
      console.log(
        `🔥 ZettleAPI.adjustInventory: product=${productUuid}, variant=${variantUuid}, quantityChange=${quantityChange}`,
      )

      if (quantityChange === 0) {
        console.log("ZettleAPI: No inventory adjustment needed (change is 0)")
        return
      }

      // Use movements API but with deduplication already built in
      const reason = quantityChange < 0 ? "SALE" : "RESTOCK"
      console.log(`🔥 ZettleAPI.adjustInventory: About to call createStockMovement with quantity=${quantityChange}, reason=${reason}`)

      await this.createStockMovement(productUuid, variantUuid, quantityChange, reason)
      console.log(`✅ ZettleAPI.adjustInventory: Inventory adjustment completed using movements API`)

    } catch (error) {
      console.error("ZettleAPI: Error adjusting inventory:", error)
      throw error
    }
  }

  // Fallback method using movement-based updates (renamed from updateStock)
  async updateStockViaMovement(productUuid: string, variantUuid: string, newStock: number): Promise<void> {
    try {
      console.log(
        `ZettleAPI: Attempting to update stock for product ${productUuid}, variant ${variantUuid} to ${newStock}`,
      )

      // Force try stock update regardless of previous failures
      console.log("ZettleAPI: Force attempting stock update to test Zettle API")
      this.inventorySupported = true
      // Clear cached inventory UUIDs to force fresh fetch
      this.inventoryUuids = {}

      const token = await this.getAccessToken()
      const inventoryUrl = process.env.ZETTLE_INVENTORY_URL || "https://inventory.izettletest.com"
      const inventoryUuids = await this.getInventoryUuids()

      console.log("ZettleAPI: Retrieved inventory UUIDs:", inventoryUuids)

      // If we don't have valid inventory UUIDs, skip stock update
      if (!inventoryUuids.supplier || !inventoryUuids.store) {
        console.log("ZettleAPI: No valid inventory UUIDs available, skipping stock update")
        console.log("ZettleAPI: inventoryUuids object:", JSON.stringify(inventoryUuids, null, 2))
        return
      }

      // Validate that the UUIDs are proper UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(inventoryUuids.supplier) || !uuidRegex.test(inventoryUuids.store)) {
        console.log("ZettleAPI: Invalid inventory UUIDs detected, skipping stock update")
        console.log("ZettleAPI: Supplier UUID valid:", uuidRegex.test(inventoryUuids.supplier))
        console.log("ZettleAPI: Store UUID valid:", uuidRegex.test(inventoryUuids.store))
        return
      }

      // Get current stock
      const currentStock = await this.getProductStock(productUuid)
      const stockChange = newStock - currentStock

      if (stockChange === 0) {
        console.log("ZettleAPI: No stock change needed")
        return
      }

      console.log(`ZettleAPI: Current stock: ${currentStock}, target: ${newStock}, change: ${stockChange}`)

      // Use the official Zettle inventory update format
      const inventoryChange = {
        productUuid,
        variantUuid,
        fromLocationUuid: stockChange > 0 ? inventoryUuids.supplier : inventoryUuids.store,
        toLocationUuid: stockChange > 0 ? inventoryUuids.store : inventoryUuids.supplier,
        change: Math.abs(stockChange),
      }

      const requestBody = {
        changes: [inventoryChange]
      }

      console.log("ZettleAPI: Sending inventory update:", JSON.stringify(requestBody, null, 2))
      console.log("ZettleAPI: About to call inventory API at:", `${inventoryUrl}/organizations/self/inventory`)

      const response = await fetch(`${inventoryUrl}/organizations/self/inventory`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      console.log("ZettleAPI: Movement response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("ZettleAPI: Stock movement failed:", errorText)
        console.error("ZettleAPI: Movement request details:", {
          url: `${inventoryUrl}/organizations/self/inventory`,
          method: "PUT",
          inventoryChange: inventoryChange,
          responseStatus: response.status,
          responseText: errorText
        })

        // Parse error response to get more details
        let errorData: any = {}
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText }
        }

        // Handle specific error cases
        if (response.status === 400 && errorData.developerMessage?.includes("Invalid UUID")) {
          console.log("ZettleAPI: Invalid UUID in movement request, disabling inventory operations")
          this.inventorySupported = false
          return
        }

        // Don't throw error for test environment - just log and continue
        if (response.status === 404 || response.status === 403 || response.status === 501) {
          console.warn("ZettleAPI: Stock movement not supported in this environment, continuing...")
          this.inventorySupported = false
          return
        }

        console.warn(`ZettleAPI: Stock movement failed with ${response.status}, continuing without stock update`)
        return
      }

      const responseText = await response.text()
      console.log("ZettleAPI: ✅ Stock movement successful!")
      console.log("ZettleAPI: Movement response body:", responseText)
      console.log("ZettleAPI: Successfully updated stock for product", productUuid, "to", newStock)
    } catch (error) {
      console.error("ZettleAPI: Error updating stock:", error)
      // Don't throw error for stock updates - just log and continue
      console.warn("ZettleAPI: Stock update failed, continuing without stock change")
    }
  }

  // Get stock for a specific product using official Zettle API: GET https://inventory.izettle.com/v3/balances
  async getProductStock(productUuid: string): Promise<number> {
    try {
      // If inventory operations are not supported, return 0
      if (!this.inventorySupported) {
        return 0
      }

      const token = await this.getAccessToken()
      const inventoryUrl = process.env.ZETTLE_INVENTORY_URL || "https://inventory.izettletest.com"

      // Get inventory location UUIDs
      const inventoryUuids = await this.getInventoryUuids()
      const storeUuid = inventoryUuids.store || inventoryUuids.supplier

      if (!storeUuid) {
        console.warn("ZettleAPI: No store UUID available for stock balance check")
        return 0
      }

      console.log(`ZettleAPI: Getting stock balance for product ${productUuid} at location ${storeUuid}`)

      // First, get the product to find the variant UUID
      let variantUuid: string | undefined
      try {
        const product = await this.getProduct(productUuid)
        variantUuid = product.variants?.[0]?.uuid
        console.log(`ZettleAPI: Found variant UUID: ${variantUuid} for product ${productUuid}`)
      } catch (error) {
        console.warn("ZettleAPI: Could not get product details for stock check:", error)
      }

      // Try multiple approaches to get stock balance
      const endpoints = [
        // Try with location parameter
        `${inventoryUrl}/v3/balances?locationUuid=${storeUuid}`,
        // Try with inventory parameter (original)
        `${inventoryUrl}/v3/balances?inventoryUuid=${storeUuid}`,
        // Try without location filter (get all)
        `${inventoryUrl}/v3/balances`,
      ]

      for (const endpoint of endpoints) {
        try {
          console.log(`ZettleAPI: Trying endpoint: ${endpoint}`)

          const response = await fetch(endpoint, {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          })

          if (!response.ok) {
            console.log(`ZettleAPI: Endpoint failed: ${response.status} ${response.statusText}`)
            continue
          }

          const balancesData = await response.json()
          console.log(`ZettleAPI: Raw balances response from ${endpoint}:`, JSON.stringify(balancesData, null, 2))

          // Find the balance for the specific product or variant
          if (Array.isArray(balancesData)) {
            const productBalance = balancesData.find(balance =>
              balance.productUuid === productUuid ||
              balance.variantUuid === productUuid ||
              (variantUuid && balance.variantUuid === variantUuid)
            )

            if (productBalance) {
              const balance = productBalance.balance || productBalance.trackedQuantity || productBalance.quantity || 0
              console.log(`ZettleAPI: ✅ Found balance for product ${productUuid}: ${balance}`)
              return balance
            }
          }
        } catch (error) {
          console.log(`ZettleAPI: Error with endpoint ${endpoint}:`, error)
          continue
        }
      }

      console.log(`ZettleAPI: No balance found for product ${productUuid} in any endpoint`)
      return 0
    } catch (error) {
      console.error(`ZettleAPI: Error getting stock for product ${productUuid}:`, error)
      return 0 // Return 0 as fallback
    }
  }

  // Add new method to get stock details using the /stock endpoint
  async getStockDetails(): Promise<Map<string, number>> {
    try {
      // Force inventory support for stock reading since movements API works
      console.log("ZettleAPI: Forcing inventory support for stock reading")
      this.inventorySupported = true

      const token = await this.getAccessToken()
      const inventoryUrl = process.env.ZETTLE_INVENTORY_URL || "https://inventory.izettletest.com"

      console.log("ZettleAPI: Fetching stock details from stock endpoint...")

      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch(`${inventoryUrl}/v3/stock`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      console.log("ZettleAPI: Stock endpoint response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("ZettleAPI: Stock endpoint error:", errorText)

        if (response.status === 401) {
          throw new Error("Authentication failed - check Zettle credentials")
        }
        if (response.status === 403 || response.status === 404 || response.status === 501) {
          console.log("ZettleAPI: Stock endpoint not supported, disabling inventory operations")
          this.inventorySupported = false
          return new Map<string, number>()
        }

        throw new Error(`Failed to fetch stock details: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const stockData = await response.json()
      console.log("ZettleAPI: Raw stock response:", JSON.stringify(stockData, null, 2))

      if (!Array.isArray(stockData)) {
        console.error("ZettleAPI: Unexpected stock response format:", stockData)
        return new Map<string, number>()
      }

      // Create a map of productUuid/variantUuid -> stock balance
      const stockMap = new Map<string, number>()

      for (const stockItem of stockData) {
        console.log("ZettleAPI: Processing stock item:", JSON.stringify(stockItem, null, 2))

        // Extract balance - try multiple possible field names
        const balance = stockItem.balance ?? stockItem.trackedQuantity ?? stockItem.quantity ?? stockItem.inStock ?? 0

        console.log("ZettleAPI: Extracted balance:", balance, "from fields:", {
          balance: stockItem.balance,
          trackedQuantity: stockItem.trackedQuantity,
          quantity: stockItem.quantity,
          inStock: stockItem.inStock,
        })

        // Map by productUuid if available
        if (stockItem.productUuid) {
          stockMap.set(stockItem.productUuid, balance)
          console.log(`ZettleAPI: Mapped stock for product ${stockItem.productUuid}: ${balance}`)
        }

        // Map by variantUuid if available
        if (stockItem.variantUuid) {
          stockMap.set(stockItem.variantUuid, balance)
          console.log(`ZettleAPI: Mapped stock for variant ${stockItem.variantUuid}: ${balance}`)
        }

        // Also try mapping by UUID field if present
        if (stockItem.uuid) {
          stockMap.set(stockItem.uuid, balance)
          console.log(`ZettleAPI: Mapped stock for UUID ${stockItem.uuid}: ${balance}`)
        }
      }

      console.log(`ZettleAPI: Successfully mapped stock for ${stockMap.size} items`)
      console.log("ZettleAPI: Complete stock map:", Array.from(stockMap.entries()))
      return stockMap
    } catch (error) {
      console.error("ZettleAPI: Error fetching stock details:", error)

      // Handle timeout specifically
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn("ZettleAPI: Stock endpoint timed out, disabling inventory operations")
        this.inventorySupported = false
      }

      // Return empty map instead of throwing to allow graceful fallback
      return new Map<string, number>()
    }
  }

  // Helper method to process products with stock details
  private async processProductsWithStock(products: ZettleProduct[]): Promise<ZettleProduct[]> {
    console.log("ZettleAPI: Processing", products.length, "products with stock details")

    // Get stock details
    const stockMap = await this.getStockDetails().catch((error) => {
      console.warn("ZettleAPI: Failed to fetch stock details, will use product data:", error.message)
      return new Map<string, number>()
    })

    // Update products with accurate stock data from /stock endpoint
    const productsWithStock = products.map((product) => {
      console.log(`ZettleAPI: Processing product ${product.name} (${product.uuid})`)

      if (product.variants && product.variants.length > 0) {
        const updatedVariants = product.variants.map((variant: any) => {
          // Try multiple approaches to get the correct stock value
          const stockFromProduct = stockMap.get(product.uuid || "")
          const stockFromVariant = stockMap.get(variant.uuid)
          const stockFromVariantInventory = variant.inventory?.inStock

          // Use the most reliable source in order of preference - prioritize variant inventory first
          // Since movements API works but /stock endpoint may fail, rely more on variant data
          const actualStock = stockFromVariantInventory ?? stockFromVariant ?? stockFromProduct ?? 0

          console.log(`ZettleAPI: Final stock decision for ${product.name}: ${actualStock} (from ${stockFromVariantInventory ? 'variant.inventory' : stockFromVariant ? 'stock API (variant)' : stockFromProduct ? 'stock API (product)' : 'default 0'})`)

          console.log(`ZettleAPI: Stock resolution for ${product.name}:`, {
            productUuid: product.uuid,
            variantUuid: variant.uuid,
            stockFromProduct,
            stockFromVariant,
            stockFromVariantInventory,
            finalStock: actualStock,
          })

          return {
            ...variant,
            inventory: {
              ...variant.inventory,
              tracked: true,
              inStock: actualStock,
            },
          }
        })

        return {
          ...product,
          variants: updatedVariants,
        }
      }

      console.log(`ZettleAPI: Product ${product.name} has no variants`)
      return product
    })

    console.log("ZettleAPI: Successfully updated ALL products with stock details")
    console.log("ZettleAPI: Final product count:", productsWithStock.length)

    return productsWithStock
  }

  // Update the getProducts method to use the v2 endpoint and stock details
  async getProducts(): Promise<ZettleProduct[]> {
    try {
      console.log("ZettleAPI: Starting getProducts with v2 endpoint and stock details...")
      const token = await this.getAccessToken()
      const productsUrl = process.env.ZETTLE_PRODUCTS_URL || "https://products.izettletest.com"

      // Use v2 endpoint for getting products
      const productsEndpoint = `${productsUrl}/organizations/self/products/v2`
      console.log("ZettleAPI: Using products endpoint:", productsEndpoint)
      console.log("ZettleAPI: Token length:", token.length)
      console.log("ZettleAPI: Products URL:", productsUrl)

      // Fetch products and stock details in parallel
      const [productsResponse, stockMap] = await Promise.all([
        fetch(productsEndpoint, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }),
        this.getStockDetails().catch((error) => {
          console.warn("ZettleAPI: Failed to fetch stock details, will use product data:", error.message)
          return new Map<string, number>()
        }),
      ])

      console.log("ZettleAPI: Products response status:", productsResponse.status)

      if (!productsResponse.ok) {
        const errorText = await productsResponse.text()
        console.error("ZettleAPI: Products error response:", errorText)

        if (productsResponse.status === 401) {
          throw new Error("Authentication failed - check Zettle credentials")
        }
        if (productsResponse.status === 403) {
          throw new Error("Access forbidden - check Zettle permissions")
        }
        if (productsResponse.status === 404) {
          throw new Error("Zettle products endpoint not found")
        }

        throw new Error(
          `Failed to fetch products: ${productsResponse.status} ${productsResponse.statusText} - ${errorText}`,
        )
      }

      const products = await productsResponse.json()
      console.log("ZettleAPI: Raw products response from Zettle - product count:", products.length)
      console.log("ZettleAPI: Product UUIDs and names:", products.map(p => ({uuid: p.uuid, name: p.name})))
      console.log("ZettleAPI: Successfully fetched ALL", products.length, "products from Zettle")
      console.log("ZettleAPI: Product names:", products.map(p => p.name))

      if (!Array.isArray(products)) {
        console.error("ZettleAPI: Unexpected products response format:", products)
        throw new Error("Products endpoint returned unexpected response format")
      }

      // Use the helper method to process products with stock
      return this.processProductsWithStock(products)
    } catch (error) {
      console.error("ZettleAPI: Error in getProducts:", error)
      throw error
    }
  }

  async getProduct(uuid: string): Promise<ZettleProduct> {
    try {
      const token = await this.getAccessToken()
      const productsUrl = process.env.ZETTLE_PRODUCTS_URL || "https://products.izettletest.com"

      console.log(`=== ZETTLE API: Getting product ${uuid} ===`)
      console.log("Products URL:", productsUrl)

      // Use v1 endpoint for getting individual product (v2 doesn't support GET)
      const getUrl = `${productsUrl}/organizations/self/products/${uuid}`
      console.log("GET URL:", getUrl)

      const response = await fetch(getUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      console.log("Get product response status:", response.status)
      console.log("Get product response headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Get product error response:", errorText)

        // Provide more specific error messages
        if (response.status === 404) {
          throw new Error(`Product with UUID ${uuid} not found in Zettle (404)`)
        }

        if (response.status === 401) {
          throw new Error(`Authentication failed - check Zettle credentials (401)`)
        }

        if (response.status === 403) {
          throw new Error(`Access forbidden - check Zettle permissions (403)`)
        }

        throw new Error(`Failed to fetch product: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const product = await response.json()
      console.log("Successfully fetched product:", product.uuid, product.name)
      return product
    } catch (error) {
      console.error("Error in getProduct:", error)
      throw error
    }
  }

  async createProduct(product: ZettleProduct): Promise<ZettleProduct> {
    try {
      const token = await this.getAccessToken()
      const productsUrl = process.env.ZETTLE_PRODUCTS_URL || "https://products.izettletest.com"

      // Generate UUID v1 if not provided
      const productWithUuid = {
        ...product,
        uuid: product.uuid || uuidv1(),
        variants: product.variants?.map((variant) => ({
          ...variant,
          uuid: variant.uuid || uuidv1(),
          inventory: {
            ...variant.inventory,
            tracked: true, // Mark as tracked (will be enabled via separate API call)
          },
        })),
      }

      console.log("=== ZETTLE API: Creating Product ===")
      console.log("Product UUID:", productWithUuid.uuid)
      console.log("Product name:", productWithUuid.name)
      console.log("Product data:", JSON.stringify(productWithUuid, null, 2))

      // Use v1 endpoint for creating products
      const createUrl = `${productsUrl}/organizations/self/products`
      console.log("Create URL:", createUrl)

      const response = await fetch(createUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productWithUuid),
      })

      console.log("Create product response status:", response.status)

      // Handle different success status codes
      if (response.status === 204) {
        console.log("Product created successfully (204 No Content)")
        return productWithUuid
      }

      if (response.status === 201 || response.status === 200) {
        const responseText = await response.text()

        if (!responseText || responseText.trim() === "") {
          console.log("Empty response body, but successful status. Returning sent data.")
          return productWithUuid
        }

        try {
          const createdProduct = JSON.parse(responseText)
          console.log("Successfully created product:", createdProduct.uuid)
          return createdProduct
        } catch (parseError) {
          console.log("Returning original product data due to parse error")
          return productWithUuid
        }
      }

      // Handle error responses
      const errorText = await response.text()
      console.error("Create product error response:", errorText)

      if (response.status === 400) {
        throw new Error(`Bad request - check product data format: ${errorText}`)
      }
      if (response.status === 401) {
        throw new Error(`Authentication failed - check Zettle credentials: ${errorText}`)
      }
      if (response.status === 403) {
        throw new Error(`Access forbidden - check Zettle permissions: ${errorText}`)
      }
      if (response.status === 422) {
        throw new Error(`Validation error - check product data: ${errorText}`)
      }

      throw new Error(`Failed to create product: ${response.status} ${response.statusText} - ${errorText}`)
    } catch (error) {
      console.error("Error in createProduct:", error)
      throw error
    }
  }

  async updateProduct(uuid: string, updates: Partial<Product>): Promise<ZettleProduct> {
    try {
      const token = await this.getAccessToken()
      const productsUrl = process.env.ZETTLE_PRODUCTS_URL || "https://products.izettletest.com"

      console.log(`=== ZETTLE API: Updating product ${uuid} ===`)
      console.log("Updates:", JSON.stringify(updates, null, 2))

      // First, get the current product to get ETag
      const currentProductResponse = await fetch(`${productsUrl}/organizations/self/products/${uuid}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (!currentProductResponse.ok) {
        const errorText = await currentProductResponse.text()
        throw new Error(`Failed to fetch current product: ${currentProductResponse.status} - ${errorText}`)
      }

      const currentProduct = await currentProductResponse.json()
      console.log("Current product:", JSON.stringify(currentProduct, null, 2))

      // Get ETag from response headers
      const etag = currentProductResponse.headers.get("etag") || currentProduct.etag
      console.log("Using ETag:", etag)

      // Prepare the updated product data
      const updatedProduct: ZettleProduct = {
        ...currentProduct,
        name: updates.name || currentProduct.name,
        description: updates.description || currentProduct.description,
      }

      // Update imageUrl if provided
      if (updates.imageUrl !== undefined) {
        updatedProduct.presentation = {
          ...updatedProduct.presentation,
          imageUrl: updates.imageUrl && (updates.imageUrl.startsWith("https://") || updates.imageUrl.startsWith("http://")) ? updates.imageUrl : undefined,
        }
      }

      // Update variant data (price and other properties)
      if (updatedProduct.variants && updatedProduct.variants.length > 0) {
        updatedProduct.variants = updatedProduct.variants.map((variant) => ({
          ...variant,
          name: updates.name || variant.name,
          description: updates.description || variant.description,
          sku: updates.sku || variant.sku,
          price:
            updates.price !== undefined
              ? {
                  amount: Math.round(updates.price * 100), // Convert to cents
                  currencyId: "USD",
                }
              : variant.price,
        }))
      }

      // Remove etag from the request body
      delete updatedProduct.etag

      console.log("Updated product data:", JSON.stringify(updatedProduct, null, 2))

      // Use v1 endpoint with PUT method for updating products (standard REST pattern)
      const updateUrl = `${productsUrl}/organizations/self/products/${uuid}`
      console.log("Update URL:", updateUrl)

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }

      // Add If-Match header if we have a valid ETag
      if (etag && etag.trim() !== "") {
        headers["If-Match"] = etag.trim()
        console.log("Adding If-Match header:", etag.trim())
      }

      const response = await fetch(updateUrl, {
        method: "PUT",
        headers,
        body: JSON.stringify(updatedProduct),
      })

      console.log("Update response status:", response.status)
      console.log("Update response headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Update product error response:", errorText)

        // Handle specific error cases
        if (response.status === 412) {
          throw new Error("Product was modified by another process. Please refresh and try again.")
        }
        if (response.status === 428) {
          throw new Error("ETag is required for product updates. Please refresh and try again.")
        }

        throw new Error(`Failed to update product: ${response.status} ${response.statusText} - ${errorText}`)
      }

      // Handle the response - Zettle might return empty body on successful update
      const responseText = await response.text()
      console.log("Update response body length:", responseText.length)
      console.log("Update response body:", responseText.substring(0, 200))

      let result: ZettleProduct
      if (!responseText || responseText.trim() === "") {
        console.log("Empty response body, using updated product data")
        result = updatedProduct
      } else {
        try {
          result = JSON.parse(responseText)
          console.log("Successfully parsed response JSON")
        } catch (parseError) {
          console.warn("Failed to parse response JSON, using updated product data:", parseError)
          result = updatedProduct
        }
      }

      console.log("Product updated successfully:", result)

      // Update stock if provided using dedicated admin inventory management function
      if (updates.stock !== undefined && updatedProduct.variants && updatedProduct.variants.length > 0) {
        const variantUuid = updatedProduct.variants[0].uuid
        if (variantUuid) {
          console.log(`🔄 ADMIN INVENTORY MANAGEMENT: Setting stock to exact value ${updates.stock}`)
          try {
            // Use the dedicated admin stock management function
            await this.setStockBalance(uuid, variantUuid, updates.stock)
            console.log(`✅ ADMIN INVENTORY: Stock successfully set to ${updates.stock}`)
          } catch (stockError) {
            console.warn("❌ ADMIN INVENTORY FAILED: Product update was successful but stock change failed:", stockError)
            // Don't throw error - product update was successful
          }
        }
      }

      // After successful update, fetch the complete updated product with inventory and stock
      console.log("Making GET request to retrieve updated product with complete details...")

      try {
        const updatedProductResponse = await fetch(`${productsUrl}/organizations/self/products/${uuid}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })

        if (updatedProductResponse.ok) {
          const completeUpdatedProduct = await updatedProductResponse.json()
          console.log("Successfully retrieved complete updated product:", completeUpdatedProduct)

          // Get fresh stock details to ensure accurate inventory data
          const stockMap = await this.getStockDetails().catch((error) => {
            console.warn("Failed to fetch fresh stock details:", error.message)
            return new Map<string, number>()
          })

          // Update the product with accurate stock data
          if (completeUpdatedProduct.variants && completeUpdatedProduct.variants.length > 0) {
            completeUpdatedProduct.variants = completeUpdatedProduct.variants.map((variant: any) => {
              const stockFromProduct = stockMap.get(completeUpdatedProduct.uuid)
              const stockFromVariant = stockMap.get(variant.uuid)
              const stockFromVariantInventory = variant.inventory?.inStock

              const actualStock = stockFromVariantInventory ?? stockFromVariant ?? stockFromProduct ?? 0

              return {
                ...variant,
                inventory: {
                  ...variant.inventory,
                  tracked: true,
                  inStock: actualStock,
                },
              }
            })
          }

          return completeUpdatedProduct
        } else {
          console.warn("Failed to fetch updated product, using update result:", updatedProductResponse.status)
          return result
        }
      } catch (getError) {
        console.warn("Error fetching updated product, using update result:", getError)
        return result
      }
    } catch (error) {
      console.error("Error in updateProduct:", error)
      throw error
    }
  }

  async deleteProduct(uuid: string): Promise<void> {
    try {
      const token = await this.getAccessToken()
      const productsUrl = process.env.ZETTLE_PRODUCTS_URL || "https://products.izettletest.com"

      console.log(`Deleting product ${uuid} using v1 endpoint`)

      // Use v1 endpoint for deleting product (more reliable)
      const response = await fetch(`${productsUrl}/organizations/self/products/${uuid}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Delete product error response:", errorText)
        throw new Error(`Failed to delete product: ${response.status} ${response.statusText} - ${errorText}`)
      }

      console.log("Successfully deleted product:", uuid)
    } catch (error) {
      console.error("Error in deleteProduct:", error)
      throw error
    }
  }
}

export const zettleAPI = new ZettleAPI()

// Utility function to enable tracking for all products that don't have it enabled
export async function enableTrackingForAllProducts(): Promise<void> {
  try {
    console.log("=== ENABLE TRACKING FOR ALL PRODUCTS ===")

    // Get all products
    const products = await zettleAPI.getProducts()
    console.log(`Found ${products.length} products to check for tracking`)

    // Filter products that might need tracking enabled
    const productUuids = products.map(product => product.uuid).filter((uuid): uuid is string => Boolean(uuid))

    if (productUuids.length > 0) {
      console.log(`Enabling tracking for ${productUuids.length} products...`)
      await zettleAPI.enableInventoryTrackingBatch(productUuids)
      console.log("✅ Tracking enablement completed")
    } else {
      console.log("No products found to enable tracking for")
    }
  } catch (error) {
    console.error("Error enabling tracking for all products:", error)
    throw error
  }
}

// Helper function to convert Zettle product to our Product type with deterministic stock extraction
export function convertZettleProduct(zettleProduct: ZettleProduct, stockOverride?: number): Product {
  console.log("=== ZETTLE TO PRODUCT CONVERSION START ===")
  console.log("Raw Zettle product input:", JSON.stringify(zettleProduct, null, 2))

  const variant = zettleProduct.variants?.[0]
  console.log("First variant found:", JSON.stringify(variant, null, 2))

  // Use stock override if provided (from cache), otherwise extract deterministically
  let stock = stockOverride ?? 0

  if (stockOverride === undefined && variant) {
    console.log("=== DETERMINISTIC STOCK EXTRACTION ===")

    // Priority order for stock extraction (most reliable first)
    const stockSources = [
      { name: "inventory.inStock", value: variant.inventory?.inStock },
      { name: "inventory.trackedQuantity", value: variant.inventory?.trackedQuantity },
      { name: "inventory.balance", value: variant.inventory?.balance },
      { name: "inventory.quantity", value: variant.inventory?.quantity },
    ]

    for (const source of stockSources) {
      const value = source.value
      console.log(`Checking ${source.name}:`, value, typeof value)

      if (value !== undefined && value !== null) {
        if (typeof value === "number" && !isNaN(value) && value >= 0) {
          stock = Math.floor(value)
          console.log(`SUCCESS - Using ${source.name}:`, stock)
          break
        } else if (typeof value === "string") {
          const parsed = Number.parseInt(value, 10)
          if (!isNaN(parsed) && parsed >= 0) {
            stock = parsed
            console.log(`SUCCESS - Parsed string ${source.name}:`, stock)
            break
          }
        }
      }
    }

    // Only use fallback if no inventory data exists at all
    if (stock === 0 && !variant.inventory) {
      stock = 12
      console.log("FALLBACK - Using default stock value:", stock)
    }
  } else if (stockOverride !== undefined) {
    console.log("Using stock override from cache:", stockOverride)
  }

  // Extract price
  const priceInCents = variant?.price?.amount || 0
  const priceInDollars = priceInCents / 100

  console.log("Price extraction:", {
    priceInCents,
    priceInDollars,
    calculation: `${priceInCents} / 100 = ${priceInDollars}`,
  })

  // Extract SKU - prefer actual SKU, then UUID, then generate one
  const sku = variant?.sku || zettleProduct.uuid || `SKU-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`

  const finalProduct: Product = {
    uuid: zettleProduct.uuid || "",
    name: zettleProduct.name,
    description: zettleProduct.description || "",
    price: priceInDollars,
    stock: stock,
    imageUrl: zettleProduct.presentation?.imageUrl || "/placeholder.svg?width=400&height=400",
    sku: sku,
    tracked: variant?.inventory?.tracked || true,
  }

  console.log("=== CONVERSION COMPLETE ===")
  console.log("Final product:", JSON.stringify(finalProduct, null, 2))
  console.log("=== ZETTLE TO PRODUCT CONVERSION END ===")

  return finalProduct
}

// Helper function to convert our Product type to Zettle product
export function convertToZettleProduct(product: Omit<Product, "uuid">, existingUuid?: string): ZettleProduct {
  console.log("=== PRODUCT TO ZETTLE CONVERSION START ===")
  console.log("Input product data:", JSON.stringify(product, null, 2))

  const productUuid = existingUuid || uuidv1()
  const variantUuid = uuidv1()

  // Ensure stock is a valid integer
  let validStock = 0

  if (typeof product.stock === "number" && !isNaN(product.stock) && product.stock >= 0) {
    validStock = Math.floor(product.stock)
  } else if (typeof product.stock === "string") {
    const parsed = Number.parseInt(product.stock, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      validStock = parsed
    }
  }

  console.log("Stock processing:", {
    inputStock: product.stock,
    inputStockType: typeof product.stock,
    validStock: validStock,
    validStockType: typeof validStock,
    wasModified: product.stock !== validStock,
  })

  const zettleProduct: ZettleProduct = {
    uuid: productUuid,
    name: product.name,
    description: product.description || `Premium quality ${product.name}`,
    presentation: {
      // Include imageUrl if it's a valid HTTP/HTTPS URL (Zettle URLs can be HTTP in test environment)
      ...(product.imageUrl && (product.imageUrl.startsWith("https://") || product.imageUrl.startsWith("http://")) ? { imageUrl: product.imageUrl } : {}),
      backgroundColor: "#dc2626", // Red theme
      textColor: "#ffffff",
    },
    variants: [
      {
        uuid: variantUuid,
        name: product.name,
        description: `Premium ${product.name}`,
        sku: product.sku || `SKU-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        price: {
          amount: Math.round(product.price * 100), // Convert to cents
          currencyId: "USD",
        },
        inventory: {
          tracked: true, // Mark as tracked (will be enabled via separate API call)
          // Don't set inStock during creation - use separate API call
          lowStock: 5,
        },
      },
    ],
  }

  console.log("Created Zettle product:", JSON.stringify(zettleProduct, null, 2))
  console.log("=== PRODUCT TO ZETTLE CONVERSION END ===")

  return zettleProduct
}

// Helper functions for the API routes with caching
export async function getZettleProducts(): Promise<Product[]> {
  try {
    console.log("=== getZettleProducts: Starting ===")
    console.log("getZettleProducts: Call timestamp:", new Date().toISOString())

    // Check if Zettle is configured
    if (!isZettleConfigured()) {
      console.log("getZettleProducts: Zettle not configured, returning demo products")
      return FALLBACK_PRODUCTS
    }

    // Check cache first
    if (zettleAPI.isCacheValidPublic()) {
      const cachedProducts = zettleAPI.getCachedProducts()
      console.log("getZettleProducts: Returning cached products, count:", cachedProducts.length)
      console.log("getZettleProducts: Cached product names:", cachedProducts.map(p => p.name))
      return cachedProducts
    }

    console.log("getZettleProducts: Zettle configured, fetching from API...")

    // Don't reset auth state on every call - only if there was an actual failure
    // zettleAPI.resetAuthState()
    console.log("getZettleProducts: Using existing auth state")

    const zettleProducts = await zettleAPI.getProducts()
    console.log("getZettleProducts: Fetched", zettleProducts.length, "products from Zettle")
    console.log("getZettleProducts: Raw Zettle product names:", zettleProducts.map(p => p.name))

    // Get stock details once for all products to ensure consistency
    const stockMap = await zettleAPI.getStockDetails().catch((error) => {
      console.warn("getZettleProducts: Failed to fetch stock details:", error.message)
      return new Map<string, number>()
    })

    const products = zettleProducts.map((zettleProduct, index) => {
      console.log(`getZettleProducts: Converting product ${index + 1}/${zettleProducts.length}:`, zettleProduct.name)

      // Get consistent stock value from stock map
      const variant = zettleProduct.variants?.[0]
      const stockFromProduct = stockMap.get(zettleProduct.uuid || "")
      const stockFromVariant = variant?.uuid ? stockMap.get(variant.uuid) : undefined
      const stockFromVariantInventory = variant?.inventory?.inStock

      // Use the most reliable source in priority order
      const consistentStock = stockFromVariantInventory ?? stockFromVariant ?? stockFromProduct

      const product = convertZettleProduct(zettleProduct, consistentStock)
      console.log(`getZettleProducts: Converted product ${index + 1} with stock ${product.stock}`)
      return product
    })

    // Cache the results
    zettleAPI.productCache.clear()
    products.forEach(product => {
      zettleAPI.productCache.set(product.uuid, product)
    })
    zettleAPI.cacheExpiry = Date.now() + zettleAPI.CACHE_DURATION

    console.log("getZettleProducts: Successfully converted and cached all products")
    console.log("getZettleProducts: Final product names being returned:", products.map(p => p.name))
    console.log("getZettleProducts: Final product count:", products.length)
    return products
  } catch (error) {
    console.error("getZettleProducts: Error:", error)
    // When using real API credentials, throw the error instead of falling back
    if (isZettleConfigured()) {
      throw error
    }
    return FALLBACK_PRODUCTS
  }
}

export async function getZettleProduct(uuid: string): Promise<Product | null> {
  try {
    console.log(`=== getZettleProduct: Getting ${uuid} ===`)

    // Check if it's a demo product
    if (uuid.startsWith("demo-") || uuid.startsWith("fallback-")) {
      const demoProduct = FALLBACK_PRODUCTS.find((p) => p.uuid === uuid)
      return demoProduct || null
    }

    if (!isZettleConfigured()) {
      console.log("getZettleProduct: Zettle not configured")
      return null
    }

    const zettleProduct = await zettleAPI.getProduct(uuid)
    return convertZettleProduct(zettleProduct)
  } catch (error) {
    console.error("getZettleProduct: Error:", error)
    return null
  }
}

export async function createZettleProduct(productData: Omit<Product, "uuid">): Promise<Product> {
  try {
    console.log("=== createZettleProduct: Starting ===")
    console.log("createZettleProduct: Input data:", JSON.stringify(productData, null, 2))

    if (!isZettleConfigured()) {
      console.log("createZettleProduct: Zettle not configured, creating demo product")

      // Create a demo product
      const demoProduct: Product = {
        uuid: `demo-${Date.now()}`,
        ...productData,
        sku: productData.sku || `SKU-DEMO-${Date.now()}`,
        tracked: true,
      }

      console.log("createZettleProduct: Created demo product:", JSON.stringify(demoProduct, null, 2))
      return demoProduct
    }

    console.log("createZettleProduct: Zettle configured, creating via API...")

    // Handle image upload to Zettle if imageUrl is provided and is a local URL
    let zettleImageUrl: string | undefined = productData.imageUrl

    if (productData.imageUrl && productData.imageUrl.startsWith("/uploads/")) {
      console.log("createZettleProduct: Local image detected, attempting Zettle upload...")
      const fullImageUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${productData.imageUrl}`
      const uploadedImageUrl = await zettleAPI.uploadImageToZettle(fullImageUrl)

      if (uploadedImageUrl) {
        zettleImageUrl = uploadedImageUrl
        console.log("createZettleProduct: ✅ Image uploaded to Zettle successfully:", zettleImageUrl)
      } else {
        console.warn("createZettleProduct: ⚠️ Image upload to Zettle failed or skipped")
        console.warn("createZettleProduct: Local images require publicly accessible URLs for Zettle")
        console.warn("createZettleProduct: Product will be created without Zettle-hosted image")
        zettleImageUrl = undefined
      }
    }

    // Create product with Zettle image URL
    const productDataWithZettleImage = {
      ...productData,
      imageUrl: zettleImageUrl
    }

    const zettleProduct = convertToZettleProduct(productDataWithZettleImage)
    const createdZettleProduct = await zettleAPI.createProduct(zettleProduct)

    // Create the product first
    const finalProduct = convertZettleProduct(createdZettleProduct)

    // Always try to set stock after creation using separate API call
    if (createdZettleProduct.variants && createdZettleProduct.variants.length > 0) {
      const variantUuid = createdZettleProduct.variants[0].uuid
      console.log("createZettleProduct: Found variant UUID:", variantUuid)

      if (variantUuid) {
        console.log(`Setting initial stock to ${productData.stock} for new product via updateStock API`)

        // First, enable inventory tracking for the product using the official API
        await zettleAPI.enableInventoryTracking(finalProduct.uuid)

        // Wait a moment for tracking to be fully enabled
        console.log("ZettleAPI: Waiting 3 seconds for tracking to be enabled...")
        await new Promise(resolve => setTimeout(resolve, 3000))

        try {
          // Set initial stock using movements API
          if (productData.stock > 0) {
            await zettleAPI.createStockMovement(finalProduct.uuid, variantUuid, productData.stock, "INITIAL_STOCK")
            console.log(`✅ STOCK UPDATE SUCCESS: Set initial stock to ${productData.stock} via movements API`)
            // Set stock in response to indicate success
            finalProduct.stock = productData.stock
          }
        } catch (stockError) {
          console.error(`❌ STOCK UPDATE FAILED: Could not set stock to ${productData.stock}:`, stockError)
          // Don't throw error - product creation was successful
        }
      }
    }

    // Clear cache to force refresh on next request
    zettleAPI.clearProductCache()

    console.log("createZettleProduct: Successfully created product:", JSON.stringify(finalProduct, null, 2))
    return finalProduct
  } catch (error) {
    console.error("createZettleProduct: Error:", error)
    throw error
  }
}

export async function updateZettleProduct(uuid: string, updates: Partial<Product>): Promise<Product> {
  try {
    console.log(`=== updateZettleProduct: Updating ${uuid} ===`)
    console.log("Updates:", JSON.stringify(updates, null, 2))

    // Handle demo products
    if (uuid.startsWith("demo-") || uuid.startsWith("fallback-")) {
      console.log("updateZettleProduct: Updating demo product")
      const existingProductIndex = FALLBACK_PRODUCTS.findIndex((p) => p.uuid === uuid)
      if (existingProductIndex === -1) {
        throw new Error("Demo product not found")
      }

      const updatedProduct: Product = {
        ...FALLBACK_PRODUCTS[existingProductIndex],
        ...updates,
        uuid: FALLBACK_PRODUCTS[existingProductIndex].uuid, // Preserve UUID
      }

      // Update the fallback products array
      FALLBACK_PRODUCTS[existingProductIndex] = updatedProduct

      console.log("updateZettleProduct: Updated demo product:", JSON.stringify(updatedProduct, null, 2))
      return updatedProduct
    }

    if (!isZettleConfigured()) {
      throw new Error("Zettle not configured")
    }

    // Handle image upload to Zettle if imageUrl is provided and is a local URL
    let updatesWithZettleImage = { ...updates }

    if (updates.imageUrl && updates.imageUrl.startsWith("/uploads/")) {
      console.log("updateZettleProduct: Local image detected, attempting Zettle upload...")
      const fullImageUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${updates.imageUrl}`
      const uploadedImageUrl = await zettleAPI.uploadImageToZettle(fullImageUrl)

      if (uploadedImageUrl) {
        updatesWithZettleImage.imageUrl = uploadedImageUrl
        console.log("updateZettleProduct: ✅ Image uploaded to Zettle successfully:", uploadedImageUrl)
      } else {
        console.warn("updateZettleProduct: ⚠️ Image upload to Zettle failed or skipped")
        console.warn("updateZettleProduct: Local images require publicly accessible URLs for Zettle")
        console.warn("updateZettleProduct: Keeping original image in product")
        // Don't update the image if upload fails
        delete updatesWithZettleImage.imageUrl
      }
    }

    const updatedZettleProduct = await zettleAPI.updateProduct(uuid, updatesWithZettleImage)
    const finalProduct = convertZettleProduct(updatedZettleProduct)

    // Clear cache to force refresh on next request
    zettleAPI.clearProductCache()

    console.log("updateZettleProduct: Successfully updated product:", JSON.stringify(finalProduct, null, 2))
    return finalProduct
  } catch (error) {
    console.error("updateZettleProduct: Error:", error)
    throw error
  }
}

export async function deleteZettleProduct(uuid: string): Promise<boolean> {
  try {
    console.log(`=== deleteZettleProduct: Deleting ${uuid} ===`)

    // Handle demo products
    if (uuid.startsWith("demo-") || uuid.startsWith("fallback-")) {
      console.log("deleteZettleProduct: Cannot delete demo product")
      return true // Pretend it worked
    }

    if (!isZettleConfigured()) {
      throw new Error("Zettle not configured")
    }

    await zettleAPI.deleteProduct(uuid)

    // Clear cache to force refresh on next request
    zettleAPI.clearProductCache()

    console.log("deleteZettleProduct: Successfully deleted product")
    return true
  } catch (error) {
    console.error("deleteZettleProduct: Error:", error)
    throw error
  }
}
