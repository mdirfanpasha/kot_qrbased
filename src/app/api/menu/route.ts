import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const restaurant = await db.restaurant.findUnique({
      where: { id: 'default-restaurant' },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            menuItems: {
              orderBy: { name: 'asc' },
            },
          },
        },
      },
    });

    if (!restaurant) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    return NextResponse.json({ restaurant });
  } catch (error) {
    console.error('[API Menu GET Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, name, description, price, imageUrl, categoryId, sortOrder } = body;

    if (type === 'category') {
      if (!name) {
        return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
      }
      
      const newCategory = await db.category.create({
        data: {
          name,
          sortOrder: sortOrder ? parseInt(sortOrder) : 0,
          restaurantId: 'default-restaurant',
        },
      });
      return NextResponse.json({ success: true, category: newCategory });
    }

    if (type === 'item') {
      if (!name || !price || !categoryId) {
        return NextResponse.json({ error: 'Name, price, and categoryId are required' }, { status: 400 });
      }

      const newItem = await db.menuItem.create({
        data: {
          name,
          description: description || '',
          price: parseFloat(price),
          imageUrl: imageUrl || '',
          categoryId,
          restaurantId: 'default-restaurant',
          isAvailable: true,
        },
      });
      return NextResponse.json({ success: true, item: newItem });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });
  } catch (error) {
    console.error('[API Menu POST Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
