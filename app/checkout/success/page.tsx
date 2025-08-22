"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/uicomponents/ui/card"
import { Button } from "@/uicomponents/ui/button"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { useCart } from "@/hooks/use-cart"
import { useToast } from "@/uicomponents/ui/use-toast"
import { ClientOnly } from "@/uicomponents/client-only"
import Link from "next/link"

function PayPalSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { clearCart } = useCart()
  const { toast } = useToast()
  
  const [isProcessing, setIsProcessing] = useState(true)
  const [isSuccess, setIsSuccess] = useState(false)
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasProcessed, setHasProcessed] = useState(false)

  useEffect(() => {
    // Only run on client side to prevent hydration mismatches
    if (typeof window === 'undefined') {
      return
    }

    // Prevent multiple executions
    if (hasProcessed) {
      return
    }

    const processPayPalReturn = async () => {
      try {
        const token = searchParams.get('token')
        const PayerID = searchParams.get('PayerID')
        
        if (!token) {
          throw new Error("No PayPal token found")
        }

        console.log("Processing PayPal return with token:", token)
        
        // Mark as processed immediately to prevent multiple calls
        setHasProcessed(true)
        
        // Capture the PayPal payment
        const captureResponse = await fetch(`/api/paypal/orders/${token}/capture`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        })

        if (!captureResponse.ok) {
          const errorData = await captureResponse.json()
          throw new Error(errorData.message || "Failed to capture payment")
        }

        const captureData = await captureResponse.json()
        console.log("Payment captured successfully:", captureData)

        // Get stored order items from sessionStorage
        const storedItems = sessionStorage.getItem('pendingOrderItems')
        const items = storedItems ? JSON.parse(storedItems) : []

        // Generate consistent IDs
        const timestamp = Date.now()
        const orderDetails = {
          id: `order_${timestamp}`,
          orderId: captureData.orderID,
          paymentId: captureData.orderID,
          items: items,
          timestamp: new Date(timestamp).toISOString(),
          status: 'completed',
          amount: items.reduce((total: number, item: any) => total + (item.price * item.quantity), 0) * 1.08, // Include tax
        }

        setOrderDetails(orderDetails)

        // Store order in localStorage for orders page
        try {
          const existingOrders = localStorage.getItem('userOrders')
          const orders = existingOrders ? JSON.parse(existingOrders) : []
          
          // Check if this order already exists to prevent duplicates
          const orderExists = orders.some((order: any) => 
            order.orderId === orderDetails.orderId || 
            order.paymentId === orderDetails.paymentId
          )
          
          if (!orderExists) {
            orders.unshift(orderDetails) // Add new order at the beginning
            localStorage.setItem('userOrders', JSON.stringify(orders))
            console.log("Order stored successfully:", orderDetails.orderId)
          } else {
            console.log("Order already exists, skipping duplicate:", orderDetails.orderId)
          }
        } catch (error) {
          console.warn('Failed to store order in localStorage:', error)
        }

        // Clear the cart and stored data
        clearCart()
        sessionStorage.removeItem('pendingPayPalOrder')
        sessionStorage.removeItem('pendingOrderItems')

        setIsSuccess(true)
        
        toast({
          title: "Payment Successful!",
          description: "Your order has been processed successfully.",
        })

      } catch (error) {
        console.error("Error processing PayPal return:", error)
        setError(error instanceof Error ? error.message : "Unknown error occurred")
        setHasProcessed(false) // Reset on error so user can try again
        
        toast({
          title: "Payment Error",
          description: "There was an issue processing your payment.",
          variant: "destructive",
        })
      } finally {
        setIsProcessing(false)
      }
    }

    processPayPalReturn()
  }, [searchParams, clearCart, toast, hasProcessed])

  if (isProcessing) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="text-center py-12">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-600" />
            <h2 className="text-2xl font-semibold mb-2">Processing your payment...</h2>
            <p className="text-muted-foreground">Please wait while we confirm your PayPal payment.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-red-600" />
            <CardTitle className="text-2xl text-red-600">Payment Failed</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <div className="flex gap-4 justify-center">
              <Button asChild>
                <Link href="/checkout">Try Again</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Continue Shopping</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isSuccess && orderDetails) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
            <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center text-muted-foreground">
              <p>Thank you for your payment. Your order has been processed successfully.</p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="font-medium">Order ID:</span>
                <span className="font-mono text-sm">{orderDetails.orderId}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Payment ID:</span>
                <span className="font-mono text-sm">{orderDetails.paymentId}</span>
              </div>
            </div>

            {orderDetails.items && orderDetails.items.length > 0 && (
              <>
                <hr />
                <div>
                  <h3 className="font-medium mb-2">Order Items:</h3>
                  <div className="space-y-2">
                    {orderDetails.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>
                          {item.name} × {item.quantity}
                        </span>
                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="flex gap-4 pt-4">
              <Button asChild className="flex-1">
                <Link href="/">Continue Shopping</Link>
              </Button>
              <Button variant="outline" asChild className="flex-1">
                <Link href="/orders">View Orders</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}

export default function PayPalSuccessPage() {
  return (
    <ClientOnly fallback={
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardContent className="text-center py-12">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-600" />
            <h2 className="text-2xl font-semibold mb-2">Processing Payment...</h2>
            <p className="text-muted-foreground">Please wait while we confirm your PayPal payment.</p>
          </CardContent>
        </Card>
      </div>
    }>
      <Suspense fallback={
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card>
            <CardContent className="text-center py-12">
              <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-600" />
              <h2 className="text-2xl font-semibold mb-2">Processing Payment...</h2>
              <p className="text-muted-foreground">Please wait while we confirm your PayPal payment.</p>
            </CardContent>
          </Card>
        </div>
      }>
        <PayPalSuccessContent />
      </Suspense>
    </ClientOnly>
  )
}
