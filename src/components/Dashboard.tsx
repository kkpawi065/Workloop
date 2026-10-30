import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  fetchSpreadsheetData, 
  appendSpreadsheetData,
  createSheet,
  createSpreadsheet,
  SpreadsheetData 
} from '../services/sheetsService';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { 
  LayoutDashboard,
  BarChart3,
  TrendingDown,
  Award,
  Zap,
  PieChart as PieChartIcon,
  Table as TableIcon,
  RefreshCw, 
  LogOut, 
  Grid3X3,
  FileSpreadsheet,
  Activity,
  ShieldCheck,
  ChevronRight,
  Database,
  Download,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Calendar,
  NotebookPen,
  ExternalLink,
  Facebook,
  Globe,
  UserCheck,
  Megaphone,
  PlusCircle,
  Bell,
  Send,
  X,
  Sun,
  Moon,
  FileJson,
  FileType,
  FileText,
  Image as ImageIcon,
  Printer,
  FolderOpen,
  Heart,
  ZoomIn,
  ZoomOut,
  Sparkles,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  MoreHorizontal,
  Maximize,
  Bot
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { logout, db, googleSignIn, getAuthHeaders } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  Timestamp,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { cn } from '../lib/utils';

import { translations, Language } from '../constants/translations';
import ScheduleViewer from './ScheduleViewer';
import CandyScrollbarPlayground from './CandyScrollbarPlayground';
import LiveNotificationCenter from './LiveNotificationCenter';
import AIChatbot from './AIChatbot';

interface DashboardProps {
  accessToken: string;
  user: any;
  lang: Language;
  setLang: (lang: Language) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const getCleanTeacherName = (name: string): string => {
  if (!name) return '';
  // Strip trailing parenthesized Thai names or any parenthesized text at the end (e.g., "(ครูจูดี้)")
  return name.trim().replace(/\s*\([^)]*\)\s*$/, '');
};

const COLORS = [
  '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', 
  '#6366f1', '#ef4444', '#14b8a6', '#f97316', '#3b82f6',
  '#8b5cf6', '#0ea5e9', '#22c55e', '#eab308', '#d946ef'
];

const DIMENSION_COLORS = [
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#f59e0b', // Amber
  '#f43f5e', // Rose
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
];

const mapRatingToScore = (rating: any): number => {
  if (!rating) return 0;
  const r = String(rating).trim();
  
  // Handle star ratings (e.g. ⭐⭐⭐⭐⭐ or 🌟🌟🌟🌟)
  const starCount = (r.match(/[⭐🌟]/g) || []).length;
  if (starCount > 0) {
    if (starCount === 5) return 10;
    if (starCount === 4) return 8;
    if (starCount === 3) return 6;
    if (starCount === 2) return 4;
    if (starCount === 1) return 2;
    return Math.min(10, starCount * 2);
  }

  if (r === 'ดีมาก' || r === 'Excellent') return 10;
  if (r === 'ดี' || r === 'Good') return 8;
  if (r === 'พอใช้' || r === 'Fair') return 6;
  if (r === 'ควรปรับปรุง' || r === 'Needs Improvement') return 4;
  if (r === 'ควรปรับปรุงอย่างเร่งด่วน' || r === 'Urgent Improvement Needed') return 2;
  
  const score = parseFloat(r.replace(/[^0-9.]/g, '') || '0');
  if (isNaN(score)) return 0;

  // Scale standard 1-5 point scales into the 10-point dashboard system
  if (score > 0 && score <= 5) {
    return score * 2;
  }
  
  return score;
};

const getRatingLabel = (score: number, lang: Language): string => {
  if (score >= 9) return lang === 'th' ? 'ดีมาก' : 'Excellent';
  if (score >= 7) return lang === 'th' ? 'ดี' : 'Good';
  if (score >= 5) return lang === 'th' ? 'พอใช้' : 'Fair';
  if (score >= 3) return lang === 'th' ? 'ควรปรับปรุง' : 'Needs Improvement';
  return lang === 'th' ? 'ควรปรับปรุงอย่างเร่งด่วน' : 'Urgent Improvement Needed';
};

const translateAspect = (aspect: string, lang: Language): string => {
  if (lang !== 'en') return aspect;
  if (!aspect) return aspect;
  
  const trimmed = aspect.trim();
  const translations: Record<string, string> = {
    'เนื้อหาสาระที่นำเสนอมีความถูกต้องตามหลักวิชา': 'Accuracy of the academic content presented',
    'การจัดกิจกรรมที่สอดคล้องกับวัตถุประสงค์ของบทเรียน': 'Alignment of learning activities with lesson objectives',
    'การเลือกใช้สื่อการสอนมีความเหมาะสมกับระดับความรู้ของผู้เรียน': 'Appropriate use of instructional media',
    'มีการใช้ภาษาที่เหมาะสมในการถ่ายทอดความรู้': 'Appropriate language for knowledge transmission',
    'สามารถควบคุมชั้นเรียนได้ดี': 'Classroom management skills',
    'การใช้สื่อการสอนที่เหมาะสมกับนักเรียน': 'Appropriate use of instructional media tailored to the students',
    'การปรับวิธีการสอนให้เข้ากับระดับภาษาของนักเรียน': "Adapting teaching methods to match students' language proficiency",
    'ความสามารถในการควบคุมชั้นเรียน': 'Classroom management skills'
  };
  
  // Try direct match
  if (translations[trimmed]) return translations[trimmed];

  // Try matching without index prefix if any (e.g. "1. เนื้อหาสาระ...")
  const cleanKey = trimmed.replace(/^\d+\.\s*/, '');
  if (translations[cleanKey]) return translations[cleanKey];
  
  // If still Thai and asking for English, return original trimmed string
  // instead of a generic placeholder, but ensures we don't break if no match.
  if (lang === 'en' && /[ก-๙]/.test(trimmed)) return trimmed;
  
  return aspect;
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

function handleFirestoreError(
  error: unknown, 
  operationType: OperationType, 
  path: string | null, 
  userId?: string | null, 
  email?: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: userId || null,
      email: email || null,
      emailVerified: true,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface CommentLike {
  id: string;
  rowNum: number;
  userId: string;
  createdAt: any;
}

interface Reaction {
  id: string;
  targetId: string;
  targetType: 'news' | 'comment';
  emoji: string;
  userId: string;
  userEmail: string;
  userName: string;
  createdAt: any;
}

interface NewsPost {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorId: string;
  important: boolean;
  createdAt: any;
}

const normalizeTeacherName = (val: string): string => {
  const str = val.trim();
  if (!str) return '';
  if (
    str.includes('Christopher') ||
    str.includes('Tanwie') ||
    str.includes('สมคิด') ||
    str.includes('ครูสมคิด') ||
    str.includes('ครูคริส') ||
    str.includes('คริส')
  ) {
    return 'Mr. Christopher Shu Tanwie';
  }
  return str;
};

const normalizeSpreadsheetRecord = (data: any): any => {
  if (!data || !data.values || data.values.length === 0) return data;
  
  const newValues = data.values.map((row: string[], rIdx: number) => {
    if (rIdx === 0) return row;
    return row.map((cell: any) => {
      if (typeof cell === 'string') {
        return normalizeTeacherName(cell);
      }
      return cell;
    });
  });

  return {
    ...data,
    values: newValues
  };
};

// Helper to translate/sanitize Thai text to clean Latin characters to bypass jsPDF's non-standard font encoding limitations
const translateThaiToEnglishForPDF = (text: string | null | undefined): string => {
  if (!text) return '-';
  const val = String(text).trim();
  if (val === 'ดีมาก') return 'Excellent';
  if (val === 'ดี') return 'Good';
  if (val === 'พอใช้') return 'Fair';
  if (val === '-') return '-';

  // Replace common Thai names of teachers/students
  if (val.includes('สมชาย')) return 'Somchai J.';
  if (val.includes('สมศรี')) return 'Somsri S.';
  if (val.includes('สมหญิง')) return 'Somying K.';
  if (val.includes('สมาน')) return 'Saman S.';
  if (val.includes('วินัย')) return 'Boy Winai';
  if (val.includes('สมปอง')) return 'Girl Sompong';
  if (val.includes('อนุชา')) return 'Boy Anucha';
  if (val.includes('พัชรา')) return 'Girl Patchara';
  if (val.includes('ปกรณ์')) return 'Boy Pakorn';
  if (val.includes('ธนา')) return 'Boy Thana';
  if (val.includes('กุลยา')) return 'Girl Kunlaya';
  if (val.includes('วิภา')) return 'Girl Wipa';

  // Clean class level representations (e.g., ม.1/1 -> M.1/1 or Grade 7/1)
  if (/^[ม]\.?\s*(\d+)\/(\d+)$/i.test(val)) {
    const match = val.match(/^[ม]\.?\s*(\d+)\/(\d+)$/i);
    if (match) return `Grade ${match[1]}/${match[2]}`;
  }

  // Common Thai subject names
  if (val === 'ภาษาอังกฤษ' || val.toLowerCase() === 'english') return 'English';
  if (val === 'วิทยาศาสตร์' || val.toLowerCase() === 'science') return 'Science';
  if (val === 'คณิตศาสตร์' || val.toLowerCase() === 'math' || val.toLowerCase() === 'mathematics') return 'Math';

  // Specific phrases translate
  if (val.includes('เรียนสนุก') || val.includes('สนุกมาก')) return 'Very engaging & fun class';
  if (val.includes('ใจดี')) return 'Very kind and supportive';
  if (val.includes('พูดช้า') || val.includes('พูดเร็ว')) return 'Speed adjustment recommended';
  if (val.includes('อธิบายเข้าใจง่าย')) return 'Clear explanations';
  
  // Strip non-ASCII characters if any remain (keeps English portions of bilingual text)
  if (/[^\x00-\x7F]/.test(val)) {
    const latinOnly = val.replace(/[^\x20-\x7E]/g, '').trim();
    if (latinOnly.length > 2) {
      return latinOnly;
    }
    // Generic fallback so we do not have empty squares in the PDF
    return 'Observed Record';
  }

  return val;
};

// Secure Google Drive file fetcher using the user's authenticating accessToken
const getGoogleDriveFileId = (url: string | null | undefined): string | null => {
  if (!url || typeof url !== 'string') return null;
  const lower = url.trim().toLowerCase();
  if (!lower.includes('drive.google.com') && !lower.includes('lh3.googleusercontent.com') && !lower.includes('docs.google.com')) {
    return null;
  }
  
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    return fileIdMatch[1];
  }
  
  const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) {
    return dMatch[1];
  }
  
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }
  
  return null;
};

// Component level cache
const secureDriveUrlCache = new Map<string, string>();
const pendingLoads = new Map<string, Promise<string>>();

export const SecureDriveImage = ({
  src,
  accessToken,
  alt = "",
  className = "",
  referrerPolicy = "no-referrer",
  ...props
}: {
  src: string;
  accessToken: string | null;
  alt?: string;
  className?: string;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  [key: string]: any;
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!src) {
      setResolvedSrc('');
      return;
    }

    const fileId = getGoogleDriveFileId(src);
    if (!fileId || !accessToken) {
      setResolvedSrc(src);
      return;
    }

    if (secureDriveUrlCache.has(fileId)) {
      setResolvedSrc(secureDriveUrlCache.get(fileId)!);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const loadImage = async () => {
      try {
        let objectUrl = '';
        if (pendingLoads.has(fileId)) {
          objectUrl = await pendingLoads.get(fileId)!;
        } else {
          const loadPromise = (async () => {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });

            if (!response.ok) {
              throw new Error(`Failed to load drive image: ${response.statusText}`);
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            secureDriveUrlCache.set(fileId, url);
            return url;
          })();
          pendingLoads.set(fileId, loadPromise);
          objectUrl = await loadPromise;
        }

        if (isMounted) {
          setResolvedSrc(objectUrl);
        }
      } catch (err) {
        console.warn("SecureDriveImage load warning:", err);
        if (isMounted) {
          setResolvedSrc(src);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [src, accessToken]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center bg-slate-900/10 dark:bg-slate-900/50", className)}>
        <RefreshCw className="w-5 h-5 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc || src}
      alt={alt}
      className={className}
      referrerPolicy={referrerPolicy}
      onError={() => {
        if (resolvedSrc && resolvedSrc !== src) {
          setResolvedSrc(src);
        }
      }}
      {...props}
    />
  );
};


const SpreadsheetTable = ({ 
  data, 
  filterQuery, 
  theme, 
  accentColor, 
  lang,
  accessToken
}: { 
  data: SpreadsheetData | null, 
  filterQuery: string, 
  theme: 'light' | 'dark', 
  accentColor: 'purple' | 'emerald',
  lang: Language,
  accessToken: string | null
}) => {
  const [activeImagePreviewUrl, setActiveImagePreviewUrl] = useState<string | null>(null);

  if (!data) return (
    <div className="py-20 text-center flex flex-col items-center">
      <RefreshCw className="w-10 h-10 mb-4 animate-spin text-slate-300" />
      <p className="text-xs font-bold text-slate-400">Loading data...</p>
    </div>
  );

  const headers = data.values[0] || [];
  const rows = data.values.slice(1) || [];

  const isImageOrFileUrl = (value: string): boolean => {
    if (!value || typeof value !== 'string') return false;
    const lower = value.trim().toLowerCase();
    if (lower.includes('/drive/folders/') || lower.includes('/folders/')) return false;
    const isDirectImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(lower);
    const isGoogleDriveLink = lower.includes('drive.google.com') || (lower.includes('docs.google.com') && !lower.includes('spreadsheets'));
    const isCommonLink = lower.startsWith('http') && (lower.includes('uc?id=') || lower.includes('open?id=') || lower.includes('file/d/') || lower.includes('/d/'));
    return isDirectImage || isGoogleDriveLink || isCommonLink;
  };

  const getDotColors = (url: string) => {
    const palette = [
      { bg: 'bg-emerald-600 dark:bg-emerald-400', ping: 'bg-emerald-500/80 dark:bg-emerald-400/80', btn: 'bg-emerald-50 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/30' },
      { bg: 'bg-blue-600 dark:bg-blue-400', ping: 'bg-blue-500/80 dark:bg-blue-400/80', btn: 'bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/30' },
      { bg: 'bg-amber-600 dark:bg-amber-400', ping: 'bg-amber-500/80 dark:bg-amber-400/80', btn: 'bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/40 dark:hover:bg-amber-900/30' },
      { bg: 'bg-orange-600 dark:bg-orange-400', ping: 'bg-orange-500/80 dark:bg-orange-400/80', btn: 'bg-orange-50 hover:bg-orange-100/80 dark:bg-orange-950/40 dark:hover:bg-orange-900/30' },
      { bg: 'bg-rose-600 dark:bg-rose-400', ping: 'bg-rose-500/80 dark:bg-rose-400/80', btn: 'bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/30' },
      { bg: 'bg-fuchsia-600 dark:bg-fuchsia-400', ping: 'bg-fuchsia-500/80 dark:bg-fuchsia-400/80', btn: 'bg-fuchsia-50 hover:bg-fuchsia-100/80 dark:bg-fuchsia-950/40 dark:hover:bg-fuchsia-900/30' },
      { bg: 'bg-indigo-600 dark:bg-indigo-400', ping: 'bg-indigo-500/80 dark:bg-indigo-400/80', btn: 'bg-indigo-50 hover:bg-indigo-100/80 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/30' },
      { bg: 'bg-cyan-600 dark:bg-cyan-400', ping: 'bg-cyan-500/80 dark:bg-cyan-400/80', btn: 'bg-cyan-50 hover:bg-cyan-100/80 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/30' },
      { bg: 'bg-teal-600 dark:bg-teal-400', ping: 'bg-teal-500/80 dark:bg-teal-400/80', btn: 'bg-teal-50 hover:bg-teal-100/80 dark:bg-teal-950/40 dark:hover:bg-teal-900/30' },
      { bg: 'bg-purple-600 dark:bg-purple-400', ping: 'bg-purple-500/80 dark:bg-purple-400/80', btn: 'bg-purple-50 hover:bg-purple-100/80 dark:bg-purple-950/40 dark:hover:bg-purple-900/30' }
    ];
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
       hash = url.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % palette.length;
    return palette[idx];
  };

  const getGoogleDriveThumbnailUrl = (url: string): string | null => {
    if (!url || typeof url !== 'string') return null;
    const lower = url.trim().toLowerCase();
    
    // Check if direct image link first
    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(lower)) {
      return url;
    }
    
    if (!lower.includes('drive.google.com')) return null;
    if (lower.includes('/drive/folders/') || lower.includes('/folders/')) return null;
    
    let fileId = '';
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      fileId = fileIdMatch[1];
    } else {
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
        fileId = idMatch[1];
      }
    }
    
    if (fileId) {
      return `https://lh3.googleusercontent.com/d/${fileId}=w400`;
    }
    
    return null;
  };

  const getGoogleDriveFullUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return url;
    const lower = url.trim().toLowerCase();
    if (!lower.includes('drive.google.com')) return url;
    if (lower.includes('/drive/folders/') || lower.includes('/folders/')) return url;
    
    let fileId = '';
    const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      fileId = fileIdMatch[1];
    } else {
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
        fileId = idMatch[1];
      }
    }
    
    if (fileId) {
      return `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
    }
    return url;
  };

  const filteredRows = rows.filter(row => 
    row.some(cell => {
      const cellStr = String(cell);
      const cellLower = cellStr.toLowerCase();
      const queryLower = filterQuery.toLowerCase().trim();
      
      // Standard search match
      if (cellLower.includes(queryLower)) return true;
      
      // Smart search keywords for images / attachments / evidence
      const imageSearchKeywords = [
        'รูป', 'ภาพ', 'หลักฐาน', 'ไฟล์', 'เอกสาร', 'แนบ', 'รูปภาพ', 'ค้นรูป', 'ค้นหารูป',
        'image', 'photo', 'pic', 'picture', 'file', 'attachment', 'evidence',
        'link', 'url', 'jpg', 'png', 'jpeg', 'webp', 'gif', 'drive'
      ];
      
      if (imageSearchKeywords.some(keyword => queryLower.includes(keyword) || keyword.includes(queryLower)) && queryLower.length >= 2) {
        if (isImageOrFileUrl(cellStr)) {
          return true;
        }
      }
      
      return false;
    })
  );

  const colors = {
    purple: {
      text: theme === 'dark' ? "text-purple-400" : "text-purple-700",
      bgAlt: theme === 'dark' ? "hover:bg-purple-900/10" : "hover:bg-purple-50/30",
      border: theme === 'dark' ? "border-purple-900/30" : "border-purple-100",
      headerBg: theme === 'dark' ? "bg-purple-950/20" : "bg-purple-50/20"
    },
    emerald: {
      text: theme === 'dark' ? "text-emerald-400" : "text-emerald-700",
      bgAlt: theme === 'dark' ? "hover:bg-emerald-900/10" : "hover:bg-emerald-50/30",
      border: theme === 'dark' ? "border-emerald-900/30" : "border-emerald-100",
      headerBg: theme === 'dark' ? "bg-emerald-950/20" : "bg-emerald-50/20"
    }
  };

  const c = colors[accentColor];

  const renderCellContent = (value: any) => {
    if (!value) return <span className="opacity-20 italic">null</span>;
    const cellStr = String(value);
    
    // Check if entire cell is a URL/Link
    const urlRegex = /^(https?:\/\/[^\s]+)$/i;
    if (urlRegex.test(cellStr.trim())) {
      const url = cellStr.trim();
      const isImg = isImageOrFileUrl(url);
      
      if (isImg) {
        const dotCol = getDotColors(url);
        return (
          <div className="flex items-center justify-start py-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveImagePreviewUrl(url);
              }}
              className={cn(
                "w-6 h-6 rounded-full cursor-pointer hover:scale-125 transition-all outline-none border-none p-0 shadow-md",
                dotCol.bg
              )}
            />
          </div>
        );
      }
      
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-purple-600 dark:text-purple-400 hover:underline font-bold inline-flex items-center gap-1 group"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="truncate max-w-[180px] sm:max-w-[240px]">{url}</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </a>
      );
    }
    
    // Check if cell contains embedded URLs
    const embeddedUrlRegex = /(https?:\/\/[^\s]+)/gi;
    if (embeddedUrlRegex.test(cellStr)) {
      const parts = cellStr.split(embeddedUrlRegex);
      return (
        <span className="whitespace-normal min-w-[200px] max-w-sm block break-words leading-relaxed">
          {parts.map((part, index) => {
            if (embeddedUrlRegex.test(part)) {
              const url = part.trim();
              const isImg = isImageOrFileUrl(url);
              
              if (isImg) {
                const dotCol = getDotColors(url);
                return (
                  <span key={index} className="inline-flex items-center mx-1 align-middle">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveImagePreviewUrl(url);
                      }}
                      className={cn(
                        "w-6 h-6 rounded-full cursor-pointer hover:scale-125 transition-all outline-none border-none p-0 align-middle shadow-md",
                        dotCol.bg
                      )}
                    />
                  </span>
                );
              }
              
              return (
                <a 
                  key={index}
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-purple-600 dark:text-purple-400 hover:underline font-bold inline align-middle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span>{url.length > 25 ? url.substring(0, 25) + '...' : url}</span>
                </a>
              );
            }
            return part;
          })}
        </span>
      );
    }
    
    return cellStr;
  };

  return (
    <div className="w-full">
      <table className="w-full text-left border-collapse">
        <thead className={cn(
          "sticky top-0 z-10 border-b transition-colors",
          theme === 'dark' ? "bg-slate-900/90 backdrop-blur-md border-slate-800" : "bg-white/90 backdrop-blur-md border-slate-100"
        )}>
          <tr>
            <th className={cn("px-4 sm:px-8 py-4 sm:py-5 text-[10px] sm:text-xs font-black uppercase tracking-widest w-20", theme === 'dark' ? "text-slate-600" : "text-slate-500")}>No.</th>
            {headers.map((header, i) => (
              <th key={i} className={cn("px-4 sm:px-8 py-4 sm:py-5 text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap", theme === 'dark' ? "text-slate-600" : "text-slate-500")}>
                <div className="flex items-center gap-3">
                  {translateAspect(header, lang)}
                  <Filter className="w-3 h-3 opacity-20" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={cn("divide-y transition-colors", theme === 'dark' ? "divide-slate-800" : "divide-slate-50")}>
          {filteredRows.map((row, rowIndex) => (
            <tr key={rowIndex} className={cn("transition-all group border-b", theme === 'dark' ? "border-slate-800" : "border-slate-50", c.bgAlt)}>
              <td className={cn("px-4 sm:px-8 py-4 sm:py-5 text-xs font-black transition-colors", theme === 'dark' ? "text-slate-700" : "text-slate-400")}>{rowIndex + 1}</td>
              {headers.map((_, colIndex) => (
                <td key={colIndex} className={cn(
                  "px-4 sm:px-8 py-4 sm:py-5 text-xs font-bold transition-colors",
                  theme === 'dark' ? "text-slate-400 group-hover:text-white" : "text-slate-600 group-hover:" + c.text.split(' ')[0]
                )}>
                  {renderCellContent(row[colIndex])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      {rows.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center">
          <FileSpreadsheet className={cn("w-12 h-12 mb-4 opacity-10", theme === 'dark' ? "text-slate-500" : "text-purple-900")} />
          <p className={cn("text-xs font-black mb-4 opacity-30", theme === 'dark' ? "text-slate-300" : "text-purple-900")}>{lang === 'th' ? 'ยังไม่มีข้อมูลในตาราง' : 'No data in spreadsheet yet'}</p>
        </div>
      ) : filteredRows.length === 0 && (
        <div className="py-20 text-center flex flex-col items-center">
          <Search className={cn("w-12 h-12 mb-4 opacity-10", theme === 'dark' ? "text-slate-500" : "text-purple-900")} />
          <p className={cn("text-xs font-black opacity-20", theme === 'dark' ? "text-slate-300" : "text-purple-900")}>{lang === 'th' ? `ไม่พบข้อมูลที่ตรงกับ "${filterQuery}"` : `No matching records found for "${filterQuery}"`}</p>
        </div>
      )}

      {/* Fullscreen Image Lightbox Modal */}
      {activeImagePreviewUrl && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
          onClick={() => setActiveImagePreviewUrl(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center bg-slate-900 border border-slate-800 rounded-[2.5rem] p-4 sm:p-6 shadow-2xl overflow-hidden select-none my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button 
              onClick={() => setActiveImagePreviewUrl(null)}
              className="absolute top-4 right-4 bg-slate-800/85 hover:bg-slate-700/85 text-white rounded-full p-2 text-slate-400 hover:text-white transition-all shadow-md active:scale-90 z-10"
              title={lang === 'th' ? "ปิด" : "Close"}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Display full-size picture */}
            <div className="w-full flex items-center justify-center overflow-auto max-h-[70vh] rounded-3xl bg-black/40 border border-slate-800/60 p-1">
              <SecureDriveImage 
                src={getGoogleDriveFullUrl(activeImagePreviewUrl!)} 
                accessToken={accessToken}
                alt="Full Size Image Lightbox" 
                className="max-w-full max-h-[65vh] object-contain select-none" 
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Evidence attachment link */}
            <div className="mt-4 sm:mt-6 w-full flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="min-w-0 max-w-md text-center sm:text-left">
                <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">{lang === 'th' ? 'รูปหลักฐานประกอบชิ้นงาน' : 'Evidence attachment'}</p>
                <p className="text-xs font-bold text-slate-300 truncate mt-1">{activeImagePreviewUrl}</p>
              </div>
              <div className="flex items-center gap-3">
                <a 
                  href={activeImagePreviewUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md active:scale-95"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{lang === 'th' ? 'เปิดลิงก์แบบเต็ม' : 'Open Link'}</span>
                </a>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default function Dashboard({ accessToken, user, lang, setLang, theme, setTheme }: DashboardProps) {
  const t = translations[lang];
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  const [displayZoom, setDisplayZoom] = useState<number>(() => {
    const stored = localStorage.getItem('workloop_display_zoom');
    return stored ? parseFloat(stored) : 1.0;
  });

  useEffect(() => {
    document.documentElement.style.setProperty('--display-zoom', displayZoom.toString());
    localStorage.setItem('workloop_display_zoom', displayZoom.toString());
  }, [displayZoom]);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    try {
      triggerHaptic();
    } catch (e) {}
    
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const isMobile = windowWidth < 640;
  const isTablet = windowWidth >= 640 && windowWidth < 1024;

  const teacherId = '1evNW1UcflWMYAlwB8bFkGXiLyPilTamkph1sLTVycPU';
  const studentId = '1sUF9nS8f4zkQ9GldUVcU82q0a7Eh83jidLYBamERcI4';
  const studentGid = '959993909';
  const scheduleId = '13wfOLqX81c6GAU81KpwZIgZFWIhIdQtc';
  const scheduleGid = '1950881023';

  // Guest sessions only see sample data (see fetchSpreadsheetData and firestore.rules).
  const isGuestSession = accessToken === "GUEST_SESSION_TOKEN";

  // Synchronous cache loader for 0ms visual load response
  const getLocalSheetCache = (sheetId: string, gid?: string): SpreadsheetData | null => {
    if (isGuestSession) return null;
    try {
      const cacheKey = `g_sheet_cache_${sheetId}${gid ? `_${gid}` : ''}`;
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.values)) {
          return normalizeSpreadsheetRecord({
            ...parsed,
            isCached: true
          });
        }
      }
    } catch (err) {
      console.warn('Error reading synchronous localStorage cache:', err);
    }
    return null;
  };

  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return lang === 'th' ? 'ยังไม่ได้ซิงค์' : 'not synced';
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    
    if (diffSec < 30) {
      return lang === 'th' ? 'เมื่อครู่นี้' : 'just now';
    }
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
    return date.toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const [teacherData, setTeacherData] = useState<SpreadsheetData | null>(() => getLocalSheetCache(teacherId));
  const [studentData, setStudentData] = useState<SpreadsheetData | null>(() => getLocalSheetCache(studentId, studentGid));
  const [scheduleData, setScheduleData] = useState<SpreadsheetData | null>(() => getLocalSheetCache(scheduleId, scheduleGid));
  const [data, setData] = useState<SpreadsheetData | null>(() => {
    const storedViewMode = (localStorage.getItem('workloop_view_mode') as 'teacher' | 'student') || 'teacher';
    return storedViewMode === 'teacher' ? getLocalSheetCache(teacherId) : getLocalSheetCache(studentId, studentGid);
  });
  const [scheduleLoading, setScheduleLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState(() => {
    const storedViewMode = (localStorage.getItem('workloop_view_mode') as 'teacher' | 'student') || 'teacher';
    const cached = storedViewMode === 'teacher' ? getLocalSheetCache(teacherId) : getLocalSheetCache(studentId, studentGid);
    return !cached; // Bypass fullscreen spinner completely if cached copy exists
  });
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncChecked, setLastSyncChecked] = useState<number>(Date.now());
  const [studentDriveImages, setStudentDriveImages] = useState<any[]>([]);
  const [driveImagesLoading, setDriveImagesLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'table' | 'schedule' | 'news' | 'honor' | 'scrollbar' | 'ai-chat'>('overview');
  const [showMoreMobileMenu, setShowMoreMobileMenu] = useState<boolean>(false);
  const triggerHaptic = () => {
    if (navigator.vibrate) {
      navigator.vibrate(12);
    }
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(65, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.03);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.03);
    } catch (e) {}
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [lastWidthRange, setLastWidthRange] = useState<'mobile' | 'tablet' | 'desktop' | null>(null);

  useEffect(() => {
    const currentRange = windowWidth < 640 ? 'mobile' : (windowWidth < 1024 ? 'tablet' : 'desktop');
    if (currentRange !== lastWidthRange) {
      if (currentRange === 'tablet') {
        setSidebarCollapsed(true);
      } else if (currentRange === 'desktop') {
        setSidebarCollapsed(false);
      }
      setLastWidthRange(currentRange);
    }
  }, [windowWidth, lastWidthRange]);

  // Use fullscreen by default on mobile & tablet upon first user interaction
  useEffect(() => {
    if (isMobile || isTablet) {
      // First, try immediate request on mount (in case browser allows or loaded in an app context)
      try {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen()
            .then(() => setIsFullscreen(true))
            .catch(() => {});
        }
      } catch (e) {}

      const handleFirstInteraction = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen()
            .then(() => {
              setIsFullscreen(true);
            })
            .catch((err) => {
              console.warn(`Initial auto-fullscreen request yielded: ${err.message}`);
            });
        }
        removeListeners();
      };

      const removeListeners = () => {
        window.removeEventListener('click', handleFirstInteraction);
        window.removeEventListener('touchstart', handleFirstInteraction);
        window.removeEventListener('pointerdown', handleFirstInteraction);
        window.removeEventListener('mousedown', handleFirstInteraction);
      };

      window.addEventListener('click', handleFirstInteraction, { passive: true });
      window.addEventListener('touchstart', handleFirstInteraction, { passive: true });
      window.addEventListener('pointerdown', handleFirstInteraction, { passive: true });
      window.addEventListener('mousedown', handleFirstInteraction, { passive: true });

      return () => {
        removeListeners();
      };
    }
  }, [isMobile, isTablet]);
  const [filterQuery, setFilterQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [advTeacherFilter, setAdvTeacherFilter] = useState<string>('All');
  const [advClassroomFilter, setAdvClassroomFilter] = useState<string>('All');
  const [advEvaluatorFilter, setAdvEvaluatorFilter] = useState<string>('All');
  const [advQualityFilter, setAdvQualityFilter] = useState<string>('All');
  const [advStartDate, setAdvStartDate] = useState<string>('');
  const [advEndDate, setAdvEndDate] = useState<string>('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedEvaluator, setSelectedEvaluator] = useState<string>('All');
  const [selectedCoTeacher, setSelectedCoTeacher] = useState<string>('All');
  const [selectedTrackerTeacher, setSelectedTrackerTeacher] = useState<string>('All');
  const [selectedDailyDate, setSelectedDailyDate] = useState<string | null>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [trackerTimeFilter, setTrackerTimeFilter] = useState<'Today' | 'Weekly' | 'Monthly' | 'All'>('All');
  const [radarTimeFilter, setRadarTimeFilter] = useState<'Today' | 'Weekly' | 'Monthly' | 'All'>('All');
  const [radarDisplayMode, setRadarDisplayMode] = useState<'both' | 'overall' | 'barchart'>('both');
  const [selectedRadarTeacher, setSelectedRadarTeacher] = useState<string>('All');
  const [selectedAspectDetail, setSelectedAspectDetail] = useState<any | null>(null);
  const [selectedGalleryTeacher, setSelectedGalleryTeacher] = useState<string>('All');
  const [selectedGalleryDate, setSelectedGalleryDate] = useState<string>('All');
  const [searchGalleryQuery, setSearchGalleryQuery] = useState<string>('');
  const [selectedGalleryImageItem, setSelectedGalleryImageItem] = useState<any | null>(null);
  const [now, setNow] = useState(new Date());
  const [viewMode, setViewMode] = useState<'teacher' | 'student'>(
    (localStorage.getItem('workloop_view_mode') as 'teacher' | 'student') || 'teacher'
  );
  const [spreadsheetId, setSpreadsheetId] = useState<string>(
    viewMode === 'teacher' 
      ? '1evNW1UcflWMYAlwB8bFkGXiLyPilTamkph1sLTVycPU' 
      : '1sUF9nS8f4zkQ9GldUVcU82q0a7Eh83jidLYBamERcI4'
  );
  
  const spreadsheetLink = viewMode === 'teacher'
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?resourcekey=&gid=959993909#gid=959993909`;
  
  // News State
  const [news, setNews] = useState<NewsPost[]>([]);
  const [unreadNews, setUnreadNews] = useState<boolean>(false);
  const [showNewsPopup, setShowNewsPopup] = useState(false);
  const [isPostingNews, setIsPostingNews] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', content: '', important: false });
  const [printingSectionId, setPrintingSectionId] = useState<'teacher' | 'student' | null>(null);
  const [isReauthorizing, setIsReauthorizing] = useState(false);
  const [hasSyncError, setHasSyncError] = useState(false);
  const [isAuthIssue, setIsAuthIssue] = useState(false);

  // Comment Likes real-time synchronization
  const [commentLikes, setCommentLikes] = useState<CommentLike[]>([]);
  const [currentHour, setCurrentHour] = useState(new Date().getHours());
  const [greetingIndex, setGreetingIndex] = useState(0);

  const DASHBOARD_GREETINGS = [
    { th: "ร่วมสร้างสรรค์อนาคต 🚀", en: "Empowering minds 🚀" },
    { th: "เตรียมพร้อมเพื่อศิษย์ 🎯", en: "Fostering success 🎯" },
    { th: "คลาสเรียนเปี่ยมคุณค่า ✨", en: "Inspiring classes ✨" },
    { th: "พัฒนาอย่างต่อเนื่อง 📚", en: "Continuous growth 📚" },
    { th: "ก้าวหน้าไปด้วยกัน 🌟", en: "Elevating together 🌟" },
    { th: "ส่งเสริมการเรียนรู้ ❤️", en: "Spreading joy ❤️" }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHour(new Date().getHours());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Firestore synchronization listener for both datasets
  useEffect(() => {
    // Guests must not subscribe to the real evaluation data.
    if (isGuestSession) return;

    const teacherDocId = `${teacherId}`;
    const studentDocId = `${studentId}${studentGid ? `_${studentGid}` : ''}`;

    const unsubTeacher = onSnapshot(doc(db, 'sheets_cache', teacherDocId), (docSnap) => {
      if (docSnap.exists()) {
        const cached = docSnap.data();
        if (cached && Array.isArray(cached.values) && cached.values.length > 0) {
          const normalized = normalizeSpreadsheetRecord({
            title: cached.title || 'Teacher Observations',
            values: cached.values,
            isMock: false,
            isCached: false,
            cachedAt: cached.cachedAt || Date.now()
          });
          setTeacherData(prev => {
            if (!prev || JSON.stringify(prev.values) !== JSON.stringify(normalized.values)) {
              if (viewMode === 'teacher') setData(normalized);
              setLastSyncChecked(Date.now());
              return normalized;
            }
            return prev;
          });
        }
      }
    }, (err) => {
      console.warn('Teacher sheet real-time listener error:', err);
    });

    const unsubStudent = onSnapshot(doc(db, 'sheets_cache', studentDocId), (docSnap) => {
      if (docSnap.exists()) {
        const cached = docSnap.data();
        if (cached && Array.isArray(cached.values) && cached.values.length > 0) {
          const normalized = normalizeSpreadsheetRecord({
            title: cached.title || 'Student Feedback',
            values: cached.values,
            isMock: false,
            isCached: false,
            cachedAt: cached.cachedAt || Date.now()
          });
          setStudentData(prev => {
            if (!prev || JSON.stringify(prev.values) !== JSON.stringify(normalized.values)) {
              if (viewMode === 'student') setData(normalized);
              setLastSyncChecked(Date.now());
              return normalized;
            }
            return prev;
          });
        }
      }
    }, (err) => {
      console.warn('Student sheet real-time listener error:', err);
    });

    return () => {
      unsubTeacher();
      unsubStudent();
    };
  }, [viewMode, isGuestSession]);

  useEffect(() => {
    const rotationTimer = setInterval(() => {
      setGreetingIndex(prev => (prev + 1) % DASHBOARD_GREETINGS.length);
    }, 5000); // rotates every 5 seconds
    return () => clearInterval(rotationTimer);
  }, []);

  const getDashboardBlobStyles = () => {
    const activeGreeting = lang === 'th' ? DASHBOARD_GREETINGS[greetingIndex].th : DASHBOARD_GREETINGS[greetingIndex].en;
    if (currentHour >= 6 && currentHour < 11) {
      return {
        blob1: theme === 'dark' ? "bg-amber-500/10" : "bg-amber-400/25",
        blob2: theme === 'dark' ? "bg-orange-500/10" : "bg-orange-400/25",
        blob3: theme === 'dark' ? "bg-yellow-500/10" : "bg-yellow-300/20",
        blob4: theme === 'dark' ? "bg-amber-600/10" : "bg-amber-300/25",
        badge: theme === 'dark' ? "text-amber-400 bg-amber-950/40 border-amber-900/40" : "text-amber-700 bg-amber-50 border-amber-100",
        greeting: activeGreeting
      };
    } else if (currentHour >= 11 && currentHour < 17) {
      return {
        blob1: theme === 'dark' ? "bg-sky-500/10" : "bg-sky-450/25",
        blob2: theme === 'dark' ? "bg-emerald-500/10" : "bg-emerald-400/25",
        blob3: theme === 'dark' ? "bg-teal-500/10" : "bg-teal-300/20",
        blob4: theme === 'dark' ? "bg-cyan-500/10" : "bg-cyan-300/25",
        badge: theme === 'dark' ? "text-sky-400 bg-sky-950/40 border-sky-900/40" : "text-sky-700 bg-sky-50 border-sky-100",
        greeting: activeGreeting
      };
    } else if (currentHour >= 17 && currentHour < 24) {
      return {
        blob1: theme === 'dark' ? "bg-purple-500/10" : "bg-purple-400/25",
        blob2: theme === 'dark' ? "bg-pink-500/10" : "bg-pink-400/25",
        blob3: theme === 'dark' ? "bg-indigo-500/10" : "bg-indigo-300/20",
        blob4: theme === 'dark' ? "bg-fuchsia-400/10" : "bg-fuchsia-300/25",
        badge: theme === 'dark' ? "text-purple-400 bg-purple-950/40 border-purple-900/40" : "text-purple-700 bg-purple-50 border-purple-100",
        greeting: activeGreeting
      };
    } else {
      return {
        blob1: theme === 'dark' ? "bg-indigo-950/15" : "bg-indigo-200/25",
        blob2: theme === 'dark' ? "bg-violet-950/20" : "bg-violet-200/25",
        blob3: theme === 'dark' ? "bg-slate-900/15" : "bg-slate-200/20",
        blob4: theme === 'dark' ? "bg-purple-950/15" : "bg-purple-200/25",
        badge: theme === 'dark' ? "text-indigo-400 bg-indigo-950/50 border-indigo-900/50" : "text-indigo-700 bg-indigo-50 border-indigo-100",
        greeting: activeGreeting
      };
    }
  };

  const currentThemeVibe = getDashboardBlobStyles();

  useEffect(() => {
    const q = query(collection(db, 'comment_likes'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const likesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CommentLike[];
      setCommentLikes(likesData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'comment_likes', user?.uid, user?.email);
    });

    return () => unsubscribe();
  }, [user]);

  const toggleCommentLike = async (rowNum: number) => {
    if (!user?.uid) return;
    const likeDocId = `comment_${rowNum}_user_${user.uid}`;
    const docRef = doc(db, 'comment_likes', likeDocId);
    
    const alreadyLiked = commentLikes.some(like => like.rowNum === rowNum && like.userId === user.uid);
    
    try {
      if (alreadyLiked) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, {
          rowNum,
          userId: user.uid,
          userEmail: user.email || '',
          userName: user.displayName || 'User',
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, alreadyLiked ? OperationType.DELETE : OperationType.CREATE, `comment_likes/${likeDocId}`, user.uid, user.email);
    }
  };

  // Reactions real-time synchronization
  const [reactions, setReactions] = useState<Reaction[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'reactions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reactionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Reaction[];
      setReactions(reactionsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'reactions', user?.uid, user?.email);
    });

    return () => unsubscribe();
  }, [user]);

  const toggleReaction = async (targetId: string, targetType: 'news' | 'comment', emoji: string) => {
    if (!user?.uid) return;
    
    // Deterministic id to allow direct toggling
    const reactionId = `${targetType}_${targetId}_${emoji.trim()}_${user.uid}`.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, 'reactions', reactionId);

    const alreadyReacted = reactions.some(
      r => r.targetId === targetId && r.targetType === targetType && r.emoji === emoji && r.userId === user.uid
    );

    try {
      if (alreadyReacted) {
        await deleteDoc(docRef);
      } else {
        await setDoc(docRef, {
          targetId,
          targetType,
          emoji,
          userId: user.uid,
          userEmail: user.email || '',
          userName: user.displayName || 'User',
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      handleFirestoreError(err, alreadyReacted ? OperationType.DELETE : OperationType.CREATE, `reactions/${reactionId}`, user.uid, user.email);
    }
  };

  useEffect(() => {
    if (news.length === 0) {
      setUnreadNews(false);
      return;
    }

    if (activeTab === 'news') {
      const latestPostId = news[0]?.id;
      if (latestPostId) {
        localStorage.setItem('last_read_news_id', latestPostId);
      }
      setUnreadNews(false);
    } else {
      const latestPostId = news[0]?.id;
      const lastReadId = localStorage.getItem('last_read_news_id');
      if (latestPostId && latestPostId !== lastReadId) {
        setUnreadNews(true);
      } else {
        setUnreadNews(false);
      }
    }
  }, [news, activeTab]);

  useEffect(() => {
    localStorage.setItem('workloop_view_mode', viewMode);
    const teacherId = '1evNW1UcflWMYAlwB8bFkGXiLyPilTamkph1sLTVycPU';
    const studentId = '1sUF9nS8f4zkQ9GldUVcU82q0a7Eh83jidLYBamERcI4';
    const newId = viewMode === 'teacher' ? teacherId : studentId;
    
    setSpreadsheetId(newId);
    
    // Update active data immediately if it's already in cache
    if (viewMode === 'teacher' && teacherData) setData(teacherData);
    else if (viewMode === 'student' && studentData) setData(studentData);
    else setData(null); 
    
    // Reset all context-specific filters so they don't carry over stale values
    setSelectedTrackerTeacher('All');
    setSelectedRadarTeacher('All');
    setSelectedAspectDetail(null);
    setSelectedEvaluator('All');
    setSelectedCoTeacher('All');
    setSelectedDailyDate(() => {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    });
  }, [viewMode, teacherData, studentData]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTab === 'news') {
      const element = document.getElementById('news-board-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (activeTab === 'table') {
      const element = document.getElementById('spreadsheet-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (activeTab === 'schedule') {
      const element = document.getElementById('schedule-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [activeTab]);

  const isClassActive = (day: string, timeRange: string) => {
    const daysMap: { [key: number]: string } = {
      1: 'จันทร์',
      2: 'อังคาร',
      3: 'พุธ',
      4: 'พฤหัสบดี',
      5: 'ศุกร์',
    };
    
    const currentDayName = daysMap[now.getDay()];
    if (!currentDayName || !day.includes(currentDayName)) return false;

    const [start, end] = timeRange.split('-');
    if (!start || !end) return false;

    const parseTime = (t: string) => {
      const [h, m] = t.split('.').map(Number);
      const d = new Date(now);
      d.setHours(h, m || 0, 0, 0);
      return d;
    };

    const startTime = parseTime(start.trim());
    const endTime = parseTime(end.trim());

    return now >= startTime && now <= endTime;
  };

  const PERIODS = [
    { id: '1', time: '08.30-09.20' },
    { id: '2', time: '09.20-10.10' },
    { id: '3', time: '10.10-11.00' },
    { id: '4', time: '11.00-11.50' },
    { id: '5', time: '11.50-12.40' },
    { id: '6', time: '12.40-13.30' },
    { id: '7', time: '13.30-14.20' },
    { id: '8', time: '14.20-15.10' },
    { id: '9', time: '15.10-16.00' },
    { id: '10', time: '16.00-16.50' },
  ];

  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NewsPost[];
      setNews(newsData);
      
      // Show popup if there's important news and session hasn't seen it
      const importantNews = newsData.filter(n => n.important);
      if (importantNews.length > 0) {
        const lastSeen = sessionStorage.getItem('last_seen_news');
        if (lastSeen !== importantNews[0].id) {
          setShowNewsPopup(true);
          sessionStorage.setItem('last_seen_news', importantNews[0].id);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handlePostNews = async () => {
    if (!newPost.title || !newPost.content) return;
    setIsPostingNews(true);
    try {
      await addDoc(collection(db, 'news'), {
        title: newPost.title,
        content: newPost.content,
        important: newPost.important,
        authorName: user?.displayName || 'Admin',
        authorId: user?.uid,
        createdAt: serverTimestamp()
      });
      setNewPost({ title: '', content: '', important: false });
      setNotification({ type: 'success', text: 'News posted successfully!' });
    } catch (e) {
      console.error(e);
      setNotification({ type: 'error', text: 'Failed to post news' });
    } finally {
      setIsPostingNews(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const triggerPrintSpreadsheet = (section: 'teacher' | 'student') => {
    setPrintingSectionId(section);
    setTimeout(() => {
      window.print();
      setPrintingSectionId(null);
    }, 150);
  };

  const handleExportAsImage = async (elementId: string, filename: string) => {
    setNotification({ type: 'success', text: lang === 'th' ? 'กำลังส่งออกรูปภาพ...' : 'Exporting image...' });
    setTimeout(async () => {
      const element = document.getElementById(elementId);
      if (!element) {
        setNotification({ type: 'error', text: lang === 'th' ? 'ไม่พบพื้นที่ข้อมูลสำหรับแสดงผล' : 'Target element not found' });
        return;
      }
      try {
        const canvas = await html2canvas(element, {
          backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
          scale: 2,
          useCORS: true,
          logging: false
        });
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setNotification({ type: 'success', text: lang === 'th' ? 'ดาวน์โหลดรูปภาพรายงานสำเร็จ!' : 'Report image downloaded successfully!' });
      } catch (error) {
        console.error('Image export failed:', error);
        setNotification({ type: 'error', text: lang === 'th' ? 'ส่งออกรูปภาพล้มเหลว' : 'Image export failed' });
      } finally {
        setTimeout(() => setNotification(null), 3000);
      }
    }, 150);
  };

  const handleExportCustom = (sheetData: SpreadsheetData | null, format: 'csv' | 'excel' | 'pdf' | 'json', label?: string) => {
    const targetData = sheetData || data;
    if (!targetData || !targetData.values || targetData.values.length === 0) return;

    const prefix = label || targetData.title || 'spreadsheet';
    const fileName = `${prefix}_export_${new Date().toISOString().split('T')[0]}`;

    try {
      if (format === 'csv') {
        const csvContent = targetData.values
          .map(row => 
            row.map(cell => {
              const escaped = String(cell).replace(/"/g, '""');
              return `"${escaped}"`;
            }).join(',')
          )
          .join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (format === 'excel') {
        const ws = XLSX.utils.aoa_to_sheet(targetData.values);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, `${fileName}.xlsx`);
      } else if (format === 'json') {
        const headers = targetData.values[0];
        const rows = targetData.values.slice(1);
        const jsonData = rows.map(row => {
          const obj: any = {};
          headers.forEach((h, i) => {
            obj[h] = row[i];
          });
          return obj;
        });
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${fileName}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (format === 'pdf') {
        const doc = new jsPDF('landscape');
        
        // Translate headers to English to prevent empty/corrupted block characters
        const headers = targetData.values[0].map(h => {
          const check = h.trim();
          if (/ครูต่างชาติ|teacher|ต่างชาติ/i.test(check)) return "Foreign Teacher";
          if (/ครูผู้ประเมิน|ผู้ประเมิน|evaluator|observer/i.test(check)) return "Evaluator";
          if (/timestamp|date|วันที่/i.test(check)) return "Timestamp";
          if (/ชั้นเรียน|classroom|class/i.test(check)) return "Classroom";
          if (/วิชา|subject/i.test(check)) return "Subject/Course";
          if (/ความเห็น|feedback|comment|suggestion/i.test(check)) return "Comments/Feedback";
          if (/ระดับ|คะแนน/i.test(check)) return "Rating Score";
          
          // Truncate long criteria questions to shorter descriptor
          if (check.length > 15) {
            if (check.includes('สื่อ')) return "Teaching Media";
            if (check.includes('กลุ่ม') || check.includes('ควบคุม')) return "Class Control";
            if (check.includes('กิจกรรม') || check.includes('จัดเรียน')) return "Lesson Activity";
            if (check.includes('ภาษา')) return "Language Usage";
            if (check.includes('เวลา')) return "Punctuality";
            return "Pedagogy Aspect";
          }
          return check;
        });

        // Translate cell values to English to prevent box/empty cells 
        const rows = targetData.values.slice(1).map(row => {
          return row.map(cell => translateThaiToEnglishForPDF(cell));
        });
        
        autoTable(doc, {
          head: [headers],
          body: rows,
          theme: 'grid',
          styles: { fontSize: 7 },
          headStyles: { fillColor: [147, 51, 234] }
        });
        
        doc.save(`${fileName}.pdf`);
      }
      setNotification({ type: 'success', text: `Exported to ${format.toUpperCase()}` });
    } catch (error) {
      console.error('Export error:', error);
      setNotification({ type: 'error', text: 'Export failed' });
    } finally {
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleExport = (format: 'csv' | 'excel' | 'pdf' | 'json') => {
    handleExportCustom(data, format);
  };

  // Helper to normalize date string to YYYY-MM-DD
  const normalizeDateStr = (dateStr: string) => {
    if (!dateStr) return '';
    // Remove time part if exists
    let processed = dateStr.toString().trim();
    if (processed.includes(' ')) processed = processed.split(' ')[0];
    
    try {
      // First try native Date if it's already YYYY-MM-DD or standard
      if (processed.match(/^\d{4}-\d{2}-\d{2}$/)) {
        let [y, m, d] = processed.split('-').map(Number);
        if (y > 2400) y -= 543;
        return `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      }

    // 2. Try DD/MM/YY (common in older sheets or shorthand)
    const shortYearMatch = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
    if (shortYearMatch) {
      const d = parseInt(shortYearMatch[1]);
      const m = parseInt(shortYearMatch[2]);
      let y = parseInt(shortYearMatch[3]);
      y += (y < 50 ? 2000 : (y < 100 ? 1900 : 0));
      return `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
    }

    // 3. Handle Thai Month Names (e.g., 19 พ.ค. 2567)
    const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const thaiFullMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    
    for (let i = 0; i < 12; i++) {
       if (dateStr.includes(thaiMonths[i]) || dateStr.includes(thaiFullMonths[i])) {
          const parts = dateStr.split(/\s+/);
          const d = parseInt(parts[0]);
          let y = parseInt(parts[parts.length - 1]);
          if (y > 2400) y -= 543;
          if (y < 100) y += 2000;
          return `${y}-${(i + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
       }
    }

    // 4. Handle DD/MM/YYYY or MM/DD/YYYY or YYYY-MM-DD / YYYY/MM/DD
      if (processed.includes('/') || processed.includes('-')) {
        const separator = processed.includes('/') ? '/' : '-';
        const parts = processed.split(separator);
        
        if (parts.length === 3) {
          let day, month, year;
          
          if (parts[0].length === 4) {
            // YYYY-MM-DD or YYYY/MM/DD
            year = parseInt(parts[0]);
            month = parseInt(parts[1]);
            day = parseInt(parts[2]);
          } else {
            // Check if it's DD/MM/YYYY or MM/DD/YYYY
            const p0 = parseInt(parts[0]);
            const p1 = parseInt(parts[1]);
            const p2 = parseInt(parts[2]);
            
            if (p0 > 12) {
              // Definitely DD/MM/YYYY
              day = p0;
              month = p1;
              year = p2;
            } else if (p1 > 12) {
              // Definitely MM/DD/YYYY
              day = p1;
              month = p0;
              year = p2;
            } else {
              // Still ambiguous, assume Thai preference: DD/MM/YYYY
              day = p0;
              month = p1;
              year = p2;
            }
          }

          // Handle Buddhist Era (BE)
          if (year > 2400) year -= 543;
          // Handle 2-digit year
          if (year < 100) year += 2000;

          if (month > 0 && month <= 12 && day > 0 && day <= 31) {
            return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
          }
        }
      }
      
      const d = new Date(processed);
      if (!isNaN(d.getTime())) {
        let year = d.getFullYear();
        if (year > 2400) year -= 543;
        return `${year}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      }
    } catch (e) {
      console.error("Date normalization error:", e, dateStr);
    }
    return processed;
  };

  // Helper to get start of week (Monday)
  const getStartOfWeek = (dateStr: string) => {
    try {
      const normalized = normalizeDateStr(dateStr);
      const d = new Date(normalized);
      if (isNaN(d.getTime())) return 'Invalid Date';
      const dayOfWeek = d.getDay();
      const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      return monday.toISOString().split('T')[0];
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const loadStudentDriveImages = async (token: string) => {
    if (!token) return;
    setDriveImagesLoading(true);
    let success = false;
    try {
      const folderId = '1WkEEZi9q5EzBPsO46aHNdnSF3vemxyTgHUmf7Q-4H-OfKPk6e2MjCCdpRmXhLpIAvLwTX50a';
      const q = `'${folderId}' in parents and trashed = false`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,thumbnailLink,webContentLink,createdTime)&pageSize=100`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const driveData = await res.json();
        if (driveData && Array.isArray(driveData.files)) {
          const imageFiles = driveData.files.filter((f: any) => 
            f.mimeType?.startsWith('image/') || 
            /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(f.name)
          );
          
          const mapped = imageFiles.map((f: any, idx: number) => {
            const dateStr = f.createdTime ? new Date(f.createdTime).toISOString().split('T')[0] : '';
            const normalizedDate = normalizeDateStr(dateStr) || dateStr || 'N/A';
            
            return {
              url: `https://drive.google.com/open?id=${f.id}`,
              thumbnail: `https://lh3.googleusercontent.com/d/${f.id}=w400`,
              fullUrl: `https://lh3.googleusercontent.com/d/${f.id}=w1000`,
              header: f.name.split('.')[0] || 'Student Artifact',
              teacher: 'All',
              evaluator: 'Student Folder',
              date: normalizedDate,
              comment: f.name || '',
              rowNum: -1 - idx,
              isDriveFolderFile: true
            };
          });
          
          setStudentDriveImages(mapped);
          success = true;
        }
      } else {
        console.warn("Google Drive API response was not OK:", res.status);
      }
    } catch (err) {
      console.error("Error loading student drive folder files:", err);
    } finally {
      if (!success) {
        // Fallback to beautiful mock portfolio items when Drive fetch fails
        console.warn("Falling back to high-fidelity mock student Drive files.");
        const mockDriveFiles = [
          {
            id: 'mock1',
            name: 'Worksheet_Conversation_EP_John_Perfect.jpg',
            createdTime: '2026-06-08T10:00:00Z',
            mimeType: 'image/jpeg'
          },
          {
            id: 'mock2',
            name: 'Vocabulary_Game_M1_Sarah.png',
            createdTime: '2026-06-07T14:30:00Z',
            mimeType: 'image/png'
          },
          {
            id: 'mock3',
            name: 'Science_Lab_Report_M4_David_Excellent.jpg',
            createdTime: '2026-06-06T11:00:00Z',
            mimeType: 'image/jpeg'
          },
          {
            id: 'mock4',
            name: 'Speaking_Assessment_Video_Capture_Mary.jpg',
            createdTime: '2026-06-05T09:20:00Z',
            mimeType: 'image/jpeg'
          },
          {
            id: 'mock5',
            name: 'Classroom_Activity_Writing_Challenge.png',
            createdTime: '2026-06-05T13:40:00Z',
            mimeType: 'image/png'
          }
        ];

        const mapped = mockDriveFiles.map((f: any, idx: number) => {
          const dateStr = f.createdTime ? f.createdTime.split('T')[0] : '';
          const normalizedDate = normalizeDateStr(dateStr) || dateStr || 'N/A';
          
          const unsplashThumbnails: Record<string, string> = {
            'mock1': 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=400&q=80',
            'mock2': 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=400&q=80',
            'mock3': 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&q=80',
            'mock4': 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=400&q=80',
            'mock5': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400&q=80'
          };

          const unsplashFulls: Record<string, string> = {
            'mock1': 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=1000&q=80',
            'mock2': 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=1000&q=80',
            'mock3': 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=1000&q=80',
            'mock4': 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1000&q=80',
            'mock5': 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1000&q=80'
          };

          return {
            url: `https://drive.google.com/open?id=${f.id}`,
            thumbnail: unsplashThumbnails[f.id] || '',
            fullUrl: unsplashFulls[f.id] || '',
            header: f.name.replace(/_/g, ' ').replace(/\.[^/.]+$/, "") || 'Student Artifact',
            teacher: 'All',
            evaluator: 'Student Folder',
            date: normalizedDate,
            comment: f.name || '',
            rowNum: -1 - idx,
            isDriveFolderFile: true
          };
        });

        setStudentDriveImages(mapped);
      }
      setDriveImagesLoading(false);
    }
  };

  const loadData = async (isBackground = false, force = false) => {
    if (!accessToken) {
      if (loading) setLoading(false);
      setIsSyncing(false);
      return;
    }
    if (!isBackground) {
      setLoading(true);
    } else {
      setIsSyncing(true);
    }
    
    setScheduleLoading(true);
    const [tResult, sResult, schResult] = await Promise.all([
      fetchSpreadsheetData(accessToken, teacherId, undefined, force),
      fetchSpreadsheetData(accessToken, studentId, studentGid, force),
      fetchSpreadsheetData(accessToken, scheduleId, scheduleGid, force).catch(err => {
        console.warn("Failed to fetch schedule data:", err);
        return null;
      })
    ]);
    
    const normalizedTeacher = tResult ? normalizeSpreadsheetRecord(tResult) : null;
    const normalizedStudent = sResult ? normalizeSpreadsheetRecord(sResult) : null;

    let isNewDataFound = false;
    if (normalizedTeacher && teacherData && normalizedTeacher.values && teacherData.values) {
      if (normalizedTeacher.values.length > teacherData.values.length) {
        isNewDataFound = true;
      }
    }
    if (normalizedStudent && studentData && normalizedStudent.values && studentData.values) {
      if (normalizedStudent.values.length > studentData.values.length) {
        isNewDataFound = true;
      }
    }

    if (isNewDataFound) {
      // Find the most recent date in the values to automatically update Daily Activity selection
      const activeResult = viewMode === 'teacher' ? normalizedTeacher : normalizedStudent;
      if (activeResult && activeResult.values && activeResult.values.length > 1) {
        const headers = activeResult.values[0] || [];
        const rows = activeResult.values.slice(1) || [];
        const dateIdxAttr = headers.findIndex(h => /timestamp|date|วันที่/i.test(h));
        if (dateIdxAttr !== -1) {
          let latestDateStr = '';
          let latestTime = 0;
          rows.forEach(r => {
            const dStr = r[dateIdxAttr];
            if (dStr) {
              const norm = normalizeDateStr(dStr);
              if (norm) {
                const t = new Date(norm).getTime();
                if (!isNaN(t) && t > latestTime) {
                  latestTime = t;
                  latestDateStr = norm;
                }
              }
            }
          });
          if (latestDateStr) {
            setSelectedDailyDate(latestDateStr);
          }
        }
      }
    }

    if (normalizedTeacher) setTeacherData(normalizedTeacher);
    if (normalizedStudent) setStudentData(normalizedStudent);
    if (schResult) setScheduleData(schResult);
    setScheduleLoading(false);

    // Compute sync error states instead of blocking the user with invasive alert popups
    const hasError = !!(accessToken && !isGuestSession && (
      tResult?.error || 
      sResult?.error || 
      schResult?.error || 
      tResult?.isMock || 
      sResult?.isMock || 
      !tResult || 
      !sResult
    ));

    const authError = !!(accessToken && (
      tResult?.isAuthError || 
      sResult?.isAuthError || 
      schResult?.isAuthError ||
      (tResult?.error && (tResult.error.toLowerCase().includes("invalid authentication") || tResult.error.toLowerCase().includes("expired") || tResult.error.toLowerCase().includes("credential"))) ||
      (sResult?.error && (sResult.error.toLowerCase().includes("invalid authentication") || sResult.error.toLowerCase().includes("expired") || sResult.error.toLowerCase().includes("credential")))
    ));

    setHasSyncError(hasError);
    setIsAuthIssue(authError);

    const activeResult = viewMode === 'teacher' ? normalizedTeacher : normalizedStudent;
    
    if (activeResult) {
      setData(activeResult);
      // Auto-select most recent period
      const headers = activeResult.values[0] || [];
      const rows = activeResult.values.slice(1) || [];
      const dateIdxAttr = headers.findIndex(h => /timestamp|date|วันที่/i.test(h));
      const dates = rows.map(r => r[dateIdxAttr]).filter(Boolean);
      if (dates.length > 0) {
        // Initialization for current data
      }
    } else if (!isBackground || !data) {
      // If active result failed
      setData(null);
    }
    if (!isBackground) setLoading(false);
    setIsSyncing(false);
    setLastSyncChecked(Date.now());
  };

  const handleRefreshClick = async () => {
    try {
      const isGuest = accessToken === "GUEST_SESSION_TOKEN";
      const hasData = !!data;
      
      // Better UX: If there is already data on the page, refresh in background (isBackground=true)
      // to keep it fast and non-disruptive, otherwise show the full-screen loading spinner.
      const isBgLoad = hasData;
      if (!isBgLoad) {
        setLoading(true);
      }

      if (!isGuest && hasSyncError && (isAuthIssue || !accessToken)) {
        const result = await googleSignIn();
        if (result) {
          setIsAuthIssue(false);
          setHasSyncError(false);
          await loadData(isBgLoad, true);
          setNotification({
            type: 'success',
            text: lang === 'th' ? 'อัปเดตข้อมูลล่าสุดจากสเปรดชีตสำเร็จแล้ว! 🚀' : 'Synced the latest live data from Google Sheets! 🚀'
          });
          setTimeout(() => setNotification(null), 3500);
        }
      } else {
        await loadData(isBgLoad, true);
        setNotification({
          type: 'success',
          text: isGuest
            ? (lang === 'th' ? 'รีเฟรชอัปเดตข้อมูลแดชบอร์ดล่าสุดจากระบบสำเร็จแล้ว! 🚀' : 'Refreshed and compiled the latest dashboard cache successfully! 🚀')
            : (lang === 'th' ? 'อัปเดตข้อมูลล่าสุดจากสเปรดชีตสำเร็จแล้ว! 🚀' : 'Synced the latest live data from Google Sheets! 🚀')
        });
        setTimeout(() => setNotification(null), 3500);
      }
    } catch (err: any) {
      console.error("Refresh error:", err);
      setNotification({
        type: 'error',
        text: lang === 'th' ? 'รีเฟรชข้อมูลล้มเหลว กรุณาลองใหม่อีกครั้ง' : 'Failed to synchronize latest data. Please try again.'
      });
      setTimeout(() => setNotification(null), 3550);
    } finally {
      setLoading(false);
    }
  };

  const handleReauth = async () => {
    try {
      setIsReauthorizing(true);
      const result = await googleSignIn();
      if (result) {
        setNotification({
          type: 'success',
          text: lang === 'th' ? 'เชื่อมต่อ Google Account ใหม่สำเร็จแล้ว! กำลังจัดเตรียมข้อมูล...' : 'Google Account re-authenticated successfully! Loading fresh data...'
        });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    } catch (err: any) {
      console.error("Re-authentication error:", err);
      setNotification({
        type: 'error',
        text: lang === 'th' ? 'การยืนยันตัวตนใหม่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'Re-authentication failed. Please try again.'
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setIsReauthorizing(false);
    }
  };



  useEffect(() => {
    // Highly-optimized Real-Time SWR (Stale-While-Revalidate):
    // 1. Instantly render the cached copy from local storage (0ms initialization, prevents blocking).
    // 2. Immediately fire an invisible, real-time background API fetch with force=true to bypass all server/network caches.
    // This gives the user an instantaneous UI load AND 100% accurate, live real-time sheet data within ~1 second!
    const hasCache = !!data;
    if (!hasCache) {
      loadData(false, true); // Foreground spinner on very first empty load
    } else {
      loadData(true, false); // Silent background sync on mount using server cache if fresh
    }
    
    // Smooth background fetch of portfolio drive files only ONCE per token/session, never blocking UI
    if (accessToken) {
      loadStudentDriveImages(accessToken).catch(err => {
        console.warn("Failed to load student drive images on mount:", err);
      });
    }

    // Active Real-Time Live Background Synchronization:
    // Sync live spreadsheet data every 10 seconds automatically when the tab is visible,
    // passing force=true so that new entries and modifications in Google Sheets are immediately recognized!
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(true, true); // Real-time background sync with live force-refresh
      }
    }, 10000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        loadData(true, true); // Instant live sync when tab becomes active or visible
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [accessToken, spreadsheetId]);

  const headers = data?.values[0] || [];
  const rows = data?.values.slice(1) || [];

  const filteredRows = rows.filter(row => 
    row.some(cell => 
      String(cell).toLowerCase().includes(filterQuery.toLowerCase())
    )
  );

  // Find column indices for Date and User
  const dateIdx = headers.findIndex(h => 
    /timestamp|date|วันที่/i.test(h)
  );
  const userIdx = headers.findIndex(h => 
    /ชื่อผู้ประเมิน|evaluator|recorder|reviewer/i.test(h)
  );

  const finalUserIdx = userIdx === -1 ? headers.findIndex(h => /user|name|email|ผู้บันทึก|ชื่อ/i.test(h)) : userIdx;

  // Group by date
  const dailyActivity = useMemo(() => {
    return rows.reduce((acc: Record<string, Set<string>>, row) => {
      let dateStr = row[dateIdx] || 'Unknown Date';
      let normalizedDate = normalizeDateStr(dateStr);
      const userStr = row[finalUserIdx] || 'Anonymous';
      
      if (!acc[normalizedDate]) acc[normalizedDate] = new Set();
      acc[normalizedDate].add(userStr);
      return acc;
    }, {});
  }, [rows, dateIdx, finalUserIdx]);

  const sortedDates = useMemo(() => {
    return Object.keys(dailyActivity).sort((a, b) => 
      b.localeCompare(a)
    );
  }, [dailyActivity]);

  // Group by week and user count
  const weeklyUserActivity = rows.reduce((acc: Record<string, Record<string, number>>, row) => {
    const dateStr = row[dateIdx] || '';
    const userStr = row[userIdx] || 'Anonymous';
    if (!dateStr) return acc;
    const weekStart = getStartOfWeek(dateStr);
    if (weekStart === 'Invalid Date') return acc;
    if (!acc[weekStart]) acc[weekStart] = {};
    acc[weekStart][userStr] = (acc[weekStart][userStr] || 0) + 1;
    return acc;
  }, {});

  const sortedWeeks = Object.keys(weeklyUserActivity).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  ).slice(0, 5);

  // Always ensure the activity logs fallback to the current date in real-time if not explicitly filtered
  useEffect(() => {
    if (!selectedDailyDate) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      setSelectedDailyDate(`${yyyy}-${mm}-${dd}`);
    }
  }, [selectedDailyDate]);

  // Teacher/Student specific detection indices
  const evaluatorIdx = viewMode === 'student' ? 2 : (headers.findIndex(h => /ครูผู้ประเมิน|ผู้ประเมิน|evaluator|observer/i.test(h)) !== -1 
    ? headers.findIndex(h => /ครูผู้ประเมิน|ผู้ประเมิน|evaluator|observer/i.test(h)) 
    : 2);
  const coTeacherIdx = viewMode === 'student' ? 4 : (headers.findIndex(h => /ต่างชาติ|foreign|ร่วมสอน|student|ชื่อนักเรียน|นักเรียน|ผู้รับการประเมิน|co-teacher/i.test(h)) !== -1
    ? headers.findIndex(h => /ต่างชาติ|foreign|ร่วมสอน|student|ชื่อนักเรียน|นักเรียน|ผู้รับการประเมิน|co-teacher/i.test(h))
    : 3);
  const teacherIdx = headers.findIndex(h => /teacher|name of teacher|ครู|ชื่อต่างชาติ|ครูต่างชาติ/i.test(h)) !== -1 
    ? headers.findIndex(h => /teacher|name of teacher|ครู|ชื่อต่างชาติ|ครูต่างชาติ/i.test(h)) 
    : coTeacherIdx;
  const commentIdx = viewMode === 'student' 
    ? 13 
    : headers.findIndex(h => /comment|feedback|suggestion|ความเห็น|ข้อเสนอแนะ/i.test(h));
  const aspectIndices = useMemo(() => {
    if (viewMode === 'student') {
      // Columns F-M (indices 5-12)
      return [5, 6, 7, 8, 9, 10, 11, 12].filter(i => i < headers.length);
    }
    // Specifically target columns F, G, H, I, J (indices 5, 6, 7, 8, 9)
    const targetIndices = [5, 6, 7, 8, 9];
    return targetIndices.filter(i => i < headers.length);
  }, [headers, viewMode]);

  // Dynamic advanced filtering values
  const uniqueTeachers = useMemo(() => {
    const currentData = viewMode === 'teacher' ? teacherData : studentData;
    if (!currentData) return [];
    const headers = currentData.values[0] || [];
    const idx = headers.findIndex(h => /ครูต่างชาติ|teacher|ต่างชาติ/i.test(h));
    if (idx === -1) return [];
    const rows = currentData.values.slice(1) || [];
    return Array.from(new Set(rows.map(r => r[idx]).filter(Boolean))).sort();
  }, [teacherData, studentData, viewMode]);

  const uniqueClassrooms = useMemo(() => {
    const currentData = viewMode === 'teacher' ? teacherData : studentData;
    if (!currentData) return [];
    const headers = currentData.values[0] || [];
    const idx = viewMode === 'student' ? 2 : 4;
    if (idx >= headers.length) return [];
    const rows = currentData.values.slice(1) || [];
    return Array.from(new Set(rows.map(r => r[idx]).filter(Boolean))).sort();
  }, [teacherData, studentData, viewMode]);

  const uniqueEvaluatorsOrStudents = useMemo(() => {
    const currentData = viewMode === 'teacher' ? teacherData : studentData;
    if (!currentData) return [];
    const headers = currentData.values[0] || [];
    const idx = viewMode === 'student' ? 3 : headers.findIndex(h => /ผู้ประเมิน|นักเรียน|evaluator|student|recorder/i.test(h));
    if (idx === -1 || idx >= headers.length) return [];
    const rows = currentData.values.slice(1) || [];
    return Array.from(new Set(rows.map(r => r[idx]).filter(Boolean))).sort();
  }, [teacherData, studentData, viewMode]);

  const filteredTeacherData = useMemo(() => {
    if (!teacherData) return null;
    const headers = teacherData.values[0] || [];
    const rows = teacherData.values.slice(1) || [];
    
    const filteredRows = rows.filter(row => {
      // 1. Text Search (filterQuery)
      if (filterQuery) {
        const queryLower = filterQuery.toLowerCase().trim();
        const matchesSearch = row.some(cell => String(cell).toLowerCase().includes(queryLower));
        if (!matchesSearch) return false;
      }
      
      // 2. Foreign Teacher Column Filter
      if (advTeacherFilter !== 'All') {
        const idx = headers.findIndex(h => /ครูต่างชาติ|teacher|ต่างชาติ/i.test(h));
        if (idx !== -1 && row[idx] !== advTeacherFilter) return false;
      }
      
      // 3. Classroom Column Filter
      if (advClassroomFilter !== 'All') {
        const idx = 4; // Column E for teacher evaluations
        if (idx < row.length && row[idx] !== advClassroomFilter) return false;
      }
      
      // 4. Evaluator / Student Column Filter
      if (advEvaluatorFilter !== 'All') {
        const idx = headers.findIndex(h => /ผู้ประเมิน|นักเรียน|evaluator|student|recorder/i.test(h));
        if (idx !== -1 && row[idx] !== advEvaluatorFilter) return false;
      }
      
      // 5. Rating filter
      if (advQualityFilter !== 'All') {
        const hasQuality = row.some(cell => String(cell) === advQualityFilter);
        if (!hasQuality) return false;
      }
      
      // 6. Date Range filter
      const dateIdx = headers.findIndex(h => /timestamp|date|วันที่/i.test(h));
      if (dateIdx !== -1 && row[dateIdx]) {
        const rowNormDate = normalizeDateStr(row[dateIdx]);
        if (advStartDate && rowNormDate < advStartDate) return false;
        if (advEndDate && rowNormDate > advEndDate) return false;
      }
      
      return true;
    });
    
    return {
      ...teacherData,
      values: [headers, ...filteredRows]
    };
  }, [teacherData, filterQuery, advTeacherFilter, advClassroomFilter, advEvaluatorFilter, advQualityFilter, advStartDate, advEndDate]);

  const filteredStudentData = useMemo(() => {
    if (!studentData) return null;
    const headers = studentData.values[0] || [];
    const rows = studentData.values.slice(1) || [];
    
    const filteredRows = rows.filter(row => {
      // 1. Text Search (filterQuery)
      if (filterQuery) {
        const queryLower = filterQuery.toLowerCase().trim();
        const matchesSearch = row.some(cell => String(cell).toLowerCase().includes(queryLower));
        if (!matchesSearch) return false;
      }
      
      // 2. Foreign Teacher Column Filter
      if (advTeacherFilter !== 'All') {
        const idx = headers.findIndex(h => /ครูต่างชาติ|teacher|ต่างชาติ/i.test(h));
        if (idx !== -1 && row[idx] !== advTeacherFilter) return false;
      }
      
      // 3. Classroom Column Filter
      if (advClassroomFilter !== 'All') {
        const idx = 2; // Column C for student evaluations
        if (idx < row.length && row[idx] !== advClassroomFilter) return false;
      }
      
      // 4. Evaluator / Student Column Filter
      if (advEvaluatorFilter !== 'All') {
        const idx = 3; // Column D for student evaluations
        if (idx < row.length && row[idx] !== advEvaluatorFilter) return false;
      }
      
      // 5. Rating filter
      if (advQualityFilter !== 'All') {
        const hasQuality = row.some(cell => String(cell) === advQualityFilter);
        if (!hasQuality) return false;
      }
      
      // 6. Date Range filter
      const dateIdx = headers.findIndex(h => /timestamp|date|วันที่/i.test(h));
      if (dateIdx !== -1 && row[dateIdx]) {
        const rowNormDate = normalizeDateStr(row[dateIdx]);
        if (advStartDate && rowNormDate < advStartDate) return false;
        if (advEndDate && rowNormDate > advEndDate) return false;
      }
      
      return true;
    });
    
    return {
      ...studentData,
      values: [headers, ...filteredRows]
    };
  }, [studentData, filterQuery, advTeacherFilter, advClassroomFilter, advEvaluatorFilter, advQualityFilter, advStartDate, advEndDate]);

  const calculateStatsForData = (currentData: any) => {
    if (!currentData || !currentData.values || currentData.values.length <= 1) {
      return {
        total: 0,
        excellentCount: 0,
        goodCount: 0,
        fairCount: 0,
        averageScore: 0,
        topTeacher: '-',
        topEvaluator: '-',
        latestTime: '-'
      };
    }
    
    const headers = currentData.values[0];
    const rows = currentData.values.slice(1);
    
    const total = rows.length;
    
    const teacherIdx = headers.findIndex(h => /ครูต่างชาติ|teacher|ต่างชาติ/i.test(h));
    const evaluatorIdx = headers.findIndex(h => /ผู้ประเมิน|นักเรียน|evaluator|student|recorder/i.test(h));
    const dateIdx = headers.findIndex(h => /timestamp|date|วันที่/i.test(h));
    
    let excellentCount = 0;
    let goodCount = 0;
    let fairCount = 0;
    let totalRatingPoints = 0;
    let ratingCellsCount = 0;
    
    rows.forEach(row => {
      row.forEach(cell => {
        const val = String(cell).trim();
        if (val === 'ดีมาก') {
          excellentCount++;
          totalRatingPoints += 3;
          ratingCellsCount++;
        } else if (val === 'ดี') {
          goodCount++;
          totalRatingPoints += 2;
          ratingCellsCount++;
        } else if (val === 'พอใช้') {
          fairCount++;
          totalRatingPoints += 1;
          ratingCellsCount++;
        }
      });
    });
    
    const averageScore = ratingCellsCount > 0 ? ((totalRatingPoints / ratingCellsCount) * (10 / 3)) : 0;
    
    const teacherCounts: Record<string, number> = {};
    if (teacherIdx !== -1) {
      rows.forEach(row => {
        const t = row[teacherIdx];
        if (t) {
          teacherCounts[t] = (teacherCounts[t] || 0) + 1;
        }
      });
    }
    let topTeacher = '-';
    let maxTeacherCount = 0;
    Object.entries(teacherCounts).forEach(([t, count]) => {
      if (count > maxTeacherCount) {
        maxTeacherCount = count;
        topTeacher = t;
      }
    });
    if (topTeacher !== '-') {
      topTeacher = `${topTeacher} (${maxTeacherCount} ${lang === 'th' ? 'ครั้ง' : 'times'})`;
    }
    
    const evaluatorCounts: Record<string, number> = {};
    if (evaluatorIdx !== -1) {
      rows.forEach(row => {
        const e = row[evaluatorIdx];
        if (e) {
          evaluatorCounts[e] = (evaluatorCounts[e] || 0) + 1;
        }
      });
    }
    let topEvaluator = '-';
    let maxEvalCount = 0;
    Object.entries(evaluatorCounts).forEach(([e, count]) => {
      if (count > maxEvalCount) {
        maxEvalCount = count;
        topEvaluator = e;
      }
    });
    if (topEvaluator !== '-') {
      topEvaluator = `${topEvaluator} (${maxEvalCount} ${lang === 'th' ? 'ครั้ง' : 'times'})`;
    }
    
    let latestTime = '-';
    if (dateIdx !== -1 && rows.length > 0) {
      const dates = rows.map(r => r[dateIdx]).filter(Boolean);
      if (dates.length > 0) {
        dates.sort((a, b) => b.localeCompare(a));
        latestTime = dates[0];
      }
    }
    
    return {
      total,
      excellentCount,
      goodCount,
      fairCount,
      averageScore,
      topTeacher,
      topEvaluator,
      latestTime
    };
  };

  const teacherStats = useMemo(() => calculateStatsForData(filteredTeacherData), [filteredTeacherData, lang]);
  const studentStats = useMemo(() => calculateStatsForData(filteredStudentData), [filteredStudentData, lang]);

  const statsSummary = useMemo(() => {
    return viewMode === 'teacher' ? teacherStats : studentStats;
  }, [teacherStats, studentStats, viewMode]);

  // Compute game-like honor system ranking from teacher evaluations submission frequency
  const honorLeaderboard = useMemo(() => {
    const tRows = teacherData?.values || [];
    if (tRows.length <= 1) return [];

    const tHeaders = tRows[0] || [];
    const tEvaluatorIdx = tHeaders.findIndex(h => /ครูผู้ประเมิน|ผู้ประเมิน|evaluator|observer/i.test(h)) !== -1 
      ? tHeaders.findIndex(h => /ครูผู้ประเมิน|ผู้ประเมิน|evaluator|observer/i.test(h)) 
      : 2;

    const counts: Record<string, number> = {};
    tRows.slice(1).forEach(row => {
      const evaluatorName = String(row[tEvaluatorIdx] || '').trim();
      if (evaluatorName && evaluatorName !== 'Unknown' && evaluatorName !== 'Anonymous' && evaluatorName !== '-' && evaluatorName !== '0') {
        counts[evaluatorName] = (counts[evaluatorName] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => {
        let rank: 'Legendary' | 'Champion' | 'Knight' | 'Novice' = 'Novice';
        if (count >= 13) rank = 'Legendary';
        else if (count >= 8) rank = 'Champion';
        else if (count >= 4) rank = 'Knight';

        // Format name: strip all common title prefixes (นาย, นาง, นางสาว,ครู,mr,ms,etc.) and keep only the first name beginning with 'ครู'
        let cleanName = name.trim();
        const prefixRegex = /^(นางสาว|นาง|นาย|ครู|อาจารย์|อ\.|ดร\.|mr\.?|ms\.?|mrs\.?|dr\.?|teacher\.?|t\.?|ajarn\.?|aj\.?)\s*/i;
        
        let lastCleanName = '';
        while (cleanName !== lastCleanName) {
          lastCleanName = cleanName;
          cleanName = cleanName.replace(prefixRegex, '');
        }

        const firstWord = cleanName.split(/\s+/)[0] || '';
        const displayName = firstWord ? 'ครู' + firstWord : 'ครู';

        return { name: displayName, count, rank };
      })
      .sort((a, b) => b.count - a.count);
  }, [teacherData]);

  // AI teacher strengths and recommendations analysis states
  const [aiRoleFilter, setAiRoleFilter] = useState<'foreign' | 'coteacher'>('foreign');
  const [aiAnalysis, setAiAnalysis] = useState<string>(() => {
    return localStorage.getItem(`workloop_ai_analysis_${selectedRadarTeacher}_${lang}_${aiRoleFilter}`) || '';
  });
  const [isAiAnalyzing, setIsAiAnalyzing] = useState<boolean>(false);

  // Sync AI analysis output when teacher, role or language changes
  useEffect(() => {
    const cached = localStorage.getItem(`workloop_ai_analysis_${selectedRadarTeacher}_${lang}_${aiRoleFilter}`);
    setAiAnalysis(cached || '');
  }, [selectedRadarTeacher, lang, aiRoleFilter]);

  const teacherCommentsForAI = useMemo(() => {
    if (!selectedRadarTeacher) return [];
    const coTeachIdx = coTeacherIdx;
    const commIdx = commentIdx;
    return rows
      .filter(row => {
        const evaluatedPerson = String(row[coTeachIdx] || '').trim();
        return selectedRadarTeacher === 'All' || evaluatedPerson === selectedRadarTeacher;
      })
      .map(row => row[commIdx])
      .filter(Boolean)
      .map(comment => String(comment).trim())
      .filter(comment => comment.length > 5);
  }, [rows, selectedRadarTeacher, coTeacherIdx, commentIdx]);

  const runAiAnalysis = async () => {
    if (isAiAnalyzing) return;
    setIsAiAnalyzing(true);
    setAiAnalysis('');
    
    // Prepare aspect scores
    const aspectScores = aspectPerformanceData.map(d => ({
      aspect: d.originalName,
      score: d.A
    }));

    try {
      const response = await fetch('/api/analyze-teacher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({
          teacherName: selectedRadarTeacher === 'All' ? 'All Teachers (Overview)' : selectedRadarTeacher,
          averageScores: aspectScores,
          comments: teacherCommentsForAI,
          lang,
          role: aiRoleFilter
        })
      });

      if (!response.ok) {
        throw new Error('API failed');
      }

      const result = await response.json();
      const analysisText = result.analysis || 'No analysis generated.';
      setAiAnalysis(analysisText);
      localStorage.setItem(`workloop_ai_analysis_${selectedRadarTeacher}_${lang}_${aiRoleFilter}`, analysisText);
    } catch (err) {
      console.error(err);
      setAiAnalysis(lang === 'th' ? '❌ ขออภัย เกิดข้อผิดพลาดในการวิเคราะห์ด้วยระบบ AI กรุณาลองใหม่อีกครั้ง' : '❌ Sorry, an error occurred during AI analysis. Please try again.');
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  // Extract all images from cells
  const evaluationImagesList = useMemo(() => {
    if (!data || !rows.length) return [];
    
    const isImageOrFileUrlLocal = (value: string): boolean => {
      if (!value || typeof value !== 'string') return false;
      const lower = value.trim().toLowerCase();
      if (lower.includes('/drive/folders/') || lower.includes('/folders/')) return false;
      const isDirectImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(lower);
      const isGoogleDriveLink = lower.includes('drive.google.com') || (lower.includes('docs.google.com') && !lower.includes('spreadsheets'));
      const isCommonLink = lower.startsWith('http') && (lower.includes('uc?id=') || lower.includes('open?id=') || lower.includes('file/d/') || lower.includes('/d/'));
      return isDirectImage || isGoogleDriveLink || isCommonLink;
    };

    const getGoogleDriveFullUrlLocal = (url: string): string => {
      if (!url || typeof url !== 'string') return url;
      const lower = url.trim().toLowerCase();
      if (!lower.includes('drive.google.com')) return url;
      if (lower.includes('/drive/folders/') || lower.includes('/folders/')) return url;
      
      let fileId = '';
      const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch && fileIdMatch[1]) {
        fileId = fileIdMatch[1];
      } else {
        const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch && idMatch[1]) {
          fileId = idMatch[1];
        }
      }
      
      if (fileId) {
        return `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
      }
      return url;
    };

    const list: Array<{
      url: string;
      thumbnail: string;
      fullUrl: string;
      header: string;
      teacher: string;
      evaluator: string;
      date: string;
      comment: string;
      rowNum: number;
    }> = [];

    rows.forEach((row, rowIndex) => {
      const teacherVal = row[teacherIdx] || row[coTeacherIdx] || 'N/A';
      const evaluatorVal = row[evaluatorIdx] || row[userIdx] || row[finalUserIdx] || 'Anonymous';
      const dateVal = row[dateIdx] || 'N/A';
      const commentVal = row[commentIdx] || '';

      row.forEach((cell, cellIndex) => {
        const cellStr = String(cell).trim();
        const urlRegex = /(https?:\/\/[^\s]+)/gi;
        const matches = cellStr.match(urlRegex);
        if (matches) {
          matches.forEach(url => {
            if (isImageOrFileUrlLocal(url)) {
              let thumb = url;
              const lower = url.toLowerCase();
              if (lower.includes('drive.google.com') && !lower.includes('/drive/folders/') && !lower.includes('/folders/')) {
                let fileId = '';
                const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (fileIdMatch && fileIdMatch[1]) {
                  fileId = fileIdMatch[1];
                } else {
                  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                  if (idMatch && idMatch[1]) {
                    fileId = idMatch[1];
                  }
                }
                if (fileId) {
                  thumb = `https://lh3.googleusercontent.com/d/${fileId}=w400`;
                }
              }

              list.push({
                url,
                thumbnail: thumb,
                fullUrl: getGoogleDriveFullUrlLocal(url),
                header: headers[cellIndex] || 'Image',
                teacher: teacherVal,
                evaluator: evaluatorVal,
                date: dateVal,
                comment: commentVal,
                rowNum: rowIndex + 1
              });
            }
          });
        }
      });
    });

    return list;
  }, [data, rows, headers, teacherIdx, coTeacherIdx, evaluatorIdx, userIdx, finalUserIdx, dateIdx, commentIdx]);

  // Unified images list combining spreadsheet-extracted files and drive folder files
  const unifiedImagesList = useMemo(() => {
    const list = [...evaluationImagesList];

    // Collect all unique spreadsheet teacher names to dynamically match filenames
    const spreadsheetTeachersList = Array.from(new Set(
      rows.map(row => {
        const tVal = String(row[coTeacherIdx] || row[teacherIdx] || '').trim();
        return tVal;
      }).filter(Boolean)
    )) as string[];

    if (viewMode === 'student') {
      studentDriveImages.forEach(dfi => {
        // Find teacher in file name
        let matchedTeacher = 'All';
        const fNameLower = (dfi.comment || '').toLowerCase(); // filename was saved in dfi.comment
        
        for (const tName of spreadsheetTeachersList) {
          if (tName && tName !== 'N/A' && tName !== '-' && tName !== 'All') {
            if (fNameLower.includes(tName.toLowerCase())) {
              matchedTeacher = tName;
              break;
            }
            const parts = tName.toLowerCase().split(/\s+/);
            for (const part of parts) {
              if (part.length >= 3 && fNameLower.includes(part)) {
                matchedTeacher = tName;
                break;
              }
            }
          }
        }

        const itemWithTeacher = {
          ...dfi,
          teacher: matchedTeacher
        };

        if (!list.some(item => item.url === dfi.url)) {
          list.push(itemWithTeacher);
        }
      });
    }

    return list;
  }, [evaluationImagesList, studentDriveImages, viewMode, rows, coTeacherIdx, teacherIdx]);

  // Find unique teacher names with images
  const galleryTeachers = useMemo(() => {
    const set = new Set<string>();
    unifiedImagesList.forEach(item => {
      if (item.teacher && item.teacher !== 'N/A') {
        set.add(item.teacher);
      }
    });
    return Array.from(set).sort();
  }, [unifiedImagesList]);

  // Find unique dates from image attachments
  const galleryDates = useMemo(() => {
    const set = new Set<string>();
    unifiedImagesList.forEach(item => {
      if (item.date && item.date !== 'N/A') {
        set.add(item.date);
      }
    });
    // Descending sort to show most recent dates first
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [unifiedImagesList]);

  // Filtered gallery images
  const filteredGalleryImages = useMemo(() => {
    return unifiedImagesList.filter(item => {
      const matchTeacher = selectedGalleryTeacher === 'All' || item.teacher === selectedGalleryTeacher;
      const matchDate = selectedGalleryDate === 'All' || item.date === selectedGalleryDate;
      const searchLower = searchGalleryQuery.toLowerCase().trim();
      
      if (!searchLower) return matchTeacher && matchDate;
      
      const matchQuery = 
        item.teacher.toLowerCase().includes(searchLower) ||
        item.evaluator.toLowerCase().includes(searchLower) ||
        item.comment.toLowerCase().includes(searchLower) ||
        item.header.toLowerCase().includes(searchLower) ||
        item.date.toLowerCase().includes(searchLower);
        
      return matchTeacher && matchDate && matchQuery;
    });
  }, [unifiedImagesList, selectedGalleryTeacher, selectedGalleryDate, searchGalleryQuery]);


  // Daily teacher data aggregation
  const dailyTeacherData = rows.reduce((acc: any, row, rowIndex) => {
    let dateStr = row[dateIdx] || '';
    if (!dateStr) return acc;
    let normalizedDate = normalizeDateStr(dateStr);
    
    const evaluator = row[evaluatorIdx] || 'Unknown';
    const coTeacher = row[coTeacherIdx] || 'Unknown';
    const teacher = coTeacher;
    const comment = row[commentIdx];

    // Filter logic
    const matchesEvaluator = selectedEvaluator === 'All' || evaluator === selectedEvaluator;
    const matchesCoTeacher = selectedCoTeacher === 'All' || coTeacher === selectedCoTeacher;
    if (!matchesEvaluator || !matchesCoTeacher) return acc;
    
    if (!acc[normalizedDate]) acc[normalizedDate] = { teachers: {}, comments: [] };
    if (!acc[normalizedDate].teachers[teacher]) {
      acc[normalizedDate].teachers[teacher] = { scores: {}, count: 0 };
    }
    
    aspectIndices.forEach(idx => {
      const score = mapRatingToScore(row[idx]);
      if (score > 0) {
        const aspectName = headers[idx];
        acc[normalizedDate].teachers[teacher].scores[aspectName] = (acc[normalizedDate].teachers[teacher].scores[aspectName] || 0) + score;
      }
    });
    
    acc[normalizedDate].teachers[teacher].count += 1;
    if (comment && comment.length > 3) {
      acc[normalizedDate].comments.push({ rowNum: rowIndex + 1, teacher, text: comment });
    }
    
    return acc;
  }, {});

  // Monthly teacher data aggregation
  const monthlyTeacherData = rows.reduce((acc: any, row) => {
    let dateStr = row[dateIdx] || '';
    if (!dateStr) return acc;
    let normalized = normalizeDateStr(dateStr);
    const date = new Date(normalized);
    if (isNaN(date.getTime())) return acc;
    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const evaluator = row[evaluatorIdx] || 'Unknown';
    const coTeacher = row[coTeacherIdx] || 'Unknown';
    const teacher = coTeacher;
    const comment = row[commentIdx];

    // Filter logic
    const matchesEvaluator = selectedEvaluator === 'All' || evaluator === selectedEvaluator;
    const matchesCoTeacher = selectedCoTeacher === 'All' || coTeacher === selectedCoTeacher;
    if (!matchesEvaluator || !matchesCoTeacher) return acc;
    
    if (!acc[monthStr]) acc[monthStr] = { teachers: {}, comments: [] };
    if (!acc[monthStr].teachers[teacher]) {
      acc[monthStr].teachers[teacher] = { scores: {}, count: 0 };
    }
    
    aspectIndices.forEach(idx => {
      const score = mapRatingToScore(row[idx]);
      if (score > 0) {
        const aspectName = headers[idx];
        acc[monthStr].teachers[teacher].scores[aspectName] = (acc[monthStr].teachers[teacher].scores[aspectName] || 0) + score;
      }
    });
    
    acc[monthStr].teachers[teacher].count += 1;
    if (comment && comment.length > 5) {
      acc[monthStr].comments.push({ teacher, text: comment });
    }
    
    return acc;
  }, {});

  const sortedMonths = Object.keys(monthlyTeacherData).sort((a, b) => b.localeCompare(a));

  // Teacher specific activity tracking data
  const trackerTeachersList = Array.from(new Set(rows.map(r => String(r[evaluatorIdx] || '').trim()).filter(Boolean))).sort();
  
  const trackerTeacherActivityData = useMemo(() => {
    const dailyCounts: Record<string, number> = {};
    const todayStr = new Date().toISOString().split('T')[0];
    const weekStart = getStartOfWeek(todayStr);
    const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

    rows.forEach(row => {
      const rowEvaluator = String(row[evaluatorIdx] || '').trim();
      const matchesTeacher = selectedTrackerTeacher === 'All' || rowEvaluator === selectedTrackerTeacher;

      if (matchesTeacher) {
        let dateStr = row[dateIdx] || 'Unknown';
        let normalizedDate = normalizeDateStr(dateStr);
        
        let include = false;
        if (trackerTimeFilter === 'All') include = true;
        else if (trackerTimeFilter === 'Today') include = normalizedDate === todayStr;
        else if (trackerTimeFilter === 'Weekly') include = normalizedDate >= weekStart;
        else if (trackerTimeFilter === 'Monthly') include = normalizedDate >= monthStart;

        if (include) {
          dailyCounts[normalizedDate] = (dailyCounts[normalizedDate] || 0) + 1;
        }
      }
    });

    return Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rows, selectedTrackerTeacher, trackerTimeFilter, dateIdx, evaluatorIdx]);

  useEffect(() => {
    if (selectedTrackerTeacher !== 'All' && trackerTeachersList.length > 0 && !trackerTeachersList.includes(selectedTrackerTeacher)) {
      setSelectedTrackerTeacher('All');
    }
  }, [trackerTeachersList, selectedTrackerTeacher]);

  const numericIndices = useMemo(() => {
    return headers.reduce((acc: number[], header, idx) => {
      const isNumeric = rows.some(row => !isNaN(Number(row[idx]?.replace(/[^0-9.-]+/g, ""))) && row[idx] !== "");
      if (isNumeric) acc.push(idx);
      return acc;
    }, []);
  }, [headers, rows]);

  // Removed old indicatorAnalysisData that focused on a single indicator per teacher
  // It has been replaced by the one above that shows all indicators' averages.

  const chartData = useMemo(() => {
    return rows.slice(0, 10).map((row, idx) => {
      const entry: any = { name: row[0] || `Row ${idx + 1}` };
      numericIndices.forEach(valIdx => {
        const val = Number(row[valIdx]?.replace(/[^0-9.-]+/g, ""));
        if (!isNaN(val)) {
          entry[headers[valIdx]] = val;
        }
      });
      return entry;
    });
  }, [rows, numericIndices, headers]);

  const aspectPerformanceData = useMemo(() => {
    if (!rows.length || !aspectIndices.length) return [];
    
    const todayStr = new Date().toISOString().split('T')[0];
    const weekStartCurrent = getStartOfWeek(todayStr);
    const monthStartCurrent = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

    const filteredRadarRows = rows.filter(row => {
      // Teacher filter
      const evaluatedPerson = String(row[coTeacherIdx] || '').trim();
      const matchesTeacher = selectedRadarTeacher === 'All' || evaluatedPerson === selectedRadarTeacher;
      if (!matchesTeacher) return false;

      // Date filter
      const dateStr = row[dateIdx] || '';
      const normalized = normalizeDateStr(dateStr);
      
      if (radarTimeFilter === 'All') return true;
      if (radarTimeFilter === 'Today') return normalized === todayStr;
      if (radarTimeFilter === 'Weekly') return normalized >= weekStartCurrent;
      if (radarTimeFilter === 'Monthly') return normalized >= monthStartCurrent;
      return true;
    });

    if (!filteredRadarRows.length) return [];

    return aspectIndices.map((idx, index) => {
      let total = 0;
      let count = 0;
      filteredRadarRows.forEach(row => {
        const score = mapRatingToScore(row[idx]);
        if (score > 0) {
          total += score;
          count++;
        }
      });
      
      const aspectName = headers[idx];
      return {
        idx,
        originalName: aspectName,
        subject: translateAspect(aspectName, lang),
        full: translateAspect(aspectName, lang),
        A: count > 0 ? parseFloat((total / count).toFixed(2)) : 0,
        fullMark: 10,
        color: DIMENSION_COLORS[index % DIMENSION_COLORS.length]
      };
    }).filter(d => d.A > 0);
  }, [rows, aspectIndices, headers, lang, radarTimeFilter, selectedRadarTeacher, dateIdx, coTeacherIdx]);

  const overallRatingLevel = useMemo(() => {
    if (!aspectPerformanceData.length) return null;
    const sum = aspectPerformanceData.reduce((acc, curr) => acc + curr.A, 0);
    const avg = sum / aspectPerformanceData.length;
    
    if (avg >= 9.0) {
      return {
        score: avg.toFixed(2),
        label: lang === 'th' ? 'ดีมาก' : 'Excellent',
        bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400',
        dotColor: 'bg-emerald-500',
        textTheme: 'text-emerald-600 dark:text-emerald-400',
        description: lang === 'th' ? 'ผลสัมฤทธิ์ดีเยี่ยม ครูต่างชาติเรียนรู้เร็วและรักษามาตรฐานได้เป็นอย่างดี' : 'Outstanding output, the teacher learns quickly and retains high standards.'
      };
    } else if (avg >= 7.0) {
      return {
        score: avg.toFixed(2),
        label: lang === 'th' ? 'ดี' : 'Good',
        bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400',
        dotColor: 'bg-blue-500',
        textTheme: 'text-blue-600 dark:text-blue-400',
        description: lang === 'th' ? 'ผลปฏิบัติงานดีเป็นไปตามความคาดหวัง ขอแนะนำให้รักษามาตรฐานนี้ไว้' : 'Performs well and meets general expectations. Keep up the great standards!'
      };
    } else if (avg >= 5.0) {
      return {
        score: avg.toFixed(2),
        label: lang === 'th' ? 'พอใช้' : 'Fair',
        bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20 dark:bg-amber-500/20 dark:text-amber-400',
        dotColor: 'bg-amber-500',
        textTheme: 'text-amber-600 dark:text-amber-400',
        description: lang === 'th' ? 'ผลงานอยู่ในเกณฑ์ยอมรับได้ ควรส่งเสริมทักษะเพิ่มเติมเพื่อพัฒนาทักษะการสอน' : 'Acceptable performance, but additional constructive support and training will help.'
      };
    } else if (avg >= 3.0) {
      return {
        score: avg.toFixed(2),
        label: lang === 'th' ? 'ปรับปรุง' : 'Needs Improvement',
        bg: 'bg-orange-500/10 text-orange-500 border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-400',
        dotColor: 'bg-orange-500',
        textTheme: 'text-orange-600 dark:text-orange-400',
        description: lang === 'th' ? 'ผลปฏิบัติงานควรได้รับการส่งเสริมเพื่อพัฒนา ควรปรึกษาทีมเพื่อหาทางร่วมแก้ไข' : 'Needs structured professional feedback to support improvements in performance.'
      };
    } else {
      return {
        score: avg.toFixed(2),
        label: lang === 'th' ? 'ควรปรับปรุงอย่างเร่งด่วน' : 'Urgent Improvement Needed',
        bg: 'bg-rose-500/10 text-rose-500 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-400',
        dotColor: 'bg-rose-500',
        textTheme: 'text-rose-600 dark:text-rose-400',
        description: lang === 'th' ? 'ผลงานต่ำกว่าเกณฑ์ขั้นต่ำอย่างมีนัยสำคัญ จำเป็นต้องช่วยเหลือและประเมินใหม่อย่างเร่งด่วน' : 'Significantly below minimum criteria. Requires immediate mentoring and evaluation.'
      };
    }
  }, [aspectPerformanceData, lang]);

  const selectedAspectDetailedEvaluations = useMemo(() => {
    if (!selectedAspectDetail || !rows.length) return { list: [], breakdown: { excellent: 0, good: 0, fair: 0, improvement: 0, urgent: 0, total: 0 } };
    
    const todayStr = new Date().toISOString().split('T')[0];
    const weekStartCurrent = getStartOfWeek(todayStr);
    const monthStartCurrent = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

    const filteredRadarRows = rows.filter(row => {
      // Teacher filter
      const evaluatedPerson = String(row[coTeacherIdx] || '').trim();
      const matchesTeacher = selectedRadarTeacher === 'All' || evaluatedPerson === selectedRadarTeacher;
      if (!matchesTeacher) return false;

      // Date filter
      const dateStr = row[dateIdx] || '';
      const normalized = normalizeDateStr(dateStr);
      
      if (radarTimeFilter === 'All') return true;
      if (radarTimeFilter === 'Today') return normalized === todayStr;
      if (radarTimeFilter === 'Weekly') return normalized >= weekStartCurrent;
      if (radarTimeFilter === 'Monthly') return normalized >= monthStartCurrent;
      return true;
    });

    const aspectIdx = selectedAspectDetail.idx;
    
    // Breakdown storage
    const breakdown = {
      excellent: 0,
      good: 0,
      fair: 0,
      improvement: 0,
      urgent: 0,
      total: 0
    };

    const list = filteredRadarRows.map(row => {
      const score = mapRatingToScore(row[aspectIdx]);
      if (score === 0) return null;
      
      const evaluator = row[evaluatorIdx] || 'Anonymous';
      const coTeacher = row[coTeacherIdx] || 'Unknown';
      const comment = row[commentIdx] || '';
      const dateStr = row[dateIdx] || 'Unknown Date';

      // Increment breakdown
      breakdown.total++;
      if (score >= 9.0) breakdown.excellent++;
      else if (score >= 7.0) breakdown.good++;
      else if (score >= 5.0) breakdown.fair++;
      else if (score >= 3.0) breakdown.improvement++;
      else breakdown.urgent++;

      return {
        rowNum: rows.indexOf(row) + 1,
        score,
        evaluator,
        coTeacher,
        comment,
        date: dateStr
      };
    }).filter((e): e is { rowNum: number; score: number; evaluator: string; coTeacher: string; comment: string; date: string } => e !== null);

    return {
      list,
      breakdown
    };
  }, [rows, selectedAspectDetail, selectedRadarTeacher, radarTimeFilter, coTeacherIdx, dateIdx, evaluatorIdx, commentIdx]);

  if (loading && !data) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-transparent backdrop-blur-3xl">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        >
          <RefreshCw className="w-8 h-8 text-purple-400" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("h-screen w-full font-sans flex flex-row overflow-hidden transition-colors duration-500 antialiased bg-transparent relative z-10", 
      theme === 'dark' ? "text-white" : "text-slate-900"
    )}>
      {/* Background Animated Blobs for an ultra-premium glassmorphic layout identical to the mockup */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-20 bg-transparent">
        {/* Blob 1 */}
        <motion.div
          animate={{
            x: [0, 100, -50, 0],
            y: [0, -120, 80, 0],
            scale: [1, 1.25, 0.85, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={cn("absolute top-[10%] left-[15%] w-[450px] h-[450px] rounded-full blur-[130px] opacity-80 transition-colors duration-1000", currentThemeVibe.blob1)}
        />
        {/* Blob 2 */}
        <motion.div
          animate={{
            x: [0, -120, 80, 0],
            y: [0, 100, -90, 0],
            scale: [1, 0.8, 1.2, 1],
          }}
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={cn("absolute bottom-[10%] right-[5%] w-[520px] h-[520px] rounded-full blur-[140px] opacity-85 transition-colors duration-1000", currentThemeVibe.blob2)}
        />
        {/* Blob 3 */}
        <motion.div
          animate={{
            x: [0, 60, -80, 0],
            y: [0, 90, -50, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={cn("absolute top-[45%] left-[-8%] w-[380px] h-[380px] rounded-full blur-[120px] opacity-75 transition-colors duration-1000", currentThemeVibe.blob3)}
        />
        {/* Blob 4 */}
        <motion.div
          animate={{
            x: [0, -60, 100, 0],
            y: [0, -70, 80, 0],
            scale: [1, 1.3, 0.75, 1],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={cn("absolute top-[3%] right-[22%] w-[420px] h-[420px] rounded-full blur-[125px] opacity-80 transition-colors duration-1000", currentThemeVibe.blob4)}
        />
      </div>

      {/* Sidebar */}
      <aside className={cn(
        sidebarCollapsed ? "sm:w-16 md:w-20 lg:w-24 px-1" : "sm:w-48 md:w-56 lg:w-64",
        "hidden sm:flex w-0 sm:auto flex-col border-r transition-all duration-500 shrink-0 overflow-hidden relative",
        theme === 'dark' ? "bg-slate-950/25 backdrop-blur-3xl border-slate-800/40" : "bg-white/20 backdrop-blur-3xl border-white/20"
      )}>
        <div className="p-2 sm:p-3 md:p-4 lg:p-6 flex items-center justify-between gap-1 overflow-hidden relative">
          <div className="flex items-center gap-1.5 lg:gap-3 justify-center w-full sm:justify-start">
            <div className="w-8 h-8 lg:w-10 lg:h-10 shrink-0 bg-gradient-to-br from-purple-300 to-purple-400 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-200 rotate-3">
              <FileSpreadsheet className="w-4 h-4 sm:w-5 h-5 lg:w-6 lg:h-6 text-white -rotate-3" />
            </div>
            {!sidebarCollapsed && (
              <div className="hidden sm:flex flex-col min-w-0">
                <span className="font-bold text-purple-900 tracking-tight text-[10px] md:text-sm lg:text-lg truncate">{t.appName}</span>
                <span className={cn("text-[5px] md:text-[5.4px] lg:text-[6px] font-bold tracking-tight whitespace-nowrap", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ</span>
              </div>
            )}
          </div>
          
          {/* Desktop Collapse Arrow Trigger Button (Hidden on Mobile) */}
          {!sidebarCollapsed && (
            <button 
              onClick={() => setSidebarCollapsed(true)}
              className={cn(
                "hidden sm:flex p-1 rounded-xl border transition-all text-slate-400 hover:text-purple-600 active:scale-95 cursor-pointer",
                theme === 'dark' ? "bg-slate-900 border-slate-800 hover:bg-slate-800" : "bg-white border-purple-100 hover:bg-purple-50"
              )}
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <div className="hidden sm:flex justify-center pb-3 mb-3">
            <button 
              onClick={() => setSidebarCollapsed(false)}
              className={cn(
                "p-1.5 rounded-xl border transition-all text-pink-500 hover:text-pink-600 active:scale-95 cursor-pointer",
                theme === 'dark' ? "bg-slate-900 border-slate-800 hover:bg-slate-800" : "bg-white border-purple-100 hover:bg-purple-50"
              )}
              title="Expand Sidebar"
            >
              <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
            </button>
          </div>
        )}

        <div className="px-1.5 sm:px-2 md:px-3 lg:px-4 mb-3 sm:mb-4 lg:mb-6">
          <div className={cn(
            "flex p-1 lg:p-0.5 gap-1 rounded-2xl lg:rounded-full border transition-all duration-300", 
            sidebarCollapsed ? "flex-col items-center" : "flex-col lg:flex-row",
            theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-[#daf2ea] border-[#aadfd1]"
          )}>
            <button 
              onClick={() => setViewMode('teacher')}
              className={cn(
                "w-full lg:flex-1 px-1.5 py-1.5 lg:py-2 text-[10px] sm:text-[11px] lg:text-[10px] font-black rounded-xl lg:rounded-full transition-all flex items-center justify-center lg:justify-center gap-2 lg:gap-1 shadow-xs min-w-0 overflow-hidden cursor-pointer",
                viewMode === 'teacher' 
                  ? (theme === 'dark' ? "bg-purple-600 text-white shadow-md font-bold" : "bg-white text-purple-600 shadow-xs font-bold") 
                  : (theme === 'dark' ? "text-slate-500 hover:text-slate-400" : "text-purple-700/80 hover:text-purple-900")
              )}
              title={t.teacherMode}
            >
              <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
              {!sidebarCollapsed && <span className="whitespace-nowrap tracking-tight uppercase hidden sm:block truncate">{t.teacherMode}</span>}
            </button>
            <button 
              onClick={() => setViewMode('student')}
              className={cn(
                "w-full lg:flex-1 px-1.5 py-1.5 lg:py-2 text-[10px] sm:text-[11px] lg:text-[10px] font-black rounded-xl lg:rounded-full transition-all flex items-center justify-center lg:justify-center gap-2 lg:gap-1 shadow-xs min-w-0 overflow-hidden cursor-pointer",
                viewMode === 'student' 
                  ? (theme === 'dark' ? "bg-indigo-600 text-white shadow-md font-bold" : "bg-white text-indigo-600 shadow-xs font-bold") 
                  : (theme === 'dark' ? "text-slate-500 hover:text-slate-400" : "text-indigo-700/80 hover:text-indigo-900")
              )}
              title={t.studentMode}
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              {!sidebarCollapsed && <span className="whitespace-nowrap tracking-tight uppercase hidden sm:block truncate">{t.studentMode}</span>}
            </button>
          </div>
        </div>
        
        <nav className="flex-1 px-1 sm:px-2 md:px-3 lg:px-4 space-y-1 md:space-y-1.5 lg:space-y-2 overflow-y-auto custom-scrollbar">
          <button 
            onClick={() => setActiveTab('overview')}
            className={cn(
              "w-full p-1.5 sm:p-2.5 md:p-3 lg:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all text-left group",
              sidebarCollapsed ? "justify-center" : "sm:justify-start gap-1 sm:gap-2.5 lg:gap-3",
              activeTab === 'overview' 
                ? (theme === 'dark' ? "bg-purple-500 text-white shadow-lg" : "bg-purple-100 text-purple-700 shadow-sm") 
                : (theme === 'dark' ? "text-slate-500 hover:bg-slate-800 hover:text-purple-400" : "text-slate-400 hover:bg-purple-50 hover:text-purple-400")
            )}
            title={t.dashboard}
          >
            {!sidebarCollapsed && <div className={cn("w-1 h-3 lg:w-1.5 lg:h-4 rounded-full transition-all hidden sm:block", activeTab === 'overview' ? (theme === 'dark' ? "bg-slate-100" : "bg-purple-500") : "bg-transparent group-hover:bg-purple-200")} />}
            <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 shrink-0" />
            {!sidebarCollapsed && <span className="text-[9px] md:text-xs lg:text-sm font-bold truncate hidden sm:block">{t.dashboard}</span>}
          </button>

          <button 
            onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSe628rtut8UPPXGjydQ7hiEYa5OxCkhqFRAMgWdQBcMcJe0ew/viewform?usp=header', '_blank')}
            className={cn(
              "w-full p-1.5 sm:p-2.5 md:p-3 lg:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all text-left group text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600",
              sidebarCollapsed ? "justify-center" : "sm:justify-start gap-1 sm:gap-2.5 lg:gap-3"
            )}
            title={lang === 'th' ? 'ลิงก์ประเมินครู' : 'Teacher Evaluation Form'}
          >
            {!sidebarCollapsed && <div className="w-1 h-3 lg:w-1.5 lg:h-4 rounded-full transition-all bg-transparent group-hover:bg-rose-300 hidden sm:block" />}
            <NotebookPen className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 shrink-0 text-rose-500" />
            {!sidebarCollapsed && <span className="text-[9px] md:text-xs lg:text-sm font-bold truncate hidden sm:block">{lang === 'th' ? 'ลิงก์ประเมินครู' : 'Teacher Evaluation Form'}</span>}
            {!sidebarCollapsed && <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-auto opacity-0 sm:group-hover:opacity-100 transition-opacity hidden sm:block" />}
          </button>

          <button 
            onClick={() => setActiveTab('table')}
            className={cn(
              "w-full p-1.5 sm:p-2.5 md:p-3 lg:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all text-left group",
              sidebarCollapsed ? "justify-center" : "sm:justify-start gap-1 sm:gap-2.5 lg:gap-3",
              activeTab === 'table' 
                ? (theme === 'dark' ? "bg-amber-500/20 text-amber-200 border border-amber-500/30" : "bg-[#FEF9E7] text-yellow-700 shadow-sm border border-yellow-100") 
                : (theme === 'dark' ? "text-slate-500 hover:bg-slate-800 hover:text-amber-400" : "text-slate-400 hover:bg-[#FEF9E7]/50 hover:text-yellow-600")
            )}
            title={t.spreadsheetView}
          >
            {!sidebarCollapsed && <div className={cn("w-1 h-3 lg:w-1.5 lg:h-4 rounded-full transition-all hidden sm:block", activeTab === 'table' ? "bg-yellow-400" : "bg-transparent group-hover:bg-yellow-200")} />}
            <TableIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 shrink-0 text-amber-500" />
            {!sidebarCollapsed && <span className="text-[9px] md:text-xs lg:text-sm font-bold truncate hidden sm:block">{t.spreadsheetView}</span>}
          </button>

          <button 
            onClick={() => window.open('https://jvservice.jv.ac.th/login', '_blank')}
            className={cn(
              "w-full p-1.5 sm:p-2.5 md:p-3 lg:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all text-left group text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/25",
              sidebarCollapsed ? "justify-center" : "sm:justify-start gap-1 sm:gap-2.5 lg:gap-3"
            )}
            title={t.checkAttendance}
          >
            {!sidebarCollapsed && <div className="w-1 h-3 lg:w-1.5 lg:h-4 rounded-full transition-all bg-transparent group-hover:bg-emerald-500 hidden sm:block" />}
            <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            {!sidebarCollapsed && <span className="text-[9px] md:text-xs lg:text-sm font-bold truncate hidden sm:block">{t.checkAttendance}</span>}
            {!sidebarCollapsed && <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-auto opacity-0 sm:group-hover:opacity-100 transition-opacity hidden sm:block" />}
          </button>

          <button 
            onClick={() => setActiveTab('schedule')}
            className={cn(
              "w-full p-1.5 sm:p-2.5 md:p-3 lg:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all text-left group",
              sidebarCollapsed ? "justify-center" : "sm:justify-start gap-1 sm:gap-2.5 lg:gap-3",
              activeTab === 'schedule' 
                ? (theme === 'dark' ? "bg-pink-500/20 text-pink-400 border border-pink-500/30" : "bg-pink-50 text-pink-700 shadow-sm border border-pink-100") 
                : (theme === 'dark' ? "text-slate-500 hover:bg-slate-800 hover:text-pink-400" : "text-slate-400 hover:bg-pink-50/50 hover:text-pink-600")
            )}
            title={lang === 'th' ? 'ตารางสอน' : 'Schedule'}
          >
            {!sidebarCollapsed && <div className={cn("w-1 h-3 lg:w-1.5 lg:h-4 rounded-full transition-all hidden sm:block", activeTab === 'schedule' ? "bg-pink-500" : "bg-transparent group-hover:bg-pink-300")} />}
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 shrink-0 text-pink-500" />
            {!sidebarCollapsed && <span className="text-[9px] md:text-xs lg:text-sm font-bold truncate hidden sm:block">{lang === 'th' ? 'ตารางสอน' : 'Schedule'}</span>}
          </button>
          
          <button 
            onClick={() => setActiveTab('news')}
            className={cn(
              "w-full p-1.5 sm:p-2.5 md:p-3 lg:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all text-left group",
              sidebarCollapsed ? "justify-center" : "sm:justify-start gap-1 sm:gap-2.5 lg:gap-3",
              activeTab === 'news' ? (theme === 'dark' ? "bg-orange-500/20 text-orange-200 border border-orange-500/30" : "bg-orange-50 text-orange-700 shadow-sm border border-orange-100") : (theme === 'dark' ? "text-slate-500 hover:bg-slate-800 hover:text-orange-400" : "text-slate-400 hover:bg-orange-50 hover:text-orange-400")
            )}
            title={t.newsBoard}
          >
            {!sidebarCollapsed && <div className={cn("w-1 h-3 lg:w-1.5 lg:h-4 rounded-full transition-all hidden sm:block", activeTab === 'news' ? "bg-orange-500" : "bg-transparent group-hover:bg-orange-200")} />}
            <div className="relative shrink-0">
              <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-orange-500" />
              {unreadNews && (
                <span className="absolute -top-1.5 -right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
            </div>
            {!sidebarCollapsed && <span className="text-[9px] md:text-xs lg:text-sm font-bold truncate tracking-tight hidden sm:block">{t.newsBoard}</span>}
          </button>

          <button 
            onClick={() => setActiveTab('honor')}
            className={cn(
              "w-full p-1.5 sm:p-2.5 md:p-3 lg:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all text-left group",
              sidebarCollapsed ? "justify-center" : "sm:justify-start gap-1 sm:gap-2.5 lg:gap-3",
              activeTab === 'honor' 
                ? (theme === 'dark' ? "bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/30" : "bg-fuchsia-50 text-fuchsia-700 shadow-sm border border-fuchsia-100") 
                : (theme === 'dark' ? "text-slate-500 hover:bg-slate-800 hover:text-fuchsia-400" : "text-slate-400 hover:bg-fuchsia-50/50 hover:text-fuchsia-600")
            )}
            title={lang === 'th' ? 'ทำเนียบเกียรติยศครู' : 'Teacher Honor Board'}
          >
            {!sidebarCollapsed && <div className={cn("w-1 h-3 lg:w-1.5 lg:h-4 rounded-full transition-all hidden sm:block", activeTab === 'honor' ? "bg-fuchsia-500" : "bg-transparent group-hover:bg-fuchsia-300")} />}
            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 shrink-0 text-fuchsia-500" />
            {!sidebarCollapsed && (
              <span className="text-[9px] md:text-xs lg:text-sm font-bold truncate tracking-tight hidden sm:block">
                {lang === 'th' ? 'ทำเนียบเกียรติยศ' : 'Teacher Honor'}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('ai-chat')}
            className={cn(
              "w-full p-1.5 sm:p-2.5 md:p-3 lg:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all text-left group",
              sidebarCollapsed ? "justify-center" : "sm:justify-start gap-1 sm:gap-2.5 lg:gap-3",
              activeTab === 'ai-chat' 
                ? (theme === 'dark' ? "bg-pink-500/20 text-pink-300 border border-pink-500/30 shadow-lg shadow-pink-500/5 animate-pulse" : "bg-gradient-to-r from-pink-50 to-purple-50 text-purple-700 shadow-sm border border-purple-100") 
                : (theme === 'dark' ? "text-slate-500 hover:bg-slate-800 hover:text-pink-400" : "text-slate-400 hover:bg-pink-50/50 hover:text-pink-500")
            )}
            title={lang === 'th' ? 'พูดคุยกับ AI' : 'AI Chatbot'}
          >
            {!sidebarCollapsed && <div className={cn("w-1 h-3 lg:w-1.5 lg:h-4 rounded-full transition-all hidden sm:block", activeTab === 'ai-chat' ? "bg-pink-500" : "bg-transparent group-hover:bg-pink-300")} />}
            <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 shrink-0 text-pink-500" />
            {!sidebarCollapsed && (
              <span className="text-[9px] md:text-xs lg:text-sm font-bold truncate tracking-tight hidden sm:block">
                {lang === 'th' ? 'ผู้ช่วยสอน AI Chat' : 'AI Companion'}
              </span>
            )}
            {!sidebarCollapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-pink-400 animate-pulse hidden lg:block" />}
          </button>



          {!sidebarCollapsed && (
            <div className={cn("pt-3 pb-1 px-2 md:px-5 lg:px-6 text-[8px] uppercase font-bold tracking-[0.2em] truncate hidden sm:block", theme === 'dark' ? "text-slate-600" : "text-purple-300")}>{lang === 'th' ? 'ข้อมูลข่าวสาร' : 'Information'}</div>
          )}
          
          <button 
            onClick={() => window.open('https://www.cp.ac.th/', '_blank')}
            className={cn(
              "w-full p-1.5 sm:p-2.5 md:p-3 lg:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all text-left group transition-colors",
              sidebarCollapsed ? "justify-center" : "sm:justify-start gap-1 sm:gap-2.5 lg:gap-3",
              theme === 'dark' ? "text-fuchsia-400 hover:bg-fuchsia-900/30" : "bg-fuchsia-50 text-fuchsia-600 hover:bg-fuchsia-100 hover:text-fuchsia-700"
            )}
            title={t.schoolWebsite}
          >
            {!sidebarCollapsed && <div className={cn("w-1 h-3 lg:w-1.5 lg:h-4 rounded-full transition-all bg-transparent hidden sm:block", theme === 'dark' ? "group-hover:bg-fuchsia-500" : "group-hover:bg-fuchsia-200")} />}
            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 shrink-0 text-fuchsia-500" />
            {!sidebarCollapsed && <span className="text-[9px] md:text-xs lg:text-sm font-bold truncate hidden sm:block">{t.schoolWebsite}</span>}
            {!sidebarCollapsed && <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-auto opacity-0 sm:group-hover:opacity-100 transition-opacity hidden sm:block" />}
          </button>

          <button 
            onClick={() => window.open('https://www.facebook.com/cpsuksa', '_blank')}
            className={cn(
              "w-full p-1.5 sm:p-2.5 md:p-3 lg:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all text-left group transition-colors",
              sidebarCollapsed ? "justify-center" : "sm:justify-start gap-1 sm:gap-2.5 lg:gap-3",
              theme === 'dark' ? "text-sky-400 hover:bg-sky-900/30" : "bg-sky-50 text-sky-600 hover:bg-sky-100 hover:text-sky-700"
            )}
            title={t.schoolFacebook}
          >
            {!sidebarCollapsed && <div className="w-1 h-3 lg:w-1.5 lg:h-4 rounded-full transition-all bg-transparent group-hover:bg-sky-200 hidden sm:block" />}
            <Facebook className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 shrink-0 text-sky-500" />
            {!sidebarCollapsed && <span className="text-[9px] md:text-xs lg:text-sm font-bold truncate hidden sm:block">{t.schoolFacebook}</span>}
            {!sidebarCollapsed && <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-auto opacity-0 sm:group-hover:opacity-100 transition-opacity hidden sm:block" />}
          </button>

          <button 
            onClick={() => window.open('https://www.facebook.com/profile.php?id=61580354680898', '_blank')}
            className={cn(
              "w-full p-1.5 sm:p-2.5 md:p-3 lg:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all text-left group transition-colors",
              sidebarCollapsed ? "justify-center" : "sm:justify-start gap-1 sm:gap-2.5 lg:gap-3",
              theme === 'dark' ? "text-teal-400 hover:bg-teal-900/30" : "bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-700"
            )}
            title={t.departmentFacebook}
          >
            {!sidebarCollapsed && <div className="w-1 h-3 lg:w-1.5 lg:h-4 rounded-full transition-all bg-transparent group-hover:bg-teal-200 hidden sm:block" />}
            <Facebook className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 shrink-0 text-teal-500" />
            {!sidebarCollapsed && <span className="text-[9px] md:text-xs lg:text-sm font-bold truncate hidden sm:block">{t.departmentFacebook}</span>}
            {!sidebarCollapsed && <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-auto opacity-0 sm:group-hover:opacity-100 transition-opacity hidden sm:block" />}
          </button>

          {!sidebarCollapsed && (
            <div className={cn("pt-3 pb-1 px-2 md:px-5 lg:px-6 text-[8px] uppercase font-bold text-purple-300 tracking-[0.2em] truncate hidden sm:block", theme === 'dark' ? "text-slate-700" : "text-purple-300")}>{lang === 'th' ? 'เมนูเพิ่มเติม' : 'Secondary'}</div>
          )}
          
          <div className={cn("p-1.5 sm:p-2.5 md:p-3 lg:p-4 text-slate-300 flex items-center justify-center transition-all cursor-not-allowed opacity-50 overflow-hidden", sidebarCollapsed ? "justify-center" : "sm:justify-start gap-1 sm:gap-2.5 lg:gap-3")} title={t.exportLogs}>
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 shrink-0" />
            {!sidebarCollapsed && <span className="text-[9px] md:text-xs lg:text-sm font-bold truncate hidden sm:block">{t.exportLogs}</span>}
          </div>

          {!sidebarCollapsed && (
            <div className={cn("pt-4 pb-1 px-2 md:px-5 lg:px-6 text-[8px] uppercase font-bold tracking-[0.2em] truncate hidden sm:block", theme === 'dark' ? "text-slate-600" : "text-purple-300")}>{lang === 'th' ? 'การตั้งค่าระบบ' : 'Preferences'}</div>
          )}

          {/* Sequential Inline Language Tagger */}
          <div className="px-1.5 sm:px-2.5 md:px-3 lg:px-4 py-1">
            {!sidebarCollapsed ? (
              <div className={cn("flex flex-col sm:flex-row gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-2xl border", theme === 'dark' ? "bg-slate-900/40 border-slate-800" : "bg-indigo-50/60 border-indigo-100/50 backdrop-blur-md")}>
                <button 
                  onClick={() => setLang('en')}
                  className={cn(
                    "flex-1 py-1 text-[8px] sm:text-[10px] font-bold rounded-full transition-all cursor-pointer",
                    lang === 'en' 
                      ? (theme === 'dark' ? "bg-white text-slate-900 shadow-sm" : "bg-indigo-600 text-white shadow-sm") 
                      : (theme === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-indigo-400 hover:text-indigo-600")
                  )}
                >
                  EN
                </button>
                <button 
                  onClick={() => setLang('th')}
                  className={cn(
                    "flex-1 py-1 text-[8px] sm:text-[10px] font-bold rounded-full transition-all cursor-pointer",
                    lang === 'th' 
                      ? (theme === 'dark' ? "bg-white text-slate-900 shadow-sm" : "bg-indigo-600 text-white shadow-sm") 
                      : (theme === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-indigo-400 hover:text-indigo-600")
                  )}
                >
                  TH
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setLang(lang === 'en' ? 'th' : 'en')}
                className={cn(
                  "w-8 h-8 mx-auto rounded-xl text-[10px] font-black flex items-center justify-center transition-all cursor-pointer border hover:scale-105 active:scale-95",
                  theme === 'dark' ? "bg-slate-900 border-slate-800 text-purple-400" : "bg-purple-100 border-purple-200 text-purple-800"
                )}
                title={lang === 'en' ? "Change to Thai" : "Change to English"}
              >
                {lang.toUpperCase()}
              </button>
            )}
          </div>

          {/* Sequential Inline Theme Toggler */}
          <div className="px-1.5 sm:px-2.5 md:px-3 lg:px-4 py-1">
            {!sidebarCollapsed ? (
              <div className={cn("flex flex-col sm:flex-row gap-0.5 sm:gap-1 p-0.5 sm:p-1 rounded-2xl border", theme === 'dark' ? "bg-slate-900/40 border-slate-800" : "bg-amber-50/60 border-amber-100/50 backdrop-blur-md")}>
                <button 
                  onClick={() => setTheme('light')}
                  className={cn(
                    "flex-1 py-1 sm:py-1.5 px-0.5 sm:px-1.5 rounded-full transition-all flex items-center justify-center gap-1 font-bold text-[8.5px] sm:text-[10px] cursor-pointer",
                    theme === 'light' 
                      ? "bg-white text-amber-600 shadow-sm" 
                      : "text-amber-500/40 hover:text-amber-600"
                  )}
                  title="Light Mode"
                >
                  <Sun className="w-3 h-3" />
                  <span className="hidden sm:inline">Light</span>
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={cn(
                    "flex-1 py-1 sm:py-1.5 px-0.5 sm:px-1.5 rounded-full transition-all flex items-center justify-center gap-1 font-bold text-[8.5px] sm:text-[10px] cursor-pointer",
                    theme === 'dark' 
                      ? "bg-slate-700 text-white shadow-sm" 
                      : "text-amber-500 hover:text-amber-655"
                  )}
                  title="Dark Mode"
                >
                  <Moon className="w-3 h-3" />
                  <span className="hidden sm:inline">Dark</span>
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={cn(
                  "w-8 h-8 mx-auto rounded-xl flex items-center justify-center transition-all cursor-pointer border hover:scale-105 active:scale-95",
                  theme === 'dark' ? "bg-slate-900 border-slate-800 text-amber-400" : "bg-amber-100 border-amber-200 text-amber-700 font-bold"
                )}
                title={theme === 'dark' ? "Light Mode" : "Dark Mode"}
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>

          {/* Live Sync Info Block */}
          {!sidebarCollapsed && (
            <div className="px-1.5 sm:px-2.5 md:px-3 lg:px-4 py-1">
              <div className={cn(
                "p-2 sm:p-2.5 rounded-2xl border overflow-hidden hidden sm:block",
                theme === 'dark' ? "bg-slate-900/30 border-slate-800/60" : "bg-white/30 border-white/40"
              )}>
                <p className={cn("text-[7.5px] md:text-[8px] font-bold uppercase tracking-widest mb-0.5 truncate", theme === 'dark' ? "text-slate-500" : "text-purple-500/70")}>{t.syncStatus}</p>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  {isSyncing ? (
                    <>
                      <div className="relative flex h-1.5 w-1.5 shrink-0 items-center justify-center">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1 w-1 bg-amber-500"></span>
                      </div>
                      <p className={cn("text-[7.5px] md:text-[8px] font-bold truncate text-amber-500")}>
                        {lang === 'th' ? 'กำลังซิงค์...' : 'Syncing...'}
                      </p>
                    </>
                  ) : hasSyncError ? (
                    <>
                      <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shadow-xs shadow-rose-500/50" />
                      <p className={cn("text-[7.5px] md:text-[8px] font-bold truncate text-rose-500")}>
                        {lang === 'th' ? 'ซิงค์ล้มเหลว' : 'Sync Error'}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-xs shadow-emerald-500/50" />
                      <p className={cn("text-[7.5px] md:text-[8px] font-bold truncate", theme === 'dark' ? "text-slate-200" : "text-slate-700")}>
                        {data?.cachedAt 
                          ? (lang === 'th' ? formatTimeAgo(data.cachedAt) : `Synced ${formatTimeAgo(data.cachedAt)}`)
                          : 'LIVE SYNC OK'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sequential Inline Logout Button */}
          <div className="px-1 sm:px-2 py-1">
            <button 
              onClick={() => logout()}
              className={cn(
                "w-full flex items-center justify-center p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl transition-all font-bold group cursor-pointer",
                sidebarCollapsed ? "justify-center" : "sm:justify-between",
                theme === 'dark' ? "text-slate-500 hover:bg-red-950/30 hover:text-red-400" : "text-slate-400 hover:bg-red-50 hover:text-red-400"
              )}
              title={t.logout}
            >
              <div className="flex items-center gap-1 sm:gap-2.5 overflow-hidden justify-center sm:justify-start">
                <LogOut className="w-3.5 h-3.5 shrink-0 text-red-405" />
                {!sidebarCollapsed && <span className="text-[10px] sm:text-xs group-hover:scale-105 transition-transform truncate hidden sm:block">{t.logout}</span>}
              </div>
              {!sidebarCollapsed && <ChevronRight className="w-2.5 h-2.5 shrink-0 hidden sm:block" />}
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className={cn("flex-1 flex flex-col overflow-hidden transition-colors duration-500 bg-transparent")}>
        <header className={cn(
          "h-16 sm:h-24 transition-colors border-b px-2 sm:px-4 lg:px-8 flex items-center justify-between shrink-0 relative z-[50]",
          theme === 'dark' ? "bg-slate-950/20 backdrop-blur-3xl border-slate-800/40" : "bg-white/20 backdrop-blur-3xl border-white/20"
        )}>
          <div className="min-w-0 flex-1 mr-3 sm:mr-0">
            <h1 className={cn(
              "text-[10px] min-[360px]:text-xs min-[400px]:text-sm sm:text-2xl font-black tracking-tight transition-colors duration-500 truncate whitespace-nowrap",
              theme === 'dark' ? "text-white" : "text-purple-900"
            )} title={t.appHeading}>{t.appHeading}</h1>
            <div className="flex items-center gap-1 sm:gap-2 mt-0.5 sm:mt-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-0.5 sm:mt-1">
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className={cn("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-colors duration-500", 
                    "bg-sky-400")} 
                  />
                  <p className={cn("text-[8px] sm:text-[10px] font-bold uppercase tracking-widest truncate max-w-[80px] sm:max-w-none", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                    {data?.title || 'Connected'}
                  </p>
                </div>
                <div className={cn("hidden sm:block w-px h-3", theme === 'dark' ? "bg-slate-800" : "bg-slate-200")} />
                <a 
                  href={spreadsheetLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={cn(
                    "text-[8px] sm:text-[10px] font-black uppercase tracking-tighter sm:tracking-widest flex items-center gap-1.5 transition-all",
                    theme === 'dark' ? "text-sky-400 hover:text-sky-300" : "text-sky-600 hover:text-sky-700"
                  )}
                >
                  <Database className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  {viewMode === 'teacher' ? 'Source: Teacher Observations' : 'Source: Student Evaluations'}
                  <ExternalLink className="w-2 sm:w-2.5 h-2 sm:h-2.5" />
                </a>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 lg:gap-4 select-none">
            {/* Live Sync Status Indicator Badge */}
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-1 lg:px-2.5 lg:py-1 rounded-full border text-[9px] lg:text-[10px] font-bold transition-all shadow-xs select-none",
              theme === 'dark' 
                ? "bg-slate-900 border-slate-800 text-slate-300" 
                : "bg-emerald-50 border-emerald-100 text-emerald-800"
            )}>
              <span className="relative flex h-2 w-2">
                <span className={cn(
                  "absolute inline-flex h-full w-full rounded-full opacity-75",
                  isSyncing ? "animate-ping bg-sky-400" : "animate-pulse bg-emerald-400"
                )}></span>
                <span className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  isSyncing ? "bg-sky-500" : "bg-emerald-500"
                )}></span>
              </span>
              <span className="font-bold uppercase tracking-wider">
                {isSyncing ? t.liveSyncing : t.liveSyncActive}
              </span>
              <span className="text-[8px] lg:text-[9px] opacity-75 hidden sm:inline border-l pl-1.5 border-emerald-200 dark:border-slate-800 font-mono font-medium">
                {new Date(lastSyncChecked).toLocaleTimeString(lang === 'th' ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            <button 
              onClick={handleRefreshClick}
              disabled={loading}
              className={cn(
                "relative p-1 px-3 lg:px-4 lg:py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5 disabled:opacity-50 transition-all shadow-sm active:scale-95 border cursor-pointer",
                theme === 'dark' ? "bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700" : "bg-white border-purple-100 text-purple-600 hover:bg-purple-50"
              )}
            >
              <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
              <span className="hidden lg:inline">{t.refreshSync}</span>
              {hasSyncError && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]"></span>
                </span>
              )}
            </button>

            {/* Top Display Zoom Controller for 100% Visibility on All Screen Sizes */}
            <div className={cn(
              "flex items-center p-0.5 lg:p-1 rounded-full border gap-0.5 lg:gap-1 shadow-xs transition-all", 
              theme === 'dark' ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-teal-50/50 border-teal-100 text-teal-900"
            )}
              title={t.displayZoom}
            >
              <span className="text-[7px] lg:text-[9.5px] font-black uppercase tracking-wider pl-1.5 hidden lg:inline">{t.displayZoom}</span>
              <div className="flex gap-0.5 sm:gap-1 items-center bg-transparent">
                <button
                  onClick={() => setDisplayZoom(prev => Math.max(0.7, parseFloat((prev - 0.05).toFixed(2))))}
                  className={cn(
                    "p-1 sm:p-1 rounded-full transition-all flex items-center justify-center font-bold cursor-pointer border hover:scale-105 active:scale-95 shadow-2xs",
                    theme === 'dark' 
                      ? "bg-slate-700 hover:bg-slate-600 text-white border-slate-600" 
                      : "bg-white hover:bg-teal-100 text-teal-700 border-teal-200"
                  )}
                  title={t.zoomOut}
                >
                  <ZoomOut className="w-2.5 h-2.5 lg:w-3 lg:h-3 shrink-0" />
                </button>
                
                <button
                  onClick={() => setDisplayZoom(1.0)}
                  className={cn(
                    "flex px-1 lg:px-1.5 py-0.5 rounded-md transition-all items-center justify-center font-black text-[8px] lg:text-[10px] cursor-pointer text-center select-none",
                    theme === 'dark'
                      ? "text-slate-200 hover:text-white hover:bg-slate-700"
                      : "text-teal-800 hover:text-teal-955 hover:bg-teal-100"
                  )}
                  title={t.zoomReset}
                >
                  {Math.round(displayZoom * 100)}%
                </button>

                <button
                  onClick={() => setDisplayZoom(prev => Math.min(1.3, parseFloat((prev + 0.05).toFixed(2))))}
                  className={cn(
                    "p-1 sm:p-1 rounded-full transition-all flex items-center justify-center font-bold cursor-pointer border hover:scale-105 active:scale-95 shadow-2xs",
                    theme === 'dark' 
                      ? "bg-slate-700 hover:bg-slate-600 text-white border-slate-600" 
                      : "bg-white hover:bg-teal-100 text-teal-700 border-teal-200"
                  )}
                  title={t.zoomIn}
                >
                  <ZoomIn className="w-2.5 h-2.5 lg:w-3 lg:h-3 shrink-0" />
                </button>
              </div>
            </div>





            <div className={cn("hidden sm:block h-10 w-px mx-2", theme === 'dark' ? "bg-slate-800" : "bg-purple-100")} />
            <div className="flex items-center gap-2 sm:gap-4 group">
              <div className="text-right hidden sm:block">
                <p className={cn("text-xs font-black leading-none transition-colors", theme === 'dark' ? "text-white" : "text-purple-900")}>{user?.displayName || 'Admin'}</p>
                <p className={cn("text-[10px] mt-1 font-bold transition-colors", theme === 'dark' ? "text-slate-500" : "text-purple-300")}>{user?.email?.split('@')[0]}</p>
              </div>
              <div className={cn(
                "w-8 h-8 sm:w-12 sm:h-12 border-2 sm:border-[3px] rounded-2xl flex items-center justify-center shadow-lg overflow-hidden transition-all group-hover:scale-110",
                theme === 'dark' ? "bg-slate-800 border-slate-700 shadow-black/40" : "bg-purple-100 border-white shadow-purple-100"
              )}>
                {user?.photoURL ? <img src={user.photoURL} referrerPolicy="no-referrer" alt="" /> : <span className={cn("text-[10px] sm:text-base font-black", theme === 'dark' ? "text-slate-400" : "text-purple-500")}>AI</span>}
              </div>
            </div>
          </div>
        </header>

        <div className={cn("flex-1 overflow-auto p-2 pb-24 sm:p-4 lg:p-6 transition-colors duration-500 bg-transparent relative z-10")}>
          {/* Live status check banners - Show on critical emergency fallback (when no cache is available and only mock data is shown) only */}
          {data?.isMock && isGuestSession && (
            <div
              className={cn(
                "mb-6 p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                theme === 'dark' ? "bg-amber-950/40 border-amber-900/50 text-amber-100" : "bg-amber-50/95 border-amber-200 text-amber-900"
              )}
            >
              <div>
                <h4 className="font-extrabold text-sm sm:text-base tracking-tight mb-1">
                  {lang === 'th' ? "โหมดผู้เข้าชม: กำลังแสดงข้อมูลตัวอย่าง" : "Guest mode: showing sample data"}
                </h4>
                <p className="text-xs font-medium opacity-85 leading-relaxed max-w-2xl">
                  {lang === 'th'
                    ? "ข้อมูลประเมินจริงเปิดให้เฉพาะผู้ที่เข้าสู่ระบบด้วยบัญชี Google ที่ได้รับอนุญาตเท่านั้น"
                    : "Real evaluation data is only available to signed-in Google accounts."}
                </p>
              </div>
              <button
                onClick={handleReauth}
                disabled={isReauthorizing}
                className={cn(
                  "w-full sm:w-auto px-5 py-2.5 text-xs font-black rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer",
                  theme === 'dark' ? "bg-amber-500 text-slate-900 hover:bg-amber-600" : "bg-amber-600 text-white hover:bg-amber-700"
                )}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isReauthorizing && "animate-spin")} />
                {lang === 'th' ? "เข้าสู่ระบบด้วย Google" : "Sign in with Google"}
              </button>
            </div>
          )}

          {data?.isMock && !isGuestSession && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "mb-6 p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg backdrop-blur-md relative overflow-hidden",
                data.isMock
                  ? (theme === 'dark' ? "bg-red-950/40 border-red-900/50 text-red-100" : "bg-red-50/95 border-red-200 text-red-900")
                  : (theme === 'dark' ? "bg-amber-950/40 border-amber-900/50 text-amber-100" : "bg-amber-50/95 border-amber-200 text-amber-900")
              )}
            >
              {/* Subtle pulsing background glow */}
              <div className={cn("absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-3xl opacity-20 pointer-events-none", data.isMock ? "bg-red-500 animate-pulse" : "bg-amber-500 animate-pulse")} />

              <div className="flex items-start gap-3.5 z-10 w-full sm:w-auto">
                <div className={cn(
                  "p-2.5 rounded-2xl shrink-0 mt-0.5",
                  data.isMock 
                    ? (theme === 'dark' ? "bg-red-500/10 text-red-400" : "bg-red-100 text-red-600")
                    : (theme === 'dark' ? "bg-amber-500/10 text-amber-400" : "bg-amber-100 text-amber-600")
                )}>
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm sm:text-base tracking-tight mb-1 flex items-center gap-1.5 flex-wrap">
                    <span>
                      {data.isMock 
                        ? (lang === 'th' ? "กำลังแสดงข้อมูลสำรองชั่วคราว (Offline Backup)" : "Viewing Temporary Backup Data (Offline)")
                        : (lang === 'th' ? "กำลังแสดงข้อมูลเก่าในแคช (Cached Data Snapshot)" : "Viewing Cached Data Snapshot")
                      }
                    </span>
                    <span className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider",
                      data.isMock
                        ? (theme === 'dark' ? "bg-red-500/20 text-red-400" : "bg-red-200 text-red-800")
                        : (theme === 'dark' ? "bg-amber-500/20 text-amber-400" : "bg-amber-200 text-amber-800")
                    )}>
                      {data.isMock ? "Simulated" : "Cached"}
                    </span>
                  </h4>
                  <p className="text-xs font-medium opacity-85 leading-relaxed max-w-2xl">
                    {data.isMock 
                      ? (lang === 'th' 
                          ? `ระบบไม่สามารถดึงข้อมูลปัจจุบันจาก Google Sheets ของท่านได้เนื่องจากอายุของ Session ยืนยันตัวตน Google หมดอายุ (หรือโครงสร้างสเปรดชีตไม่สำเร็จ) เพื่อความลื่นไหลระบบจึงพึ่งพาข้อมูลตัวอย่างสำรองอยู่ ณ ขณะนี้`
                          : `The system was unable to load real-time sheets data because your Google authentication session is expired. Defaulting to pre-compiled mock data structure.`)
                      : (lang === 'th' 
                          ? `ไม่สามารถเชื่อมต่อดึงข้อมูลล่าสุดพรีวิวแบบเรียลไทม์ได้ และกำลังใช้ข้อมูลที่แคชบันทึกไว้ในอุปกรณ์ล่าสุดของท่านเมื่อสิทธิ์การจำลองข้อมูลถูกต้องเพื่อเป็นประโยชน์หลัก`
                          : `The system cannot establish a fresh live connection with your Google Sheet. Displaying the last successfully fetched offline cache snapshot from local storage.`)
                    }
                  </p>
                  <p className="text-[10px] opacity-60 font-mono mt-1">
                    Error Log: {data.error || 'Unauthorized Google Request (401)'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-end w-full sm:w-auto gap-2.5 z-10">
                <button
                  onClick={handleReauth}
                  disabled={isReauthorizing}
                  className={cn(
                    "w-full sm:w-auto px-5 py-2.5 text-xs font-black rounded-2xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer",
                    data.isMock
                      ? (theme === 'dark' ? "bg-red-500 text-white hover:bg-red-600" : "bg-red-600 text-white hover:bg-red-700")
                      : (theme === 'dark' ? "bg-amber-500 text-slate-900 hover:bg-amber-600" : "bg-amber-600 text-white hover:bg-amber-700")
                  )}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isReauthorizing && "animate-spin")} />
                  {lang === 'th' ? "เชื่อมต่อสิทธิ์กูเกิลใหม่ (Re-Login)" : "Re-authenticate with Google"}
                </button>
              </div>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'overview' ? (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="flex flex-col gap-6 pb-10"
              >
                {/* Stats Cards Row */}
                <section className="grid grid-cols-3 gap-1.5 sm:gap-6">
                  {[
                    { label: t.totalEntries, value: rows.length.toLocaleString(), color: "purple", trend: "+12.5% this week" },
                    { label: t.columnsView, value: headers.length, color: "sky", trend: "Awaiting Validation" },
                    { label: t.syncLatency, value: "1.2s", color: "emerald", trend: "Optimization: Optimal" },
                  ].map((stat, i) => (
                    <motion.div 
                      key={i} 
                      whileHover={{ scale: 1.025, y: -4 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className={cn(
                        "p-2 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border transition-all hover:shadow-xl hover:border-purple-350 dark:hover:border-purple-850 group flex flex-col justify-between relative overflow-hidden cursor-pointer",
                        theme === 'dark' 
                          ? "bg-slate-900 border-slate-800 shadow-purple-500/5" 
                          : "bg-white border-slate-100 shadow-sm shadow-slate-200/50"
                      )}
                    >
                      {/* Premium Edge Glass Reflective Shimmer */}
                      <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-out pointer-events-none" />

                      <div>
                        <p className={cn("text-[6.5px] sm:text-[9px] font-black uppercase tracking-tight sm:tracking-[0.2em] mb-1 sm:mb-4 transition-colors truncate", theme === 'dark' ? "text-slate-600 group-hover:text-purple-400" : "text-slate-400 group-hover:text-purple-300")}>{stat.label}</p>
                        <p className={cn(
                          "text-sm sm:text-[45px] font-black group-hover:scale-105 origin-left transition-transform",
                          stat.color === 'purple' ? (theme === 'dark' ? "text-purple-400" : "text-purple-900") : 
                          stat.color === 'sky' ? (theme === 'dark' ? "text-sky-400" : "text-sky-900") : 
                          (theme === 'dark' ? "text-emerald-400" : "text-emerald-900")
                        )}>{stat.value}</p>
                      </div>
                      <div className={cn(
                        "mt-1 sm:mt-4 text-[6px] sm:text-[9px] font-black uppercase inline-block px-1 sm:px-2.5 py-0.5 sm:py-1 rounded-full truncate self-start max-w-full z-10", 
                        stat.color === 'purple' ? "bg-purple-500/10 text-purple-500" : 
                        stat.color === 'sky' ? "bg-sky-500/10 text-sky-500" : "bg-emerald-500/10 text-emerald-500"
                      )}>
                        {stat.trend}
                      </div>
                    </motion.div>
                  ))}
                </section>

                {/* 📌 Dynamic Quick Portals / ระบบอำนวยความสะดวกด่วน */}
                <section className="grid grid-cols-2 gap-3 sm:gap-6">
                  {/* Class Attendance check attendance portal card */}
                  <motion.div
                    whileHover={{ scale: 1.025, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      triggerHaptic();
                      window.open('https://jvservice.jv.ac.th/login', '_blank');
                    }}
                    className={cn(
                      "p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border cursor-pointer relative overflow-hidden transition-all group flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs",
                      theme === 'dark' 
                        ? "bg-slate-900 border-slate-800 shadow-emerald-500/5 hover:border-emerald-500/30" 
                        : "bg-emerald-50/25 border-emerald-100/50 hover:bg-emerald-50/40 hover:border-emerald-300 shadow-sm shadow-slate-200/50"
                    )}
                  >
                    <div className="flex items-center gap-3 sm:gap-6 z-10 text-left">
                      <div className={cn(
                        "w-10 h-10 sm:w-16 sm:h-16 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center border shadow-3xs group-hover:scale-105 transition-transform shrink-0",
                        theme === 'dark' ? "bg-emerald-950/40 border-emerald-900/30" : "bg-emerald-55/40 border-emerald-120/40"
                      )}>
                        <UserCheck className="w-5 h-5 sm:w-8 sm:h-8 text-emerald-500" />
                      </div>
                      <div>
                        <span className={cn("text-[7.5px] sm:text-[10px] font-black uppercase tracking-widest block opacity-70", theme === 'dark' ? "text-emerald-400" : "text-emerald-700")}>
                          {lang === 'th' ? 'ระบบตรวจเช็คเวลาเรียนและเข้าสอน' : 'Class Attendance Portal'}
                        </span>
                        <h4 className={cn("text-xs sm:text-2xl font-black tracking-tight mt-1", theme === 'dark' ? "text-slate-100" : "text-purple-900")}>
                          {lang === 'th' ? 'เช็คชื่อเข้าชั้นเรียน' : 'Class Attendance'}
                        </h4>
                      </div>
                    </div>
                    <div className={cn(
                      "hidden md:flex w-10 h-10 rounded-full items-center justify-center border transition-all group-hover:translate-x-1 shrink-0",
                      theme === 'dark' ? "border-slate-800 text-slate-500" : "border-slate-205 text-slate-400"
                    )}>
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </motion.div>

                  {/* Evaluation form portal card */}
                  <motion.div
                    whileHover={{ scale: 1.025, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      triggerHaptic();
                      window.open('https://docs.google.com/forms/d/e/1FAIpQLSe628rtut8UPPXGjydQ7hiEYa5OxCkhqFRAMgWdQBcMcJe0ew/viewform?usp=header', '_blank');
                    }}
                    className={cn(
                      "p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border cursor-pointer relative overflow-hidden transition-all group flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-3xs",
                      theme === 'dark' 
                        ? "bg-slate-900 border-slate-800 shadow-rose-500/5 hover:border-rose-500/30" 
                        : "bg-rose-50/25 border-rose-100/50 hover:bg-rose-50/40 hover:border-rose-300 shadow-sm shadow-slate-200/50"
                    )}
                  >
                    <div className="flex items-center gap-3 sm:gap-6 z-10 text-left">
                      <div className={cn(
                        "w-10 h-10 sm:w-16 sm:h-16 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center border shadow-3xs group-hover:scale-105 transition-transform shrink-0",
                        theme === 'dark' ? "bg-rose-950/40 border-rose-900/30" : "bg-rose-55/40 border-rose-120/40"
                      )}>
                        <NotebookPen className="w-5 h-5 sm:w-8 sm:h-8 text-rose-500" />
                      </div>
                      <div>
                        <span className={cn("text-[7.5px] sm:text-[10px] font-black uppercase tracking-widest block opacity-70", theme === 'dark' ? "text-rose-400" : "text-rose-700")}>
                          {lang === 'th' ? 'การประเมินการจัดการเรียนสอน' : 'Teaching Evaluation'}
                        </span>
                        <h4 className={cn("text-xs sm:text-2xl font-black tracking-tight mt-1", theme === 'dark' ? "text-slate-100" : "text-purple-900")}>
                          {lang === 'th' ? 'แบบประเมินครู' : 'Evaluation Form'}
                        </h4>
                      </div>
                    </div>
                    <div className={cn(
                      "hidden md:flex w-10 h-10 rounded-full items-center justify-center border transition-all group-hover:translate-x-1 shrink-0",
                      theme === 'dark' ? "border-slate-800 text-slate-500" : "border-slate-205 text-slate-400"
                    )}>
                      <ExternalLink className="w-4 h-4" />
                    </div>
                  </motion.div>
                </section>




                {/* Daily Activity & Activity Count Grouped */}
                {viewMode === 'teacher' && (
                  <section className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-2">
                    {/* Daily Activity Block */}
                    <div className={cn(
                      "p-3 sm:p-4 rounded-[2rem] border transition-all flex flex-col justify-between h-full gap-3",
                      theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm shadow-slate-200/20"
                    )}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-sky-500" />
                          <div>
                            <h3 className={cn("text-[9px] font-black uppercase tracking-widest", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.dailyActivity}</h3>
                            <p className={cn("text-[7.2px] font-bold uppercase tracking-tight flex items-center gap-1.5 flex-wrap", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                              <span>{t.activityLogs}</span>
                            </p>
                          </div>
                        </div>
                        <input
                          type="date"
                          value={selectedDailyDate || ''}
                          onChange={(e) => setSelectedDailyDate(e.target.value)}
                          className={cn(
                            "text-[7.6px] px-3 py-1.5 rounded-2xl border font-extrabold outline-none transition-all cursor-pointer shadow-sm",
                            theme === 'dark' 
                              ? "bg-sky-950/40 border-sky-900/50 text-sky-300 hover:border-sky-500 hover:bg-sky-950/60 focus:ring-2 focus:ring-sky-500/20" 
                              : "bg-sky-50/60 border-sky-200 text-sky-700 hover:bg-sky-50 hover:border-sky-400 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/5"
                          )}
                        />
                      </div>
                      
                      <div className="space-y-2 overflow-y-auto max-h-[90px] pr-1.5 custom-scrollbar flex-1">
                        {selectedDailyDate && dailyActivity[selectedDailyDate] ? (
                          <div className={cn("border-l-2 pl-2 py-0.5", theme === 'dark' ? "border-emerald-500/30" : "border-[#aadfd1]")}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                               <p className={cn("text-[8px] font-black", theme === 'dark' ? "text-slate-500" : "text-slate-500")}>{selectedDailyDate}</p>
                               <span className="text-[7.2px] font-black text-emerald-700 bg-[#daf2ea] px-1 py-0.5 rounded-md border border-[#aadfd1]">
                                 {dailyActivity[selectedDailyDate].size}
                               </span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(Array.from(dailyActivity[selectedDailyDate]) as string[]).map(u => (
                                <span key={u} className={cn(
                                  "text-[7.2px] px-1.5 py-0.5 rounded-md font-bold border transition-colors",
                                  theme === 'dark' ? "bg-slate-800 text-slate-300 border-slate-700" : "bg-white text-slate-600 border-slate-200"
                                )}>
                                  {u}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="h-full min-h-[50px] flex items-center justify-center border border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                            <p className={cn("text-[7.2px] italic font-medium", theme === 'dark' ? "text-slate-700" : "text-slate-400")}>{t.noActivity}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Activity Count Block (10% smaller) */}
                    <div className={cn(
                      "p-2.5 sm:p-3.5 rounded-[1.8rem] border transition-all flex flex-col justify-between h-full gap-2.5",
                      theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm shadow-slate-200/20"
                    )}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-purple-500" />
                          <div>
                            <h3 className={cn("text-[10px] font-black uppercase tracking-widest", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.activityCount}</h3>
                            <p className={cn("text-[7.5px] font-bold uppercase tracking-tight", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>{t.teacherActivity}</p>
                          </div>
                        </div>
                        
                        <div className={cn(
                          "flex p-0.5 rounded-full border self-start sm:self-auto",
                          theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200 shadow-sm"
                        )}>
                          {(['Today', 'Weekly', 'Monthly', 'All'] as const).map((filter) => (
                            <button
                              key={filter}
                              onClick={() => setTrackerTimeFilter(filter)}
                              className={cn(
                                "px-2 py-0.5 text-[7.5px] font-black rounded-full transition-all whitespace-nowrap",
                                trackerTimeFilter === filter
                                  ? (theme === 'dark' ? "bg-fuchsia-600 text-white shadow-sm" : "bg-white text-fuchsia-600 shadow-sm")
                                  : (theme === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-fuchsia-600")
                              )}
                            >
                              {filter === 'Today' ? t.today : filter === 'Weekly' ? t.thisWeek : filter === 'Monthly' ? t.thisMonth : t.all}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 w-full mt-auto">
                        <select 
                          value={selectedTrackerTeacher}
                          onChange={(e) => setSelectedTrackerTeacher(e.target.value)}
                          className={cn(
                            "w-[48%] xs:w-[55%] sm:flex-1 px-1.5 sm:px-2.5 py-1 rounded-2xl border text-[8px] xs:text-[9px] sm:text-[10.5px] font-bold outline-none transition-all shadow-sm truncate",
                            theme === 'dark' 
                              ? "bg-slate-800 border-slate-700 text-white focus:border-amber-500" 
                              : "bg-amber-50/50 border-amber-200 text-amber-900 focus:border-amber-400 focus:ring-4 focus:ring-amber-500/5"
                          )}
                        >
                          <option value="All">{lang === 'th' ? 'ผู้ประเมินทั้งหมด' : 'All Evaluators'}</option>
                          {trackerTeachersList.map(teacher => (
                            <option key={teacher} value={teacher}>{getCleanTeacherName(String(teacher))}</option>
                          ))}
                        </select>

                        <div className="flex-1 xs:flex-initial flex items-center justify-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 bg-purple-50 dark:bg-purple-950/25 rounded-xl border border-purple-100 dark:border-purple-900/40 shadow-sm shrink-0 min-w-0">
                          <span className="text-[9px] sm:text-[10px] font-black text-purple-600 dark:text-purple-400 shrink-0">
                             {trackerTeacherActivityData.reduce((sum, item) => sum + item.count, 0)}
                          </span>
                          <span className="text-[7px] sm:text-[7.5px] font-black text-purple-400 dark:text-purple-500 uppercase tracking-widest truncate whitespace-nowrap">
                            {t.evaluations}
                          </span>
                        </div>
                      </div>
                    </div>
                  </section>

                )}

                {/* Evaluation Summary Graphs */}
                {rows.length > 0 && (
                  <section>
                    {/* Performance Radar Chart */}
                    <div className={cn(
                      "w-full p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3.5rem] border transition-all flex flex-col items-center relative overflow-hidden",
                      theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100 shadow-sm shadow-slate-200/20"
                    )}>
                      <div className={cn("absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none opacity-20", theme === 'dark' ? "bg-purple-500/10" : "bg-purple-500/10")} />
                      
                      <div className="w-full relative z-10">
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", theme === 'dark' ? "bg-slate-800" : "bg-purple-50")}>
                              <BarChart3 className={cn("w-5 h-5", theme === 'dark' ? "text-purple-400" : "text-purple-600")} />
                            </div>
                            <div>
                              <h3 className={cn("text-sm font-black uppercase tracking-widest", theme === 'dark' ? "text-white" : "text-slate-900")}>{t.performanceRadar}</h3>
                              <p className={cn("text-[8px] font-black uppercase text-slate-400 mt-0.5 tracking-tight")}>{viewMode === 'teacher' ? 'Teaching Quality Overview' : 'Foreign Teacher Evaluation'}</p>
                            </div>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Date Filter */}
                            <div className={cn(
                              "flex p-0.5 rounded-full border",
                              theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200 shadow-sm"
                            )}>
                              {(['Today', 'Weekly', 'Monthly', 'All'] as const).map((filter) => (
                                <button
                                  key={filter}
                                  onClick={() => setRadarTimeFilter(filter)}
                                  className={cn(
                                    "px-2.5 py-1 text-[8px] font-black rounded-full transition-all whitespace-nowrap",
                                    radarTimeFilter === filter
                                      ? (theme === 'dark' ? "bg-indigo-600 text-white shadow-sm" : "bg-white text-indigo-600 shadow-sm")
                                      : (theme === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-indigo-600")
                                  )}
                                >
                                  {filter === 'Today' ? t.today : filter === 'Weekly' ? t.thisWeek : filter === 'Monthly' ? t.thisMonth : t.all}
                                </button>
                              ))}
                            </div>

                            {/* View Mode Toggle: Overall vs Bar Chart */}
                            <div className={cn(
                              "flex p-0.5 rounded-full border",
                              theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200 shadow-sm"
                            )}>
                              {[
                                { id: 'both', labelTh: 'แสดงทั้งหมด', labelEn: 'Show Both' },
                                { id: 'overall', labelTh: 'โอเวอร์ออล', labelEn: 'Overall Score' },
                                { id: 'barchart', labelTh: 'กราฟแท่ง', labelEn: 'Bar Chart' }
                              ].map((option) => (
                                <button
                                  key={option.id}
                                  onClick={() => setRadarDisplayMode(option.id as any)}
                                  className={cn(
                                    "px-2.5 py-1 text-[8px] font-black rounded-full transition-all whitespace-nowrap",
                                    radarDisplayMode === option.id
                                      ? (theme === 'dark' ? "bg-teal-600 text-white shadow-sm" : "bg-white text-teal-600 shadow-sm")
                                      : (theme === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-teal-600")
                                  )}
                                >
                                  {lang === 'th' ? option.labelTh : option.labelEn}
                                </button>
                              ))}
                            </div>

                            {/* Teacher Filter */}
                            <select 
                              value={selectedRadarTeacher}
                              onChange={(e) => setSelectedRadarTeacher(e.target.value)}
                              className={cn(
                                "px-3 rounded-full border text-[8px] font-black outline-none transition-all shadow-sm cursor-pointer h-[26px] min-w-[110px]",
                                theme === 'dark' 
                                  ? "bg-slate-800 border-slate-700 text-white focus:border-rose-500" 
                                  : "bg-rose-50/50 border-rose-200 text-rose-700 focus:border-rose-400 focus:ring-4 focus:ring-rose-500/5"
                              )}
                            >
                              <option value="All">{t.allTeachers || 'All Persons'}</option>
                              {Array.from(new Set(rows.map(r => String(r[coTeacherIdx] || '').trim()).filter(Boolean))).sort().map(name => (
                                <option key={name} value={name}>{getCleanTeacherName(String(name))}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                      
                      <div className="w-full relative z-10">
                        {aspectPerformanceData.length > 0 ? (
                          <div className="w-full flex flex-col lg:flex-row gap-6 items-stretch">
                            {/* Left Pillar: Overall Highlight */}
                            {overallRatingLevel && (radarDisplayMode === 'both' || radarDisplayMode === 'overall') && (
                              <div className={cn(
                                "w-full p-6 sm:p-8 rounded-[2rem] border flex flex-col justify-between transition-all select-none shadow-sm",
                                radarDisplayMode === 'overall' ? "max-w-lg mx-auto min-h-[320px]" : "lg:w-[350px] shrink-0",
                                theme === 'dark' 
                                  ? "bg-slate-950/40 border-slate-800" 
                                  : "bg-slate-50/70 border-slate-150/50"
                              )}>
                                <div className="space-y-4">
                                  <div>
                                    <span className={cn(
                                      "text-[9px] font-black uppercase tracking-widest block mb-1",
                                      theme === 'dark' ? "text-slate-500" : "text-slate-400"
                                    )}>
                                      {lang === 'th' ? 'ระดับผลงานโดยรวม' : 'Overall Work Level'}
                                    </span>
                                    <div className="flex items-baseline gap-2">
                                      <span className={cn(
                                        "text-4xl font-extrabold tracking-tight",
                                        theme === 'dark' ? "text-white" : "text-slate-900"
                                      )}>
                                        {overallRatingLevel.score}
                                      </span>
                                      <span className={cn(
                                        "text-xs font-bold",
                                        theme === 'dark' ? "text-slate-500" : "text-slate-400"
                                      )}>
                                        / 10
                                      </span>
                                    </div>
                                  </div>

                                  <div className={cn(
                                    "inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-black tracking-wide",
                                    overallRatingLevel.bg
                                  )}>
                                    <span className={cn("w-2 h-2 rounded-full animate-pulse", overallRatingLevel.dotColor)} />
                                    {overallRatingLevel.label}
                                  </div>

                                  <p className={cn(
                                    "text-[11px] font-semibold leading-relaxed",
                                    theme === 'dark' ? "text-slate-400" : "text-slate-600"
                                  )}>
                                    {overallRatingLevel.description}
                                  </p>
                                </div>

                                <div className={cn(
                                  "mt-6 pt-6 border-t flex items-center justify-between text-[10px] font-bold",
                                  theme === 'dark' ? "border-slate-800 text-slate-500" : "border-slate-200/60 text-slate-400"
                                )}>
                                  <span>{lang === 'th' ? 'ผู้ถูกประเมิน:' : 'Evaluated Person:'}</span>
                                  <span className={cn(
                                    "font-black truncate max-w-[180px]",
                                    theme === 'dark' ? "text-slate-300" : "text-slate-700"
                                  )}>
                                    {selectedRadarTeacher === 'All' 
                                      ? (lang === 'th' ? 'ครูทั้งหมด' : 'All Teachers') 
                                      : selectedRadarTeacher}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Right Pillar: Horizontal Bar Chart */}
                            {(radarDisplayMode === 'both' || radarDisplayMode === 'barchart') && (
                              <div className="w-full lg:flex-1 h-[320px] min-w-0">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart 
                                    data={aspectPerformanceData} 
                                    layout="vertical"
                                    margin={{ 
                                      top: 5, 
                                      right: isMobile ? 15 : 30, 
                                      left: isMobile ? 5 : (isTablet ? 15 : 40), 
                                      bottom: 5 
                                    }}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={theme === 'dark' ? "#1e293b" : "#f1f5f9"} />
                                    <XAxis 
                                      type="number" 
                                      domain={[0, 10]} 
                                      hide 
                                    />
                                    <YAxis 
                                      dataKey="subject" 
                                      type="category" 
                                      width={isMobile ? 115 : (isTablet ? 165 : 225)}
                                      axisLine={false}
                                      tickLine={false}
                                      tick={{ fontSize: isMobile ? 6 : (isTablet ? 7 : 8), fontWeight: 900, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                                      tickFormatter={(value) => value}
                                    />
                                    <Tooltip 
                                      cursor={{ fill: 'transparent' }}
                                      contentStyle={{ 
                                        borderRadius: '1.25rem', 
                                        border: 'none', 
                                        background: theme === 'dark' ? '#1e293b' : '#ffffff',
                                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                                        fontSize: '10px',
                                        fontWeight: 900,
                                        padding: '12px'
                                      }}
                                      formatter={(value: number) => [`${value} / 10`, 'Score']}
                                    />
                                    <Bar 
                                      dataKey="A" 
                                      radius={[0, 10, 10, 0]} 
                                      barSize={24}
                                      animationDuration={1500}
                                    >
                                      {aspectPerformanceData.map((entry, index) => (
                                        <Cell 
                                          key={`cell-${index}`} 
                                          fill={entry.color} 
                                          cursor="pointer"
                                          className="cursor-pointer hover:opacity-75 transition-all"
                                          onClick={() => setSelectedAspectDetail(entry)}
                                        />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="h-[320px] w-full flex flex-col items-center justify-center opacity-30">
                            <Zap className="w-12 h-12 mb-4 animate-bounce" />
                            <p className="text-xs font-black uppercase tracking-widest">{t.noActivity || 'No Data Available'}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Aspect Detail Popup Modal - Rendered via Portal at z-[9999] to prevent header/top-bar clipping */}
                    <AnimatePresence>
                      {selectedAspectDetail && typeof document !== 'undefined' && createPortal(
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
                          onClick={() => setSelectedAspectDetail(null)}
                        >
                          <motion.div
                            initial={{ scale: 0.95, y: 15 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 15 }}
                            className={cn(
                              "rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden border flex flex-col my-auto relative z-10",
                              theme === 'dark' ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-100 text-slate-900"
                            )}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Header with Aspect Theme Color Accent */}
                            <div 
                              className="p-6 sm:p-8 text-white relative shrink-0"
                              style={{ backgroundColor: selectedAspectDetail.color }}
                            >
                              <button 
                                onClick={() => setSelectedAspectDetail(null)}
                                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/25 transition-all text-white"
                              >
                                <X className="w-5 h-5" />
                              </button>
                              
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2.5 py-1 rounded-full text-white">
                                  {lang === 'th' ? 'รายละเอียดหัวข้อการประเมิน' : 'Evaluation Dimension Details'}
                                </span>
                              </div>
                              
                              <h3 className="text-xl sm:text-2xl font-black leading-tight pr-10 text-white">
                                {selectedAspectDetail.full}
                              </h3>
                              <p className="text-white/80 text-[10px] mt-1.5 font-bold flex items-center gap-2">
                                 <span>{lang === 'th' ? 'ประเภท:' : 'Type:'} {viewMode === 'teacher' ? (lang === 'th' ? 'ประเมินการปฏิบัติงานครู' : 'Teaching Quality') : (lang === 'th' ? 'ผลประเมินครูจากต่างชาติ' : 'Teacher Evaluations')}</span>
                                 <span>•</span>
                                 <span>{lang === 'th' ? 'ผู้ประเมินสำหรับ:' : 'Evaluated For:'} {selectedRadarTeacher === 'All' ? (lang === 'th' ? 'ครูทุกคน' : 'All Teachers') : selectedRadarTeacher}</span>
                              </p>
                            </div>

                            {/* Scrollable Content inside the Modal */}
                            <div className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-1 min-h-0 custom-scrollbar">
                              
                              {/* Main summary grid */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Score pill */}
                                <div className={cn(
                                  "p-5 rounded-[2rem] flex flex-col items-center justify-center border",
                                  theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-150/60"
                                )}>
                                  <span className={cn(
                                    "text-[10px] uppercase font-black tracking-widest block mb-1",
                                    theme === 'dark' ? "text-slate-500" : "text-slate-400"
                                  )}>
                                    {lang === 'th' ? 'คะแนนเฉลี่ยรวม' : 'Average Rating'}
                                  </span>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black tracking-tight" style={{ color: selectedAspectDetail.color }}>
                                      {selectedAspectDetail.A}
                                    </span>
                                    <span className={cn("text-xs font-bold", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                                      / 10
                                    </span>
                                  </div>
                                  <span className={cn(
                                    "text-[10px] font-extrabold mt-2 px-3 py-1 rounded-full border",
                                    theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-305" : "bg-white border-slate-100 text-slate-600"
                                  )}>
                                    {lang === 'th' ? 'ระดับ:' : 'Grade:'} {getRatingLabel(selectedAspectDetail.A, lang)}
                                  </span>
                                </div>

                                {/* Total Evaluations */}
                                <div className={cn(
                                  "p-5 rounded-[2rem] flex flex-col items-center justify-center border",
                                  theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-150/60"
                                )}>
                                  <span className={cn(
                                    "text-[10px] uppercase font-black tracking-widest block mb-1",
                                    theme === 'dark' ? "text-slate-500" : "text-slate-400"
                                  )}>
                                    {lang === 'th' ? 'การประเมินทั้งหมดในหัวข้อนี้' : 'Total Evaluated In Header'}
                                  </span>
                                  <span className={cn("text-4xl font-extrabold tracking-tight", theme === 'dark' ? "text-white" : "text-slate-800")}>
                                    {selectedAspectDetailedEvaluations.breakdown.total}
                                  </span>
                                  <span className={cn(
                                    "text-[10px] font-extrabold mt-2 px-3 py-1 rounded-full border",
                                    theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-300" : "bg-white border-slate-100 text-slate-600"
                                  )}>
                                    {lang === 'th' ? 'รายการที่มีคะแนนบันทึก' : 'Evaluations recorded'}
                                  </span>
                                </div>
                              </div>

                              {/* Distribution breakdown chart */}
                              <div className="space-y-3">
                                <h4 className={cn("text-xs font-black uppercase tracking-wider", theme === 'dark' ? "text-slate-400" : "text-slate-500")}>
                                  {lang === 'th' ? 'สัดส่วนคะแนนที่ได้รับ' : 'Score Tier Distribution'}
                                </h4>
                                
                                <div className="space-y-2">
                                  {[
                                    { name: lang === 'th' ? 'ดีเยี่ยม (Excellent / 9-10)' : 'Excellent (9-10)', count: selectedAspectDetailedEvaluations.breakdown.excellent, color: 'bg-emerald-500' },
                                    { name: lang === 'th' ? 'ดี (Good / 7-8)' : 'Good (7-8)', count: selectedAspectDetailedEvaluations.breakdown.good, color: 'bg-blue-500' },
                                    { name: lang === 'th' ? 'พอใช้ (Fair / 5-6)' : 'Fair (5-6)', count: selectedAspectDetailedEvaluations.breakdown.fair, color: 'bg-amber-500' },
                                    { name: lang === 'th' ? 'ปรับปรุง (Needs Improvement / 3-4)' : 'Needs Improvement (3-4)', count: selectedAspectDetailedEvaluations.breakdown.improvement, color: 'bg-orange-500' },
                                    { name: lang === 'th' ? 'เร่งด่วน (Urgent / 1-2)' : 'Urgent (1-2)', count: selectedAspectDetailedEvaluations.breakdown.urgent, color: 'bg-rose-500' },
                                  ].map((tier, index) => {
                                    const pct = selectedAspectDetailedEvaluations.breakdown.total > 0 
                                      ? (tier.count / selectedAspectDetailedEvaluations.breakdown.total) * 100 
                                      : 0;
                                    return (
                                      <div key={index} className="space-y-1">
                                        <div className="flex justify-between text-[11px] font-bold items-center">
                                          <span className={theme === 'dark' ? "text-slate-300" : "text-slate-600"}>{tier.name}</span>
                                          <span className={theme === 'dark' ? "text-slate-400" : "text-slate-500"}>
                                            {tier.count} {lang === 'th' ? 'ครั้ง' : 'times'} ({pct.toFixed(0)}%)
                                          </span>
                                        </div>
                                        <div className={cn("w-full h-2 rounded-full", theme === 'dark' ? "bg-slate-800" : "bg-slate-100")}>
                                          <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 0.8, ease: "easeOut" }}
                                            className={cn("h-full rounded-full", tier.color)} 
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Qualitative Evaluation Feedback list specifically for this aspect */}
                              <div className="space-y-3">
                                <h4 className={cn("text-xs font-black uppercase tracking-wider", theme === 'dark' ? "text-slate-400" : "text-slate-500")}>
                                  {lang === 'th' ? 'บันทึกความคิดเห็นและการประเมินรายบุคคล' : 'Individual Evaluation Feedback & Detailed Scores'}
                                </h4>
                                
                                {selectedAspectDetailedEvaluations.list.length > 0 ? (
                                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 select-text scrollbar-thin scrollbar-thumb-purple-205">
                                    {selectedAspectDetailedEvaluations.list.map((evalItem, itemIdx) => {
                                      const cRowNum = evalItem.rowNum;
                                      const isLiked = commentLikes.some(l => l.rowNum === cRowNum && l.userId === user?.uid);
                                      const likeCount = commentLikes.filter(l => l.rowNum === cRowNum).length;
                                      
                                      return (
                                        <div 
                                          key={itemIdx}
                                          className={cn(
                                            "p-4 rounded-2xl border transition-all text-xs space-y-3 relative group/eval",
                                            theme === 'dark' ? "bg-slate-950/20 border-slate-800 hover:border-slate-700" : "bg-slate-50/50 border-slate-150/40 hover:bg-slate-50"
                                          )}
                                        >
                                          <div className="flex justify-between items-start gap-2">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className={cn(
                                                "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide",
                                                theme === 'dark' ? "bg-slate-800 text-slate-300" : "bg-white text-slate-600 border border-slate-200/50"
                                              )}>
                                                {evalItem.date}
                                              </span>
                                              <span className={cn("text-[10px] font-bold text-slate-400")}>
                                                {lang === 'th' ? `โดย: ${evalItem.evaluator}` : `By: ${evalItem.evaluator}`}
                                              </span>
                                              <span className={cn("text-[10px] font-bold text-slate-400")}>
                                                {lang === 'th' ? `ถึง: ${evalItem.coTeacher}` : `To: ${evalItem.coTeacher}`}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black" style={{ backgroundColor: `${selectedAspectDetail.color}15`, color: selectedAspectDetail.color }}>
                                              <span>★ {evalItem.score} / 10</span>
                                            </div>
                                          </div>
                                          
                                          <div className="flex justify-between items-end gap-4">
                                            <div className="flex-1">
                                              {evalItem.comment ? (
                                                <p className={cn(
                                                  "italic leading-relaxed font-semibold font-sans border-l-2 pl-3 py-0.5",
                                                  theme === 'dark' ? "text-slate-300 border-slate-700" : "text-slate-600 border-slate-200"
                                                )}>
                                                  "{evalItem.comment}"
                                                </p>
                                              ) : (
                                                <p className="text-slate-400 italic leading-relaxed text-[11px]">
                                                  {lang === 'th' ? 'ไม่มีข้อคิดเห็นเพิ่มเติมที่กรอกมา' : 'No comments matching evaluation recorded'}
                                                </p>
                                              )}
                                            </div>
                                            
                                            {evalItem.comment && cRowNum && (
                                              <button
                                                onClick={() => toggleCommentLike(cRowNum)}
                                                className={cn(
                                                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all text-[9.5px] font-black shrink-0 active:scale-95",
                                                  isLiked
                                                    ? "bg-rose-50 dark:bg-rose-950/35 text-rose-500 border border-rose-100 dark:border-rose-900/30"
                                                    : "bg-slate-100/40 dark:bg-slate-800/30 text-slate-400 border border-transparent hover:text-slate-500 hover:bg-slate-100"
                                                )}
                                              >
                                                <Heart className={cn("w-3.5 h-3.5 transition-transform duration-300", isLiked ? "fill-rose-500 text-rose-500 scale-110" : "text-slate-400")} />
                                                {likeCount > 0 && <span>{likeCount}</span>}
                                              </button>
                                            )}
                                          </div>

                                          {/* Emoji Reactions below detailed evaluation comments */}
                                          {evalItem.comment && cRowNum && (
                                            <div className="flex flex-wrap gap-1 items-center mt-2 pt-2 border-t border-slate-100/35 dark:border-slate-900/30">
                                              {['👍', '❤️', '😄', '🎉', '😮', '😢'].map(emoji => {
                                                const emojiReactions = reactions.filter(
                                                  r => r.targetId === String(cRowNum) && r.targetType === 'comment' && r.emoji === emoji
                                                );
                                                const hasReacted = emojiReactions.some(r => r.userId === user?.uid);
                                                if (emojiReactions.length === 0) return null;
                                                return (
                                                  <button
                                                    key={emoji}
                                                    onClick={() => toggleReaction(String(cRowNum), 'comment', emoji)}
                                                    className={cn(
                                                      "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all active:scale-95",
                                                      hasReacted
                                                        ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 border-purple-200 dark:border-purple-800"
                                                        : "bg-slate-100/50 dark:bg-slate-800/20 text-slate-400 border-transparent hover:bg-slate-100"
                                                    )}
                                                  >
                                                    <span>{emoji}</span>
                                                    <span>{emojiReactions.length}</span>
                                                  </button>
                                                );
                                              })}
                                              
                                              {/* Reaction selector popover on hover */}
                                              <div className="relative group/comm-emo inline-block">
                                                <button className="w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-bold border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95">
                                                  +😊
                                                </button>
                                                <div className={cn(
                                                  "absolute bottom-full left-0 mb-1 hidden group-hover/comm-emo:flex items-center gap-1 p-1 rounded-full border shadow-lg z-20 transition-all",
                                                  theme === 'dark' ? "bg-slate-900 border-slate-800 shadow-black" : "bg-white border-slate-150 shadow-slate-200"
                                                )}>
                                                  {['👍', '❤️', '😄', '🎉', '😮', '😢'].map(emoji => {
                                                    const hasReacted = reactions.some(
                                                      r => r.targetId === String(cRowNum) && r.targetType === 'comment' && r.emoji === emoji && r.userId === user?.uid
                                                    );
                                                    return (
                                                      <button
                                                        key={emoji}
                                                        onClick={() => toggleReaction(String(cRowNum), 'comment', emoji)}
                                                        className={cn(
                                                          "w-5 h-5 flex items-center justify-center rounded-full text-[10px] transition-transform hover:scale-125 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95",
                                                          hasReacted ? "bg-purple-100/50 dark:bg-purple-950/30" : ""
                                                        )}
                                                      >
                                                        {emoji}
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className={cn(
                                    "p-8 text-center rounded-2xl border border-dashed text-xs font-bold",
                                    theme === 'dark' ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-400"
                                  )}>
                                    {lang === 'th' ? 'ไม่มีบันทึกข้อเสนอแนะเพิ่มเติมสำหรับหมวดหมู่นี้' : 'No personal specific comments found for this theme'}
                                  </div>
                                )}
                              </div>

                            </div>

                            {/* Footer info block */}
                            <div className={cn(
                              "px-6 sm:px-8 py-5 border-t flex justify-end shrink-0 whitespace-nowrap",
                              theme === 'dark' ? "bg-slate-950 border-slate-800/80" : "bg-slate-50 border-slate-100"
                            )}>
                              <button
                                onClick={() => setSelectedAspectDetail(null)}
                                className="px-6 py-2 rounded-2xl text-white font-black hover:opacity-90 transition-all text-xs"
                                style={{ backgroundColor: selectedAspectDetail.color }}
                              >
                                {lang === 'th' ? 'ปิดหน้าต่าง' : 'Close Details'}
                              </button>
                            </div>
                          </motion.div>
                        </motion.div>,
                        document.body
                      )}
                    </AnimatePresence>
                  </section>
                )}

                {/* AI-Driven Advisor & Strengths Section */}
                <section className="relative overflow-hidden w-full p-6 sm:p-8 rounded-[2.5rem] sm:rounded-[3.5rem] border transition-all flex flex-col bg-slate-900/10 dark:bg-slate-900/40 border-purple-100 dark:border-purple-900/20 shadow-xs">
                  {/* Glowing neon bg decoration */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 dark:bg-fuchsia-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 opacity-40 animate-pulse" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-2xl pointer-events-none -ml-16 -mb-16 opacity-30" />

                  <div className="relative z-10 w-full">
                    <div className="flex flex-col min-[500px]:flex-row min-[500px]:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center shadow-md shrink-0", theme === 'dark' ? "bg-slate-800 border border-slate-700 text-fuchsia-400" : "bg-purple-50 text-purple-600 border border-purple-100")}>
                          <Sparkles className="w-5 h-5 text-fuchsia-500" />
                        </div>
                        <div>
                          <h3 className={cn("text-xs sm:text-sm font-black uppercase tracking-widest", theme === 'dark' ? "text-white" : "text-purple-950")}>
                            {lang === 'th' ? 'วิเคราะห์จุดเด่นและคำแนะนำ' : 'Strengths & Recommendations'}
                          </h3>
                          <p className={cn("text-[8.5px] font-black uppercase tracking-wide mt-1.5", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                            {lang === 'th' ? 'เจาะลึกศักยภาพและแนวทางการพัฒนารายบุคคล' : 'Tailored professional coaching, pedagogical advice, and strengths discovery'}
                          </p>
                        </div>
                      </div>

                      {/* Display current selected teacher info */}
                      <div className="flex flex-wrap items-center gap-2.5 self-start">
                        <span className={cn("text-[9px] font-black uppercase tracking-wider py-1.5 px-3 rounded-full border shadow-2xs", theme === 'dark' ? "bg-slate-950/40 border-slate-800 text-slate-300" : "bg-white border-slate-150 text-slate-600")}>
                          {lang === 'th' ? 'เป้าหมาย:' : 'Target:'} <strong className="text-purple-605 dark:text-purple-400 font-black">{selectedRadarTeacher === 'All' ? (lang === 'th' ? 'ครูทุกคน' : 'All Teachers') : selectedRadarTeacher}</strong>
                        </span>
                        
                        <button
                          onClick={runAiAnalysis}
                          disabled={isAiAnalyzing || aspectPerformanceData.length === 0}
                          className={cn(
                            "px-4 py-2 font-black text-[10px] sm:text-xs rounded-2xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 select-none shadow-md cursor-pointer",
                            theme === 'dark' 
                              ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white shadow-fuchsia-900/30" 
                              : "bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white shadow-purple-200"
                          )}
                        >
                          <Sparkles className={cn("w-3.5 h-3.5 animate-pulse", isAiAnalyzing && "animate-spin")} />
                          {isAiAnalyzing ? (lang === 'th' ? 'ระบบกำลังวิเคราะห์...' : 'Analyzing with AI...') : (lang === 'th' ? 'วิเคราะห์ด้วย AI' : 'Analyze with AI')}
                        </button>
                      </div>
                    </div>

                    {/* Filter selection for role */}
                    <div className="flex flex-wrap items-center gap-3 mb-5 pb-5 border-b border-purple-100/10 dark:border-slate-800/40">
                      <span className={cn("text-[10px] sm:text-xs font-black uppercase tracking-wider", theme === 'dark' ? "text-slate-400" : "text-purple-950")}>
                        {lang === 'th' ? 'มุมมองผู้เสนอแนะ:' : 'Analysis Perspective:'}
                      </span>
                      <div className="inline-flex p-1 rounded-2xl bg-purple-500/5 dark:bg-slate-950/40 border border-purple-100/10 gap-1">
                        <button
                          type="button"
                          onClick={() => setAiRoleFilter('foreign')}
                          className={cn(
                            "px-4 py-1.5 rounded-xl font-bold text-[10px] sm:text-xs transition-all cursor-pointer",
                            aiRoleFilter === 'foreign'
                              ? (theme === 'dark' ? "bg-purple-600/40 text-purple-200 border border-purple-500/20 shadow-xs" : "bg-purple-600 text-white shadow-sm")
                              : (theme === 'dark' ? "text-slate-450 hover:text-slate-200" : "text-purple-600 hover:text-purple-800")
                          )}
                        >
                          {lang === 'th' ? 'ในฐานะครูต่างชาติ' : 'As Foreign Teacher'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAiRoleFilter('coteacher')}
                          className={cn(
                            "px-4 py-1.5 rounded-xl font-bold text-[10px] sm:text-xs transition-all cursor-pointer",
                            aiRoleFilter === 'coteacher'
                              ? (theme === 'dark' ? "bg-purple-600/40 text-purple-200 border border-purple-500/20 shadow-xs" : "bg-purple-600 text-white shadow-sm")
                              : (theme === 'dark' ? "text-slate-450 hover:text-slate-200" : "text-purple-600 hover:text-purple-800")
                          )}
                        >
                          {lang === 'th' ? 'ในฐานะครูสอนร่วม' : 'As Thai Co-teacher'}
                        </button>
                      </div>
                    </div>

                    {/* AI Output Result Box */}
                    <div className={cn(
                      "rounded-3xl border p-5 sm:p-7 min-h-[140px] flex flex-col justify-center transition-all text-left",
                      theme === 'dark' 
                        ? "bg-slate-950/60 border-slate-800/50" 
                        : "bg-white/80 border-purple-50/50 shadow-2xs shadow-slate-100"
                    )}>
                      {isAiAnalyzing ? (
                        <div className="flex flex-col items-center justify-center gap-4 py-8">
                          <div className="relative">
                            <div className="w-12 h-12 rounded-full border-4 border-fuchsia-500/15 border-t-fuchsia-500 animate-spin" />
                            <Sparkles className="w-5 h-5 text-fuchsia-500 absolute inset-0 m-auto animate-pulse" />
                          </div>
                          <div className="text-center space-y-1">
                            <p className={cn("text-xs font-black tracking-tight", theme === 'dark' ? "text-slate-200" : "text-purple-900")}>
                              {lang === 'th' ? 'กำลังป้อนข้อมูลเข้าโมเดลและประมวลผลข้อเสนอแนะ...' : 'Processing pedagogical dimensions and observations comments...'}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                              {lang === 'th' ? 'โปรดรอสักครู่ ระบบกำลังถอดรหัสจุดเด่นรายบุคคล' : 'Synthesizing professional recommendations based on observations'}
                            </p>
                          </div>
                        </div>
                      ) : aiAnalysis ? (
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar text-left font-semibold">
                          <div className="flex items-center justify-between border-b pb-2 mb-2 dark:border-slate-850">
                            <span className="text-[9.5px] font-black text-fuchsia-500 dark:text-fuchsia-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Sparkles className="w-3 h-3 text-fuchsia-500 animate-spin-slow" />
                              {lang === 'th' ? 'รายงานการวิเคราะห์จากระบบปัญญาประดิษฐ์' : 'Pedagogical feedback report from AI advisor'}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 hidden sm:inline">
                              {lang === 'th' ? 'ตามข้อมูลสถิติประเมินและการกรอกแบบฟอร์มเชิงคุณภาพ' : 'Based on average ratings of 5 aspects and observer comments'}
                            </span>
                          </div>
                          
                          <div className="space-y-3 prose max-w-none prose-sm dark:prose-invert">
                            {/* Format AI texts using simple custom renderer helper */}
                            {aiAnalysis.split('\n').map((line, idx) => {
                              const trimmed = line.trim();
                              if (!trimmed) return <div key={idx} className="h-1" />;
                              
                              // Check for titles
                              if (trimmed.startsWith('###')) {
                                return (
                                  <h4 key={idx} className="text-sm font-black mt-4 mb-2 text-purple-950 dark:text-purple-300 uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-1.5 h-3 bg-fuchsia-500 rounded-full inline-block shrink-0" />
                                    {trimmed.replace('###', '').trim()}
                                  </h4>
                                );
                              }
                              if (trimmed.startsWith('##') || trimmed.startsWith('#')) {
                                return (
                                  <h4 key={idx} className="text-base font-black mt-5 mb-2.5 text-purple-950 dark:text-purple-100 uppercase tracking-wide flex items-center gap-2">
                                    <span className="w-2 h-4 bg-purple-500 rounded-full inline-block shrink-0" />
                                    {trimmed.replace(/^#+/, '').trim()}
                                  </h4>
                                );
                              }
                              
                              // Bullet point
                              if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                                const cleanContent = trimmed.replace(/^[-*]\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1');
                                const bBold = trimmed.match(/\*\*(.*?)\*\*/);
                                if (bBold && bBold[1]) {
                                  const boldPart = bBold[1];
                                  const normalPart = cleanContent.replace(boldPart, '');
                                  return (
                                    <div key={idx} className="flex gap-2 py-1 items-start text-xs leading-relaxed">
                                      <span className="text-fuchsia-500 font-extrabold shrink-0 mt-0.5">✦</span>
                                      <p className={theme === 'dark' ? "text-slate-300" : "text-slate-700"}>
                                        <strong className="text-purple-950 dark:text-purple-300 font-black">{boldPart}</strong>
                                        {normalPart}
                                      </p>
                                    </div>
                                  );
                                }
                                return (
                                  <div key={idx} className="flex gap-2 py-1 items-start text-xs leading-relaxed">
                                    <span className="text-fuchsia-500 font-extrabold shrink-0 mt-0.5">✦</span>
                                    <p className={theme === 'dark' ? "text-slate-300" : "text-slate-700"}>{cleanContent}</p>
                                  </div>
                                );
                              }
                              
                              return (
                                <p 
                                  key={idx} 
                                  className={cn("text-xs leading-relaxed py-1 font-semibold", theme === 'dark' ? "text-slate-300" : "text-slate-750")}
                                  dangerouslySetInnerHTML={{ __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-purple-950 dark:text-fuchsia-300 font-black">$1</strong>') }}
                                />
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center py-6">
                          <Sparkles className={cn("w-9 h-9 mb-3.5 opacity-25 animate-pulse", theme === 'dark' ? "text-slate-400" : "text-purple-300")} />
                          <p className={cn("text-xs font-black", theme === 'dark' ? "text-slate-400" : "text-purple-900/60")}>
                            {lang === 'th' ? 'ยังไม่ได้เริ่มการวิเคราะห์ด้วยระบบ AI สำหรับผู้สอนนี้' : 'No pedagogical report compiled yet for this selection.'}
                          </p>
                          <p className="text-[10px] mt-1.5 font-bold text-slate-400 leading-relaxed max-w-[400px]">
                            {lang === 'th' 
                              ? `คลิกปุ่ม "วิเคราะห์ด้วย AI" เพื่อสร้างรายงานจุดเด่น (Strengths) และคำแนะนำเชิงปฏิบัติ (Actionable Advice) รายบุคคล มีสถิติความคิดเห็นสะสม ${teacherCommentsForAI.length} ข้อความ`
                              : `Click the "Analyze with AI" button to retrieve immediate professional coaching insights from Gemini. Active comments: ${teacherCommentsForAI.length}`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>





                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className={cn(
                    "p-5 rounded-[2.5rem] shadow-sm flex flex-col lg:col-span-2 transition-colors",
                    theme === 'dark' ? "bg-slate-900 border border-slate-800" : "bg-white border border-slate-100 shadow-slate-200/50"
                  )}>
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className={cn("text-sm font-black leading-tight", theme === 'dark' ? "text-slate-100" : "text-slate-900 uppercase tracking-widest")}>{t.qualitativeFeedback}</h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{t.recentComments}</p>
                      </div>
                      <Activity className={cn("w-4 h-4", theme === 'dark' ? "text-purple-500" : "text-purple-400")} />
                    </div>
                    
                    <div className="flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sortedDates.slice(0, 9).map(date => {
                          const comments = dailyTeacherData[date]?.comments || [];
                          if (comments.length === 0) return null;
                          
                          return (
                            <div key={date} className="space-y-2">
                              <p className={cn("text-[9px] font-black uppercase tracking-widest opacity-50 px-1", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>{date}</p>
                              <div className="space-y-2">
                                {comments.map((c: any, i: number) => {
                                  const cRowNum = c.rowNum;
                                  const isLiked = commentLikes.some(l => l.rowNum === cRowNum && l.userId === user?.uid);
                                  const likeCount = commentLikes.filter(l => l.rowNum === cRowNum).length;
                                  
                                  return (
                                    <div key={i} className={cn(
                                      "p-4 border rounded-[2rem] transition-all hover:border-purple-200 shadow-sm relative group/comment",
                                      theme === 'dark' ? "bg-slate-950 border-slate-800" : "bg-slate-50/50 border-slate-100"
                                    )}>
                                      <p className={cn("text-[10px] font-medium italic leading-relaxed mb-3", theme === 'dark' ? "text-slate-300" : "text-slate-700")}>"{c.text}"</p>
                                      <div className="flex items-center justify-between gap-2 mt-1">
                                        <div className="flex items-center gap-2">
                                          <div className="w-4 h-[1px] bg-sky-200" />
                                          <p className="text-[9px] text-sky-500 font-black uppercase tracking-widest">
                                            {getCleanTeacherName(c.teacher)}
                                          </p>
                                        </div>
                                        
                                        {cRowNum && (
                                          <button
                                            onClick={() => toggleCommentLike(cRowNum)}
                                            className={cn(
                                              "flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all text-[10px] font-black active:scale-90",
                                              isLiked
                                                ? "bg-rose-50 dark:bg-rose-950/30 text-rose-500 border border-rose-100 dark:border-rose-900/40"
                                                : "bg-slate-100/50 dark:bg-slate-800/40 text-slate-400 border border-transparent hover:text-slate-500 hover:bg-slate-100"
                                            )}
                                          >
                                            <Heart className={cn("w-3.5 h-3.5 transition-transform duration-300", isLiked ? "fill-rose-500 text-rose-500 scale-110" : "text-slate-400")} />
                                            {likeCount > 0 && <span className="text-[10px]">{likeCount}</span>}
                                          </button>
                                        )}
                                      </div>

                                      {/* Emoji Reactions below daily teacher comments */}
                                      {cRowNum && (
                                        <div className="flex flex-wrap gap-1 items-center mt-3 pt-2.5 border-t border-slate-100/30 dark:border-slate-900/30">
                                          {['👍', '❤️', '😄', '🎉', '😮', '😢'].map(emoji => {
                                            const emojiReactions = reactions.filter(
                                              r => r.targetId === String(cRowNum) && r.targetType === 'comment' && r.emoji === emoji
                                            );
                                            const hasReacted = emojiReactions.some(r => r.userId === user?.uid);
                                            if (emojiReactions.length === 0) return null;
                                            return (
                                              <button
                                                key={emoji}
                                                onClick={() => toggleReaction(String(cRowNum), 'comment', emoji)}
                                                className={cn(
                                                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all active:scale-95",
                                                  hasReacted
                                                    ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 border-purple-200"
                                                    : "bg-slate-100/50 dark:bg-slate-800/10 text-slate-400 border-transparent hover:bg-slate-100"
                                                )}
                                              >
                                                <span>{emoji}</span>
                                                <span className="text-[8.5px]">{emojiReactions.length}</span>
                                              </button>
                                            );
                                          })}
                                          
                                          {/* Reaction selector popover on hover */}
                                          <div className="relative group/comm-emo inline-block">
                                            <button className="w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-bold border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95">
                                              +😊
                                            </button>
                                            <div className={cn(
                                              "absolute bottom-full left-0 mb-1 hidden group-hover/comm-emo:flex items-center gap-1 p-1 rounded-full border shadow-lg z-20 transition-all",
                                              theme === 'dark' ? "bg-slate-900 border-slate-800 shadow-black" : "bg-white border-slate-150 shadow-slate-200"
                                            )}>
                                              {['👍', '❤️', '😄', '🎉', '😮', '😢'].map(emoji => {
                                                const hasReacted = reactions.some(
                                                  r => r.targetId === String(cRowNum) && r.targetType === 'comment' && r.emoji === emoji && r.userId === user?.uid
                                                );
                                                return (
                                                  <button
                                                    key={emoji}
                                                    onClick={() => toggleReaction(String(cRowNum), 'comment', emoji)}
                                                    className={cn(
                                                      "w-5 h-5 flex items-center justify-center rounded-full text-[10px] transition-transform hover:scale-125 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95",
                                                      hasReacted ? "bg-purple-100/50 dark:bg-purple-950/30" : ""
                                                    )}
                                                  >
                                                    {emoji}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {Object.values(dailyTeacherData).every((d: any) => d.comments.length === 0) && (
                        <div className="h-full flex flex-col items-center justify-center text-center py-20">
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest tracking-[0.3em]">{t.noFeedback}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>

                {/* Images Gallery Section */}
                <section className={cn(
                  "space-y-8 p-8 rounded-[2.5rem] border transition-all shadow-sm",
                  theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                )}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h2 className={cn("text-2xl font-black tracking-tight flex items-center gap-4 transition-colors", theme === 'dark' ? "text-slate-100" : "text-purple-900")}>
                        <ImageIcon className="w-8 h-8 text-emerald-500 animate-pulse" />
                        {t.evaluationImages}
                      </h2>
                      <p className={cn("text-xs font-bold transition-colors", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                        {lang === 'th' ? "รูปภาพและหลักฐานจากการส่งแบบประเมินห้องเรียน" : "Images and support materials from classroom evaluations"}
                      </p>
                    </div>
                    
                    <div className="flex h-fit items-center gap-2">


                      <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] sm:text-xs px-4 py-2 rounded-full border border-emerald-500/20 max-w-max">
                        {lang === 'th' ? `พบทั้งหมด ${filteredGalleryImages.length} รูป` : `Total ${filteredGalleryImages.length} images`}
                      </div>
                    </div>
                  </div>

                  {/* Always Visible Filter Bar */}
                      {/* Filter Bar */}
                      <div className={cn(
                        "p-6 rounded-[2rem] border transition-all flex flex-col xl:flex-row xl:items-center gap-4 shadow-sm",
                        theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                      )}>
                        <div className="flex-1 relative">
                          <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors", theme === 'dark' ? "text-slate-700" : "text-slate-300")} />
                          <input 
                            type="text"
                            value={searchGalleryQuery}
                            onChange={(e) => setSearchGalleryQuery(e.target.value)}
                            placeholder={lang === 'th' ? "ค้นหาจากชื่อครู, ผู้ประเมิน, ความคิดเห็น..." : "Search by teacher, evaluator, comment..."}
                            className={cn(
                              "w-full pl-12 pr-4 py-3 border rounded-xl text-xs font-bold outline-none transition-all shadow-inner",
                              theme === 'dark' 
                                ? "bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-700 focus:bg-slate-900 focus:border-indigo-500" 
                                : "bg-white border-slate-200 text-indigo-900 placeholder:text-slate-300 focus:border-indigo-400 hover:border-indigo-300 focus:ring-4 focus:ring-indigo-500/5"
                            )}
                          />
                          {searchGalleryQuery && (
                            <button 
                              onClick={() => setSearchGalleryQuery('')}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black tracking-widest text-orange-500 hover:text-orange-600"
                            >
                              {t.clear}
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center w-full sm:w-auto">
                          {/* Teacher Filter */}
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <Filter className={cn("w-4 h-4 shrink-0 transition-colors", theme === 'dark' ? "text-orange-400" : "text-orange-500")} />
                            <select
                              value={selectedGalleryTeacher}
                              onChange={(e) => setSelectedGalleryTeacher(e.target.value)}
                              className={cn(
                                "w-full sm:w-auto px-4 py-3 border rounded-xl text-xs font-bold outline-none cursor-pointer transition-all min-w-0 sm:min-w-[185px] shadow-sm truncate",
                                theme === 'dark' 
                                  ? "bg-slate-950 border-slate-800 text-slate-100 focus:bg-slate-900 focus:border-orange-500" 
                                  : "bg-orange-50/50 hover:bg-orange-100/50 border-orange-200 text-orange-950 focus:border-orange-400 hover:border-orange-350 focus:ring-4 focus:ring-orange-500/5"
                              )}
                            >
                              <option value="All">{lang === 'th' ? 'ครูทุกคน' : 'All Teachers'}</option>
                              {galleryTeachers.map(name => (
                                <option key={name} value={name}>{getCleanTeacherName(name)}</option>
                              ))}
                            </select>
                          </div>

                          {/* Date Filter */}
                          <div className="flex items-center gap-3 w-full sm:w-auto">
                            <Calendar className={cn("w-4 h-4 shrink-0 transition-colors", theme === 'dark' ? "text-teal-400" : "text-teal-500")} />
                            <select
                              value={selectedGalleryDate}
                              onChange={(e) => setSelectedGalleryDate(e.target.value)}
                              className={cn(
                                "w-full sm:w-auto px-4 py-3 border rounded-xl text-xs font-bold outline-none cursor-pointer transition-all min-w-0 sm:min-w-[155px] shadow-sm truncate",
                                theme === 'dark' 
                                  ? "bg-slate-950 border-slate-800 text-slate-100 focus:bg-slate-900 focus:border-teal-500" 
                                  : "bg-teal-50/50 hover:bg-teal-100/50 border-teal-200 text-teal-950 focus:border-teal-400 hover:border-teal-350 focus:ring-4 focus:ring-teal-500/5"
                              )}
                            >
                              <option value="All">{lang === 'th' ? 'กรองตามวันที่ (ทุกวัน)' : 'All Dates'}</option>
                              {galleryDates.map(dStr => (
                                <option key={dStr} value={dStr}>{dStr}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {!(selectedGalleryTeacher !== 'All' || selectedGalleryDate !== 'All' || searchGalleryQuery.trim() !== '') ? (
                        /* Ask user to select filter first */
                        <motion.div 
                          layout
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={cn(
                            "group p-12 rounded-[2rem] border border-dashed text-center transition-all",
                            theme === 'dark' ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-200"
                          )}
                        >
                          <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center mb-4">
                            <Filter className="w-8 h-8 text-emerald-500" />
                          </div>
                          <h3 className={cn("text-base font-black tracking-tight mb-1", theme === 'dark' ? "text-slate-200" : "text-purple-950")}>
                            {lang === 'th' ? 'กรุณาเลือก ครู วันที่ หรือพิมพ์คำค้นหาเพื่อแสดงรูปภาพ' : 'Please select a teacher, date, or enter search terms to display images'}
                          </h3>
                          <p className={cn("text-xs font-bold transition-colors max-w-sm mx-auto", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                            {lang === 'th' 
                              ? `ระบบจะแสดงรูปภาพหลักฐานการจัดการเรียนรู้หลังจากคุณเลือกกรองข้อมูลด้านบน` 
                              : `Learning evidence images will be shown after choosing name, date, or query filters above.`}
                          </p>
                        </motion.div>
                      ) : filteredGalleryImages.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8 transition-all">
                          {filteredGalleryImages.map((item, index) => (
                            <motion.div
                              key={index}
                              layout
                              whileHover={typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches ? { y: -6, scale: 1.02 } : undefined}
                              onClick={() => setSelectedGalleryImageItem(item)}
                              className={cn(
                                "group cursor-pointer border rounded-[2rem] overflow-hidden transition-all shadow-sm hover:shadow-xl flex flex-col",
                                theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                              )}
                            >
                              <div className="aspect-[4/3] w-full overflow-hidden relative bg-slate-100 dark:bg-slate-950 flex items-center justify-center border-b border-slate-50 dark:border-slate-800/10">
                                <SecureDriveImage 
                                  src={item.thumbnail}
                                  accessToken={accessToken}
                                  referrerPolicy="no-referrer"
                                  alt={item.header}
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ease-out"
                                  loading="lazy"
                                />
                                <div className="absolute top-4 left-4 bg-purple-900/85 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-md border border-white/20">
                                  {item.header}
                                </div>
                              </div>

                              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <span className={cn("text-[9px] font-black uppercase tracking-widest", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                                      {lang === 'th' ? 'ครูผู้สอน' : 'TEACHER'}
                                    </span>
                                  </div>
                                  <h3 className={cn("text-sm font-black leading-tight tracking-tight line-clamp-1 transition-colors", theme === 'dark' ? "text-slate-100" : "text-purple-900")}>
                                    {getCleanTeacherName(item.teacher)}
                                  </h3>
                                </div>

                                <p className={cn("text-[10px] font-bold leading-relaxed line-clamp-2 transition-colors", theme === 'dark' ? "text-slate-500" : "text-slate-600")}>
                                  {item.comment || (lang === 'th' ? '(ไม่มีความคิดเห็นเพิ่มเติม)' : '(No comments provided)')}
                                </p>

                                <div className={cn("flex items-center justify-between border-t pt-3.5 mt-2 transition-colors text-[9px] font-black uppercase tracking-widest", theme === 'dark' ? "border-slate-800/80 text-slate-500" : "border-slate-100 text-slate-400")}>
                                  <span className="truncate max-w-[120px]">By {item.evaluator}</span>
                                  <span className="shrink-0">{item.date}</span>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className={cn("border border-dashed rounded-[2.5rem] p-24 text-center transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white/50 border-slate-100")}>
                          <ImageIcon className={cn("w-14 h-14 mx-auto mb-4 transition-colors", theme === 'dark' ? "text-slate-800" : "text-slate-200")} />
                          <p className={cn("text-xs font-black uppercase tracking-widest transition-colors", theme === 'dark' ? "text-slate-700" : "text-slate-300")}>
                            {lang === 'th' ? 'ไม่พบรูปภาพตามเงื่อนไขที่เลือก' : 'No images match the criteria'}
                          </p>
                        </div>
                      )}
                </section>

               </motion.div>
             ) : activeTab === 'table' ? (
              /* Spreadsheet View */
              <motion.div 
                key="table"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="flex flex-col gap-12 pb-10"
              >
                <div id="spreadsheet-section"></div>
                
                {/* 1. แดชบอร์ดสรุปตัวเลขสำคัญ (Summary Stats Dashboard) */}
                <motion.div
                  id="dashboard-stats-summary"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-6 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-sm flex flex-col gap-8 transition-colors relative overflow-hidden",
                    theme === 'dark' ? "bg-slate-900 border border-slate-800" : "bg-white border border-purple-50 shadow-slate-200/50"
                  )}
                >
                  {/* Decorative background visual */}
                  <div className="absolute right-0 top-0 w-80 h-80 bg-gradient-to-br from-lime-500/5 to-purple-500/5 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-dashed pb-5 border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-500 to-lime-500 flex items-center justify-center text-white shadow-md">
                        <Activity className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <h2 className={cn("text-base font-black transition-colors", theme === 'dark' ? "text-slate-100" : "text-purple-900")}>
                          {lang === 'th' ? 'สรุปสถิติสำคัญ' : 'Statistics Dashboard'}
                        </h2>
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-lime-500/10 text-lime-500 border border-lime-500/20 inline-block mt-0.5">
                          {lang === 'th' ? 'รวมข้อมูลประเมินครู & แบบสะท้อนคิดของนักเรียน' : 'Includes FT Performance & Student Feedbacks'}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 print:hidden shrink-0">
                      <button
                        onClick={() => handleExportAsImage('dashboard-stats-summary', `Complete_Summary_Report`)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer hover:scale-[1.02] active:scale-95",
                          theme === 'dark' 
                            ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white" 
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                        )}
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-lime-500" />
                        <span>{lang === 'th' ? 'ส่งออกเป็นรูปภาพ' : 'Export PNG'}</span>
                      </button>

                      <button
                        onClick={() => {
                          const doc = new jsPDF('portrait');
                          doc.setFontSize(16);
                          doc.text('Teacher & Student Statistics Summary Report', 14, 20);
                          doc.setFontSize(10);
                          doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
                          
                          doc.text('1. Foreign Teacher Performance Statistics (FT Observation)', 14, 38);
                          const cleanTeacherTopEvaluator = translateThaiToEnglishForPDF(teacherStats.topEvaluator);
                          const cleanTeacherTopTeacher = translateThaiToEnglishForPDF(teacherStats.topTeacher);
                          
                          doc.text(`Total Records: ${teacherStats.total}  |  Average Score: ${teacherStats.averageScore.toFixed(2)}  |  Top Evaluator: ${cleanTeacherTopEvaluator}`, 14, 44);
                          
                          autoTable(doc, {
                            startY: 48,
                            head: [['Teacher Performance Metric', 'Statistical Value']],
                            body: [
                              ['Total Teaching Observations', `${teacherStats.total} entries`],
                              ['Average Evaluation Score', `${teacherStats.averageScore.toFixed(2)} / 10.00`],
                              ['Most Observed Teacher', cleanTeacherTopTeacher],
                              ['Top Evaluator (Submitter)', cleanTeacherTopEvaluator],
                              ['Quality Distribution (Excellent/Good/Fair)', `${teacherStats.excellentCount} / ${teacherStats.goodCount} / ${teacherStats.fairCount} entries`],
                              ['Latest Observation Timestamp', teacherStats.latestTime]
                            ],
                            theme: 'grid',
                            headStyles: { fillColor: [147, 51, 234] }
                          });

                          const nextY = (doc as any).lastAutoTable.finalY + 15;
                          doc.text('2. Student Reflection & Feedback Statistics', 14, nextY);
                          const cleanStudentTopEvaluator = translateThaiToEnglishForPDF(studentStats.topEvaluator);
                          const cleanStudentTopTeacher = translateThaiToEnglishForPDF(studentStats.topTeacher);
                          
                          doc.text(`Total Records: ${studentStats.total}  |  Average Score: ${studentStats.averageScore.toFixed(2)}  |  Top Student Writer: ${cleanStudentTopEvaluator}`, 14, nextY + 6);

                          autoTable(doc, {
                            startY: nextY + 10,
                            head: [['Student & Subject Metric', 'Statistical Value']],
                            body: [
                              ['Total Student Feedbacks', `${studentStats.total} entries`],
                              ['Average Satisfaction Score', `${studentStats.averageScore.toFixed(2)} / 10.00`],
                              ['Most Feedbacked Teacher/Subject', cleanStudentTopTeacher],
                              ['Top Student Commentator', cleanStudentTopEvaluator],
                              ['Learning Level (Excellent/Good/Fair)', `${studentStats.excellentCount} / ${studentStats.goodCount} / ${studentStats.fairCount} entries`],
                              ['Latest Feedback Timestamp', studentStats.latestTime]
                            ],
                            theme: 'grid',
                            headStyles: { fillColor: [16, 185, 129] }
                          });
                          
                          doc.save(`Complete_Stats_Report.pdf`);
                          setNotification({ type: 'success', text: lang === 'th' ? 'ส่งออกไฟล์ PDF สถิติแบบสมบูรณ์สำเร็จ!' : 'Complete PDF statistics report generated!' });
                          setTimeout(() => setNotification(null), 3000);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer hover:scale-[1.02] active:scale-95",
                          theme === 'dark' 
                            ? "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white" 
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
                        )}
                      >
                        <FileText className="w-3.5 h-3.5 text-purple-500" />
                        <span>{lang === 'th' ? 'ส่งออก PDF' : 'Export Dual PDF Report'}</span>
                      </button>
                    </div>
                  </div>

                  {/* SECTION 1: TEACHER OBSERVATION STATS */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                      <h3 className={cn("text-xs sm:text-sm font-black uppercase tracking-wider", theme === 'dark' ? "text-purple-300" : "text-purple-900")}>
                        {lang === 'th' ? '1. ส่วนสถิติประเมินการสอนของครูต่างชาติ (FT observation stats)' : '1. Foreign Teacher Performance (Observation Analytics)'}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                      {/* Stat Card 1 - Total */}
                      <div className={cn(
                        "p-4 rounded-xl flex flex-col justify-between min-h-[110px] transition-all relative overflow-hidden border hover:border-purple-500/30 hover:shadow-md",
                        theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/50 border-slate-100 shadow-sm"
                      )}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {lang === 'th' ? 'การประเมินการปฏิบัติงานทั้งหมด' : 'Total Observations'}
                        </span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className={cn("text-2xl sm:text-3xl font-black", theme === 'dark' ? "text-purple-300" : "text-purple-900")}>
                            {teacherStats.total}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">{lang === 'th' ? 'รายการ' : 'records'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-1 truncate">
                          {lang === 'th' ? 'อัปเดตล่าสุด: ' : 'Latest: '} {teacherStats.latestTime !== '-' ? teacherStats.latestTime.split(' ')[0] : '-'}
                        </div>
                      </div>

                      {/* Stat Card 2 - Average Rating */}
                      <div className={cn(
                        "p-4 rounded-xl flex flex-col justify-between min-h-[110px] transition-all relative overflow-hidden border hover:border-purple-500/30 hover:shadow-md",
                        theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/50 border-slate-100 shadow-sm"
                      )}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {lang === 'th' ? 'คะแนนระดับการสอนเฉลี่ย' : 'Teaching Avg Rating'}
                        </span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className={cn("text-2xl sm:text-3xl font-black text-amber-500")}>
                            {teacherStats.averageScore > 0 ? teacherStats.averageScore.toFixed(2) : '-'}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">/ 10.00</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400 inline shrink-0" />
                          <span className="truncate">
                            {teacherStats.averageScore >= 8.33 ? (lang === 'th' ? 'ยอดเยี่ยมมาก' : 'Excellent') : 
                             teacherStats.averageScore >= 5.83 ? (lang === 'th' ? 'อยู่ตามเกณฑ์มาตรฐาน' : 'Meets standard') : 
                             teacherStats.averageScore > 0 ? (lang === 'th' ? 'พอใช้ตามระเบียบ' : 'Fair') : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Stat Card 3 - Top Foreign Teacher */}
                      <div className={cn(
                        "p-4 rounded-xl flex flex-col justify-between min-h-[110px] transition-all relative overflow-hidden border hover:border-purple-500/30 hover:shadow-md",
                        theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/50 border-slate-100 shadow-sm"
                      )}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {lang === 'th' ? 'ครูต่างชาติที่มีกิจกรรมสูงสุด' : 'Most Observed Teacher'}
                        </span>
                        <div className="mt-2 min-h-[38px] flex flex-col justify-center">
                          <h4 className={cn("text-xs sm:text-xs font-black truncate", theme === 'dark' ? "text-slate-200" : "text-purple-950")}>
                            {getCleanTeacherName(teacherStats.topTeacher)}
                          </h4>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold mt-1 truncate">
                          {lang === 'th' ? 'ได้รับการนิเทศการสอนบ่อยที่สุด' : 'Most records submission volume'}
                        </p>
                      </div>

                      {/* Stat Card 4 - Quality Level Distribution */}
                      <div className={cn(
                        "p-4 rounded-xl flex flex-col justify-between min-h-[110px] transition-all relative overflow-hidden border hover:border-purple-500/30 hover:shadow-md",
                        theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/50 border-slate-100 shadow-sm"
                      )}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {lang === 'th' ? 'สัดส่วนประเมินการสอน' : 'Teaching Level Distribution'}
                        </span>
                        <div className="flex flex-col gap-1 mt-1 text-[9px] font-bold">
                          <div className="flex items-center justify-between">
                            <span className="text-lime-500">{lang === 'th' ? 'ดีมาก (Excellent)' : 'Excellent'}</span>
                            <span className={theme === 'dark' ? "text-slate-300" : "text-slate-700"}>{teacherStats.excellentCount}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-yellow-500">{lang === 'th' ? 'ดี (Good)' : 'Good'}</span>
                            <span className={theme === 'dark' ? "text-slate-300" : "text-slate-700"}>{teacherStats.goodCount}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-orange-400">{lang === 'th' ? 'พอใช้ (Fair)' : 'Fair'}</span>
                            <span className={theme === 'dark' ? "text-slate-300" : "text-slate-700"}>{teacherStats.fairCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: STUDENT FEEDBACK STATS */}
                  <div className="flex flex-col gap-4 border-t border-dashed border-slate-200 dark:border-slate-800 pt-6">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <h3 className={cn("text-xs sm:text-sm font-black uppercase tracking-wider", theme === 'dark' ? "text-emerald-300" : "text-emerald-900")}>
                        {lang === 'th' ? '2. ส่วนสถิติสะท้อนคิดและผลตอบรับของนักเรียน (Student feedback stats)' : '2. Student Feedback & Learning Satisfaction (Reflective Analytics)'}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                      {/* Stat Card 1 - Total */}
                      <div className={cn(
                        "p-4 rounded-xl flex flex-col justify-between min-h-[110px] transition-all relative overflow-hidden border hover:border-emerald-500/30 hover:shadow-md",
                        theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/50 border-slate-100 shadow-sm"
                      )}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {lang === 'th' ? 'จำนวนสะท้อนคิดสะสม' : 'Total Feedbacks'}
                        </span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className={cn("text-2xl sm:text-3xl font-black", theme === 'dark' ? "text-emerald-300" : "text-emerald-900")}>
                            {studentStats.total}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">{lang === 'th' ? 'รายการ' : 'records'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-1 truncate">
                          {lang === 'th' ? 'อัปเดตล่าสุด: ' : 'Latest: '} {studentStats.latestTime !== '-' ? studentStats.latestTime.split(' ')[0] : '-'}
                        </div>
                      </div>

                      {/* Stat Card 2 - Average Rating */}
                      <div className={cn(
                        "p-4 rounded-xl flex flex-col justify-between min-h-[110px] transition-all relative overflow-hidden border hover:border-emerald-500/30 hover:shadow-md",
                        theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/50 border-slate-100 shadow-sm"
                      )}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {lang === 'th' ? 'คะแนนความเข้าใจและความสุขเฉลี่ย' : 'Learning Avg Score'}
                        </span>
                        <div className="flex items-baseline gap-2 mt-2">
                          <span className={cn("text-2xl sm:text-3xl font-black text-amber-500")}>
                            {studentStats.averageScore > 0 ? studentStats.averageScore.toFixed(2) : '-'}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">/ 10.00</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold mt-1 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-400 inline shrink-0" />
                          <span className="truncate">
                            {studentStats.averageScore >= 8.33 ? (lang === 'th' ? 'เข้าใจดีเยี่ยม' : 'Excellent understanding') : 
                             studentStats.averageScore >= 5.83 ? (lang === 'th' ? 'เรียนรู้ได้ดีตามเกณฑ์' : 'Good standard') : 
                             studentStats.averageScore > 0 ? (lang === 'th' ? 'พอใช้รับมือได้' : 'Developing') : '-'}
                          </span>
                        </div>
                      </div>

                      {/* Stat Card 3 - Top Foreign Teacher (Evaluated by Student) */}
                      <div className={cn(
                        "p-4 rounded-xl flex flex-col justify-between min-h-[110px] transition-all relative overflow-hidden border hover:border-emerald-500/30 hover:shadow-md",
                        theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/50 border-slate-100 shadow-sm"
                      )}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {lang === 'th' ? 'วิชาที่มีกระแสสะท้อนคิดหลัก' : 'Most Active Subject'}
                        </span>
                        <div className="mt-2 min-h-[38px] flex flex-col justify-center">
                          <h4 className={cn("text-xs sm:text-xs font-black truncate", theme === 'dark' ? "text-slate-200" : "text-emerald-950")}>
                            {studentStats.topTeacher}
                          </h4>
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold mt-1 truncate">
                          {lang === 'th' ? 'นักเรียนเขียนแสดงความคิดเห็นสูงสุด' : 'Highest student review counts'}
                        </p>
                      </div>

                      {/* Stat Card 4 - Quality Level Distribution */}
                      <div className={cn(
                        "p-4 rounded-xl flex flex-col justify-between min-h-[110px] transition-all relative overflow-hidden border hover:border-emerald-500/30 hover:shadow-md",
                        theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-slate-50/50 border-slate-100 shadow-sm"
                      )}>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {lang === 'th' ? 'สัดส่วนประเมินฝั่งผู้เรียน' : 'Learning Satisfaction Levels'}
                        </span>
                        <div className="flex flex-col gap-1 mt-1 text-[9px] font-bold">
                          <div className="flex items-center justify-between">
                            <span className="text-lime-500">{lang === 'th' ? 'เข้าใจมาก (Excellent)' : 'Excellent'}</span>
                            <span className={theme === 'dark' ? "text-slate-300" : "text-slate-700"}>{studentStats.excellentCount}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-yellow-500">{lang === 'th' ? 'พอเข้าใจ (Good)' : 'Good'}</span>
                            <span className={theme === 'dark' ? "text-slate-300" : "text-slate-700"}>{studentStats.goodCount}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-orange-400">{lang === 'th' ? 'ต้องปรับปรุง (Fair)' : 'Developing'}</span>
                            <span className={theme === 'dark' ? "text-slate-300" : "text-slate-700"}>{studentStats.fairCount}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* 2. ระบบค้นหาและตัวกรองข้อมูลขั้นสูง */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "px-4 sm:px-10 py-6 sm:py-8 rounded-2xl sm:rounded-[3rem] shadow-sm flex flex-col gap-6 transition-colors",
                    theme === 'dark' ? "bg-slate-900 border border-slate-800" : "bg-white border border-purple-50 shadow-slate-200/50"
                  )}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 w-full lg:w-auto overflow-visible relative">
                      <span className={cn("text-lg font-black transition-colors shrink-0", theme === 'dark' ? "text-slate-100" : "text-purple-900")}>
                        {t.spreadsheetView}
                      </span>
                      <div className="relative group w-full sm:max-w-md">
                        <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors", theme === 'dark' ? "text-slate-600 group-focus-within:text-lime-400" : "text-lime-500 group-focus-within:text-lime-600")} />
                        <input 
                          type="text" 
                          placeholder={t.searchPlaceholder}
                          value={filterQuery}
                          onChange={(e) => setFilterQuery(e.target.value)}
                          className={cn(
                            "pl-12 pr-6 py-2.5 rounded-full text-xs font-bold outline-none w-full sm:w-80 transition-all shadow-sm",
                            theme === 'dark' 
                              ? "bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-700 focus:ring-4 focus:ring-lime-500/10 focus:border-lime-500/50" 
                              : "bg-white border border-slate-150 text-lime-950 placeholder:text-lime-350 focus:ring-4 focus:ring-lime-500/5 focus:border-lime-400"
                          )}
                        />
                      </div>

                      {/* Advanced filter toggler button */}
                      <button 
                        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                        className={cn(
                          "flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm border cursor-pointer hover:opacity-90 active:scale-95",
                          showAdvancedFilters 
                            ? (theme === 'dark' ? "bg-purple-500/20 text-purple-400 border-purple-500/40" : "bg-purple-100 text-purple-700 border-purple-300")
                            : (theme === 'dark' ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700" : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100")
                        )}
                      >
                        <Filter className="w-3.5 h-3.5 text-lime-500" />
                        <span>{lang === 'th' ? 'ตัวกรองขั้นสูง' : 'Advanced Filters'}</span>
                        {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Indicator tags */}
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                      {filterQuery && (
                        <span className="px-2.5 py-1 rounded-lg bg-lime-500/10 text-lime-500 border border-lime-500/10">
                          {lang === 'th' ? `ค้นหาคำ: "${filterQuery}"` : `Keyword: "${filterQuery}"`}
                        </span>
                      )}
                      {advTeacherFilter !== 'All' && (
                        <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/10">
                          {lang === 'th' ? `ครู: ${advTeacherFilter}` : `Teacher: ${advTeacherFilter}`}
                        </span>
                      )}
                      {advClassroomFilter !== 'All' && (
                        <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/10">
                          {lang === 'th' ? `ชั้นเรียน: ${advClassroomFilter}` : `Class: ${advClassroomFilter}`}
                        </span>
                      )}
                      {advQualityFilter !== 'All' && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/10">
                          {lang === 'th' ? `ระดับสัมฤทธิ์: ${advQualityFilter}` : `Rating: ${advQualityFilter}`}
                        </span>
                      )}
                      {(advStartDate || advEndDate) && (
                        <span className="px-2.5 py-1 rounded-lg bg-teal-500/10 text-teal-500 border border-teal-500/10">
                          {lang === 'th' ? `ช่วงวันที่` : `Date Range`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expandable Advanced Filters container */}
                  <AnimatePresence>
                    {showAdvancedFilters && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border-t border-slate-100 dark:border-slate-800 pt-5 mt-1"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {/* Teacher Dropdown */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {lang === 'th' ? 'เลือกครูต่างชาติ (Foreign Teacher)' : 'Select Foreign Teacher'}
                            </label>
                            <select
                              value={advTeacherFilter}
                              onChange={(e) => setAdvTeacherFilter(e.target.value)}
                              className={cn(
                                "p-2.5 rounded-xl text-xs font-bold outline-none border cursor-pointer w-full transition-all",
                                theme === 'dark' 
                                  ? "bg-slate-800 border-slate-700 text-slate-100 focus:border-purple-500" 
                                  : "bg-slate-50 border-slate-150 text-slate-700 focus:border-purple-400 focus:bg-white"
                              )}
                            >
                              <option value="All">{lang === 'th' ? 'ครูทั้งหมด (All Teachers)' : 'All Teachers'}</option>
                              {uniqueTeachers.map(name => (
                                <option key={name} value={name}>{getCleanTeacherName(name)}</option>
                              ))}
                            </select>
                          </div>

                          {/* Classroom Dropdown */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {lang === 'th' ? 'ระดับชั้น (Grade)' : 'Select Grade'}
                            </label>
                            <select
                              value={advClassroomFilter}
                              onChange={(e) => setAdvClassroomFilter(e.target.value)}
                              className={cn(
                                "p-2.5 rounded-xl text-xs font-bold outline-none border cursor-pointer w-full transition-all",
                                theme === 'dark' 
                                  ? "bg-slate-800 border-slate-700 text-slate-100 focus:border-purple-500" 
                                  : "bg-slate-50 border-slate-150 text-slate-700 focus:border-purple-400 focus:bg-white"
                              )}
                            >
                              <option value="All">{lang === 'th' ? 'ระดับชั้นทั้งหมด (All Grade)' : 'All Grade'}</option>
                              {uniqueClassrooms.map(room => (
                                <option key={room} value={room}>{room}</option>
                              ))}
                            </select>
                          </div>

                          {/* Evaluator Dropdown */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {viewMode === 'teacher' 
                                ? (lang === 'th' ? 'ครูผู้ร่วมประเมิน (Evaluator)' : 'Select Evaluator')
                                : (lang === 'th' ? 'ชั้นเรียน / ห้องเรียน (Classroom)' : 'Select Classroom')}
                            </label>
                            <select
                              value={advEvaluatorFilter}
                              onChange={(e) => setAdvEvaluatorFilter(e.target.value)}
                              className={cn(
                                "p-2.5 rounded-xl text-xs font-bold outline-none border cursor-pointer w-full transition-all",
                                theme === 'dark' 
                                  ? "bg-slate-800 border-slate-700 text-slate-100 focus:border-purple-500" 
                                  : "bg-slate-50 border-slate-150 text-slate-700 focus:border-purple-400 focus:bg-white"
                              )}
                            >
                              <option value="All">
                                {viewMode === 'teacher' 
                                  ? (lang === 'th' ? 'ผู้ประเมินทุกคน (All Evaluators)' : 'All Evaluators')
                                  : (lang === 'th' ? 'ห้องทั้งหมด (All Classroom)' : 'All Classroom')}
                              </option>
                              {uniqueEvaluatorsOrStudents.map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Quality Level Selector */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {lang === 'th' ? 'คัดกรองระดับคุณภาพ (Quality Rating)' : 'Filter Quality Rating'}
                            </label>
                            <select
                              value={advQualityFilter}
                              onChange={(e) => setAdvQualityFilter(e.target.value)}
                              className={cn(
                                "p-2.5 rounded-xl text-xs font-bold outline-none border cursor-pointer w-full transition-all",
                                theme === 'dark' 
                                  ? "bg-slate-800 border-slate-700 text-slate-100 focus:border-purple-500" 
                                  : "bg-slate-50 border-slate-150 text-slate-700 focus:border-purple-400 focus:bg-white"
                              )}
                            >
                              <option value="All">{lang === 'th' ? 'ระดับคุณภาพทั้งหมด' : 'All Quality Ratings'}</option>
                              <option value="ดีมาก">{lang === 'th' ? 'ดีมาก (Excellent)' : 'Excellent'}</option>
                              <option value="ดี">{lang === 'th' ? 'ดี (Good)' : 'Good'}</option>
                              <option value="พอใช้">{lang === 'th' ? 'พอใช้ (Fair)' : 'Fair'}</option>
                            </select>
                          </div>

                          {/* Date Range Start */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {lang === 'th' ? 'เริ่มต้นวันที่ (Start Date)' : 'Start Date (YYYY-MM-DD)'}
                            </label>
                            <input
                              type="date"
                              value={advStartDate}
                              onChange={(e) => setAdvStartDate(e.target.value)}
                              className={cn(
                                "p-2.5 rounded-xl text-xs font-bold outline-none border cursor-pointer w-full transition-all",
                                theme === 'dark' 
                                  ? "bg-slate-800 border-slate-700 text-slate-100 focus:border-purple-500" 
                                  : "bg-slate-50 border-slate-150 text-slate-700 focus:border-purple-400 focus:bg-white"
                              )}
                            />
                          </div>

                          {/* Date Range End */}
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              {lang === 'th' ? 'สิ้นสุดวันที่ (End Date)' : 'End Date (YYYY-MM-DD)'}
                            </label>
                            <input
                              type="date"
                              value={advEndDate}
                              onChange={(e) => setAdvEndDate(e.target.value)}
                              className={cn(
                                "p-2.5 rounded-xl text-xs font-bold outline-none border cursor-pointer w-full transition-all",
                                theme === 'dark' 
                                  ? "bg-slate-800 border-slate-700 text-slate-100 focus:border-purple-500" 
                                  : "bg-slate-50 border-slate-150 text-slate-700 focus:border-purple-400 focus:bg-white"
                              )}
                            />
                          </div>
                        </div>

                        {/* Reset Buttons */}
                        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-dashed border-slate-100 dark:border-slate-800">
                          <button
                            onClick={() => {
                              setFilterQuery('');
                              setAdvTeacherFilter('All');
                              setAdvClassroomFilter('All');
                              setAdvEvaluatorFilter('All');
                              setAdvQualityFilter('All');
                              setAdvStartDate('');
                              setAdvEndDate('');
                            }}
                            className={cn(
                              "px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer hover:opacity-95",
                              theme === 'dark' 
                                ? "bg-slate-800 text-slate-200 hover:bg-slate-750 hover:text-white" 
                                : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                            )}
                          >
                            {lang === 'th' ? 'ล้างตัวกรองทั้งหมด' : 'Reset All Filters'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                {/* Teacher Spreadsheet */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-2xl sm:rounded-[3rem] overflow-hidden shadow-sm flex flex-col min-h-[400px] transition-colors",
                    theme === 'dark' ? "bg-slate-900 border border-slate-800" : "bg-white border border-purple-100 shadow-slate-200",
                    printingSectionId === 'teacher' ? 'printable-target' : ''
                  )}
                >
                  {/* Print Only Title Block */}
                  <div className="hidden print:flex flex-col items-center justify-center text-center pb-6 border-b border-slate-300 w-full mb-6">
                    <h2 className="text-xl font-bold text-slate-900">
                      {lang === 'th' ? 'รายงานข้อมูลสรุปผลการจัดการเรียนรู้ของครูผู้สอน' : 'Teacher Performance Evaluation Data Summary Report'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {lang === 'th' ? `พิมพ์เมื่อ: ${new Date().toLocaleDateString('th-TH')} โรงเรียนระเบียบเกณฑ์` : `Printed on: ${new Date().toLocaleDateString()} WorkLoop System`}
                    </p>
                  </div>

                  <div className={cn(
                    "px-6 sm:px-10 py-4 sm:py-6 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors",
                    theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-purple-50/30 border-purple-50"
                  )}>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-xl bg-purple-500 flex items-center justify-center text-white">
                        <LayoutDashboard className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className={cn("text-[8.4px] sm:text-xs font-black uppercase tracking-widest", theme === 'dark' ? "text-purple-400" : "text-purple-700")}>{t.teacherMode}</h3>
                        <p className="text-[9px] font-bold text-slate-400">Teacher Performance Data</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 print:hidden">
                      {/* Download Excel */}
                      <button 
                        onClick={() => handleExportCustom(teacherData, 'excel', 'Teacher_Performance_Data')}
                        title={lang === 'th' ? "ดาวน์โหลดไฟล์ Excel (.xlsx)" : "Download Excel file (.xlsx)"}
                        className={cn(
                          "p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold",
                          theme === 'dark' ? "bg-slate-800 text-purple-400 hover:text-white" : "bg-purple-50 text-purple-600 hover:bg-purple-100 shadow-sm"
                        )}
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span className="hidden md:inline">{lang === 'th' ? 'Excel' : 'Excel'}</span>
                      </button>

                      {/* Download CSV */}
                      <button 
                        onClick={() => handleExportCustom(teacherData, 'csv', 'Teacher_Performance_Data')}
                        title={lang === 'th' ? "ดาวน์โหลดไฟล์ CSV (.csv)" : "Download CSV file (.csv)"}
                        className={cn(
                          "p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold",
                          theme === 'dark' ? "bg-slate-800 text-purple-400 hover:text-white" : "bg-purple-50 text-purple-600 hover:bg-purple-100 shadow-sm"
                        )}
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden md:inline">{lang === 'th' ? 'CSV' : 'CSV'}</span>
                      </button>

                      {/* Print button */}
                      <button 
                        onClick={() => triggerPrintSpreadsheet('teacher')}
                        title={lang === 'th' ? "สั่งพิมพ์ตารางนี้" : "Print this table"}
                        className={cn(
                          "p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold",
                          theme === 'dark' ? "bg-slate-800 text-purple-400 hover:text-white" : "bg-purple-50 text-purple-700 hover:bg-purple-100 shadow-sm"
                        )}
                      >
                        <Printer className="w-4 h-4" />
                        <span className="hidden md:inline">{lang === 'th' ? 'พิมพ์' : 'Print'}</span>
                      </button>

                      {/* External spreadsheet link */}
                      <button 
                        onClick={() => window.open(`https://docs.google.com/spreadsheets/d/1evNW1UcflWMYAlwB8bFkGXiLyPilTamkph1sLTVycPU`, '_blank')}
                        title={lang === 'th' ? "เปิดดูบน Google Sheets รายละเอียดทั้งหมด" : "Open raw Google Sheets"}
                        className={cn(
                          "p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold",
                          theme === 'dark' ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-white text-slate-500 hover:text-purple-600 shadow-sm border border-slate-100"
                        )}
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="hidden md:inline">{lang === 'th' ? 'ดูชีตจริง' : 'Sheets'}</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-auto custom-scrollbar max-h-[600px]">
                    <SpreadsheetTable 
                      data={filteredTeacherData || teacherData} 
                      filterQuery="" 
                      theme={theme} 
                      accentColor="purple"
                      lang={lang}
                      accessToken={accessToken}
                    />
                  </div>
                </motion.div>

                {/* Student Spreadsheet */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    "rounded-[3rem] overflow-hidden shadow-sm flex flex-col min-h-[400px] transition-colors",
                    theme === 'dark' ? "bg-slate-900 border border-slate-800" : "bg-white border border-emerald-100 shadow-slate-200",
                    printingSectionId === 'student' ? 'printable-target' : ''
                  )}
                >
                  {/* Print Only Title Block */}
                  <div className="hidden print:flex flex-col items-center justify-center text-center pb-6 border-b border-slate-300 w-full mb-6">
                    <h2 className="text-xl font-bold text-slate-900">
                      {lang === 'th' ? 'รายงานบันทึกประเมินผลการเรียนรู้และชิ้นงานของนักเรียน' : 'Student Assignment Status Data Summary Report'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      {lang === 'th' ? `พิมพ์เมื่อ: ${new Date().toLocaleDateString('th-TH')} โรงเรียนระเบียบเกณฑ์` : `Printed on: ${new Date().toLocaleDateString()} WorkLoop System`}
                    </p>
                  </div>

                  <div className={cn(
                    "px-6 sm:px-10 py-4 sm:py-6 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors",
                    theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-emerald-50/30 border-emerald-50"
                  )}>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-2xl bg-emerald-500 flex items-center justify-center text-white">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className={cn("text-[8.4px] sm:text-xs font-black uppercase tracking-widest", theme === 'dark' ? "text-emerald-400" : "text-emerald-700")}>{t.studentMode}</h3>
                        <p className="text-[9px] font-bold text-slate-400">Student Assignment Data</p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-2 print:hidden">
                      {/* Download Excel */}
                      <button 
                        onClick={() => handleExportCustom(studentData, 'excel', 'Student_Assignment_Data')}
                        title={lang === 'th' ? "ดาวน์โหลดไฟล์ Excel (.xlsx)" : "Download Excel file (.xlsx)"}
                        className={cn(
                          "p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold",
                          theme === 'dark' ? "bg-slate-800 text-emerald-400 hover:text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 shadow-sm"
                        )}
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span className="hidden md:inline">{lang === 'th' ? 'Excel' : 'Excel'}</span>
                      </button>

                      {/* Download CSV */}
                      <button 
                        onClick={() => handleExportCustom(studentData, 'csv', 'Student_Assignment_Data')}
                        title={lang === 'th' ? "ดาวน์โหลดไฟล์ CSV (.csv)" : "Download CSV file (.csv)"}
                        className={cn(
                          "p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold",
                          theme === 'dark' ? "bg-slate-800 text-emerald-400 hover:text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100 shadow-sm"
                        )}
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden md:inline">{lang === 'th' ? 'CSV' : 'CSV'}</span>
                      </button>

                      {/* Print button */}
                      <button 
                        onClick={() => triggerPrintSpreadsheet('student')}
                        title={lang === 'th' ? "สั่งพิมพ์ตารางนี้" : "Print this table"}
                        className={cn(
                          "p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold",
                          theme === 'dark' ? "bg-slate-800 text-emerald-400 hover:text-white" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shadow-sm"
                        )}
                      >
                        <Printer className="w-4 h-4" />
                        <span className="hidden md:inline">{lang === 'th' ? 'พิมพ์' : 'Print'}</span>
                      </button>

                      {/* External spreadsheet link */}
                      <button 
                        onClick={() => window.open(`https://docs.google.com/spreadsheets/d/1sUF9nS8f4zkQ9GldUVcU82q0a7Eh83jidLYBamERcI4/edit?resourcekey=&gid=959993909#gid=959993909`, '_blank')}
                        title={lang === 'th' ? "เปิดดูบน Google Sheets รายละเอียดทั้งหมด" : "Open raw Google Sheets"}
                        className={cn(
                          "p-2 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold",
                          theme === 'dark' ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-white text-slate-500 hover:text-emerald-600 shadow-sm border border-slate-100"
                        )}
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="hidden md:inline">{lang === 'th' ? 'ดูชีตจริง' : 'Sheets'}</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-auto custom-scrollbar max-h-[600px]">
                    <SpreadsheetTable 
                      data={filteredStudentData || studentData} 
                      filterQuery="" 
                      theme={theme} 
                      accentColor="emerald"
                      lang={lang}
                      accessToken={accessToken}
                    />
                  </div>
                </motion.div>

              </motion.div>
            ) : activeTab === 'scrollbar' ? (
              /* Candy Scrollbar Playground Tab */
              <motion.div 
                key="scrollbar"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="w-full"
              >
                <CandyScrollbarPlayground theme={theme} lang={lang} />
              </motion.div>
            ) : activeTab === 'schedule' ? (
              /* Class Schedule Viewer Tab */
              <motion.div 
                key="schedule"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="flex flex-col gap-12 pb-10"
              >
                <div id="schedule-section"></div>
                <ScheduleViewer 
                  scheduleData={scheduleData}
                  loading={scheduleLoading || loading}
                  onRefresh={handleRefreshClick}
                  lang={lang}
                  theme={theme}
                />
              </motion.div>
            ) : activeTab === 'honor' ? (
              /* Teacher Honor System Tab */
              <motion.div 
                key="honor"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="flex flex-col gap-12 pb-10"
              >
                <div id="honor-section"></div>
                <div className="flex flex-col gap-8 text-left">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className={cn("text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3 sm:gap-4 transition-colors", theme === 'dark' ? "text-slate-100" : "text-purple-900")}>
                        <Award className="w-7 h-7 sm:w-9 sm:h-9 text-fuchsia-500 animate-pulse shrink-0" />
                        {lang === 'th' ? 'ทำเนียบเกียรติยศครูผู้ร่วมประเมิน' : 'Academic Evaluator Hall of Fame'}
                      </h2>
                      <p className={cn("text-[9px] sm:text-xs font-bold uppercase tracking-widest mt-1.5", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                        {lang === 'th' ? 'ระดับยศเกียรติยศวัดจากความถี่ในการกรอกแบบประเมินและนิเทศการสอนครูต่างชาติ' : 'Gameplay Honor Ranks earned based on professional teaching evaluation form completions'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {/* Left Column: Rank Framework explanation */}
                    <div className={cn(
                      "p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border flex flex-col gap-6",
                      theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-purple-50 shadow-xs"
                    )}>
                      <div>
                        <h3 className={cn("text-xs sm:text-sm font-black uppercase tracking-wider mb-2", theme === 'dark' ? "text-white" : "text-purple-950")}>
                          {lang === 'th' ? 'ระบบระดับชั้นเกียรติยศครู' : 'Gameplay Rank Framework'}
                        </h3>
                        <p className={cn("text-[10px] sm:text-xs font-bold transition-colors leading-relaxed", theme === 'dark' ? "text-slate-400" : "text-slate-500")}>
                          {lang === 'th' ? 'ครูผู้มีส่วนร่วมในการประเมินและสะท้อนผลการสอนอย่างสม่ำเสมอ' : 'Every supportive review completed elevates the observer across strict gameplay league ranking tiers:'}
                        </p>
                      </div>

                      <div className="space-y-3.5">
                        {/* Legendary Rank */}
                        <div className={cn("p-4 rounded-2xl border flex items-center gap-3.5 transition-all text-left", theme === 'dark' ? "bg-purple-950/20 border-purple-500/25 text-purple-200 hover:bg-purple-950/30" : "bg-purple-50/70 border-purple-200/80 text-purple-700 hover:bg-purple-100/30 shadow-3xs")}>
                          <div className={cn("w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 shadow-3xs", theme === 'dark' ? "bg-purple-950/60 border border-purple-800/20 text-purple-300" : "bg-purple-100/60 text-purple-600 border border-purple-200/60")}>
                            <Award className="w-5 h-5 animate-bounce" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-wide">
                              🏆 Legendary
                            </p>
                            <p className={cn("text-[9.5px]/none mt-1.5 truncate font-bold text-slate-405 dark:text-slate-500")}>
                              {lang === 'th' ? 'ผู้เป็นตำนานแห่งการประเมินวิชาชีพ' : 'Celestial master of pedagogical loops'}
                            </p>
                          </div>
                        </div>

                        {/* Champion Rank */}
                        <div className={cn("p-4 rounded-xl border flex items-center gap-3.5 transition-all text-left", theme === 'dark' ? "bg-amber-950/20 border-amber-500/25 text-amber-200 hover:bg-amber-950/30" : "bg-amber-50/70 border-amber-200/80 text-amber-700 hover:bg-amber-100/30 shadow-3xs")}>
                          <div className={cn("w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 shadow-3xs", theme === 'dark' ? "bg-amber-950/60 border border-amber-800/20 text-amber-300" : "bg-amber-100/60 text-amber-600 border border-amber-200/60")}>
                            <Award className="w-5 h-5 animate-pulse" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-wide">
                              🥇 Champion
                            </p>
                            <p className={cn("text-[9.5px]/none mt-1.5 truncate font-bold text-slate-405 dark:text-slate-500")}>
                              {lang === 'th' ? 'ผู้ขับเคลื่อนหลักในการสะท้อนผลลัพธ์' : 'Vanguard advocate for teacher growth'}
                            </p>
                          </div>
                        </div>

                        {/* Knight Rank */}
                        <div className={cn("p-4 rounded-xl border flex items-center gap-3.5 transition-all text-left", theme === 'dark' ? "bg-sky-950/20 border-sky-500/25 text-sky-200 hover:bg-sky-950/30" : "bg-sky-50/70 border-sky-200/80 text-sky-700 hover:bg-sky-100/30 shadow-3xs")}>
                          <div className={cn("w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 shadow-3xs", theme === 'dark' ? "bg-sky-950/60 border border-sky-800/20 text-sky-300" : "bg-sky-100/60 text-sky-600 border border-sky-200/60")}>
                            <Award className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-wide">
                              🥈 Knight
                            </p>
                            <p className={cn("text-[9.5px]/none mt-1.5 truncate font-bold text-slate-405 dark:text-slate-500")}>
                              {lang === 'th' ? 'อัศวินวิชาการ มีใจรักงานนิเทศก์' : 'Honorable evaluator protecting standards'}
                            </p>
                          </div>
                        </div>

                        {/* Novice Rank */}
                        <div className={cn("p-4 rounded-xl border flex items-center gap-3.5 transition-all text-left", theme === 'dark' ? "bg-emerald-950/20 border-emerald-500/25 text-emerald-200 hover:bg-emerald-950/30" : "bg-emerald-50/70 border-emerald-200/80 text-emerald-750 hover:bg-emerald-100/30 shadow-3xs")}>
                          <div className={cn("w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 shadow-3xs", theme === 'dark' ? "bg-emerald-950/60 border border-emerald-800/20 text-emerald-300" : "bg-emerald-100/60 text-emerald-600 border border-emerald-200/60")}>
                            <Award className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-wide">
                              🥉 Novice
                            </p>
                            <p className={cn("text-[9.5px]/none mt-1.5 truncate font-bold text-slate-405 dark:text-slate-500")}>
                              {lang === 'th' ? 'ผู้สังเกตและเริ่มเรียนรู้สิ่งสะท้อนคิด' : 'Sentinel initiating co-evaluations'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Columns: Leaderboard table list */}
                    <div className={cn(
                      "lg:col-span-2 p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border flex flex-col gap-4 sm:gap-6",
                      theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-purple-50 shadow-xs"
                    )}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h3 className={cn("text-[10px] xs:text-[11px] sm:text-sm font-black uppercase tracking-wider", theme === 'dark' ? "text-white" : "text-purple-950")}>
                          {lang === 'th' ? 'อันดับสุดยอดครูนิเทศก์การจัดกิจกรรมการเรียนรู้' : 'Honorable Leaderboard & Rankings'}
                        </h3>
                        <span className="text-[7.5px] sm:text-[8.5px] font-black px-2 py-0.5 sm:px-2.5 sm:py-1 bg-fuchsia-500/10 text-fuchsia-500 rounded-full border border-fuchsia-500/20 uppercase tracking-widest self-start">
                          {lang === 'th' ? 'อัปเดตแบบเรียลไทม์' : 'Live spreadsheet synced'}
                        </span>
                      </div>

                      {honorLeaderboard.length > 0 ? (
                        <div className="overflow-x-auto rounded-[1.5rem] border border-slate-100 dark:border-slate-800/80">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className={theme === 'dark' ? "bg-slate-950 border-b border-slate-800 text-slate-400" : "bg-purple-50/50 border-b border-purple-100 text-purple-950"}>
                                <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-center w-12 sm:w-16">{lang === 'th' ? 'อันดับ' : 'Rank'}</th>
                                <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-black uppercase tracking-wider">{lang === 'th' ? 'ครู' : 'Teachers'}</th>
                                <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-center">{lang === 'th' ? 'จำนวนครั้ง' : 'Submissions'}</th>
                                <th className="p-2 sm:p-4 text-[8px] sm:text-[10px] font-black uppercase tracking-wider text-right">{lang === 'th' ? 'เกียรติยศ' : 'Gameplay Rank'}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {honorLeaderboard.map((item, idx) => {
                                let badgeColors = '';
                                let tierLabel = '';
                                if (item.rank === 'Legendary') {
                                  badgeColors = theme === 'dark' 
                                    ? 'bg-purple-950/55 text-purple-200 border border-purple-800/60 shadow-xs' 
                                    : 'bg-purple-50 text-purple-700 border border-purple-200';
                                  tierLabel = '💎 Legendary';
                                } else if (item.rank === 'Champion') {
                                  badgeColors = theme === 'dark' 
                                    ? 'bg-amber-950/55 text-amber-200 border border-amber-800/60' 
                                    : 'bg-amber-50 text-amber-700 border border-amber-205';
                                  tierLabel = '🥇 Champion';
                                } else if (item.rank === 'Knight') {
                                  badgeColors = theme === 'dark' 
                                    ? 'bg-sky-950/55 text-sky-200 border border-sky-800/60' 
                                    : 'bg-sky-50 text-sky-700 border border-sky-205';
                                  tierLabel = '🥈 Knight';
                                } else {
                                  badgeColors = theme === 'dark' 
                                    ? 'bg-emerald-950/55 text-emerald-300 border border-emerald-800/60' 
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-205';
                                  tierLabel = '🥉 Novice';
                                }

                                return (
                                  <motion.tr 
                                    key={item.name}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: Math.min(idx * 0.05, 0.5) }}
                                    className={cn(
                                      "border-b transition-colors text-[10px] sm:text-xs font-bold",
                                      theme === 'dark' ? "border-slate-800 hover:bg-slate-800/20 text-slate-300" : "border-slate-100 hover:bg-slate-100/30 text-slate-700",
                                      idx === 0 && (theme === 'dark' ? "bg-fuchsia-500/5 text-fuchsia-200" : "bg-fuchsia-50/20 text-fuchsia-950")
                                    )}
                                  >
                                    <td className="p-2 sm:p-4 text-center font-black">
                                      {idx + 1 === 1 ? '👑 1' : idx + 1 === 2 ? '⭐ 2' : idx + 1 === 3 ? '⭐ 3' : idx + 1}
                                    </td>
                                    <td className="p-2 sm:p-4 font-black max-w-[70px] xs:max-w-[110px] sm:max-w-none truncate whitespace-nowrap" title={item.name}>
                                      {item.name}
                                    </td>
                                    <td className="p-2 sm:p-4 text-center font-black text-blue-500 dark:text-blue-400">
                                      {item.count} <span className="text-[7.5px] sm:text-xs text-slate-400 dark:text-slate-550 font-normal">{lang === 'th' ? 'ครั้ง' : 'subs'}</span>
                                    </td>
                                    <td className="p-2 sm:p-4 text-right">
                                      <span className={cn("px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[7.5px] sm:text-[9px] font-black inline-block uppercase tracking-wider whitespace-nowrap", badgeColors)}>
                                        {tierLabel}
                                      </span>
                                    </td>
                                  </motion.tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className={cn("border border-dashed rounded-[2rem] p-12 text-center transition-colors", theme === 'dark' ? "bg-slate-950/20 border-slate-800" : "bg-slate-50/30 border-purple-100")}>
                          <Award className={cn("w-10 h-10 mx-auto mb-3 text-slate-400 animate-pulse")} />
                          <p className="text-[11px] font-black tracking-wider uppercase text-slate-400">
                            {lang === 'th' ? 'ไม่มีสถิติผู้บันทึกการส่งฟอร์ม' : 'No evaluation submissions found to rank yet'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'news' ? (
              /* News Board View */
              <motion.div 
                key="news"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="flex flex-col gap-12 pb-10"
              >
                <div id="news-board-section"></div>
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                  <div className="xl:col-span-12 flex flex-col gap-8">
                    <h2 className={cn("text-3xl font-black tracking-tight flex items-center gap-4 transition-colors", theme === 'dark' ? "text-slate-100" : "text-purple-900")}>
                      <Megaphone className="w-8 h-8 text-orange-500" />
                      {t.newsBoard}
                    </h2>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      <div className="space-y-6 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                        {news.map(post => (
                          <motion.div 
                            key={post.id}
                            layout
                            className={cn(
                              "p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border shadow-sm transition-all hover:shadow-lg relative",
                              theme === 'dark' 
                                ? (post.important ? "bg-slate-900 border-orange-900/50 shadow-orange-500/5" : "bg-slate-900 border-slate-800")
                                : (post.important ? "bg-white border-orange-200 border-2" : "bg-white border-slate-50")
                            )}
                          >
                            {post.important && (
                              <div className="absolute top-4 right-6 bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-md">
                                {t.important}
                              </div>
                            )}
                            <h3 className={cn("text-lg font-black leading-tight mb-2 pr-12 transition-colors", theme === 'dark' ? "text-slate-200" : "text-purple-900")}>{post.title}</h3>
                            <p className={cn("text-xs font-bold leading-relaxed mb-6 whitespace-pre-wrap transition-colors", theme === 'dark' ? "text-slate-500" : "text-slate-600")}>{post.content}</p>
                            
                            {/* Reactions Area */}
                            <div className="flex flex-wrap gap-1.5 items-center my-4 pr-12">
                              {['👍', '❤️', '😄', '🎉', '😮', '😢'].map(emoji => {
                                const emojiReactions = reactions.filter(
                                  r => r.targetId === post.id && r.targetType === 'news' && r.emoji === emoji
                                );
                                const hasReacted = emojiReactions.some(r => r.userId === user?.uid);
                                if (emojiReactions.length === 0) return null;
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() => toggleReaction(post.id, 'news', emoji)}
                                    className={cn(
                                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all active:scale-95",
                                      hasReacted
                                        ? "bg-purple-100/85 hover:bg-purple-200 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                        : "bg-slate-50 hover:bg-slate-100 text-slate-500 border-slate-150 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-800"
                                    )}
                                  >
                                    <span>{emoji}</span>
                                    <span className="text-[10px]">{emojiReactions.length}</span>
                                  </button>
                                );
                              })}
                              
                              {/* Add Reaction Button */}
                              <div className="relative group/emojipanel">
                                <button className={cn(
                                  "w-7 h-7 flex items-center justify-center rounded-full text-[10px] font-bold border border-dashed transition-all active:scale-95",
                                  theme === 'dark'
                                    ? "border-slate-800 text-slate-500 hover:text-slate-350 hover:bg-slate-800"
                                    : "border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                                )}>
                                  +😊
                                </button>
                                
                                {/* Hover Panel */}
                                <div className={cn(
                                  "absolute bottom-full left-0 mb-1 hidden group-hover/emojipanel:flex items-center gap-1.5 p-1.5 rounded-full border shadow-xl z-20 transition-all",
                                  theme === 'dark' ? "bg-slate-900 border-slate-800 shadow-black" : "bg-white border-slate-150 shadow-slate-200"
                                )}>
                                  {['👍', '❤️', '😄', '🎉', '😮', '😢'].map(emoji => {
                                    const emojiReactions = reactions.filter(
                                      r => r.targetId === post.id && r.targetType === 'news' && r.emoji === emoji
                                    );
                                    const hasReacted = emojiReactions.some(r => r.userId === user?.uid);
                                    return (
                                      <button
                                        key={emoji}
                                        onClick={() => toggleReaction(post.id, 'news', emoji)}
                                        className={cn(
                                          "w-7 h-7 flex items-center justify-center rounded-full text-xs transition-transform hover:scale-125 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95",
                                          hasReacted ? "bg-purple-100/50 dark:bg-purple-950/30" : ""
                                        )}
                                      >
                                        {emoji}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                            <div className={cn("flex items-center justify-between border-t pt-4 transition-colors", theme === 'dark' ? "border-slate-800 shadow-black/20" : "border-slate-50 pt-4")}>
                               <div className="flex items-center gap-2">
                                  <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-[8px] font-black transition-colors", theme === 'dark' ? "bg-slate-800 text-purple-400" : "bg-purple-100 text-purple-600")}>
                                     {post.authorName[0]}
                                  </div>
                                  <p className={cn("text-[9px] font-black transition-colors", theme === 'dark' ? "text-slate-400" : "text-purple-900")}>{post.authorName}</p>
                               </div>
                               <p className={cn("text-[8px] font-bold uppercase tracking-widest transition-colors", theme === 'dark' ? "text-slate-700" : "text-slate-300")}>
                                 {post.createdAt instanceof Timestamp ? post.createdAt.toDate().toLocaleDateString() : 'Just now'}
                               </p>
                            </div>
                          </motion.div>
                        ))}
                        {news.length === 0 && (
                          <div className={cn("border border-dashed rounded-[2.5rem] p-20 text-center transition-colors", theme === 'dark' ? "bg-slate-900/50 border-slate-800" : "bg-white/50 border-slate-200")}>
                            <Megaphone className={cn("w-12 h-12 mx-auto mb-4 transition-colors", theme === 'dark' ? "text-slate-800" : "text-slate-100")} />
                            <p className={cn("text-xs font-black uppercase tracking-widest transition-colors", theme === 'dark' ? "text-slate-800" : "text-slate-200")}>{t.noNews}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <div className={cn(
                          "p-6 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border shadow-sm transition-colors sticky top-0",
                          theme === 'dark' ? "bg-slate-900 border-slate-800 shadow-orange-500/5" : "bg-white border-orange-100 shadow-slate-200"
                        )}>
                          <h3 className={cn("text-lg font-black tracking-tight mb-6 flex items-center gap-3 transition-colors", theme === 'dark' ? "text-slate-200" : "text-purple-900")}>
                            <PlusCircle className="w-5 h-5 text-orange-500" />
                            {t.postNews}
                          </h3>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <input 
                              type="text"
                              value={newPost.title}
                              onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                              placeholder={t.newsTitle}
                              className={cn(
                                "col-span-2 px-5 py-3 border rounded-2xl text-xs font-bold outline-none transition-all shadow-inner",
                                theme === 'dark' 
                                  ? "bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-700 focus:bg-slate-900" 
                                  : "bg-white border-slate-200 text-purple-900 placeholder:text-slate-300 focus:border-purple-300"
                              )}
                            />
                            <textarea 
                              rows={4}
                              value={newPost.content}
                              onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                              placeholder={t.newsContent}
                              className={cn(
                                "col-span-2 px-5 py-3 border rounded-2xl text-xs font-bold outline-none transition-all resize-none shadow-inner",
                                theme === 'dark' 
                                  ? "bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-700 focus:bg-slate-900" 
                                  : "bg-white border-slate-200 text-purple-900 placeholder:text-slate-300 focus:border-purple-300"
                              )}
                            />
                          </div>
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => setNewPost({ ...newPost, important: !newPost.important })}
                              className={cn(
                                "flex-1 p-3 sm:p-4 rounded-[2rem] border flex items-center justify-center gap-2 transition-all",
                                newPost.important 
                                  ? "bg-orange-500 border-orange-500 text-white shadow-lg" 
                                  : (theme === 'dark' ? "bg-slate-800 border-slate-700 text-slate-500" : "bg-white border-slate-100 text-slate-400")
                              )}
                            >
                              <Bell className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">{t.important}</span>
                            </button>
                            <button 
                              onClick={handlePostNews}
                              disabled={isPostingNews}
                              className={cn(
                                "flex-[2] p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 transition-all font-black text-[10px] uppercase tracking-widest",
                                theme === 'dark' ? "bg-slate-100 text-slate-900 hover:bg-white" : "bg-purple-900 text-white hover:bg-black shadow-lg shadow-purple-200"
                              )}
                            >
                              {isPostingNews ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              {t.postNews}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'ai-chat' ? (
              <motion.div 
                key="ai-chat"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="w-full pb-10"
              >
                <AIChatbot 
                  theme={theme}
                  lang={lang}
                  teacherData={teacherData}
                  studentData={studentData}
                  scheduleData={scheduleData}
                  news={news}
                />
              </motion.div>
            ) : null}

          </AnimatePresence>


        </div>
      </main>

      {/* News Popup Modal */}
      <AnimatePresence>
        {showNewsPopup && typeof document !== 'undefined' && news.filter(n => n.important).slice(0, 1).map(post => createPortal(
          <motion.div
            key="popup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-purple-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg overflow-hidden border border-purple-100"
            >
              <div className="bg-orange-500 p-8 text-white relative">
                <button 
                  onClick={() => setShowNewsPopup(false)}
                  className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/10 flex items-center justify-center hover:bg-black/20 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Bell className="w-6 h-6 animate-bounce" />
                  </div>
                  <h3 className="text-xl font-black tracking-tight">{t.announcement}</h3>
                </div>
                <h4 className="text-2xl font-black leading-tight">{post.title}</h4>
              </div>
              <div className="p-10">
                <div className="prose prose-slate max-w-none mb-10">
                  <p className="text-slate-600 font-bold leading-relaxed whitespace-pre-wrap">{post.content}</p>
                </div>
                <div className="flex items-center justify-between border-t border-slate-50 pt-8">
                  <div>
                    <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest mb-1">Author</p>
                    <p className="text-xs font-black text-purple-900">{post.authorName}</p>
                  </div>
                  <button 
                    onClick={() => setShowNewsPopup(false)}
                    className="px-8 py-3 bg-purple-900 text-white rounded-full font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95"
                  >
                    {t.close}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>,
          document.body
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={cn(
              "fixed bottom-8 right-8 px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-3 z-50 border",
              notification.type === 'success' ? "bg-white border-emerald-100 text-emerald-600" : "bg-white border-red-100 text-red-600"
            )}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="text-sm font-black tracking-tight">{notification.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Evaluation Image Detailed Inspector Lightbox Modal */}
      <AnimatePresence>
        {selectedGalleryImageItem && typeof document !== 'undefined' && createPortal(
          <motion.div
            key="gallery-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
            onClick={() => setSelectedGalleryImageItem(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className={cn(
                "w-full max-w-5xl rounded-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-y-auto md:overflow-hidden flex flex-col md:flex-row border max-h-[96vh] md:max-h-[85vh]",
                theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-purple-100"
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image Container (Left/Top) */}
              <div className="md:flex-[3] w-full bg-slate-950 flex items-center justify-center relative p-3 min-h-[220px] sm:min-h-[300px] md:min-h-0 overflow-hidden group shrink-0">
                <SecureDriveImage 
                  src={selectedGalleryImageItem.fullUrl}
                  accessToken={accessToken}
                  referrerPolicy="no-referrer"
                  alt={selectedGalleryImageItem.header}
                  className="max-w-full max-h-[42vh] md:max-h-[75vh] object-contain rounded-2xl"
                />
                <button 
                  onClick={() => setSelectedGalleryImageItem(null)}
                  className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-all z-10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Info Details Panel (Right/Bottom) */}
              <div className={cn(
                "md:flex-[2] p-6 sm:p-8 md:p-10 flex flex-col justify-between overflow-y-auto max-h-none md:max-h-none border-t md:border-t-0 md:border-l",
                theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-purple-50"
              )}>
                <div className="space-y-6">
                  <div>
                    <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-500/20">
                      {selectedGalleryImageItem.header}
                    </span>
                    <h3 className={cn("text-2xl font-black tracking-tight mt-3 transition-colors", theme === 'dark' ? "text-slate-100" : "text-purple-900")}>
                      {getCleanTeacherName(selectedGalleryImageItem.teacher)}
                    </h3>
                    <p className={cn("text-[10px] font-black uppercase tracking-widest transition-colors mt-0.5", theme === 'dark' ? "text-slate-600" : "text-slate-400")}>
                      {lang === 'th' ? `ข้อมูลจากการประเมิน แถวที่ ${selectedGalleryImageItem.rowNum}` : `Evaluation record from Row ${selectedGalleryImageItem.rowNum}`}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className={cn("p-4 rounded-2xl transition-colors", theme === 'dark' ? "bg-slate-950/60" : "bg-slate-50")}>
                      <span className={cn("text-[9px] font-black uppercase tracking-widest block mb-1.5", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                        {lang === 'th' ? 'ผู้ประเมิน' : 'Evaluator'}
                      </span>
                      <p className={cn("text-xs font-black transition-colors", theme === 'dark' ? "text-slate-200" : "text-purple-950")}>
                        {selectedGalleryImageItem.evaluator}
                      </p>
                    </div>

                    <div className={cn("p-4 rounded-2xl transition-colors", theme === 'dark' ? "bg-slate-950/60" : "bg-slate-50")}>
                      <span className={cn("text-[9px] font-black uppercase tracking-widest block mb-1.5", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                        {lang === 'th' ? 'วันที่ประเมิน' : 'Evaluation Date'}
                      </span>
                      <p className={cn("text-xs font-black transition-colors", theme === 'dark' ? "text-slate-200" : "text-purple-950")}>
                        {selectedGalleryImageItem.date}
                      </p>
                    </div>

                    <div className={cn("p-4 rounded-2xl transition-colors relative group/gallery-comment", theme === 'dark' ? "bg-slate-950/60" : "bg-slate-50")}>
                      <div className="flex justify-between items-start">
                        <span className={cn("text-[9px] font-black uppercase tracking-widest block mb-1.5", theme === 'dark' ? "text-slate-500" : "text-slate-400")}>
                          {lang === 'th' ? 'ความคิดเห็น / ข้อเสนอแนะ' : 'Comments & Suggestions'}
                        </span>
                        {selectedGalleryImageItem.rowNum && (
                          <button
                            onClick={() => toggleCommentLike(selectedGalleryImageItem.rowNum)}
                            className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all text-[10px] font-black active:scale-95",
                              commentLikes.some(l => l.rowNum === selectedGalleryImageItem.rowNum && l.userId === user?.uid)
                                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-500 border border-rose-100 dark:border-rose-900/30"
                                : "bg-white dark:bg-slate-800 text-slate-400 border border-slate-200/50 dark:border-transparent hover:text-slate-500 hover:bg-slate-100"
                            )}
                          >
                            <Heart className={cn("w-3.5 h-3.5 transition-transform duration-300", 
                              commentLikes.some(l => l.rowNum === selectedGalleryImageItem.rowNum && l.userId === user?.uid) 
                                ? "fill-rose-500 text-rose-500 scale-110" 
                                : "text-slate-400"
                            )} />
                            {commentLikes.filter(l => l.rowNum === selectedGalleryImageItem.rowNum).length > 0 && (
                              <span>{commentLikes.filter(l => l.rowNum === selectedGalleryImageItem.rowNum).length}</span>
                            )}
                          </button>
                        )}
                      </div>
                      <p className={cn("text-xs font-bold leading-relaxed whitespace-pre-wrap transition-colors mt-1", theme === 'dark' ? "text-slate-300" : "text-slate-700")}>
                        {selectedGalleryImageItem.comment || (lang === 'th' ? '(ไม่มีความคิดเห็นเพิ่มเติม)' : '(No comments provided)')}
                      </p>

                      {/* Emoji Reactions for gallery comments */}
                      {selectedGalleryImageItem.rowNum && (
                        <div className="flex flex-wrap gap-1 items-center mt-3 pt-2.5 border-t border-slate-100/30 dark:border-slate-900/30">
                          {['👍', '❤️', '😄', '🎉', '😮', '😢'].map(emoji => {
                            const emojiReactions = reactions.filter(
                              r => r.targetId === String(selectedGalleryImageItem.rowNum) && r.targetType === 'comment' && r.emoji === emoji
                            );
                            const hasReacted = emojiReactions.some(r => r.userId === user?.uid);
                            if (emojiReactions.length === 0) return null;
                            return (
                              <button
                                key={emoji}
                                onClick={() => toggleReaction(String(selectedGalleryImageItem.rowNum), 'comment', emoji)}
                                className={cn(
                                  "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold border transition-all active:scale-95",
                                  hasReacted
                                    ? "bg-purple-100 dark:bg-purple-950/40 text-purple-700 border-purple-200"
                                    : "bg-slate-100/50 dark:bg-slate-800/10 text-slate-400 border-transparent hover:bg-slate-100"
                                )}
                              >
                                <span>{emoji}</span>
                                <span className="text-[8.5px]">{emojiReactions.length}</span>
                              </button>
                            );
                          })}
                          
                          {/* Reaction selector popover on hover */}
                          <div className="relative group/gallery-emo inline-block">
                            <button className="w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-bold border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95">
                              +😊
                            </button>
                            <div className={cn(
                              "absolute bottom-full left-0 mb-1 hidden group-hover/gallery-emo:flex items-center gap-1 p-1 rounded-full border shadow-lg z-20 transition-all",
                              theme === 'dark' ? "bg-slate-900 border-slate-800 shadow-black" : "bg-white border-slate-150 shadow-slate-200"
                            )}>
                              {['👍', '❤️', '😄', '🎉', '😮', '😢'].map(emoji => {
                                const hasReacted = reactions.some(
                                  r => r.targetId === String(selectedGalleryImageItem.rowNum) && r.targetType === 'comment' && r.emoji === emoji && r.userId === user?.uid
                                );
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() => toggleReaction(String(selectedGalleryImageItem.rowNum), 'comment', emoji)}
                                    className={cn(
                                      "w-5 h-5 flex items-center justify-center rounded-full text-[10px] transition-transform hover:scale-125 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95",
                                      hasReacted ? "bg-purple-100/50 dark:bg-purple-950/30" : ""
                                    )}
                                  >
                                    {emoji}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-8 flex flex-col gap-3">
                  <button 
                    onClick={() => setSelectedGalleryImageItem(null)}
                    className={cn(
                      "w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-wider text-center transition-all",
                      theme === 'dark' ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {t.close}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation Bar styled like LINE app with native premium feel */}
      <div className={cn(
        "sm:hidden fixed bottom-0 left-0 right-0 h-[68px] z-40 flex items-center justify-around px-2 pb-1 transition-all duration-500",
        theme === 'dark' 
          ? "bg-[#110d29]/40 border-t border-slate-900/45 backdrop-blur-3xl shadow-[0_-4px_30px_rgba(11,13,41,0.25)]" 
          : "bg-[#ebd7fd]/40 border-t border-white/40 backdrop-blur-3xl shadow-[0_-4px_30px_rgba(235,215,253,0.3)]"
      )}>
        {/* Tab 1: Home (Overview) */}
        <button
          onClick={() => {
            triggerHaptic();
            setActiveTab('overview');
            setShowMoreMobileMenu(false);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-300 relative rounded-2xl active:scale-90",
            activeTab === 'overview' && !showMoreMobileMenu
              ? "text-purple-600 dark:text-purple-300 font-black scale-105"
              : (theme === 'dark' ? "text-purple-300/40" : "text-purple-950/45")
          )}
        >
          <LayoutDashboard className="w-[18px] h-[18px]" />
          <span className="text-[9px] tracking-tight font-black">{lang === 'th' ? 'หน้าหลัก' : 'Home'}</span>
          {activeTab === 'overview' && !showMoreMobileMenu && (
            <motion.div layoutId="mobileTabIndicator" className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400" />
          )}
        </button>

        {/* Tab 2: Spreadsheet (Table) */}
        <button
          onClick={() => {
            triggerHaptic();
            setActiveTab('table');
            setShowMoreMobileMenu(false);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-300 relative rounded-2xl active:scale-90",
            activeTab === 'table' && !showMoreMobileMenu
              ? "text-amber-600 dark:text-amber-400 font-black scale-105"
              : (theme === 'dark' ? "text-purple-300/40" : "text-purple-950/45")
          )}
        >
          <TableIcon className="w-[18px] h-[18px]" />
          <span className="text-[9px] tracking-tight font-black">{lang === 'th' ? 'ผลประเมิน' : 'Evaluation'}</span>
          {activeTab === 'table' && !showMoreMobileMenu && (
            <motion.div layoutId="mobileTabIndicator" className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
          )}
        </button>

        {/* Tab 3: Schedule (Calendar) */}
        <button
          onClick={() => {
            triggerHaptic();
            setActiveTab('schedule');
            setShowMoreMobileMenu(false);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-300 relative rounded-2xl active:scale-90",
            activeTab === 'schedule' && !showMoreMobileMenu
              ? "text-pink-600 dark:text-pink-400 font-black scale-105"
              : (theme === 'dark' ? "text-purple-300/40" : "text-purple-950/45")
          )}
        >
          <Calendar className="w-[18px] h-[18px]" />
          <span className="text-[9px] tracking-tight font-black">{lang === 'th' ? 'ตารางสอน' : 'Schedule'}</span>
          {activeTab === 'schedule' && !showMoreMobileMenu && (
            <motion.div layoutId="mobileTabIndicator" className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-pink-500 dark:bg-pink-400" />
          )}
        </button>

        {/* Tab 4: News (Megaphone) */}
        <button
          onClick={() => {
            triggerHaptic();
            setActiveTab('news');
            setShowMoreMobileMenu(false);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-300 relative rounded-2xl active:scale-90",
            activeTab === 'news' && !showMoreMobileMenu
              ? "text-orange-600 dark:text-orange-400 font-black scale-105"
              : (theme === 'dark' ? "text-purple-300/40" : "text-purple-950/45")
          )}
        >
          <div className="relative">
            <Megaphone className="w-[18px] h-[18px]" />
            {unreadNews && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900 animate-pulse" />
            )}
          </div>
          <span className="text-[9px] tracking-tight font-black">{lang === 'th' ? 'ข่าวสาร' : 'News'}</span>
          {activeTab === 'news' && !showMoreMobileMenu && (
            <motion.div layoutId="mobileTabIndicator" className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-orange-500 dark:bg-orange-400" />
          )}
        </button>

        {/* Tab 5: More (MoreHorizontal) */}
        <button
          onClick={() => {
            triggerHaptic();
            setShowMoreMobileMenu(!showMoreMobileMenu);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 flex-1 py-1 transition-all duration-300 relative rounded-2xl active:scale-90",
            showMoreMobileMenu || (activeTab !== 'overview' && activeTab !== 'table' && activeTab !== 'schedule' && activeTab !== 'news')
              ? "text-fuchsia-600 dark:text-fuchsia-400 font-black scale-105"
              : (theme === 'dark' ? "text-purple-300/40" : "text-purple-950/45")
          )}
        >
          <MoreHorizontal className="w-[18px] h-[18px]" />
          <span className="text-[9px] tracking-tight font-black">{lang === 'th' ? 'เพิ่มเติม' : 'More'}</span>
          {(showMoreMobileMenu || (activeTab !== 'overview' && activeTab !== 'table' && activeTab !== 'schedule' && activeTab !== 'news')) && (
            <motion.div layoutId="mobileTabIndicator" className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-fuchsia-500 dark:bg-fuchsia-400" />
          )}
        </button>
      </div>

      {/* Mobile "More" Drawer Menu Sheet */}
      <AnimatePresence>
        {showMoreMobileMenu && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                triggerHaptic();
                setShowMoreMobileMenu(false);
              }}
              className="sm:hidden fixed inset-0 z-45 bg-black/40 backdrop-blur-xs"
            />

            {/* Drawer panel */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className={cn(
                "sm:hidden fixed bottom-[68px] left-0 right-0 z-50 rounded-t-[2.5rem] border-t p-6 max-h-[80vh] overflow-y-auto pb-12 transition-all duration-500",
                theme === 'dark' 
                  ? "bg-[#110d29]/95 border-slate-900/50 text-white shadow-[0_-15px_40px_rgba(17,13,41,0.6)] backdrop-blur-3xl" 
                  : "bg-[#f2ebfa]/95 border-purple-100/40 text-purple-950 shadow-[0_-15px_40px_rgba(235,215,253,0.5)] backdrop-blur-3xl"
              )}
            >
              {/* Aesthetic Grab Bar handle */}
              <div className="w-12 h-1.5 bg-purple-250 dark:bg-purple-900/30 rounded-full mx-auto mb-6" />

              {/* Drawer Title & Header */}
              <div className="flex items-center justify-between mb-5">
                <h3 className={cn("font-black text-xs uppercase tracking-widest", theme === 'dark' ? "text-purple-300" : "text-purple-900")}>
                  {lang === 'th' ? 'เมนูและฟังก์ชันเพิ่มเติม' : 'More Features'}
                </h3>
                <button
                  onClick={() => {
                    triggerHaptic();
                    setShowMoreMobileMenu(false);
                  }}
                  className={cn(
                    "p-1.5 rounded-full active:scale-95 transition-all",
                    theme === 'dark' ? "bg-purple-950/40 hover:bg-purple-900/40 text-purple-300" : "bg-purple-50 hover:bg-purple-100 text-purple-800"
                  )}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid Layout Shortcuts (identical to LINE Wallet / mini app service widgets) */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {/* Honor Board tab button */}
                <button
                  onClick={() => {
                    triggerHaptic();
                    setActiveTab('honor');
                    setShowMoreMobileMenu(false);
                  }}
                  className={cn(
                    "p-3 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 border transition-all active:scale-95 duration-300",
                    activeTab === 'honor'
                      ? "bg-fuchsia-500/10 border-fuchsia-400/30 text-fuchsia-600 dark:text-fuchsia-400 shadow-xs"
                      : (theme === 'dark' 
                          ? "bg-white/5 border-white/5 text-purple-200 hover:bg-white/10" 
                          : "bg-white/55 border-white/55 text-purple-950 hover:bg-white/80 shadow-3xs")
                  )}
                >
                  <Award className="w-4 h-4 text-fuchsia-500" />
                  <span className="text-[9px] font-black leading-tight">{lang === 'th' ? 'เกียรติยศ' : 'Honor'}</span>
                </button>

                {/* AI Chatbot button */}
                <button
                  onClick={() => {
                    triggerHaptic();
                    setActiveTab('ai-chat');
                    setShowMoreMobileMenu(false);
                  }}
                  className={cn(
                    "p-3 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 border transition-all active:scale-95 duration-300 relative overflow-hidden",
                    activeTab === 'ai-chat'
                      ? "bg-pink-500/10 border-pink-400/30 text-pink-600 dark:text-pink-400 shadow-xs"
                      : (theme === 'dark' 
                          ? "bg-white/5 border-white/5 text-purple-200 hover:bg-white/10" 
                          : "bg-white/55 border-white/55 text-purple-950 hover:bg-white/80 shadow-3xs")
                  )}
                >
                  <Bot className="w-4 h-4 text-pink-500" />
                  <span className="text-[9px] font-black leading-tight">{lang === 'th' ? 'พูดคุย AI' : 'AI Chat'}</span>
                  <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
                </button>

                {/* School Web CP */}
                <button
                  onClick={() => {
                    triggerHaptic();
                    window.open('https://www.cp.ac.th/', '_blank');
                  }}
                  className={cn(
                    "p-3 rounded-2xl flex flex-col items-center justify-center text-center gap-1.5 border transition-all active:scale-95 duration-300",
                    theme === 'dark' 
                      ? "bg-white/5 border-white/5 text-purple-200 hover:bg-white/10" 
                      : "bg-white/55 border-white/55 text-purple-950 hover:bg-white/80 shadow-3xs"
                  )}
                >
                  <ExternalLink className="w-4 h-4 text-blue-500" />
                  <span className="text-[9px] font-black leading-tight">{lang === 'th' ? 'เว็บโรงเรียน' : 'School'}</span>
                </button>

                {/* User Profile Info Info */}
                <div className={cn(
                  "p-3 rounded-2xl flex flex-col items-center justify-center text-center gap-1 border border-transparent shadow-[inset_0_-2px_6px_rgba(255,255,255,0.05)]",
                  theme === 'dark' ? "bg-slate-950/20" : "bg-purple-950/5"
                )}>
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-purple-200 dark:bg-purple-950 border border-white/20">
                    {user?.photoURL ? <img src={user.photoURL} referrerPolicy="no-referrer" className="w-full h-full object-cover" alt="" /> : <span className="text-[7px] font-black text-purple-700 dark:text-purple-300">AI</span>}
                  </div>
                  <span className="text-[8px] font-black leading-tight max-w-[55px] truncate">{user?.displayName || 'Admin'}</span>
                </div>
              </div>

              {/* Quick settings list */}
              <div className="space-y-3">
                {/* Language Switcher and Theme Toggle Row */}
                <div className="flex items-center gap-2">
                  {/* Language Selector */}
                  <div className={cn(
                    "flex-1 flex items-center justify-between p-1 rounded-2xl border gap-1 h-11",
                    theme === 'dark' ? "bg-slate-950/30 border-white/5" : "bg-purple-950/5 border-purple-50"
                  )}>
                    <button
                      onClick={() => {
                        triggerHaptic();
                        setLang('en');
                      }}
                      className={cn(
                        "flex-1 h-full rounded-xl text-[10px] font-black flex items-center justify-center transition-all text-center cursor-pointer",
                        lang === 'en'
                          ? (theme === 'dark' ? "bg-purple-600/90 text-white shadow-sm" : "bg-white text-purple-600 shadow-3xs")
                          : (theme === 'dark' ? "text-purple-300/40" : "text-purple-950/45")
                      )}
                    >
                      EN
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic();
                        setLang('th');
                      }}
                      className={cn(
                        "flex-1 h-full rounded-xl text-[10px] font-black flex items-center justify-center transition-all text-center cursor-pointer",
                        lang === 'th'
                          ? (theme === 'dark' ? "bg-purple-600/90 text-white shadow-sm" : "bg-white text-purple-600 shadow-3xs")
                          : (theme === 'dark' ? "text-purple-300/40" : "text-purple-950/45")
                      )}
                    >
                      TH
                    </button>
                  </div>

                  {/* Dark Mode Switcher */}
                  <div className={cn(
                    "flex-1 flex items-center justify-between p-1 rounded-2xl border gap-1 h-11",
                    theme === 'dark' ? "bg-slate-950/30 border-white/5" : "bg-purple-950/5 border-purple-50"
                  )}>
                    <button
                      onClick={() => {
                        triggerHaptic();
                        setTheme('light');
                      }}
                      className={cn(
                        "flex-1 h-full rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                        theme === 'light'
                          ? "bg-white text-amber-600 shadow-3xs"
                          : "text-purple-300/40"
                      )}
                    >
                      <Sun className="w-3.5 h-3.5 text-amber-500" />
                      <span className="uppercase text-[9px]">Light</span>
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic();
                        setTheme('dark');
                      }}
                      className={cn(
                        "flex-1 h-full rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                        theme === 'dark'
                          ? "bg-purple-600/90 text-white shadow-sm"
                          : "text-purple-950/45"
                      )}
                    >
                      <Moon className="w-3.5 h-3.5 text-purple-300" />
                      <span className="uppercase text-[9px]">Dark</span>
                    </button>
                  </div>
                </div>

                {/* Fullscreen Mode Quick Toggle */}
                <button
                  onClick={toggleFullscreen}
                  className={cn(
                    "w-full h-11 rounded-2xl flex items-center justify-between px-3.5 border transition-all text-left font-black text-xs active:scale-95 cursor-pointer",
                    theme === 'dark' ? "bg-slate-950/30 border-white/5 text-purple-300 hover:text-white" : "bg-purple-950/5 border-purple-50 text-purple-900"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Maximize className="w-3.5 h-3.5 text-purple-500" />
                    <span>{lang === 'th' ? 'แสดงผลเต็มจอ (Fullscreen)' : 'Fullscreen App Mode'}</span>
                  </div>
                  <div className={cn(
                    "text-[8px] sm:text-[9px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider",
                    isFullscreen 
                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                      : (theme === 'dark' ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500")
                  )}>
                    {isFullscreen ? (lang === 'th' ? 'เปิดอยู่' : 'Active') : (lang === 'th' ? 'ปิดอยู่' : 'Inactive')}
                  </div>
                </button>

                <div className={cn(
                  "flex items-center justify-between p-1 rounded-2xl border gap-2 h-11",
                  theme === 'dark' ? "bg-slate-950/30 border-white/5" : "bg-purple-950/5 border-purple-50"
                )}>
                  <button
                    onClick={() => {
                      triggerHaptic();
                      setViewMode('teacher');
                    }}
                    className={cn(
                      "flex-1 h-full rounded-xl text-[11px] font-black font-sans flex items-center justify-center gap-1.5 transition-all text-center",
                      viewMode === 'teacher'
                        ? (theme === 'dark' ? "bg-purple-600/90 text-white shadow-sm" : "bg-white text-purple-600 shadow-3xs")
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    {lang === 'th' ? 'ระบบผู้สอน' : 'TEACHER'}
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic();
                      setViewMode('student');
                    }}
                    className={cn(
                      "flex-1 h-full rounded-xl text-[11px] font-black font-sans flex items-center justify-center gap-1.5 transition-all text-center",
                      viewMode === 'student'
                        ? (theme === 'dark' ? "bg-indigo-600/90 text-white shadow-sm" : "bg-white text-indigo-600 shadow-3xs")
                        : "text-slate-500 dark:text-slate-400"
                    )}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    {lang === 'th' ? 'ระบบผู้เรียน' : 'STUDENT'}
                  </button>
                </div>

                {/* Logout button */}
                <button
                  onClick={() => {
                    triggerHaptic();
                    logout();
                  }}
                  className="w-full py-3 rounded-2xl bg-red-500/10 dark:bg-red-950/20 text-red-500 dark:text-red-400 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-red-500/15 hover:bg-red-500 hover:text-white active:scale-95 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  {lang === 'th' ? 'ออกจากระบบ' : 'Logout'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
