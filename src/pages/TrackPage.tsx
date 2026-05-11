import React, { useState } from 'react';
import { Search, ChevronLeft, Clock, CheckCircle2, XCircle, Truck, Package, MapPin } from 'lucide-react';

type BookingStatus = 'pending' | 'approved' | 'accepted' | 'on_road' | 'on_process' | 'completed' | 'closed' | 'rejected';

interface StatusInfo {
  label: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
  step: number;
}

const STATUS_INFO: Record<BookingStatus, StatusInfo> = {
  pending:    { label: 'قيد المراجعة',       color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   icon: <Clock className="w-4 h-4" />,        step: 1 },
  approved:   { label: 'تمت الموافقة',        color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     icon: <CheckCircle2 className="w-4 h-4" />, step: 2 },
  accepted:   { label: 'الكابتن قبل المهمة',  color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: <CheckCircle2 className="w-4 h-4" />, step: 3 },
  on_process: { label: 'الكابتن في الطريق',   color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: <Truck className="w-4 h-4" />,        step: 3 },
  on_road:    { label: 'الكابتن في الطريق',   color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: <Truck className="w-4 h-4" />,        step: 4 },
  completed:  { label: 'اكتملت الخدمة',       color: 'text-green-700',  bg: 'bg-green-50 border-green-200',   icon: <CheckCircle2 className="w-4 h-4" />, step: 5 },
  closed:     { label: 'مغلق',                color: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200',   icon: <CheckCircle2 className="w-4 h-4" />, step: 5 },
  rejected:   { label: 'مرفوض',               color: 'text-red-700',    bg: 'bg-red-50 border-red-200',       icon: <XCircle className="w-4 h-4" />,      step: 0 },
};

const STEPS = ['قيد المراجعة', 'تمت الموافقة', 'الكابتن جاهز', 'في الطريق', 'اكتمل'];

function normalizePhone(phone: string): string {
  const clean = phone.replace(/[\s\-()]/g, '');
  if (/^07\d{9}$/.test(clean)) return '+964' + clean.slice(1);
  return clean;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${Math.floor(h / 24)} يوم`;
}

export default function TrackPage() {
  const [phone, setPhone]       = useState('');
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError]       = useState('');

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    setSearched(false);
    try {
      const res  = await fetch(`/api/track?phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();
      if (data.error) { setError(data.error); setBookings([]); }
      else            { setBookings(data.bookings || []); }
      setSearched(true);
    } catch { setError('خطأ في الاتصال، حاول مرة أخرى'); }
    setLoading(false);
  }

  const st = (status: string) =>
    STATUS_INFO[status as BookingStatus] || { label: status, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', icon: null, step: 0 };

  return (
    <div dir="rtl" className="min-h-screen bg-[#F2F2F7] flex flex-col">
      {/* Header */}
      <header className="bg-[#0050B3] pt-10 pb-6 px-5 rounded-b-[32px] shadow-sm">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <a href="/" className="text-white/70 hover:text-white transition-colors p-1">
            <ChevronLeft className="w-6 h-6" />
          </a>
          <div>
            <h1 className="text-2xl font-bold text-white">تتبع طلبك</h1>
            <p className="text-blue-200 text-sm mt-0.5">أدخل رقم هاتفك لمعرفة حالة حجزك</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-4 py-6 pb-20 space-y-4">
        {/* Search form */}
        <form
          onSubmit={search}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
        >
          <label className="block text-sm font-semibold text-gray-700 mb-2">رقم الهاتف</label>
          <div className="flex gap-2">
            <input
              type="tel"
              dir="ltr"
              placeholder="07XXXXXXXXXX"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0050B3]/30 focus:border-[#0050B3] bg-gray-50"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 bg-[#0050B3] hover:bg-[#003B95] disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              {loading ? '...' : 'بحث'}
            </button>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Empty result */}
        {searched && !error && bookings.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <p className="font-bold text-gray-800 text-lg">لا توجد حجوزات</p>
            <p className="text-gray-500 text-sm mt-1">تأكد من رقم الهاتف المستخدم عند الحجز</p>
          </div>
        )}

        {/* Booking cards */}
        {bookings.map(b => {
          const info = st(b.status);
          return (
            <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Status header */}
              <div className={`px-5 py-3 border-b ${info.bg} flex items-center justify-between`}>
                <div className={`flex items-center gap-2 font-semibold text-sm ${info.color}`}>
                  {info.icon}
                  {info.label}
                </div>
                <span className="text-xs text-gray-400 font-mono">#{b.id.slice(-8).toUpperCase()}</span>
              </div>

              {/* Progress steps (not shown for rejected) */}
              {b.status !== 'rejected' && (
                <div className="px-5 pt-4 pb-2">
                  <div className="flex items-center gap-1">
                    {STEPS.map((step, i) => {
                      const stepNum = i + 1;
                      const current = info.step;
                      const active  = stepNum <= current;
                      return (
                        <React.Fragment key={step}>
                          <div className={`flex flex-col items-center gap-1 flex-1 min-w-0 ${stepNum === current ? 'opacity-100' : active ? 'opacity-70' : 'opacity-30'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${active ? 'bg-[#0050B3] text-white' : 'bg-gray-200 text-gray-500'}`}>
                              {active ? '✓' : stepNum}
                            </div>
                            <span className="text-[9px] text-center text-gray-500 leading-tight hidden sm:block">{step}</span>
                          </div>
                          {i < STEPS.length - 1 && (
                            <div className={`h-0.5 flex-1 shrink-0 rounded ${active && stepNum < current ? 'bg-[#0050B3]' : 'bg-gray-200'}`} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Booking details */}
              <div className="px-5 py-4 space-y-2.5 text-sm">
                <Row label="الاسم"    value={b.name} />
                <Row label="المنطقة"  value={b.neighborhood} icon={<MapPin className="w-3.5 h-3.5 text-gray-400" />} />
                <Row label="السيارة"  value={`${b.carType}`} icon={<Package className="w-3.5 h-3.5 text-gray-400" />} />
                <Row label="الباقة"   value={b.package} />
                <Row label="الموعد"   value={`${b.date === 'today' ? 'اليوم' : 'غداً'} ${b.slot}`} icon={<Clock className="w-3.5 h-3.5 text-gray-400" />} />
                {b.financials?.totalAmount > 0 && (
                  <Row label="المبلغ" value={`${b.financials.totalAmount.toLocaleString('ar-IQ')} د.ع`} />
                )}
              </div>

              {/* Status history */}
              {b.statusHistory && b.statusHistory.length > 1 && (
                <div className="border-t border-gray-100 px-5 py-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">سجل الحالات</p>
                  <div className="space-y-1.5">
                    {[...b.statusHistory].reverse().map((h: any, i: number) => {
                      const hInfo = st(h.status);
                      return (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className={`font-medium ${hInfo.color}`}>{hInfo.label}</span>
                          <span className="text-gray-400">{h.at ? timeAgo(h.at) : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* On-road pulse indicator */}
              {(b.status === 'on_road' || b.status === 'on_process') && (
                <div className="border-t border-indigo-100 bg-indigo-50 px-5 py-3 flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse shrink-0" />
                  <span className="text-indigo-700 text-sm font-semibold">الكابتن في طريقه إليك الآن</span>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 flex items-center gap-1">{icon}{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  );
}
