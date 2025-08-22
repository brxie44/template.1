import { NextResponse } from "next/server"

export async function POST() {
  return NextResponse.json({
    message: "Order cleanup should be done on the frontend since localStorage is client-side",
    instructions: "Use the cleanup utility function in the browser console or create a frontend cleanup tool"
  })
}

export async function GET() {
  return NextResponse.json({
    message: "Order cleanup utility",
    usage: "This endpoint provides instructions for cleaning up duplicate orders in localStorage",
    cleanupScript: `
// Paste this in browser console to clean up duplicate orders:
const cleanupOrders = () => {
  const orders = JSON.parse(localStorage.getItem('userOrders') || '[]');
  const uniqueOrders = orders.reduce((acc, order) => {
    const exists = acc.find(o => o.orderId === order.orderId || o.paymentId === order.paymentId);
    if (!exists) {
      acc.push(order);
    }
    return acc;
  }, []);
  
  console.log('Before cleanup:', orders.length, 'orders');
  console.log('After cleanup:', uniqueOrders.length, 'orders');
  console.log('Removed', orders.length - uniqueOrders.length, 'duplicates');
  
  localStorage.setItem('userOrders', JSON.stringify(uniqueOrders));
  return uniqueOrders;
};

cleanupOrders();
    `
  })
}
