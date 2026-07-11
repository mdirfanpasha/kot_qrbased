import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { broadcastEvent } from '@/lib/broadcast';

const SHARED_SECRET = process.env.WS_SHARED_SECRET || 'smartserve-secret-key-123';

export async function POST(req: Request) {
  try {
    // Auth Check
    const authHeader = req.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${SHARED_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: 'Missing orderId or status' }, { status: 400 });
    }

    if (status !== 'PRINTED' && status !== 'FAILED') {
      return NextResponse.json({ error: 'Invalid print status' }, { status: 400 });
    }

    // Fetch existing order to update attempts
    const existingOrder = await db.order.findUnique({
      where: { id: orderId },
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        printStatus: status,
        printAttempts: {
          increment: 1,
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

    // Notify admins of the print status change
    await broadcastEvent('ORDER_UPDATED', updatedOrder);

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error) {
    console.error('[API Print Status POST Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
