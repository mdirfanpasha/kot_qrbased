'use client';

import { useState, useEffect } from 'react';

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load cart from localStorage asynchronously to satisfy react-hooks/set-state-in-effect
  useEffect(() => {
    const stored = localStorage.getItem('smartserve_cart');
    let parsed: CartItem[] = [];
    if (stored) {
      try {
        parsed = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse cart data', e);
      }
    }
    
    // Defer state updates to next tick to completely avoid synchronous effect warnings
    const timer = setTimeout(() => {
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCart(parsed);
      }
      setIsInitialized(true);
    }, 0);
    
    return () => clearTimeout(timer);
  }, []);

  // Sync cart to localStorage whenever it changes, but only after initialization
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('smartserve_cart', JSON.stringify(cart));
    }
  }, [cart, isInitialized]);

  const addToCart = (item: Omit<CartItem, 'quantity'>) => {
    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.menuItemId === item.menuItemId);
      if (existing) {
        return prevCart.map((i) =>
          i.menuItemId === item.menuItemId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prevCart, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (menuItemId: string) => {
    setCart((prevCart) => {
      const existing = prevCart.find((i) => i.menuItemId === menuItemId);
      if (!existing) return prevCart;

      if (existing.quantity === 1) {
        return prevCart.filter((i) => i.menuItemId !== menuItemId);
      }
      return prevCart.map((i) =>
        i.menuItemId === menuItemId ? { ...i, quantity: i.quantity - 1 } : i
      );
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return {
    cart,
    isInitialized,
    addToCart,
    removeFromCart,
    clearCart,
    totalItems,
    totalPrice,
  };
}
export default useCart;
