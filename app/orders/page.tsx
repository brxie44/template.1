"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/uicomponents/ui/card"
import { Button } from "@/uicomponents/ui/button"
import { Badge } from "@/uicomponents/ui/badge"
import { Separator } from "@/uicomponents/ui/separator"
import { Package, Calendar, CreditCard, ArrowLeft } from "lucide-react"
import Link from "next/link"

interface OrderItem {
  name: string
  quantity: number
  price: number
  sku?: string
}

interface Order {
  id: string
  orderId: string
  paymentId: string
  amount: number
  status: string
  items: OrderItem[]
  timestamp: string
  customer?: {
    firstName: string
    lastName: string
    email: string
    address: string
    city: string
    state: string
    zipCode: string
  }
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load orders from localStorage and clean up duplicates
    const loadOrders = () => {
      try {
        const storedOrders = localStorage.getItem('userOrders')
        if (storedOrders) {
          const parsedOrders = JSON.parse(storedOrders)
          
          // Clean up duplicates based on orderId or paymentId
          const uniqueOrders = parsedOrders.reduce((acc: Order[], order: Order) => {
            const exists = acc.find(o => 
              o.orderId === order.orderId || 
              o.paymentId === order.paymentId ||
              o.id === order.id
            )
            if (!exists) {
              acc.push(order)
            }
            return acc
          }, [])
          
          // If we found duplicates, save the cleaned up version
          if (uniqueOrders.length !== parsedOrders.length) {
            console.log(`Cleaned up ${parsedOrders.length - uniqueOrders.length} duplicate orders`)
            localStorage.setItem('userOrders', JSON.stringify(uniqueOrders))
          }
          
          setOrders(uniqueOrders)
        }
      } catch (error) {
        console.error('Error loading orders:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadOrders()
  }, [])

  const formatDate = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return timestamp
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center">
          <p>Loading your orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Store
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Your Orders</h1>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-semibold mb-2">No orders yet</h2>
            <p className="text-muted-foreground mb-6">
              You haven't placed any orders yet. Start shopping to see your orders here.
            </p>
            <Button asChild>
              <Link href="/">Start Shopping</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">Order #{order.orderId}</CardTitle>
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(order.timestamp)}
                      </div>
                      <div className="flex items-center gap-1">
                        <CreditCard className="h-4 w-4" />
                        {order.paymentId}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                    <div className="text-lg font-semibold mt-1">
                      ${order.amount.toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Items Ordered:</h3>
                    <div className="space-y-2">
                      {order.items.map((item, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>
                            {item.name} × {item.quantity}
                            {item.sku && <span className="text-muted-foreground ml-2">({item.sku})</span>}
                          </span>
                          <span>${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {order.customer && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-medium mb-2">Delivery Address:</h3>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>{order.customer.firstName} {order.customer.lastName}</p>
                          <p>{order.customer.address}</p>
                          <p>{order.customer.city}, {order.customer.state} {order.customer.zipCode}</p>
                          <p>{order.customer.email}</p>
                        </div>
                      </div>
                    </>
                  )}

                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Payment ID: {order.paymentId}
                    </span>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        Track Order
                      </Button>
                      <Button variant="outline" size="sm">
                        Reorder
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <Button variant="outline" asChild>
          <Link href="/">Continue Shopping</Link>
        </Button>
      </div>
    </div>
  )
}
