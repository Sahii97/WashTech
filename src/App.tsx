import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import BookingPage from './pages/BookingPage';
import ManagerDashboard from './pages/ManagerDashboard';
import DriverView from './pages/DriverView';

function DevNav() {
  const location = useLocation();
  return (
    <div className="fixed top-1/2 -translate-y-1/2 left-4 z-[9999] bg-[#11131a]/90 backdrop-blur-xl p-2 rounded-2xl flex flex-col gap-2 shadow-2xl border border-white/10 shadow-black/50">
      <Link to="/" className={`px-4 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center ${location.pathname === '/' ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/30' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>Book</Link>
      <Link to="/manager" className={`px-4 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center ${location.pathname === '/manager' ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/30' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>Manager</Link>
      <Link to="/driver" className={`px-4 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center ${location.pathname === '/driver' ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/30' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>Driver</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <DevNav />
      <Routes>
        <Route path="/" element={<BookingPage />} />
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/driver" element={<DriverView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

