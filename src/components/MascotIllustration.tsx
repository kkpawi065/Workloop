import React from 'react';
import { motion } from 'motion/react';
// @ts-ignore
import mascotImage from '../mascot.jpg';

export default function MascotIllustration({ className, simple = false }: { className?: string; simple?: boolean }) {
  if (simple) {
    return (
      <div className={`relative w-full h-full overflow-hidden ${className}`}>
        <img 
          src={mascotImage} 
          alt="Mascot" 
          className="w-full h-full object-cover select-none" 
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // Removed paper sheets and crumpled papers per user request
  const paperSheets: any[] = [];
  const crumpledPapers: any[] = [];

  return (
    <div className={`relative w-full h-full flex items-center justify-center select-none overflow-hidden bg-slate-950 transition-colors duration-500 ${className}`}>
      
      {/* 1. Behind-Mascot Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Soft background ambient lights */}
        <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-pink-300/10 dark:bg-pink-500/5 blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-purple-300/10 dark:bg-purple-500/5 blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* 2. Container matching the image aspect ratio so overlays align perfectly */}
      <div 
        className="relative z-10 select-none flex-shrink-0 flex items-center justify-center overflow-hidden"
        style={{
          width: 'max(50vw, 100vh)',
          height: 'max(50vw, 100vh)',
        }}
      >
        <img 
          src={mascotImage} 
          alt="Mascot Portrait" 
          className="absolute inset-0 w-full h-full object-cover select-none"
          referrerPolicy="no-referrer"
        />

        {/* =======================================================
            3. INTELLIGENT ANIMATED EYELIDS (FOR BLINKING)
            ======================================================= */}
        
        {/* LEFT EYE BLINK OVERLAY */}
        <div 
          className="absolute pointer-events-none z-10"
          style={{
            top: '35.3%',
            left: '36.2%',
            width: '12%',
            height: '9%',
          }}
        >
          <motion.div
            animate={{ 
              scaleY: [0, 0, 1, 0, 0], // Fast blink sequence
              originY: 0
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              times: [0, 0.88, 0.90, 0.92, 1], // Stays open 3.5s, blinks in 150ms
              ease: "easeInOut"
            }}
            className="w-full h-full flex flex-col justify-end"
          >
            {/* Eyelid body: matches her skin tone seamlessly */}
            <div className="w-full h-full rounded-b-full bg-[#fde3d5] dark:bg-[#fbdacd] border-b-2 border-[#3c2522] relative">
              {/* Eyelash fringe details */}
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#311f1c]" />
              <div className="absolute bottom-[-1px] left-[10%] w-[3px] h-[3px] bg-[#311f1c] rounded-full rotate-45" />
              <div className="absolute bottom-[-1px] right-[10%] w-[3px] h-[3px] bg-[#311f1c] rounded-full -rotate-45" />
            </div>
          </motion.div>
        </div>

        {/* RIGHT EYE BLINK OVERLAY */}
        <div 
          className="absolute pointer-events-none z-10"
          style={{
            top: '35.3%',
            left: '52.0%',
            width: '12%',
            height: '9%',
          }}
        >
          <motion.div
            animate={{ 
              scaleY: [0, 0, 1, 0, 0], 
              originY: 0
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              times: [0, 0.88, 0.90, 0.92, 1],
              ease: "easeInOut"
            }}
            className="w-full h-full flex flex-col justify-end"
          >
            {/* Eyelid body: matches her skin tone seamlessly */}
            <div className="w-full h-full rounded-b-full bg-[#fde3d5] dark:bg-[#fbdacd] border-b-2 border-[#3c2522] relative">
              {/* Eyelash fringe details */}
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#311f1c]" />
              <div className="absolute bottom-[-1px] left-[10%] w-[3px] h-[3px] bg-[#311f1c] rounded-full rotate-45" />
              <div className="absolute bottom-[-1px] right-[10%] w-[3px] h-[3px] bg-[#311f1c] rounded-full -rotate-45" />
            </div>
          </motion.div>
        </div>


      </div>

      {/* 4. Foreground Overlay Container (Empty as paper decorations were removed) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      </div>
    </div>
  );
}
