import { NextResponse } from "next/server"
import { enableTrackingForAllProducts } from "@/lib/zettle"

export async function POST() {
  try {
    console.log("API: Starting to enable tracking for all products...")
    
    await enableTrackingForAllProducts()
    
    return NextResponse.json({
      success: true,
      message: "Tracking enabled for all products successfully"
    })
  } catch (error) {
    console.error("API: Error enabling tracking:", error)
    
    return NextResponse.json(
      {
        error: "Failed to enable tracking",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to enable tracking for all products",
    usage: "POST /api/zettle/enable-tracking"
  })
}
