import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastEvent } from '@/lib/broadcast';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch original order first
    const existingOrder = await db.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (existingOrder.paymentMethod !== 'CASH') {
      return NextResponse.json({ error: 'Order is not a Cash order' }, { status: 400 });
    }

    if (existingOrder.paymentStatus === 'COMPLETED') {
      return NextResponse.json({ error: 'Payment is already confirmed' }, { status: 400 });
    }

    const updatedOrder = await db.order.update({
      where: { id },
      data: {
        paymentStatus: 'COMPLETED',
        orderStatus: 'PREPARING', // Transition to preparing on payment confirmation
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    // 1. Notify the local Restaurant Connector to print the KOT
    await broadcastEvent('NEW_ORDER_READY', updatedOrder);

    // 2. Also notify admin dashboards that the order was updated
    await broadcastEvent('ORDER_UPDATED', updatedOrder);

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('[API Confirm Cash POST Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
