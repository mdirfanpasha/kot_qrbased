/* eslint-disable */
const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');
require('dotenv').config();

const PORT = process.env.WS_PORT || 3001;
const SHARED_SECRET = process.env.WS_SHARED_SECRET || 'smartserve-secret-key-123';

// Cache for printer status
let printerStatus = {
  status: 'OFFLINE',
  details: null,
  lastPing: null,
};

// Maps of active connections
const admins = new Set();
const connectors = new Set();

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // HTTP endpoint to broadcast events from Next.js serverless functions
  if (req.method === 'POST' && req.url === '/api/broadcast') {
    // Auth Check
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${SHARED_SECRET}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { event, data } = payload;

        if (!event || !data) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing event or data' }));
          return;
        }

        console.log(`[HTTP Broadcast] Event: ${event}`);

        // Broadcast to clients based on event type
        const messageStr = JSON.stringify({ event, data });

        if (event === 'NEW_ORDER_READY') {
          // Send to connectors to print, and admins to display
          connectors.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ event: 'PRINT_KOT', data }));
            }
          });
          admins.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(messageStr);
            }
          });
        } else {
          // Generic broadcast to admin dashboards
          admins.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(messageStr);
            }
          });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('[HTTP Broadcast Error]', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'UP',
      adminsConnected: admins.size,
      connectorsConnected: connectors.size,
      printerStatus: printerStatus,
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let role = null;
  console.log('[WS] Client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'init') {
        role = data.role;
        if (role === 'admin') {
          admins.add(ws);
          console.log(`[WS] Admin dashboard connected. Total: ${admins.size}`);
          
          // Send current printer status to newly connected admin
          ws.send(JSON.stringify({
            event: 'PRINTER_STATUS_CHANGE',
            data: printerStatus,
          }));
        } else if (role === 'connector') {
          connectors.add(ws);
          console.log(`[WS] Restaurant connector connected. Total: ${connectors.size}`);
          
          // Update printer status
          printerStatus = {
            status: 'ONLINE',
            details: data.details || null,
            lastPing: Date.now(),
          };
          broadcastToAdmins('PRINTER_STATUS_CHANGE', printerStatus);
        }
      }

      // Handle status pings from connector
      if (role === 'connector' && data.type === 'status_ping') {
        printerStatus = {
          status: data.printerConnected ? 'ONLINE' : 'OFFLINE',
          details: data.details || null,
          lastPing: Date.now(),
        };
        broadcastToAdmins('PRINTER_STATUS_CHANGE', printerStatus);
      }

      // Handle print success/failure receipts from connector
      if (role === 'connector' && (data.type === 'print_success' || data.type === 'print_failure')) {
        console.log(`[WS] Print result: ${data.type} for order ${data.orderId}`);
        
        // Broadcast the print receipt to admins so the order card updates
        broadcastToAdmins(data.type === 'print_success' ? 'PRINT_SUCCESS' : 'PRINT_FAILURE', {
          orderId: data.orderId,
          error: data.error || null,
        });

        // Also notify Next.js backend via an internal update API route
        // This keeps the database in sync.
        updateOrderPrintStatus(data.orderId, data.type === 'print_success' ? 'PRINTED' : 'FAILED', data.error);
      }
      
    } catch (err) {
      console.error('[WS Message Error]', err);
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected. Role: ${role}`);
    if (role === 'admin') {
      admins.delete(ws);
    } else if (role === 'connector') {
      connectors.delete(ws);
      console.log('[WS] Restaurant connector disconnected');
      
      // Update printer status to offline
      printerStatus = {
        status: 'OFFLINE',
        details: null,
        lastPing: Date.now(),
      };
      broadcastToAdmins('PRINTER_STATUS_CHANGE', printerStatus);
    }
  });

  ws.on('error', (err) => {
    console.error('[WS Client Error]', err);
  });
});

function broadcastToAdmins(event, data) {
  const messageStr = JSON.stringify({ event, data });
  admins.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(messageStr);
    }
  });
}

// Function to call Next.js API to update database
function updateOrderPrintStatus(orderId, status, errorMessage) {
  const nextApiUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const postData = JSON.stringify({ orderId, status, error: errorMessage });
  
  const options = {
    hostname: new URL(nextApiUrl).hostname,
    port: new URL(nextApiUrl).port || (new URL(nextApiUrl).protocol === 'https:' ? 443 : 80),
    path: '/api/orders/print-status',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Authorization': `Bearer ${SHARED_SECRET}`, // Secure authorization token
    },
  };

  const req = http.request(options, (res) => {
    let responseBody = '';
    res.on('data', (chunk) => { responseBody += chunk; });
    res.on('end', () => {
      if (res.statusCode !== 200) {
        console.error(`[WS -> Next.js API] Failed to update print status. Code: ${res.statusCode}, Body: ${responseBody}`);
      } else {
        console.log(`[WS -> Next.js API] Updated order ${orderId} print status to ${status}`);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[WS -> Next.js API Error] Request failed: ${err.message}`);
  });

  req.write(postData);
  req.end();
}

// Check for connector timeout every 10 seconds
setInterval(() => {
  if (printerStatus.status === 'ONLINE' && printerStatus.lastPing) {
    const elapsed = Date.now() - printerStatus.lastPing;
    if (elapsed > 25000) { // No ping for 25 seconds
      console.log('[WS Monitor] Connector connection timed out.');
      printerStatus = {
        status: 'OFFLINE',
        details: null,
        lastPing: Date.now(),
      };
      broadcastToAdmins('PRINTER_STATUS_CHANGE', printerStatus);
    }
  }
}, 10000);

server.listen(PORT, () => {
  console.log(`[WS Server] Listening on http://localhost:${PORT}`);
});
