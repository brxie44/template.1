"use client"

import { defaultProducts } from "@/public/products"
import { useEffect } from "react"

export function PayPalButtons() {
  useEffect(() => {
    const injectPayPalButtons = () => {
      if (typeof window !== 'undefined' && (window as any).cartPaypal) {
        console.log('PayPal loaded, injecting buttons...')

        // Inject View Cart button
        const viewCartContainer = document.getElementById('paypal-view-cart-container')
        if (viewCartContainer) {
          viewCartContainer.innerHTML = '<paypal-cart-button data-id="pp-view-cart"></paypal-cart-button>'
          ;(window as any).cartPaypal.Cart({ id: "pp-view-cart" })
          console.log('View Cart button injected')
        }

		setTimeout(() => {
			// Inject Add to Cart buttons for all products
			defaultProducts.forEach(({ sku, uuid }) => {
			const container = document.getElementById(`paypal-add-to-cart-${uuid}`)
			if (container) {
				container.innerHTML = `<paypal-add-to-cart-button data-id="${sku}"></paypal-add-to-cart-button>`
				;(window as any).cartPaypal.AddToCart({ id: sku })
			}
			})
		}, 2000)
        // Debug: Check what was actually injected
        setTimeout(() => {
          defaultProducts.forEach(({ uuid, name }) => {
            const container = document.getElementById(`paypal-add-to-cart-${uuid}`)
            if (container) {
              console.log(`${name} container HTML:`, container.innerHTML)
            }
          })
        }, 3000)
      }
    }

    // Check if PayPal is loaded, if not wait for it
    if (typeof window !== 'undefined' && (window as any).cartPaypal) {
      injectPayPalButtons()
    } else {
      console.log('Waiting for PayPal to load...')
      const checkPayPal = setInterval(() => {
        if (typeof window !== 'undefined' && (window as any).cartPaypal) {
          clearInterval(checkPayPal)
          console.log('PayPal loaded, injecting buttons...')
          injectPayPalButtons()
        }
      }, 100)
    }
  }, [])

  return null
}
