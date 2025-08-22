"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/uicomponents/ui/dialog"
import { Button } from "@/uicomponents/ui/button"
import { Input } from "@/uicomponents/ui/input"
import { Label } from "@/uicomponents/ui/label"
import { Textarea } from "@/uicomponents/ui/textarea"
import { useToast } from "@/uicomponents/ui/use-toast"
import { ImageUpload } from "@/uicomponents/ui/image-upload"
import type { Product } from "@/lib/types"

interface AddProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: Product | null
  onProductSaved: (product: Product) => void
}

export function AddProductDialog({ open, onOpenChange, product, onProductSaved }: AddProductDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    stock: "",
    sku: "",
    imageUrl: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  // Reset form when dialog opens/closes or product changes
  useEffect(() => {
    if (open) {
      if (product) {
        // Editing existing product
        setFormData({
          name: product.name,
          description: product.description || "",
          price: product.price.toString(),
          stock: product.stock.toString(),
          sku: product.sku,
          imageUrl: product.imageUrl || "",
        })
      } else {
        // Adding new product
        setFormData({
          name: "",
          description: "",
          price: "",
          stock: "",
          sku: "",
          imageUrl: "",
        })
      }
    }
  }, [open, product])

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Product name is required",
        variant: "destructive",
      })
      return false
    }

    if (!formData.price || isNaN(Number.parseFloat(formData.price)) || Number.parseFloat(formData.price) < 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid price",
        variant: "destructive",
      })
      return false
    }

    if (!formData.stock || isNaN(Number.parseInt(formData.stock)) || Number.parseInt(formData.stock) < 0) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid stock quantity",
        variant: "destructive",
      })
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        price: Number.parseFloat(formData.price),
        stock: Number.parseInt(formData.stock),
        sku: formData.sku.trim() || `SKU-${Date.now()}`,
        imageUrl: formData.imageUrl.trim() || "/placeholder.svg?width=400&height=400",
      }

      let response: Response
      let url: string
      let method: string

      if (product) {
        // Update existing product
        url = `/api/inventory/${product.uuid}`
        method = "PUT"
      } else {
        // Create new product
        url = "/api/inventory/admin"
        method = "POST"
      }

      response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(productData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP ${response.status}`)
      }

      const result = await response.json()
      const savedProduct = result.product || result

      console.log("Admin Dialog: Server response after update:", savedProduct)
      console.log("Admin Dialog: Stock value from server:", savedProduct.stock, typeof savedProduct.stock)

      // Ensure the product has all required fields
      const completeProduct: Product = {
        uuid: savedProduct.uuid || product?.uuid || `temp-${Date.now()}`,
        name: savedProduct.name,
        description: savedProduct.description || "",
        price: savedProduct.price,
        stock: Number(savedProduct.stock), // Ensure stock is a number
        sku: savedProduct.sku,
        imageUrl: savedProduct.imageUrl || "/placeholder.svg?width=400&height=400",
        tracked: savedProduct.tracked !== undefined ? savedProduct.tracked : true,
      }

      console.log("Admin Dialog: Final product being sent to onProductSaved:", completeProduct)
      console.log("Admin Dialog: Final stock value:", completeProduct.stock, typeof completeProduct.stock)

      onProductSaved(completeProduct)
      onOpenChange(false)

      toast({
        title: "Success",
        description: product ? "Product updated successfully" : "Product created successfully",
      })
    } catch (error) {
      console.error("Failed to save product:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save product",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add New Product"}</DialogTitle>
          <DialogDescription>
            {product ? "Update the product information below." : "Enter the details for the new product."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter product name"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Enter product description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Price ($) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => handleInputChange("price", e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stock">Stock Quantity *</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={formData.stock}
                  onChange={(e) => handleInputChange("stock", e.target.value)}
                  placeholder="0"
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => handleInputChange("sku", e.target.value)}
                placeholder="Auto-generated if empty"
              />
            </div>
            <ImageUpload
              currentImageUrl={formData.imageUrl}
              onImageChange={(url) => handleInputChange("imageUrl", url)}
              label="Product Image"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : product ? "Update Product" : "Add Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
