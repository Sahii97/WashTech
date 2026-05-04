import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import 'dotenv/config';

// ─── Data types ──────────────────────────────────────────────────────────────

interface Booking {
  id: string;
  name: string;
  phone: string;
  location: string;
  package: 'basic' | 'premium' | 'full';
  packageNameAr: string;
  packagePrice: number;
  date: string;
  time: string;
  notes: string;
  status: 'new' | 'assigned' | 'in_progress' | 'completed';
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  createdAt: string;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  code: string;
}

// ─── JSON File Store ──────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const DRIVERS_FILE = path.join(DATA_DIR, 'drivers.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readBookings(): Booking[] {
  ensureDataDir();
  if (!fs.existsSync(BOOKINGS_FILE)) { fs.writeFileSync(BOOKINGS_FILE, '[]'); return []; }
  return JSON.parse(fs.readFileSync(BOOKINGS_FILE, 'utf-8'));
}

function writeBookings(bookings: Booking[]) {
  ensureDataDir();
  fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));
}

function readDrivers(): Driver[] {
  ensureDataDir();
  if (!fs.existsSync(DRIVERS_FILE)) {
    const defaults: Driver[] = [
      { id: 'd1', name: process.env.DRIVER_1_NAME || 'علي', phone: process.env.DRIVER_1_WHATSAPP || '9647501111111', code: '1111' },
      { id: 'd2', name: process.env.DRIVER_2_NAME || 'أحمد', phone: process.env.DRIVER_2_WHATSAPP || '9647502222222', code: '2222' },
      { id: 'd3', name: process.env.DRIVER_3_NAME || 'كريم', phone: process.env.DRIVER_3_WHATSAPP || '9647503333333', code: '3333' },
    ];
    fs.writeFileSync(DRIVERS_FILE, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  return JSON.parse(fs.readFileSync(DRIVERS_FILE, 'utf-8'));
}

function writeDrivers(drivers: Driver[]) {
  ensureDataDir();
  fs.writeFileSync(DRIVERS_FILE, JSON.stringify(drivers, null, 2));
}

function generateId(): string {
  return 'ORD-' + Math.floor(1000 + Math.random() * 9000);
}

// ─── WhatsApp (Whapi.cloud) ───────────────────────────────────────────────────

async function sendWhatsApp(to: string, body: string) {
  const token = process.env.WHAPI_TOKEN;
  const apiUrl = (process.env.WHAPI_API_URL || 'https://gate.whapi.cloud').replace(/\/$/, '');
  if (!token || token === 'your_whapi_token_here') {
    console.log(`[WhatsApp MOCK] To: ${to}\n${body}\n`);
    return;
  }
  const cleanPhone = to.replace(/^\+/, '').replace(/\s/g, '');
  try {
    const res = await fetch(`${apiUrl}/messages/text`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: cleanPhone, body }),
    });
    if (!res.ok) console.error('[WhatsApp] Error:', await res.text());
  } catch (err) {
    console.error('[WhatsApp] Fetch failed:', err);
  }
}

function msgCustomerBooking(b: Booking) {
  return `مرحباً ${b.name} 👋\nتم استلام طلبك في Wash Tech ✅\n📦 الباقة: ${b.packageNameAr}\n📍 الموقع: ${b.location}\n📅 التاريخ: ${b.date} الساعة ${b.time}\nسنتواصل معك قريباً لتأكيد الموعد 🚗💧`;
}

function msgManagerNewBooking(b: Booking) {
  return `🔔 طلب جديد وصل!\n👤 الاسم: ${b.name}\n📱 واتساب: ${b.phone}\n📍 الموقع: ${b.location}\n📦 الباقة: ${b.packageNameAr} — ${b.packagePrice.toLocaleString()} IQD\n📅 ${b.date} الساعة ${b.time}\n📝 ملاحظات: ${b.notes || 'لا يوجد'}`;
}

function msgDriverAssigned(b: Booking, driverName: string) {
  return `مرحباً ${driverName} 👷\nتم تعيينك لمهمة جديدة في Wash Tech 🚗\n👤 العميل: ${b.name}\n📱 واتساب: ${b.phone}\n📍 الموقع: ${b.location}\n📦 الباقة: ${b.packageNameAr}\n📅 التاريخ: ${b.date} الساعة ${b.time}\n📝 ملاحظات: ${b.notes || 'لا يوجد'}`;
}

function msgCustomerDriverAssigned(b: Booking) {
  return `مرحباً ${b.name} 👋\nتم تعيين سائق لطلبك ✅\n🧑‍🔧 السائق: ${b.driverName}\nسيصل إليك في الموعد المحدد 🚗💧\nWash Tech — نجيك ونغسلها!`;
}

function msgCustomerStatusUpdate(b: Booking, statusAr: string) {
  return `مرحباً ${b.name} 👋\nتحديث على طلبك في Wash Tech 🚗💧\n📦 ${b.packageNameAr}\n📍 ${b.location}\n🔄 الحالة: ${statusAr}`;
}

// ─── Express App ──────────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  // ── Bookings ────────────────────────────────────────────────────────────────

  // GET all bookings
  app.get('/api/bookings', (_req, res) => {
    res.json(readBookings());
  });

  // POST create new booking
  app.post('/api/bookings', async (req, res) => {
    const { name, phone, location, package: pkg, packageNameAr, packagePrice, date, time, notes } = req.body;
    if (!name || !phone || !location || !pkg || !date || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const booking: Booking = {
      id: generateId(),
      name, phone, location,
      package: pkg,
      packageNameAr: packageNameAr || pkg,
      packagePrice: packagePrice || 0,
      date, time,
      notes: notes || '',
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    const bookings = readBookings();
    bookings.push(booking);
    writeBookings(bookings);

    // WhatsApp notifications (fire-and-forget)
    const managerPhone = process.env.MANAGER_WHATSAPP || '';
    sendWhatsApp(phone, msgCustomerBooking(booking));
    if (managerPhone) sendWhatsApp(managerPhone, msgManagerNewBooking(booking));

    res.status(201).json(booking);
  });

  // POST assign driver to booking
  app.post('/api/bookings/:id/assign', async (req, res) => {
    const { driverId } = req.body;
    const bookings = readBookings();
    const drivers = readDrivers();
    const idx = bookings.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Booking not found' });
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return res.status(404).json({ error: 'Driver not found' });

    bookings[idx] = { ...bookings[idx], status: 'assigned', driverId: driver.id, driverName: driver.name, driverPhone: driver.phone };
    writeBookings(bookings);
    const b = bookings[idx];

    sendWhatsApp(driver.phone, msgDriverAssigned(b, driver.name));
    sendWhatsApp(b.phone, msgCustomerDriverAssigned(b));

    res.json(bookings[idx]);
  });

  // POST move booking to next stage
  app.post('/api/bookings/:id/next', async (req, res) => {
    const bookings = readBookings();
    const idx = bookings.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Booking not found' });

    const statusFlow: Record<string, Booking['status']> = {
      new: 'in_progress',
      assigned: 'in_progress',
      in_progress: 'completed',
    };
    const statusLabels: Record<string, string> = {
      in_progress: 'قيد التنفيذ — السائق في الطريق إليك',
      completed: 'مكتمل — شكراً لاستخدامك Wash Tech! 🚗💧',
    };

    const current = bookings[idx].status;
    const next = statusFlow[current];
    if (!next) return res.status(400).json({ error: 'Booking already completed' });

    bookings[idx] = { ...bookings[idx], status: next };
    writeBookings(bookings);
    const b = bookings[idx];

    if (statusLabels[next]) sendWhatsApp(b.phone, msgCustomerStatusUpdate(b, statusLabels[next]));

    res.json(bookings[idx]);
  });

  // DELETE (remove) a booking
  app.delete('/api/bookings/:id', (req, res) => {
    let bookings = readBookings();
    const before = bookings.length;
    bookings = bookings.filter(b => b.id !== req.params.id);
    if (bookings.length === before) return res.status(404).json({ error: 'Not found' });
    writeBookings(bookings);
    res.json({ success: true });
  });

  // ── Drivers ─────────────────────────────────────────────────────────────────

  app.get('/api/drivers', (_req, res) => {
    res.json(readDrivers());
  });

  app.post('/api/drivers', (req, res) => {
    const { name, phone, code } = req.body;
    if (!name || !phone || !code) return res.status(400).json({ error: 'name, phone and code required' });
    const drivers = readDrivers();
    const driver: Driver = { id: `d${Date.now()}`, name, phone, code };
    drivers.push(driver);
    writeDrivers(drivers);
    res.status(201).json(driver);
  });

  app.post('/api/driver/login', (req, res) => {
    const { code } = req.body;
    const driver = readDrivers().find(d => d.code === code);
    if (!driver) return res.status(401).json({ error: 'Invalid code' });
    res.json(driver);
  });

  app.get('/api/driver/dashboard', (req, res) => {
    const { driverId } = req.query;
    const tasks = readBookings().filter(b => b.driverId === driverId && b.status !== 'completed');
    res.json(tasks);
  });

  app.post('/api/driver/complete-task', async (req, res) => {
    const { bookingId } = req.body;
    const bookings = readBookings();
    const idx = bookings.findIndex(b => b.id === bookingId);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    bookings[idx].status = 'completed';
    writeBookings(bookings);
    const b = bookings[idx];
    sendWhatsApp(b.phone, msgCustomerStatusUpdate(b, 'مكتمل — شكراً لاستخدامك Wash Tech! 🚗💧'));
    res.json({ success: true });
  });

  // Legacy slots endpoint (kept for compatibility)
  app.get('/api/slots', (_req, res) => {
    const slots = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];
    res.json(slots);
  });

  // ── Vite / Static ────────────────────────────────────────────────────────────

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Wash Tech server → http://localhost:${PORT}`));
}

startServer();
