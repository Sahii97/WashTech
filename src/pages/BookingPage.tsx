import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { i18n, Language } from '../translations';

export default function BookingPage() {
  const [lang, setLang] = useState<Language>('ar');
  const t = i18n[lang];
  const isRtl = t.dir === 'rtl';
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    neighborhood: '',
    carType: '',
    package: '',
    date: 'today' as 'today' | 'tomorrow',
    slot: '',
    gpsLocation: ''
  });

  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState<string>('pending');
  const [activeSheet, setActiveSheet] = useState<'neighborhood' | 'carType' | 'date' | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[] | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const isSuperAdmin = searchParams.get('superadmin') === 'true';

  useEffect(() => {
    const fetchSlots = () => {
      fetch('/api/slots')
        .then(r => r.json())
        .then(data => {
          if (data && Array.isArray(data.slots)) {
            setAvailableSlots(data.slots);
            // If currently selected slot is no longer available, clear it
            setFormData(prev => {
              if (prev.slot && !data.slots.includes(prev.slot)) {
                return { ...prev, slot: '' };
              }
              return prev;
            });
          }
        })
        .catch(console.error);
    };

    fetchSlots();
    const interval = setInterval(fetchSlots, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
  }, [lang, t.dir]);

  useEffect(() => {
    if (!bookingId) return;
    let unsubscribe = () => {};
    import('firebase/firestore').then(({ doc, onSnapshot }) => {
      import('../lib/firebase').then(({ db }) => {
        unsubscribe = onSnapshot(doc(db, 'bookings', bookingId), (snapshot) => {
          if (snapshot.exists()) {
             setBookingStatus(snapshot.data().status);
          }
        });
      });
    });
    return () => unsubscribe();
  }, [bookingId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleGetLocation = () => {
    setIsGettingLocation(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            gpsLocation: `${position.coords.latitude},${position.coords.longitude}`
          }));
          setIsGettingLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert('Failed to get location. Please allow location access or try again.');
          setIsGettingLocation(false);
        }
      );
    } else {
      alert('Geolocation is not supported by your browser');
      setIsGettingLocation(false);
    }
  };

  const isFormValid = formData.name && formData.phone && formData.neighborhood && formData.carType && formData.package && formData.slot && formData.date && formData.gpsLocation;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;
    setStatus('submitting');
    
    try {
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      const docRef = await addDoc(collection(db, 'bookings'), {
        ...formData,
        status: 'pending',
        language: lang,
        submittedAt: new Date().toISOString()
      });

      // --- n8n Webhook Integration ---
      try {
        const PROXY_URL = '/api/proxy-n8n'; 
        fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: docRef.id,
            ...formData,
            status: 'pending',
            action: 'new_booking'
          })
        }).catch(err => console.error('n8n proxy notification failed:', err));
      } catch (e) {
        console.error('n8n proxy webhook error:', e);
      }
      // -------------------------------
      
      setBookingId(docRef.id);
      setBookingStatus('pending');
      setStatus('success');
      setFormData({ name: '', phone: '', neighborhood: '', carType: '', package: '', date: 'today', slot: '', gpsLocation: '' });
      setErrorMessage('');
    } catch (error) {
      console.error('Submission error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const submitTestData = async () => {
    const testData = {
      name: 'Test Record',
      phone: '+9647809471576',
      neighborhood: t.neighborhoods[0],
      carType: Object.keys(t.carTypes)[0],
      package: Object.keys(t.packages)[0],
      date: 'today' as 'today' | 'tomorrow',
      slot: Object.keys(t.slots)[0],
      gpsLocation: '36.1901,44.0089'
    };
    
    setFormData(testData);
    setStatus('submitting');
    
    try {
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      const docRef = await addDoc(collection(db, 'bookings'), {
        ...testData,
        status: 'pending',
        language: lang,
        submittedAt: new Date().toISOString()
      });
      
      // --- n8n Webhook Integration (Test) ---
      try {
        const PROXY_URL = '/api/proxy-n8n'; 
        fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: docRef.id,
            ...testData,
            status: 'pending',
            action: 'test_booking'
          })
        }).catch(err => console.error('n8n proxy notification failed:', err));
      } catch (e) {
        console.error('n8n proxy webhook error:', e);
      }
      // -------------------------------

      setBookingId(docRef.id);
      setBookingStatus('pending');
      setStatus('success');
      setFormData({ name: '', phone: '', neighborhood: '', carType: '', package: '', date: 'today', slot: '', gpsLocation: '' });
      setErrorMessage('');
    } catch (error) {
      console.error('Submission error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const renderSheet = () => {
    if (!activeSheet) return null;

    let options: Record<string, string> = {};
    let title = '';
    let selectedValue = '';
    let onSelect = (val: string) => {};

    if (activeSheet === 'neighborhood') {
      options = Object.fromEntries(t.neighborhoods.map(n => [n, n]));
      title = t.neighborhoodPlaceholder;
      selectedValue = formData.neighborhood;
      onSelect = (val) => setFormData({...formData, neighborhood: val});
    } else if (activeSheet === 'carType') {
      options = t.carTypes;
      title = t.carTypePlaceholder;
      selectedValue = formData.carType;
      onSelect = (val) => setFormData({...formData, carType: val});
    } else if (activeSheet === 'date') {
      options = { today: t.today, tomorrow: t.tomorrow };
      title = t.selectDate;
      selectedValue = formData.date;
      onSelect = (val) => setFormData({...formData, date: val as 'today' | 'tomorrow'});
    }

    return (
      <AnimatePresence>
        <motion.div 
          key="backdrop"
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          className="fixed inset-0 lg:absolute bg-black/40 z-[100]" 
          onClick={() => setActiveSheet(null)}
        />
        <motion.div 
          key="sheet"
          initial={{ y: '100%' }} 
          animate={{ y: 0 }} 
          exit={{ y: '100%' }} 
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          className="fixed lg:absolute bottom-0 left-0 right-0 max-w-2xl mx-auto bg-[#F2F2F7] rounded-t-3xl z-[101] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-white/20 select-none pb-safe"
          style={{ maxHeight: '85vh' }}
        >
          <div className="flex items-center justify-between px-4 py-3.5 bg-[#F2F2F7] rounded-t-3xl shrink-0 border-b border-gray-200/70">
             <button type="button" onClick={() => setActiveSheet(null)} className="text-[#007AFF] text-[17px] active:opacity-50 w-16 text-start">
               {t.cancel}
             </button>
             <span className="font-semibold text-[17px] text-gray-900 truncate px-2">{title}</span>
             <button type="button" onClick={() => setActiveSheet(null)} className="text-[#007AFF] text-[17px] font-semibold active:opacity-50 w-16 text-end">
               {t.done}
             </button>
          </div>
          
          <div className="overflow-y-auto px-4 py-6 space-y-2">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                {Object.entries(options).map(([key, label], i, arr) => (
                    <div 
                        key={key} 
                        onClick={() => {
                            onSelect(key);
                            setTimeout(() => setActiveSheet(null), 100);
                        }}
                        className={`flex items-center justify-between px-4 py-3.5 transition-colors active:bg-gray-200 ${i !== arr.length - 1 ? 'border-b border-gray-100' : ''} cursor-pointer hover:bg-gray-50`}
                    >
                       <span className={`text-[17px] ${selectedValue === key ? 'text-[#007AFF]' : 'text-gray-900'}`}>{label}</span>
                       {selectedValue === key && <Check className="w-5 h-5 text-[#007AFF]" />}
                    </div>
                ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] w-full flex flex-col relative overflow-auto">
      
      {/* Luxury Dark Header */}
      <div className="w-full relative flex flex-col justify-center bg-[#0050B3] z-0 overflow-hidden shrink-0 pt-10 pb-20">
        <div className="absolute inset-0 bg-gradient-to-b from-[#003B95] to-[#0050B3] z-0 opacity-90" />
        
        {/* Top navigation row */}
        <div className="relative top-0 inset-x-0 flex items-center justify-between px-6 mb-8 z-10 w-full max-w-7xl mx-auto">
           {/* Language Buttons */}
           <div className="flex gap-2">
              <button 
                 type="button" 
                 onClick={() => setLang('ar')} 
                 className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-md ${lang === 'ar' ? 'bg-white text-[#0050B3]' : 'bg-[#003B95] text-white hover:bg-[#0050B3] border border-white/10'}`}
              >
                  عربي
              </button>
              <button 
                 type="button" 
                 onClick={() => setLang('ku')} 
                 className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-md ${lang === 'ku' ? 'bg-white text-[#0050B3]' : 'bg-[#003B95] text-white hover:bg-[#0050B3] border border-white/10'}`}
              >
                 کوردی
              </button>
           </div>
        </div>
        
        {/* Logo and Slogan */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 mt-2">
           <div className="flex flex-col items-center gap-3">
             <span className="text-white font-extrabold tracking-tight text-3xl md:text-5xl drop-shadow-md">WashTech</span>
           </div>
           <p className="text-[#E5E5EA] mt-4 text-base md:text-lg font-medium max-w-sm leading-relaxed drop-shadow-sm">{t.subtitle}</p>
        </div>
      </div>

      {/* Form Container */}
      <div className="w-full flex-1 flex flex-col z-10 relative -mt-12 lg:-mt-16 bg-[#F2F2F7] rounded-t-[32px] overflow-hidden">
        <div className="w-full max-w-2xl mx-auto px-5 lg:px-12 pb-12 pt-8 relative">
          
          {status === 'success' ? (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="flex flex-col items-center justify-center text-center mt-4 lg:mt-8 bg-white p-8 lg:p-12 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)]"
            >
              <CheckCircle2 className="w-16 h-16 lg:w-20 lg:h-20 text-[#007AFF] mb-4" />
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">{t.success}</h2>
              <p className="text-gray-500 lg:text-lg mb-8 max-w-sm mx-auto">{t.successSubtitle}</p>
              
              <div className="w-full flex flex-col gap-4 relative isolate text-start mb-8">
                {['pending', 'approved', 'on_process', 'completed'].map((step, idx) => {
                  const stepIndex = ['pending', 'approved', 'on_process', 'completed'].indexOf(bookingStatus);
                  const isCompleted = idx < stepIndex;
                  const isCurrent = idx === stepIndex;
                  const isPending = idx > stepIndex;
                  
                  let stepLabel = '';
                  if (step === 'pending') stepLabel = t.trackPending;
                  if (step === 'approved') stepLabel = t.trackApproved;
                  if (step === 'on_process') stepLabel = t.trackOnProcess;
                  if (step === 'completed') stepLabel = t.trackCompleted;

                  return (
                     <div key={step} className="flex gap-4 items-center relative">
                        {idx !== 3 && (
                           <div className={`absolute ${isRtl ? 'right-[15px]' : 'left-[15px]'} top-8 w-[2px] h-8 -z-10 ${isCompleted ? 'bg-[#007AFF]' : 'bg-gray-100'}`} />
                        )}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 shrink-0 bg-white ${isCompleted || isCurrent ? 'border-[#007AFF] text-[#007AFF]' : 'border-gray-200 text-gray-300'} ${isCompleted ? 'bg-[#007AFF] text-white' : ''}`}>
                          {isCompleted ? <Check className="w-4 h-4" /> : <div className={`w-2.5 h-2.5 rounded-full ${isCurrent ? 'bg-[#007AFF]' : 'bg-gray-200'}`} />}
                        </div>
                        <span className={`font-semibold text-[15px] ${isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                           {stepLabel}
                        </span>
                     </div>
                  );
                })}
              </div>

              <button 
                onClick={() => setStatus('idle')}
                className="w-full text-white bg-[#007AFF] font-bold text-[17px] hover:bg-blue-600 shadow-xl shadow-blue-500/20 transition-all rounded-2xl px-6 active:scale-[0.98] py-4"
              >
                {t.done}
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 pb-8 lg:mt-8">
              
              {status === 'error' && (
                <div className="px-4 py-3 bg-red-50 text-red-600 rounded-2xl flex items-start gap-3 border border-red-100">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="text-[15px] leading-snug">
                    {errorMessage || t.error}
                  </span>
                </div>
              )}

              {/* Personal Info Group */}
              <div>
                <div className="flex items-center justify-between pl-4 pr-1 mb-2">
                  <div className="text-[13px] text-gray-400 font-semibold tracking-wide uppercase">{t.name}</div>
                  <button
                    type="button"
                    onClick={submitTestData}
                    className="text-[11px] text-[#007AFF] bg-blue-50/50 px-2.5 py-1 rounded-full font-medium hover:bg-blue-100 transition-colors active:opacity-50 uppercase tracking-widest border border-blue-100"
                  >
                    Test Fill
                  </button>
                </div>
                <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 transition-shadow focus-within:shadow-md focus-within:border-blue-100">
                  <div className="flex items-center px-5 min-h-[56px] border-b border-gray-100">
                    <input
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder={t.namePlaceholder}
                      className="flex-1 w-full outline-none bg-transparent placeholder-gray-300 py-4 text-[17px] text-gray-900 focus:placeholder-gray-400 transition-colors"
                    />
                  </div>
                  <div className="flex items-center px-5 min-h-[56px]">
                    <input
                      name="phone"
                      type="tel"
                      required
                      dir="ltr"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder={t.phonePlaceholder}
                      className={`flex-1 w-full outline-none bg-transparent placeholder-gray-300 py-4 text-[17px] text-gray-900 focus:placeholder-gray-400 transition-colors ${isRtl ? 'text-right' : 'text-left'}`}
                    />
                  </div>
                </div>
              </div>

              {/* Selection Group */}
              <div>
                 <div className="pl-4 mb-2 text-[13px] text-gray-400 font-semibold tracking-wide uppercase">{t.selectOption}</div>
                 <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
                    <div 
                      onClick={() => setActiveSheet('neighborhood')} 
                      className="flex items-center justify-between px-5 min-h-[56px] hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 cursor-pointer"
                    >
                      <span className="text-gray-900 font-medium py-4 text-[17px]">{t.neighborhood}</span>
                      <div className="flex items-center gap-2 ml-4 py-4">
                        <span className={`truncate max-w-[150px] lg:max-w-[250px] text-[17px] ${formData.neighborhood ? 'text-[#007AFF]' : 'text-gray-400'}`}>
                          {formData.neighborhood ? formData.neighborhood : t.neighborhoodPlaceholder}
                        </span>
                        {isRtl ? <ChevronLeft className="w-5 h-5 text-gray-300 shrink-0" /> : <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />}
                      </div>
                    </div>
                    
                    <div 
                      onClick={() => setActiveSheet('carType')} 
                      className="flex items-center justify-between px-5 min-h-[56px] hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 cursor-pointer"
                    >
                      <span className="text-gray-900 font-medium py-4 text-[17px]">{t.carType}</span>
                      <div className="flex items-center gap-2 ml-4 py-4">
                        <span className={`truncate max-w-[150px] lg:max-w-[250px] text-[17px] ${formData.carType ? 'text-[#007AFF]' : 'text-gray-400'}`}>
                          {formData.carType ? t.carTypes[formData.carType as keyof typeof t.carTypes] : t.carTypePlaceholder}
                        </span>
                        {isRtl ? <ChevronLeft className="w-5 h-5 text-gray-300 shrink-0" /> : <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />}
                      </div>
                    </div>
                    <div 
                      onClick={() => setActiveSheet('date')} 
                      className="flex items-center justify-between px-5 min-h-[56px] hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 cursor-pointer"
                    >
                      <span className="text-gray-900 font-medium py-4 text-[17px]">{t.selectDate}</span>
                      <div className="flex items-center gap-2 ml-4 py-4">
                        <span className={`truncate max-w-[150px] lg:max-w-[250px] text-[17px] ${formData.date ? 'text-[#007AFF]' : 'text-gray-400'}`}>
                          {formData.date === 'today' ? t.today : t.tomorrow}
                        </span>
                        {isRtl ? <ChevronLeft className="w-5 h-5 text-gray-300 shrink-0" /> : <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />}
                      </div>
                    </div>
                 </div>
              </div>

              {/* Packages Group */}
              <div>
                <div className="pl-4 mb-3 text-[13px] text-gray-400 font-semibold tracking-wide uppercase">{t.package}</div>
                <div className="flex flex-nowrap overflow-x-auto pb-4 px-1 -mx-1 snap-x scroll-p-1 gap-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
                  {Object.entries(t.packages as Record<string, {name: string, price: string, desc: string}>).map(([key, pkg]) => (
                    <div
                      key={key}
                      onClick={() => setFormData({...formData, package: key})}
                      className={`shrink-0 w-72 p-5 rounded-3xl cursor-pointer transition-all snap-start border-2 ${
                        formData.package === key 
                          ? 'bg-[#007AFF] text-white border-[#007AFF] shadow-lg shadow-blue-500/30' 
                          : 'bg-white text-gray-900 border-gray-100 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg">{pkg.name}</h3>
                        {formData.package === key && <CheckCircle2 className="w-6 h-6 text-white" />}
                      </div>
                      <div className={`text-2xl font-bold mb-3 ${formData.package === key ? 'text-white' : 'text-[#007AFF]'}`}>
                        {pkg.price}
                      </div>
                      <p className={`text-[15px] leading-relaxed ${formData.package === key ? 'text-blue-50' : 'text-gray-500'}`}>
                        {pkg.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slots modern dropdown */}
              <div>
                 <div className="pl-4 mb-2 text-[13px] text-gray-400 font-semibold tracking-wide uppercase flex items-center justify-between pr-4">
                    <span>{t.slot}</span>
                    {availableSlots === null && <span className="text-[11px] animate-pulse text-[#007AFF]">Loading...</span>}
                 </div>
                 <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 focus-within:border-blue-100 focus-within:shadow-md transition-shadow relative">
                    <select
                      value={formData.slot}
                      onChange={(e) => setFormData({...formData, slot: e.target.value})}
                      className={`w-full appearance-none outline-none bg-transparent py-4 px-5 text-[17px] ${formData.slot ? 'text-gray-900' : 'text-gray-400'} cursor-pointer h-[56px]`}
                      dir={isRtl ? 'rtl' : 'ltr'}
                    >
                       <option value="" disabled hidden>{t.slotPlaceholder}</option>
                       {Object.entries(t.slots).map(([key, label]) => {
                          const isAvailable = availableSlots === null || availableSlots.includes(key);
                          return (
                             <option key={key} value={key} disabled={!isAvailable}>
                                {label} {!isAvailable ? '(Booked)' : ''}
                             </option>
                          );
                       })}
                    </select>
                    <div className={`absolute top-1/2 -translate-y-1/2 pointer-events-none ${isRtl ? 'left-5' : 'right-5'}`}>
                       <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                 </div>
              </div>
              <div>
                 <div className="pl-4 mb-2 text-[13px] text-gray-400 font-semibold tracking-wide uppercase">{t.exactLocation}</div>
                 <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 p-4">
                    <button
                        type="button"
                        onClick={handleGetLocation}
                        disabled={isGettingLocation || !!formData.gpsLocation}
                        className={`w-full py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all ${
                          formData.gpsLocation 
                            ? 'bg-green-50 text-green-600 border border-green-200 cursor-default' 
                            : isGettingLocation 
                              ? 'bg-gray-100 text-gray-500 cursor-wait' 
                              : 'bg-[#007AFF]/10 text-[#007AFF] hover:bg-[#007AFF]/20 active:scale-95'
                        }`}
                    >
                      {formData.gpsLocation ? (
                        <>
                          <CheckCircle2 className="w-5 h-5" />
                          {t.locationAcquired}
                        </>
                      ) : isGettingLocation ? (
                        <>
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {t.fetchingLocation}
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                          {t.getLocation}
                        </>
                      )}
                    </button>
                    {formData.gpsLocation && (
                       <div className="mt-3 text-xs text-center text-gray-500 font-mono" dir="ltr">
                          {formData.gpsLocation}
                       </div>
                    )}
                 </div>
              </div>



              {/* Submit Section */}
              <div className="pt-6">
                  <button
                    type="submit"
                    disabled={status === 'submitting' || !isFormValid}
                    className={`w-full py-4 rounded-2xl lg:rounded-3xl text-white font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg
                      ${status === 'submitting' || !isFormValid
                        ? 'bg-[#007AFF]/60 cursor-not-allowed shadow-none' 
                        : 'bg-[#007AFF] hover:bg-blue-600 shadow-blue-500/20 hover:shadow-blue-500/40'
                      }
                    `}
                  >
                    {status === 'submitting' ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </>
                    ) : (
                      t.submit
                    )}
                  </button>

                  {/* Dev Test Data Auto-fill & Submit */}
                  <button 
                    type="button" 
                    onClick={submitTestData}
                    className="w-full mt-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-2xl transition-colors opacity-60 hover:opacity-100"
                  >
                     Auto-fill & Submit (Debug)
                  </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Global Bottom Sheet Handler */}
      {renderSheet()}

    </div>
  );
}
