import { NextResponse } from "next/server"
import { getZettleProduct, updateZettleProduct, deleteZettleProduct } from "@/lib/zettle"

export async function GET(request: Request, { params }: { params: { uuid: string } }) {
  try {
    console.log(`=== INVENTORY ITEM API: GET ${params.uuid} ===`)

    const product = await getZettleProduct(params.uuid)

    if (!product) {
      return NextResponse.json(
        {
          error: "Product not found",
          message: `Product with UUID ${params.uuid} does not exist`,
        },
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    return NextResponse.json(product, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error(`INVENTORY ITEM API: GET Error for ${params.uuid}:`, error)

    return NextResponse.json(
      {
        error: "Failed to fetch product",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}

export async function PUT(request: Request, { params }: { params: { uuid: string } }) {
  try {
    console.log(`=== INVENTORY ITEM API: PUT ${params.uuid} ===`)

    let body
    try {
      body = await request.json()
      console.log("Update request body:", JSON.stringify(body, null, 2))
    } catch (parseError) {
      return NextResponse.json(
        {
          error: "Invalid JSON in request body",
          message: "Please check your request format",
        },
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    // Validate the update data
    const updates: any = {}

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim() === "") {
        return NextResponse.json(
          {
            error: "Validation error",
            message: "Product name must be a non-empty string",
          },
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        )
      }
      updates.name = body.name.trim()
    }

    if (body.description !== undefined) {
      updates.description = typeof body.description === "string" ? body.description.trim() : ""
    }

    if (body.price !== undefined) {
      if (typeof body.price !== "number" || body.price < 0) {
        return NextResponse.json(
          {
            error: "Validation error",
            message: "Price must be a non-negative number",
          },
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        )
      }
      updates.price = body.price
    }

    if (body.stock !== undefined) {
      if (typeof body.stock !== "number" || body.stock < 0 || !Number.isInteger(body.stock)) {
        return NextResponse.json(
          {
            error: "Validation error",
            message: "Stock must be a non-negative integer",
          },
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
            },
          },
        )
      }
      updates.stock = body.stock
    }

    if (body.imageUrl !== undefined) {
      updates.imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : ""
    }

    if (body.sku !== undefined) {
      updates.sku = typeof body.sku === "string" ? body.sku.trim() : ""
    }

    console.log("Validated updates:", JSON.stringify(updates, null, 2))

    const updatedProduct = await updateZettleProduct(params.uuid, updates)

    return NextResponse.json(updatedProduct, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error(`INVENTORY ITEM API: PUT Error for ${params.uuid}:`, error)

    let errorMessage = "Failed to update product"
    let statusCode = 500

    if (error instanceof Error) {
      errorMessage = error.message

      // Handle specific error types
      if (error.message.includes("Authentication failed")) {
        statusCode = 401
      } else if (error.message.includes("Access forbidden")) {
        statusCode = 403
      } else if (error.message.includes("not found")) {
        statusCode = 404
      } else if (error.message.includes("Validation error")) {
        statusCode = 400
      }
    }

    return NextResponse.json(
      {
        error: "Failed to update product",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
      {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}

export async function DELETE(request: Request, { params }: { params: { uuid: string } }) {
  try {
    console.log(`=== INVENTORY ITEM API: DELETE ${params.uuid} ===`)

    const success = await deleteZettleProduct(params.uuid)

    if (!success) {
      return NextResponse.json(
        {
          error: "Failed to delete product",
          message: "Product could not be deleted",
        },
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        },
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: "Product deleted successfully",
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  } catch (error) {
    console.error(`INVENTORY ITEM API: DELETE Error for ${params.uuid}:`, error)

    let errorMessage = "Failed to delete product"
    let statusCode = 500

    if (error instanceof Error) {
      errorMessage = error.message

      // Handle specific error types
      if (error.message.includes("Authentication failed")) {
        statusCode = 401
      } else if (error.message.includes("Access forbidden")) {
        statusCode = 403
      } else if (error.message.includes("not found")) {
        statusCode = 404
      }
    }

    return NextResponse.json(
      {
        error: "Failed to delete product",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
      {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}
