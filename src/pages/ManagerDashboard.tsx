import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Clock, User, Package, Check, X, ChevronRight, Phone, FileText, ArrowRight, Trash2 } from 'lucide-react';
import { i18n, Language, PACKAGES } from '../translations';
import { WashTechLogo } from '../components/WashTechLogo';

interface Booking {
  id: string;
  name: string;
  phone: string;
  location: string;
  package: string;
  packageNameAr: string;
  packagePrice: number;
  date: string;
  time: string;
  notes?: string;
  status: 'new' | 'assigned' | 'in_progress' | 'completed';
  driverId?: string;
  driverName?: string;
  createdAt: string;
}

interface Driver {
  id: string;
  name: string;
  phone: string;
  code: string;
}

// ── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  drivers,
  lang,
  onAssign,
  onNext,
  onDelete,
}: {
  key?: React.Key;
  booking: Booking;
  drivers: Driver[];
  lang: Language;
  onAssign: (id: string, driverId: string) => void;
  onNext: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = i18n[lang];
  const [showAssign, setShowAssign] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [loading, setLoading] = useState(false);

  const statusColor = {
    new: 'bg-blue-500',
    assigned: 'bg-orange-400',
    in_progress: 'bg-purple-500',
    completed: 'bg-green-500',
  }[booking.status];

  const handleAssign = async () => {
    if (!selectedDriver) return;
    setLoading(true);
    await onAssign(booking.id, selectedDriver);
    setLoading(false);
    setShowAssign(false);
  };

  const handleNext = async () => {
    setLoading(true);
    await onNext(booking.id);
    setLoading(false);
  };

  const canMoveNext = booking.status === 'assigned' || booking.status === 'in_progress';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative"
    >
      {/* status stripe */}
      <div className={`absolute top-0 left-0 bottom-0 w-1 ${statusColor} rounded-l-2xl`} />

      <div className="p-4 pl-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-[#0A1628] text-base truncate">{booking.name}</div>
          <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded shrink-0 mr-2" dir="ltr">{booking.id}</span>
        </div>

        {/* Details */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2 text-gray-600 text-[13px]">
            <MapPin className="w-3.5 h-3.5 text-[#0057FF] shrink-0" />
            <span className="truncate">{booking.location}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600 text-[13px]">
            <Package className="w-3.5 h-3.5 text-[#0057FF] shrink-0" />
            <span className="truncate">{booking.packageNameAr}</span>
            <span className="text-[#0057FF] font-semibold text-[11px] shrink-0">{booking.packagePrice?.toLocaleString()} IQD</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600 text-[13px]" dir="ltr">
            <Clock className="w-3.5 h-3.5 text-[#0057FF] shrink-0" />
            <span>{booking.date} {booking.time}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600 text-[13px]" dir="ltr">
            <Phone className="w-3.5 h-3.5 text-[#0057FF] shrink-0" />
            <a href={`tel:${booking.phone}`} className="text-[#0057FF] hover:underline">{booking.phone}</a>
          </div>
          {booking.notes && (
            <div className="flex items-start gap-2 text-gray-500 text-[12px]">
              <FileText className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{booking.notes}</span>
            </div>
          )}
          {booking.driverName && (
            <div className="flex items-center gap-2 text-gray-700 text-[13px]">
              <User className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span className="font-medium">{booking.driverName}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {/* Assign driver (only for 'new' status) */}
          {booking.status === 'new' && (
            <div>
              {!showAssign ? (
                <button
                  type="button"
                  onClick={() => setShowAssign(true)}
                  className="w-full py-2 bg-[#0057FF] text-white text-[13px] font-semibold rounded-xl hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" />
                  {t.assignDriver}
                </button>
              ) : (
                <AnimatePresence>
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
                    <select
                      value={selectedDriver}
                      onChange={e => setSelectedDriver(e.target.value)}
                      className="w-full text-[13px] bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#0057FF] transition-colors text-[#0A1628]"
                      dir={i18n[lang].dir}
                    >
                      <option value="" disabled>{t.chooseDriver}</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowAssign(false)} className="flex-1 py-2 bg-gray-100 text-gray-600 text-[12px] font-semibold rounded-xl hover:bg-gray-200 active:scale-95 transition-all">
                        {t.cancel}
                      </button>
                      <button
                        type="button"
                        onClick={handleAssign}
                        disabled={!selectedDriver || loading}
                        className={`flex-1 py-2 text-white text-[12px] font-semibold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1 ${selectedDriver && !loading ? 'bg-[#0057FF] hover:bg-blue-700 shadow-md shadow-blue-500/20' : 'bg-gray-300 cursor-not-allowed'}`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {t.approve}
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          )}

          {/* Move to next stage */}
          {canMoveNext && (
            <button
              type="button"
              onClick={handleNext}
              disabled={loading}
              className="w-full py-2 bg-green-50 text-green-700 text-[13px] font-semibold rounded-xl hover:bg-green-100 active:scale-95 transition-all border border-green-200 flex items-center justify-center gap-1.5"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              {t.moveNext}
            </button>
          )}

          {/* Delete */}
          {booking.status !== 'completed' && (
            <button
              type="button"
              onClick={() => onDelete(booking.id)}
              className="w-full py-1.5 text-red-400 text-[11px] font-medium rounded-xl hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              {t.deleteBooking}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function ManagerDashboard() {
  const [lang, setLang] = useState<Language>('ar');
  const t = i18n[lang];

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activeTab, setActiveTab] = useState<'orders' | 'drivers'>('orders');

  // Add driver form
  const [newDriver, setNewDriver] = useState({ name: '', phone: '', code: '' });
  const [driverSaving, setDriverSaving] = useState(false);

  useEffect(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const fetchAll = useCallback(() => {
    fetch('/api/bookings').then(r => r.json()).then(setBookings).catch(console.error);
    fetch('/api/drivers').then(r => r.json()).then(setDrivers).catch(console.error);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const handleAssign = async (bookingId: string, driverId: string) => {
    const res = await fetch(`/api/bookings/${bookingId}/assign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ driverId }),
    });
    if (res.ok) fetchAll();
  };

  const handleNext = async (bookingId: string) => {
    const res = await fetch(`/api/bookings/${bookingId}/next`, { method: 'POST' });
    if (res.ok) fetchAll();
  };

  const handleDelete = async (bookingId: string) => {
    if (!window.confirm('حذف هذا الطلب؟')) return;
    const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' });
    if (res.ok) fetchAll();
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriver.name || !newDriver.phone || !newDriver.code) return;
    setDriverSaving(true);
    const res = await fetch('/api/drivers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDriver),
    });
    if (res.ok) { fetchAll(); setNewDriver({ name: '', phone: '', code: '' }); }
    setDriverSaving(false);
  };

  const cols: { key: Booking['status']; label: string; color: string; dot: string }[] = [
    { key: 'new',         label: t.colNew,        color: 'border-t-blue-500',   dot: 'bg-blue-500'   },
    { key: 'assigned',    label: t.colAssigned,   color: 'border-t-orange-400', dot: 'bg-orange-400' },
    { key: 'in_progress', label: t.colInProgress, color: 'border-t-purple-500', dot: 'bg-purple-500' },
    { key: 'completed',   label: t.colCompleted,  color: 'border-t-green-500',  dot: 'bg-green-500'  },
  ];

  const newCount = bookings.filter(b => b.status === 'new').length;

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col" dir="ltr">

      {/* Header */}
      <div className="bg-[#0057FF] pt-10 pb-8 px-6 md:px-10 shadow-lg relative overflow-hidden shrink-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#003B95]/70 to-transparent" />
        <div className="relative z-10 flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {(['ar', 'ku'] as Language[]).map(l => (
              <button key={l} type="button" onClick={() => setLang(l)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${lang === l ? 'bg-white text-[#0057FF]' : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'}`}>
                {l === 'ar' ? 'عربي' : 'کوردی'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <WashTechLogo className="w-8 h-8" white />
            <div className="text-center">
              <div className="text-white font-bold text-xl tracking-tight">Wash Tech</div>
              <div className="text-white/70 text-xs" dir={t.dir}>{t.managerTitle}</div>
            </div>
          </div>
          <div className="w-16" />
        </div>
        {/* Stats */}
        <div className="relative z-10 grid grid-cols-3 gap-3">
          {[
            { label: t.todayOrders,  value: bookings.length },
            { label: t.activeDrivers, value: drivers.length },
            { label: t.totalPending,  value: newCount },
          ].map(stat => (
            <div key={stat.label} className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <div className="text-white/70 text-[10px] uppercase font-semibold mb-1 truncate" dir={t.dir}>{stat.label}</div>
              <div className="text-white font-bold text-2xl">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">

        {activeTab === 'orders' && (
          <div className="flex-1 overflow-x-auto p-4 md:p-6">
            <div className="flex gap-4 min-w-max h-full pb-20">
              {cols.map(col => {
                const cards = bookings.filter(b => b.status === col.key);
                return (
                  <div key={col.key} className="w-72 md:w-80 flex flex-col gap-3 flex-shrink-0">
                    {/* Column header */}
                    <div className="flex items-center gap-2 px-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                      <span className="text-[13px] font-bold text-gray-500 uppercase tracking-wider" dir={t.dir}>{col.label}</span>
                      <span className="bg-gray-200 text-gray-600 text-[11px] font-bold px-1.5 py-0.5 rounded-full">{cards.length}</span>
                    </div>
                    {/* Cards */}
                    <div className={`flex-1 flex flex-col gap-3 bg-gray-200/50 rounded-2xl p-3 min-h-[120px] border-t-4 ${col.color}`}>
                      {cards.length === 0 && (
                        <div className="text-center py-6 text-gray-400 text-sm" dir={t.dir}>{t.empty}</div>
                      )}
                      <AnimatePresence>
                        {cards.map(b => (
                          <BookingCard
                            key={b.id}
                            booking={b}
                            drivers={drivers}
                            lang={lang}
                            onAssign={handleAssign}
                            onNext={handleNext}
                            onDelete={handleDelete}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24">
            {/* Add Driver Form */}
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-5 max-w-lg">
              <h3 className="font-bold text-[#0A1628] mb-4" dir={t.dir}>{t.addDriver}</h3>
              <form onSubmit={handleAddDriver} className="space-y-3">
                <input
                  type="text"
                  placeholder={t.driverName}
                  value={newDriver.name}
                  onChange={e => setNewDriver(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-[#0057FF] transition-colors"
                  required dir={t.dir}
                />
                <input
                  type="tel"
                  placeholder={t.driverPhone}
                  value={newDriver.phone}
                  onChange={e => setNewDriver(p => ({ ...p, phone: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-[#0057FF] transition-colors"
                  required dir="ltr"
                />
                <input
                  type="text"
                  placeholder={t.driverCode}
                  value={newDriver.code}
                  onChange={e => setNewDriver(p => ({ ...p, code: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-[15px] outline-none focus:border-[#0057FF] transition-colors"
                  required dir="ltr"
                />
                <button
                  type="submit"
                  disabled={driverSaving}
                  className="w-full py-3 bg-[#0057FF] text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/25 active:scale-95 transition-all"
                >
                  {t.save}
                </button>
              </form>
            </div>

            {/* Drivers list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
              {drivers.map(driver => (
                <div key={driver.id} className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-[#0057FF]/10 text-[#0057FF] rounded-full flex items-center justify-center mb-3">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="font-bold text-[#0A1628] text-lg mb-1" dir={t.dir}>{driver.name}</div>
                  <div className="text-gray-500 text-sm mb-1" dir="ltr">{driver.phone}</div>
                  <div className="flex items-center gap-2 text-gray-400 text-xs">
                    <span>Code:</span>
                    <span className="font-mono bg-gray-50 px-2 py-0.5 rounded text-gray-700 font-bold tracking-widest">{driver.code}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 inset-x-0 bg-white/90 backdrop-blur-xl border-t border-gray-200/50 pb-safe pt-2 px-8 flex justify-around shadow-lg z-50">
        <button type="button" onClick={() => setActiveTab('orders')}
          className={`flex flex-col items-center gap-1 p-2 w-24 transition-opacity ${activeTab === 'orders' ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
        >
          <svg className={`w-7 h-7 ${activeTab === 'orders' ? 'text-[#0057FF]' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          <span className={`text-xs font-bold ${activeTab === 'orders' ? 'text-[#0057FF]' : 'text-gray-700'}`} dir={t.dir}>{t.ordersTab}</span>
        </button>
        <button type="button" onClick={() => setActiveTab('drivers')}
          className={`flex flex-col items-center gap-1 p-2 w-24 transition-opacity ${activeTab === 'drivers' ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
        >
          <svg className={`w-7 h-7 ${activeTab === 'drivers' ? 'text-[#0057FF]' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <span className={`text-xs font-bold ${activeTab === 'drivers' ? 'text-[#0057FF]' : 'text-gray-700'}`} dir={t.dir}>{t.driversTab}</span>
        </button>
      </div>
    </div>
  );
}
