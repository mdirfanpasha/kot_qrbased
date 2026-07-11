import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastEvent } from '@/lib/broadcast';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { customerName, items, paymentMethod } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    if (paymentMethod !== 'UPI' && paymentMethod !== 'CASH') {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    // 1. Fetch menu items to validate prices and compute total
    const menuItemIds = items.map((i: { menuItemId: string }) => i.menuItemId);
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds } },
    });

    if (menuItems.length !== items.length) {
      return NextResponse.json({ error: 'Some menu items were not found' }, { status: 400 });
    }

    let totalAmount = 0;
    const orderItemsToCreate = items.map((cartItem: { menuItemId: string; quantity: number }) => {
      const dbItem = menuItems.find((m) => m.id === cartItem.menuItemId)!;
      totalAmount += dbItem.price * cartItem.quantity;
      return {
        menuItemId: cartItem.menuItemId,
        quantity: cartItem.quantity,
        price: dbItem.price,
      };
    });

    // 2. Generate daily token number (sequential, resetting daily)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const count = await db.order.count({
      where: {
        restaurantId: 'default-restaurant',
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    const nextToken = 101 + count;
    const tokenNumber = `${nextToken}`;

    // 3. Determine status based on payment method
    let paymentStatus = 'PENDING';
    let orderStatus = 'AWAITING_PAYMENT'; // "AWAITING_PAYMENT", "PREPARING", "COMPLETED", "CANCELLED"

    if (paymentMethod === 'UPI') {
      // In production, we verify Razorpay signature here.
      // For this system, we mark UPI orders as immediately paid & preparing.
      paymentStatus = 'COMPLETED';
      orderStatus = 'PREPARING';
    }

    // 4. Create Order in Database
    const order = await db.order.create({
      data: {
        restaurantId: 'default-restaurant',
        tokenNumber,
        customerName: customerName || 'Guest',
        totalAmount,
        paymentMethod,
        paymentStatus,
        orderStatus,
        printStatus: 'PENDING',
        items: {
          create: orderItemsToCreate,
        },
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    // 5. Broadcase events in real-time
    if (orderStatus === 'PREPARING') {
      // For UPI, broadcast print event immediately!
      await broadcastEvent('NEW_ORDER_READY', order);
    } else {
      // For Cash, broadcast new order to admin dashboard (without printing KOT yet!)
      await broadcastEvent('ORDER_CREATED', order);
    }

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('[API Orders POST Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('[API Orders GET Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
