import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Copy, 
  RotateCcw, 
  Sliders, 
  MousePointerClick, 
  Info, 
  Check, 
  Eye, 
  Lightbulb, 
  Settings, 
  Heart, 
  MessageSquare, 
  Code, 
  FileText,
  User,
  Activity,
  Smile,
  Zap,
  Star
} from 'lucide-react';

interface CandyScrollbarPlaygroundProps {
  theme: 'light' | 'dark';
  lang: 'en' | 'th';
}

export default function CandyScrollbarPlayground({ theme, lang }: CandyScrollbarPlaygroundProps) {
  // Configurable states
  const [width, setWidth] = useState<number>(6);
  const [radius, setRadius] = useState<'0px' | '4px' | '8px' | '9999px'>('9999px');
  const [glowIntensity, setGlowIntensity] = useState<number>(0.6);
  const [glowEnabled, setGlowEnabled] = useState<boolean>(true);
  const [applyGlobally, setApplyGlobally] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<'candy' | 'glow' | 'cyber' | 'lavender'>('candy');

  // Preview content selector states
  const [activePreviewType, setActivePreviewType] = useState<'chat' | 'poem' | 'teachers' | 'css'>('chat');

  // Let's design premium pre-set configurations
  const applyPreset = (preset: 'candy' | 'glow' | 'cyber' | 'lavender') => {
    setActivePreset(preset);
    if (preset === 'candy') {
      setWidth(6);
      setRadius('9999px');
      setGlowEnabled(true);
      setGlowIntensity(0.5);
    } else if (preset === 'glow') {
      setWidth(8);
      setRadius('9999px');
      setGlowEnabled(true);
      setGlowIntensity(0.85);
    } else if (preset === 'cyber') {
      setWidth(9);
      setRadius('4px');
      setGlowEnabled(true);
      setGlowIntensity(0.9);
    } else if (preset === 'lavender') {
      setWidth(5);
      setRadius('8px');
      setGlowEnabled(false);
      setGlowIntensity(0.3);
    }
  };

  // Dynamic css gradients and values based on the selections and the dark/light mode
  // 1. Light Theme Customizers:
  const lightNormalGrad = 'linear-gradient(180deg, #FFB7D5 0%, #D8B4FE 100%)';
  const lightHoverGrad = 'linear-gradient(180deg, #FF5EA4 0%, #8B5CF6 100%)'; // Sweet Pink & Juicy Violet
  const lightActiveGrad = 'linear-gradient(180deg, #EC4899 0%, #6D28D9 100%)'; // Active click bright deep transition

  // 2. Dark Theme Customizers (Neon pastel glowing with soft reflecting colors):
  const darkNormalGrad = 'linear-gradient(180deg, rgba(255, 148, 219, 0.45) 0%, rgba(177, 140, 248, 0.45) 100%)';
  const darkHoverGrad = 'linear-gradient(180deg, rgba(255, 64, 163, 0.85) 0%, rgba(168, 85, 247, 0.85) 100%)'; // Sweet Pink & Juicy Violet Neon
  const darkActiveGrad = 'linear-gradient(180deg, #FF2E93 0%, #A855F7 100%)'; // Bright shiny active neon

  // Decide current rendered configurations
  const isDark = theme === 'dark';
  const currentNormal = isDark ? darkNormalGrad : lightNormalGrad;
  const currentHover = isDark ? darkHoverGrad : lightHoverGrad;
  const currentActive = isDark ? darkActiveGrad : lightActiveGrad;

  // Track background
  const trackBgStyle = isDark ? 'rgba(30, 41, 59, 0.25)' : 'rgba(255, 255, 255, 0.35)';
  const borderColStyle = isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.8)';
  const borderWidthStyle = width > 8 ? 1.5 : 1;

  // Setup styles injection
  // To avoid interfering with the other scrollbars when applyGlobally is false,
  // we target custom-scrollbar and document-level conditionally.
  const globalSelector = applyGlobally ? `
    ::-webkit-scrollbar {
      width: ${width}px !important;
      height: ${width}px !important;
    }
    ::-webkit-scrollbar-track {
      background: ${trackBgStyle} !important;
    }
    ::-webkit-scrollbar-thumb {
      background: ${isDark ? `linear-gradient(180deg, rgba(255, 148, 219, ${glowIntensity * 0.75}) 0%, rgba(177, 140, 248, ${glowIntensity * 0.75}) 100%)` : `linear-gradient(135deg, #FFB7D5 0%, #D8B4FE 100%)`} !important;
      border-radius: ${radius} !important;
      border: ${borderWidthStyle}px solid ${borderColStyle} !important;
      transition: all 300ms ease-in-out !important;
      ${glowEnabled ? `box-shadow: 0 0 ${glowIntensity * 10}px ${isDark ? `rgba(168, 85, 247, ${glowIntensity * 0.8})` : `rgba(236, 72, 153, ${glowIntensity * 0.4})`} !important;` : ''}
    }
    ::-webkit-scrollbar-thumb:hover {
      background: ${isDark ? `linear-gradient(180deg, rgba(255, 64, 163, 0.85) 0%, rgba(168, 85, 247, 0.85) 100%)` : `linear-gradient(135deg, #FF5EA4 0%, #8B5CF6 100%)`} !important;
      ${glowEnabled ? `box-shadow: 0 0 ${glowIntensity * 15}px ${isDark ? `rgba(255, 64, 163, 0.9)` : `rgba(139, 92, 246, 0.85)`} !important;` : ''}
    }
    ::-webkit-scrollbar-thumb:active {
      background: ${isDark ? `#FF2E93` : `#EC4899`} !important;
      ${glowEnabled ? `box-shadow: 0 0 ${glowIntensity * 22}px ${isDark ? `rgba(255, 46, 147, 1)` : `rgba(112, 0, 232, 1)`} !important;` : ''}
    }
  ` : '';

  const sandboxSelector = `
    .sandbox-scrollable-area::-webkit-scrollbar {
      width: ${width}px !important;
      height: ${width}px !important;
    }
    .sandbox-scrollable-area::-webkit-scrollbar-track {
      background: ${trackBgStyle} !important;
      border-radius: 999px !important;
    }
    .sandbox-scrollable-area::-webkit-scrollbar-thumb {
      background: ${isDark ? `linear-gradient(180deg, rgba(255, 148, 219, ${glowIntensity * 0.75}) 0%, rgba(177, 140, 248, ${glowIntensity * 0.75}) 100%)` : `linear-gradient(135deg, #FFB7D5 0%, #D8B4FE 100%)`} !important;
      border-radius: ${radius} !important;
      border: ${borderWidthStyle}px solid ${borderColStyle} !important;
      transition: all 250ms ease-in-out !important;
      ${glowEnabled ? `box-shadow: 0 0 ${glowIntensity * 10}px ${isDark ? `rgba(168, 85, 247, ${glowIntensity * 0.8})` : `rgba(236, 72, 153, ${glowIntensity * 0.4})`} !important;` : ''}
    }
    .sandbox-scrollable-area::-webkit-scrollbar-thumb:hover {
      background: ${isDark ? `linear-gradient(180deg, rgba(255, 64, 163, 0.85) 0%, rgba(168, 85, 247, 0.85) 100%)` : `linear-gradient(135deg, #FF5EA4 0%, #8B5CF6 100%)`} !important;
      ${glowEnabled ? `box-shadow: 0 0 ${glowIntensity * 16}px ${isDark ? `rgba(255, 64, 163, 0.9)` : `rgba(139, 92, 246, 0.85)`} !important;` : ''}
    }
    .sandbox-scrollable-area::-webkit-scrollbar-thumb:active {
      background: ${isDark ? `linear-gradient(180deg, #FF2E93 0%, #A855F7 100%)` : `linear-gradient(135deg, #EC4899 0%, #6D28D9 100%)`} !important;
      ${glowEnabled ? `box-shadow: 0 0 ${glowIntensity * 22}px ${isDark ? `rgba(255, 46, 147, 1)` : `rgba(112, 0, 232, 1)`} !important;` : ''}
    }
  `;

  // Code to export
  const generatedCSSCode = `/* 🎨 Candy Scrollbar Custom CSS */
::-webkit-scrollbar {
  width: ${width}px;
  height: ${width}px;
}
::-webkit-scrollbar-track {
  background: ${trackBgStyle};
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb {
  background: ${isDark ? `linear-gradient(180deg, rgba(255, 148, 219, ${glowIntensity}) 0%, rgba(177, 140, 248, ${glowIntensity}) 100%)` : `linear-gradient(135deg, #FFB7D5 0%, #D8B4FE 100%)`};
  border-radius: ${radius};
  border: ${borderWidthStyle}px solid ${borderColStyle};
  transition: all 0.3s ease-in-out;
  ${glowEnabled ? `box-shadow: 0 0 ${glowIntensity * 10}px ${isDark ? `rgba(168, 85, 247, ${glowIntensity})` : `rgba(236, 72, 153, ${glowIntensity * 0.4})`};` : '/* No glow shadow */'}
}
::-webkit-scrollbar-thumb:hover {
  background: ${isDark ? `linear-gradient(180deg, rgba(255, 64, 163, 0.9) 0%, rgba(168, 85, 247, 0.9) 100%)` : `linear-gradient(135deg, #FF5EA4 0%, #8B5CF6 100%)` /* Sweet Pink & Juicy Violet */};
  ${glowEnabled ? `box-shadow: 0 0 ${glowIntensity * 16}px ${isDark ? `rgba(255, 64, 163, 0.9)` : `rgba(139, 92, 246, 0.85)`};` : ''}
}
::-webkit-scrollbar-thumb:active {
  background: ${isDark ? `linear-gradient(180deg, #FF2E93 0%, #A855F7 100%)` : `linear-gradient(135deg, #EC4899 0%, #6D28D9 100%)` /* Active Color shift */};
  ${glowEnabled ? `box-shadow: 0 0 ${glowIntensity * 24}px ${isDark ? `rgba(255, 46, 147, 1)` : `rgba(112, 0, 232, 1)`};` : ''}
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCSSCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-8 text-left pb-12">
      {/* Scrollbar dynamic rules injection */}
      <style>{globalSelector + sandboxSelector}</style>

      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={`text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3 transition-colors ${theme === 'dark' ? "text-slate-100" : "text-purple-900"}`}>
            <Sparkles className="w-7 h-7 sm:w-9 sm:h-9 text-pink-500 animate-pulse shrink-0" />
            {lang === 'th' ? 'แคนดี้ ดีไซน์ สตูโอ' : 'Candy Scrollbar Design Studio'}
          </h2>
          <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-1.5 ${theme === 'dark' ? "text-slate-500" : "text-slate-400"}`}>
            {lang === 'th' ? 'ปรับแต่งเลื่อนหน้าอย่างน่ารื่นรมย์ สัมผัสฟังก์ชันและการไล่ระดับสีพาสเทลแสนน่ารัก' : 'Bespoke scroll thumb presets, active transitions & high-contrast interactive playgrounds'}
          </p>
        </div>

        {/* Global check toggle */}
        <div className={`p-1.5 sm:p-2 rounded-2xl border flex items-center gap-3 text-[10px] sm:text-xs font-black select-none ${theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-purple-100 text-purple-900 shadow-3xs"}`}>
          <span className="opacity-75">{lang === 'th' ? 'ใช้งานทั้งระบบ:' : 'Apply to entire app:'}</span>
          <button 
            onClick={() => setApplyGlobally(!applyGlobally)}
            className={`px-3 py-1.5 rounded-xl transition-all uppercase tracking-wider ${
              applyGlobally 
                ? 'bg-gradient-to-r from-pink-400 to-purple-500 text-white shadow-xs' 
                : (theme === 'dark' ? 'bg-slate-800 text-slate-500 hover:text-slate-400' : 'bg-slate-100 text-slate-400 hover:text-slate-600')
            }`}
          >
            {applyGlobally ? (lang === 'th' ? 'เปิดอยู่ 🌸' : 'Active 🌸') : (lang === 'th' ? 'ปิด' : 'Off')}
          </button>
        </div>
      </div>

      {/* Bento Grid Panel Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Preset cards & customize controls (5 Cols) */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          
          {/* Preset Buttons Block */}
          <div className={`p-5 sm:p-6 rounded-[2rem] border flex flex-col gap-4 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-purple-50 shadow-3xs'}`}>
            <h3 className={`text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-purple-950'}`}>
              <Heart className="w-4.5 h-4.5 text-pink-500 fill-pink-500" />
              {lang === 'th' ? 'พรีเซ็ตแคนดี้ที่แนะนำ' : 'Featured Sweet Presets'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              {/* Presets 1: Cotton Candy */}
              <button 
                onClick={() => applyPreset('candy')}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                  activePreset === 'candy'
                    ? (theme === 'dark' ? 'bg-pink-950/20 border-pink-500/50 text-white' : 'bg-pink-50/50 border-pink-200 text-pink-950 shadow-3xs')
                    : (theme === 'dark' ? 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-slate-50/50 border-transparent text-slate-500 hover:bg-slate-100')
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wide">🍬 Cotton Candy</span>
                  <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-r from-[#FFB7D5] to-[#D8B4FE]" />
                </div>
                <p className="text-[9.5px] leading-tight opacity-75">
                  {lang === 'th' ? 'ไล่สีชมพู-ม่วงพาสเทลนุ่มนวล' : 'Soft rose & lavender light pastel blend'}
                </p>
              </button>

              {/* Presets 2: Dark Glow */}
              <button 
                onClick={() => applyPreset('glow')}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                  activePreset === 'glow'
                    ? (theme === 'dark' ? 'bg-purple-950/25 border-purple-500/50 text-white' : 'bg-purple-50/50 border-purple-200 text-purple-950 shadow-3xs')
                    : (theme === 'dark' ? 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-slate-50/50 border-transparent text-slate-500 hover:bg-slate-100')
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wide">✨ Candy Glow</span>
                  <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-r from-[#FF94DB] to-[#B18CF8]" />
                </div>
                <p className="text-[9.5px] leading-tight opacity-75">
                  {lang === 'th' ? 'สีนีออนพาสเทลสะท้อนเงาละมุน' : 'Soft pastel neon glowing reflections'}
                </p>
              </button>

              {/* Presets 3: Cyber Candy */}
              <button 
                onClick={() => applyPreset('cyber')}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                  activePreset === 'cyber'
                    ? (theme === 'dark' ? 'bg-indigo-950/25 border-indigo-500/50 text-white' : 'bg-indigo-50/50 border-indigo-200 text-indigo-950 shadow-3xs')
                    : (theme === 'dark' ? 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-slate-50/50 border-transparent text-slate-500 hover:bg-slate-100')
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wide">🔮 Cyber Violet</span>
                  <div className="w-3.5 h-3.5 rounded-full bg-gradient-to-r from-pink-500 to-indigo-500" />
                </div>
                <p className="text-[9.5px] leading-tight opacity-75">
                  {lang === 'th' ? 'สีโทนหนา นีออนสดใสสไตล์ไซเบอร์' : 'Bright blocky high-contrast gamified neon'}
                </p>
              </button>

              {/* Presets 4: Tiny Lavender */}
              <button 
                onClick={() => applyPreset('lavender')}
                className={`p-3.5 rounded-2xl border text-left flex flex-col gap-2 transition-all ${
                  activePreset === 'lavender'
                    ? (theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-100 border-slate-300 text-slate-900 shadow-3xs')
                    : (theme === 'dark' ? 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700' : 'bg-slate-50/50 border-transparent text-slate-500 hover:bg-slate-100')
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wide">🧸 Minim Lavender</span>
                  <div className="w-3.5 h-3.5 rounded-full bg-indigo-300 dark:bg-indigo-500/50" />
                </div>
                <p className="text-[9.5px] leading-tight opacity-75">
                  {lang === 'th' ? 'ขนาดเรียวเล็ก สีโทนพาสเทลสุภาพ' : 'Tiny elegant pastel lavenders for reading'}
                </p>
              </button>
            </div>
          </div>

          {/* Interactive Styling Sliders */}
          <div className={`p-5 sm:p-6 rounded-[2rem] border flex flex-col gap-5 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-purple-50 shadow-3xs'}`}>
            <h3 className={`text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-purple-950'}`}>
              <Sliders className="w-4.5 h-4.5 text-purple-500" />
              {lang === 'th' ? 'แผงควบคุมสไลเดอร์และขีดวัด' : 'Style Parameters & Sizing'}
            </h3>

            {/* Sizing Width Control */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-[11px] font-black uppercase">
                <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>{lang === 'th' ? 'ความหนาเศษขอบ (Scrollbar Width):' : 'Scrollbar Width:'}</span>
                <span className="text-pink-500">{width}px</span>
              </div>
              <input 
                type="range" 
                min="4" 
                max="18" 
                value={width} 
                onChange={(e) => {
                  setWidth(parseInt(e.target.value));
                  setActivePreset(null as any); // Clear predefined active preset focus
                }}
                className="w-full accent-pink-500 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer transition-all"
              />
            </div>

            {/* Glowing Effects Control (especially for Candy Glow in dark mode) */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-[11px] font-black uppercase">
                <span className={theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}>
                  {lang === 'th' ? 'เอฟเฟกต์สะท้อนแสงนีออน (Glow Glow):' : 'Glow Neon Shadow:'}
                </span>
                <button 
                  onClick={() => setGlowEnabled(!glowEnabled)}
                  className={`text-[9.5px] font-black px-2.5 py-0.5 rounded-full border transition-all ${
                    glowEnabled 
                      ? 'bg-pink-500/10 text-pink-500 border-pink-500/30' 
                      : 'bg-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-800 dark:text-slate-600'
                  }`}
                >
                  {glowEnabled ? (lang === 'th' ? 'เปิด' : 'ON') : (lang === 'th' ? 'ปิด' : 'OFF')}
                </button>
              </div>

              {glowEnabled && (
                <div className="flex flex-col gap-2 bg-pink-500/5 p-3 rounded-2xl border border-pink-500/10 transition-all">
                  <div className="flex justify-between text-[10px] font-black uppercase">
                    <span className="text-slate-400">{lang === 'th' ? 'ระดับแสงเงาสะท้อน (Opacity):' : 'Reflection Density:'}</span>
                    <span className="text-pink-400 font-mono">{(glowIntensity * 100).toFixed(0)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    value={glowIntensity * 100} 
                    onChange={(e) => setGlowIntensity(parseInt(e.target.value) / 100)}
                    className="w-full accent-purple-500 h-1 bg-slate-205 dark:bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <p className="text-[9px] text-pink-400 font-medium italic">
                    {theme === 'dark' 
                      ? (lang === 'th' ? '✨ โหมดกลางคืนจะสะท้อนแสงพาสเทลนีออนอ่อนโยน สบายสายตา' : '✨ Gentle soothing glows for comfortable reading') 
                      : (lang === 'th' ? '🌸 โหมดกลางวันจะสะท้อนแสงโทนชมพูพาสเทลน่ารักสดใส' : '🌸 Soft day-lit cotton candy shadows')}
                  </p>
                </div>
              )}
            </div>

            {/* Rounded settings */}
            <div className="flex flex-col gap-2">
              <span className={`text-[11px] font-black uppercase ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                {lang === 'th' ? 'ความโค้งมนของขอบเลื่อน (Thumb Roundness):' : 'Thumb Roundness:'}
              </span>
              <div className="grid grid-cols-4 gap-2 text-[10px] font-black tracking-wider uppercase">
                {(['0px', '4px', '8px', '9999px'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRadius(r)}
                    className={`py-2 rounded-xl border transition-all text-center ${
                      radius === r
                        ? 'bg-gradient-to-r from-pink-400 to-purple-500 border-transparent text-white shadow-xs'
                        : (theme === 'dark' ? 'bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-400' : 'bg-slate-50/60 border-purple-100 text-purple-800 hover:bg-purple-100/30')
                    }`}
                  >
                    {r === '0px' ? 'Square' : r === '4px' ? 'S' : r === '8px' ? 'M' : 'Full'}
                  </button>
                ))}
              </div>
            </div>

            {/* Instruction Callout for Interactive behaviors */}
            <div className={`p-4 rounded-2xl border flex gap-3 text-left ${theme === 'dark' ? 'bg-slate-950/40 border-slate-800/80' : 'bg-purple-50/30 border-purple-100'}`}>
              <MousePointerClick className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
              <div className="text-[10.5px] leading-relaxed">
                <p className={`font-black uppercase mb-0.5 ${theme === 'dark' ? 'text-violet-300' : 'text-purple-950'}`}>
                  {lang === 'th' ? 'รองรับการเปลี่ยนสี 3 สเตจ!' : 'Supports 3-Stage Transitions!'}
                </p>
                <p className={theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}>
                  {lang === 'th' ? '1. ปกติ: ไล่สีอ่อนโยน | 2. ชี้เมาส์: Sweet Pink & Juicy Violet สว่างเข้มหวาน | 3. คลิกค้าง: ดีไซน์สีพิเศษเข้มข้นจัดจ้าน!' : '1. Normal: soft loop | 2. Hover: Sweet Pink & Juicy Violet bright candy shift | 3. Drag Click: hot neon active reaction!'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns: Interactive scroll boxes & CSS generator (7 Cols) */}
        <div className="xl:col-span-7 flex flex-col gap-6 w-full">
          
          {/* Main sandbox visual preview */}
          <div className={`p-5 sm:p-6 rounded-[2rem] border duration-500 flex flex-col gap-4 relative overflow-hidden ${
            theme === 'dark' 
              ? 'bg-slate-900 border-slate-805 shadow-pink-500/5' 
              : 'bg-white border-purple-50 shadow-3xs shadow-purple-500/5'
          }`}>
            
            {/* Ambient Background decoration to showcase glow in dark mode */}
            {theme === 'dark' && glowEnabled && (
              <div 
                className="absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-all duration-700 bg-pink-500/10"
                style={{ opacity: glowIntensity }}
              />
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className={`text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-purple-950'}`}>
                <Eye className="w-4.5 h-4.5 text-purple-500" />
                {lang === 'th' ? 'ตัวเลือกลองเลื่อน (Interactive Sandbox)' : 'Interactive Sandbox Canvas'}
              </h3>

              {/* Toggle sandbox content tabs */}
              <div className="flex p-0.5 bg-slate-200 dark:bg-slate-950 rounded-xl border border-transparent dark:border-slate-800 flex-wrap">
                {(['chat', 'poem', 'teachers', 'css'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setActivePreviewType(t)}
                    className={`px-3 py-1.5 rounded-lg text-[9.5px] font-black uppercase tracking-wide transition-all ${
                      activePreviewType === t
                        ? 'bg-gradient-to-r from-pink-400 to-purple-500 text-white shadow-xs'
                        : 'text-slate-400 dark:text-slate-550 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {t === 'chat' ? '💬 Chat' : t === 'poem' ? '📜 Poem' : t === 'teachers' ? '👥 Teachers' : '💻 CSS'}
                  </button>
                ))}
              </div>
            </div>

            {/* Actual scrollable boxes */}
            <div className={`p-5 rounded-[1.8rem] border h-[340px] relative transition-colors ${theme === 'dark' ? 'bg-slate-950 border-slate-850' : 'bg-slate-50/50 border-purple-100/50'}`}>
              
              {/* Overlay guides showing to hover/scroll */}
              <div className="absolute bottom-3 right-5 pointer-events-none z-10 flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md border border-white/5 shadow-md">
                <MousePointerClick className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                <span className="text-[8px] sm:text-[9.5px] font-black uppercase text-pink-300 tracking-wider">
                  {lang === 'th' ? 'ชี้เมาส์ & คลิกที่แถบสไลด์ด้านขวา!' : 'Hover & hold-drag scrollbar!'}
                </span>
              </div>

              {/* Chat View */}
              {activePreviewType === 'chat' && (
                <div className="h-full overflow-y-auto pr-3 sandbox-scrollable-area flex flex-col gap-4 text-left">
                  <div className={`p-3.5 rounded-2xl max-w-[85%] self-start ${theme === 'dark' ? 'bg-slate-900' : 'bg-white shadow-3xs'} border border-transparent dark:border-white/5`}>
                    <div className="flex gap-1.5 items-center mb-1 text-[10px] font-black">
                      <span className="text-pink-500">🌸 Mini-Cake</span>
                      <span className="text-slate-450 dark:text-slate-600 font-normal">19:42</span>
                    </div>
                    <p className={`text-xs font-bold leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800'}`}>
                      {lang === 'th' ? 'สวัสดีค่ะ อยากบอกว่าสโครลบาร์พาสเทลชมพู-ม่วง น่ารักใจละลายยยมากก 🥺💕' : 'OMG, the pastel cotton candy scroll shadow is literally melt-my-heart beautiful! 🥺💕'}
                    </p>
                  </div>

                  <div className={`p-3.5 rounded-2xl max-w-[85%] self-end bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-md`}>
                    <div className="flex gap-1.5 items-center mb-1 text-[10px] font-black opacity-90 text-right justify-end">
                      <span>Evaluator Mod</span>
                      <span className="opacity-60 font-normal">19:43</span>
                    </div>
                    <p className="text-xs font-black leading-relaxed">
                      {lang === 'th' ? 'ยินยอมเลยครับ! ยิ่งนำเมาส์ไปชี้จะกลายเป็นคู่สี Sweet Pink & Juicy Violet สีสวยเด่นมากครับ!' : 'Agree completely! Hovering lights up Sweet Pink & Juicy Violet perfectly for high visibility!'}
                    </p>
                  </div>

                  <div className={`p-3.5 rounded-2xl max-w-[85%] self-start ${theme === 'dark' ? 'bg-slate-900' : 'bg-white shadow-3xs'} border border-transparent dark:border-white/5`}>
                    <div className="flex gap-1.5 items-center mb-1 text-[10px] font-black">
                      <span className="text-purple-400">🔮 Juicy-Glow</span>
                      <span className="text-slate-450 dark:text-slate-600 font-normal">19:44</span>
                    </div>
                    <p className={`text-xs font-bold leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800'}`}>
                      {lang === 'th' ? 'ใช่เลย! แล้วสไตล์ในโหมดกลางคืน (Dark Mode Candy Glow) ยิ่งดีมาก สะท้อนแสงนีออนพาสเทลอ่อน ๆ ถนอมสายตา สวยงามระดับเกมมิ่งเกียร์เลยค่ะ!' : 'Totally! And the dark mode style (Dark Mode Candy Glow) uses an eye-safe pastel neon shine which feels incredibly calming!'}
                    </p>
                  </div>

                  <div className={`p-3.5 rounded-2xl max-w-[85%] self-start ${theme === 'dark' ? 'bg-slate-900' : 'bg-white shadow-3xs'} border border-transparent dark:border-white/5`}>
                    <div className="flex gap-1.5 items-center mb-1 text-[10px] font-black">
                      <span className="text-pink-500">🐱 Candy-Cat</span>
                      <span className="text-slate-450 dark:text-slate-600 font-normal">19:45</span>
                    </div>
                    <p className={`text-xs font-bold leading-relaxed ${theme === 'dark' ? 'text-slate-300' : 'text-slate-800'}`}>
                      {lang === 'th' ? 'เมื่อกดคลิกแถบเลื่อน (active) มีการปรับสีวูบวาบเฉดแคนดี้เปล่งปลั่ง! ออกแบบได้มีระดับสุดยอด 🍭' : 'Plus when you actively click & drag, it flashes a dense glossy candy-neon shift! Truly masterclass design. 🍭'}
                    </p>
                  </div>

                  <div className={`p-3.5 rounded-2xl max-w-[85%] self-end bg-gradient-to-br from-pink-500 to-purple-600 text-white shadow-md`}>
                    <p className="text-xs font-black leading-relaxed">
                      {lang === 'th' ? 'เลื่อนดูแบบอื่น ๆ ด้านบนได้เลยนะครับ ทั้งกลอนพาสเทล โครงสร้างครูโรงเรียน และตัวโค้ด CSS สำหรับนำไปปรับแต่งในเว็บบล็อกส่วนตัว!' : 'Feel free to test scroll the general poem, schedule table, or check code export tabs above!'}
                    </p>
                  </div>
                </div>
              )}

              {/* Poem View */}
              {activePreviewType === 'poem' && (
                <div className="h-full overflow-y-auto pr-3 sandbox-scrollable-area flex flex-col gap-4 text-center items-center justify-start text-[14px] leading-relaxed font-sans italic text-purple-950 dark:text-pink-100">
                  <div className="py-2">
                    <Sparkles className="w-6 h-6 text-pink-400 mx-auto mb-2 animate-spin" style={{ animationDuration: '4s' }} />
                    <h4 className="font-black text-sm uppercase tracking-widest text-pink-500 not-italic">🌸 Pastel Dreams 🌸</h4>
                  </div>
                  <p className="opacity-95 font-medium">
                    {lang === 'th' ? 'ท่ามกลางฟองสบู่ละมุนหวาน' : 'In fields of sweet pastel loops,'}
                  </p>
                  <p className="opacity-95 font-medium">
                    {lang === 'th' ? 'ชมพูม่วงประสานระบายความฝัน' : 'Pink and purple vapors float on air,'}
                  </p>
                  <p className="opacity-95 font-medium">
                    {lang === 'th' ? 'แคนดี้สะท้อนประกายงามตาพลัน' : 'A neon candy lane of dreams so clear,'}
                  </p>
                  <p className="opacity-95 font-medium">
                    {lang === 'th' ? 'เลื่อนลื่นไหลผ่านคืนค่ำสราญใจ' : 'Soft gentle whispers scroll without a care.'}
                  </p>
                  <div className="w-16 h-[1px] bg-pink-300/30 my-2" />
                  <p className="opacity-95 font-medium">
                    {lang === 'th' ? 'เมื่อเมาส์ลาลอยไปเกยจับ' : 'And when you hover like a dream,'}
                  </p>
                  <p className="opacity-95 font-medium">
                    {lang === 'th' ? 'สว่างระยับ Sweet Pink เด่นเฉิดฉาย' : 'A vivid Sweet Pink gleam awakes,'}
                  </p>
                  <p className="opacity-95 font-medium">
                    {lang === 'th' ? 'Juicy Violet ร่วมเรืองระบาย' : 'Juicy Violet blends inside the stream,'}
                  </p>
                  <p className="opacity-95 font-medium">
                    {lang === 'th' ? 'แสนผ่อนคลายสายตาค่ำราตรี' : 'So easy on the eyes, for all our sakes.'}
                  </p>
                  <div className="py-4">
                    <Heart className="w-5 h-5 text-red-500 fill-red-500 mx-auto" />
                  </div>
                </div>
              )}

              {/* Teachers database View */}
              {activePreviewType === 'teachers' && (
                <div className="h-full overflow-y-auto pr-3 sandbox-scrollable-area text-left flex flex-col gap-3">
                  <h4 className={`text-[10px] font-black uppercase tracking-wider mb-1 flex items-center gap-1.5 ${theme === 'dark' ? 'text-white' : 'text-purple-950'}`}>
                    <Activity className="w-4 h-4 text-emerald-500" />
                    {lang === 'th' ? 'รายชื่อจำลองสถานะการสอนครูต่างชาติ' : 'Simulated Foreign Teachers Roster'}
                  </h4>

                  <div className="space-y-2">
                    {[
                      { name: 'Mr. Christopher Shu Tanwie', class: 'Grade 10/2', status: 'Excellent ⭐⭐⭐⭐⭐', time: 'Today 09:30 AM' },
                      { name: 'Mrs. Emily Parker Watson', class: 'Grade 8/1', status: 'Good ⭐⭐⭐⭐', time: 'Today 11:45 AM' },
                      { name: 'Mr. Jonathan Adams', class: 'Grade 11/4', status: 'Excellent ⭐⭐⭐⭐⭐', time: 'Yesterday 02:15 PM' },
                      { name: 'Miss Sophia Loren', class: 'Grade 7/2', status: 'Fair ⭐⭐⭐', time: 'Yesterday 01:00 PM' },
                      { name: 'Mr. Lee Dong-gun', class: 'Grade 12/1', status: 'Excellent ⭐⭐⭐⭐⭐', time: '2 days ago' },
                      { name: 'Madame Catherine Dubois', class: 'Grade 9/3', status: 'Good ⭐⭐⭐⭐', time: '3 days ago' },
                    ].map((teacher, idx) => (
                      <div 
                        key={idx}
                        className={`p-3 rounded-2xl border text-[11px] font-bold flex justify-between items-center transition-all ${
                          theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-purple-100/50 shadow-3xs'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className={`font-black truncate ${theme === 'dark' ? 'text-slate-200' : 'text-purple-950'}`}>{teacher.name}</p>
                          <p className={`text-[9.5px] mt-0.5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Class: <span className="text-pink-500">{teacher.class}</span></p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-emerald-500 font-extrabold text-[9.5px]">{teacher.status}</p>
                          <p className={`text-[8.5px] opacity-60 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>{teacher.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Code Export View */}
              {activePreviewType === 'css' && (
                <div className="h-full text-left relative flex flex-col">
                  <div className="flex-1 overflow-auto sandbox-scrollable-area font-mono text-[9.5px]/relaxed p-3 bg-slate-900 dark:bg-slate-950 rounded-xl text-pink-300 border border-transparent dark:border-white/5 pr-4 select-all">
                    <pre className="whitespace-pre-wrap text-slate-350">{generatedCSSCode}</pre>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Actions Row to export / copy */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
              <div className="flex items-center gap-2 text-left">
                <Lightbulb className="w-5 h-5 text-yellow-400 shrink-0" />
                <span className={`text-[10px] sm:text-[11px] font-bold leading-tight ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
                  {lang === 'th' ? '💡 แนะนำให้เปิด "ใช้งานทั้งระบบ" ด้านบนขวา เพื่อมอบฟีลแคนดี้ที่สมบูรณ์แบบ!' : '💡 Switch on "Apply to entire app" above to enjoy the unified style project-wide!'}
                </span>
              </div>

              <div className="flex gap-2.5 shrink-0">
                {/* Reset button */}
                <button
                  onClick={() => {
                    setWidth(10);
                    setRadius('9999px');
                    setGlowEnabled(true);
                    setGlowIntensity(isDark ? 0.85 : 0.5);
                    setActivePreset('candy');
                  }}
                  className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 text-[11px] font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 ${
                    theme === 'dark' 
                      ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white' 
                      : 'bg-slate-100 border-slate-205 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={lang === 'th' ? 'คืนค่าพรีเซ็ตหลัก' : 'Reset preset defaults'}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{lang === 'th' ? 'รีเซ็ต' : 'Reset'}</span>
                </button>

                {/* Copy button */}
                <button
                  onClick={handleCopyCode}
                  className="px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-black text-[11px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg active:scale-95 hover:scale-105 transition-all"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-pink-200 animate-bounce" />
                      <span>{lang === 'th' ? 'คัดลอกแล้ว!' : 'Copied CSS!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{lang === 'th' ? 'คัดลอกโค้ด CSS' : 'Copy CSS Customizer'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
