"use client"

import { useState, useEffect } from "react"
import { ProductCard } from "@/uicomponents/store/product-card";
import type { Product } from "@/lib/types"
import { defaultProducts } from "@/public/products";

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      console.log("Store: Fetching products from /api/inventory")
      setLoading(true)
      setError(null)

      // Use a consistent timestamp during SSR to prevent hydration mismatches
      // const timestamp = typeof window !== 'undefined' ? Date.now() : 0
      // const response = await fetch(`/api/inventory/admin?t=${timestamp}`, {
      //   method: "GET",
      //   headers: {
      //     "Content-Type": "application/json",
      //     "Cache-Control": "no-cache, no-store, must-revalidate",
      //     "Pragma": "no-cache",
      //   },
      //   cache: "no-store",
      // })

      // console.log("Store: Response status:", response.status)
      // console.log("Store: Response ok:", response.ok)

      // if (!response.ok) {
      //   const contentType = response.headers.get("content-type")
      //   if (contentType && contentType.includes("application/json")) {
      //     const errorData = await response.json()
      //     throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`)
      //   } else {
      //     const errorText = await response.text()
      //     console.error("Store: Non-JSON error response:", errorText.substring(0, 200))
      //     throw new Error(`Server error: HTTP ${response.status}`)
      //   }
      // }

      // const contentType = response.headers.get("content-type")
      // if (!contentType || !contentType.includes("application/json")) {
      //   const responseText = await response.text()
      //   console.error("Store: Non-JSON response:", responseText.substring(0, 200))
      //   throw new Error("Server returned non-JSON response")
      // }

      // const data = await response.json()
      // console.log("Store: Received products:", data.products?.length || data.length)

      // // Handle both new format {products: [...]} and old format [...]
      // const productsArray = data.products || data
      setProducts(defaultProducts)
    } catch (err) {
      console.error("Store: Error fetching products:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to load products"
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading fresh products...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error Loading Products</h2>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchProducts}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Separate in-stock and out-of-stock products
  const inStockProducts = products.filter((product) => Number(product.stock) > 0)
  const outOfStockProducts = products.filter((product) => Number(product.stock) <= 0)

  // Debug logging
  console.log("Store Page Debug:")
  console.log("Total products:", products.length)
  console.log("In stock products:", inStockProducts.length)
  console.log("Out of stock products:", outOfStockProducts.length)
  console.log("All products with stock values:", products.map(p => ({ name: p.name, stock: p.stock, type: typeof p.stock })))
  console.log("Out of stock products:", outOfStockProducts.map(p => ({ name: p.name, stock: p.stock })))

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Fresh Fish Market</h1>
        <p className="text-lg text-gray-600">Premium quality seafood, delivered fresh to your door</p>
      </div>

      {/* In Stock Products */}
      {inStockProducts.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Available Now</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {inStockProducts.map((product) => (
              <ProductCard key={product.uuid} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* Out of Stock Products */}
      {outOfStockProducts.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold text-gray-500 mb-6">Currently Unavailable</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {outOfStockProducts.map((product) => (
              <ProductCard key={product.uuid} product={product} />
            ))}
          </div>
        </div>
      )}

      {products.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No products available at the moment.</p>
          <p className="text-gray-400 mt-2">Please check back later for fresh arrivals!</p>
        </div>
      )}
    </div>
  )
}
