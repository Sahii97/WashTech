import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Database, Shield, Zap, RefreshCw, Trash2, UserPlus, Globe, Code } from 'lucide-react';
import { doc, collection, getDocs, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function DevDashboard() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const [newDriver, setNewDriver] = useState({ name: '', code: '' });
  const [status, setStatus] = useState<string>('idle');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const dSnap = await getDocs(collection(db, 'drivers'));
        setDrivers(dSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        const bSnap = await getDocs(collection(db, 'bookings'));
        setBookingsCount(bSnap.size);
      } catch (err) {
        console.error('Fetch error:', err);
      }
    };
    fetchData();
  }, []);

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriver.name || !newDriver.code) return;
    setStatus('creating');
    try {
      await addDoc(collection(db, 'drivers'), newDriver);
      setNewDriver({ name: '', code: '' });
      const snap = await getDocs(collection(db, 'drivers'));
      setDrivers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Delete ALL bookings and data?')) return;
    setIsResetting(true);
    try {
      const bSnap = await getDocs(collection(db, 'bookings'));
      await Promise.all(bSnap.docs.map(d => deleteDoc(doc(db, 'bookings', d.id))));
      
      await fetch('/api/reset-data', { method: 'POST' });
      
      setBookingsCount(0);
      alert('Reset complete.');
    } catch (err) {
      alert('Reset failed.');
    } finally {
      setIsResetting(false);
    }
  };

  const testN8N = async () => {
    try {
      const res = await fetch('/api/proxy-n8n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_dev_ping', timestamp: new Date().toISOString() })
      });
      if (res.ok) alert('Proxy request sent! Check n8n Executions.');
      else alert('Proxy error: ' + res.status);
    } catch (err) {
      alert('Failed to reach proxy: ' + String(err));
    }
  };

  const seedData = async (type: 'slots' | 'drivers') => {
    try {
      const endpoint = type === 'slots' ? '/api/update-slots' : '/api/update-drivers';
      const payload = type === 'slots' 
        ? ['09:00 AM', '11:00 AM', '01:00 PM', '03:00 PM', '05:00 PM']
        : [
            { id: 'd101', name: 'Karim (n8n Mock)', code: '7777' },
            { id: 'd102', name: 'Sara (n8n Mock)', code: '9999' }
          ];
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) alert(`${type} seeded in server memory.`);
      else alert('Failed to seed.');
    } catch (err) {
      alert('Error: ' + String(err));
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-300 p-6 md:p-12 font-sans selection:bg-[#007AFF]/30 overflow-auto">
      <div className="max-w-6xl mx-auto pb-24">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#007AFF] rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Code className="text-white w-6 h-6" />
              </div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Developer Dashboard</h1>
            </div>
            <p className="text-gray-500 font-medium">System Administration & Debug Tools</p>
          </div>
          
          <div className="flex items-center gap-4">
             <button onClick={() => window.location.reload()} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors border border-white/5" title="Refresh Page">
                <RefreshCw className="w-5 h-5 text-gray-400" />
             </button>
             <button 
                onClick={handleReset}
                disabled={isResetting}
                className="flex items-center gap-2 px-6 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-bold rounded-xl border border-red-500/20 transition-all active:scale-[0.98] disabled:opacity-50"
             >
                <Trash2 className="w-5 h-5" />
                Reset System
             </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Column 1: System Stats */}
          <div className="space-y-8">
            <div className="bg-[#11131a] rounded-[28px] p-6 border border-white/5 shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <Shield className="w-5 h-5 text-[#34c759]" />
                <h2 className="font-bold text-white uppercase tracking-widest text-xs">Security & Status</h2>
              </div>
              
              <div className="space-y-4 font-mono text-sm">
                <div className="flex justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                  <span className="text-gray-500">Firestore</span>
                  <span className="text-[#34c759] font-bold">READY</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                  <span className="text-gray-500">n8n Integr.</span>
                  <span className="text-[#ff9500] font-bold">ACTIVE</span>
                </div>
                <div className="flex justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                  <span className="text-gray-500">Node Env</span>
                  <span className="text-blue-400 font-bold uppercase truncate max-w-[80px]">AIS</span>
                </div>
              </div>
              
              <button 
                onClick={testN8N}
                className="w-full mt-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 transition-colors flex items-center justify-center gap-2"
              >
                <Globe className="w-4 h-4" />
                Test n8n Webhook
              </button>
            </div>

            <div className="bg-[#11131a] rounded-[28px] p-6 border border-white/5 shadow-2xl overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                <Database className="w-16 h-16 text-[#007AFF]" />
              </div>
              <div className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Total Bookings</div>
              <div className="text-5xl font-bold text-white mb-4">{bookingsCount}</div>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">Persistent records currently stored in the Firebase Production cluster.</p>
              
              <div className="flex gap-2">
                 <button onClick={() => seedData('slots')} className="flex-1 py-2 bg-blue-500/10 hover:bg-blue-500 text-blue-400 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-tighter border border-blue-500/20 transition-all">Seed Slots</button>
                 <button onClick={() => seedData('drivers')} className="flex-1 py-2 bg-purple-500/10 hover:bg-purple-500 text-purple-400 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-tighter border border-purple-500/20 transition-all">Seed Drivers</button>
              </div>
            </div>
          </div>

          {/* Column 2: Driver Management */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-[#11131a] rounded-[28px] p-8 border border-white/5 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <h2 className="font-bold text-white uppercase tracking-widest text-xs">Credential Creator</h2>
                </div>
                <span className="px-3 py-1 bg-yellow-400/10 text-yellow-400 rounded-full text-[10px] font-bold">ACTIVE REGISTRY</span>
              </div>

              <form onSubmit={handleCreateDriver} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-10">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Driver Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Karwan Azad"
                    value={newDriver.name}
                    onChange={e => setNewDriver(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 text-white font-medium"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Login Code (4-digits)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 8888"
                    value={newDriver.code}
                    onChange={e => setNewDriver(p => ({ ...p, code: e.target.value }))}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-5 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/50 text-white font-mono tracking-widest"
                    required
                  />
                </div>
                <div className="flex items-end">
                  <button 
                    type="submit"
                    className="w-full py-3 bg-[#007AFF] hover:bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1 mb-4 flex items-center gap-2">
                   Live Drivers 
                   <span className="w-1.5 h-1.5 rounded-full bg-[#34c759] animate-pulse"></span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {drivers.length === 0 && <p className="text-gray-600 italic">No drivers registered yet.</p>}
                  {drivers.map(d => (
                    <div key={d.id} className="bg-black/30 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-[#007AFF]/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-[#007AFF]/10 group-hover:text-[#007AFF] transition-colors">
                          <Code className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-white tracking-tight">{d.name}</div>
                          <div className="text-xs font-mono text-gray-500">ID: {d.id.slice(-6)}</div>
                        </div>
                      </div>
                      <div className="bg-black/50 px-3 py-1.5 rounded-lg border border-white/5 text-[#007AFF] font-mono font-bold tracking-widest text-sm shadow-inner">
                        {d.code}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-600/10 to-transparent p-8 rounded-[28px] border border-blue-500/10">
               <h3 className="text-white font-bold mb-2">Integration Notice</h3>
               <p className="text-gray-500 text-sm leading-relaxed max-w-2xl">
                 All changes made in this dashboard are synchronous with the Firebase Real-time DB 
                 and will propagate immediately to the Manager and Driver views. Use the n8n webhook 
                 test button to verify connectivity with your automated workflows.
               </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
