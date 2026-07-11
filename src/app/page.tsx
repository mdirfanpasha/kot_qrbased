/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ShoppingBag, Plus, Minus, AlertCircle } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  categoryId: string;
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  menuItems: MenuItem[];
}

interface Restaurant {
  id: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
  categories: Category[];
}

export default function MenuPage() {
  const router = useRouter();
  const { cart, addToCart, removeFromCart, totalItems, totalPrice } = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    async function fetchMenu() {
      try {
        const res = await fetch('/api/menu');
        if (!res.ok) throw new Error('Failed to load menu');
        const data = await res.json();
        setRestaurant(data.restaurant);
        setLoading(false);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Something went wrong';
        console.error(err);
        setError(errMsg);
        setLoading(false);
      }
    }
    fetchMenu();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-background min-h-screen px-4">
        <div className="w-12 h-12 border-4 border-muted-foreground border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading menu...</p>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-background min-h-screen px-4 text-center">
        <AlertCircle className="w-16 h-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Could Not Load Menu</h2>
        <p className="text-muted-foreground max-w-sm mb-6">
          {error || 'The restaurant configuration could not be loaded.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Filter items based on search and category
  const filteredCategories = restaurant.categories
    .map((category) => {
      const items = category.menuItems.filter((item) => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesSearch;
      });
      return { ...category, menuItems: items };
    })
    .filter((category) => {
      if (selectedCategory === 'all') return category.menuItems.length > 0;
      return category.id === selectedCategory && category.menuItems.length > 0;
    });

  const getCartQuantity = (itemId: string) => {
    return cart.find((i) => i.menuItemId === itemId)?.quantity || 0;
  };

  return (
    <div className="flex-1 bg-background min-h-screen pb-28 font-sans antialiased text-foreground relative overflow-x-hidden">
      {/* Background Glows for Premium Vibe */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full filter blur-3xl pointer-events-none -translate-y-1/2"></div>
      <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-primary/3 rounded-full filter blur-3xl pointer-events-none"></div>

      {/* Restaurant Header */}
      <div className="glassmorphism-header sticky top-0 z-20 transition-all duration-300">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            {restaurant.logoUrl && (
              <div className="relative w-11 h-11 rounded-full overflow-hidden border border-border shadow-sm flex-shrink-0 bg-muted/20">
                <img
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="object-cover w-full h-full"
                />
              </div>
            )}
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-foreground">{restaurant.name}</h1>
              <p className="text-[11px] text-muted-foreground font-medium">{restaurant.tagline}</p>
            </div>
          </div>
          <div className="bg-primary/5 px-3 py-1.5 rounded-full border border-primary/10 flex items-center gap-1.5 backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Table 01</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 relative z-10">
        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/85 transition-colors" />
          <input
            type="text"
            placeholder="Search for dishes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card text-sm pl-11 pr-4 py-3 rounded-2xl border border-border focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 focus:outline-none transition-all duration-200 premium-shadow"
          />
        </div>

        {/* Categories Bar */}
        <div className="flex gap-2.5 overflow-x-auto pb-4 scrollbar-none -mx-4 px-4 sticky top-[77px] bg-background/90 backdrop-blur-md z-25 border-b border-transparent">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4.5 py-2.5 rounded-xl text-[11px] uppercase font-extrabold tracking-wider whitespace-nowrap transition-all duration-300 border ${
              selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-102'
                : 'bg-card text-muted-foreground border-border hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            All Items
          </button>
          {restaurant.categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4.5 py-2.5 rounded-xl text-[11px] uppercase font-extrabold tracking-wider whitespace-nowrap transition-all duration-300 border ${
                selectedCategory === category.id
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm scale-102'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted/40 hover:text-foreground'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Menu Items List */}
        <div className="space-y-10 mt-6">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-20 bg-card/40 border border-border/60 rounded-3xl p-8 backdrop-blur-sm">
              <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm font-medium">No items found matching your filter.</p>
            </div>
          ) : (
            filteredCategories.map((category) => (
              <div key={category.id} className="space-y-4">
                <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground/80 border-b border-border/80 pb-2">
                  {category.name}
                </h2>
                <div className="grid gap-5">
                  {category.menuItems.map((item) => {
                    const qty = getCartQuantity(item.id);
                    return (
                      <div
                        key={item.id}
                        className="bg-card border border-border p-4.5 rounded-2xl flex gap-4 hover:border-foreground/20 transition-all duration-300 relative overflow-hidden premium-shadow premium-shadow-hover"
                      >
                        {/* Food Info */}
                        <div className="flex-1 flex flex-col justify-between py-0.5">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-[15px] leading-snug text-foreground">{item.name}</h3>
                              {!item.isAvailable && (
                                <span className="bg-destructive/8 text-destructive text-[8px] px-2 py-0.5 rounded-full font-extrabold uppercase border border-destructive/12 tracking-wide">
                                  Sold Out
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground/85 mt-1.5 line-clamp-2 pr-2 leading-relaxed">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <div className="mt-4 flex items-center">
                            <span className="font-extrabold text-[15px] text-foreground tracking-tight">
                              ₹{item.price}
                            </span>
                          </div>
                        </div>

                        {/* Image & Add Button */}
                        <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-muted/30 flex-shrink-0 border border-border/40 shadow-inner">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="object-cover w-full h-full transition-transform duration-500 hover:scale-105"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground/60 font-semibold bg-gradient-to-br from-muted/5 to-muted/20">
                              No Image
                            </div>
                          )}

                          {item.isAvailable && (
                            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 shadow-lg rounded-xl overflow-hidden border border-border/80 bg-card backdrop-blur-md">
                              {qty > 0 ? (
                                <div className="flex items-center bg-card/90">
                                  <button
                                    onClick={() => removeFromCart(item.id)}
                                    className="p-1.5 px-3 hover:bg-muted text-foreground transition-colors"
                                  >
                                    <Minus className="w-3 h-3 stroke-[2.5]" />
                                  </button>
                                  <span className="text-[11px] font-extrabold px-1 min-w-[18px] text-center text-foreground">
                                    {qty}
                                  </span>
                                  <button
                                    onClick={() =>
                                      addToCart({
                                        menuItemId: item.id,
                                        name: item.name,
                                        price: item.price,
                                        imageUrl: item.imageUrl || undefined,
                                      })
                                    }
                                    className="p-1.5 px-3 hover:bg-muted text-foreground transition-colors"
                                  >
                                    <Plus className="w-3 h-3 stroke-[2.5]" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    addToCart({
                                      menuItemId: item.id,
                                      name: item.name,
                                      price: item.price,
                                      imageUrl: item.imageUrl || undefined,
                                    })
                                  }
                                  className="flex items-center gap-1 bg-card/95 px-5 py-2 hover:bg-muted text-[10px] font-extrabold text-foreground tracking-wider transition-colors"
                                >
                                  ADD
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Floating Bottom Cart Bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-5 left-4 right-4 z-30 max-w-xl mx-auto animate-in slide-in-from-bottom duration-300">
          <div
            onClick={() => router.push('/checkout')}
            className="bg-primary text-primary-foreground rounded-2xl shadow-xl border border-primary-foreground/5 p-4 flex items-center justify-between cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 glow-primary"
          >
            <div className="flex items-center gap-3.5">
              <div className="bg-primary-foreground/10 p-2.5 rounded-xl border border-primary-foreground/10">
                <ShoppingBag className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold tracking-wider opacity-75">{totalItems} item{totalItems > 1 ? 's' : ''} added</p>
                <p className="font-extrabold text-[15px] tracking-tight">₹{totalPrice}</p>
              </div>
            </div>
            <span className="text-[11px] font-extrabold flex items-center gap-1.5 uppercase tracking-widest text-primary-foreground border border-primary-foreground/15 px-4 py-2 rounded-xl bg-primary-foreground/5 hover:bg-primary-foreground/10 transition-colors">
              Checkout →
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
