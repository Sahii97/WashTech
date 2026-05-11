import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Truck, Car, AlertTriangle, ChevronDown } from 'lucide-react';

type Act = 'approve' | 'reject' | 'accept' | 'on_road' | 'complete';

const ACT_CONFIG: Record<Act, { title: string; btn: string; color: string; confirm: string }> = {
  approve:  { title: 'قبول الحجز',        btn: 'قبول وإرسال للكابتن',      color: 'bg-green-600 hover:bg-green-700', confirm: 'تأكيد قبول الحجز؟' },
  reject:   { title: 'رفض الحجز',         btn: 'رفض وإشعار العميل',        color: 'bg-red-600 hover:bg-red-700',     confirm: 'تأكيد رفض الحجز؟' },
  accept:   { title: 'قبول المهمة',        btn: 'قبول المهمة وإشعار العميل', color: 'bg-blue-600 hover:bg-blue-700',   confirm: 'تأكيد قبول المهمة؟' },
  on_road:  { title: 'أنا في الطريق',      btn: 'إشعار العميل بالتوجه',     color: 'bg-purple-600 hover:bg-purple-700', confirm: 'إرسال إشعار للعميل؟' },
  complete: { title: 'إكمال المهمة',       btn: 'تأكيد الإكمال',            color: 'bg-green-700 hover:bg-green-800', confirm: 'تأكيد إكمال المهمة؟' },
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد المراجعة', approved: 'تمت الموافقة', accepted: 'الكابتن قبل',
  on_road: 'في الطريق', on_process: 'قيد التنفيذ', completed: 'مكتمل', rejected: 'مرفوض',
};

export default function ActionPage() {
  const params = new URLSearchParams(window.location.search);
  const id  = params.get('id')  || '';
  const act = (params.get('act') || '') as Act;

  const [booking,    setBooking]    = useState<any>(null);
  const [drivers,    setDrivers]    = useState<any[]>([]);
  const [driverId,   setDriverId]   = useState('');
  const [loading,    setLoading]    = useState(true);
  const [done,       setDone]       = useState(false);
  const [result,     setResult]     = useState('');
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dropOpen,   setDropOpen]   = useState(false);

  useEffect(() => {
    if (!id) { setError('رابط غير صالح — يرجى التحقق من الرابط'); setLoading(false); return; }
    const fetchData = async () => {
      try {
        const [bRes, dRes] = await Promise.all([
          fetch(`/api/action?id=${id}`),
          act === 'approve' ? fetch('/api/drivers') : Promise.resolve(null),
        ]);
        const bData = await bRes.json();
        if (bData.error) { setError(bData.error); setLoading(false); return; }
        setBooking(bData.booking);
        if (dRes) {
          const dData = await dRes.json();
          const list = dData.drivers || [];
          setDrivers(list);
          if (list.length) setDriverId(list[0].id);
        }
        setLoading(false);
      } catch { setError('فشل تحميل البيانات'); setLoading(false); }
    };
    fetchData();
  }, [id, act]);

  async function submit() {
    setSubmitting(true);
    try {
      const res  = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, act, driverId }),
      });
      const data = await res.json();
      if (data.success) { setDone(true); setResult(data.message); }
      else setError(data.error || 'حدث خطأ غير متوقع');
    } catch { setError('خطأ في الاتصال بالخادم'); }
    setSubmitting(false);
  }

  const cfg = ACT_CONFIG[act];

  return (
    <div dir="rtl" className="min-h-screen bg-[#F2F2F7] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 max-w-md w-full">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 bg-[#0050B3]/10 rounded-full flex items-center justify-center">
            <Car className="w-6 h-6 text-[#0050B3]" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">WashTech</p>
            <p className="text-sm text-gray-500">{cfg?.title || act}</p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="w-10 h-10 border-3 border-[#0050B3] border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderWidth: 3 }} />
            <p className="text-sm text-gray-400">جاري التحميل...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-8">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <p className="text-red-600 font-semibold text-lg">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-4 text-sm text-[#0050B3] underline">
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* Done */}
        {done && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <p className="text-gray-900 font-bold text-xl mb-2">{result}</p>
            <p className="text-gray-500 text-sm">تم إرسال الإشعار عبر واتساب ✓</p>
            <a href="/manager" className="mt-6 inline-block px-6 py-3 bg-[#0050B3] text-white font-bold rounded-2xl text-sm hover:bg-[#003B95] transition-colors">
              فتح لوحة المدير
            </a>
          </div>
        )}

        {/* Booking + action */}
        {!loading && !error && !done && booking && (
          <>
            {/* Booking details */}
            <div className="bg-gray-50 rounded-2xl p-4 mb-5 space-y-2.5 text-sm">
              {([
                ['العميل',   booking.name],
                ['الهاتف',   booking.phone],
                ['المنطقة',  booking.neighborhood],
                ['السيارة',  `${booking.carType} — ${booking.package}`],
                ['الموعد',   `${booking.date === 'today' ? 'اليوم' : 'غداً'} ${booking.slot}`],
                ['الحالة',   STATUS_LABELS[booking.status] || booking.status],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-gray-800" dir={label === 'الهاتف' ? 'ltr' : 'rtl'}>{val}</span>
                </div>
              ))}
            </div>

            {/* Driver select for approve */}
            {act === 'approve' && drivers.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">اختر الكابتن</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDropOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 text-sm hover:border-[#0050B3] transition-colors"
                  >
                    <span>{drivers.find(d => d.id === driverId)?.name || 'اختر كابتن'}</span>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${dropOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {dropOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                      {drivers.map((d: any) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => { setDriverId(d.id); setDropOpen(false); }}
                          className={`w-full px-4 py-3 text-right text-sm hover:bg-blue-50 transition-colors ${driverId === d.id ? 'text-[#0050B3] font-bold' : 'text-gray-800'}`}
                        >
                          {d.name}{d.phone ? ` — ${d.phone}` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {act === 'approve' && drivers.length === 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                ⚠️ لا يوجد كباتن مضافون. أضف كابتناً من لوحة المدير أولاً.
              </div>
            )}

            {(act !== 'approve' || drivers.length > 0) && (
              <button
                onClick={submit}
                disabled={submitting || (act === 'approve' && !driverId)}
                className={`w-full py-4 text-white font-bold rounded-2xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-base ${cfg?.color}`}
              >
                {submitting ? (
                  <span>جاري المعالجة...</span>
                ) : (
                  <>
                    {act === 'approve'  && <CheckCircle2 className="w-5 h-5" />}
                    {act === 'reject'   && <XCircle className="w-5 h-5" />}
                    {act === 'accept'   && <CheckCircle2 className="w-5 h-5" />}
                    {act === 'on_road'  && <Truck className="w-5 h-5" />}
                    {act === 'complete' && <CheckCircle2 className="w-5 h-5" />}
                    {cfg?.btn}
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
