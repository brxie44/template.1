import { type NextRequest, NextResponse } from "next/server"
import { paypal } from "@/lib/paypal"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { items, total, totalWithTax, tax } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No items provided" }, { status: 400 })
    }

    // Get the base URL from the request
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host')
    const baseUrl = host ? `${protocol}://${host}` : undefined

    console.log("PayPal Order API: Detected base URL:", baseUrl)

    // Use provided total with tax, or calculate as fallback
    const subtotal = total || items.reduce((sum: number, item: any) => {
      return sum + item.price * item.quantity
    }, 0)
    
    const taxAmount = tax || (subtotal * 0.08)
    const finalTotal = totalWithTax || (subtotal + taxAmount)

    console.log("Creating PayPal order with items:", items)
    console.log("Subtotal:", subtotal.toFixed(2))
    console.log("Tax:", taxAmount.toFixed(2))
    console.log("Total with tax:", finalTotal.toFixed(2))

    const order = await paypal.createOrder(finalTotal.toFixed(2), items, {
      subtotal: subtotal.toFixed(2),
      tax: taxAmount.toFixed(2)
    }, baseUrl)
    
    console.log("PayPal order created successfully:", order.id)
    return NextResponse.json(order)
  } catch (error) {
    console.error("Error creating PayPal order:", error)
    return NextResponse.json({ 
      error: "Failed to create order",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}
