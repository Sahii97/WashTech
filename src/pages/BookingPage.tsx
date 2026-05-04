import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { i18n, Language, PACKAGES, PackageId, TIME_SLOTS } from '../translations';
import { WashTechLogo } from '../components/WashTechLogo';

interface FormData {
  name: string;
  phone: string;
  location: string;
  package: PackageId | '';
  date: string;
  time: string;
  notes: string;
}

const EMPTY_FORM: FormData = { name: '', phone: '', location: '', package: '', date: '', time: '', notes: '' };

export default function BookingPage() {
  const [lang, setLang] = useState<Language>('ar');
  const t = i18n[lang];
  const isRtl = t.dir === 'rtl';

  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [locationSheet, setLocationSheet] = useState(false);
  const [timeSheet, setTimeSheet] = useState(false);

  useEffect(() => {
    document.documentElement.dir = t.dir;
    document.documentElement.lang = lang;
  }, [lang, t.dir]);

  // Default date to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setForm(f => ({ ...f, date: today }));
  }, []);

  const isValid = !!(form.name && form.phone && form.location && form.package && form.date && form.time);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setStatus('submitting');
    setErrorMsg('');
    const pkg = PACKAGES[form.package as PackageId];
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          location: form.location,
          package: form.package,
          packageNameAr: pkg.nameAr,
          packagePrice: pkg.price,
          date: form.date,
          time: form.time,
          notes: form.notes,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Server error');
      setStatus('success');
      setForm(EMPTY_FORM);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : t.errorMsg);
    }
  };

  const selectedPkg = form.package ? PACKAGES[form.package as PackageId] : null;
  const selectedTime = form.time ? TIME_SLOTS.find(s => s.value === form.time) : null;
  const timeLabel = selectedTime ? (lang === 'ar' ? selectedTime.labelAr : selectedTime.labelKu) : null;

  return (
    <div className="min-h-screen bg-[#EFF6FF] w-full flex flex-col relative overflow-x-hidden" dir={t.dir}>

      {/* Water ripple hero ─────────────────────────────────────────────────── */}
      <div className="w-full relative flex flex-col items-center justify-center bg-[#0057FF] overflow-hidden pt-10 pb-24">
        {/* Animated water ripple rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="absolute rounded-full border border-white/10"
              style={{
                width: `${260 + i * 130}px`,
                height: `${260 + i * 130}px`,
                animation: `ripple 3s ease-out ${i * 1}s infinite`,
              }}
            />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#003B95]/60 to-[#0057FF]/80" />

        {/* Language switcher */}
        <div className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} flex gap-2 z-20`}>
          {(['ar', 'ku'] as Language[]).map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${lang === l ? 'bg-white text-[#0057FF]' : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'}`}
            >
              {l === 'ar' ? 'عربي' : 'کوردی'}
            </button>
          ))}
        </div>

        {/* Logo + tagline */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 gap-3">
          <div className="flex items-center gap-3">
            <WashTechLogo className="w-12 h-12" white />
            <span className="text-white font-extrabold text-3xl md:text-4xl tracking-tight drop-shadow-lg">Wash Tech</span>
          </div>
          <p className="text-white/90 text-lg md:text-xl font-semibold mt-1 drop-shadow">{t.heroTagline}</p>
          <p className="text-white/60 text-sm">{t.heroSub}</p>
        </div>
      </div>

      {/* Form card ─────────────────────────────────────────────────────────── */}
      <div className="w-full flex-1 relative -mt-12 rounded-t-[32px] bg-[#EFF6FF] z-10">
        <div className="max-w-2xl mx-auto px-4 md:px-8 pt-8 pb-24">

          <AnimatePresence mode="wait">
            {status === 'success' ? (
              <motion.div
                key="success"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center text-center mt-8 bg-white rounded-3xl p-10 shadow-sm border border-blue-100"
              >
                <CheckCircle2 className="w-20 h-20 text-[#0057FF] mb-4" />
                <h2 className="text-2xl font-bold text-[#0A1628] mb-2">{t.successTitle}</h2>
                <p className="text-gray-500 text-base">{t.successSub}</p>
                <button
                  onClick={() => { setStatus('idle'); setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] }); }}
                  className="mt-8 bg-[#0057FF] text-white font-bold px-8 py-3 rounded-2xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors active:scale-95"
                >
                  {t.successBtn}
                </button>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                {status === 'error' && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-red-50 text-red-600 rounded-2xl border border-red-100">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span className="text-sm">{errorMsg || t.errorMsg}</span>
                  </div>
                )}

                {/* Name + Phone ─────────────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{t.nameLabel}</label>
                  <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 focus-within:border-[#0057FF]/30 focus-within:shadow-md transition-all">
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder={t.namePlaceholder}
                      className="w-full outline-none bg-transparent px-5 py-4 text-[17px] text-[#0A1628] placeholder-gray-300 border-b border-gray-100"
                    />
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder={t.phonePlaceholder}
                      className={`w-full outline-none bg-transparent px-5 py-4 text-[17px] text-[#0A1628] placeholder-gray-300 ${isRtl ? 'text-right' : 'text-left'}`}
                    />
                  </div>
                </div>

                {/* Location ─────────────────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{t.locationLabel}</label>
                  <button
                    type="button"
                    onClick={() => setLocationSheet(true)}
                    className="w-full bg-white rounded-3xl border border-gray-100 shadow-sm px-5 py-4 flex items-center justify-between text-[17px] hover:bg-gray-50 active:bg-gray-100 transition-colors"
                  >
                    <span className={form.location ? 'text-[#0A1628] font-medium' : 'text-gray-300'}>{form.location || t.locationPlaceholder}</span>
                    {isRtl ? <ChevronLeft className="w-5 h-5 text-gray-300" /> : <ChevronRight className="w-5 h-5 text-gray-300" />}
                  </button>
                </div>

                {/* Package Cards ─────────────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">{t.packageLabel}</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(Object.keys(PACKAGES) as PackageId[]).map(pkgId => {
                      const pkg = PACKAGES[pkgId];
                      const selected = form.package === pkgId;
                      const name = lang === 'ar'
                        ? pkg.nameAr
                        : (pkgId === 'basic' ? t.pkgBasicName : pkgId === 'premium' ? t.pkgPremiumName : t.pkgFullName);
                      return (
                        <button
                          key={pkgId}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, package: pkgId }))}
                          className={`relative flex flex-col items-center rounded-2xl p-3 md:p-4 border-2 transition-all active:scale-95 ${
                            selected
                              ? 'bg-[#0057FF] border-[#0057FF] shadow-lg shadow-blue-500/30'
                              : 'bg-white border-gray-100 hover:border-[#0057FF]/40 shadow-sm'
                          }`}
                        >
                          {selected && (
                            <span className="absolute top-2 right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-[#0057FF]" />
                            </span>
                          )}
                          <span className="text-2xl mb-1">{pkgId === 'basic' ? '🚿' : pkgId === 'premium' ? '✨' : '💎'}</span>
                          <span className={`text-center font-bold text-xs leading-tight mb-1 ${selected ? 'text-white' : 'text-[#0A1628]'}`}>{name}</span>
                          <span className={`text-[10px] font-semibold ${selected ? 'text-white/80' : 'text-[#0057FF]'}`}>{pkg.price.toLocaleString()} IQD</span>
                          <span className={`text-[10px] mt-0.5 ${selected ? 'text-white/60' : 'text-gray-400'}`}>{pkg.nameEn}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date + Time ─────────────────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{t.dateLabel}</label>
                  <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 focus-within:border-[#0057FF]/30 focus-within:shadow-md transition-all">
                    <input
                      type="date"
                      required
                      value={form.date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      className="w-full outline-none bg-transparent px-5 py-4 text-[17px] text-[#0A1628] border-b border-gray-100"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setTimeSheet(true)}
                      className="w-full px-5 py-4 flex items-center justify-between text-[17px] hover:bg-gray-50 transition-colors"
                    >
                      <span className={timeLabel ? 'text-[#0A1628] font-medium' : 'text-gray-300'}>{timeLabel || t.timePlaceholder}</span>
                      {isRtl ? <ChevronLeft className="w-5 h-5 text-gray-300" /> : <ChevronRight className="w-5 h-5 text-gray-300" />}
                    </button>
                  </div>
                </div>

                {/* Notes ───────────────────────────────────────────────────── */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{t.notesLabel}</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder={t.notesPlaceholder}
                    rows={3}
                    className="w-full bg-white rounded-3xl border border-gray-100 shadow-sm px-5 py-4 text-[17px] text-[#0A1628] placeholder-gray-300 outline-none resize-none focus:border-[#0057FF]/30 focus:shadow-md transition-all"
                  />
                </div>

                {/* Submit ─────────────────────────────────────────────────── */}
                <button
                  type="submit"
                  disabled={!isValid || status === 'submitting'}
                  className={`w-full py-4 rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-[0.98] ${
                    isValid && status !== 'submitting'
                      ? 'bg-[#0057FF] shadow-xl shadow-blue-500/30 hover:bg-blue-700'
                      : 'bg-[#0057FF]/40 cursor-not-allowed shadow-none'
                  }`}
                >
                  {status === 'submitting' ? (
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                        <path d="M13 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.857L0 24l6.302-1.502A11.966 11.966 0 0013 24c6.627 0 12-5.373 12-12S19.627 0 13 0zm0 21.818a9.814 9.814 0 01-5.012-1.374l-.36-.214-3.736.98.998-3.647-.235-.373A9.816 9.816 0 013.182 12C3.182 6.614 7.614 2.182 13 2.182S22.818 6.614 22.818 12 18.386 21.818 13 21.818z"/>
                      </svg>
                      {t.submitBtn}
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Location bottom sheet ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {locationSheet && (
          <>
            <motion.div
              key="loc-bg"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[100]"
              onClick={() => setLocationSheet(false)}
            />
            <motion.div
              key="loc-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-[#F2F2F7] rounded-t-3xl z-[101] max-h-[80vh] flex flex-col"
              dir={t.dir}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/70 shrink-0">
                <button type="button" onClick={() => setLocationSheet(false)} className="text-[#0057FF] text-[17px]">{t.cancel}</button>
                <span className="font-semibold text-[17px] text-gray-900">{t.locationLabel}</span>
                <button type="button" onClick={() => setLocationSheet(false)} className="text-[#0057FF] text-[17px] font-semibold">{t.done}</button>
              </div>
              <div className="overflow-y-auto p-4">
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                  {t.neighborhoods.map((n, i, arr) => (
                    <div
                      key={n}
                      onClick={() => { setForm(f => ({ ...f, location: n })); setLocationSheet(false); }}
                      className={`flex items-center justify-between px-5 py-4 cursor-pointer active:bg-gray-100 hover:bg-gray-50 transition-colors ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                    >
                      <span className={`text-[17px] ${form.location === n ? 'text-[#0057FF] font-medium' : 'text-[#0A1628]'}`}>{n}</span>
                      {form.location === n && <Check className="w-5 h-5 text-[#0057FF]" />}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Time bottom sheet ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {timeSheet && (
          <>
            <motion.div
              key="time-bg"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[100]"
              onClick={() => setTimeSheet(false)}
            />
            <motion.div
              key="time-sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-[#F2F2F7] rounded-t-3xl z-[101] max-h-[80vh] flex flex-col"
              dir={t.dir}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/70 shrink-0">
                <button type="button" onClick={() => setTimeSheet(false)} className="text-[#0057FF] text-[17px]">{t.cancel}</button>
                <span className="font-semibold text-[17px] text-gray-900">{t.timeLabel}</span>
                <button type="button" onClick={() => setTimeSheet(false)} className="text-[#0057FF] text-[17px] font-semibold">{t.done}</button>
              </div>
              <div className="overflow-y-auto p-4">
                <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                  {TIME_SLOTS.map((slot, i) => {
                    const label = lang === 'ar' ? slot.labelAr : slot.labelKu;
                    return (
                      <div
                        key={slot.value}
                        onClick={() => { setForm(f => ({ ...f, time: slot.value })); setTimeSheet(false); }}
                        className={`flex items-center justify-between px-5 py-4 cursor-pointer active:bg-gray-100 hover:bg-gray-50 transition-colors ${i < TIME_SLOTS.length - 1 ? 'border-b border-gray-100' : ''}`}
                      >
                        <span className={`text-[17px] ${form.time === slot.value ? 'text-[#0057FF] font-medium' : 'text-[#0A1628]'}`}>{label}</span>
                        {form.time === slot.value && <Check className="w-5 h-5 text-[#0057FF]" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
