import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Car, CheckCircle2, Clock, MapPin, User, Check, X, ChevronDown } from 'lucide-react';
import { i18n, Language } from '../translations';


export default function ManagerDashboard() {
  const [lang, setLang] = useState<Language>('ar');
  const t = i18n[lang];
  
  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
  }, [t.dir, lang]);

  const [activeTab, setActiveTab] = useState<'orders' | 'expenses' | 'drivers'>('orders');
  const [orders, setOrders] = useState<any[]>([]);
  const [driversList, setDriversList] = useState<any[]>([]);

  const [selectedDrivers, setSelectedDrivers] = useState<Record<string, string>>({});

  useEffect(() => {
    // Fetch bookings and drivers on mount and poll
    const fetchData = () => {
      fetch('/api/bookings')
        .then(res => res.json())
        .then(data => {
            if (data && data.bookings) {
                setOrders(data.bookings);
            }
        })
        .catch(console.error);
        
      fetch('/api/drivers')
        .then(res => res.json())
        .then(data => {
            if (data && data.drivers) {
                setDriversList(data.drivers);
            }
        })
        .catch(console.error);
    };
    
    fetchData();
    const intervalId = setInterval(fetchData, 10000);
    return () => clearInterval(intervalId);
  }, []);

  const handleDriverChange = (orderId: string, driverId: string) => {
    setSelectedDrivers(prev => ({ ...prev, [orderId]: driverId }));
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'approve') {
       if (!selectedDrivers[id]) {
         alert('يرجى اختيار السائق أولاً'); // Please choose a driver first
         return;
       }
    }
       
    try {
        const response = await fetch('/api/manager/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: id, driverId: selectedDrivers[id], action })
        });
        
        if (response.ok) {
            if (action === 'approve') {
                setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'approved' } : o));
            } else if (action === 'reject') {
                setOrders(prev => prev.filter(o => o.id !== id));
            }
        } else {
            alert(`Failed to ${action} order`);
        }
    } catch (error) {
        console.error(`Error processing ${action}:`, error);
    }
  };

  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverCode, setNewDriverCode] = useState('');

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName || !newDriverCode) return;
    
    try {
      const response = await fetch('/api/manager/create-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDriverName, code: newDriverCode })
      });
      if (response.ok) {
        const data = await response.json();
        setDriversList(prev => [...prev, data.driver]);
        setNewDriverName('');
        setNewDriverCode('');
        alert('Driver created successfully!'); // Can enhance UI later
      } else {
        alert('Failed to create driver');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const inProgressOrders = orders.filter(o => o.status === 'approved');
  const completedOrders = orders.filter(o => o.status === 'completed');

  return (
    <div className="min-h-screen bg-[#F2F2F7] w-full flex flex-col relative overflow-auto">
      <div className="w-full flex-1 flex flex-col relative">
        
        {/* Header - Blue Theme */}
        <div className="bg-[#0050B3] pt-10 md:pt-12 pb-8 px-6 lg:px-10 rounded-b-[32px] md:rounded-b-none shadow-lg relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#003B95] to-transparent z-0 opacity-80" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex gap-2">
              <button 
                 type="button" 
                 onClick={() => setLang('ar')} 
                 className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md ${lang === 'ar' ? 'bg-white text-[#0050B3]' : 'bg-[#003B95] text-white hover:bg-[#0050B3] border border-white/10'}`}
              >
                  عربي
              </button>
              <button 
                 type="button" 
                 onClick={() => setLang('ku')} 
                 className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md ${lang === 'ku' ? 'bg-white text-[#0050B3]' : 'bg-[#003B95] text-white hover:bg-[#0050B3] border border-white/10'}`}
              >
                 کوردی
              </button>
            </div>
            <div className="text-center absolute left-1/2 -translate-x-1/2">
              <div className="flex items-center justify-center gap-2 z-10 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">WashTech</h1>
              </div>
              <p className="text-white/80 text-sm md:text-base mt-1">{t.managerTitle}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border border-white/20 ml-auto">
              <User className="w-6 h-6 text-white" />
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8 relative z-10">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-white/80 text-xs uppercase tracking-wider font-semibold mb-1">{t.todayOrders}</div>
              <div className="text-2xl font-bold text-white">12</div>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-white/80 text-xs uppercase tracking-wider font-semibold mb-1">{t.activeDrivers}</div>
              <div className="text-2xl font-bold text-white">3</div>
            </div>
            <div className="hidden md:block bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
              <div className="text-white/80 text-xs uppercase tracking-wider font-semibold mb-1">{t.pendingApprovals}</div>
              <div className="text-2xl font-bold text-white">{orders.length}</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-5 lg:px-10 mt-8 flex-1 pb-32">
          {activeTab === 'orders' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row gap-6 w-full pb-8 overflow-x-auto min-h-[60vh] snap-x">
              
              {/* Column 1: New Orders */}
              <div className="w-full md:min-w-[320px] md:w-1/3 flex flex-col gap-3 snap-center shrink-0">
                <div className="flex items-center justify-between px-2 py-1">
                  <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">{t.newTitle}</h2>
                  <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">{pendingOrders.length}</span>
                </div>
                
                {pendingOrders.length === 0 && (
                   <div className="text-center py-8 text-gray-400 text-sm">{lang === 'ar' ? 'فارغ' : 'بەتاڵ'}</div>
                )}
                
                <AnimatePresence>
                  {pendingOrders.map((order) => (
                    <motion.div 
                      key={order.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="bg-white rounded-[20px] p-4 shadow-sm border border-gray-100/80 flex flex-col grab relative"
                    >
                      <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-3">
                        <div className="font-bold text-gray-900 text-lg">{order.name}</div>
                        <div className="text-[10px] font-mono font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded" dir="ltr">{order.id}</div>
                      </div>
                      
                      <div className="space-y-2 mb-4 flex-1">
                        <div className="flex items-start gap-2.5 text-gray-600">
                          <MapPin className="w-4 h-4 mt-0.5 text-[#007AFF] shrink-0" />
                          <span className="text-[13px] font-medium leading-snug">
                              {order.neighborhood}
                              {order.gpsLocation && (
                                 <a href={`https://maps.google.com/?q=${encodeURIComponent(order.gpsLocation)}`} target="_blank" rel="noopener noreferrer" className="ml-2 bg-blue-50 text-[#007AFF] px-2 py-0.5 rounded-[6px] text-[10px] select-auto">GPS</a>
                              )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 text-gray-600">
                          <Car className="w-4 h-4 text-[#007AFF] shrink-0" />
                          <span className="text-[13px] font-medium">{order.carType}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-gray-600" dir="ltr">
                          <Clock className="w-4 h-4 text-[#007AFF] shrink-0" />
                          <span className="text-[13px] font-medium">{order.slot} {order.date && `(${order.date})`}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-gray-900 font-bold pt-2 border-t border-gray-50" dir="ltr">
                          <span className="text-right w-full text-[13px]">{order.phone}</span>
                        </div>
                      </div>

                      {/* Driver Assignment Dropdown */}
                      <div className="mb-4 relative">
                         <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{t.assignDriver}</div>
                         <div className="relative">
                           <select 
                             className="w-full appearance-none bg-gray-50 border border-gray-100 text-gray-900 text-[13px] rounded-xl py-2 px-3 pr-8 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all font-medium"
                             value={selectedDrivers[order.id] || ''}
                             onChange={(e) => handleDriverChange(order.id, e.target.value)}
                           >
                             <option value="" disabled>{t.chooseDriver}</option>
                             {driversList.map(d => (
                               <option key={d.id} value={d.id}>{d.name}</option>
                             ))}
                           </select>
                           <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                             <ChevronDown className="w-4 h-4 text-gray-400" />
                           </div>
                         </div>
                      </div>

                      <div className="flex gap-2 mt-auto">
                        <button 
                          type="button" 
                          onClick={() => handleAction(order.id, 'reject')}
                          className="flex-1 py-2 bg-red-50 text-red-600 font-semibold rounded-[10px] text-[12px] hover:bg-red-100 active:scale-95 transition-all flex justify-center items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          {t.reject}
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleAction(order.id, 'approve')}
                          className="flex-1 py-2 bg-[#007AFF] text-white font-semibold rounded-[10px] text-[12px] hover:bg-blue-600 shadow-md shadow-blue-500/20 active:scale-95 transition-all flex justify-center items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {t.approve}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Column 2: Wait Approval from Driver */}
              <div className="w-full md:min-w-[320px] md:w-1/3 flex flex-col gap-3 snap-center shrink-0">
                <div className="flex items-center justify-between px-2 py-1">
                  <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'انتظار موافقة السائق' : 'چاوەڕێی شۆفێر'}</h2>
                  <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">{inProgressOrders.length}</span>
                </div>
                
                {inProgressOrders.length === 0 && (
                   <div className="text-center py-8 text-gray-400 text-sm">{lang === 'ar' ? 'فارغ' : 'بەتاڵ'}</div>
                )}
                
                <AnimatePresence>
                  {inProgressOrders.map((order) => (
                    <motion.div key={order.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-[20px] p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-orange-100/50 flex flex-col relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                      <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-3">
                        <div className="font-bold text-gray-900 text-lg">{order.name}</div>
                        <span className="bg-orange-50 text-orange-600 text-[10px] font-bold px-2 py-1 rounded-full tracking-wider" dir="ltr">
                           {order.id}
                        </span>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        <div className="text-[13px] text-gray-600 flex items-center gap-2.5">
                          <MapPin className="w-4 h-4 text-orange-400 shrink-0" />
                          <span className="truncate">{order.neighborhood}</span>
                        </div>
                        <div className="text-[13px] text-gray-600 flex items-center gap-2.5" dir="ltr">
                          <Clock className="w-4 h-4 text-orange-400 shrink-0" />
                          <span className="w-full text-right">{order.slot} {order.date && `(${order.date})`}</span>
                        </div>
                      </div>
                      
                      <div className="mt-auto pt-3 border-t border-gray-50 flex items-center justify-between gap-2 text-sm font-semibold text-gray-800">
                         <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-orange-400" />
                            <span className="text-[12px]">{driversList.find(d => d.id === order.driverId)?.name || 'N/A'}</span>
                         </div>
                         <div className="animate-pulse flex items-center gap-1.5 text-orange-500 text-[10px] uppercase font-bold">
                            Waiting
                         </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Column 3: Completed */}
              <div className="w-full md:min-w-[320px] md:w-1/3 flex flex-col gap-3 snap-center shrink-0">
                <div className="flex items-center justify-between px-2 py-1">
                  <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider">{lang === 'ar' ? 'مكتمل' : 'تەواوکراو'}</h2>
                  <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">{completedOrders.length}</span>
                </div>
                
                {completedOrders.length === 0 && (
                   <div className="text-center py-8 text-gray-400 text-sm">{lang === 'ar' ? 'فارغ' : 'بەتاڵ'}</div>
                )}
                
                <AnimatePresence>
                  {completedOrders.map((order) => (
                    <motion.div key={order.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gradient-to-br from-white to-green-50/10 rounded-[20px] p-4 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-green-100/50 flex flex-col relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-green-400"></div>
                      <div className="flex items-center justify-between mb-3 border-b border-gray-50 pb-3">
                        <div className="font-bold text-gray-900 text-lg opacity-70">{order.name}</div>
                        <span className="bg-green-50 text-green-600 text-[10px] font-bold px-2 py-1 rounded-full tracking-wider flex items-center gap-1" dir="ltr">
                           <CheckCircle2 className="w-3 h-3" /> {order.id}
                        </span>
                      </div>
                      
                      <div className="space-y-2 mb-3">
                        <div className="text-[13px] text-gray-500 flex items-center gap-2.5">
                          <MapPin className="w-4 h-4 text-green-400 shrink-0" />
                          <span className="truncate">{order.neighborhood}</span>
                        </div>
                        <div className="text-[13px] text-gray-500 flex items-center gap-2.5" dir="ltr">
                          <Clock className="w-4 h-4 text-green-400 shrink-0" />
                          <span className="w-full text-right">{order.slot} {order.date && `(${order.date})`}</span>
                        </div>
                      </div>

                      <div className="mt-auto pt-3 border-t border-green-100/30 flex items-center gap-2 text-sm font-semibold text-gray-800">
                         <User className="w-4 h-4 text-green-500" />
                         <span className="text-[12px]">{driversList.find(d => d.id === order.driverId)?.name || 'N/A'}</span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

            </motion.div>
          )}

          {activeTab === 'expenses' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 text-gray-500 font-medium">
               {t.expensesTab} ({t.comingSoon})
            </motion.div>
          )}

          {activeTab === 'drivers' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">{t.driversTab}</h2>
                <span className="bg-[#007AFF]/10 text-[#007AFF] text-sm font-semibold px-3 py-1 rounded-full">
                  {driversList.length} {t.activeDrivers}
                </span>
              </div>
              
              {/* Add Driver Form */}
              <div className="bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100 mb-6">
                <h3 className="font-bold text-gray-900 mb-4">{t.addDriver}</h3>
                <form onSubmit={handleCreateDriver} className="space-y-4">
                  <div>
                    <input 
                      type="text" 
                      placeholder={t.driverName}
                      value={newDriverName}
                      onChange={e => setNewDriverName(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
                      required
                    />
                  </div>
                  <div>
                    <input 
                      type="text" 
                      placeholder={t.driverCode}
                      value={newDriverCode}
                      onChange={e => setNewDriverCode(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
                      required
                      dir="ltr"
                    />
                  </div>
                  <button 
                    type="submit"
                    className="w-full py-3 bg-[#007AFF] text-white font-semibold rounded-xl hover:bg-blue-600 shadow-lg shadow-blue-500/30 active:scale-95 transition-all"
                  >
                    {t.addDriver}
                  </button>
                </form>
              </div>

              {/* Drivers List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                 {driversList.map((driver, idx) => (
                    <div key={driver.id || idx} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col gap-2 relative">
                        <div className="w-12 h-12 bg-[#007AFF]/10 text-[#007AFF] rounded-full flex items-center justify-center shrink-0 mb-2">
                           <User className="w-6 h-6" />
                        </div>
                        <div className="font-bold text-gray-900 text-lg">{driver.name}</div>
                        <div className="text-gray-500 text-sm flex items-center gap-2">
                           <span>Code:</span>
                           <span className="font-mono bg-gray-50 px-2 py-0.5 rounded text-gray-700 font-semibold tracking-widest">{driver.code || 'N/A'}</span>
                        </div>
                    </div>
                 ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Global Navigation Bar */}
        <div className="fixed md:absolute bottom-0 inset-x-0 bg-white/90 backdrop-blur-xl border-t border-gray-200/50 pb-safe pt-2 px-6 flex justify-around shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-50">
           <button type="button" onClick={() => setActiveTab('orders')} className={`flex flex-col items-center gap-1.5 p-3 w-24 transition-opacity ${activeTab === 'orders' ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}>
             <svg className={`w-8 h-8 ${activeTab === 'orders' ? 'text-[#007AFF]' : 'text-gray-900'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
             <span className={`text-base font-bold tracking-wide ${activeTab === 'orders' ? 'text-[#007AFF]' : 'text-gray-900'}`}>{t.ordersTab}</span>
           </button>
           <button type="button" onClick={() => setActiveTab('drivers')} className={`flex flex-col items-center gap-1.5 p-3 w-24 transition-opacity ${activeTab === 'drivers' ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}>
             <svg className={`w-8 h-8 ${activeTab === 'drivers' ? 'text-[#007AFF]' : 'text-gray-900'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
             <span className={`text-base font-bold tracking-wide ${activeTab === 'drivers' ? 'text-[#007AFF]' : 'text-gray-900'}`}>{t.driversTab}</span>
           </button>
        </div>
      </div>
    </div>
  );
}
