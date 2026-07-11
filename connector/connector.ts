/* eslint-disable */
import WebSocket from 'ws';
import net from 'net';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configurations
const WS_URL = process.env.WS_URL || 'ws://localhost:3001';
const _SHARED_SECRET = process.env.WS_SHARED_SECRET || 'smartserve-secret-key-123';
const PRINTER_TYPE = process.env.PRINTER_TYPE || 'LAN'; // 'LAN' / 'Wi-Fi' use raw socket connection on port 9100
const PRINTER_TARGET = process.env.PRINTER_TARGET || '192.168.1.100:9100'; // IP:Port for LAN/Wireless, or device name for USB

interface OrderItem {
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
  items: OrderItem[];
  createdAt: string;
}

// Local print queue persistence to prevent ticket losses
const QUEUE_FILE = path.join(__dirname, 'print_queue.json');
let printQueue: Order[] = [];
let isProcessingQueue = false;
let isConnected = false;
let ws: WebSocket;

// Load queue from disk on startup
if (fs.existsSync(QUEUE_FILE)) {
  try {
    printQueue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    console.log(`[Queue Manager] Loaded ${printQueue.length} pending tickets from persistent disk.`);
  } catch (err) {
    console.error('[Queue Manager Error] Failed loading queue file:', err);
  }
}

function saveQueueToDisk() {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(printQueue, null, 2));
  } catch (err) {
    console.error('[Queue Manager Error] Failed writing queue to disk:', err);
  }
}

// ESC/POS command generators for 80mm standard thermal printers
const ESC = '\x1b';
const GS = '\x1d';
const CLEAN_KOT_PRINT = {
  init: () => `${ESC}@`,
  alignCenter: () => `${ESC}a\x01`,
  alignLeft: () => `${ESC}a\x00`,
  alignRight: () => `${ESC}a\x02`,
  fontSizeDouble: () => `${GS}!\x11`, // 2x height and 2x width
  fontSizeNormal: () => `${GS}!\x00`,
  boldOn: () => `${ESC}E\x01`,
  boldOff: () => `${ESC}E\x00`,
  feedAndCut: () => `${ESC}d\x03${GS}V\x41\x03`, // Feed 3 lines & partial cut
  line: () => '------------------------------------------------\n',
  doubleLine: () => '================================================\n',
};

function generateKOTBytes(order: Order, isPlain: boolean = false): Buffer {
  let kot = '';

  if (isPlain) {
    // Clean text without ESC/POS binary commands for standard desktop inkjet printers
    kot += '================================================\n';
    kot += '          KITCHEN ORDER TICKET (KOT)            \n';
    kot += '================================================\n';
    kot += `TOKEN NUMBER: #${order.tokenNumber}\n`;
    kot += '------------------------------------------------\n';
    kot += `Table/Name: ${order.customerName || 'Guest'}\n`;
    const orderDate = new Date(order.createdAt).toLocaleString();
    kot += `Time: ${orderDate}\n`;
    kot += `Payment: ${order.paymentMethod} (${order.totalAmount.toFixed(2)} INR)\n`;
    kot += '================================================\n';
    kot += 'QTY  ITEM NAME                     PRICE\n';
    kot += '------------------------------------------------\n';

    order.items.forEach(item => {
      const qtyStr = `${item.quantity}`.padEnd(5, ' ');
      let nameStr = item.menuItem?.name || (item as any).name || 'Item';
      if (nameStr.length > 28) {
        nameStr = nameStr.substring(0, 25) + '...';
      }
      nameStr = nameStr.padEnd(30, ' ');
      // Use Rs. instead of ₹ — avoids UTF-8 multi-byte encoding issues on Windows printers
      const priceSumStr = `Rs.${(item.price * item.quantity).toFixed(2)}`;
      kot += `${qtyStr}${nameStr}${priceSumStr}\n`;
    });

    kot += '================================================\n';
    kot += 'COOKING PREFERENCE: FAST SERVICE\n';
    kot += '================================================\n';
  } else {
    // Initialize
    kot += CLEAN_KOT_PRINT.init();

    // Title Header
    kot += CLEAN_KOT_PRINT.alignCenter();
    kot += CLEAN_KOT_PRINT.fontSizeDouble();
    kot += CLEAN_KOT_PRINT.boldOn();
    kot += 'KITCHEN ORDER TICKET (KOT)\n';
    kot += CLEAN_KOT_PRINT.fontSizeNormal();
    kot += CLEAN_KOT_PRINT.boldOff();
    kot += CLEAN_KOT_PRINT.line();

    // Token Number
    kot += CLEAN_KOT_PRINT.fontSizeDouble();
    kot += CLEAN_KOT_PRINT.boldOn();
    kot += `TOKEN: ${order.tokenNumber}\n`;
    kot += CLEAN_KOT_PRINT.fontSizeNormal();
    kot += CLEAN_KOT_PRINT.boldOff();
    kot += CLEAN_KOT_PRINT.line();

    // Order Details
    kot += CLEAN_KOT_PRINT.alignLeft();
    kot += `Table/Name: ${order.customerName || 'Guest'}\n`;
    const orderDate = new Date(order.createdAt).toLocaleString();
    kot += `Time: ${orderDate}\n`;
    kot += `Payment: ${order.paymentMethod} (${order.totalAmount.toFixed(2)} INR)\n`;
    kot += CLEAN_KOT_PRINT.doubleLine();

    // Table Items Header
    kot += CLEAN_KOT_PRINT.boldOn();
    kot += 'QTY  ITEM NAME                     PRICE\n';
    kot += CLEAN_KOT_PRINT.boldOff();
    kot += CLEAN_KOT_PRINT.line();

    // Items
    order.items.forEach(item => {
      const qtyStr = `${item.quantity}`.padEnd(5, ' ');
      let nameStr = item.menuItem?.name || (item as any).name || 'Item';
      if (nameStr.length > 28) {
        nameStr = nameStr.substring(0, 25) + '...';
      }
      nameStr = nameStr.padEnd(30, ' ');
      const priceSumStr = `₹${(item.price * item.quantity).toFixed(2)}`;
      kot += `${qtyStr}${nameStr}${priceSumStr}\n`;
    });

    kot += CLEAN_KOT_PRINT.doubleLine();
    kot += CLEAN_KOT_PRINT.alignCenter();
    kot += CLEAN_KOT_PRINT.boldOn();
    kot += 'COOKING PREFERENCE: FAST SERVICE\n';
    kot += CLEAN_KOT_PRINT.boldOff();

    // Feed & Cut
    kot += CLEAN_KOT_PRINT.feedAndCut();
  }

  return Buffer.from(kot, 'utf8');
}

// LAN/Wi-Fi Wireless Printer over Raw TCP Socket (usually Port 9100)
function printWirelessLAN(ip: string, port: number, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[Wireless Spooler] Connecting to printer at TCP ${ip}:${port}...`);
    const client = new net.Socket();

    // Timeout printer socket connections after 5 seconds
    client.setTimeout(5000);

    client.connect(port, ip, () => {
      console.log(`[Wireless Spooler] Connected successfully. Streaming print payload...`);
      client.write(data, () => {
        console.log(`[Wireless Spooler] Print bytes flushed.`);
        client.end();
        resolve();
      });
    });

    client.on('error', (err) => {
      console.error(`[Wireless Spooler Error] Network socket failure:`, err.message);
      client.destroy();
      reject(err);
    });

    client.on('timeout', () => {
      console.error(`[Wireless Spooler Error] Connect timeout to ${ip}:${port}`);
      client.destroy();
      reject(new Error('Printer network connection timeout'));
    });
  });
}

// Windows local spool fallback for USB printers
async function printUSBWindows(printerName: string, data: Buffer, isPlain: boolean): Promise<void> {
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  const ext = isPlain ? 'txt' : 'bin';
  const tempFile = path.join(tempDir, `print_job_${Date.now()}.${ext}`);

  if (isPlain) {
    // Write as ASCII — no multi-byte chars, safe for all Windows printers
    fs.writeFileSync(tempFile, data.toString('ascii'), { encoding: 'ascii' });
  } else {
    fs.writeFileSync(tempFile, data);
  }

  try {
    let psCommand: string;
    if (isPlain) {
      // Use the dedicated print.ps1 script which uses .NET PrintDocument API.
      // This correctly renders Courier New text to the named printer without
      // any byte-value garbage that Out-Printer and notepad produce.
      const printScript = path.join(__dirname, 'print.ps1');
      psCommand = `powershell -ExecutionPolicy Bypass -File "${printScript}" -FilePath "${tempFile}" -PrinterName "${printerName}"`;
    } else {
      // Raw binary ESC/POS for dedicated thermal receipt printers
      psCommand = `powershell -Command "[System.IO.File]::ReadAllBytes('${tempFile}') | Out-Printer -Name '${printerName}'"`;
    }

    console.log(`[USB Spooler] Running: ${psCommand}`);
    await execAsync(psCommand);
    console.log('[USB Spooler] Print job sent successfully.');
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown print error';
    console.error('[USB Spooler Error] Failed:', errMsg);
    throw err;
  } finally {
    // Delay cleanup so print.ps1 finishes spooling before the file is removed
    setTimeout(() => {
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch (_) { }
      }
    }, 10000);
  }
}

// Dispatch printer commands based on configuration
async function dispatchToPrinter(order: Order) {
  const isPlain = PRINTER_TYPE.toUpperCase() === 'USB';
  const printData = generateKOTBytes(order, isPlain);

  if (PRINTER_TYPE.toUpperCase() === 'LAN' || PRINTER_TYPE.toUpperCase() === 'WIFI') {
    const parts = PRINTER_TARGET.split(':');
    const ip = parts[0];
    const port = parts[1] ? parseInt(parts[1], 10) : 9100;
    await printWirelessLAN(ip, port, printData);
  } else {
    await printUSBWindows(PRINTER_TARGET, printData, isPlain);
  }
}

// Process the local print queue sequentially
async function processQueue() {
  if (isProcessingQueue || printQueue.length === 0) return;

  isProcessingQueue = true;
  console.log(`[Queue Manager] Draining queue. Pending count: ${printQueue.length}`);

  while (printQueue.length > 0) {
    const order = printQueue[0];
    console.log(`[Queue Manager] Spooling Order #${order.tokenNumber} to kitchen printer...`);

    try {
      await dispatchToPrinter(order);
      console.log(`[Queue Manager] Successfully printed Order #${order.tokenNumber}!`);

      if (isConnected) {
        ws.send(JSON.stringify({
          type: 'print_success',
          orderId: order.id,
        }));
      }

      printQueue.shift();
      saveQueueToDisk();

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown print error';
      console.error(`[Queue Manager Error] Printing failed for Order #${order.tokenNumber}:`, errMsg);

      if (isConnected) {
        ws.send(JSON.stringify({
          type: 'print_failure',
          orderId: order.id,
          error: errMsg,
        }));
      }

      console.log('[Queue Manager] Printer offline or disconnected. Waiting to retry...');
      break;
    }
  }

  isProcessingQueue = false;
}

// WebSocket client connection management
function connectWebSocket() {
  console.log(`[WS Link] Connecting to WebSocket proxy at ${WS_URL}...`);
  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    isConnected = true;
    console.log('[WS Link] Connected successfully. Initializing printer handshake...');

    // Register as connector
    ws.send(JSON.stringify({
      type: 'init',
      role: 'connector',
      details: {
        type: PRINTER_TYPE,
        target: PRINTER_TARGET,
      }
    }));

    // Flush local queue immediately upon connection recovery
    processQueue();
  });

  ws.on('message', async (message) => {
    try {
      const payload = JSON.parse(message.toString());

      if (payload.event === 'PRINT_KOT') {
        const order = payload.data;
        console.log(`[WS Link] Print event received for Order #${order.tokenNumber}`);

        // Push order to local queue and save
        const alreadyInQueue = printQueue.some(o => o.id === order.id);
        if (!alreadyInQueue) {
          printQueue.push(order);
          saveQueueToDisk();
        }

        // Trigger queue processing
        processQueue();
      }
    } catch (err) {
      console.error('[WS Link Error] Failed parsing payload:', err);
    }
  });

  ws.on('close', () => {
    isConnected = false;
    console.log('[WS Link] Connection closed. Attempting reconnect in 5 seconds...');
    setTimeout(connectWebSocket, 5000);
  });

  ws.on('error', (err) => {
    console.error('[WS Link Error] Socket failure:', err.message);
  });
}

// Self-monitor checking connection status
// NOTE: Uses WMI (Get-WmiObject) instead of Get-Printer to avoid triggering
// spurious print jobs on Epson and other GDI inkjet drivers.
setInterval(async () => {
  if (isConnected) {
    let printerConnected = false;

    try {
      if (PRINTER_TYPE.toUpperCase() === 'LAN' || PRINTER_TYPE.toUpperCase() === 'WIFI') {
        const parts = PRINTER_TARGET.split(':');
        const ip = parts[0];
        const port = parts[1] ? parseInt(parts[1], 10) : 9100;

        // Check if raw network printer socket is reachable
        await new Promise<void>((resolve, reject) => {
          const socket = new net.Socket();
          socket.setTimeout(2500);
          socket.connect(port, ip, () => {
            socket.destroy();
            resolve();
          });
          socket.on('error', (err) => {
            socket.destroy();
            reject(err);
          });
          socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('timeout'));
          });
        });
        printerConnected = true;
      } else {
        // Safe WMI query — reads status from Windows management layer,
        // does NOT send any data to the print spooler
        const safeCmd = `powershell -Command "Get-WmiObject -Class Win32_Printer -Filter \\"Name='${PRINTER_TARGET}'\\" | Select-Object -ExpandProperty PrinterStatus"`;
        const { stdout } = await execAsync(safeCmd);
        const statusCode = parseInt(stdout.trim(), 10);
        // Win32_Printer PrinterStatus: 3 = Idle (ready), 4 = Printing, 5 = Warming Up
        printerConnected = !isNaN(statusCode) && statusCode > 0;
      }
    } catch (_e) {
      printerConnected = false;
    }

    ws.send(JSON.stringify({
      type: 'status_ping',
      printerConnected,
      details: {
        type: PRINTER_TYPE,
        target: PRINTER_TARGET,
      }
    }));
  }
}, 15000);

// Kickstart connections
connectWebSocket();
