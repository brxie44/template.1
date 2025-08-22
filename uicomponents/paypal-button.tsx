"use client"

import { useState } from "react"
import { Button } from "@/uicomponents/ui/button"
import { useToast } from "@/uicomponents/ui/use-toast"
import { Loader2, CreditCard } from "lucide-react"

interface PayPalButtonProps {
  items: any[]
  total: number
  onSuccess?: () => void
  onError?: (error: any) => void
  className?: string
  size?: "sm" | "default" | "lg"
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  disabled?: boolean
  validateForm?: () => boolean
}

export function PayPalButton({ 
  items, 
  total, 
  onSuccess, 
  onError, 
  className = "",
  size = "default",
  variant = "default",
  disabled = false,
  validateForm
}: PayPalButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handlePayPalPayment = async () => {
    if (disabled || items.length === 0) {
      toast({
        title: "Cart Empty",
        description: "Add some items to your cart before checking out.",
        variant: "destructive",
      })
      return
    }

    // Validate form if validation function is provided
    if (validateForm && !validateForm()) {
      return
    }

    setIsLoading(true)
    try {
      // Create PayPal order with cart items and tax
      const subtotal = total
      const tax = total * 0.08
      const totalWithTax = total * 1.08

      const orderResponse = await fetch("/api/paypal/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: items.map(item => {
            const mappedItem = {
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              sku: item.sku || item.uuid,
              uuid: item.uuid
            }
            console.log("PayPal button: Mapping cart item:", {
              original: { name: item.name, sku: item.sku, uuid: item.uuid },
              mapped: mappedItem
            })
            return mappedItem
          }),
          total: subtotal,
          totalWithTax: totalWithTax,
          tax: tax
        }),
      })

      if (!orderResponse.ok) {
        throw new Error("Failed to create PayPal order")
      }

      const orderData = await orderResponse.json()

      // Redirect to PayPal for approval
      const approvalUrl = orderData.links?.find((link: any) => link.rel === "approve")?.href

      if (approvalUrl) {
        // Store order ID and items in sessionStorage for when user returns
        sessionStorage.setItem('pendingPayPalOrder', orderData.id)
        sessionStorage.setItem('pendingOrderItems', JSON.stringify(items))
        
        // Redirect to PayPal
        window.location.href = approvalUrl
      } else {
        throw new Error("No approval URL found")
      }
    } catch (error) {
      console.error("PayPal payment error:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
      
      toast({
        title: "Payment Error",
        description: `There was an issue processing your payment: ${errorMessage}`,
        variant: "destructive",
      })
      
      if (onError) {
        onError(error)
      }
      
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handlePayPalPayment}
      disabled={isLoading || disabled || items.length === 0}
      className={`bg-[#0070ba] hover:bg-[#005ea6] text-white ${className}`}
      size={size}
      variant={variant}
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        <>
          <CreditCard className="mr-2 h-4 w-4" />
          PayPal
        </>
      )}
    </Button>
  )
}
