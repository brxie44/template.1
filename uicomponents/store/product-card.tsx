"use client"

import Image from "next/image";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/uicomponents/ui/card";
import { Badge } from "@/uicomponents/ui/badge";
import type { Product } from "@/lib/types";
interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const isOutOfStock = Number(product.stock) <= 0;
  const isLowStock = Number(product.stock) > 0 && Number(product.stock) <= 5;

  // Debug logging for stock classification
  console.log(
    `ProductCard ${product.name}: stock=${
      product.stock
    } (type: ${typeof product.stock}), isOutOfStock=${isOutOfStock}, isLowStock=${isLowStock}`
  );
  const paypalButtonId = `paypal-add-to-cart-${product.uuid}`;

  return (
    <Card
      className={`h-full flex flex-col ${isOutOfStock ? "opacity-75" : ""}`}
    >
      <CardHeader className="p-0">
        <div className="relative aspect-square">
          <Image
            src={product.imageUrl || "/placeholder.svg"}
            alt={product.name}
            fill
            className="object-cover rounded-t-lg"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          />
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            {isOutOfStock && <Badge variant="destructive">Out of Stock</Badge>}
            {isLowStock && <Badge variant="secondary">Low Stock</Badge>}
            {!isOutOfStock && !isLowStock && (
              <Badge variant="default">In Stock</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-4">
        <h3 className="font-semibold text-lg mb-2 line-clamp-2">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {product.description}
          </p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-green-600">
            ${product.price.toFixed(2)}
          </span>
          {!isOutOfStock && (
            <span className="text-sm text-gray-500">
              {product.stock} available
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <div id={paypalButtonId} className="w-full flex-none"></div>
      </CardFooter>
    </Card>
  );
}
