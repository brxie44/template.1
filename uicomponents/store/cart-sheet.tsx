"use client"

import { Button } from "@/uicomponents/ui/button"

export function CartSheet() {
  return (
    <Button variant="outline" size="sm" className="relative bg-transparent">
      <div
        className="h-4 w-4 flex items-center justify-between"
        id="paypal-view-cart-container"
      ></div>
    </Button>
  );
}
