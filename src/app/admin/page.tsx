/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import { 
  Clock, CookingPot, CheckCircle2, 
  Printer, DollarSign, Settings, Plus, Trash2, 
  Check, AlertTriangle, RefreshCw
} from 'lucide-react';

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
  printAttempts: number;
  createdAt: string;
  items: OrderItem[];
}

interface Category {
  id: string;
  name: string;
}

interface PopularItem {
  name: string;
  count: number;
  revenue: number;
}

interface Stats {
  revenue: number;
  completedOrders: number;
  preparingOrders: number;
  pendingCashOrders: number;
  popularItems: PopularItem[];
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'reports' | 'settings'>('orders');
  
  // Real-time states
  const [orders, setOrders] = useState<Order[]>([]);
  const [printerStatus, setPrinterStatus] = useState<{ status: string; details: { type?: string; target?: string } | null; lastPing?: number }>({ status: 'OFFLINE', details: null });
  const [wsConnected, setWsConnected] = useState(false);
  
  // Menu panel states
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<{ id: string; name: string; price: number; imageUrl: string | null; isAvailable: boolean; categoryName: string }[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newItemData, setNewItemData] = useState({ name: '', description: '', price: '', imageUrl: '', categoryId: '' });
  
  // Analytical stats state
  const [stats, setStats] = useState<Stats>({ revenue: 0, completedOrders: 0, preparingOrders: 0, pendingCashOrders: 0, popularItems: [] });
  
  // General UI states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 1. Fetch initial orders, categories, items, and stats on mount
  useEffect(() => {
    async function initDashboard() {
      try {
        const [ordersRes, menuRes, statsRes] = await Promise.all([
          fetch('/api/orders'),
          fetch('/api/menu'),
          fetch('/api/admin/stats')
        ]);
        
        const ordersData = await ordersRes.json();
        const menuData = await menuRes.json();
        const statsData = await statsRes.json();
        
        setOrders(ordersData.orders || []);
        if (menuData.restaurant) {
          setCategories(menuData.restaurant.categories.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
          // Flatten items
          const items: { id: string; name: string; price: number; imageUrl: string | null; isAvailable: boolean; categoryName: string }[] = [];
          menuData.restaurant.categories.forEach((c: { name: string; menuItems: { id: string; name: string; price: number; imageUrl: string | null; isAvailable: boolean }[] }) => {
            c.menuItems.forEach((m) => {
              items.push({ ...m, categoryName: c.name });
            });
          });
          setMenuItems(items);
          if (menuData.restaurant.categories.length > 0 && !newItemData.categoryId) {
            setNewItemData(prev => ({ ...prev, categoryId: menuData.restaurant.categories[0].id }));
          }
        }
        setStats(statsData);
        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize dashboard', err);
        setLoading(false);
      }
    }
    initDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh stats helper
  const refreshStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to refresh stats', err);
    }
  };

  // 2. Setup WS real-time connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    let socket: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;

    function connect() {
      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        setWsConnected(true);
        console.log('[Admin WS] Connected to proxy server');
        socket.send(JSON.stringify({ type: 'init', role: 'admin' }));
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.event === 'PRINTER_STATUS_CHANGE') {
            setPrinterStatus(payload.data);
          } else if (payload.event === 'ORDER_CREATED') {
            // Add new order at the top
            setOrders(prev => [payload.data, ...prev]);
            refreshStats();
          } else if (payload.event === 'NEW_ORDER_READY') {
            // A UPI order is confirmed, replace or add
            setOrders(prev => {
              const exists = prev.some(o => o.id === payload.data.id);
              if (exists) {
                return prev.map(o => o.id === payload.data.id ? payload.data : o);
              }
              return [payload.data, ...prev];
            });
            refreshStats();
          } else if (payload.event === 'ORDER_UPDATED') {
            // Update order details
            setOrders(prev => prev.map(o => o.id === payload.data.id ? payload.data : o));
            refreshStats();
          } else if (payload.event === 'PRINT_SUCCESS') {
            // Order was successfully printed
            setOrders(prev => prev.map(o => o.id === payload.data.orderId ? { ...o, printStatus: 'PRINTED' } : o));
          } else if (payload.event === 'PRINT_FAILURE') {
            // Order print failed
            setOrders(prev => prev.map(o => o.id === payload.data.orderId ? { ...o, printStatus: 'FAILED' } : o));
          }
        } catch (e) {
          console.error('[Admin WS Message Parse Error]', e);
        }
      };

      socket.onclose = () => {
        setWsConnected(false);
        console.log('[Admin WS] Closed. Reconnecting in 3s...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (err) => {
        console.error('[Admin WS Error]', err);
        socket.close();
      };
    }

    connect();

    return () => {
      if (socket) socket.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Action: Confirm Cash Payment
  const handleConfirmCash = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm-cash`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to confirm cash payment');
      // The local hook or WS server updates our state automatically.
    } catch (err) {
      console.error(err);
      alert('Error confirming cash payment');
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Complete / Serve Order
  const handleCompleteOrder = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: 'COMPLETED' }),
      });
      if (!res.ok) throw new Error('Failed to complete order');
      // Updated state will sync via WS
    } catch (err) {
      console.error(err);
      alert('Error completing order');
    } finally {
      setActionLoading(null);
    }
  };

  // Action: Toggle Menu Item Availability
  const handleToggleAvailability = async (itemId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/menu/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !currentStatus }),
      });
      if (!res.ok) throw new Error('Failed to toggle availability');
      const data = await res.json();
      setMenuItems(prev => prev.map(m => m.id === itemId ? { ...m, isAvailable: data.item.isAvailable } : m));
    } catch (err) {
      console.error(err);
      alert('Error updating item status');
    }
  };

  // Action: Delete Menu Item
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try {
      const res = await fetch(`/api/menu/${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete item');
      setMenuItems(prev => prev.filter(m => m.id !== itemId));
    } catch (err) {
      console.error(err);
      alert('Error deleting item');
    }
  };

  // Action: Create Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'category', name: newCatName.trim() }),
      });
      if (!res.ok) throw new Error('Failed to add category');
      const data = await res.json();
      setCategories(prev => [...prev, data.category]);
      setNewCatName('');
      if (!newItemData.categoryId) {
        setNewItemData(prev => ({ ...prev, categoryId: data.category.id }));
      }
    } catch (err) {
      console.error(err);
      alert('Error adding category');
    }
  };

  // Action: Create Menu Item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, price, categoryId } = newItemData;
    if (!name.trim() || !price || !categoryId) return;
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'item',
          name: name.trim(),
          description: newItemData.description.trim(),
          price: newItemData.price,
          imageUrl: newItemData.imageUrl.trim() || null,
          categoryId,
        }),
      });
      if (!res.ok) throw new Error('Failed to add item');
      const data = await res.json();
      const cat = categories.find(c => c.id === categoryId);
      setMenuItems(prev => [...prev, { ...data.item, categoryName: cat?.name || '' }]);
      setNewItemData({ name: '', description: '', price: '', imageUrl: '', categoryId: categoryId });
    } catch (err) {
      console.error(err);
      alert('Error adding menu item');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center bg-[#09090b] text-[#fafafa] min-h-screen">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Launching SmartServe Admin...</p>
      </div>
    );
  }

  // Filter orders for Live queues
  const awaitingCashOrders = orders.filter(
    (o) => o.paymentMethod === 'CASH' && o.paymentStatus === 'PENDING' && o.orderStatus !== 'CANCELLED'
  );
  const preparingOrders = orders.filter(
    (o) => o.orderStatus === 'PREPARING'
  );
  const completedOrders = orders.filter(
    (o) => o.orderStatus === 'COMPLETED'
  );

  return (
    <div className="flex-1 bg-[#fbfbfb] text-[#09090b] min-h-screen font-sans antialiased flex flex-col relative overflow-x-hidden">
      {/* Background ambient light */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-zinc-100/40 rounded-full filter blur-3xl pointer-events-none -translate-y-1/2"></div>
      
      {/* Admin Top Header */}
      <div className="border-b border-zinc-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4.5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="bg-zinc-50 p-2.5 rounded-xl border border-zinc-200 shadow-sm">
              <Settings className="w-4.5 h-4.5 text-zinc-700 stroke-[2]" />
            </div>
            <div>
              <h1 className="text-[15px] font-extrabold tracking-tight text-zinc-900 leading-snug">SmartServe Admin</h1>
              <p className="text-[10px] text-zinc-500 font-medium tracking-wide">Merchant Console & Real-time Kitchen Operations</p>
            </div>
          </div>

          {/* Connection Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* WS Proxy State */}
            <div className="flex items-center gap-2 bg-zinc-50/80 px-3.5 py-1.5 rounded-xl border border-zinc-200/60 backdrop-blur-sm shadow-sm">
              <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest">
                WS Proxy: {wsConnected ? 'Connected' : 'Offline'}
              </span>
            </div>

            {/* Printer State */}
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border backdrop-blur-sm shadow-sm ${
              printerStatus.status === 'ONLINE' 
                ? 'bg-emerald-500/8 border-emerald-500/15 text-emerald-700' 
                : 'bg-rose-500/8 border-rose-500/15 text-rose-600'
            }`}>
              <Printer className="w-3.5 h-3.5 stroke-[2]" />
              <span className="text-[9px] font-bold uppercase tracking-widest">
                Printer: {printerStatus.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Workspace Metrics Row */}
      <div className="max-w-7xl mx-auto w-full px-6 grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 relative z-10">
        <div className="bg-white border border-zinc-200 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:border-zinc-300/80 transition-all duration-300">
          <div>
            <p className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">Total Revenue</p>
            <h3 className="text-2xl font-black mt-1.5 tracking-tight text-zinc-900">₹{stats.revenue}</h3>
          </div>
          <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-600 shadow-sm">
            <DollarSign className="w-5 h-5 stroke-[2]" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:border-zinc-300/80 transition-all duration-300">
          <div>
            <p className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">Preparing (Kitchen)</p>
            <h3 className="text-2xl font-black mt-1.5 tracking-tight text-zinc-900">{stats.preparingOrders}</h3>
          </div>
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-600 shadow-sm">
            <CookingPot className="w-5 h-5 stroke-[2] animate-pulse" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:border-zinc-300/80 transition-all duration-300">
          <div>
            <p className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">Completed Orders</p>
            <h3 className="text-2xl font-black mt-1.5 tracking-tight text-zinc-900">{stats.completedOrders}</h3>
          </div>
          <div className="p-2.5 bg-zinc-100 rounded-xl border border-zinc-200 text-zinc-600 shadow-sm">
            <CheckCircle2 className="w-5 h-5 stroke-[2]" />
          </div>
        </div>

        <div className="bg-white border border-zinc-200 p-5 rounded-2xl flex items-center justify-between shadow-sm hover:border-zinc-300/80 transition-all duration-300">
          <div>
            <p className="text-[9px] uppercase font-bold tracking-widest text-zinc-500">Awaiting Cash</p>
            <h3 className="text-2xl font-black mt-1.5 tracking-tight text-zinc-900">{stats.pendingCashOrders}</h3>
          </div>
          <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-600 shadow-sm">
            <Clock className="w-5 h-5 stroke-[2]" />
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="max-w-7xl mx-auto w-full px-6 mt-8 flex border-b border-zinc-200">
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-5 py-3 font-extrabold text-[10px] uppercase tracking-wider border-b-2 transition-all duration-200 ${
            activeTab === 'orders' ? 'border-black text-black font-black' : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          Live Queues
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          className={`px-5 py-3 font-extrabold text-[10px] uppercase tracking-wider border-b-2 transition-all duration-200 ${
            activeTab === 'menu' ? 'border-black text-black font-black' : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          Menu Management
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-5 py-3 font-extrabold text-[10px] uppercase tracking-wider border-b-2 transition-all duration-200 ${
            activeTab === 'reports' ? 'border-black text-black font-black' : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          Sales Report
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-5 py-3 font-extrabold text-[10px] uppercase tracking-wider border-b-2 transition-all duration-200 ${
            activeTab === 'settings' ? 'border-black text-black font-black' : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          Connector Settings
        </button>
      </div>

      {/* Tab Panels */}
      <div className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 flex flex-col relative z-10">
        {/* PANEL: LIVE QUEUES */}
        {activeTab === 'orders' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
            {/* COLUMN 1: AWAITING PAYMENT */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col shadow-sm">
              <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 mb-4">
                <h2 className="font-extrabold text-[11px] uppercase tracking-wider text-amber-600 flex items-center gap-2">
                  <Clock className="w-4 h-4 stroke-[2]" />
                  <span>Awaiting Cash ({awaitingCashOrders.length})</span>
                </h2>
              </div>
              <div className="space-y-4 overflow-y-auto flex-1 max-h-[600px] scrollbar-none pr-1">
                {awaitingCashOrders.length === 0 ? (
                  <div className="text-center py-16 text-zinc-400 text-xs font-semibold">No pending cash orders.</div>
                ) : (
                  awaitingCashOrders.map((o) => (
                    <OrderCard 
                      key={o.id} 
                      order={o} 
                      actionText="Confirm Cash"
                      actionColor="bg-amber-500/10 hover:bg-amber-600 text-amber-700 hover:text-white border-amber-500/20"
                      onAction={() => handleConfirmCash(o.id)}
                      loading={actionLoading === o.id}
                    />
                  ))
                )}
              </div>
            </div>

            {/* COLUMN 2: PREPARING IN KITCHEN */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col shadow-sm">
              <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 mb-4">
                <h2 className="font-extrabold text-[11px] uppercase tracking-wider text-blue-600 flex items-center gap-2">
                  <CookingPot className="w-4 h-4 stroke-[2] animate-spin" />
                  <span>Preparing in Kitchen ({preparingOrders.length})</span>
                </h2>
              </div>
              <div className="space-y-4 overflow-y-auto flex-1 max-h-[600px] scrollbar-none pr-1">
                {preparingOrders.length === 0 ? (
                  <div className="text-center py-16 text-zinc-400 text-xs font-semibold">No active kitchen orders.</div>
                ) : (
                  preparingOrders.map((o) => (
                    <OrderCard 
                      key={o.id} 
                      order={o} 
                      actionText="Serve / Complete"
                      actionColor="bg-emerald-500/10 hover:bg-emerald-600 text-emerald-700 hover:text-white border-emerald-500/20"
                      onAction={() => handleCompleteOrder(o.id)}
                      loading={actionLoading === o.id}
                    />
                  ))
                )}
              </div>
            </div>

            {/* COLUMN 3: COMPLETED today */}
            <div className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col shadow-sm">
              <div className="flex items-center justify-between pb-3.5 border-b border-zinc-100 mb-4">
                <h2 className="font-extrabold text-[11px] uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 stroke-[2]" />
                  <span>Completed Today ({completedOrders.length})</span>
                </h2>
              </div>
              <div className="space-y-4 overflow-y-auto flex-1 max-h-[600px] scrollbar-none pr-1">
                {completedOrders.length === 0 ? (
                  <div className="text-center py-16 text-zinc-400 text-xs font-semibold">No completed orders today.</div>
                ) : (
                  completedOrders.map((o) => (
                    <OrderCard 
                      key={o.id} 
                      order={o}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* PANEL: MENU MANAGEMENT */}
        {activeTab === 'menu' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Adding Panels */}
            <div className="space-y-6">
              {/* Add Category Form */}
              <div className="bg-white border border-zinc-200 p-5 rounded-2xl space-y-4 shadow-sm">
                <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 border-b border-zinc-100 pb-2">Add Menu Category</h2>
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Starters"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1 bg-white text-xs px-3.5 py-3 rounded-xl border border-zinc-205 focus:border-zinc-400 focus:outline-none transition-colors text-zinc-900"
                  />
                  <button
                    type="submit"
                    className="bg-black text-white hover:opacity-90 font-extrabold px-4.5 py-3 rounded-xl text-xs flex items-center gap-1.5 shadow-sm active:scale-98 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Add</span>
                  </button>
                </form>
              </div>

              {/* Add Menu Item Form */}
              <div className="bg-white border border-zinc-200 p-5 rounded-2xl space-y-4 shadow-sm">
                <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 border-b border-zinc-100 pb-2">Add Menu Item</h2>
                <form onSubmit={handleAddItem} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-zinc-450 uppercase tracking-wider">Item Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Chicken Tikka"
                      value={newItemData.name}
                      onChange={(e) => setNewItemData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-white text-xs px-3.5 py-3 rounded-xl border border-zinc-205 focus:border-zinc-400 focus:outline-none transition-colors text-zinc-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-zinc-455 uppercase tracking-wider">Price (INR) *</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 299"
                        value={newItemData.price}
                        onChange={(e) => setNewItemData(prev => ({ ...prev, price: e.target.value }))}
                        className="w-full bg-white text-xs px-3.5 py-3 rounded-xl border border-zinc-205 focus:border-zinc-400 focus:outline-none transition-colors text-zinc-900"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-bold text-zinc-455 uppercase tracking-wider">Category *</label>
                      <select
                        value={newItemData.categoryId}
                        onChange={(e) => setNewItemData(prev => ({ ...prev, categoryId: e.target.value }))}
                        className="w-full bg-white text-xs px-3.5 py-3 rounded-xl border border-zinc-205 focus:border-zinc-400 focus:outline-none transition-colors text-zinc-900 h-[44px]"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-zinc-450 uppercase tracking-wider">Description</label>
                    <textarea
                      placeholder="Ingredients, serving size, etc."
                      value={newItemData.description}
                      onChange={(e) => setNewItemData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full bg-white text-xs px-3.5 py-3 rounded-xl border border-zinc-205 focus:border-zinc-400 focus:outline-none transition-colors min-h-[70px] text-zinc-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-bold text-zinc-450 uppercase tracking-wider">Image URL (Optional)</label>
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      value={newItemData.imageUrl}
                      onChange={(e) => setNewItemData(prev => ({ ...prev, imageUrl: e.target.value }))}
                      className="w-full bg-white text-xs px-3.5 py-3 rounded-xl border border-zinc-205 focus:border-zinc-400 focus:outline-none transition-colors text-zinc-900"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-black text-white hover:opacity-90 font-extrabold py-3.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all mt-2"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Create Menu Item</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Menu Items List Grid */}
            <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm flex flex-col h-[700px]">
              <div className="flex justify-between items-center pb-3.5 border-b border-zinc-100 mb-4">
                <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">All Dishes ({menuItems.length})</h2>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none">
                {menuItems.map((item) => (
                  <div key={item.id} className="bg-zinc-50/40 border border-zinc-200/80 p-3 rounded-2xl flex items-center justify-between gap-4 hover:border-zinc-300 transition-colors">
                    <div className="flex items-center gap-3.5">
                      {item.imageUrl && (
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 flex-shrink-0">
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-[13px] text-zinc-900">{item.name}</h3>
                        <p className="text-[10px] text-zinc-500 font-medium mt-0.5">{item.categoryName} • ₹{item.price}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Availability Switch */}
                      <button
                        onClick={() => handleToggleAvailability(item.id, item.isAvailable)}
                        className={`p-1.5 px-3 rounded-xl border transition-all duration-200 flex items-center gap-1.5 text-[9px] font-extrabold tracking-wider uppercase ${
                          item.isAvailable
                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 border-rose-500/25 text-rose-600 hover:bg-rose-500/20'
                        }`}
                      >
                        {item.isAvailable ? (
                          <>
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                            <span>Sold Out</span>
                          </>
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-2 bg-zinc-50 hover:bg-rose-500/10 hover:text-rose-600 border border-zinc-200 hover:border-rose-500/20 rounded-xl transition-all text-zinc-500 active:scale-95 shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PANEL: SALES REPORT */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
                <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400">Popular Dishes Breakdown</h2>
                <button 
                  onClick={refreshStats}
                  className="p-2 hover:bg-zinc-100 rounded-xl border border-zinc-200 text-zinc-500 hover:text-zinc-800 transition-colors active:scale-95 shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5 stroke-[2]" />
                </button>
              </div>

              {stats.popularItems.length === 0 ? (
                <div className="text-center py-20 text-zinc-400 text-xs font-semibold">No sales data recorded yet.</div>
              ) : (
                <div className="space-y-5">
                  {stats.popularItems.map((item, idx) => {
                    const maxCount = Math.max(...stats.popularItems.map((i) => i.count));
                    const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                      <div key={idx} className="space-y-2">
                        <div className="flex justify-between text-xs font-bold tracking-tight">
                          <span className="text-zinc-700">{item.name}</span>
                          <span className="text-zinc-900">{item.count} orders (₹{item.revenue})</span>
                        </div>
                        {/* Custom Pure CSS bar */}
                        <div className="w-full bg-zinc-100 rounded-full h-2.5 overflow-hidden border border-zinc-200">
                          <div 
                            className="bg-black h-full rounded-full transition-all duration-700" 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PANEL: CONNECTOR SETTINGS */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Connection instructions card */}
            <div className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 border-b border-zinc-100 pb-2">Setup Restaurant Connector</h2>
              <div className="space-y-3.5 text-xs leading-relaxed text-zinc-650">
                <p>
                  To enable automatic printing of Kitchen Order Tickets, run the local connector on your restaurant terminal computer.
                </p>
                <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 space-y-2.5">
                  <span className="font-extrabold text-zinc-400 block mb-1 uppercase text-[9px] tracking-wider">Configuration parameters:</span>
                  <p className="flex justify-between font-mono text-[11px]"><span className="text-zinc-500">WS Address:</span> <span className="text-zinc-900 font-bold">ws://localhost:3001</span></p>
                  <p className="flex justify-between font-mono text-[11px]"><span className="text-zinc-500">Shared Token:</span> <span className="text-zinc-900 font-bold">smartserve-secret-key-123</span></p>
                </div>
                <p className="text-[11px] text-zinc-450 font-medium leading-relaxed">
                  The connector is a lightweight Node.js service that communicates with standard ESC/POS thermal printers.
                </p>
              </div>
            </div>

            {/* Config details */}
            <div className="bg-white border border-zinc-200 p-5 rounded-2xl shadow-sm space-y-4">
              <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 border-b border-zinc-100 pb-2">Printer Details</h2>
              {printerStatus.status === 'ONLINE' ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-emerald-700 bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 text-xs shadow-sm">
                    <Check className="w-5 h-5 flex-shrink-0 stroke-[2.5]" />
                    <div>
                      <span className="font-extrabold block text-[13px] text-zinc-900">Printer Client Connected</span>
                      <p className="text-[11px] text-emerald-800/80 mt-0.5">Connector client is currently listening for printing events.</p>
                    </div>
                  </div>

                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200 space-y-2 text-xs leading-relaxed">
                    <p className="text-zinc-500 flex justify-between font-medium"><span>Connection Mode:</span> <span className="font-extrabold text-zinc-900 uppercase">{printerStatus.details?.type || 'Not Reported'}</span></p>
                    <p className="text-zinc-500 flex justify-between font-medium"><span>Printer Target:</span> <span className="font-mono text-zinc-900 font-bold">{printerStatus.details?.target || 'Not Reported'}</span></p>
                    <p className="text-zinc-500 flex justify-between font-medium"><span>Last Communication:</span> <span className="text-zinc-900 font-bold">{printerStatus.lastPing ? new Date(printerStatus.lastPing).toLocaleTimeString() : 'Never'}</span></p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-rose-600 bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10 text-xs shadow-sm">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 stroke-[2]" />
                    <div>
                      <span className="font-extrabold block text-[13px] text-zinc-900">No Printer Client Connected</span>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Print events will queue automatically and print when client is launched.</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-zinc-450 leading-relaxed">
                    Launch the connector client script on the kitchen terminal to automatically drain print queues.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component: Order Card
interface OrderCardProps {
  order: Order;
  actionText?: string;
  actionColor?: string;
  onAction?: () => void;
  loading?: boolean;
}

function OrderCard({ order, actionText, actionColor, onAction, loading }: OrderCardProps) {
  return (
    <div className="bg-zinc-50/50 border border-zinc-200 p-5 rounded-2xl space-y-4 shadow-sm hover:border-zinc-300 transition-all duration-300 animate-in fade-in zoom-in-95 duration-200">
      {/* Top row */}
      <div className="flex justify-between items-center">
        <span className="text-lg font-black tracking-tight text-zinc-900">#{order.tokenNumber}</span>
        <span className="text-[10px] text-zinc-500 font-bold tracking-wide">{new Date(order.createdAt).toLocaleTimeString()}</span>
      </div>

      {/* Items list */}
      <div className="divide-y divide-zinc-200/80 text-xs font-medium space-y-1">
        {order.items.map((item) => (
          <div key={item.id} className="py-2 flex justify-between first:pt-0 last:pb-0">
            <span className="text-zinc-700">{item.quantity}x {item.menuItem.name}</span>
            <span className="text-zinc-600">₹{item.price * item.quantity}</span>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="pt-3 border-t border-zinc-200/85 flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
        <span>₹{order.totalAmount} • {order.paymentMethod}</span>
        
        {/* Print status tag */}
        <div className="flex items-center gap-1.5">
          <Printer className="w-3.5 h-3.5 stroke-[2]" />
          <span className={
            order.printStatus === 'PRINTED' 
              ? 'text-emerald-700 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/15' 
              : order.printStatus === 'FAILED' 
              ? 'text-rose-700 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/15 animate-pulse'
              : 'text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/15'
          }>
            {order.printStatus === 'PRINTED' ? 'Printed' : order.printStatus === 'FAILED' ? `Failed (${order.printAttempts})` : 'Queueing'}
          </span>
        </div>
      </div>

      {/* Action button */}
      {onAction && actionText && (
        <button
          onClick={onAction}
          disabled={loading}
          className={`w-full py-2.5 rounded-xl font-extrabold text-[10px] uppercase tracking-widest border active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer ${actionColor}`}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <span>{actionText}</span>
          )}
        </button>
      )}
    </div>
  );
}

// Simple loader helper
function Loader2({ className }: { className?: string }) {
  return <RefreshCw className={`animate-spin ${className}`} />;
}
