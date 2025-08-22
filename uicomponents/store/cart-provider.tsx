"use client"
import { createContext, useState, useEffect } from "react"
import type { CartItem, Product } from "@/lib/types"
import type { ReactNode } from "react"

type CartContextType = {
  items: CartItem[]
  addItem: (product: Product) => void
  removeItem: (uuid: string) => void
  clearCart: () => void
  getTotalPrice: () => number
  getItemCount: () => number
}

export const CartContext = createContext<CartContextType | null>(null)

interface CartProviderProps {
  children: ReactNode
}

export function CartProvider({ children }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  // Load cart from localStorage on client-side only
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedCart = localStorage.getItem("cart")
      if (storedCart) {
        try {
          setItems(JSON.parse(storedCart))
        } catch (error) {
          console.error("Error parsing stored cart:", error)
          localStorage.removeItem("cart")
        }
      }
      setIsHydrated(true)
    }
  }, [])

  // Save cart to localStorage whenever items change
  useEffect(() => {
    if (isHydrated && typeof window !== "undefined") {
      localStorage.setItem("cart", JSON.stringify(items))
    }
  }, [items, isHydrated])

  const addItem = (product: Product) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.uuid === product.uuid)
      if (existingItem) {
        return prevItems.map((item) => (item.uuid === product.uuid ? { ...item, quantity: item.quantity + 1 } : item))
      }
      return [...prevItems, { ...product, quantity: 1 }]
    })
  }

  const removeItem = (uuid: string) => {
    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.uuid === uuid)
      if (existingItem && existingItem.quantity > 1) {
        return prevItems.map((item) => (item.uuid === uuid ? { ...item, quantity: item.quantity - 1 } : item))
      }
      return prevItems.filter((item) => item.uuid !== uuid)
    })
  }

  const clearCart = () => {
    setItems([])
  }

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const getItemCount = () => {
    return items.reduce((total, item) => total + item.quantity, 0)
  }

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, getTotalPrice, getItemCount }}>
      {children}
    </CartContext.Provider>
  )
}
