import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Trash2, Sparkles, User, HelpCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { getAuthHeaders } from '../lib/firebase';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

interface AIChatbotProps {
  theme: 'light' | 'dark';
  lang: 'th' | 'en';
  teacherData?: any;
  studentData?: any;
  scheduleData?: any;
  news?: any[];
}

export default function AIChatbot({ theme, lang, teacherData, studentData, scheduleData, news }: AIChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new messages using primitive values in dependencies
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, loading]);

  // Suggested questions based on role and actual data
  const suggestedQuestions = lang === 'th' ? [
    { text: '📋 ตรวจสอบระบบงานและคะแนน', query: 'ช่วยวิเคราะห์สรุปความพึงพอใจและจุดที่ควรปรับปรุงของผู้สอนชาวต่างชาติจากข้อมูลผลประเมินในระบบขณะนี้ให้หน่อยค่ะ' },
    { text: '📊 รายงานสรุปคะแนนการสอนของฉัน', query: 'ช่วยนำข้อมูลประเมินและสถิติของห้องเรียนที่เพิ่งสะสมล่าสุดวิเคราะห์ให้เห็นจุดที่ควรปรับปรุงด่วนที่สุด' },
    { text: '📅 ขอเช็กตารางและตารางสอนที่มีอยู่', query: 'ช่วยวิเคราะห์ตารางกิจกรรมการเรียนรู้แบบสั้นๆ กระชับตามตารางสอนที่ได้รับมอบหมาย' },
    { text: '💡 ขอแนวทางจัดการห้องเรียนให้ตื่นตัว', query: 'ต้องการเทคนิคจัดการห้องเรียนไทย 5 วิธีที่น่าสนใจในการดึงผู้เรียนให้ตื่นเต้นและมีส่วนร่วม' },
  ] : [
    { text: '📋 Check Monitoring & Feedback Data', query: 'Please analyze and summarize the feedback and improvement points for foreign teachers from current student evaluations.' },
    { text: '📊 Analyze my teaching metrics', query: 'Analyze my student evaluation stats and qualitative feedback highlight of points to improve.' },
    { text: '📅 Check my schedules summary', query: 'Check my schedule and give me a sweet overview of my teaching table.' },
    { text: '💡 Tips to engage passive classrooms', query: 'Give me 5 actionable, fun tips for engaging Thai students in bilingual classes.' },
  ];

  // Load welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeText = lang === 'th' 
        ? `สวัสดีค่ะ! ยินดีต้อนรับสู่ **WorkLoop AI** 🪄✨ 

ฉันคือผู้ช่วยสอนอัจฉริยะวิเคราะห์ตารางสอน จิตวิทยาจัดการเรียน และประมวลผลสถิติจริงจากระบบค่ะ มีสิ่งใดให้วิเคราะห์สรุปข้อมูลหรือแนะนำเพิ่มเติม สอบถามได้เลยนะคะ!`
        : `Hello! Welcome to **WorkLoop AI** 🪄✨

I am here to help you analyze schedules, student evaluations, and school teaching metrics. How can I support your classroom success today?`;

      setMessages([
        {
          id: 'welcome',
          role: 'model',
          text: welcomeText,
          timestamp: new Date(),
        }
      ]);
    }
  }, [lang, messages.length]);

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMsgId = 'msg-' + Date.now();
    const newUserMsg: Message = {
      id: userMsgId,
      role: 'user',
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInputMsg('');
    setLoading(true);

    try {
      // Map message history to Gemini contents structure
      const historyPayload = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      
      // Add current message
      historyPayload.push({
        role: 'user',
        parts: [{ text: textToSend }]
      });

      // Prepare context structure to feed the AI chatbot with real school data
      const contextData = {
        teacherEvaluation: teacherData || null,
        studentEvaluation: studentData || null,
        schedule: scheduleData || null,
        newsAnnouncements: news || null,
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          history: historyPayload,
          dataContext: contextData,
          lang: lang,
        }),
      });

      if (!response.ok) {
        throw new Error('Chatbot response error');
      }

      const responseData = await response.json();
      const botReply = responseData.reply || (lang === 'th' ? 'ขออภัยค่ะ ระบบขัดข้องเกี่ยวกับการดึงสมองกลอัจฉริยะ กรุณาลองใหม่อีกครั้งนะคะ' : 'Apologies, I encountered an issue retrieving my central neural network. Please try again!');
      
      const botMsgId = 'msg-bot-' + Date.now();
      const newBotMsg: Message = {
        id: botMsgId,
        role: 'model',
        text: botReply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, newBotMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsgId = 'msg-err-' + Date.now();
      setMessages((prev) => [
        ...prev,
        {
          id: errorMsgId,
          role: 'model',
          text: lang === 'th' 
            ? '❌ เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์ AI กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือลองอีกครั้งภายหลังค่ะ' 
            : '❌ A network connection error occured while contacting the AI node. Please verify your connection and try again.',
          timestamp: new Date(),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm(lang === 'th' ? 'ต้องการล้างประวัติการสนทนาทั้งหมดหรือไม่?' : 'Are you sure you want to clear the conversation history?')) {
      setMessages([]);
    }
  };

  return (
    <div className={`flex flex-col h-[calc(100vh-180px)] sm:h-[650px] w-full max-w-4xl mx-auto rounded-[2rem] border overflow-hidden shadow-2xl transition-all duration-300 ${
      theme === 'dark' 
        ? 'bg-[#120f26]/90 border-purple-950/40 shadow-purple-950/20 text-slate-100' 
        : 'bg-white/85 border-purple-100/50 shadow-purple-100/30 text-purple-950'
    }`} id="ai-chatbot-root">
      {/* Top Header Panel */}
      <div className={`p-4 sm:p-5 flex items-center justify-between border-b shrink-0 ${
        theme === 'dark' 
          ? 'bg-purple-950/40 border-slate-900/30' 
          : 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-100/20'
      }`} id="ai-chatbot-header">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-500 text-white shadow-md animate-pulse">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm tracking-tight flex items-center gap-1.5">
              <span>{lang === 'th' ? 'ผู้ช่วยอัจฉริยะ WorkLoop AI' : 'WorkLoop AI Companion'}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[8px] font-bold bg-pink-500 text-white uppercase tracking-wider">
                Stable
              </span>
            </h3>
            <p className="text-[10px] opacity-70">
              {lang === 'th' ? 'วิเคราะห์ตาราง สอน และจิตวิทยาจัดการชั้นเรียน' : 'Local insights & academic advisory model'}
            </p>
          </div>
        </div>

        <button 
          onClick={handleClearHistory}
          disabled={messages.length <= 1}
          className={`p-2 rounded-xl transition-all hover:scale-105 active:scale-95 ${
            theme === 'dark' 
              ? 'hover:bg-purple-900/40 text-purple-400 hover:text-red-400' 
              : 'hover:bg-purple-100 text-purple-600 hover:text-red-500'
          } disabled:opacity-30 disabled:pointer-events-none`}
          title={lang === 'th' ? 'ล้างการแชท' : 'Clear discussion'}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" id="ai-chatbot-messages-container">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 max-w-[85%] ${
              msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
            }`}
          >
            {/* Avatar icon */}
            <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs font-black select-none ${
              msg.role === 'user' 
                ? 'bg-pink-500 text-white' 
                : (theme === 'dark' ? 'bg-[#211a47] text-purple-300 border border-purple-800/40' : 'bg-purple-100 text-purple-800 border border-purple-200/50')
            }`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4 text-purple-400" />}
            </div>

            {/* Bubble contents */}
            <div className="flex flex-col">
              <div className={`px-4 py-3 rounded-[1.3rem] text-sm leading-relaxed shadow-xs ${
                msg.role === 'user'
                  ? 'bg-pink-500 text-white rounded-tr-none text-right'
                  : (theme === 'dark' 
                      ? 'bg-[#1b153b] text-slate-100 rounded-tl-none border border-purple-950/20' 
                      : 'bg-[#faf7ff] text-purple-950 rounded-tl-none border border-purple-100/40')
              }`}>
                <div className="markdown-body prose dark:prose-invert max-w-none text-left prose-sm leading-relaxed bullet-list text-[13px] sm:text-sm">
                  <Markdown>{msg.text}</Markdown>
                </div>
              </div>
              <span className={`text-[9px] mt-1 opacity-50 px-1 ${
                msg.role === 'user' ? 'text-right' : 'text-left'
              }`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2.5 max-w-[85%] mr-auto">
            <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-xs ${
              theme === 'dark' ? 'bg-[#211a47] text-purple-300' : 'bg-purple-100 text-purple-800'
            }`}>
              <Bot className="w-4 h-4 animate-bounce text-purple-500" />
            </div>
            <div className="flex flex-col">
              <div className={`px-4 py-3.5 rounded-[1.3rem] rounded-tl-none shadow-xs flex items-center gap-2 ${
                theme === 'dark' ? 'bg-[#1b153b] border border-purple-950/20' : 'bg-purple-50 border border-purple-100'
              }`}>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-500" />
                <span className="text-xs opacity-80 font-black tracking-tight animate-pulse text-pink-500">
                  {lang === 'th' ? 'กริ่งๆ กำลังวิเคราะห์สูตรความรอบรู้อยู่ค่ะ...' : 'AI brain cells processing...'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Suggested Quick Queries Banner */}
      <div className={`p-3 border-t shrink-0 flex overflow-x-auto gap-2 scrollbar-none scroll-smooth ${
        theme === 'dark' ? 'bg-purple-950/15 border-slate-900/30' : 'bg-purple-50/20 border-purple-50'
      }`} id="ai-chatbot-suggestions">
        {suggestedQuestions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(q.query)}
            disabled={loading}
            className={`text-[10px] font-black shrink-0 px-3 py-1.5 rounded-full border flex items-center gap-1.5 transition-all active:scale-95 duration-200 ${
              theme === 'dark' 
                ? 'bg-[#181238] hover:bg-[#221a4f] border-purple-900/50 text-purple-300 disabled:opacity-40' 
                : 'bg-white hover:bg-purple-50/50 border-purple-200/50 text-purple-800 disabled:opacity-40 shadow-xs'
            }`}
          >
            <Sparkles className="w-3 h-3 text-pink-500" />
            <span>{q.text}</span>
          </button>
        ))}
      </div>

      {/* Input panel */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputMsg);
        }}
        className={`p-3 border-t flex gap-2 items-center shrink-0 ${
          theme === 'dark' ? 'bg-[#110d29] border-slate-900/30' : 'bg-white border-purple-100/40'
        }`}
        id="ai-chatbot-input-form"
      >
        <input
          type="text"
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          placeholder={
            lang === 'th' 
              ? 'ถามอะไรเกี่ยวกับงานสอน โรงเรียน หรือตาราง...' 
              : 'Ask me anything about class, schedules...'
          }
          className={`flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-2xl outline-none border transition-all ${
            theme === 'dark'
              ? 'bg-[#19143d] border-purple-950/40 focus:border-pink-500 text-white placeholder-slate-500'
              : 'bg-purple-50/50 border-purple-150 focus:border-purple-500 text-purple-950 placeholder-purple-400'
          }`}
          disabled={loading}
          maxLength={1200}
        />
        <button
          type="submit"
          disabled={!inputMsg.trim() || loading}
          className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:brightness-110 active:scale-95 transition-all text-white shadow-md disabled:brightness-75 disabled:cursor-not-allowed disabled:pointer-events-none"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
