import { Card, CardContent, CardHeader, CardTitle } from "@/uicomponents/ui/card"
import { MapPin, Phone, Mail, Clock, Cookie } from "lucide-react"

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Contact Us</h1>
        <p className="text-lg text-gray-600">Get in touch with Sean's Cookie Shop</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-500" />
              Visit Our Shop
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium">Sean's Cookie Shop</p>
              <p className="text-gray-600">123 South Lamar Blvd</p>
              <p className="text-gray-600">Austin, TX 78704</p>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium">Store Hours</p>
                <p className="text-sm text-gray-600">Mon-Sat: 7:00 AM - 7:00 PM</p>
                <p className="text-sm text-gray-600">Sunday: 8:00 AM - 5:00 PM</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-500" />
              Get In Touch
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-gray-600">(512) 555-COOKIE</p>
                <p className="text-sm text-gray-600">(512) 555-2665</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-gray-600">hello@seanscookieshop.com</p>
                <p className="text-sm text-gray-600">orders@seanscookieshop.com</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Our Team</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Cookie className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Sean</p>
                <p className="text-sm text-gray-600">Owner & Founder</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Cookie className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Tim</p>
                <p className="text-sm text-gray-600">Head Baker</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="text-amber-800">Special Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-amber-700 mb-4">
              Need a custom cake for a special occasion? We'd love to help make your celebration extra sweet!
            </p>
            <p className="text-sm text-amber-600">
              Call us at (512) 555-COOKIE or email orders@seanscookieshop.com to discuss your custom order needs. We
              recommend placing custom orders at least 48 hours in advance.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
