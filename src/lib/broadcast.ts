const WS_SERVER_URL = process.env.WS_SERVER_URL || 'http://localhost:3001';
const WS_SHARED_SECRET = process.env.WS_SHARED_SECRET || 'smartserve-secret-key-123';

/**
 * Broadcasts an event to the local/remote WebSocket proxy server.
 * This server will forward the event to connected Admin Dashboards
 * and the Restaurant Connector client for automatic printing.
 */
export async function broadcastEvent(event: string, data: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${WS_SERVER_URL}/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WS_SHARED_SECRET}`,
      },
      body: JSON.stringify({ event, data }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Broadcast Error] Status: ${res.status}, Response: ${text}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[Broadcast Connection Error] Failed to contact WS server:', err);
    return false;
  }
}
