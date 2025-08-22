import { NextResponse } from "next/server"
import { createZettleProduct } from "@/lib/zettle";
import { products } from "@/public/products";

export async function GET() {
  try {
    console.log("=== ADMIN INVENTORY API: GET ===");

    // const products = await getZettleProducts()
    console.log(`Admin API: Successfully fetched ${products.length} products`);

    // Sort products: in-stock first, then out-of-stock
    const sortedProducts = products.sort((a, b) => {
      // First sort by stock availability (in-stock first)
      if (a.stock > 0 && b.stock === 0) return -1;
      if (a.stock === 0 && b.stock > 0) return 1;

      // Then sort by stock quantity (higher stock first)
      if (a.stock !== b.stock) return b.stock - a.stock;

      // Finally sort by name alphabetically
      return a.name.localeCompare(b.name);
    });

    const timestamp = new Date().toISOString();
    return NextResponse.json(
      {
        products: sortedProducts,
        total: sortedProducts.length,
        timestamp: timestamp,
        source: "admin-api",
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("ADMIN INVENTORY API: GET Error:", error);

    let errorMessage = "Failed to fetch products";
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;

      // Handle specific error types
      if (error.message.includes("Authentication failed")) {
        statusCode = 401;
      } else if (error.message.includes("Access forbidden")) {
        statusCode = 403;
      }
    }

    return NextResponse.json(
      {
        error: "Failed to fetch products",
        message: errorMessage,
        timestamp: new Date().toISOString(),
      },
      {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    console.log("=== ADMIN INVENTORY API: POST ===");

    const body = await request.json();
    console.log("Admin API: Creating product with data:", body);

    // Validate required fields
    if (!body.name || !body.price) {
      return NextResponse.json(
        {
          error: "Validation error",
          message: "Product name and price are required",
        },
        { status: 400 }
      );
    }

    // Prepare product data for Zettle API
    const productData = {
      name: body.name,
      description: body.description || "",
      price: Number.parseFloat(body.price) || 0,
      stock: Number.parseInt(body.stock) || 0,
      imageUrl: body.imageUrl || "/placeholder.svg?width=400&height=400",
      sku: body.sku || `SKU-${Date.now()}`,
      tracked: true,
    };

    console.log("Admin API: Creating product with Zettle API:", productData);

    // Create product using real Zettle API
    const newProduct = await createZettleProduct(productData);

    console.log("Admin API: Created product:", newProduct);

    return NextResponse.json(
      {
        product: newProduct,
        message: "Product created successfully",
        timestamp: new Date().toISOString(),
      },
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("ADMIN INVENTORY API: POST Error:", error);

    return NextResponse.json(
      {
        error: "Failed to create product",
        message: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
