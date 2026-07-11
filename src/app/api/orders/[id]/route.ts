import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastEvent } from '@/lib/broadcast';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('[API Order ID GET Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { orderStatus, paymentStatus } = body;

    // Fetch original order first to know if we transition status
    const existingOrder = await db.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updatedOrder = await db.order.update({
      where: { id },
      data: {
        ...(orderStatus && { orderStatus }),
        ...(paymentStatus && { paymentStatus }),
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    // Broadcast the update to admins and customers
    await broadcastEvent('ORDER_UPDATED', updatedOrder);

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('[API Order ID PATCH Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
