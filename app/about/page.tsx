import { Card, CardContent, CardHeader, CardTitle } from "@/uicomponents/ui/card"
import { Cookie, Heart, Award } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">About Sean's Cookie Shop</h1>
        <p className="text-lg text-gray-600">The best gluten free cakes and cookies in Austin, TX (and the world!)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Our Story
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 leading-relaxed">
              Sean's Cookie Shop was born from a passion for creating delicious gluten-free treats that everyone can
              enjoy. Located in the heart of Austin, Texas, we've been serving the community with love-baked goods that
              prove gluten-free doesn't mean flavor-free.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 leading-relaxed">
              We believe everyone deserves to enjoy fresh, delicious baked goods regardless of dietary restrictions. Our
              mission is to create the most amazing gluten-free cookies and cakes that taste so good, you'll forget
              they're gluten-free!
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-6">Meet Our Team</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="w-24 h-24 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Cookie className="h-12 w-12 text-blue-600" />
              </div>
              <CardTitle>Sean</CardTitle>
              <p className="text-sm text-gray-500">Owner</p>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Sean founded the shop with a vision to bring the best gluten-free treats to Austin. His dedication to
                quality and customer satisfaction drives everything we do.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Cookie className="h-12 w-12 text-green-600" />
              </div>
              <CardTitle>Tim</CardTitle>
              <p className="text-sm text-gray-500">Head Baker</p>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Tim is our master baker who creates all of our delicious recipes. With years of experience in
                gluten-free baking, he ensures every treat is perfect.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="text-center py-8">
          <Cookie className="h-12 w-12 mx-auto mb-4 text-amber-600" />
          <h3 className="text-xl font-semibold mb-2">Why Choose Gluten-Free?</h3>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Whether you have celiac disease, gluten sensitivity, or simply prefer gluten-free options, our treats are
            made with the finest ingredients and lots of love. We use premium almond flour, rice flour, and other
            gluten-free alternatives to create treats that are just as delicious as traditional baked goods.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
