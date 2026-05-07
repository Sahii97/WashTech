import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import BookingPage from './pages/BookingPage';
import ManagerDashboard from './pages/ManagerDashboard';
import DriverView from './pages/DriverView';
import DevDashboard from './pages/DevDashboard';

function SiteNav() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  // Show nav by default in development/AIS, unless explicitly hidden
  const showNav = searchParams.get('superadmin') !== 'false';

  if (!showNav) return null;

  const handleResetData = async () => {
    if (!window.confirm('WARNING: This will delete ALL bookings from the database and reset server memory. Continue?')) return;
    
    try {
      // 1. Reset Server Memory (Slots/Drivers)
      await fetch('/api/reset-data', { method: 'POST' });
      
      // 2. Clear Firestore Bookings
      const { collection, getDocs, deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('./lib/firebase');
      
      const querySnapshot = await getDocs(collection(db, 'bookings'));
      if (!querySnapshot.empty) {
        const deletePromises = querySnapshot.docs.map(d => deleteDoc(doc(db, 'bookings', d.id)));
        await Promise.all(deletePromises);
      }
      
      alert('System reset successfully.');
      window.location.reload();
    } catch (err) {
      console.error('Reset failed:', err);
      alert('Reset failed. Check console for details.');
    }
  };

  return (
    <div className="bg-[#11131a] w-full px-4 py-3 flex items-center flex-wrap gap-2 shadow-md text-sm sticky top-0 z-[99999] border-b border-white/10 overflow-x-auto no-scrollbar">
      <span className="text-white/50 font-mono text-[10px] uppercase tracking-wider mr-2 hidden md:block whitespace-nowrap">V3.0-DEV</span>
      <Link to="/" className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${location.pathname === '/' && !location.search.includes('superadmin=true') ? 'bg-[#007AFF] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>👤 User</Link>
      <Link to="/dev" className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${location.pathname === '/dev' ? 'bg-[#007AFF] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>🛠️ Developer</Link>
      <Link to="/manager" className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${location.pathname === '/manager' ? 'bg-[#007AFF] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>🏢 Manager</Link>
      <Link to="/driver" className={`px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${location.pathname === '/driver' ? 'bg-[#007AFF] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>🚚 Driver</Link>
      
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
        <Route path="/" element={<BookingPage />} />
        <Route path="/dev" element={<DevDashboard />} />
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/driver" element={<DriverView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

