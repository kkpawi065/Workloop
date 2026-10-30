import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User } from 'firebase/auth';
import { initAuth, googleSignIn, anonymousSignIn } from './lib/firebase';
import Dashboard from './components/Dashboard';
import MascotIllustration from './components/MascotIllustration';
import FloatingBubbles from './components/FloatingBubbles';
// @ts-ignore
import mascotImage from './mascot.jpg';
import { cn } from './lib/utils';
import { FileSpreadsheet, LogIn, ShieldCheck, Activity, Globe, Sun, Moon } from 'lucide-react';
import { translations, Language } from './constants/translations';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showSplash, setShowSplash] = useState(true);

  const t = translations[lang];

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2800); // 2.8 seconds of elegant launch animation
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Check local storage or system preference
    const savedTheme = localStorage.getItem('workloop_theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('workloop_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await anonymousSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to sign in as guest. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [greetingIndex, setGreetingIndex] = useState(0);

  const NEUTRAL_GREETINGS = [
    {
      th: "ยินดีต้อนรับสู่ระบบ Workloop 🚀 ร่วมผสานพลังขับเคลื่อนวิชาการ",
      en: "Welcome to Workloop 🚀 Empowering academic synergy together"
    },
    {
      th: "เตรียมพร้อมเพื่อศิษย์ 🎯 มุ่งมั่นพัฒนาการจัดการเรียนรู้ภาษาต่างประเทศ",
      en: "Active coaching & learning 🎯 Fostering foreign language teaching excellence"
    },
    {
      th: "คลาสเรียนเปี่ยมคุณค่า ✨ ร่วมยกระดับประสิทธิภาพครูต่างชาติ",
      en: "High-value classrooms ✨ Unleashing global teacher potential"
    },
    {
      th: "ขับเคลื่อนศักยภาพอย่างต่อเนื่อง 📚 สานต่อวิสัยทัศน์คุณภาพผู้เรียน",
      en: "Continuous capability drive 📚 Sustaining foreign language education quality"
    },
    {
      th: "ก้าวหน้าไปด้วยกัน 🌟 เรียนรู้ ต่อยอด และตรวจสอบผลงานอย่างยั่งยืน",
      en: "Elevating standards together 🌟 Reviewing, guiding and shining"
    },
    {
      th: "ความรักในผู้เรียนคือกุญแจหลัก ❤️ สนับสนุนทุกเป้าหมายการสื่อสาร",
      en: "Passion for learning is key ❤️ Assisting teachers in every classroom goal"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const rotationTimer = setInterval(() => {
      setGreetingIndex(prev => (prev + 1) % NEUTRAL_GREETINGS.length);
    }, 5000); // Swaps smoothly every 5 seconds
    return () => clearInterval(rotationTimer);
  }, []);

  const getBlobStyles = () => {
    if (currentHour >= 6 && currentHour < 11) {
      return {
        blob1: theme === 'dark' ? "bg-amber-500/10 shadow-[0_0_80px_rgba(245,158,11,0.15)]" : "bg-amber-500/25 shadow-[0_0_80px_rgba(245,158,11,0.2)]",
        blob2: theme === 'dark' ? "bg-orange-500/10" : "bg-orange-500/20",
        textStyle: "text-amber-500 dark:text-amber-400"
      };
    } else if (currentHour >= 11 && currentHour < 17) {
      return {
        blob1: theme === 'dark' ? "bg-sky-500/10 shadow-[0_0_80px_rgba(14,165,233,0.15)]" : "bg-sky-400/25 shadow-[0_0_80px_rgba(56,189,248,0.2)]",
        blob2: theme === 'dark' ? "bg-emerald-500/10" : "bg-emerald-500/20",
        textStyle: "text-sky-600 dark:text-sky-450"
      };
    } else if (currentHour >= 17 && currentHour < 24) {
      return {
        blob1: theme === 'dark' ? "bg-purple-500/10 shadow-[0_0_80px_rgba(168,85,247,0.15)]" : "bg-purple-500/25 shadow-[0_0_80px_rgba(168,85,247,0.25)]",
        blob2: theme === 'dark' ? "bg-pink-500/10" : "bg-pink-500/20",
        textStyle: "text-purple-600 dark:text-purple-400"
      };
    } else {
      return {
        blob1: theme === 'dark' ? "bg-indigo-600/10 shadow-[0_0_80px_rgba(79,70,229,0.15)]" : "bg-indigo-400/25 shadow-[0_0_80px_rgba(99,102,241,0.2)]",
        blob2: theme === 'dark' ? "bg-violet-600/10" : "bg-violet-500/20",
        textStyle: "text-indigo-600 dark:text-indigo-400"
      };
    }
  };

  const blobStyles = getBlobStyles();
  const greetingText = lang === 'th' ? NEUTRAL_GREETINGS[greetingIndex].th : NEUTRAL_GREETINGS[greetingIndex].en;

  if (showSplash) {
    return (
      <div className={cn(
        "h-screen w-full flex flex-col items-center justify-center font-sans relative overflow-hidden transition-colors duration-1000",
        theme === 'dark' ? "bg-slate-950 text-white" : "bg-gradient-to-tr from-pink-50 via-purple-50 to-indigo-50 text-slate-900"
      )}>
        {/* Soft elegant glowing dots in the background */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/10 blur-[120px] animate-pulse animate-duration-1000" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-pink-500/10 blur-[120px]" />

        <div className="relative z-10 flex flex-col items-center text-center px-10">
          
          {/* Main Logo Emblem - elegant floating up style motion */}
          <motion.div
            initial={{ opacity: 0, y: 55, scale: 0.8, rotate: -8 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 3 }}
            transition={{ 
              duration: 1.5, 
              ease: [0.16, 1, 0.3, 1], // premium custom ease-out
              delay: 0.2
            }}
            className={cn(
              "w-24 h-24 sm:w-28 sm:h-28 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl relative",
              theme === 'dark'
                ? "bg-gradient-to-br from-slate-805 to-slate-950 border border-slate-850 shadow-purple-500/15"
                : "bg-gradient-to-br from-purple-400 to-indigo-505 border border-white shadow-purple-500/25"
            )}
          >
            <FileSpreadsheet className="w-12 h-12 sm:w-14 sm:h-14 text-white -rotate-3" />
          </motion.div>

          {/* Staggered text animations */}
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
            className={cn(
              "text-3xl sm:text-5xl font-black tracking-tight mb-2.5",
              theme === 'dark' 
                ? "text-white" 
                : "text-purple-900"
            )}
          >
            {t.appName || 'Workloop'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className={cn(
              "text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] mb-8",
              theme === 'dark' ? "text-slate-500" : "text-purple-400"
            )}
          >
            {lang === 'th' ? "กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ" : "Department of Foreign Languages"}
          </motion.p>

          {/* Sizable progress status elements */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1.5 }}
            className={`flex items-center gap-3 p-2.5 px-4.5 rounded-full border shadow-3xs ${
              theme === 'dark' ? "bg-slate-900/40 border-slate-800" : "bg-white border-purple-100"
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-xs shadow-emerald-500/50" />
            <span className={cn(
              "text-[9.5px] font-black uppercase tracking-widest font-mono",
              theme === 'dark' ? "text-slate-400" : "text-purple-950/60"
            )}>
              {lang === 'th' ? "กำลังเชื่อมต่อคลาวด์ออฟไลน์..." : "PROVISIONING OFFLINE CACHE..."}
            </span>
          </motion.div>

        </div>
      </div>
    );
  }

  if (loading && !user) {
    return (
      <div className={cn("h-screen w-full flex items-center justify-center font-sans relative overflow-hidden transition-colors duration-500 bg-transparent text-white")}>
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-purple-500/10 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-pink-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col items-center bg-slate-950/50 backdrop-blur-md py-6 px-10 rounded-[2rem] border border-white/10 shadow-2xl">
          <p className="text-sm font-black tracking-widest uppercase mb-3 text-[#bf2aa6] dark:text-pink-400">{t.appName}</p>
          <div className="flex gap-2 items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-[#bf2aa6] dark:bg-pink-400 animate-bounce" style={{ animationDelay: '0s' }} />
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0.3s' }} />
          </div>
        </div>
      </div>
    );
  }

  if (user && token) {
    return <Dashboard accessToken={token} user={user} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />;
  }

  return (
    <div className={cn("h-screen w-full flex items-center justify-center font-sans relative overflow-hidden transition-colors duration-500 bg-transparent", 
      theme === 'dark' ? "text-white" : "text-slate-900"
    )}>
      {/* Background patterns */}
      <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: theme === 'dark' ? 'radial-gradient(#1e293b 1px, transparent 1px)' : 'radial-gradient(#bce8df 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      </div>

      <FloatingBubbles theme={theme} />

      <div className={cn("absolute top-20 right-20 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-1000", blobStyles.blob1)} />
      <div className={cn("absolute bottom-20 left-20 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-1000", blobStyles.blob2)} />

      <div className="w-full max-w-lg h-full flex items-center justify-center p-6 relative overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "w-full p-8 sm:p-12 backdrop-blur-md rounded-[3rem] shadow-2xl relative z-10 text-center transition-all duration-500",
            theme === 'dark' 
              ? "bg-slate-900/80 border border-slate-800 shadow-purple-500/5" 
              : "bg-white/80 border border-white shadow-purple-500/5"
          )}
        >
          <div className="flex flex-col items-center mb-6">
            {/* Elegant Logo Design */}
            <div className={cn(
              "w-20 h-20 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl rotate-3 transition-colors",
              theme === 'dark' 
                ? "bg-gradient-to-br from-slate-700 to-slate-800 shadow-black/40" 
                : "bg-gradient-to-br from-purple-300 to-purple-400 shadow-purple-500/20"
            )}>
              <FileSpreadsheet className="w-10 h-10 text-white -rotate-3" />
            </div>

            <h1 className={cn("text-3xl sm:text-4xl font-black tracking-tight mb-1 transition-colors", theme === 'dark' ? "text-white" : "text-purple-900")}>
              {t.appName}
            </h1>
            <p className={cn("text-[5.4px] sm:text-[6px] font-bold tracking-tight mb-4 transition-colors", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ</p>

            <div className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-full border transition-colors",
              theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-emerald-100/50 border-emerald-200/50"
            )}>
              <div className={cn("w-2 h-2 rounded-full animate-pulse", theme === 'dark' ? "bg-green-400" : "bg-emerald-500")} />
              <span className={cn("text-[10px] font-bold uppercase tracking-widest transition-colors", theme === 'dark' ? "text-slate-400" : "text-emerald-700")}>
                {t.enterpriseReady}
              </span>
            </div>
          </div>

          <p 
            className={cn("text-[7px] leading-relaxed mb-10 font-bold italic transition-colors", theme === 'dark' ? "text-slate-400" : "text-slate-500")}
            style={{ wordBreak: 'keep-all', overflowWrap: 'break-word' }}
          >
            {t.loginSub}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-2xl animate-shake">
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            className={cn(
              "w-full group relative flex items-center justify-center gap-4 py-5 px-8 rounded-full overflow-hidden shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]",
              theme === 'dark' 
                ? "bg-white text-slate-900 hover:bg-slate-100 shadow-white/5" 
                : "bg-purple-500 text-white shadow-purple-500/20"
            )}
          >
            {theme !== 'dark' && <div className="absolute inset-0 bg-purple-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />}
            <LogIn className="w-5 h-5 relative z-10" />
            <span className="text-sm font-black relative z-10 tracking-widest uppercase">{t.loginTitle}</span>
          </button>

          <button
            onClick={handleGuestLogin}
            className={cn(
              "w-full group relative flex items-center justify-center gap-4 py-4 px-8 mt-4 rounded-full overflow-hidden border transition-all hover:scale-[1.02] active:scale-[0.98]",
              theme === 'dark' 
                ? "bg-slate-800 border-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white" 
                : "bg-purple-50 border-purple-100 text-purple-700 hover:bg-purple-100/50"
            )}
          >
            <Globe className="w-5 h-5" />
            <span className="text-sm font-black tracking-widest uppercase">{t.guestLogin}</span>
          </button>

          <div className={cn(
            "mt-12 pt-8 border-t flex items-center justify-center gap-6 opacity-40 transition-colors",
            theme === 'dark' ? "border-slate-800" : "border-slate-100 text-slate-900"
          )}>
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[9px] font-bold uppercase tracking-tighter">OAuth 2.0 Secure</span>
            </div>
            <div className="flex items-center gap-1">
              <Activity className="w-4 h-4" />
              <span className="text-[9px] font-bold uppercase tracking-tighter">Live Monitor</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom control bar overlays (for language and theme switchers relative to viewport) */}
      <div className="absolute top-2 right-2 sm:top-6 sm:right-6 z-20 flex gap-1.5 sm:gap-4 items-center">
        <div className="flex gap-1 sm:gap-2 p-0.5 sm:p-1 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
          <button 
            onClick={() => setLang('en')}
            className={cn(
              "px-2 py-1 sm:px-4 sm:py-2 text-[7px] sm:text-[10px] font-black rounded-full transition-all uppercase tracking-widest",
              lang === 'en' 
                ? (theme === 'dark' ? "bg-white text-slate-950 shadow-lg" : "bg-purple-500 text-white shadow-lg shadow-purple-200") 
                : (theme === 'dark' ? "text-white/40 hover:text-white" : "text-purple-300 hover:bg-purple-50/50")
            )}
          >
            EN
          </button>
          <button 
            onClick={() => setLang('th')}
            className={cn(
              "px-2 py-1 sm:px-4 sm:py-2 text-[7px] sm:text-[10px] font-black rounded-full transition-all uppercase tracking-widest",
              lang === 'th' 
                ? (theme === 'dark' ? "bg-white text-slate-950 shadow-lg" : "bg-purple-500 text-white shadow-lg shadow-purple-200") 
                : (theme === 'dark' ? "text-white/40 hover:text-white" : "text-purple-300 hover:bg-purple-50/50")
            )}
          >
            TH
          </button>
        </div>

        <button 
          onClick={toggleTheme}
          className={cn(
            "p-1.5 sm:p-3 rounded-lg sm:rounded-2xl border transition-all duration-300 hover:scale-110 active:scale-95 flex items-center justify-center",
            theme === 'dark' 
              ? "bg-slate-800 border-slate-700 text-yellow-400 shadow-lg shadow-yellow-500/10" 
              : "bg-white border-purple-100 text-purple-600 shadow-lg shadow-purple-500/5 hover:bg-purple-50"
          )}
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> : <Moon className="w-3.5 h-3.5 sm:w-5 sm:h-5" />}
        </button>
      </div>

      {/* Decorative corner lines (subtle, visible under light theme style) */}
      <div className={cn("absolute bottom-12 right-12 flex flex-col gap-1 transition-opacity", theme === 'dark' ? "opacity-10 grayscale invert" : "opacity-20")}>
        <div className="w-8 h-[2px] bg-slate-900" />
        <div className="w-12 h-[2px] bg-slate-900" />
        <div className="w-4 h-[2px] bg-slate-900" />
      </div>
    </div>
  );
}
