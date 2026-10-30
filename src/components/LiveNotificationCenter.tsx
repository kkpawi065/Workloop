import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Sparkles, 
  X, 
  Check, 
  Trash2, 
  Smartphone, 
  ArrowUpToLine, 
  Monitor, 
  Plus, 
  Zap, 
  Info, 
  Award, 
  AlertTriangle, 
  RefreshCw, 
  Layers, 
  CheckCircle,
  Copy,
  LayoutGrid
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SpreadsheetData } from '../services/sheetsService';

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'info' | 'schedule' | 'success' | 'alert';
  read: boolean;
}

interface LiveNotificationCenterProps {
  theme: 'light' | 'dark';
  lang: 'en' | 'th';
  teacherData?: SpreadsheetData | null;
  studentData?: SpreadsheetData | null;
  news?: any[];
  triggerGlobalToast?: (msg: string, type: 'info' | 'schedule' | 'success' | 'alert') => void;
}

export default function LiveNotificationCenter({ theme, lang, teacherData, studentData, news }: LiveNotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showPwaModal, setShowPwaModal] = useState(false);
  const [pwaPlatform, setPwaPlatform] = useState<'ios' | 'android' | 'desktop'>('ios');
  const [pwaInstalledSimulated, setPwaInstalledSimulated] = useState(false);

  // Live Firebase schedule_swaps state
  const [liveSwaps, setLiveSwaps] = useState<any[]>([]);

  useEffect(() => {
    try {
      const q = query(collection(db, 'schedule_swaps'), orderBy('createdAt', 'desc'), limit(15));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const swaps = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setLiveSwaps(swaps);
      }, (err) => {
        console.error("Error subscribing to schedule_swaps for notifications:", err);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error(e);
    }
  }, []);

  // List of read notification IDs in localStorage
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('workloop_read_notification_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveReadIds = (newIds: string[]) => {
    setReadIds(newIds);
    try {
      localStorage.setItem('workloop_read_notification_ids', JSON.stringify(newIds));
    } catch (err) {
      console.error('Error saving read notification ids:', err);
    }
  };

  // List of hidden (cleared) notification IDs in localStorage
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('workloop_hidden_notification_ids');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveHiddenIds = (newIds: string[]) => {
    setHiddenIds(newIds);
    try {
      localStorage.setItem('workloop_hidden_notification_ids', JSON.stringify(newIds));
    } catch (err) {
      console.error('Error saving hidden notification ids:', err);
    }
  };

  const getRelativeTimeStr = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    if (diffSec < 0) return lang === 'th' ? 'เมื่อครู่' : 'Just now';
    if (diffSec < 60) {
      return lang === 'th' ? `${diffSec} วินาทีที่แล้ว` : `${diffSec}s ago`;
    }
    if (diffMin < 60) {
      return lang === 'th' ? `${diffMin} นาทีที่แล้ว` : `${diffMin}m ago`;
    }
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) {
      return lang === 'th' ? `${diffHr} ชม.ที่แล้ว` : `${diffHr}h ago`;
    }
    const date = new Date(timestamp);
    return date.toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric' });
  };

  const translateDay = (day: string) => {
    if (!day) return '';
    const dLower = day.toLowerCase();
    if (dLower === 'monday' || dLower === 'mon' || day === 'จันทร์') return lang === 'th' ? 'จันทร์' : 'Monday';
    if (dLower === 'tuesday' || dLower === 'tue' || day === 'อังคาร') return lang === 'th' ? 'อังคาร' : 'Tuesday';
    if (dLower === 'wednesday' || dLower === 'wed' || day === 'พุธ') return lang === 'th' ? 'พุธ' : 'Wednesday';
    if (dLower === 'thursday' || dLower === 'thu' || day === 'พฤหัสบดี') return lang === 'th' ? 'พฤหัสบดี' : 'Thursday';
    if (dLower === 'friday' || dLower === 'fri' || day === 'ศุกร์') return lang === 'th' ? 'ศุกร์' : 'Friday';
    return day;
  };

  // Compile real notifications in real-time focusing only on evaluation updates
  const realNotifications = useMemo(() => {
    const list: Notification[] = [];

    // 1. Convert teacher performance/evaluation records from Google Sheet evaluations (teacherData)
    if (teacherData && teacherData.values && teacherData.values.length > 1) {
      const headers = teacherData.values[0] || [];
      const rows = teacherData.values.slice(1) || [];

      const teacherIdx = headers.findIndex(h => /ครูต่างชาติ|teacher|ต่างชาติ/i.test(h));
      const classIdx = headers.findIndex(h => /ชั้นเรียน|classroom|ห้องเรียน|class/i.test(h)) !== -1
        ? headers.findIndex(h => /ชั้นเรียน|classroom|ห้องเรียน|class/i.test(h))
        : 4; // Default to Column E (index 4) for teacher evaluations
      const dateIdx = headers.findIndex(h => /timestamp|date|วันที่/i.test(h));
      const evaluatorIdx = headers.findIndex(h => /ผู้ประเมิน|นักเรียน|evaluator|student|recorder/i.test(h));

      rows.forEach((row, idx) => {
        const teacherName = teacherIdx !== -1 ? String(row[teacherIdx] || '').trim() : '';
        if (!teacherName) return; // skip empty rows

        const className = classIdx !== -1 ? String(row[classIdx] || '').trim() : 'N/A';
        const dateVal = dateIdx !== -1 ? String(row[dateIdx] || '').trim() : '';
        const evaluatorName = evaluatorIdx !== -1 ? String(row[evaluatorIdx] || '').trim() : '';

        // Find rating evaluation
        let ratingWord = '';
        let isFair = false;
        let isExcellent = false;

        row.forEach(cell => {
          const val = String(cell).trim();
          if (val === 'ดีมาก') {
            isExcellent = true;
            ratingWord = lang === 'th' ? 'ดีมาก' : 'Excellent';
          } else if (val === 'พอใช้') {
            isFair = true;
            ratingWord = lang === 'th' ? 'พอใช้' : 'Fair';
          } else if (val === 'ดี') {
            ratingWord = lang === 'th' ? 'ดี' : 'Good';
          }
        });

        const uniqueEvalId = `eval-t-${idx}-${teacherName}-${className}-${dateVal}`;

        list.push({
          id: uniqueEvalId,
          title: isFair 
            ? (lang === 'th' ? '⚠️ แจ้งเตือนข้อเสนอแนะนำพึงปรับปรุง' : '⚠️ Action Required: Fair Observation')
            : (isExcellent 
               ? (lang === 'th' ? '🏆 ชื่นชม: ผลการประเมินดีเด่น' : '🏆 Outstanding Performance')
               : (lang === 'th' ? '📊 ผลประเมินการฝึกสอนใหม่' : '📊 New Teaching Observation')),
          description: lang === 'th'
            ? `ผลประเมินครู ${teacherName} ห้อง ${className} เกณฑ์คุณภาพ: [${ratingWord || 'บันทึกสำเร็จ'}] โดยผู้ทำรายงาน ${evaluatorName || '-'}`
            : `Observation for Teacher ${teacherName} in ${className} graded: [${ratingWord || 'Recorded'}] by ${evaluatorName || '-'}`,
          time: dateVal || (lang === 'th' ? 'ล่าสุด' : 'Recent'),
          type: isFair ? 'alert' : (isExcellent ? 'success' : 'info'),
          read: readIds.includes(uniqueEvalId)
        });
      });
    }

    // 2. Convert student evaluations/feeling records (studentData)
    if (studentData && studentData.values && studentData.values.length > 1) {
      const headers = studentData.values[0] || [];
      const rows = studentData.values.slice(1) || [];

      const teacherIdx = headers.findIndex(h => /ครูต่างชาติ|teacher|ต่างชาติ/i.test(h));
      const classIdx = headers.findIndex(h => /ชั้นเรียน|classroom|ห้องเรียน|class/i.test(h)) !== -1
        ? headers.findIndex(h => /ชั้นเรียน|classroom|ห้องเรียน|class/i.test(h))
        : 2; // Default to Column C (index 2)
      const dateIdx = headers.findIndex(h => /timestamp|date|วันที่/i.test(h));
      const studentIdx = headers.findIndex(h => /ผู้ประเมิน|นักเรียน|evaluator|student|recorder/i.test(h));

      rows.forEach((row, idx) => {
        const teacherName = teacherIdx !== -1 ? String(row[teacherIdx] || '').trim() : '';
        if (!teacherName) return; // skip empty rows

        const className = classIdx !== -1 ? String(row[classIdx] || '').trim() : 'N/A';
        const dateVal = dateIdx !== -1 ? String(row[dateIdx] || '').trim() : '';
        const studentName = studentIdx !== -1 ? String(row[studentIdx] || '').trim() : '';

        // Find rating evaluation
        let ratingWord = '';
        let isFair = false;
        let isExcellent = false;

        row.forEach(cell => {
          const val = String(cell).trim();
          if (val === 'ดีมาก') {
            isExcellent = true;
            ratingWord = lang === 'th' ? 'ดีมาก' : 'Excellent';
          } else if (val === 'พอใช้') {
            isFair = true;
            ratingWord = lang === 'th' ? 'พอใช้' : 'Fair';
          } else if (val === 'ดี') {
            ratingWord = lang === 'th' ? 'ดี' : 'Good';
          }
        });

        const uniqueEvalId = `eval-s-${idx}-${teacherName}-${className}-${dateVal}`;

        list.push({
          id: uniqueEvalId,
          title: isFair
            ? (lang === 'th' ? '⚠️ ข้อรีวิวฟีดแบ็กส่งเสริมการพัฒนา' : '⚠️ Student Review: Improvement Area')
            : (isExcellent
               ? (lang === 'th' ? '🏆 นักเรียนชื่นชอบมติสูง' : '🏆 High Class Satisfaction')
               : (lang === 'th' ? '📝 บันทึกฟีดแบ็กผู้เรียนใหม่' : '📝 New Student Feedback')),
          description: lang === 'th'
            ? `ครูต่างชาติ ${teacherName} คลาส ${className} ได้รับฟีดแบ็ก [${ratingWord || 'รับทราบแล้ว'}] จากนักเรียนผู้ทำประเมิน`
            : `Student review for Teacher ${teacherName} in ${className} returned: [${ratingWord || 'Done'}]`,
          time: dateVal || (lang === 'th' ? 'ล่าสุด' : 'Recent'),
          type: isFair ? 'alert' : (isExcellent ? 'success' : 'info'),
          read: readIds.includes(uniqueEvalId)
        });
      });
    }

    // Return the combined list of evaluations, reversed so that newly appended rows of sheets appear first on top
    const combined = list.reverse();

    // If still empty, supply clean informative fallback notices to explain things beautifully
    if (combined.length === 0) {
      combined.push({
        id: 'fallback-system-1',
        title: lang === 'th' ? '✨ ศูนย์แจ้งเตือนประเมินพร้อมทำงาน' : '✨ Evaluation Alerts Active',
        description: lang === 'th' ? 'ยินดีต้อนรับสู่ระบบ WorkLoop ข้อมูลฟีดคะแนนประเมินครูผู้สอนและการประเมินชั้นเรียนจะลิ้งก์สดอัตโนมัติจากการอัปเดต Google Sheets' : 'Welcome to WorkLoop. Real-time notifications of classes and observation evaluations will display here dynamically.',
        time: lang === 'th' ? 'เมื่อครู่' : 'Just now',
        type: 'info',
        read: false
      });
    }

    return combined;
  }, [teacherData, studentData, readIds, lang]);

  // Filter hidden list
  const visibleNotifications = useMemo(() => {
    return realNotifications.filter(n => !hiddenIds.includes(n.id));
  }, [realNotifications, hiddenIds]);

  // Toast State for locally triggered events
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'info' | 'schedule' | 'success' | 'alert' }[]>([]);

  const addLocalToast = (msg: string, type: 'info' | 'schedule' | 'success' | 'alert') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const totalUnread = visibleNotifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    const allIds = visibleNotifications.map(n => n.id);
    const uniqueIds = Array.from(new Set([...readIds, ...allIds]));
    saveReadIds(uniqueIds);
    addLocalToast(
      lang === 'th' ? 'ทำเครื่องหมายอ่านทั้งหมดเสร็จสิ้น' : 'Marked all notifications as read',
      'success'
    );
  };

  const clearAllNotifications = () => {
    const allIds = realNotifications.map(n => n.id);
    const updatedHidden = Array.from(new Set([...hiddenIds, ...allIds]));
    saveHiddenIds(updatedHidden);
    addLocalToast(
      lang === 'th' ? 'ล้างการแจ้งเตือนทั้งหมดแล้ว' : 'All notifications cleared',
      'info'
    );
  };

  // Simulated push event triggers - support real dynamic injection to db or local list
  const triggerSimulatedScheduleChange = () => {
    addLocalToast(
      lang === 'th' ? 'จำลองข่าวตารางสอนเสร็จสมบูรณ์ ให้สลับตารางหรือโพสต์ข่าวจริงเพื่อเห็นฟีดอัปเดต' : 'Please complete a real schedule swap or post real news to see live notifications update!',
      'info'
    );
  };

  const triggerSimulatedReportSuccess = () => {
    addLocalToast(
      lang === 'th' ? 'จำลองผลประเมินคลาสเสร็จสมบูรณ์ ระบบจะรายงานข้อมูลจริงหากมีคะแนนประเมิน "ดีมาก" หรือ "พอใช้"' : 'Real metrics logged from Google Sheets are prioritized automatically!',
      'success'
    );
  };

  const simulatePwaInstalled = () => {
    setPwaInstalledSimulated(true);
    addLocalToast(
      lang === 'th' ? 'เพิ่มไอคอนลงบนหน้าจอหลัก (Standalone Mode) แล้ว!' : 'PWA Standalone initialized on Home Screen successfully!',
      'success'
    );
    setTimeout(() => {
      setShowPwaModal(false);
    }, 1500);
  };

  return (
    <div className="relative flex items-center gap-2.5">
      
      {/* Toast Wrapper Portal (Slides down elegantly from top header center) */}
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99]" style={{ pointerEvents: 'none' }}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -45, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -25, scale: 0.95 }}
              transition={{ type: 'spring', damping: 18, stiffness: 220 }}
              className="mb-3 p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 w-[340px] sm:w-[410px] pointer-events-auto cursor-pointer"
              style={{
                background: theme === 'dark' ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.94)',
                borderborderColor: toast.type === 'alert' ? 'rgba(239, 68, 68, 0.3)' : 
                                 toast.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(168, 85, 247, 0.3)',
                boxShadow: theme === 'dark' ? '0 12px 36px rgba(0,0,0,0.4), 0 0 10px rgba(168, 85, 247, 0.15)' : '0 12px 30px rgba(168, 85, 247, 0.1)'
              }}
              onClick={() => removeToast(toast.id)}
            >
              <div className={`p-2 rounded-xl shrink-0 ${
                toast.type === 'alert' ? 'bg-red-500/10 text-red-500' :
                toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 
                toast.type === 'schedule' ? 'bg-pink-500/10 text-pink-500' : 'bg-purple-500/10 text-purple-500'
              }`}>
                {toast.type === 'alert' ? <AlertTriangle className="w-5 h-5 animate-pulse" /> : 
                 toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : 
                 toast.type === 'schedule' ? <RefreshCw className="w-5 h-5" /> : <Info className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className={`text-xs font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{toast.msg}</p>
                <p className={`text-[10px] mt-0.5 leading-tight ${theme === 'dark' ? 'text-slate-550' : 'text-slate-450'}`}>
                  {lang === 'th' ? 'แตะสไลด์เพื่อปิดบันทึกนี้เด็ดขาด' : 'Click to dismiss this notification.'}
                </p>
              </div>
              <button 
                className={`p-1 rounded-lg hover:bg-slate-200/25 ${theme === 'dark' ? 'text-slate-500 hover:text-slate-350' : 'text-slate-400 hover:text-slate-655'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeToast(toast.id);
                }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 🔔 Notification Bell System */}
      <div className="relative">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`rounded-full border transition-all duration-300 relative flex items-center justify-center hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xl shadow-xs w-7 h-7 sm:w-[30px] sm:h-[30px] lg:w-[34px] lg:h-[34px] ${
            isOpen 
              ? 'bg-purple-500/15 border-purple-400/30 text-purple-700 dark:text-purple-300 dark:bg-purple-500/20 dark:border-purple-400/30 ring-1 ring-purple-400/20' 
              : 'bg-white/10 hover:bg-white/20 border-white/20 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10'
          }`}
          title={lang === 'th' ? 'ศูนย์แจ้งเตือนสด' : 'Live Notification Center'}
        >
          <Bell className={`w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-[18px] lg:h-[18px] transition-colors ${totalUnread > 0 ? "text-pink-500 animate-wiggle" : "text-purple-600/70 dark:text-purple-300/60"}`} />
          {totalUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.6)]"></span>
            </span>
          )}
        </button>

        {/* Dropdown overlay panel */}
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backing dismiss overlay */}
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

              <motion.div 
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`absolute right-0 mt-3 w-[310px] sm:w-[380px] rounded-[1.8rem] border shadow-2xl z-50 overflow-hidden text-left backdrop-blur-none ${
                  theme === 'dark' 
                    ? 'bg-slate-950 border-slate-800 shadow-black/80' 
                    : 'bg-white border-purple-200 shadow-purple-900/10'
                }`}
                style={{
                  backgroundColor: theme === 'dark' ? '#0d1321' : '#ffffff',
                }}
              >
                {/* Header */}
                <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${theme === 'dark' ? 'border-slate-850 bg-slate-900/50' : 'border-purple-50 bg-purple-50/20'}`}>
                  <div>
                    <h3 className={`font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-purple-950'}`}>
                      <Sparkles className="w-4 h-4 text-pink-500 animate-spin" style={{ animationDuration: '6s' }} />
                      {lang === 'th' ? 'ศูนย์การแจ้งเตือนและการ์ดด่วน' : 'Live Center Updates'}
                    </h3>
                    <p className={`text-[9.5px] font-bold ${theme === 'dark' ? 'text-slate-550' : 'color-purple-400 text-purple-450'}`}>
                      {lang === 'th' ? `ข้อมูลเรียลไทม์ (${totalUnread} แดชบอร์ดสำคัญ)` : `${totalUnread} urgent feeds waiting`}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    {visibleNotifications.length > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className={`p-1.5 rounded-lg border text-[10px] sm:text-xs font-black transition-all uppercase flex items-center justify-center cursor-pointer ${
                          theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white' : 'bg-slate-100 border-purple-50 text-purple-800 hover:bg-purple-100'
                        }`}
                        title={lang === 'th' ? 'ทำเครื่องหมายอ่านทั้งหมด' : 'Mark all read'}
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      </button>
                    )}
                    <button 
                      onClick={clearAllNotifications}
                      className={`p-1.5 rounded-lg border text-[10px] sm:text-xs font-black transition-all uppercase flex items-center justify-center cursor-pointer ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-red-400' : 'bg-slate-100 border-purple-50 text-red-655 hover:bg-red-50'
                      }`}
                      title={lang === 'th' ? 'ล้างทั้งหมด' : 'Clear all'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Simulated notifications body list */}
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-3 space-y-2.5">
                  {visibleNotifications.length === 0 ? (
                    <div className="py-12 px-6 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                      <Bell className="w-8 h-8 text-pink-300 dark:text-slate-800 opacity-60" />
                      <p className="text-xs font-black uppercase tracking-wider">{lang === 'th' ? 'ไม่มีการแจ้งเตือนใหม่' : 'All caught up!'}</p>
                      <p className="text-[10px] leading-tight opacity-75">{lang === 'th' ? 'ระบบเตรียมความพร้อมสมบูรณ์แบบ!' : 'Feed is clean and synchronized.'}</p>
                    </div>
                  ) : (
                    visibleNotifications.map((n) => (
                      <div 
                        key={n.id}
                        onClick={() => {
                          const updated = Array.from(new Set([...readIds, n.id]));
                          saveReadIds(updated);
                          addLocalToast(n.title, n.type);
                        }}
                        className={`p-3 rounded-2xl border text-[11px] font-bold text-left cursor-pointer transition-all flex gap-3 relative overflow-hidden group ${
                          n.read 
                            ? (theme === 'dark' ? 'bg-slate-900/40 border-slate-850 text-slate-400' : 'bg-slate-50/50 border-purple-50/30 text-slate-500')
                            : (theme === 'dark' ? 'bg-slate-900 border-indigo-500/20 text-white' : 'bg-purple-50/40 border-purple-100/50 text-purple-950')
                        }`}
                      >
                        {/* Static indicator bar */}
                        {!n.read && (
                          <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-pink-500 to-purple-600 animate-pulse" />
                        )}

                        <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                          n.type === 'alert' ? 'bg-red-505 bg-red-400/10 text-red-500' :
                          n.type === 'schedule' ? 'bg-pink-400/10 text-pink-400' :
                          n.type === 'success' ? 'bg-emerald-400/10 text-emerald-500' : 'bg-purple-400/10 text-purple-500'
                        }`}>
                          {n.type === 'alert' ? <AlertTriangle className="w-4 h-4" /> : 
                           n.type === 'schedule' ? <RefreshCw className="w-4 h-4" /> : 
                           n.type === 'success' ? <Award className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                        </div>

                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex justify-between items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold truncate uppercase text-[10px] tracking-wide">{n.title}</span>
                            <span className="text-[8.5px] opacity-60 font-medium whitespace-nowrap shrink-0">{n.time}</span>
                          </div>
                          <p className="text-xs leading-relaxed opacity-85 mt-0.5 font-medium">{n.description}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className={`p-3 border-t text-[10px] text-center font-bold font-sans ${theme === 'dark' ? 'border-slate-850 bg-slate-900/50 text-slate-500' : 'border-purple-50 bg-slate-50/30 text-purple-400'}`}>
                  {lang === 'th' ? 'อัปเดตแบบเรียลไทม์จากระบบสเปรดชีต Google Sheets' : 'Real-time sync integrated using Google Sheets'}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* 📱 PWA Setup Options Modal */}
      <AnimatePresence>
        {showPwaModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            
            {/* Dark glass backdrop layout wrapper */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
              onClick={() => setShowPwaModal(false)}
            />

            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className={`relative z-10 w-full max-w-xl rounded-[2.5rem] border shadow-2xl p-6 sm:p-8 flex flex-col text-left overflow-hidden ${
                theme === 'dark' 
                  ? 'bg-slate-900 border-slate-800 text-white' 
                  : 'bg-white border-purple-100 text-purple-950 shadow-purple-500/20'
              }`}
            >
              {/* Corner decor glows */}
              <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-pink-500/10 blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -right-12 w-44 h-44 rounded-full bg-purple-500/10 blur-2xl pointer-events-none" />

              <div className="flex justify-between items-center mb-6 z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl text-white shadow-lg shadow-pink-500/20">
                    <Smartphone className="w-6 h-6 shrink-0" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base uppercase tracking-widest flex items-center gap-1.5 text-pink-505">
                      {lang === 'th' ? 'ติดตั้งสไตล์แอปมือถือ (PWA Setup)' : 'PWA Standalone Setup'}
                    </h3>
                    <p className={`text-[10px] font-bold ${theme === 'dark' ? 'text-slate-500' : 'text-purple-400'}`}>
                      {lang === 'th' ? 'รื่นรมย์ไม่มีโฆษณาและการแจ้งตารางสอนด่วนเสมือนโปรแกรมสโตร์' : 'Run Standalone Mode without address-bar boundaries'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPwaModal(false)}
                  className={`p-2 rounded-xl border hover:scale-105 active:scale-95 transition-all ${
                    theme === 'dark' ? 'bg-slate-950/40 border-slate-800 hover:bg-slate-800' : 'bg-slate-50 border-purple-100 hover:bg-purple-100'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* simulated check indicator */}
              {pwaInstalledSimulated ? (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-3 bg-pink-500/5 rounded-[2rem] border border-pink-500/10 my-4 z-10 transition-colors">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 to-teal-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-teal-500/20 animate-bounce">
                    <Check className="w-8 h-8" />
                  </div>
                  <h4 className="font-extrabold text-sm uppercase tracking-wider text-emerald-500">{lang === 'th' ? 'จำลองเพิ่มลงในหน้าจอหลักเรียบร้อย!' : 'Successfully Simulated Add to Home Screen!'}</h4>
                  <p className={`text-xs max-w-sm font-medium leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-550'}`}>
                    {lang === 'th' ? 'ระบบเปิดใช้งาน Standalone Mode สมบูรณ์แบบ คล่องแคล่วไม่มีแถบเบราว์เซอร์กวนใจ รองรับโหมดออฟไลน์แคช ⚡' : 'Standalone app ready. Open from your device Home Screen icons anytime with offline security backup enabled.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-5 z-10">
                  
                  {/* Platform selection slider */}
                  <div className="flex p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-transparent dark:border-slate-800">
                    {(['ios', 'android', 'desktop'] as const).map((plat) => (
                      <button
                        key={plat}
                        onClick={() => setPwaPlatform(plat)}
                        className={`flex-1 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          pwaPlatform === plat
                            ? 'bg-gradient-to-r from-pink-400 to-purple-500 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {plat === 'ios' ? <Smartphone className="w-3.5 h-3.5" /> : 
                         plat === 'android' ? <span className="text-[10px]">🤖 Android</span> : <Monitor className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{plat === 'ios' ? 'Apple iOS' : plat === 'android' ? 'Android' : 'Desktop macOS'}</span>
                      </button>
                    ))}
                  </div>

                  {/* Manual Step guides */}
                  <div className={`p-5 rounded-[1.8rem] border ${theme === 'dark' ? 'bg-slate-950/60 border-slate-850' : 'bg-slate-50/50 border-purple-150/40'}`}>
                    {pwaPlatform === 'ios' && (
                      <div className="space-y-3 font-medium text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        <p className={`font-black uppercase text-pink-500 flex items-center gap-1 ${theme === 'dark' ? 'text-pink-400' : 'text-purple-950'}`}>
                          <ArrowUpToLine className="w-4 h-4" />
                          {lang === 'th' ? 'ขั้นตอนติดตั้งสำหรับ Safari / iOS (iPhone/iPad):' : 'iOS Apple Safari installation walkthrough:'}
                        </p>
                        <ol className="list-decimal pl-5 space-y-1.5">
                          <li>{lang === 'th' ? 'เปิดโปรแกรม Safari บนอุปกรณ์ และเข้าไปที่หน้าเว็บนี้' : 'Open Safari on your iPhone or iPad and navigate to this URL.'}</li>
                          <li>{lang === 'th' ? 'แตะปุ่ม "แชร์ (Share)" (รูปกล่องสี่เหลี่ยมลูกศรชี้ขึ้น)' : 'Tap the "Share" button (square box with an arrow pointing upwards) in the Safari toolbar.'}</li>
                          <li>{lang === 'th' ? 'เลื่อนหน้าลงมาด้านล่างแล้วกดเลือก "เพิ่มลงในหน้าจอโฮม (Add to Home Screen)"' : 'Scroll down the share options and select "Add to Home Screen" option.'}</li>
                          <li>{lang === 'th' ? 'ตั้งชื่อไอคอนตามต้องการ และแตะปุ่ม "เพิ่ม (Add)" ที่มุมบนขวา เพื่อเสร็จสิ้น!' : 'Confirm the application title and tap "Add" in the top-right corner.'}</li>
                        </ol>
                      </div>
                    )}

                    {pwaPlatform === 'android' && (
                      <div className="space-y-3 font-medium text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        <p className="font-black uppercase text-pink-500 dark:text-pink-400 flex items-center gap-1">
                          <Smartphone className="w-4 h-4 text-emerald-500" />
                          {lang === 'th' ? 'ขั้นตอนติดตั้งสำหรับ Chrome / Android OS:' : 'Android Chrome installation steps:'}
                        </p>
                        <ol className="list-decimal pl-5 space-y-1.5">
                          <li>{lang === 'th' ? 'เปิดแอป Google Chrome บนเครื่องแอนดรอยด์ของท่าน' : 'Open Google Chrome browser on your Android smartphone or tablet.'}</li>
                          <li>{lang === 'th' ? 'แตะปุ่มจุดสามจุด (เมนูบาร์ด้านขวาบน)' : 'Tap the three-dot options menu icon in the upper right.'}</li>
                          <li>{lang === 'th' ? 'แตะเลือกหัวข้อ "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก" (Add to Home Screen)' : 'Select "Install App" or "Add to Home screen" option from the list.'}</li>
                          <li>{lang === 'th' ? 'เมื่อมีหน้าต่างเด้งขึ้นมา ให้กดปุ่ม "ตกลงเพิ่มเติม" เพื่อสร้างคีย์ลัดหน้าจอสำเร็จ!' : 'Confirm the selection. Chrome will create a standalone desktop launcher icon.'}</li>
                        </ol>
                      </div>
                    )}

                    {pwaPlatform === 'desktop' && (
                      <div className="space-y-3 font-medium text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        <p className="font-black uppercase text-pink-500 dark:text-pink-400 flex items-center gap-1">
                          <Monitor className="w-4 h-4 text-indigo-400" />
                          {lang === 'th' ? 'ขั้นตอนสำหรับคอมพิวเตอร์ / บล็อกเกอร์ (PC & macOS Chrome):' : 'PC & macOS Chrome instructions:'}
                        </p>
                        <ol className="list-decimal pl-5 space-y-1.5">
                          <li>{lang === 'th' ? 'เปิดโปรแกรม Google Chrome / Edge บนพิวเตอร์พีซี' : 'Ensure you are browsing on Google Chrome, Microsoft Edge, or a chromium browser on PC/Mac.'}</li>
                          <li>{lang === 'th' ? 'สังเกตไอคอน "ไอคอนติดตั้งแอปมือถือ" (รูปหน้าจอคอม มีเครื่องหมายบวก) ที่ช่อง URL ขวาบน' : 'Look at the address bar for a tiny monitor computer icon with an addition (+) sign.'}</li>
                          <li>{lang === 'th' ? 'คลิกที่ไอคอนนั้น และกดตกลง "ติดตั้งแอป (Install App)"' : 'Click it and select "Install" to create a windowed, dock-enabled standalone application.'}</li>
                        </ol>
                      </div>
                    )}
                  </div>

                  {/* Simulated full trial standalone mode button */}
                  <div className="flex gap-4 items-center justify-between pt-1.5">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-pink-400 animate-spin" style={{ animationDuration: '8s' }} />
                      <span className={`text-[10px] sm:text-xs font-bold ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                        {lang === 'th' ? '💡 รองรับการทำงานในโหมด Standalone ออฟไลน์ไม่มีขอบสะท้อน' : '💡 Connects seamlessly to home dock for distraction-free sync'}
                      </span>
                    </div>

                    <button
                      onClick={simulatePwaInstalled}
                      className="px-5 py-2.5 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg active:scale-95 transition-all"
                    >
                      {lang === 'th' ? 'เพิ่มลงหน้าจอหลักทันที 📲' : 'Simulate Add Shortcut 📲'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
