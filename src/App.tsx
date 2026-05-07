import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import BookingPage from './pages/BookingPage';
import ManagerDashboard from './pages/ManagerDashboard';
import DriverView from './pages/DriverView';

function SiteNav() {
  const location = useLocation();

  return (
    <div className="bg-[#11131a] w-full px-4 py-3 flex items-center flex-wrap gap-2 shadow-md text-sm sticky top-0 z-[99999] border-b border-white/10">
      <span className="text-white/50 font-mono text-xs uppercase tracking-wider mr-2 hidden md:block">App Navigation</span>
      <Link to="/" className={`px-4 py-2 rounded-lg font-semibold transition-colors ${location.pathname === '/' && !location.search.includes('superadmin=true') ? 'bg-[#007AFF] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>User View</Link>
      <Link to="/?superadmin=true" className={`px-4 py-2 rounded-lg font-semibold transition-colors ${location.pathname === '/' && location.search.includes('superadmin=true') ? 'bg-[#007AFF] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>Developer View</Link>
      <Link to="/manager" className={`px-4 py-2 rounded-lg font-semibold transition-colors ${location.pathname === '/manager' ? 'bg-[#007AFF] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>Manager View</Link>
      <Link to="/driver" className={`px-4 py-2 rounded-lg font-semibold transition-colors ${location.pathname === '/driver' ? 'bg-[#007AFF] text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>Driver View</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <SiteNav />
      <Routes>
        <Route path="/" element={<BookingPage />} />
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/driver" element={<DriverView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

