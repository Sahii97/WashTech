import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, getDocs, doc,
  updateDoc, deleteDoc, setDoc, getDoc,
} from 'firebase/firestore';
import firebaseConfigJson from './firebase-applet-config.json';

// Firebase init (client SDK — same database the frontend uses)
const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfigJson);
const db = getFirestore(fbApp, (firebaseConfigJson as any).firestoreDatabaseId);

const DEFAULT_SLOTS = [
  '09:00 AM','10:00 AM','11:00 AM','12:00 PM','01:00 PM',
  '02:00 PM','03:00 PM','04:00 PM','05:00 PM','06:00 PM',
  '07:00 PM','08:00 PM','09:00 PM','10:00 PM',
];
const DEFAULT_DRIVER = { id: 'd1', name: 'Ali', code: '1234', phone: '+9647809471576' };

// ── Notification templates ──────────────────────────────────────
// Each template supports {{variable}} placeholders.
// Available per event:
//   new_booking:      id, name, phone, neighborhood, carType, package, date, slot
//   booking_approved: name, phone, neighborhood, slot, driverName, driverPhone
//   driver_accepted:  name, phone, driverName, slot
//   booking_rejected: name, phone

export type EventKey = 'new_booking' | 'booking_approved' | 'driver_accepted' | 'booking_rejected';

export interface TemplateConfig {
  enabled: boolean;
  template: string;
}

export type NotificationTemplates = Record<EventKey, TemplateConfig>;

const DEFAULT_TEMPLATES: NotificationTemplates = {
  new_booking: {
    enabled: true,
    template:
      '📦 حجز جديد #{{id}}\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🚗 {{carType}} — {{package}}\n🕐 {{date}} {{slot}}',
  },
  booking_approved: {
    enabled: true,
    template:
      '✅ لديك حجز جديد\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🕐 {{slot}}\n\nافتح تطبيق السائق واضغط قبول المهمة',
  },
  driver_accepted: {
    enabled: true,
    template:
      '🚗 سائقك في الطريق إليك!\n👨‍💼 السائق: {{driverName}}\n🕐 الوقت: {{slot}}\nسيصل قريباً. شكراً لاختيارك WashTech! 🧼',
  },
  booking_rejected: {
    enabled: true,
    template:
      '❌ عذراً، لم نتمكن من قبول حجزك في هذا الوقت.\nيرجى المحاولة مرة أخرى أو اختيار وقت آخر.\nWashTech 🚗',
  },
};

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

async function getTemplates(): Promise<NotificationTemplates> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'notification_templates'));
    return snap.exists() ? (snap.data() as any).value : DEFAULT_TEMPLATES;
  } catch { return DEFAULT_TEMPLATES; }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const WASENDER_TOKEN = process.env.WASENDER_API_TOKEN || '';
  const MANAGER_PHONE  = process.env.MANAGER_PHONE || '+9647809471576';

  async function sendWhatsApp(to: string, text: string): Promise<void> {
    if (!WASENDER_TOKEN) { console.warn('[WhatsApp] No WASENDER_API_TOKEN set'); return; }
    try {
      const res = await fetch('https://wasenderapi.com/api/send-message', {
        method: 'POST',
        headers: { Authorization: `Bearer ${WASENDER_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, text }),
      });
      if (!res.ok) console.error('[WhatsApp] Error', res.status, await res.text());
    } catch (e) { console.error('[WhatsApp]', e); }
  }

  async function notify(event: EventKey, vars: Record<string, string>, to: string): Promise<void> {
    const templates = await getTemplates();
    const cfg = templates[event];
    if (!cfg?.enabled) return;
    const text = applyTemplate(cfg.template, vars);
    sendWhatsApp(to, text).catch(console.error);
  }

  // Slots stay in memory (they're reset on deploy anyway; admin can update via /api/update-slots)
  let availableSlots: string[] = DEFAULT_SLOTS.slice();

  // --- Endpoints for n8n to send data to the website ---

  // 1. Endpoint for n8n to update slots
  app.post('/api/update-slots', (req, res) => {
    try {
      const slots = req.body.availableSlots || req.body.slots || (Array.isArray(req.body) ? req.body : null);
      if (slots) {
        availableSlots = slots;
        console.log('Received updated slots from n8n:', availableSlots);
        res.status(200).json({ success: true, message: 'Slots updated successfully' });
      } else {
        res.status(400).json({ success: false, error: 'Invalid payload format' });
      }
    } catch (error) {
      console.error('Error updating slots:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // 2. (legacy stub — drivers now live in Firestore)
  app.post('/api/update-drivers', (_req, res) => {
    res.json({ success: true, message: 'Drivers are managed in Firestore' });
  });

  // 3. Reset All Data — deletes all Firestore bookings and resets drivers to default
  app.post('/api/reset-data', async (_req, res) => {
    try {
      availableSlots = DEFAULT_SLOTS.slice();

      // Delete all bookings from Firestore
      const bookSnap = await getDocs(collection(db, 'bookings'));
      await Promise.all(bookSnap.docs.map(d => deleteDoc(doc(db, 'bookings', d.id))));

      // Delete and re-seed drivers
      const driverSnap = await getDocs(collection(db, 'drivers'));
      await Promise.all(driverSnap.docs.map(d => deleteDoc(doc(db, 'drivers', d.id))));
      await setDoc(doc(db, 'drivers', DEFAULT_DRIVER.id), {
        name: DEFAULT_DRIVER.name,
        code: DEFAULT_DRIVER.code,
        phone: DEFAULT_DRIVER.phone,
      });

      console.log('[reset] Firestore bookings cleared, drivers reset.');
      res.json({ success: true });
    } catch (error) {
      console.error('[reset] Error:', error);
      res.status(500).json({ success: false, error: 'Reset failed' });
    }
  });

  // 4. Called by BookingPage after saving to Firestore — sends manager WhatsApp notification
  app.post('/api/proxy-n8n', async (req, res) => {
    const d = req.body;
    notify('new_booking', {
      id: d.id || '', name: d.name || '', phone: d.phone || '',
      neighborhood: d.neighborhood || '', carType: d.carType || '',
      package: d.package || '', date: d.date === 'today' ? 'اليوم' : 'غداً', slot: d.slot || '',
    }, MANAGER_PHONE).catch(console.error);
    res.json({ success: true });
  });

  // 3. (legacy stub — bookings now live in Firestore, read via onSnapshot in frontend)
  app.post('/api/update-bookings', (_req, res) => {
    res.json({ success: true, message: 'Bookings are managed in Firestore' });
  });

  // --- Manager Endpoints ---

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', codeVersion: '3.0-direct-whatsapp', wasender: !!WASENDER_TOKEN });
  });

  // --- Notification template endpoints ---
  app.get('/api/admin/notification-templates', async (_req, res) => {
    res.json({ templates: await getTemplates() });
  });

  app.post('/api/admin/notification-templates', async (req, res) => {
    const { templates } = req.body;
    if (!templates) return res.status(400).json({ error: 'Missing templates' });
    await setDoc(doc(db, 'settings', 'notification_templates'), { value: templates });
    res.json({ success: true });
  });

  // Test a single notification event with dummy data
  app.post('/api/admin/test-notification', async (req, res) => {
    const { event, testPhone } = req.body as { event: EventKey; testPhone?: string };
    if (!event) return res.status(400).json({ error: 'Missing event' });

    const to = testPhone || MANAGER_PHONE;

    const DUMMY: Record<EventKey, Record<string, string>> = {
      new_booking: {
        id: 'TEST1', name: 'محمد أحمد', phone: to,
        neighborhood: 'عنكاوة', carType: 'سيدان',
        package: 'غسيل كامل', date: 'اليوم', slot: '10:00 AM',
      },
      booking_approved: {
        name: 'محمد أحمد', phone: to, neighborhood: 'عنكاوة',
        slot: '10:00 AM', driverName: 'علي', driverPhone: to,
      },
      driver_accepted: {
        name: 'محمد أحمد', phone: to, driverName: 'علي', slot: '10:00 AM',
      },
      booking_rejected: {
        name: 'محمد أحمد', phone: to,
      },
    };

    try {
      // Build the message text so we can preview it in the response
      const templates = await getTemplates();
      const cfg = templates[event];
      const text = cfg?.enabled ? applyTemplate(cfg.template, DUMMY[event]) : '(disabled)';

      await notify(event, DUMMY[event], to);
      res.json({ success: true, sentTo: to, preview: text });
    } catch (e) {
      console.error('[test-notification]', e);
      res.status(500).json({ error: 'Failed to send test' });
    }
  });

  // Test all 4 events in sequence with 800ms delay between each
  app.post('/api/admin/test-all-notifications', async (req, res) => {
    const { testPhone } = req.body as { testPhone?: string };
    const to = testPhone || MANAGER_PHONE;

    res.json({ success: true, message: 'Sending all 4 test notifications...', sentTo: to });

    const events: EventKey[] = ['new_booking', 'booking_approved', 'driver_accepted', 'booking_rejected'];
    const DUMMY: Record<EventKey, Record<string, string>> = {
      new_booking:      { id: 'TEST1', name: 'محمد أحمد', phone: to, neighborhood: 'عنكاوة', carType: 'سيدان', package: 'غسيل كامل', date: 'اليوم', slot: '10:00 AM' },
      booking_approved: { name: 'محمد أحمد', phone: to, neighborhood: 'عنكاوة', slot: '10:00 AM', driverName: 'علي', driverPhone: to },
      driver_accepted:  { name: 'محمد أحمد', phone: to, driverName: 'علي', slot: '10:00 AM' },
      booking_rejected: { name: 'محمد أحمد', phone: to },
    };

    for (const event of events) {
      await notify(event, DUMMY[event], to);
      await new Promise(r => setTimeout(r, 800));
    }
  });

  app.post('/api/manager/login', (req, res) => {
    const { password } = req.body;
    // In production this should be a strong env variable
    if (password === 'admin123') {
      res.json({ success: true, token: 'manager-token-abc' });
    } else {
      res.status(401).json({ success: false, error: 'Invalid password' });
    }
  });

  // --- Endpoints for the Frontend ---

  app.get('/api/slots', (req, res) => {
    res.status(200).json({ slots: availableSlots });
  });

  app.get('/api/drivers', async (_req, res) => {
    try {
      const snap = await getDocs(collection(db, 'drivers'));
      if (snap.empty) {
        await setDoc(doc(db, 'drivers', DEFAULT_DRIVER.id), {
          name: DEFAULT_DRIVER.name, code: DEFAULT_DRIVER.code, phone: DEFAULT_DRIVER.phone,
        });
        return res.json({ drivers: [DEFAULT_DRIVER] });
      }
      res.json({ drivers: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/bookings', async (_req, res) => {
    try {
      const snap = await getDocs(collection(db, 'bookings'));
      res.json({ bookings: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // Legacy /api/webhook — kept for any old integrations
  app.post('/api/webhook', async (req, res) => {
    const d = req.body;
    notify('new_booking', {
      id: d.id || '', name: d.name || '', phone: d.phone || '',
      neighborhood: d.neighborhood || '', carType: d.carType || '',
      package: d.package || '', date: d.date === 'today' ? 'اليوم' : 'غداً', slot: d.slot || '',
    }, MANAGER_PHONE).catch(console.error);
    res.json({ success: true });
  });

  // Proxy Route for Manager Approving/Rejecting Booking (To n8n manager-approval webhook)
  app.post('/api/manager/action', async (req, res) => {
    try {
      const { bookingId, driverId, action } = req.body;
      if (!bookingId || !action) return res.status(400).json({ error: 'Missing fields' });

      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnap = await getDoc(bookingRef);
      const booking = bookingSnap.exists() ? (bookingSnap.data() as Record<string, any>) : {};

      if (action === 'approve') {
        await updateDoc(bookingRef, {
          status: 'approved',
          driverId,
          approvedAt: new Date().toISOString(),
        });
        const driverSnap = await getDoc(doc(db, 'drivers', driverId));
        const driver = driverSnap.exists() ? (driverSnap.data() as any) : { name: 'السائق', phone: '' };
        notify('booking_approved', {
          name: booking.name || '', phone: booking.phone || '',
          neighborhood: booking.neighborhood || '', slot: booking.slot || '',
          driverName: driver.name, driverPhone: driver.phone || '',
        }, driver.phone || MANAGER_PHONE).catch(console.error);

      } else if (action === 'reject') {
        await updateDoc(bookingRef, {
          status: 'rejected',
          rejectedAt: new Date().toISOString(),
        });
        notify('booking_rejected', {
          name: booking.name || '', phone: booking.phone || '',
        }, booking.phone || '').catch(console.error);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[manager/action]', error);
      res.status(500).json({ success: false, error: 'Failed to process manager action' });
    }
  });

  app.get('/api/approve-from-sms', async (req, res) => {
    try {
      const targetId = req.query.bookingId as string;
      if (!targetId) return res.status(400).send('Missing bookingId');

      const bookingRef = doc(db, 'bookings', targetId);
      const bookingSnap = await getDoc(bookingRef);
      if (!bookingSnap.exists()) {
        return res.status(404).send(`
          <html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
          <body style="font-family:sans-serif;text-align:center;padding:40px">
            <h2 style="color:#ff3b30">Not Found</h2>
            <p>This booking could not be found or was already processed.</p>
            <a href="/manager" style="padding:10px 20px;background:#007aff;color:white;text-decoration:none;border-radius:8px">Go to Dashboard</a>
          </body></html>`);
      }

      // Assign first available driver
      const driverSnap = await getDocs(collection(db, 'drivers'));
      const firstDriver = driverSnap.docs[0];
      await updateDoc(bookingRef, {
        status: 'approved',
        driverId: firstDriver?.id || 'default',
        approvedAt: new Date().toISOString(),
      });

      const booking = bookingSnap.data() as Record<string, any>;
      const driverData = firstDriver?.data() as any;
      notify('booking_approved', {
        name: booking.name || '', phone: booking.phone || '',
        neighborhood: booking.neighborhood || '', slot: booking.slot || '',
        driverName: driverData?.name || 'السائق', driverPhone: driverData?.phone || '',
      }, driverData?.phone || MANAGER_PHONE).catch(console.error);

      res.send(`
        <html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Approved!</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:40px;background:#f2f2f7">
          <div style="background:white;padding:30px;border-radius:20px;box-shadow:0 4px 20px rgba(0,0,0,.08);display:inline-block;max-width:400px">
            <div style="background:#34c759;color:white;width:60px;height:60px;border-radius:30px;display:flex;align-items:center;justify-content:center;font-size:30px;margin:0 auto 20px">✓</div>
            <h2 style="color:#1c1c1e;margin-top:0">Booking Approved!</h2>
            <p style="color:#8e8e93;font-size:14px;margin-bottom:24px">Booking <strong>${targetId}</strong> confirmed.</p>
            <a href="/manager" style="display:inline-block;padding:12px 24px;background:#007aff;color:white;text-decoration:none;border-radius:12px;font-weight:bold;width:100%;box-sizing:border-box">Open Manager Dashboard</a>
          </div>
        </body></html>`);
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  });

  app.get('/api/booking-status', async (req, res) => {
    const bookingId = req.query.bookingId as string;
    if (!bookingId) return res.status(400).json({ error: 'Missing bookingId parameter' });
    try {
      const snap = await getDoc(doc(db, 'bookings', bookingId));
      if (snap.exists()) {
        const d = snap.data() as any;
        res.json({ id: bookingId, status: d.status, driverId: d.driverId });
      } else {
        res.json({ id: bookingId, status: 'not_found' });
      }
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // --- Driver Management Endpoints ---

  app.post('/api/manager/create-driver', async (req, res) => {
    const { name, code, phone } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, error: 'Name and code required' });
    const id = `d${Date.now()}`;
    await setDoc(doc(db, 'drivers', id), { name, code, phone: phone || '' });
    res.json({ success: true, driver: { id, name, code, phone: phone || '' } });
  });

  app.post('/api/driver/login', async (req, res) => {
    const { code } = req.body;
    try {
      const snap = await getDocs(collection(db, 'drivers'));
      const driver = snap.docs.find(d => (d.data() as any).code === code);
      if (driver) res.json({ success: true, driver: { id: driver.id, ...driver.data() } });
      else res.status(401).json({ success: false, error: 'Invalid code' });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.get('/api/driver/dashboard', async (req, res) => {
    const driverId = req.query.driverId as string;
    try {
      const snap = await getDocs(collection(db, 'bookings'));
      const bookings = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }))
        .filter(b => b.driverId === driverId && ['approved', 'on_process'].includes(b.status));
      res.json({ success: true, bookings });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/driver/accept-task', async (req, res) => {
    const { bookingId, driverId } = req.body;
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, { status: 'on_process', acceptedAt: new Date().toISOString() });

      // Notify customer via WasenderAPI
      const bookingSnap = await getDoc(bookingRef);
      if (bookingSnap.exists() && driverId) {
        const booking = bookingSnap.data() as Record<string, any>;
        const driverSnap = await getDoc(doc(db, 'drivers', driverId));
        const driver = driverSnap.exists() ? (driverSnap.data() as any) : { name: 'السائق' };
        notify('driver_accepted', {
          name: booking.name || '', phone: booking.phone || '',
          driverName: driver.name, slot: booking.slot || '',
        }, booking.phone || '').catch(console.error);
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[driver/accept-task]', error);
      res.status(500).json({ success: false, error: 'Failed to accept task' });
    }
  });

  app.post('/api/driver/complete-task', async (req, res) => {
    const { bookingId } = req.body;
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'completed',
        completedAt: new Date().toISOString(),
      });
      res.json({ success: true });
    } catch (error) {
      console.error('[driver/complete-task]', error);
      res.status(500).json({ success: false, error: 'Failed to complete task' });
    }
  });

  // Vite Integration for frontend
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
