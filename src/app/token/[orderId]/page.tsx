'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, CheckCircle2, Clock, CookingPot, Check, AlertTriangle, Printer } from 'lucide-react';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  menuItem: {
    name: string;
  };
}

interface Order {
  id: string;
  tokenNumber: string;
  customerName: string | null;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  printStatus: string;
  items: OrderItem[];
  createdAt: string;
}

export default function TokenPage({ params }: { params: Promise<{ orderId: string }> }) {
  const router = useRouter();
  const { orderId } = use(params);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // 1. Fetch initial order status
  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (!res.ok) {
          throw new Error('Order not found');
        }
        const data = await res.json();
        setOrder(data.order);
        setLoading(false);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load order status.';
        console.error(err);
        setError(errorMsg);
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderId]);

  // 2. Setup WebSocket real-time listener
  useEffect(() => {
    if (!order) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    let socket: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    function connect() {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setWsConnected(true);
        // Register as admin to receive ORDER_UPDATED events
        socket.send(JSON.stringify({ type: 'init', role: 'admin' }));
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.event === 'ORDER_UPDATED' && payload.data.id === orderId) {
            console.log('[WS Update] Received updated order details:', payload.data);
            setOrder(payload.data);
          }
        } catch (e) {
          console.error('[WS Message Parse Error]', e);
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
        console.log('[WS] Connection closed. Retrying in 3s...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error('[WS Error]', err);
        socket.close();
      };
    }

    connect();

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [orderId, order]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-background min-h-screen">
        <div className="w-10 h-10 border-4 border-muted-foreground border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Retrieving order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-background min-h-screen px-4 text-center">
        <AlertTriangle className="w-14 h-14 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Order Not Found</h2>
        <p className="text-muted-foreground max-w-sm mb-6">
          The requested token page does not exist or has expired.
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2 bg-primary text-primary-foreground font-medium rounded-lg"
        >
          Go Back to Menu
        </button>
      </div>
    );
  }

  // Define steps
  // 1. Order Placed (Always true)
  // 2. Payment Verified (True if Cash & Paid, or UPI & Paid)
  // 3. Preparing in Kitchen (True if preparing or completed)
  // 4. Ready / Completed (True if completed)
  const isCashAwaiting = order.paymentMethod === 'CASH' && order.paymentStatus === 'PENDING';
  const isPaid = order.paymentStatus === 'COMPLETED';
  const isPreparing = order.orderStatus === 'PREPARING';
  const isCompleted = order.orderStatus === 'COMPLETED';

  return (
    <div className="flex-1 bg-background min-h-screen pb-20 font-sans antialiased text-foreground relative overflow-x-hidden">
      {/* Background Glows for Premium Vibe */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full filter blur-3xl pointer-events-none -translate-y-1/2"></div>
      <div className="absolute bottom-10 right-1/4 w-80 h-80 bg-primary/3 rounded-full filter blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="glassmorphism-header sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-all duration-200 border border-transparent hover:border-border/60 px-3 py-1.5 rounded-xl bg-muted/20"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Order Menu</span>
          </button>
          <div className="flex items-center gap-2 bg-card/60 border border-border/60 px-3 py-1.5 rounded-xl backdrop-blur-sm">
            <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">
              {wsConnected ? 'Live Connection' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 mt-8 relative z-10">
        <div className="text-center space-y-5">
          <div className="inline-flex bg-primary/5 border border-primary/10 px-4.5 py-1.5 rounded-full">
            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Table 01 • Order Token</span>
          </div>
          
          {/* Big Token ID Display */}
          <div className="relative inline-block mt-2">
            <div className="absolute inset-0 bg-primary/5 rounded-3xl filter blur-xl animate-pulse"></div>
            <div className="relative bg-card border-2 border-primary/10 rounded-3xl px-16 py-9 shadow-md glow-primary">
              <span className="text-5xl font-black tracking-tight text-primary">
                #{order.tokenNumber}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-xl font-black tracking-tight">
              {isCompleted
                ? 'Your Order is Ready!'
                : isPreparing
                ? 'Preparing in Kitchen'
                : isCashAwaiting
                ? 'Awaiting Cash Payment'
                : 'Order Confirmed'}
            </h1>
            <p className="text-xs text-muted-foreground/85 max-w-xs mx-auto leading-relaxed">
              {isCompleted
                ? 'Please collect your delicious food items from the serving counter.'
                : isPreparing
                ? 'Our chef is preparing your meal. KOT has been automatically printed.'
                : isCashAwaiting
                ? 'Please pay cash at the restaurant counter to start order preparation.'
                : 'Waiting for automatic server processing.'}
            </p>
          </div>
        </div>

        {/* Status Pipeline Visualiser */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm mt-8 space-y-6 premium-shadow">
          <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground border-b border-border/60 pb-2.5">
            Order Status
          </h2>

          <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2.5 before:bottom-2.5 before:w-0.5 before:bg-border/60">
            {/* Step 1: Placed */}
            <div className="relative flex gap-4.5">
              <div className="absolute -left-[30px] w-5.5 h-5.5 rounded-full border border-primary bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                <Check className="w-3 h-3 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-extrabold text-[13px] text-foreground tracking-tight">Order Placed</h3>
                <p className="text-[10px] text-muted-foreground/80 font-medium mt-0.5">Order recorded on system</p>
              </div>
            </div>

            {/* Step 2: Payment */}
            <div className="relative flex gap-4.5">
              <div className={`absolute -left-[30px] w-5.5 h-5.5 rounded-full border flex items-center justify-center shadow-sm transition-colors duration-300 ${
                isPaid 
                  ? 'border-primary bg-primary text-primary-foreground' 
                  : 'border-border bg-card text-muted-foreground'
              }`}>
                {isPaid ? <Check className="w-3 h-3 stroke-[2.5]" /> : <Clock className="w-3 h-3 stroke-[2.5] animate-pulse text-amber-500" />}
              </div>
              <div>
                <h3 className={`font-extrabold text-[13px] tracking-tight transition-colors duration-300 ${isPaid ? 'text-foreground' : 'text-muted-foreground'}`}>
                  Payment Verified
                </h3>
                <p className="text-[10px] text-muted-foreground/80 font-medium mt-0.5">
                  {order.paymentMethod === 'UPI' 
                    ? 'UPI payment completed' 
                    : isPaid 
                    ? 'Cash payment confirmed by cashier' 
                    : 'Awaiting cash confirmation at counter'}
                </p>
              </div>
            </div>

            {/* Step 3: Preparing */}
            <div className="relative flex gap-4.5">
              <div className={`absolute -left-[30px] w-5.5 h-5.5 rounded-full border flex items-center justify-center shadow-sm transition-colors duration-300 ${
                isCompleted || isPreparing
                  ? 'border-primary bg-primary text-primary-foreground' 
                  : 'border-border bg-card text-muted-foreground'
              }`}>
                {isCompleted ? (
                  <Check className="w-3 h-3 stroke-[2.5]" />
                ) : isPreparing ? (
                  <CookingPot className="w-3 h-3 stroke-[2.5] animate-spin text-blue-500" />
                ) : (
                  <CookingPot className="w-3 h-3 stroke-[2.5]" />
                )}
              </div>
              <div>
                <h3 className={`font-extrabold text-[13px] tracking-tight transition-colors duration-300 ${isCompleted || isPreparing ? 'text-foreground' : 'text-muted-foreground'}`}>
                  Preparing Food
                </h3>
                <p className="text-[10px] text-muted-foreground/80 font-medium mt-0.5">
                  {isCompleted ? 'Preparation complete' : isPreparing ? 'Chef cooking your order' : 'Pending payment confirmation'}
                </p>
              </div>
            </div>

            {/* Step 4: Completed */}
            <div className="relative flex gap-4.5">
              <div className={`absolute -left-[30px] w-5.5 h-5.5 rounded-full border flex items-center justify-center shadow-sm transition-colors duration-300 ${
                isCompleted 
                  ? 'border-primary bg-primary text-primary-foreground' 
                  : 'border-border bg-card text-muted-foreground'
              }`}>
                {isCompleted ? <CheckCircle2 className="w-3 h-3 stroke-[2.5]" /> : <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />}
              </div>
              <div>
                <h3 className={`font-extrabold text-[13px] tracking-tight transition-colors duration-300 ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                  Served & Completed
                </h3>
                <p className="text-[10px] text-muted-foreground/80 font-medium mt-0.5">Collect and enjoy your meal</p>
              </div>
            </div>
          </div>
        </div>

        {/* Order Details Accordion / Summary Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm mt-6 space-y-4 premium-shadow">
          <div className="flex justify-between items-center pb-2 border-b border-border">
            <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              Items Ordered
            </h2>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase bg-secondary px-2.5 py-1.5 rounded-xl border border-border">
              <Printer className="w-3 h-3 stroke-[2.5]" />
              <span>
                KOT: {order.printStatus === 'PRINTED' ? 'Printed' : order.printStatus === 'FAILED' ? 'Failed' : 'Pending'}
              </span>
            </div>
          </div>

          <div className="divide-y divide-border/60">
            {order.items.map((item) => (
              <div key={item.id} className="py-2.5 flex justify-between text-xs first:pt-0 last:pb-0 font-medium">
                <div className="flex gap-2">
                  <span className="font-extrabold text-foreground">{item.quantity}x</span>
                  <span className="text-muted-foreground/90">{item.menuItem.name}</span>
                </div>
                <span className="font-extrabold text-foreground">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-border/80 pt-4 flex justify-between font-extrabold text-sm">
            <span>Total Bill Paid</span>
            <span className="text-foreground">₹{order.totalAmount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
