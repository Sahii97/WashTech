import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import BookingPage from './pages/BookingPage';
import ManagerDashboard from './pages/ManagerDashboard';
import DriverView from './pages/DriverView';
import QRPage from './pages/QRPage';

function DevNav() {
  const loc = useLocation();
  const links = [
    { to: '/booking',       label: 'Book'    },
    { to: '/manager-board', label: 'Manager' },
    { to: '/driver',        label: 'Driver'  },
    { to: '/qr',            label: 'QR'      },
  ];
  return (
    <div className="fixed top-1/2 -translate-y-1/2 left-2 z-[9999] bg-[#0A1628]/90 backdrop-blur-xl p-1.5 rounded-2xl flex flex-col gap-1.5 shadow-2xl border border-white/10">
      {links.map(({ to, label }) => (
        <Link
          key={to}
          to={to}
          className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors text-center ${loc.pathname === to ? 'bg-[#0057FF] text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'}`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DevNav />
      <Routes>
        <Route path="/"              element={<Navigate to="/booking" replace />} />
        <Route path="/booking"       element={<BookingPage />} />
        <Route path="/manager-board" element={<ManagerDashboard />} />
        <Route path="/manager"       element={<Navigate to="/manager-board" replace />} />
        <Route path="/driver"        element={<DriverView />} />
        <Route path="/qr"            element={<QRPage />} />
        <Route path="*"              element={<Navigate to="/booking" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
