"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/uicomponents/ui/card"
import { Button } from "@/uicomponents/ui/button"
import { Input } from "@/uicomponents/ui/input"
import { useToast } from "@/uicomponents/ui/use-toast"
import { Plus, Search, Package, AlertTriangle, TrendingUp, DollarSign, RefreshCw } from "lucide-react"
import { InventoryTable } from "./inventory-table"
import { AddProductDialog } from "./add-product-dialog"
import type { Product } from "@/lib/types"

export function InventoryManagement() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const { toast } = useToast()

  // Load products on component mount
  useEffect(() => {
    loadProducts()
  }, [])

  // Filter products based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProducts(products)
    } else {
      const filtered = products.filter(
        (product) =>
          product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase())),
      )
      setFilteredProducts(filtered)
    }
  }, [products, searchTerm])

  const loadProducts = async () => {
    try {
      setIsLoading(true)
      console.log("Loading products from admin API...")

      const response = await fetch("/api/inventory/admin", {
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
      })

      console.log("API response status:", response.status)
      console.log("API response headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error("API error response:", errorText)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text()
        console.error("Non-JSON response:", responseText.substring(0, 200))
        throw new Error("Server returned non-JSON response")
      }

      const data = await response.json()
      console.log("Loaded products data:", data)

      if (data.products && Array.isArray(data.products)) {
        // Sort products: in-stock first, then out-of-stock
        const sortedProducts = data.products.sort((a: Product, b: Product) => {
          if (a.stock > 0 && b.stock === 0) return -1
          if (a.stock === 0 && b.stock > 0) return 1
          return b.stock - a.stock // Higher stock first within each group
        })

        setProducts(sortedProducts)
        console.log("Set products:", sortedProducts.length)
      } else {
        console.error("Invalid data format:", data)
        throw new Error("Invalid response format")
      }
    } catch (error) {
      console.error("Failed to load products:", error)
      toast({
        title: "Load Failed",
        description: error instanceof Error ? error.message : "Failed to load products",
        variant: "destructive",
      })
      // Set empty array on error
      setProducts([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleProductSaved = async (savedProduct: Product) => {
    if (editingProduct) {
      // Update existing product - reload fresh data from server instead of using returned data
      console.log("Admin: Product updated, reloading fresh data from server...")
      setEditingProduct(null)
      
      // Force fresh reload to get accurate stock data
      await loadProducts()
      
      toast({
        title: "Product Updated",
        description: `${savedProduct.name} has been updated successfully`,
      })
    } else {
      // Add new product
      setProducts((prev) => [savedProduct, ...prev])
      toast({
        title: "Product Added",
        description: `${savedProduct.name} has been added to inventory`,
      })
    }
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product)
    setIsDialogOpen(true)
  }

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Are you sure you want to delete ${product.name}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/inventory/${product.uuid}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      setProducts((prev) => prev.filter((p) => p.uuid !== product.uuid))
      toast({
        title: "Product Deleted",
        description: `${product.name} has been removed from inventory`,
      })
    } catch (error) {
      console.error("Failed to delete product:", error)
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete product",
        variant: "destructive",
      })
    }
  }

  const handleAddProduct = () => {
    setEditingProduct(null)
    setIsDialogOpen(true)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingProduct(null)
  }

  const handleRefresh = () => {
    loadProducts()
  }

  // Calculate statistics
  const totalProducts = products.length
  const inStockProducts = products.filter((p) => p.stock > 0).length
  const lowStockProducts = products.filter((p) => p.stock > 0 && p.stock <= 5).length
  const outOfStockProducts = products.filter((p) => p.stock === 0).length
  const totalValue = products.reduce((sum, p) => sum + p.price * p.stock, 0)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-4 w-4 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-muted animate-pulse rounded mb-2" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-10 w-64 bg-muted animate-pulse rounded" />
                <div className="h-10 w-32 bg-muted animate-pulse rounded" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 w-full bg-muted animate-pulse rounded" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProducts}</div>
            <p className="text-xs text-muted-foreground">{inStockProducts} in stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{lowStockProducts}</div>
            <p className="text-xs text-muted-foreground">Need restocking</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{outOfStockProducts}</div>
            <p className="text-xs text-muted-foreground">Unavailable items</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Inventory worth</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory Management</CardTitle>
          <CardDescription>Manage your fish market products, stock levels, and pricing.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button onClick={handleAddProduct}>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </div>
          </div>

          <InventoryTable products={filteredProducts} onEdit={handleEditProduct} onDelete={handleDeleteProduct} />
        </CardContent>
      </Card>

      {/* Add/Edit Product Dialog */}
      <AddProductDialog
        open={isDialogOpen}
        onOpenChange={handleDialogClose}
        product={editingProduct}
        onProductSaved={handleProductSaved}
      />
    </div>
  )
}
