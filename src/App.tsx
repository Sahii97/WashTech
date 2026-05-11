import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import BookingPage from './pages/BookingPage';
import ManagerDashboard from './pages/ManagerDashboard';
import DriverView from './pages/DriverView';
import DevDashboard from './pages/DevDashboard';
import TrackPage from './pages/TrackPage';
import ActionPage from './pages/ActionPage';

function ShortLinkRedirect() {
  const code = window.location.pathname.replace('/go/', '');
  useEffect(() => {
    fetch(`/go/${code}`, { redirect: 'follow' })
      .then(res => { if (res.redirected) window.location.href = res.url; })
      .catch(() => {});
  }, [code]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">جاري التوجيه...</p>
      </div>
    </div>
  );
}

function SiteNav() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const showNav = searchParams.get('superadmin') !== 'false';
  if (!showNav) return null;

  const handleResetData = async () => {
    if (!window.confirm('WARNING: This will delete ALL bookings from the database and reset server memory. Continue?')) return;
    try {
      await fetch('/api/reset-data', { method: 'POST' });
      const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('./lib/firebase');
      const snap = await getDocs(collection(db, 'bookings'));
      if (!snap.empty) {
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, 'bookings', d.id))));
      }
      alert('System reset successfully.');
      window.location.reload();
    } catch (err) {
      console.error('Reset failed:', err);
      alert('Reset failed. Check console for details.');
    }
  };

  const navLink = (to: string, label: string) => {
    const active = location.pathname === to;
    return (
      <Link to={to}
        className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${active ? 'bg-[#007AFF] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
        {label}
      </Link>
    );
  };

  return (
    <div className="bg-[#11131a] w-full px-4 py-3 flex items-center flex-wrap gap-2 shadow-md text-sm sticky top-0 z-[99999] border-b border-white/10 overflow-x-auto">
      <span className="text-white/50 font-mono text-[10px] uppercase tracking-wider mr-2 hidden md:block whitespace-nowrap">V4.0</span>
      {navLink('/', '👤 الحجز')}
      {navLink('/track', '📍 تتبع')}
      {navLink('/dev', '🛠️ Developer')}
      {navLink('/manager', '🏢 Manager')}
      {navLink('/driver', '🚗 Driver')}
      <div className="flex gap-2 ml-auto">
        <button
          onClick={handleResetData}
          className="bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white px-4 py-2 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all border border-red-500/30"
        >
          Reset All
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SiteNav />
      <Routes>
        <Route path="/"        element={<BookingPage />} />
        <Route path="/track"   element={<TrackPage />} />
        <Route path="/action"  element={<ActionPage />} />
        <Route path="/go/:code" element={<ShortLinkRedirect />} />
        <Route path="/dev"     element={<DevDashboard />} />
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/driver"  element={<DriverView />} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
