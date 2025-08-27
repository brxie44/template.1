import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/uicomponents/theme-provider"
import { Toaster } from "@/uicomponents/ui/toaster"
import { PayPalButtons } from "@/components/ui/paypal-buttons";
import Script from "next/script";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Prime Cuts Butchery",
  description: "Premium quality meats delivered fresh to your door",
  generator: "v0.dev",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />

          {/* PayPal Cart SDK - Exactly as PayPal suggests */}
          <Script
            src="https://www.paypalobjects.com/ncp/sb/cart/cart.js"
            data-merchant-id="UR72V6GE5FWDQ"
            strategy="beforeInteractive"
          />
          <PayPalButtons />
        </ThemeProvider>
      </body>
    </html>
  );
}
