const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || ""
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || ""
const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com"

async function getAccessToken() {
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64")

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })

  const data = await response.json()
  return data.access_token
}

export async function createOrder(amount: string, cartItems?: any[], taxBreakdown?: { subtotal: string; tax: string }) {
  const accessToken = await getAccessToken()

  const orderData: any = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: amount,
        },
      },
    ],
  }

  if (cartItems && cartItems.length > 0) {
    const items = cartItems.map((item) => ({
      name: item.name,
      quantity: item.quantity.toString(),
      unit_amount: {
        currency_code: "USD",
        value: item.price.toFixed(2),
      },
      sku: item.sku || item.uuid,
      category: "PHYSICAL_GOODS",
    }))

    orderData.purchase_units[0].items = items

    // Set up the amount breakdown
    const breakdown: any = {
      item_total: {
        currency_code: "USD",
        value: taxBreakdown?.subtotal || amount,
      },
    }

    // Add tax if provided
    if (taxBreakdown?.tax) {
      breakdown.tax_total = {
        currency_code: "USD",
        value: taxBreakdown.tax,
      }
    }

    orderData.purchase_units[0].amount.breakdown = breakdown
  }

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderData),
  })

  const order = await response.json()
  return order
}

export async function captureOrder(orderID: string) {
  const accessToken = await getAccessToken()

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  })

  const result = await response.json()
  return result
}

class PayPalClient {
  private accessToken: string | null = null
  private tokenExpiry = 0

  private getBaseUrl(): string {
    // Try multiple sources for the base URL in order of preference

    // 1. Explicit environment variable
    if (process.env.NEXT_PUBLIC_APP_URL) {
      console.log("PayPal: Using NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL)
      return process.env.NEXT_PUBLIC_APP_URL
    }

    // 2. Vercel deployment URL
    if (process.env.VERCEL_URL) {
      const vercelUrl = `https://${process.env.VERCEL_URL}`
      console.log("PayPal: Using VERCEL_URL:", vercelUrl)
      return vercelUrl
    }

    // 3. Railway deployment URL
    if (process.env.RAILWAY_STATIC_URL) {
      console.log("PayPal: Using RAILWAY_STATIC_URL:", process.env.RAILWAY_STATIC_URL)
      return process.env.RAILWAY_STATIC_URL
    }

    // 4. Netlify deployment URL
    if (process.env.URL) {
      console.log("PayPal: Using Netlify URL:", process.env.URL)
      return process.env.URL
    }

    // 5. Heroku deployment URL
    if (process.env.HEROKU_APP_NAME) {
      const herokuUrl = `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`
      console.log("PayPal: Using Heroku URL:", herokuUrl)
      return herokuUrl
    }

    // 6. Fallback to localhost for development
    console.warn("PayPal: No deployment URL found, falling back to localhost")
    console.warn("PayPal: Set NEXT_PUBLIC_APP_URL environment variable for production")
    return "http://localhost:3000"
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64")

    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })

    const data = await response.json()
    this.accessToken = data.access_token
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000

    return this.accessToken!
  }

  async createOrder(amount: string, cartItems: any[] = [], taxBreakdown?: { subtotal: string; tax: string }, baseUrl?: string): Promise<any> {
    const accessToken = await this.getAccessToken()

    const finalBaseUrl = baseUrl || this.getBaseUrl()
    const returnUrl = `${finalBaseUrl}/checkout/success`
    const cancelUrl = `${finalBaseUrl}/checkout/cancel`

    console.log("PayPal: Creating order with URLs:")
    console.log("PayPal: Return URL:", returnUrl)
    console.log("PayPal: Cancel URL:", cancelUrl)

    const orderData: any = {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value: amount,
          },
        },
      ],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    }

    if (cartItems.length > 0) {
      const items = cartItems.map((item) => ({
        name: item.name,
        quantity: item.quantity.toString(),
        unit_amount: {
          currency_code: "USD",
          value: item.price.toFixed(2),
        },
        sku: item.sku || item.uuid,
        category: "PHYSICAL_GOODS",
      }))

      orderData.purchase_units[0].items = items

      // Set up the amount breakdown
      const breakdown: any = {
        item_total: {
          currency_code: "USD",
          value: taxBreakdown?.subtotal || amount,
        },
      }

      // Add tax if provided
      if (taxBreakdown?.tax) {
        breakdown.tax_total = {
          currency_code: "USD",
          value: taxBreakdown.tax,
        }
      }

      orderData.purchase_units[0].amount.breakdown = breakdown
    }

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`PayPal order creation failed: ${JSON.stringify(error)}`)
    }

    return response.json()
  }

  async captureOrder(orderID: string): Promise<any> {
    const accessToken = await this.getAccessToken()

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`PayPal order capture failed: ${JSON.stringify(error)}`)
    }

    return response.json()
  }

  async getOrder(orderID: string): Promise<any> {
    const accessToken = await this.getAccessToken()

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderID}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`PayPal order retrieval failed: ${JSON.stringify(error)}`)
    }

    return response.json()
  }
}

export const paypal = new PayPalClient()
