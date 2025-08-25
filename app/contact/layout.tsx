import type React from "react"
import { Header } from "@/uicomponents/store/header"
import { CartProvider } from "@/uicomponents/store/cart-provider"

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
      </div>
    </CartProvider>
  )
}
