import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const orders = await db.order.findMany({
      where: { restaurantId: 'default-restaurant' },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    let totalRevenue = 0;
    let completedCount = 0;
    let preparingCount = 0;
    let pendingCashCount = 0;
    const itemSales: { [key: string]: { name: string; count: number; revenue: number } } = {};

    orders.forEach((o) => {
      if (o.paymentStatus === 'COMPLETED') {
        totalRevenue += o.totalAmount;
      }
      
      if (o.orderStatus === 'COMPLETED') {
        completedCount++;
      } else if (o.orderStatus === 'PREPARING') {
        preparingCount++;
      } else if (o.orderStatus === 'AWAITING_PAYMENT') {
        pendingCashCount++;
      }

      // Track item sales if payment is completed
      if (o.paymentStatus === 'COMPLETED') {
        o.items.forEach((item) => {
          const itemId = item.menuItemId;
          const itemName = item.menuItem.name;
          if (!itemSales[itemId]) {
            itemSales[itemId] = { name: itemName, count: 0, revenue: 0 };
          }
          itemSales[itemId].count += item.quantity;
          itemSales[itemId].revenue += item.price * item.quantity;
        });
      }
    });

    const popularItems = Object.values(itemSales)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      revenue: totalRevenue,
      completedOrders: completedCount,
      preparingOrders: preparingCount,
      pendingCashOrders: pendingCashCount,
      popularItems,
    });
  } catch (error) {
    console.error('[API Admin Stats GET Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
