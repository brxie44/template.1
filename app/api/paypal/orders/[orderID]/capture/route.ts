import { NextResponse } from "next/server"
import { paypal } from "@/lib/paypal"

// Track processed orders to prevent duplicate inventory updates
const processedOrders = new Set<string>()

export async function POST(request: Request, { params }: { params: { orderID: string } }) {
  try {
    const { orderID } = params
    console.log("🔍 Capturing PayPal order:", orderID)
    
    // Check if this order has already been processed for inventory updates
    if (processedOrders.has(orderID)) {
      console.log("🚫 Order already processed for inventory updates, skipping duplicate processing")
      return NextResponse.json({
        success: true,
        orderID: orderID,
        status: "COMPLETED",
        message: "Order already processed",
      })
    }

    // First check if order is already captured to prevent duplicate processing
    const { paypal: paypalClient } = await import("@/lib/paypal")
    const orderDetails = await paypalClient.getOrder(orderID)
    
    console.log("Order status before capture:", orderDetails.status)
    
    // If order is already captured, return success without processing inventory again
    if (orderDetails.status === "COMPLETED") {
      console.log("Order already captured, skipping duplicate processing")
      return NextResponse.json({
        success: true,
        orderID: orderID,
        status: "COMPLETED",
        message: "Order already captured",
      })
    }

    // Capture the PayPal order
    const captureData = await paypal.captureOrder(orderID)
    console.log("PayPal capture successful:", captureData.id)

    // Get updated order details after capture
    const updatedOrderDetails = await paypalClient.getOrder(orderID)
    
    console.log("Updated order details:", JSON.stringify(updatedOrderDetails, null, 2))

    // Extract items from the order details
    const purchaseUnits = updatedOrderDetails.purchase_units || []
    const paypalItems = purchaseUnits.flatMap((unit: any) => unit.items || [])

    console.log("Processing inventory updates for", paypalItems.length, "PayPal items")
    
    // Mark this order as being processed to prevent duplicate inventory updates
    processedOrders.add(orderID)
    console.log("🔒 Marked order as processing:", orderID)
    
    // Track products already processed in this order to prevent duplicates within the same order
    const processedProductsInOrder = new Set<string>()

    // Update inventory for each purchased item
    for (const item of paypalItems) {
      try {
        const quantity = Number.parseInt(item.quantity) || 1
        
        // Try to extract UUID from SKU field - could be either SKU or UUID
        let productUuid = item.sku
        
        console.log(`🔍 Processing item: ${item.name}, SKU: ${item.sku}, Raw Quantity: ${item.quantity}, Parsed Quantity: ${quantity}`)
        console.log(`🔍 Full item data:`, JSON.stringify(item, null, 2))
        
        // Check if we've already processed this product in this order
        const productKey = `${item.sku || item.name}-${quantity}`
        if (processedProductsInOrder.has(productKey)) {
          console.log(`🚫 DUPLICATE PRODUCT IN ORDER: ${productKey} already processed, skipping`)
          continue
        }
        processedProductsInOrder.add(productKey)
        
        // If SKU is undefined or null, try to find product by name
        if (!productUuid || productUuid === "undefined" || productUuid === "null") {
          console.log(`SKU is undefined for ${item.name}, searching by product name...`)
          try {
            const { getZettleProducts } = await import("@/lib/zettle")
            const allProducts = await getZettleProducts()
            const foundProduct = allProducts.find(p => p.name.toLowerCase() === item.name.toLowerCase())
            
            if (foundProduct) {
              productUuid = foundProduct.uuid
              console.log(`Found product by name: ${foundProduct.name} -> UUID: ${productUuid}`)
            } else {
              console.warn(`❌ Could not find product by name: ${item.name}`)
              continue // Skip this item
            }
          } catch (error) {
            console.warn(`Failed to search products by name ${item.name}:`, error)
            continue // Skip this item
          }
        }
        
        // Check if SKU looks like a UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const isUuid = uuidRegex.test(productUuid)
        
        console.log(`Product UUID determined: ${productUuid}, Is UUID format: ${isUuid}`)

        if (productUuid && productUuid !== "shipping") {
          // Check if Zettle is configured
          const { isZettleConfigured } = await import("@/lib/zettle")
          if (isZettleConfigured()) {
            try {
              const { zettleAPI } = await import("@/lib/zettle")

              let product = null
              let variantUuid = null

              if (isUuid) {
                // SKU is actually a UUID, try to get product directly
                console.log(`Treating SKU as UUID: ${productUuid}`)
                try {
                  product = await zettleAPI.getProduct(productUuid)
                  variantUuid = product.variants?.[0]?.uuid
                } catch (error) {
                  console.warn(`Failed to get product by UUID ${productUuid}:`, error)
                }
              }
              
              // If we couldn't get the product by UUID, try to find it by SKU
              if (!product) {
                console.log(`Searching for product by SKU: ${productUuid}`)
                try {
                  const { getZettleProducts } = await import("@/lib/zettle")
                  const allProducts = await getZettleProducts()
                  const foundProduct = allProducts.find(p => p.sku === productUuid)
                  
                  if (foundProduct) {
                    console.log(`Found product by SKU: ${foundProduct.uuid}`)
                    product = await zettleAPI.getProduct(foundProduct.uuid)
                    variantUuid = product.variants?.[0]?.uuid
                    productUuid = foundProduct.uuid // Update to use the actual UUID
                  }
                } catch (error) {
                  console.warn(`Failed to search products by SKU ${productUuid}:`, error)
                }
              }

              if (product && variantUuid) {
                console.log(`🔥 INVENTORY UPDATE: Reducing inventory for product ${productUuid} (variant: ${variantUuid}) by ${quantity}`)
                console.log(`🔥 Before adjustment - calling adjustInventory with quantity: ${-quantity}`)
                
                // Reduce inventory by the purchased quantity
                await zettleAPI.adjustInventory(productUuid, variantUuid, -quantity)
                
                console.log(`✅ Successfully reduced inventory for ${productUuid} by ${quantity}`)
                
                // Clear cache to ensure fresh stock data
                console.log(`🧹 Clearing product cache after inventory update`)
                zettleAPI.clearProductCache()
                
                // Clear movement tracking after successful update
                console.log(`🧹 Clearing movement tracking after successful update`)
                zettleAPI.clearMovementTracking()
              } else {
                console.warn(`❌ Could not find product or variant for SKU/UUID: ${item.sku}`)
              }
            } catch (inventoryError) {
              console.error(`❌ Failed to update inventory for ${productUuid}:`, inventoryError)
              // Continue processing other items even if one fails
            }
          } else {
            console.log("Zettle not configured, skipping inventory update")
          }
        }
      } catch (itemError) {
        console.error("Error processing item:", item, itemError)
        // Continue processing other items
      }
    }

    return NextResponse.json({
      success: true,
      orderID: captureData.id,
      status: captureData.status,
      message: "Order captured successfully",
    })
  } catch (error) {
    console.error("Failed to capture PayPal order:", error)
    
    // Remove from processed orders if there was an error, allowing retry
    processedOrders.delete(orderID)
    console.log("🔓 Removed order from processing due to error:", orderID)
    
    return NextResponse.json(
      {
        error: "Failed to capture order",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
