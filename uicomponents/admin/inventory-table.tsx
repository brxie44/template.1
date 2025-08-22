"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/uicomponents/ui/table"
import { Button } from "@/uicomponents/ui/button"
import { Badge } from "@/uicomponents/ui/badge"
import { Edit, Trash2, Package } from "lucide-react"
import type { Product } from "@/lib/types"

interface InventoryTableProps {
  products: Product[]
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
}

export function InventoryTable({ products, onEdit, onDelete }: InventoryTableProps) {
  const [sortField, setSortField] = useState<keyof Product>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const handleSort = (field: keyof Product) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const sortedProducts = [...products].sort((a, b) => {
    const aValue = a[sortField]
    const bValue = b[sortField]

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    }

    return 0
  })

  const getStockBadge = (stock: number) => {
    const stockValue = Number(stock)
    if (stockValue <= 0) {
      return <Badge variant="destructive">Out of Stock</Badge>
    } else if (stockValue <= 5) {
      return <Badge variant="secondary">Low Stock</Badge>
    } else {
      return <Badge variant="default">In Stock</Badge>
    }
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No products found</h3>
        <p className="text-muted-foreground">Get started by adding your first product to the inventory.</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("name")}>
              Product Name
              {sortField === "name" && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort("sku")}>
              SKU
              {sortField === "sku" && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => handleSort("price")}>
              Price
              {sortField === "price" && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
            </TableHead>
            <TableHead className="cursor-pointer hover:bg-muted/50 text-right" onClick={() => handleSort("stock")}>
              Stock
              {sortField === "stock" && <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>}
            </TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedProducts.map((product) => (
            <TableRow key={product.uuid}>
              <TableCell className="font-medium">
                <div>
                  <div className="font-semibold">{product.name}</div>
                  {product.description && (
                    <div className="text-sm text-muted-foreground truncate max-w-xs">{product.description}</div>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm">{product.sku}</TableCell>
              <TableCell className="text-right font-semibold">${product.price.toFixed(2)}</TableCell>
              <TableCell className="text-right">
                <span
                  className={`font-semibold ${
                    Number(product.stock) <= 0 ? "text-red-600" : Number(product.stock) <= 5 ? "text-yellow-600" : "text-green-600"
                  }`}
                >
                  {product.stock}
                </span>
              </TableCell>
              <TableCell>{getStockBadge(product.stock)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => onEdit(product)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onDelete(product)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
