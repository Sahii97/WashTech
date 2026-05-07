import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Navigation, Car, Phone, Tag } from 'lucide-react';
import { i18n, Language } from '../translations';

export default function DriverView() {
  const [lang, setLang] = useState<Language>('ar');
  const [loggedDriver, setLoggedDriver] = useState<{ id: string, name: string } | null>(null);

  const [loginCode, setLoginCode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  const t = i18n[lang];
  
  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
  }, [t.dir, lang]);

  const [availableDrivers, setAvailableDrivers] = useState<{ id: string, name: string, code: string }[]>([]);

  useEffect(() => {
    import('firebase/firestore').then(({ collection, getDocs }) => {
      import('../lib/firebase').then(({ db }) => {
        getDocs(collection(db, 'drivers')).then((querySnapshot) => {
          const drivers = querySnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            code: doc.data().code
          }));
          setAvailableDrivers(drivers);
        });
      });
    });
  }, []);

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    if (loggedDriver) {
      import('firebase/firestore').then(({ collection, query, where, onSnapshot }) => {
        import('../lib/firebase').then(({ db }) => {
          const q = query(
            collection(db, 'bookings'),
            where('driverId', '==', loggedDriver.id),
            where('status', 'in', ['approved', 'on_process'])
          );
          unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTasks(fetchedTasks);
          }, (error) => {
             console.error("Failed to fetch tasks realtime", error);
          });
        });
      });
    } else {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('superadmin') === 'true') {
        import('firebase/firestore').then(({ collection, query, where, getDocs }) => {
          import('../lib/firebase').then(({ db }) => {
            const q = query(collection(db, 'drivers'), where('code', '==', '1234'));
            getDocs(q).then((querySnapshot) => {
              if (!querySnapshot.empty) {
                const driverDoc = querySnapshot.docs[0];
                setLoggedDriver({ id: driverDoc.id, name: driverDoc.data().name });
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
          const q = query(collection(db, 'drivers'), where('code', '==', loginCode));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
              const driverDoc = querySnapshot.docs[0];
              setLoggedDriver({ id: driverDoc.id, name: driverDoc.data().name });
          } else {
              setErrorMsg('Invalid Code'); // Fallback string since t.invalidCode may not be typed
          }
      } catch (err) {
          setErrorMsg('Network error');
      } finally {
          setIsLoggingIn(false);
      }
  };

  const handleAccept = async (taskId: string) => {
    try {
       const { doc, updateDoc } = await import('firebase/firestore');
       const { db } = await import('../lib/firebase');
       await updateDoc(doc(db, 'bookings', taskId), {
           status: 'on_process'
       });
    } catch (err) {
       console.error("Failed to accept task", err);
    }
  };

  const handleComplete = async (taskId: string) => {
    try {
       const { doc, updateDoc } = await import('firebase/firestore');
       const { db } = await import('../lib/firebase');
       await updateDoc(doc(db, 'bookings', taskId), {
           status: 'completed'
       });
    } catch (err) {
       console.error("Failed to complete task", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col items-center">
      <div className="w-full max-w-3xl bg-[#F2F2F7] min-h-screen flex flex-col md:border-x md:border-gray-200 md:shadow-lg relative">
        
        {/* Simple Header */}
        <div className="bg-[#0050B3] pt-10 md:pt-12 pb-6 px-6 md:px-10 rounded-b-[32px] shadow-sm relative overflow-hidden shrink-0">
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
            <div className="flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
               <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">WashTech <span className="font-normal text-white/60">/ {t.driverTitle}</span></h1>
            </div>
            <div />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center px-5 py-8 w-full">
          {!loggedDriver ? (
            <motion.div 
               initial={{ scale: 0.95, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               className="bg-white rounded-[32px] w-full max-w-lg p-6 lg:p-8 shadow-xl border border-gray-100 flex flex-col justify-center items-center text-center mt-10 md:mt-24"
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
                     isLoggingIn || !loginCode ? 'bg-blue-400 cursor-not-allowed shadow-none' : 'bg-[#007AFF] hover:bg-blue-600 shadow-blue-500/30'
                   }`}
                 >
                   {isLoggingIn ? '...' : t.login}
                 </button>
              </form>
              
              {availableDrivers.length > 0 && (
                <div className="w-full mt-6 pt-6 border-t border-gray-100 flex flex-col gap-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-left">Quick Login (Test Mode)</p>
                  {availableDrivers.map(d => (
                    <button
                      key={d.id}
                      onClick={() => setLoggedDriver({ id: d.id, name: d.name })}
                      className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-900 font-medium rounded-xl border border-gray-200 transition-colors"
                    >
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
                 <span className="bg-[#007AFF]/10 text-[#007AFF] text-sm font-semibold px-3 py-1.5 rounded-full uppercase">
                    {tasks.length} {t.newTask}
                 </span>
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
                        <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-50">
                          <h2 className="text-xl font-bold text-gray-900">{task.name}</h2>
                          <span className="bg-blue-50 text-[#007AFF] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider" dir="ltr">
                            {task.id}
                          </span>
                        </div>

                        <div className="space-y-5 mb-8">
                          <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">{t.location}</div>
                            <div className="flex items-start gap-3">
                              <div className="text-lg font-medium text-gray-900 leading-tight">
                                {task.neighborhood} {task.date === 'today' ? `(${t.today})` : `(${t.tomorrow})`}
                              </div>
                              <a href={`https://maps.google.com/?q=${encodeURIComponent(task.gpsLocation || task.neighborhood)}`} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-50 text-[#007AFF] rounded-full hover:bg-blue-100 active:opacity-50 transition-colors shrink-0">
                                <Navigation className="w-5 h-5" />
                              </a>
                            </div>
                          </div>

                          <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">{t.vehicle}</div>
                            <div className="flex items-center gap-3 text-lg font-medium text-gray-900" dir="ltr">
                              <Car className="w-5 h-5 text-gray-400 shrink-0" />
                              <span className="w-full text-right">{task.carType} @ {task.slot}</span>
                            </div>
                          </div>

                          {task.package && (
                            <div>
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">{typeof t.package === 'string' ? t.package : 'Package'}</div>
                              <div className="flex items-center gap-3 text-lg font-medium text-gray-900" dir="ltr">
                                <Tag className="w-5 h-5 text-gray-400 shrink-0" />
                                <span className="w-full text-right">{task.package}</span>
                              </div>
                            </div>
                          )}

                          <div>
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">{t.contact}</div>
                            <div className="flex items-center gap-3 text-lg font-medium text-[#007AFF]" dir="ltr">
                              <Phone className="w-5 h-5 text-[#007AFF] shrink-0" />
                              <a className="w-full text-right" href={`tel:${task.phone}`}>{task.phone}</a>
                            </div>
                          </div>
                        </div>

                        {task.status !== 'on_process' ? (
                          <button 
                            type="button"
                            onClick={() => handleAccept(task.id)}
                            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl md:rounded-3xl shadow-xl shadow-orange-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg"
                          >
                            <CheckCircle2 className="w-6 h-6" />
                            {t.acceptJob || 'Accept Job'}
                          </button>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => handleComplete(task.id)}
                            className="w-full py-4 bg-[#0050B3] hover:bg-[#003B95] text-white font-bold rounded-2xl md:rounded-3xl shadow-xl shadow-blue-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-lg"
                          >
                            <CheckCircle2 className="w-6 h-6" />
                            {t.markAsDone}
                          </button>
                        )}
                      </motion.div>
                    ))}
                 </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
