import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Navigation, Car, Phone, Tag, Truck, Package, DollarSign, Clock } from 'lucide-react';
import { i18n, Language } from '../translations';

type TaskStatus = 'approved' | 'accepted' | 'on_road' | 'on_process' | 'completed';

export default function DriverView() {
  const [lang, setLang] = useState<Language>('ar');
  const [loggedDriver, setLoggedDriver] = useState<{ id: string; name: string } | null>(null);
  const [loginCode, setLoginCode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [wallet, setWallet] = useState<{ balance: number; totalEarned: number } | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<{ id: string; name: string; code: string }[]>([]);

  const t = i18n[lang];

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
  }, [t.dir, lang]);

  useEffect(() => {
    import('firebase/firestore').then(({ collection, getDocs }) => {
      import('../lib/firebase').then(({ db }) => {
        getDocs(collection(db, 'drivers')).then(snap => {
          setAvailableDrivers(snap.docs.map(doc => ({
            id: doc.id, name: doc.data().name, code: doc.data().code,
          })));
        });
      });
    });
  }, []);

  // Real-time tasks listener
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    if (loggedDriver) {
      import('firebase/firestore').then(({ collection, query, where, onSnapshot }) => {
        import('../lib/firebase').then(({ db }) => {
          const q = query(
            collection(db, 'bookings'),
            where('driverId', '==', loggedDriver.id),
            where('status', 'in', ['approved', 'accepted', 'on_road', 'on_process']),
          );
          unsubscribe = onSnapshot(q, snap => {
            setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          });
        });
      });

      // Load wallet
      fetch(`/api/captain/wallet?driverId=${loggedDriver.id}`)
        .then(r => r.json())
        .then(data => { if (data.wallet) setWallet(data.wallet); })
        .catch(() => {});
    } else {
      // Auto-login superadmin
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('superadmin') === 'true') {
        import('firebase/firestore').then(({ collection, query, where, getDocs }) => {
          import('../lib/firebase').then(({ db }) => {
            getDocs(query(collection(db, 'drivers'), where('code', '==', '1234'))).then(snap => {
              if (!snap.empty) {
                const d = snap.docs[0];
                setLoggedDriver({ id: d.id, name: d.data().name });
              }
            });
          });
        });
      }
    }
    return () => unsubscribe();
  }, [loggedDriver]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setErrorMsg('');
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const snap = await getDocs(query(collection(db, 'drivers'), where('code', '==', loginCode)));
      if (!snap.empty) {
        const d = snap.docs[0];
        setLoggedDriver({ id: d.id, name: d.data().name });
      } else {
        setErrorMsg(t.invalidCode);
      }
    } catch { setErrorMsg('خطأ في الشبكة'); }
    setIsLoggingIn(false);
  };

  const handleAccept = async (taskId: string) => {
    try {
      await fetch('/api/driver/accept-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: taskId, driverId: loggedDriver?.id }),
      });
    } catch (err) { console.error('Failed to accept task', err); }
  };

  const handleOnRoad = async (taskId: string) => {
    try {
      await fetch('/api/driver/on-road', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: taskId, driverId: loggedDriver?.id }),
      });
    } catch (err) { console.error('Failed to set on-road', err); }
  };

  const handleComplete = async (taskId: string) => {
    try {
      await fetch('/api/driver/complete-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: taskId, driverId: loggedDriver?.id }),
      });
    } catch (err) { console.error('Failed to complete task', err); }
  };

  const getTaskActions = (task: any) => {
    const status: TaskStatus = task.status;
    if (status === 'approved' || status === 'on_process') {
      return (
        <button type="button" onClick={() => handleAccept(task.id)}
          className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl shadow-lg shadow-orange-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg">
          <CheckCircle2 className="w-6 h-6" />
          {t.acceptJob || 'قبول المهمة'}
        </button>
      );
    }
    if (status === 'accepted') {
      return (
        <button type="button" onClick={() => handleOnRoad(task.id)}
          className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl shadow-lg shadow-purple-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg">
          <Truck className="w-6 h-6" />
          أنا في الطريق
        </button>
      );
    }
    if (status === 'on_road') {
      return (
        <button type="button" onClick={() => handleComplete(task.id)}
          className="w-full py-4 bg-[#0050B3] hover:bg-[#003B95] text-white font-bold rounded-2xl shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg">
          <CheckCircle2 className="w-6 h-6" />
          {t.markAsDone}
        </button>
      );
    }
    return null;
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      approved:   { label: 'مكلف',      cls: 'bg-blue-100 text-blue-700' },
      accepted:   { label: 'مقبول',     cls: 'bg-indigo-100 text-indigo-700' },
      on_road:    { label: 'في الطريق', cls: 'bg-purple-100 text-purple-700' },
      on_process: { label: 'مكلف',      cls: 'bg-blue-100 text-blue-700' },
    };
    const info = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${info.cls}`}>{info.label}</span>;
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center">
      <div className="w-full max-w-3xl bg-[#F2F2F7] min-h-screen flex flex-col md:border-x md:border-gray-200 md:shadow-lg relative">

        {/* Header */}
        <div className="bg-[#0050B3] pt-10 md:pt-12 pb-6 px-6 md:px-10 rounded-b-[32px] shadow-sm relative overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#003B95] to-transparent z-0 opacity-80" />
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex gap-2">
              <button type="button" onClick={() => setLang('ar')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${lang === 'ar' ? 'bg-white text-[#0050B3]' : 'bg-[#003B95] text-white border border-white/10'}`}>
                عربي
              </button>
              <button type="button" onClick={() => setLang('ku')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${lang === 'ku' ? 'bg-white text-[#0050B3]' : 'bg-[#003B95] text-white border border-white/10'}`}>
                کوردی
              </button>
            </div>
            <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                WashTech <span className="font-normal text-white/60">/ {t.driverTitle}</span>
              </h1>
            </div>
            {wallet && (
              <div className="bg-white/10 rounded-xl px-3 py-1.5 text-right">
                <p className="text-white/60 text-[10px]">المحفظة</p>
                <p className="text-white font-bold text-sm">{wallet.balance.toLocaleString('ar-IQ')} د.ع</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center px-5 py-8 w-full">
          {!loggedDriver ? (
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[32px] w-full max-w-lg p-6 lg:p-8 shadow-xl border border-gray-100 flex flex-col items-center text-center mt-10 md:mt-24"
            >
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <Navigation className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t.driverLoginParams}</h2>
              <p className="text-gray-500 mt-2 mb-8">{t.enterCode}</p>

              {errorMsg && (
                <div className="mb-4 w-full bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleLogin} className="w-full">
                <input
                  type="password"
                  placeholder="****"
                  value={loginCode}
                  onChange={e => setLoginCode(e.target.value)}
                  dir="ltr"
                  className="w-full text-center tracking-[1em] text-2xl font-mono py-4 bg-gray-50 border border-gray-200 rounded-2xl mb-4 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] transition-all"
                />
                <button
                  type="submit"
                  disabled={isLoggingIn || !loginCode}
                  className={`w-full py-4 text-white font-bold rounded-2xl shadow-xl transition-all flex justify-center items-center gap-2 ${
                    isLoggingIn || !loginCode ? 'bg-blue-400 cursor-not-allowed' : 'bg-[#007AFF] hover:bg-blue-600 shadow-blue-500/30'
                  }`}
                >
                  {isLoggingIn ? '...' : t.login}
                </button>
              </form>

              {availableDrivers.length > 0 && (
                <div className="w-full mt-6 pt-6 border-t border-gray-100 flex flex-col gap-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-left">Quick Login (Test Mode)</p>
                  {availableDrivers.map(d => (
                    <button key={d.id} onClick={() => setLoggedDriver({ id: d.id, name: d.name })}
                      className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-900 font-medium rounded-xl border border-gray-200 transition-colors">
                      Login as {d.name} {d.code ? `(Code: ${d.code})` : ''}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="w-full flex-1">
              <div className="flex items-center justify-between mb-6 px-2">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{t.driverTitle}</h2>
                  <p className="text-gray-500 text-sm mt-1">{loggedDriver.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#007AFF]/10 text-[#007AFF] text-sm font-semibold px-3 py-1.5 rounded-full">
                    {tasks.length} {t.newTask}
                  </span>
                  <button onClick={() => setLoggedDriver(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                    خروج
                  </button>
                </div>
              </div>

              {tasks.length === 0 ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white rounded-[32px] w-full p-8 shadow-xl border border-gray-100 flex flex-col items-center text-center mt-8"
                >
                  <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">{t.jobCompleted}</h2>
                  <p className="text-gray-500 font-medium text-lg">{t.headBack}</p>
                </motion.div>
              ) : (
                <div className="space-y-4 pb-20">
                  {tasks.map(task => (
                    <motion.div
                      key={task.id}
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-white rounded-[32px] w-full p-6 lg:p-8 shadow-xl border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-50">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">{task.name}</h2>
                          <span className="text-xs text-gray-400 font-mono">#{task.id.slice(-8).toUpperCase()}</span>
                        </div>
                        {statusBadge(task.status)}
                      </div>

                      <div className="space-y-5 mb-8">
                        <DetailRow label={t.location} icon={<Navigation className="w-5 h-5 text-gray-400" />}>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-medium text-gray-900">
                              {task.neighborhood} {task.date === 'today' ? `(${t.today})` : `(${t.tomorrow})`}
                            </span>
                            <a href={`https://maps.google.com/?q=${encodeURIComponent(task.gpsLocation || task.neighborhood)}`}
                              target="_blank" rel="noopener noreferrer"
                              className="p-2 bg-blue-50 text-[#007AFF] rounded-full hover:bg-blue-100 transition-colors shrink-0">
                              <Navigation className="w-4 h-4" />
                            </a>
                          </div>
                        </DetailRow>

                        <DetailRow label={t.vehicle} icon={<Car className="w-5 h-5 text-gray-400" />}>
                          <span className="text-lg font-medium text-gray-900" dir="ltr">
                            {task.carType} @ {task.slot}
                          </span>
                        </DetailRow>

                        {task.package && (
                          <DetailRow label={String(t.package)} icon={<Package className="w-5 h-5 text-gray-400" />}>
                            <span className="text-lg font-medium text-gray-900">{task.package}</span>
                          </DetailRow>
                        )}

                        <DetailRow label={t.contact} icon={<Phone className="w-5 h-5 text-[#007AFF]" />}>
                          <a href={`tel:${task.phone}`} className="text-lg font-medium text-[#007AFF]" dir="ltr">
                            {task.phone}
                          </a>
                        </DetailRow>
                      </div>

                      {getTaskActions(task)}

                      {/* Status guide */}
                      <div className="mt-4 flex items-center gap-2">
                        {['approved', 'accepted', 'on_road'].map((s, i) => (
                          <React.Fragment key={s}>
                            <div className={`flex-1 h-1.5 rounded-full ${
                              task.status === s || (s === 'approved' && task.status === 'on_process') ? 'bg-[#0050B3]' :
                              i < ['approved','accepted','on_road'].indexOf(task.status) ? 'bg-[#0050B3]' :
                              'bg-gray-200'
                            }`} />
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-0.5">
                        <span>مكلف</span><span>مقبول</span><span>في الطريق</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Wallet card */}
              {wallet && (
                <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />محفظتي
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">الرصيد الحالي</p>
                      <p className="text-2xl font-bold text-gray-900">{wallet.balance.toLocaleString('ar-IQ')}</p>
                      <p className="text-xs text-gray-400">د.ع</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">إجمالي الأرباح</p>
                      <p className="text-2xl font-bold text-green-600">{wallet.totalEarned.toLocaleString('ar-IQ')}</p>
                      <p className="text-xs text-gray-400">د.ع</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
        {icon}<span>{label}</span>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
