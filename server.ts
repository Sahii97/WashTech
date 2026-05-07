import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON body
  app.use(express.json());

  // n8n has TWO separate webhooks — set these in AI Studio Secrets panel (or .env):
  //   N8N_BOOKING_WEBHOOK_URL  → "Collecter" node — triggered when a customer submits a new booking
  //   N8N_APPROVAL_WEBHOOK_URL → "Webhook" node   — triggered when a manager approves/rejects
  // For TESTING: use the webhook-test/... URLs shown when you click "Listen for test event" in n8n.
  // For PRODUCTION: use the webhook/... URLs (workflow must be active).
  const N8N_BOOKING_URL = process.env.N8N_BOOKING_WEBHOOK_URL
    || 'https://fahad97.app.n8n.cloud/webhook/7fcc4e77-6172-4476-a706-2864a4a0ae92';
  const N8N_APPROVAL_URL = process.env.N8N_APPROVAL_WEBHOOK_URL
    || 'https://fahad97.app.n8n.cloud/webhook/manager-approval';
  console.log(`[n8n] Booking URL:  ${N8N_BOOKING_URL}`);
  console.log(`[n8n] Approval URL: ${N8N_APPROVAL_URL}`);

  // In-memory store for available slots synced from n8n
  let availableSlots: any[] = [
    '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM',
    '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM',
    '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM',
    '12:00 AM'
  ];
  let availableDrivers: any[] = [
     { id: 'd1', name: 'Test Driver (Ali)', code: '1234' }
  ];
  let activeBookings: any[] = [];

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

  // 2. Endpoint for n8n to update drivers
  app.post('/api/update-drivers', (req, res) => {
    try {
      const drivers = req.body.availableDrivers || req.body.drivers || (Array.isArray(req.body) ? req.body : null);
      if (drivers) {
        availableDrivers = drivers;
        console.log('Received updated drivers from n8n:', availableDrivers);
        res.status(200).json({ success: true, message: 'Drivers updated successfully' });
      } else {
        res.status(400).json({ success: false, error: 'Invalid payload format' });
      }
    } catch (error) {
      console.error('Error updating drivers:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // 3. Reset All Data
  app.post('/api/reset-data', (req, res) => {
    try {
      activeBookings = [];
      availableDrivers = [
        { id: 'd1', name: 'Ali (Default)', code: '1234' }
      ];
      availableSlots = [
        '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM',
        '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM',
        '07:00 PM', '08:00 PM', '09:00 PM', '10:00 PM', '11:00 PM',
        '12:00 AM'
      ];
      console.log('Server memory data reset.');
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error resetting data:', error);
      res.status(500).json({ success: false });
    }
  });

  // 4. Proxy for n8n Webhooks to avoid CORS issues (new bookings → Collecter webhook)
  app.post('/api/proxy-n8n', async (req, res) => {
    try {
      // Convert body to query parameters because n8n nodes are looking at $json.query
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(req.body)) {
        params.append(key, String(value));
      }

      const finalUrl = `${N8N_BOOKING_URL}?${params.toString()}`;
      console.log('Proxying new booking to n8n Collecter:', finalUrl);

      // Use GET — n8n Collecter webhook is configured for GET, and all data is already in query params
      const response = await fetch(finalUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      const data = await response.text();
      console.log(`[n8n] Collecter response: HTTP ${response.status} — ${data}`);
      res.status(response.status).send(data);
    } catch (error) {
      console.error('[n8n] Proxy Error reaching Collecter:', error);
      res.status(500).json({ success: false, error: 'Failed to reach n8n' });
    }
  });

  // 3. Endpoint for n8n to sync the latest pending orders/bookings to the manager
  app.post('/api/update-bookings', (req, res) => {
    try {
      activeBookings = Array.isArray(req.body) ? req.body : (req.body.bookings || req.body);
      console.log('Received updated bookings from n8n:', activeBookings);
      res.status(200).json({ success: true, message: 'Bookings updated successfully' });
    } catch (error) {
      console.error('Error updating bookings:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  });

  // --- Manager Endpoints ---
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

  app.get('/api/drivers', (req, res) => {
    res.status(200).json({ drivers: availableDrivers });
  });

  app.get('/api/bookings', (req, res) => {
    res.status(200).json({ bookings: activeBookings });
  });

  // Proxy Route for New Booking (To n8n Collecter webhook)
  app.post('/api/webhook', async (req, res) => {
    try {
      const orderId = `ORD-${Math.floor(Math.random() * 10000)}`;

      const queryParams = new URLSearchParams();
      queryParams.append('id', orderId);
      Object.entries(req.body).forEach(([key, value]) => {
        queryParams.append(key, String(value));
      });
      
      const finalUrl = `${N8N_BOOKING_URL}?${queryParams.toString()}`;
      console.log(`[n8n] Sending new booking to Collecter: ${finalUrl}`);
      
      try {
        const response = await fetch(finalUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
          if (response.status === 404) {
             console.warn('n8n webhook is not responding with 404. Proceeding with local mock.');
          } else {
             console.warn(`n8n responded with HTTP ${response.status}. Proceeding with local mock.`);
          }
        }
      } catch (fetchError) {
        console.warn('Failed to fetch from n8n webhook, proceeding with local mock.', fetchError);
      }
      
      // Temporary: Since n8n isn't sending booking data back yet, we will mock adding it to the manager list
      const newBooking = {
         id: orderId,
         ...req.body,
         status: 'pending'
      };
      activeBookings.push(newBooking);

      res.status(200).json({ success: true, message: 'Booking locally mocked' });
    } catch (error) {
      console.error('Webhook proxy error:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to forward request to n8n' });
    }
  });

  // Proxy Route for Manager Approving/Rejecting Booking (To n8n manager-approval webhook)
  app.post('/api/manager/action', async (req, res) => {
    try {
      const { bookingId, driverId, action } = req.body;

      // Grab the full booking BEFORE mutating state — n8n needs all fields for Cleanup Data + Google Sheets
      const booking = activeBookings.find(b => b.id === bookingId);

      if (action === 'approve') {
        activeBookings = activeBookings.map(b =>
          b.id === bookingId ? { ...b, status: 'approved', driverId } : b
        );
      } else if (action === 'reject') {
        activeBookings = activeBookings.filter(b => b.id !== bookingId);
      }

      // Send full booking data so n8n's "Cleanup Data" agent and "Save to Google Sheets" work correctly.
      // n8n reads these via $json.query.* (GET query params).
      const queryParams = new URLSearchParams({
        bookingId,
        driverId: driverId || 'none',
        status: action === 'approve' ? 'approved' : 'rejected',
        name: booking?.name || '',
        phone: booking?.phone || '',
        neighborhood: booking?.neighborhood || '',
        carType: booking?.carType || '',
        slot: booking?.slot || '',
        package: booking?.package || '',
        date: booking?.date || '',
      });

      try {
        const response = await fetch(`${N8N_APPROVAL_URL}?${queryParams.toString()}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) {
          console.warn(`[n8n] Approval webhook responded ${response.status} — local state still updated.`);
        } else {
          console.log(`[n8n] Approval sent for booking ${bookingId} (${action})`);
        }
      } catch (err) {
        console.warn('[n8n] Approval webhook unreachable — local state still updated.', err);
      }

      res.status(200).json({ success: true, message: `Manager action ${action} processed` });
    } catch (error) {
      console.error('Manager action proxy error:', error);
      res.status(500).json({ success: false, error: 'Failed to process manager action' });
    }
  });

  app.get('/api/approve-from-sms', async (req, res) => {
    try {
      const bookingId = req.query.bookingId as string;
      const phoneParam = req.query.phone as string;
      
      if (!bookingId && !phoneParam) {
        return res.status(400).send('Missing bookingId or phone');
      }

      // Find and update local booking
      let found = false;
      let matchedBookingId = '';
      
      activeBookings = activeBookings.map(b => {
        const matchById = bookingId && (b.id === bookingId || b.id === decodeURIComponent(bookingId));
        // Remove pluses/spaces from phones for comparison
        const formatPhone = (p: string) => p?.replace(/\D/g, '');
        const matchByPhone = phoneParam && (formatPhone(b.phone) === formatPhone(phoneParam));
        
        if (!found && (matchById || matchByPhone)) {
          found = true;
          matchedBookingId = b.id;
          // Assign the first available driver as default since SMS approval doesn't pick one
          return { ...b, status: 'approved', driverId: availableDrivers[0]?.id };
        }
        return b;
      });

      if (!found) {
        return res.status(404).send(`
          <html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Booking Not Found</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 40px;">
            <div style="background: white; padding: 20px; border-radius: 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: inline-block;">
               <h2 style="color: #ff3b30; margin-top: 0;">Not Found</h2>
               <p>This booking could not be found or was already processed.</p>
               <a href="/manager" style="display:inline-block; padding: 10px 20px; background: #007aff; color: white; text-decoration: none; border-radius: 8px;">Go to Dashboard</a>
            </div>
          </body></html>
        `);
      }

      // Find the full booking to send all fields to n8n
      const approvedBooking = activeBookings.find(b => b.id === matchedBookingId);
      const smsQueryParams = new URLSearchParams({
        bookingId: matchedBookingId,
        driverId: availableDrivers[0]?.id || 'none',
        status: 'approved',
        name: approvedBooking?.name || '',
        phone: approvedBooking?.phone || '',
        neighborhood: approvedBooking?.neighborhood || '',
        carType: approvedBooking?.carType || '',
        slot: approvedBooking?.slot || '',
        package: approvedBooking?.package || '',
        date: approvedBooking?.date || '',
      });

      try {
        await fetch(`${N8N_APPROVAL_URL}?${smsQueryParams.toString()}`, { method: 'GET' });
      } catch (err) {
        console.warn('[n8n] SMS approval webhook fetch failed.', err);
      }

      res.send(`
        <html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Approved!</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background-color: #f2f2f7;">
          <div style="background: white; padding: 30px; border-radius: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); display: inline-block; max-width: 400px;">
             <div style="background: #34c759; color: white; width: 60px; height: 60px; border-radius: 30px; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 20px;">✓</div>
             <h2 style="color: #1c1c1e; margin-top: 0; margin-bottom: 10px;">Booking Approved!</h2>
             <p style="color: #8e8e93; font-size: 14px; margin-bottom: 24px;">Booking <strong>${bookingId}</strong> has been confirmed and assigned to the default driver.</p>
             <a href="/manager" style="display:inline-block; padding: 12px 24px; background: #007aff; color: white; text-decoration: none; border-radius: 12px; font-weight: bold; width: 100%; box-sizing: border-box;">Open Manager Dashboard</a>
          </div>
        </body></html>
      `);
    } catch (error) {
      res.status(500).send('Internal Server Error');
    }
  });

  // API Route to check booking status (for n8n to GET)
  app.get('/api/booking-status', (req, res) => {
    const bookingId = req.query.bookingId as string;
    if (!bookingId) {
      return res.status(400).json({ error: 'Missing bookingId parameter' });
    }
    
    // Find booking
    const booking = activeBookings.find(b => b.id === bookingId);
    
    if (booking) {
      res.json({ id: booking.id, status: booking.status, driverId: booking.driverId });
    } else {
      // If not in activeBookings it might be rejected or not found
      res.json({ id: bookingId, status: 'rejected_or_not_found' });
    }
  });

  // --- Driver Management Endpoints ---

  app.post('/api/manager/create-driver', (req, res) => {
    const { name, code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, error: 'Name and code required' });
    }
    const newDriver = {
       id: `d${Date.now()}`,
       name,
       code
    };
    availableDrivers.push(newDriver);
    res.status(200).json({ success: true, driver: newDriver });
  });

  app.post('/api/driver/login', (req, res) => {
    const { code } = req.body;
    const driver = availableDrivers.find(d => d.code === code);
    if (driver) {
       res.status(200).json({ success: true, driver });
    } else {
       res.status(401).json({ success: false, error: 'Invalid code' });
    }
  });

  app.get('/api/driver/dashboard', (req, res) => {
    const driverId = req.query.driverId;
    const driverOrders = activeBookings.filter(b => b.driverId === driverId && (b.status === 'approved' || b.status === 'on_process'));
    res.status(200).json({ success: true, bookings: driverOrders });
  });

  app.post('/api/driver/accept-task', (req, res) => {
    const { bookingId } = req.body;
    const bookingIndex = activeBookings.findIndex(b => b.id === bookingId);
    if (bookingIndex !== -1) {
       activeBookings[bookingIndex].status = 'on_process';
       res.status(200).json({ success: true });
    } else {
       res.status(404).json({ success: false, error: 'Not found' });
    }
  });

  app.post('/api/driver/complete-task', (req, res) => {
    const { bookingId } = req.body;
    const bookingIndex = activeBookings.findIndex(b => b.id === bookingId);
    if (bookingIndex !== -1) {
       activeBookings[bookingIndex].status = 'completed';
       res.status(200).json({ success: true });
    } else {
       res.status(404).json({ success: false, error: 'Booking not found' });
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
