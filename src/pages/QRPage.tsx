import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { WashTechLogo } from '../components/WashTechLogo';

const BOOKING_URL = `${typeof window !== 'undefined' ? window.location.origin : ''}/booking`;

export default function QRPage() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Wash Tech QR Code</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'IBM Plex Sans Arabic', sans-serif; background: white; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .card { text-align: center; padding: 48px; }
          </style>
        </head>
        <body>
          <div class="card">${content.innerHTML}</div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  return (
    <div className="min-h-screen bg-[#0057FF] flex flex-col items-center justify-center p-6" dir="rtl">

      {/* Card */}
      <div ref={printRef} className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 flex flex-col items-center text-center max-w-sm w-full">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-4">
          <WashTechLogo className="w-12 h-12" white={false} />
          <span className="font-extrabold text-[#0057FF] text-3xl tracking-tight">Wash Tech</span>
        </div>

        {/* Tagline */}
        <p className="text-[#0A1628] font-bold text-lg mb-2">اغسل سيارتك بدون ما تتحرك</p>
        <p className="text-gray-400 text-sm mb-8">خدمة غسيل سيارات متنقلة في أربيل</p>

        {/* QR */}
        <div className="bg-white border-4 border-[#EFF6FF] rounded-2xl p-4 shadow-inner mb-8">
          <QRCodeSVG
            value={typeof window !== 'undefined' ? `${window.location.origin}/booking` : '/booking'}
            size={220}
            fgColor="#0057FF"
            bgColor="#ffffff"
            level="H"
            includeMargin={false}
          />
        </div>

        {/* Scan label */}
        <p className="text-gray-500 text-sm mb-2">امسح الكود لحجز موعد غسيل</p>
        <p className="text-[#0057FF] font-mono text-xs break-all opacity-60">
          {typeof window !== 'undefined' ? `${window.location.origin}/booking` : '/booking'}
        </p>

        {/* Decorative footer */}
        <div className="mt-6 flex items-center gap-2 text-gray-300 text-xs">
          <span>🚗</span>
          <span>نجيك ونغسلها</span>
          <span>💧</span>
        </div>
      </div>

      {/* Print button */}
      <button
        type="button"
        onClick={handlePrint}
        className="mt-8 bg-white text-[#0057FF] font-bold px-8 py-3.5 rounded-2xl shadow-xl hover:bg-blue-50 active:scale-95 transition-all flex items-center gap-2 text-base"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        طباعة
      </button>

      {/* Back links */}
      <div className="mt-6 flex gap-4">
        <a href="/booking" className="text-white/60 hover:text-white text-sm transition-colors">صفحة الحجز</a>
        <a href="/manager-board" className="text-white/60 hover:text-white text-sm transition-colors">لوحة المدير</a>
      </div>
    </div>
  );
}
