import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore, collection, getDocs, doc,
  updateDoc, deleteDoc, setDoc, getDoc, addDoc, query, where, orderBy, limit,
} from 'firebase/firestore';
import firebaseConfigJson from './firebase-applet-config.json';

const fbApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfigJson);
const db = getFirestore(fbApp, (firebaseConfigJson as any).firestoreDatabaseId);

const APP_URL = process.env.APP_URL || 'https://wash-tech.vercel.app';

const DEFAULT_SLOTS = [
  '09:00 AM','10:00 AM','11:00 AM','12:00 PM','01:00 PM',
  '02:00 PM','03:00 PM','04:00 PM','05:00 PM','06:00 PM',
  '07:00 PM','08:00 PM','09:00 PM','10:00 PM',
];
const DEFAULT_DRIVER = { id: 'd1', name: 'Ali', code: '1234', phone: '+9647809471576' };

// ── Booking status state machine ────────────────────────────────
export type BookingStatus =
  | 'pending' | 'approved' | 'accepted' | 'on_road' | 'completed' | 'closed' | 'rejected'
  | 'on_process'; // legacy alias for accepted

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending:    ['approved', 'rejected'],
  approved:   ['accepted', 'rejected', 'on_process'],
  accepted:   ['on_road'],
  on_road:    ['completed'],
  completed:  ['closed'],
  on_process: ['on_road', 'completed'], // legacy
  rejected:   [],
  closed:     [],
};

// Package prices in IQD
const PACKAGE_PRICES: Record<string, number> = {
  basic: 15000,
  standard: 25000,
  premium: 35000,
  'أساسي': 15000,
  'قياسي': 25000,
  'ممتاز': 35000,
};
const CAPTAIN_SHARE_PCT = 0.70; // 70% to captain

// ── Notification templates ──────────────────────────────────────
export type EventKey =
  | 'new_booking'
  | 'booking_approved'
  | 'driver_accepted'
  | 'booking_rejected'
  | 'captain_on_road'
  | 'booking_completed';

export interface TemplateConfig { enabled: boolean; template: string; }
export type NotificationTemplates = Record<EventKey, TemplateConfig>;

const DEFAULT_TEMPLATES: NotificationTemplates = {
  new_booking: {
    enabled: true,
    template:
      '📦 حجز جديد #{{id}}\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🚗 {{carType}} — {{package}}\n🕐 {{date}} {{slot}}\n\n✅ موافقة: {{approveLink}}\n❌ رفض: {{rejectLink}}',
  },
  booking_approved: {
    enabled: true,
    template:
      '✅ مهمة جديدة لك\n👤 {{name}}\n📞 {{phone}}\n📍 {{neighborhood}}\n🕐 {{slot}}\n\n👆 قبول المهمة: {{acceptLink}}',
  },
  driver_accepted: {
    enabled: true,
    template:
      '🚗 الكابتن قبل مهمتك!\n👨‍💼 الكابتن: {{driverName}}\n🕐 الوقت: {{slot}}\nسيصل قريباً. شكراً لاختيارك WashTech! 🧼',
  },
  booking_rejected: {
    enabled: true,
    template:
      '❌ عذراً، لم نتمكن من قبول حجزك في هذا الوقت.\nيرجى المحاولة مرة أخرى أو اختيار وقت آخر.\nWashTech 🚗',
  },
  captain_on_road: {
    enabled: true,
    template:
      '🚀 الكابتن في الطريق إليك!\n👨‍💼 {{driverName}}\n🕐 الوقت: {{slot}}\nاستعد لاستقباله. شكراً! 🧼',
  },
  booking_completed: {
    enabled: true,
    template:
      '✅ تم الانتهاء من خدمة غسيل سيارتك!\n💰 المبلغ: {{amount}} د.ع\nشكراً لاختيارك WashTech 🧼\nقيّم تجربتك: ⭐⭐⭐⭐⭐',
  },
};

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

async function getTemplates(): Promise<NotificationTemplates> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'notification_templates'));
    if (snap.exists()) {
      const saved = (snap.data() as any).value as Partial<NotificationTemplates>;
      // Merge saved with defaults so new keys always exist
      return { ...DEFAULT_TEMPLATES, ...saved };
    }
    return DEFAULT_TEMPLATES;
  } catch { return DEFAULT_TEMPLATES; }
}

// ── Short-link helpers ──────────────────────────────────────────
function genCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function createShortLink(url: string): Promise<string> {
  let code = genCode();
  // Avoid collisions (best-effort)
  const existing = await getDoc(doc(db, 'links', code));
  if (existing.exists()) code = genCode();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await setDoc(doc(db, 'links', code), {
    url, createdAt: new Date().toISOString(), expiresAt, used: false,
  });
  return `${APP_URL}/go/${code}`;
}

// ── Phone normalization ─────────────────────────────────────────
function normalizePhone(phone: string): string {
  const clean = phone.replace(/[\s\-()]/g, '');
  if (/^07\d{9}$/.test(clean))      return '+964' + clean.slice(1);
  if (/^9647\d{9}$/.test(clean))    return '+' + clean;
  if (/^\+9647\d{9}$/.test(clean))  return clean;
  if (/^\+/.test(clean))            return clean;
  return '+' + clean;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const WASENDER_TOKEN = process.env.WASENDER_API_TOKEN || '';
  const MANAGER_PHONE  = process.env.MANAGER_PHONE || '+9647809471576';

  // ── WhatsApp sender ───────────────────────────────────────────
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
    await sendWhatsApp(to, text);
  }

  // ── Slots ─────────────────────────────────────────────────────
  let availableSlots: string[] = DEFAULT_SLOTS.slice();

  app.post('/api/update-slots', (req, res) => {
    const slots = req.body.availableSlots || req.body.slots || (Array.isArray(req.body) ? req.body : null);
    if (slots) { availableSlots = slots; res.json({ success: true }); }
    else res.status(400).json({ error: 'Invalid payload' });
  });

  app.post('/api/update-drivers', (_req, res) => {
    res.json({ success: true, message: 'Drivers managed in Firestore' });
  });

  // ── Reset ─────────────────────────────────────────────────────
  app.post('/api/reset-data', async (_req, res) => {
    try {
      availableSlots = DEFAULT_SLOTS.slice();
      const bookSnap = await getDocs(collection(db, 'bookings'));
      await Promise.all(bookSnap.docs.map(d => deleteDoc(doc(db, 'bookings', d.id))));
      const linkSnap = await getDocs(collection(db, 'links'));
      await Promise.all(linkSnap.docs.map(d => deleteDoc(doc(db, 'links', d.id))));
      const driverSnap = await getDocs(collection(db, 'drivers'));
      await Promise.all(driverSnap.docs.map(d => deleteDoc(doc(db, 'drivers', d.id))));
      await setDoc(doc(db, 'drivers', DEFAULT_DRIVER.id), {
        name: DEFAULT_DRIVER.name, code: DEFAULT_DRIVER.code, phone: DEFAULT_DRIVER.phone,
        wallet: { balance: 0, totalEarned: 0, totalWithdrawn: 0 },
      });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Reset failed' }); }
  });

  // ── New booking notification ───────────────────────────────────
  app.post('/api/proxy-n8n', async (req, res) => {
    const d = req.body;
    const bookingId = d.id || '';
    try {
      const approveLink = await createShortLink(`${APP_URL}/action?id=${bookingId}&act=approve`);
      const rejectLink  = await createShortLink(`${APP_URL}/action?id=${bookingId}&act=reject`);
      await notify('new_booking', {
        id: bookingId, name: d.name || '', phone: d.phone || '',
        neighborhood: d.neighborhood || '', carType: d.carType || '',
        package: d.package || '', date: d.date === 'today' ? 'اليوم' : 'غداً', slot: d.slot || '',
        approveLink, rejectLink,
      }, MANAGER_PHONE);
    } catch (e) { console.error('[proxy-n8n]', e); }
    res.json({ success: true });
  });

  app.post('/api/update-bookings', (_req, res) => {
    res.json({ success: true });
  });

  // ── Short-link redirect ───────────────────────────────────────
  app.get('/go/:code', async (req, res) => {
    const { code } = req.params;
    try {
      const snap = await getDoc(doc(db, 'links', code));
      if (!snap.exists()) return res.status(404).send('رابط غير صالح');
      const link = snap.data() as any;
      if (link.used) return res.status(410).send('تم استخدام هذا الرابط مسبقاً');
      if (new Date(link.expiresAt) < new Date()) return res.status(410).send('انتهت صلاحية الرابط');
      await updateDoc(doc(db, 'links', code), { used: true, usedAt: new Date().toISOString() });
      res.redirect(link.url);
    } catch (e) { res.status(500).send('Server error'); }
  });

  // ── Health ────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', codeVersion: '4.0-state-machine', wasender: !!WASENDER_TOKEN });
  });

  // ── Notification template endpoints ──────────────────────────
  app.get('/api/admin/notification-templates', async (_req, res) => {
    res.json({ templates: await getTemplates() });
  });

  app.post('/api/admin/notification-templates', async (req, res) => {
    const { templates } = req.body;
    if (!templates) return res.status(400).json({ error: 'Missing templates' });
    await setDoc(doc(db, 'settings', 'notification_templates'), { value: templates });
    res.json({ success: true });
  });

  app.post('/api/admin/test-notification', async (req, res) => {
    const { event, testPhone } = req.body as { event: EventKey; testPhone?: string };
    if (!event) return res.status(400).json({ error: 'Missing event' });
    const to = testPhone || MANAGER_PHONE;
    const DUMMY: Record<EventKey, Record<string, string>> = {
      new_booking:       { id: 'TEST1', name: 'محمد أحمد', phone: to, neighborhood: 'عنكاوا', carType: 'سيدان', package: 'غسيل كامل', date: 'اليوم', slot: '10:00 AM', approveLink: `${APP_URL}/action?id=TEST1&act=approve`, rejectLink: `${APP_URL}/action?id=TEST1&act=reject` },
      booking_approved:  { name: 'محمد أحمد', phone: to, neighborhood: 'عنكاوا', slot: '10:00 AM', driverName: 'علي', driverPhone: to, acceptLink: `${APP_URL}/action?id=TEST1&act=accept` },
      driver_accepted:   { name: 'محمد أحمد', phone: to, driverName: 'علي', slot: '10:00 AM' },
      booking_rejected:  { name: 'محمد أحمد', phone: to },
      captain_on_road:   { name: 'محمد أحمد', phone: to, driverName: 'علي', slot: '10:00 AM' },
      booking_completed: { name: 'محمد أحمد', phone: to, amount: '25,000' },
    };
    try {
      const templates = await getTemplates();
      const cfg = templates[event];
      const text = cfg?.enabled ? applyTemplate(cfg.template, DUMMY[event]) : '(disabled)';
      await notify(event, DUMMY[event], to);
      res.json({ success: true, sentTo: to, preview: text });
    } catch (e) { res.status(500).json({ error: 'Failed to send test' }); }
  });

  app.post('/api/admin/test-all-notifications', async (req, res) => {
    const { testPhone } = req.body as { testPhone?: string };
    const to = testPhone || MANAGER_PHONE;
    res.json({ success: true, message: 'Sending test notifications...', sentTo: to });
    const events: EventKey[] = ['new_booking', 'booking_approved', 'driver_accepted', 'booking_rejected', 'captain_on_road', 'booking_completed'];
    const DUMMY: Record<EventKey, Record<string, string>> = {
      new_booking:       { id: 'TEST1', name: 'محمد', phone: to, neighborhood: 'عنكاوا', carType: 'سيدان', package: 'قياسي', date: 'اليوم', slot: '10:00 AM', approveLink: APP_URL, rejectLink: APP_URL },
      booking_approved:  { name: 'محمد', phone: to, neighborhood: 'عنكاوا', slot: '10:00 AM', driverName: 'علي', driverPhone: to, acceptLink: APP_URL },
      driver_accepted:   { name: 'محمد', phone: to, driverName: 'علي', slot: '10:00 AM' },
      booking_rejected:  { name: 'محمد', phone: to },
      captain_on_road:   { name: 'محمد', phone: to, driverName: 'علي', slot: '10:00 AM' },
      booking_completed: { name: 'محمد', phone: to, amount: '25,000' },
    };
    for (const event of events) {
      await notify(event, DUMMY[event], to);
      await new Promise(r => setTimeout(r, 800));
    }
  });

  // ── Manager auth ──────────────────────────────────────────────
  app.post('/api/manager/login', (req, res) => {
    const { password } = req.body;
    if (password === (process.env.MANAGER_PASSWORD || 'admin123')) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Invalid password' });
    }
  });

  // ── Slots & drivers (read) ────────────────────────────────────
  app.get('/api/slots', (_req, res) => res.json({ slots: availableSlots }));

  app.get('/api/drivers', async (_req, res) => {
    try {
      const snap = await getDocs(collection(db, 'drivers'));
      if (snap.empty) {
        await setDoc(doc(db, 'drivers', DEFAULT_DRIVER.id), {
          name: DEFAULT_DRIVER.name, code: DEFAULT_DRIVER.code, phone: DEFAULT_DRIVER.phone,
          wallet: { balance: 0, totalEarned: 0, totalWithdrawn: 0 },
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

  // ── Track by phone ────────────────────────────────────────────
  app.get('/api/track', async (req, res) => {
    const raw = req.query.phone as string;
    if (!raw) return res.status(400).json({ error: 'Missing phone' });
    const phone = normalizePhone(raw.trim());
    try {
      const snap = await getDocs(collection(db, 'bookings'));
      const bookings = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as any)
        .filter(b => normalizePhone(b.phone || '') === phone)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      res.json({ bookings });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // ── Action page data ──────────────────────────────────────────
  app.get('/api/action', async (req, res) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
      const snap = await getDoc(doc(db, 'bookings', id));
      if (!snap.exists()) return res.status(404).json({ error: 'Booking not found' });
      res.json({ booking: { id, ...snap.data() } });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // ── Generic action endpoint (approve/reject/accept/on_road/complete) ──
  app.post('/api/action', async (req, res) => {
    try {
      const { id, act, driverId } = req.body;
      if (!id || !act) return res.status(400).json({ error: 'Missing fields' });

      const bookingRef = doc(db, 'bookings', id);
      const bookingSnap = await getDoc(bookingRef);
      if (!bookingSnap.exists()) return res.status(404).json({ error: 'Booking not found' });
      const booking = bookingSnap.data() as Record<string, any>;

      const currentStatus: string = booking.status || 'pending';
      const statusMap: Record<string, string> = {
        approve: 'approved', reject: 'rejected', accept: 'accepted',
        on_road: 'on_road', complete: 'completed', close: 'closed',
      };
      const newStatus = statusMap[act] || act;

      const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(newStatus)) {
        return res.status(409).json({ error: `Cannot transition from ${currentStatus} to ${newStatus}` });
      }

      const now = new Date().toISOString();
      const update: Record<string, any> = {
        status: newStatus,
        [`${act}edAt`]: now,
        statusHistory: [...(booking.statusHistory || []), { status: newStatus, at: now, by: act }],
      };

      if (act === 'approve' && driverId) {
        update.driverId = driverId;
        const driverSnap = await getDoc(doc(db, 'drivers', driverId));
        const driver = driverSnap.exists() ? (driverSnap.data() as any) : { name: 'الكابتن', phone: '' };
        const acceptLink = await createShortLink(`${APP_URL}/action?id=${id}&act=accept`);
        await updateDoc(bookingRef, update);
        await notify('booking_approved', {
          name: booking.name || '', phone: booking.phone || '',
          neighborhood: booking.neighborhood || '', slot: booking.slot || '',
          driverName: driver.name, driverPhone: driver.phone || '', acceptLink,
        }, driver.phone || MANAGER_PHONE);
        return res.json({ success: true, message: 'تم قبول الحجز وإرسال رابط القبول للكابتن' });
      }

      if (act === 'reject') {
        await updateDoc(bookingRef, update);
        await notify('booking_rejected', {
          name: booking.name || '', phone: booking.phone || '',
        }, booking.phone || '');
        return res.json({ success: true, message: 'تم رفض الحجز وإشعار العميل' });
      }

      if (act === 'accept') {
        await updateDoc(bookingRef, update);
        const driverSnap = booking.driverId ? await getDoc(doc(db, 'drivers', booking.driverId)) : null;
        const driver = driverSnap?.exists() ? (driverSnap.data() as any) : { name: 'الكابتن' };
        await notify('driver_accepted', {
          name: booking.name || '', phone: booking.phone || '',
          driverName: driver.name, slot: booking.slot || '',
        }, booking.phone || '');
        await sendWhatsApp(MANAGER_PHONE, `✅ الكابتن ${driver.name} قبل مهمة #${id.slice(-6)}\nالعميل: ${booking.name}`);
        return res.json({ success: true, message: 'تم قبول المهمة وإشعار العميل والمدير' });
      }

      if (act === 'on_road') {
        await updateDoc(bookingRef, update);
        const driverSnap = booking.driverId ? await getDoc(doc(db, 'drivers', booking.driverId)) : null;
        const driver = driverSnap?.exists() ? (driverSnap.data() as any) : { name: 'الكابتن' };
        await notify('captain_on_road', {
          name: booking.name || '', phone: booking.phone || '',
          driverName: driver.name, slot: booking.slot || '',
        }, booking.phone || '');
        await sendWhatsApp(MANAGER_PHONE, `🚀 الكابتن ${driver.name} في الطريق لـ${booking.name}\nالموقع: ${booking.neighborhood}`);
        return res.json({ success: true, message: 'تم إشعار العميل أن الكابتن في الطريق' });
      }

      if (act === 'complete') {
        // Calculate financial split
        const pkgKey = (booking.package || '').toLowerCase();
        const totalAmount = PACKAGE_PRICES[pkgKey] || PACKAGE_PRICES[booking.package] || 0;
        const captainShare = Math.round(totalAmount * CAPTAIN_SHARE_PCT);
        const companyShare = totalAmount - captainShare;

        update.financials = { totalAmount, captainShare, companyShare };
        await updateDoc(bookingRef, update);

        // Credit captain wallet
        if (booking.driverId && totalAmount > 0) {
          const driverRef = doc(db, 'drivers', booking.driverId);
          const driverSnap = await getDoc(driverRef);
          if (driverSnap.exists()) {
            const w = (driverSnap.data() as any).wallet || { balance: 0, totalEarned: 0, totalWithdrawn: 0 };
            await updateDoc(driverRef, {
              wallet: {
                balance: (w.balance || 0) + captainShare,
                totalEarned: (w.totalEarned || 0) + captainShare,
                totalWithdrawn: w.totalWithdrawn || 0,
              },
            });
            await addDoc(collection(db, 'drivers', booking.driverId, 'transactions'), {
              type: 'earning', amount: captainShare, bookingId: id,
              note: `حجز #${id.slice(-6)}`, createdAt: now,
            });
          }
        }

        await notify('booking_completed', {
          name: booking.name || '', phone: booking.phone || '',
          amount: totalAmount.toLocaleString('ar-IQ'),
        }, booking.phone || '');
        await sendWhatsApp(MANAGER_PHONE, `✅ اكتمل حجز #${id.slice(-6)}\nالعميل: ${booking.name}\n💰 ${totalAmount.toLocaleString('ar-IQ')} د.ع`);
        return res.json({ success: true, message: 'تم إكمال المهمة وتحديث المحفظة' });
      }

      // Generic transition (close, etc.)
      await updateDoc(bookingRef, update);
      return res.json({ success: true, message: `تم تحديث الحالة إلى ${newStatus}` });
    } catch (error) {
      console.error('[action]', error);
      res.status(500).json({ error: 'Failed' });
    }
  });

  // ── Legacy manager action (keep for ManagerDashboard compatibility) ──
  app.post('/api/manager/action', async (req, res) => {
    try {
      const { bookingId, driverId, action } = req.body;
      if (!bookingId || !action) return res.status(400).json({ error: 'Missing fields' });
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnap = await getDoc(bookingRef);
      const booking = bookingSnap.exists() ? (bookingSnap.data() as Record<string, any>) : {};
      const now = new Date().toISOString();

      if (action === 'approve') {
        await updateDoc(bookingRef, {
          status: 'approved', driverId, approvedAt: now,
          statusHistory: [...(booking.statusHistory || []), { status: 'approved', at: now, by: 'manager' }],
        });
        const driverSnap = await getDoc(doc(db, 'drivers', driverId));
        const driver = driverSnap.exists() ? (driverSnap.data() as any) : { name: 'الكابتن', phone: '' };
        const acceptLink = await createShortLink(`${APP_URL}/action?id=${bookingId}&act=accept`);
        await notify('booking_approved', {
          name: booking.name || '', phone: booking.phone || '',
          neighborhood: booking.neighborhood || '', slot: booking.slot || '',
          driverName: driver.name, driverPhone: driver.phone || '', acceptLink,
        }, driver.phone || MANAGER_PHONE);
      } else if (action === 'reject') {
        await updateDoc(bookingRef, {
          status: 'rejected', rejectedAt: now,
          statusHistory: [...(booking.statusHistory || []), { status: 'rejected', at: now, by: 'manager' }],
        });
        await notify('booking_rejected', {
          name: booking.name || '', phone: booking.phone || '',
        }, booking.phone || '');
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[manager/action]', error);
      res.status(500).json({ error: 'Failed' });
    }
  });

  // ── Legacy approve-from-sms ───────────────────────────────────
  app.get('/api/approve-from-sms', async (req, res) => {
    // Redirect to the new action page instead
    const bookingId = req.query.bookingId as string;
    if (!bookingId) return res.redirect(`${APP_URL}/action?error=missing`);
    res.redirect(`${APP_URL}/action?id=${bookingId}&act=approve`);
  });

  // ── Captain wallet ────────────────────────────────────────────
  app.get('/api/captain/wallet', async (req, res) => {
    const { driverId } = req.query;
    if (!driverId) return res.status(400).json({ error: 'Missing driverId' });
    try {
      const snap = await getDoc(doc(db, 'drivers', driverId as string));
      if (!snap.exists()) return res.status(404).json({ error: 'Not found' });
      const data = snap.data() as any;
      const txSnap = await getDocs(collection(db, 'drivers', driverId as string, 'transactions'));
      const transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json({ wallet: data.wallet || { balance: 0, totalEarned: 0, totalWithdrawn: 0 }, transactions });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  app.post('/api/captain/transaction', async (req, res) => {
    const { driverId, type, amount, note } = req.body;
    if (!driverId || !type || !amount) return res.status(400).json({ error: 'Missing fields' });
    try {
      const driverRef = doc(db, 'drivers', driverId);
      const snap = await getDoc(driverRef);
      if (!snap.exists()) return res.status(404).json({ error: 'Not found' });
      const w = (snap.data() as any).wallet || { balance: 0, totalEarned: 0, totalWithdrawn: 0 };
      const amt = Number(amount);
      const newWallet = { ...w };
      if (type === 'withdrawal') {
        if (w.balance < amt) return res.status(400).json({ error: 'Insufficient balance' });
        newWallet.balance -= amt;
        newWallet.totalWithdrawn = (w.totalWithdrawn || 0) + amt;
      } else if (type === 'adjustment') {
        newWallet.balance = (w.balance || 0) + amt; // can be negative for deductions
      }
      await updateDoc(driverRef, { wallet: newWallet });
      await addDoc(collection(db, 'drivers', driverId, 'transactions'), {
        type, amount: amt, note: note || '', createdAt: new Date().toISOString(),
      });
      res.json({ success: true, wallet: newWallet });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // ── Driver management ─────────────────────────────────────────
  app.post('/api/manager/create-driver', async (req, res) => {
    const { name, code, phone } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
    const id = `d${Date.now()}`;
    const normalizedPhone = phone ? normalizePhone(phone) : '';
    await setDoc(doc(db, 'drivers', id), {
      name, code, phone: normalizedPhone,
      wallet: { balance: 0, totalEarned: 0, totalWithdrawn: 0 },
    });
    res.json({ success: true, driver: { id, name, code, phone: normalizedPhone } });
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
        .filter(b => b.driverId === driverId &&
          ['approved', 'accepted', 'on_road', 'on_process'].includes(b.status));
      res.json({ success: true, bookings });
    } catch { res.status(500).json({ error: 'Failed' }); }
  });

  // ── Driver status transitions (used by DriverView) ────────────
  app.post('/api/driver/accept-task', async (req, res) => {
    const { bookingId, driverId } = req.body;
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnap = await getDoc(bookingRef);
      if (!bookingSnap.exists()) return res.status(404).json({ error: 'Not found' });
      const booking = bookingSnap.data() as Record<string, any>;
      const now = new Date().toISOString();
      await updateDoc(bookingRef, {
        status: 'accepted', acceptedAt: now,
        statusHistory: [...(booking.statusHistory || []), { status: 'accepted', at: now, by: 'driver' }],
      });
      if (driverId) {
        const driverSnap = await getDoc(doc(db, 'drivers', driverId));
        const driver = driverSnap.exists() ? (driverSnap.data() as any) : { name: 'الكابتن' };
        await notify('driver_accepted', {
          name: booking.name || '', phone: booking.phone || '',
          driverName: driver.name, slot: booking.slot || '',
        }, booking.phone || '');
        await sendWhatsApp(MANAGER_PHONE, `✅ الكابتن ${driver.name} قبل مهمة #${bookingId.slice(-6)}`);
      }
      res.json({ success: true });
    } catch (error) {
      console.error('[driver/accept-task]', error);
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.post('/api/driver/on-road', async (req, res) => {
    const { bookingId, driverId } = req.body;
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnap = await getDoc(bookingRef);
      if (!bookingSnap.exists()) return res.status(404).json({ error: 'Not found' });
      const booking = bookingSnap.data() as Record<string, any>;
      const now = new Date().toISOString();
      await updateDoc(bookingRef, {
        status: 'on_road', onRoadAt: now,
        statusHistory: [...(booking.statusHistory || []), { status: 'on_road', at: now, by: 'driver' }],
      });
      if (driverId) {
        const driverSnap = await getDoc(doc(db, 'drivers', driverId));
        const driver = driverSnap.exists() ? (driverSnap.data() as any) : { name: 'الكابتن' };
        await notify('captain_on_road', {
          name: booking.name || '', phone: booking.phone || '',
          driverName: driver.name, slot: booking.slot || '',
        }, booking.phone || '');
        await sendWhatsApp(MANAGER_PHONE, `🚀 الكابتن ${driver.name} في الطريق لـ${booking.name}`);
      }
      res.json({ success: true });
    } catch (error) {
      console.error('[driver/on-road]', error);
      res.status(500).json({ error: 'Failed' });
    }
  });

  app.post('/api/driver/complete-task', async (req, res) => {
    const { bookingId, driverId } = req.body;
    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnap = await getDoc(bookingRef);
      if (!bookingSnap.exists()) return res.status(404).json({ error: 'Not found' });
      const booking = bookingSnap.data() as Record<string, any>;
      const now = new Date().toISOString();

      const pkgKey = (booking.package || '').toLowerCase();
      const totalAmount = PACKAGE_PRICES[pkgKey] || PACKAGE_PRICES[booking.package] || 0;
      const captainShare = Math.round(totalAmount * CAPTAIN_SHARE_PCT);
      const companyShare = totalAmount - captainShare;

      await updateDoc(bookingRef, {
        status: 'completed', completedAt: now,
        financials: { totalAmount, captainShare, companyShare },
        statusHistory: [...(booking.statusHistory || []), { status: 'completed', at: now, by: 'driver' }],
      });

      // Credit wallet
      if (driverId && totalAmount > 0) {
        const driverRef = doc(db, 'drivers', driverId);
        const driverSnap = await getDoc(driverRef);
        if (driverSnap.exists()) {
          const w = (driverSnap.data() as any).wallet || { balance: 0, totalEarned: 0, totalWithdrawn: 0 };
          await updateDoc(driverRef, {
            wallet: {
              balance: (w.balance || 0) + captainShare,
              totalEarned: (w.totalEarned || 0) + captainShare,
              totalWithdrawn: w.totalWithdrawn || 0,
            },
          });
          await addDoc(collection(db, 'drivers', driverId, 'transactions'), {
            type: 'earning', amount: captainShare, bookingId,
            note: `حجز #${bookingId.slice(-6)}`, createdAt: now,
          });
        }
      }

      await notify('booking_completed', {
        name: booking.name || '', phone: booking.phone || '',
        amount: totalAmount.toLocaleString('ar-IQ'),
      }, booking.phone || '');
      await sendWhatsApp(MANAGER_PHONE, `✅ اكتمل حجز #${bookingId.slice(-6)}\n💰 ${totalAmount.toLocaleString('ar-IQ')} د.ع`);

      res.json({ success: true });
    } catch (error) {
      console.error('[driver/complete-task]', error);
      res.status(500).json({ error: 'Failed' });
    }
  });

  // Legacy webhook
  app.post('/api/webhook', async (req, res) => {
    const d = req.body;
    await notify('new_booking', {
      id: d.id || '', name: d.name || '', phone: d.phone || '',
      neighborhood: d.neighborhood || '', carType: d.carType || '',
      package: d.package || '', date: d.date === 'today' ? 'اليوم' : 'غداً', slot: d.slot || '',
      approveLink: `${APP_URL}/action?id=${d.id}&act=approve`,
      rejectLink: `${APP_URL}/action?id=${d.id}&act=reject`,
    }, MANAGER_PHONE);
    res.json({ success: true });
  });

  // ── Booking status (legacy) ───────────────────────────────────
  app.get('/api/booking-status', async (req, res) => {
    const bookingId = req.query.bookingId as string;
    if (!bookingId) return res.status(400).json({ error: 'Missing bookingId' });
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

  // ── Vite dev / production static ──────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();
