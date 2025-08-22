"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Product } from "@/lib/types"

interface CartItem extends Product {
  quantity: number
}

interface CartStore {
  items: CartItem[]
  addItem: (product: Product) => void
  removeItem: (uuid: string) => void
  updateQuantity: (uuid: string, quantity: number) => void
  clearCart: () => void
  getTotalItems: () => number
  getTotalPrice: () => number
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product) =>
        set((state) => {
          const existingItem = state.items.find((item) => item.uuid === product.uuid)
          if (existingItem) {
            return {
              items: state.items.map((item) =>
                item.uuid === product.uuid ? { ...item, quantity: item.quantity + 1 } : item,
              ),
            }
          }
          return {
            items: [...state.items, { ...product, quantity: 1 }],
          }
        }),
      removeItem: (uuid) =>
        set((state) => ({
          items: state.items.filter((item) => item.uuid !== uuid),
        })),
      updateQuantity: (uuid, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return {
              items: state.items.filter((item) => item.uuid !== uuid),
            }
          }
          return {
            items: state.items.map((item) => (item.uuid === uuid ? { ...item, quantity } : item)),
          }
        }),
      clearCart: () => set({ items: [] }),
      getTotalItems: () => {
        const { items } = get()
        return items.reduce((total, item) => total + item.quantity, 0)
      },
      getTotalPrice: () => {
        const { items } = get()
        return items.reduce((total, item) => total + item.price * item.quantity, 0)
      },
    }),
    {
      name: "cart-storage",
      // Add skipHydration to prevent hydration mismatches
      skipHydration: true,
    },
  ),
)
