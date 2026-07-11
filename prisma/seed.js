/* eslint-disable */
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Make sure environment variable is loaded
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Delete existing records
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.restaurant.deleteMany({});

  // 2. Create default restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      id: 'default-restaurant',
      name: 'SmartServe Bistro',
      tagline: 'Skip the Queue. Order. Pay. Auto Print.',
      logoUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      upiId: 'payment-merchant@upi',
      currency: 'INR',
    },
  });

  console.log(`Created restaurant: ${restaurant.name} (${restaurant.id})`);

  // 3. Create categories
  const categoriesData = [
    { name: 'Starters', sortOrder: 0 },
    { name: 'Mains', sortOrder: 1 },
    { name: 'Desserts', sortOrder: 2 },
    { name: 'Beverages', sortOrder: 3 },
  ];

  const categories = [];
  for (const cat of categoriesData) {
    const createdCat = await prisma.category.create({
      data: {
        name: cat.name,
        sortOrder: cat.sortOrder,
        restaurantId: restaurant.id,
      },
    });
    categories.push(createdCat);
    console.log(`Created category: ${createdCat.name}`);
  }

  // 4. Create menu items
  const menuItemsData = [
    // Starters
    {
      name: 'Crispy Spring Rolls',
      description: 'Crispy fried veg rolls served with sweet chili sauce.',
      price: 149,
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      categoryIndex: 0,
    },
    {
      name: 'Tandoori Paneer Tikka',
      description: 'Marinated cottage cheese cubes grilled to perfection with onions and bell peppers.',
      price: 249,
      imageUrl: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      categoryIndex: 0,
    },
    {
      name: 'Spicy BBQ Chicken Wings',
      description: 'Juicy chicken wings tossed in smoky spicy barbeque sauce.',
      price: 299,
      imageUrl: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      categoryIndex: 0,
    },
    // Mains
    {
      name: 'Rich Butter Chicken',
      description: 'Tender tandoori chicken cooked in a rich, velvety tomato and butter gravy.',
      price: 349,
      imageUrl: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      categoryIndex: 1,
    },
    {
      name: 'Dal Makhani',
      description: 'Slow-cooked black lentils and kidney beans enriched with cream and pure white butter.',
      price: 229,
      imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      categoryIndex: 1,
    },
    {
      name: 'Paneer Butter Masala',
      description: 'Fresh cottage cheese cubes in a thick creamy gravy cooked with rich Indian spices.',
      price: 289,
      imageUrl: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      categoryIndex: 1,
    },
    {
      name: 'Veg Fried Rice',
      description: 'Fragrant basmati rice tossed with finely chopped garden vegetables and light soy sauce.',
      price: 199,
      imageUrl: 'https://images.unsplash.com/photo-1603133872878-685f208b82a5?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      categoryIndex: 1,
    },
    // Desserts
    {
      name: 'Warm Gulab Jamun',
      description: 'Soft golden-fried milk dumplings soaked in cardamom flavored sugar syrup.',
      price: 99,
      imageUrl: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      categoryIndex: 2,
    },
    {
      name: 'Chocolate Lava Cake',
      description: 'Decadent warm chocolate cake featuring a molten chocolate center.',
      price: 149,
      imageUrl: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      categoryIndex: 2,
    },
    // Beverages
    {
      name: 'Spiced Masala Chai',
      description: 'Traditional Indian hot milk tea brewed with ginger, cardamom, and spices.',
      price: 49,
      imageUrl: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      categoryIndex: 3,
    },
    {
      name: 'Fresh Lime Soda',
      description: 'Refreshing carbonated drink served sweet, salted, or mixed.',
      price: 79,
      imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      categoryIndex: 3,
    },
    {
      name: 'Creamy Mango Lassi',
      description: 'Sweetened cold yogurt drink blended with fresh sweet mango pulp.',
      price: 119,
      imageUrl: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      categoryIndex: 3,
    },
  ];

  for (const item of menuItemsData) {
    const category = categories[item.categoryIndex];
    await prisma.menuItem.create({
      data: {
        name: item.name,
        description: item.description,
        price: item.price,
        imageUrl: item.imageUrl,
        categoryId: category.id,
        restaurantId: restaurant.id,
      },
    });
    console.log(`Created menu item: ${item.name}`);
  }

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
