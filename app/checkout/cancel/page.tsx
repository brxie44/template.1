"use client"

import { useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/uicomponents/ui/card"
import { Button } from "@/uicomponents/ui/button"
import { XCircle } from "lucide-react"
import { useToast } from "@/uicomponents/ui/use-toast"
import Link from "next/link"

export default function PayPalCancelPage() {
  const { toast } = useToast()

  useEffect(() => {
    // Clean up any stored PayPal data
    sessionStorage.removeItem('pendingPayPalOrder')
    sessionStorage.removeItem('pendingOrderItems')
    
    toast({
      title: "Payment Cancelled",
      description: "Your PayPal payment was cancelled. You can try again anytime.",
      variant: "destructive",
    })
  }, [toast])

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card>
        <CardHeader className="text-center">
          <XCircle className="h-12 w-12 mx-auto mb-4 text-orange-600" />
          <CardTitle className="text-2xl text-orange-600">Payment Cancelled</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div>
            <p className="text-muted-foreground mb-2">
              Your PayPal payment was cancelled and no charges were made.
            </p>
            <p className="text-muted-foreground">
              Your cart items are still saved and you can complete your purchase anytime.
            </p>
          </div>

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
