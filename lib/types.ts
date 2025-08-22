export interface Product {
  uuid: string
  name: string
  description?: string
  price: number
  stock: number
  imageUrl?: string
  category?: string
  sku: string
  tracked?: boolean
}

export interface CartItem {
  product: Product
  quantity: number
}

export interface Order {
  id: string
  items: CartItem[]
  total: number
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled"
  createdAt: string
  customerEmail?: string
  shippingAddress?: {
    name: string
    street: string
    city: string
    state: string
    zipCode: string
    country: string
  }
}
