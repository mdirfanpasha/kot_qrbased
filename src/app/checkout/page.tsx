/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CreditCard, DollarSign, Loader2, AlertCircle } from 'lucide-react';
import { useCart } from '@/hooks/useCart';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, isInitialized, totalItems, totalPrice, removeFromCart, addToCart, clearCart } = useCart();

  const [customerName, setCustomerName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH'>('UPI');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prevent accessing checkout if cart is empty after initialization
  useEffect(() => {
    if (isInitialized && totalItems === 0) {
      router.push('/');
    }
  }, [isInitialized, totalItems, router]);

  if (!isInitialized) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-background min-h-screen">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
        <p className="text-muted-foreground text-sm font-medium">Initializing checkout...</p>
      </div>
    );
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Structure checkout payload
      const payload = {
        customerName: customerName.trim(),
        paymentMethod,
        items: cart.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
        })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong during checkout.');
      }

      // Success - clear cart and redirect to token screen
      clearCart();
      router.push(`/token/${data.order.id}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Checkout failed. Please try again.';
      console.error(err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-background min-h-screen pb-20 font-sans antialiased text-foreground relative overflow-x-hidden">
      {/* Background Glows for Premium Vibe */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full filter blur-3xl pointer-events-none -translate-y-1/2"></div>
      <div className="absolute bottom-10 left-1/4 w-80 h-80 bg-primary/3 rounded-full filter blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="glassmorphism-header sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="p-2 -ml-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 border border-transparent hover:border-border/60"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
          <h1 className="text-base font-extrabold tracking-tight text-foreground">Checkout Details</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 relative z-10">
        <div className="grid gap-6">
          {/* Order Summary Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm premium-shadow">
            <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground mb-4 border-b border-border/60 pb-2">
              Order Summary
            </h2>
            <div className="divide-y divide-border/60">
              {cart.map((item) => (
                <div key={item.menuItemId} className="py-4 flex gap-4 first:pt-0 last:pb-0">
                  {item.imageUrl ? (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted/40 flex-shrink-0 border border-border/40">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="object-cover w-full h-full"
                      />
                    </div>
                  ) : null}
                  <div className="flex-1 flex flex-col justify-between py-0.5">
                    <div>
                      <h3 className="font-bold text-[14px] leading-snug text-foreground">{item.name}</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">₹{item.price} each</p>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-border/80 rounded-xl bg-card overflow-hidden">
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.menuItemId)}
                          className="px-3 py-1 hover:bg-muted text-foreground text-[10px] font-extrabold transition-colors border-r border-border/80"
                        >
                          -
                        </button>
                        <span className="text-[11px] font-extrabold px-3.5 text-foreground">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() =>
                            addToCart({
                              menuItemId: item.menuItemId,
                              name: item.name,
                              price: item.price,
                              imageUrl: item.imageUrl,
                            })
                          }
                          className="px-3 py-1 hover:bg-muted text-foreground text-[10px] font-extrabold transition-colors border-l border-border/80"
                        >
                          +
                        </button>
                      </div>
                      <span className="font-extrabold text-[14px] text-foreground">
                        ₹{item.price * item.quantity}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border mt-5 pt-4 space-y-2.5">
              <div className="flex justify-between text-xs text-muted-foreground font-medium">
                <span>Subtotal</span>
                <span>₹{totalPrice}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground font-medium">
                <span>Taxes & service charge</span>
                <span>₹0.00</span>
              </div>
              <div className="flex justify-between font-extrabold text-base pt-1.5 border-t border-dashed border-border/80 mt-1">
                <span>Total Amount</span>
                <span className="text-foreground">₹{totalPrice}</span>
              </div>
            </div>
          </div>

          {/* Checkout Details Form */}
          <form onSubmit={handleCheckout} className="space-y-6">
            {/* Customer Information (the "Login/Details Card") */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm premium-shadow space-y-4">
              <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-2">
                Customer Details
              </h2>
              <div className="space-y-2">
                <label htmlFor="name" className="text-[11px] font-bold text-muted-foreground/90 uppercase tracking-wide">
                  Your Name <span className="text-destructive">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  placeholder="Enter your name (e.g. John)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-background/50 text-sm px-4 py-3 rounded-2xl border border-border focus:border-foreground/40 focus:ring-1 focus:ring-foreground/20 focus:outline-none transition-all duration-200 premium-shadow"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-sm premium-shadow space-y-4">
              <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-2">
                Choose Payment Method
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                {/* UPI Card Option */}
                <div
                  onClick={() => setPaymentMethod('UPI')}
                  className={`border rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 premium-shadow-hover ${
                    paymentMethod === 'UPI'
                      ? 'border-primary bg-primary/[0.02] ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/10'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-primary/5 rounded-xl border border-primary/10 text-foreground">
                      <CreditCard className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors duration-200 ${
                      paymentMethod === 'UPI' ? 'border-primary bg-primary' : 'border-border'
                    }`}>
                      {paymentMethod === 'UPI' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                      )}
                    </div>
                  </div>
                  <div className="mt-5">
                    <h3 className="font-extrabold text-[13px] text-foreground tracking-tight">UPI Payment</h3>
                    <p className="text-[10px] text-muted-foreground/80 font-medium mt-0.5">Pay online instantly</p>
                  </div>
                </div>

                {/* Cash Card Option */}
                <div
                  onClick={() => setPaymentMethod('CASH')}
                  className={`border rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 premium-shadow-hover ${
                    paymentMethod === 'CASH'
                      ? 'border-primary bg-primary/[0.02] ring-1 ring-primary'
                      : 'border-border bg-card hover:bg-muted/10'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="p-2 bg-primary/5 rounded-xl border border-primary/10 text-foreground">
                      <DollarSign className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div className={`w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-colors duration-200 ${
                      paymentMethod === 'CASH' ? 'border-primary bg-primary' : 'border-border'
                    }`}>
                      {paymentMethod === 'CASH' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                      )}
                    </div>
                  </div>
                  <div className="mt-5">
                    <h3 className="font-extrabold text-[13px] text-foreground tracking-tight">Pay with Cash</h3>
                    <p className="text-[10px] text-muted-foreground/80 font-medium mt-0.5">Pay at counter to prepare</p>
                  </div>
                </div>
              </div>

              {paymentMethod === 'UPI' && (
                <div className="bg-primary/5 border border-primary/10 p-3.5 rounded-2xl text-[11px] text-muted-foreground leading-relaxed animate-in fade-in duration-300">
                  <span className="font-extrabold text-foreground block mb-0.5">Instant Automated Processing</span>
                  UPI payments verify instantly. Once payment is simulated, your KOT prints at the kitchen automatically.
                </div>
              )}

              {paymentMethod === 'CASH' && (
                <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-2xl text-[11px] text-muted-foreground leading-relaxed animate-in fade-in duration-300">
                  <span className="font-extrabold text-amber-600 dark:text-amber-400 block mb-0.5">Payment at Counter Required</span>
                  Your order status will be <span className="font-semibold">Awaiting Payment</span>. KOT printing starts ONLY after the cashier confirms payment.
                </div>
              )}
            </div>

            {error && (
              <div className="bg-destructive/5 border border-destructive/15 p-4 rounded-2xl flex items-start gap-3 text-destructive text-xs">
                <AlertCircle className="w-4.5 h-4.5 flex-shrink-0 mt-0.5" />
                <p className="font-semibold">{error}</p>
              </div>
            )}

            {/* Checkout CTA */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-extrabold hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm tracking-wider uppercase border border-primary-foreground/5 shadow-md"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Order...</span>
                </>
              ) : (
                <span>Confirm & Place Order (₹{totalPrice})</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
