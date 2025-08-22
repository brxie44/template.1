"use client"

import { useState } from "react"
import { Button } from "@/uicomponents/ui/button"
import { Package, Loader2 } from "lucide-react"
import { useToast } from "@/uicomponents/ui/use-toast"

interface PopulateButtonProps {
  onSuccess?: () => void
}

export function PopulateButton({ onSuccess }: PopulateButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handlePopulate = async () => {
    setIsLoading(true)
    try {
      console.log("PopulateButton: Starting catalog population...")

      const response = await fetch("/api/admin/populate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      console.log("PopulateButton: Response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log("PopulateButton: Success result:", result)

      toast({
        title: "Catalog Populated",
        description: `Successfully added ${result.created || 0} products to your Zettle catalog`,
      })

      // Call the success callback to refresh the parent component
      onSuccess?.()
    } catch (error) {
      console.error("PopulateButton: Error:", error)
      toast({
        title: "Population Failed",
        description: error instanceof Error ? error.message : "Failed to populate catalog",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handlePopulate} disabled={isLoading}>
      {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Package className="h-4 w-4 mr-2" />}
      {isLoading ? "Populating..." : "Populate Catalog"}
    </Button>
  )
}
