import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { SpreadsheetData } from '../services/sheetsService';
import { Language } from '../constants/translations';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, orderBy, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { 
  Calendar, 
  User, 
  BookOpen, 
  Search, 
  Layers, 
  MapPin, 
  Clock, 
  Grid3X3, 
  List, 
  Download, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Printer,
  ArrowLeftRight,
  Trash2,
  Image,
  FileText,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ScheduleViewerProps {
  scheduleData: SpreadsheetData | null;
  loading: boolean;
  onRefresh: () => void;
  lang: Language;
  theme: 'light' | 'dark';
}

interface ScheduleItem {
  day: string;       // Day e.g., 'Monday', 'วันจันทร์', 'จันทร์'
  period: string;    // Period number or time e.g., '1', '2'
  timeRange: string; // Time range e.g., '08:30 - 09:20'
  subject: string;   // Subject name
  subjectCode: string; // Subject Code e.g. 'อ21201' or 'ENG101'
  teacher: string;   // Teacher name instead of code
  room: string;      // Room/Location e.g., '421' or 'ม.1/1'
  classLevel: string; // Grade/Class level e.g., 'M.1/1'
  rawRow: string[];  // Raw data row for reference
}

// Resolver to clean teacher codes/IDs/initials to the actual Teacher's name
const resolveTeacherName = (val: string): string => {
  if (!val) return 'Unassigned';
  const clean = val.trim().toLowerCase().replace(/^t\.\s*/, '').replace(/^teacher\s+/, '');
  
  if (clean.includes('พลวัฒน์')) {
    return 'นายพลวัฒน์ สุขคลี่';
  }

  if (clean.includes('กิจปกรณ์') || clean.includes('กจิปกรณ์') || clean.includes('0802')) {
    return 'นายกิจปกรณ์ พูนศิริ';
  }

  if (clean.includes('จุฑารัตน์') || clean.includes('จฑารัตน์') || clean.includes('0803')) {
    return 'นางสาวจุฑารัตน์ เกษนอก';
  }

  if (clean.includes('พรทิวา') || clean.includes('0804')) {
    return 'นางสาวพรทิวา ร่มรื่น';
  }

  if (clean.includes('สิริยา') || clean.includes('0805')) {
    return 'นางสาวสิริยา ขาวศรี';
  }

  if (clean.includes('วรารัตน์') || clean.includes('0806')) {
    return 'นางวรารัตน์ จรทะผา';
  }

  if (clean.includes('พีรวุฒิ') || clean.includes('0807')) {
    return 'นายพีรวุฒิ ขอบแก้ว';
  }

  if (clean.includes('พีรญา') || clean.includes('0808')) {
    return 'นางสาวพีรญา แคนติ';
  }

  if (clean.includes('ปวีณา') || clean.includes('0809')) {
    return 'นางสาวปวีณา คอนนอก';
  }

  if (clean.includes('รุ่งทิวา') || clean.includes('0810')) {
    return 'นางสาวรุ่งทิวา จินดารัศมี';
  }

  if (clean.includes('ประภาณัท') || clean.includes('ประภาณท') || clean.includes('0811')) {
    return 'นางสาวประภาณัท อาณารัตน์';
  }

  if (clean.includes('ณัชญญา') || clean.includes('ณัชชญา') || clean.includes('กันหา') || clean.includes('0812')) {
    return 'นางสาวณัชญญา กันหา';
  }

  if (clean.includes('christopher') || clean.includes('tanwie') || clean.includes('0813') || clean.includes('shu')) {
    return 'Mr.Christopher Shu Tanwie';
  }

  if (clean.includes('kenneth') || clean.includes('mwongera') || clean.includes('0814') || clean.includes('mbaabu')) {
    return 'Mr.Kenneth Mwongera Mbaabu';
  }

  if (clean.includes('judy') || clean.includes('wangui') || clean.includes('mwangi') || clean.includes('0815')) {
    return 'MissJudy Wangui Mwangi';
  }

  if (clean.includes('li') || clean.includes('xianling') || clean.includes('0816')) {
    return 'MissLi Xianling';
  }

  // Custom dictionary for known codes/abbreviations/initials to match teacher name instead of short code
  const directMap: Record<string, string> = {
    'john': 'Teacher John',
    'sarah': 'Teacher Sarah',
    'david': 'Teacher David',
    'mary': 'Teacher Mary',
    'jt': 'Teacher John',
    'sr': 'Teacher Sarah',
    'dv': 'Teacher David',
    'mr': 'Teacher Mary',
    'jhon': 'Teacher John',
    'sara': 'Teacher Sarah',
    'da': 'Teacher David',
    'my': 'Teacher Mary',
    't1': 'Teacher John',
    't01': 'Teacher John',
    't2': 'Teacher Sarah',
    't02': 'Teacher Sarah',
    't3': 'Teacher David',
    't03': 'Teacher David',
    't4': 'Teacher Mary',
    't04': 'Teacher Mary',
  };

  if (directMap[clean]) {
    return directMap[clean];
  }

  // Format beautifully with title casing
  return val.split(' ').map(word => {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).filter(Boolean).join(' ');
};

// Helper to shorten the teacher name correctly (extracts Name from Name-Surname and removes prefixes)
const getShortTeacherName = (fullName: string): string => {
  if (!fullName) return '';
  let clean = fullName.trim();
  
  // Strip English honorific titles (case-insensitive)
  clean = clean.replace(/^(Teacher|Miss|Mr|Mrs|Ms|Dr|Prof|Ajarn|T\.)\s+/i, '');
  
  // Strip Thai honorific titles
  clean = clean.replace(/^(นางสาว|นาย|นาง|ครู|อาจารย์|อ\.|ดร\.|ดร)\s*/, '');
  
  // Strip trailing parenthesized Thai names or any parenthesized text at the end (e.g., "(ครูจูดี้)")
  clean = clean.replace(/\s*\([^)]*\)\s*$/, '');
  
  // Extract first name (first word)
  const parts = clean.split(/\s+/);
  return parts[0] || '';
};

// Helper to clean teacher name by removing prefixes but keeping the full name (first name + optional surname) without truncation
const getCleanTeacherName = (fullName: string): string => {
  if (!fullName) return '';
  let clean = fullName.trim();
  
  // Strip English honorific titles (case-insensitive)
  clean = clean.replace(/^(Teacher|Miss|Mr|Mrs|Ms|Dr|Prof|Ajarn|T\.)\s+/i, '');
  
  // Strip Thai honorific titles
  clean = clean.replace(/^(นางสาว|นาย|นาง|ครู|อาจารย์|อ\.|ดร\.|ดร)\s*/, '');
  
  // Strip trailing parenthesized Thai names or any parenthesized text at the end (e.g., "(ครูจูดี้)")
  clean = clean.replace(/\s*\([^)]*\)\s*$/, '');
  
  return clean;
};

// Helper to extract only the subject code and remove the subject name or name-suffix
const getSubjectCodeOnly = (subject: string, subjectCode: string): string => {
  const code = (subjectCode || '').trim();
  const name = (subject || '').trim();
  const combined = `${code} ${name}`.trim();
  
  // 1. Handle specific activity codes / name normalizations to keep them clean
  if (combined.toLowerCase().includes('onet') || combined.includes('โอเน็ต')) {
    if (combined.includes('ม.3')) return 'เตรียมสอบ ONET ม.3';
    if (combined.includes('ม.6')) return 'เตรียมสอบ ONET ม.6';
    return 'เตรียมสอบ ONET';
  }

  if (combined.includes('โฮมรูม') && (combined.includes('สวดมนต์') || combined.includes('หน้าที่'))) {
    return 'โฮมรูม สวดมนต์ หน้าที่ฯ';
  }
  if (combined.includes('โฮมรูม')) {
    return 'โฮมรูม';
  }
  if (combined.includes('กิจกรรม') && (combined.includes('ชุมนุม') || combined.includes('กลุ่มสาระ'))) {
    return 'กิจกรรม ชุมนุม กลุ่มสาระ';
  }
  if (combined.includes('ลส.นน.') || combined.includes('ลูกเสือ') || combined.includes('ยุวกาชาด')) {
    return 'ลส.นน. บำเพ็ญฯ ยุวกาชาด';
  }
  if (combined.includes('ซ่อมเสริม') || combined.includes('สี') || combined.includes('PLC')) {
    if (combined.includes('ซ่อมเสริม คณะสี PLC')) return 'ซ่อมเสริม คณะสี PLC';
    if (combined.includes('PLC')) return 'PLC';
  }
  if (combined.includes('พัฒนาพื้นที่')) {
    return 'พัฒนาพื้นที่';
  }
  if (combined.toLowerCase().includes('english language club')) {
    return 'English Language Club';
  }
  if (combined.toLowerCase().includes('chinese language club')) {
    return 'Chinese Language Club';
  }

  // Broad regex to match typical codes: e.g. อ33245*, อ32101, EN31101, อ22205-1, อ22205/2, etc.
  // Must have some letters/Thai characters and at least 3 digits.
  // We use standard subject prefixes [ทควดสพศงอจเฝญกa-zA-Z] up to 3 chars to prevent including trailing letters of subject name
  const codeRegex = /[ทควดสพศงอจเฝญกa-zA-Z]{1,3}\s*[-\/]?\s*\d{2,6}(?:\s*[-\/]?\s*\d+)?\*?/;

  // Clean parentheses and split by space or special boundaries to find any token that looks exactly like a code
  const tokens = combined
    .replace(/[()\[\]{}]/g, ' ')
    .split(/[\s,]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0);

  // Try to find if any token matches our code regex perfectly or has both letters and digits
  for (const token of tokens) {
    const match = token.match(codeRegex);
    if (match) {
      // Return the matched code, stripped of inner spaces
      return match[0].replace(/\s+/g, '').trim();
    }
  }

  // Fallback 1: If we have an explicit subjectCode field, and it is short (<= 12 chars), trust it
  if (code && code.length <= 12) {
    return code;
  }

  // Fallback 2: Try standard regex match directly on fields
  if (code) {
    const match = code.match(codeRegex);
    if (match) return match[0].replace(/\s+/g, '').trim();
  }
  if (name) {
    const match = name.match(codeRegex);
    if (match) return match[0].replace(/\s+/g, '').trim();
  }

  // Fallback 3: Return cleaned first token, or clean name
  let cleanName = name.replace(/\([^)]+\)/g, '').replace(/\[[^\]]+\]/g, '').trim();
  const nameParts = cleanName.split(/\s+/);
  if (nameParts.length > 0) {
    const firstWord = nameParts[0];
    if (firstWord.length <= 10) {
      return firstWord;
    }
  }

  return cleanName || code || 'No Code';
};

const formatDay = (day: string, langSetting: Language): string => {
  if (langSetting === 'th') return day;
  const dLower = day.toLowerCase();
  if (dLower.includes('จันทร์') || dLower.includes('mon')) return 'Monday';
  if (dLower.includes('อังคาร') || dLower.includes('tue')) return 'Tuesday';
  if (dLower.includes('พุธ') || dLower.includes('wed')) return 'Wednesday';
  if (dLower.includes('พฤหัส') || dLower.includes('thu')) return 'Thursday';
  if (dLower.includes('ศุกร์') || dLower.includes('fri')) return 'Friday';
  if (dLower.includes('เสาร์') || dLower.includes('sat')) return 'Saturday';
  if (dLower.includes('อาทิตย์') || dLower.includes('sun')) return 'Sunday';
  return day;
};

function replaceOklchInCss(cssText: string): string {
  return cssText.replace(/oklch\(([^)]+)\)/g, (match, content) => {
    try {
      const parts = content.trim().split(/[\s,+/]+/);
      if (parts.length < 3) return match;

      // 1. Lightness (0 to 1 or 0% to 100%)
      const lStr = parts[0];
      const l = lStr.endsWith('%') ? parseFloat(lStr) / 100 : parseFloat(lStr);

      // 2. Chroma (0 to 0.4 or percentage)
      const cStr = parts[1];
      const c = cStr.endsWith('%') ? (parseFloat(cStr) / 100) * 0.4 : parseFloat(cStr);

      // 3. Hue (0 to 360)
      const hStr = parts[2];
      let h = 0;
      if (hStr !== 'none') {
        if (hStr.endsWith('deg')) {
          h = parseFloat(hStr);
        } else if (hStr.endsWith('rad')) {
          h = parseFloat(hStr) * (180 / Math.PI);
        } else if (hStr.endsWith('turn')) {
          h = parseFloat(hStr) * 360;
        } else {
          h = parseFloat(hStr);
        }
      }

      // 4. Alpha
      let a = 1;
      if (parts.length >= 4) {
        const aStr = parts[3];
        a = aStr.endsWith('%') ? parseFloat(aStr) / 100 : parseFloat(aStr);
      }

      if (isNaN(l) || isNaN(c) || isNaN(h)) return match;

      // Convert oklch to rgb
      const hRad = (h * Math.PI) / 180;
      const oklab_a = c * Math.cos(hRad);
      const oklab_b = c * Math.sin(hRad);

      const l_ = l + 0.3963377774 * oklab_a + 0.2158037573 * oklab_b;
      const m_ = l - 0.1055613458 * oklab_a - 0.0638541167 * oklab_b;
      const s_ = l - 0.0894841775 * oklab_a - 1.2914855480 * oklab_b;

      const l_3 = l_ * l_ * l_;
      const m_3 = m_ * m_ * m_;
      const s_3 = s_ * s_ * s_;

      const rLin = +4.0767416621 * l_3 - 3.3077115913 * m_3 + 0.2309699292 * s_3;
      const gLin = -1.2684380046 * l_3 + 2.6097574011 * m_3 - 0.3413193965 * s_3;
      const bLin = -0.0041960863 * l_3 - 0.7034186147 * m_3 + 1.7076147010 * s_3;

      const toSRGB = (x: number) => {
        const clamped = Math.max(0, Math.min(1, x));
        return clamped > 0.0031308
          ? 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055
          : 12.92 * clamped;
      };

      const r = Math.round(toSRGB(rLin) * 255);
      const g = Math.round(toSRGB(gLin) * 255);
      const b = Math.round(toSRGB(bLin) * 255);

      return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
    } catch (err) {
      console.warn('Failed to parse oklch color:', match, err);
      return match;
    }
  });
}

const getCombinedCss = (): string => {
  let cssText = '';
  try {
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          for (let j = 0; j < rules.length; j++) {
            cssText += rules[j].cssText + '\n';
          }
        }
      } catch (e) {
        const owner = sheet.ownerNode;
        if (owner && (owner.nodeName === 'STYLE' || owner.nodeName === 'style')) {
          cssText += (owner.textContent || '') + '\n';
        }
      }
    }
  } catch (e) {
    console.error('Error reading stylesheets:', e);
  }

  if (!cssText.trim()) {
    const styles = document.querySelectorAll('style');
    styles.forEach(style => {
      cssText += (style.textContent || '') + '\n';
    });
  }

  return cssText;
};

export default function ScheduleViewer({
  scheduleData,
  loading,
  onRefresh,
  lang,
  theme
}: ScheduleViewerProps) {
  const [activeViewMode, setActiveViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'schedule' | 'vacancies' | 'overlay'>('schedule');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState<string>('All');
  const [selectedTeacher, setSelectedTeacher] = useState<string>('All');
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [selectedRoom, setSelectedRoom] = useState<string>('All');

  // Schedule Overlay & Swap Simulator states
  const [teacherA, setTeacherA] = useState<string>('');
  const [teacherB, setTeacherB] = useState<string>('');
  const [appliedSwaps, setAppliedSwaps] = useState<{
    id: string;
    swapType: 'teacher' | 'time';
    day1: string;
    period1: string;
    item1: ScheduleItem | null;
    day2: string;
    period2: string;
    item2: ScheduleItem | null;
    tA: string;
    tB: string;
  }[]>([]);

  const [isExportingImg, setIsExportingImg] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState<boolean>(false);
  const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setScreenWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isTabletOrMobile = screenWidth < 1024;

  const exportAsImage = async () => {
    const target = document.getElementById('timetable-capture-area');
    if (!target) return;
    setIsExportingImg(true);
    
    // Save original styles
    const originalStyle = target.style.cssText;
    
    // Temporarily force full size with no overflow, custom background so text is perfectly visible
    target.style.width = '1200px';
    target.style.maxWidth = 'none';
    target.style.overflow = 'visible';
    
    if (theme === 'dark') {
      target.style.backgroundColor = '#0b0f19';
      target.style.padding = '24px';
      target.style.borderRadius = '24px';
    } else {
      target.style.backgroundColor = '#ffffff';
      target.style.padding = '24px';
      target.style.borderRadius = '24px';
    }

    // Temporarily disable overflow scroll on child containers inside timetable-capture-area
    // to prevent clipped images of tables
    const scrollContainers = target.querySelectorAll('.overflow-x-auto, .overflow-auto, [class*="overflow-"]');
    const originalScrollStyles: { element: HTMLElement; cssText: string }[] = [];
    scrollContainers.forEach((el) => {
      if (el instanceof HTMLElement) {
        originalScrollStyles.push({ element: el, cssText: el.style.cssText });
        el.style.overflow = 'visible';
        el.style.overflowX = 'visible';
        el.style.width = 'auto';
        el.style.maxWidth = 'none';
      }
    });

    try {
      const safeCss = replaceOklchInCss(getCombinedCss());
      const canvas = await html2canvas(target, {
        useCORS: true,
        scale: 2,
        backgroundColor: theme === 'dark' ? '#0b0f19' : '#ffffff',
        width: 1200,
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          // Remove all existing styles/links to avoid html2canvas parsing oklch
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach(el => el.remove());
          
          const links = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
          links.forEach(el => el.remove());

          // Insert our oklch-free fallback CSS
          const styleEl = clonedDoc.createElement('style');
          styleEl.textContent = safeCss;
          clonedDoc.head.appendChild(styleEl);

          // Replace inline style oklch as well
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach(el => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style && htmlEl.style.cssText) {
              htmlEl.style.cssText = replaceOklchInCss(htmlEl.style.cssText);
            }
          });
        }
      });
      
      // Convert to Blob instead of Data URL for extreme compatibility across Safari & mobile
      canvas.toBlob((blob) => {
        if (!blob) return;
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `schedule-${new Date().toISOString().substring(0, 10)}.png`;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      }, 'image/png');
    } catch (e) {
      console.error('Error exporting image:', e);
    } finally {
      // Restore original scroll styles of nested containers
      originalScrollStyles.forEach(({ element, cssText }) => {
        element.style.cssText = cssText;
      });
      // Restore original styles of main target
      target.style.cssText = originalStyle;
      setIsExportingImg(false);
    }
  };

  const exportAsPDF = async () => {
    const target = document.getElementById('timetable-capture-area');
    if (!target) return;
    setIsExportingPdf(true);

    // Save original styles
    const originalStyle = target.style.cssText;
    
    // Format elegantly for PDF landscape export
    target.style.width = '1200px';
    target.style.maxWidth = 'none';
    target.style.overflow = 'visible';
    
    if (theme === 'dark') {
      target.style.backgroundColor = '#0b0f19';
      target.style.padding = '24px';
      target.style.borderRadius = '24px';
    } else {
      target.style.backgroundColor = '#ffffff';
      target.style.padding = '24px';
      target.style.borderRadius = '24px';
    }

    // Temporarily disable overflow scroll on child containers inside timetable-capture-area
    // to prevent clipped images of tables in the PDF
    const scrollContainers = target.querySelectorAll('.overflow-x-auto, .overflow-auto, [class*="overflow-"]');
    const originalScrollStyles: { element: HTMLElement; cssText: string }[] = [];
    scrollContainers.forEach((el) => {
      if (el instanceof HTMLElement) {
        originalScrollStyles.push({ element: el, cssText: el.style.cssText });
        el.style.overflow = 'visible';
        el.style.overflowX = 'visible';
        el.style.width = 'auto';
        el.style.maxWidth = 'none';
      }
    });

    try {
      const safeCss = replaceOklchInCss(getCombinedCss());
      const canvas = await html2canvas(target, {
        useCORS: true,
        scale: 2,
        backgroundColor: theme === 'dark' ? '#0b0f19' : '#ffffff',
        width: 1200,
        windowWidth: 1200,
        onclone: (clonedDoc) => {
          // Remove all existing styles/links to avoid html2canvas parsing oklch
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach(el => el.remove());
          
          const links = clonedDoc.querySelectorAll('link[rel="stylesheet"]');
          links.forEach(el => el.remove());

          // Insert our oklch-free fallback CSS
          const styleEl = clonedDoc.createElement('style');
          styleEl.textContent = safeCss;
          clonedDoc.head.appendChild(styleEl);

          // Replace inline style oklch as well
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach(el => {
            const htmlEl = el as HTMLElement;
            if (htmlEl.style && htmlEl.style.cssText) {
              htmlEl.style.cssText = replaceOklchInCss(htmlEl.style.cssText);
            }
          });
        }
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = 277; // Margins of 10mm on both sides (297 - 20 = 277)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      if (imgHeight > pdfHeight - 20) {
        const scaledHeight = pdfHeight - 20;
        const scaledWidth = (canvas.width * scaledHeight) / canvas.height;
        const startX = (pdfWidth - scaledWidth) / 2;
        pdf.addImage(imgData, 'PNG', startX, 10, scaledWidth, scaledHeight);
      } else {
        const startY = (pdfHeight - imgHeight) / 2;
        pdf.addImage(imgData, 'PNG', 10, startY, imgWidth, imgHeight);
      }

      // Convert to blob and download robustly with an appended anchor element
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `schedule-${new Date().toISOString().substring(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (e) {
      console.error('Error exporting PDF:', e);
    } finally {
      // Restore original scroll styles of nested containers
      originalScrollStyles.forEach(({ element, cssText }) => {
        element.style.cssText = cssText;
      });
      // Restore original styles of main target
      target.style.cssText = originalStyle;
      setIsExportingPdf(false);
    }
  };

  // Real-time Firestore sync of active schedule swaps
  useEffect(() => {
    const q = query(collection(db, 'schedule_swaps'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const swaps = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          swapType: data.swapType,
          day1: data.day1,
          period1: data.period1,
          item1: data.item1 || null,
          day2: data.day2,
          period2: data.period2,
          item2: data.item2 || null,
          tA: data.tA,
          tB: data.tB,
        };
      }) as any[];
      setAppliedSwaps(swaps);
    }, (error) => {
      console.error("Error reading schedule_swaps from Firestore:", error);
    });
    return () => unsubscribe();
  }, []);
  const [sandboxSwapType, setSandboxSwapType] = useState<'teacher' | 'time'>('teacher');
  const [selectedSwapDay1, setSelectedSwapDay1] = useState<string>('');
  const [selectedSwapPeriod1, setSelectedSwapPeriod1] = useState<string>('');
  const [selectedSwapDay2, setSelectedSwapDay2] = useState<string>('');
  const [selectedSwapPeriod2, setSelectedSwapPeriod2] = useState<string>('');

  // Real-time tracker for live ongoing class highlight
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 15000); // Check every 15 seconds to stay responsive
    return () => clearInterval(interval);
  }, []);

  // Helper helper to determine if a schedule item is currently active (today + current period time)
  const isItemCurrentlyOngoing = (itemDay: string, timeRangeStr: string) => {
    const baseDate = now;
    const todayDayOfWeek = baseDate.getDay(); 
    
    const dLower = (itemDay || '').toLowerCase();
    let itemDayOfWeek = -1;
    if (dLower.includes('จันทร์') || dLower.includes('mon')) itemDayOfWeek = 1;
    else if (dLower.includes('อังคาร') || dLower.includes('tue')) itemDayOfWeek = 2;
    else if (dLower.includes('พุธ') || dLower.includes('wed')) itemDayOfWeek = 3;
    else if (dLower.includes('พฤหัส') || dLower.includes('thu')) itemDayOfWeek = 4;
    else if (dLower.includes('ศุกร์') || dLower.includes('fri')) itemDayOfWeek = 5;
    else if (dLower.includes('เสาร์') || dLower.includes('sat')) itemDayOfWeek = 6;
    else if (dLower.includes('อาทิตย์') || dLower.includes('sun')) itemDayOfWeek = 0;
    
    // Only check times if it is today
    if (itemDayOfWeek !== todayDayOfWeek) {
      return false;
    }
    
    if (!timeRangeStr) return false;
    
    // Normalize string: "08.30-09.20" or "08:30 - 09:20" -> "08:30-09:20"
    const normalized = timeRangeStr.replace(/\./g, ':').replace(/\s+/g, '');
    const parts = normalized.split('-');
    if (parts.length !== 2) return false;
    
    const [startStr, endStr] = parts;
    const startParts = startStr.split(':');
    const endParts = endStr.split(':');
    if (startParts.length < 2 || endParts.length < 2) return false;
    
    const startHour = parseInt(startParts[0], 10);
    const startMin = parseInt(startParts[1], 10);
    const endHour = parseInt(endParts[0], 10);
    const endMin = parseInt(endParts[1], 10);
    
    if (isNaN(startHour) || isNaN(startMin) || isNaN(endHour) || isNaN(endMin)) return false;
    
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;
    const currentTotal = currentHour * 60 + currentMin;
    
    return currentTotal >= startTotal && currentTotal <= endTotal;
  };

  const getWorkStatus = (item: ScheduleItem) => {
    const isOngoing = isItemCurrentlyOngoing(item.day, item.timeRange);
    
    // Check if class is today or another day
    const baseDate = now;
    const todayDayOfWeek = baseDate.getDay(); 
    
    const dLower = (item.day || '').toLowerCase();
    let itemDayOfWeek = -1;
    if (dLower.includes('จันทร์') || dLower.includes('mon')) itemDayOfWeek = 1;
    else if (dLower.includes('อังคาร') || dLower.includes('tue')) itemDayOfWeek = 2;
    else if (dLower.includes('พุธ') || dLower.includes('wed')) itemDayOfWeek = 3;
    else if (dLower.includes('พฤหัส') || dLower.includes('thu')) itemDayOfWeek = 4;
    else if (dLower.includes('ศุกร์') || dLower.includes('fri')) itemDayOfWeek = 5;
    else if (dLower.includes('เสาร์') || dLower.includes('sat')) itemDayOfWeek = 6;
    else if (dLower.includes('อาทิตย์') || dLower.includes('sun')) itemDayOfWeek = 0;

    if (isOngoing) {
      return {
        text: lang === 'th' ? 'กำลังปฏิบัติการสอน' : 'Active Teaching',
        badgeClass: theme === 'dark'
          ? 'bg-emerald-950/40 text-emerald-450 border-emerald-900/50'
          : 'bg-emerald-50 text-emerald-700 border-emerald-100',
        ringClass: 'ring-emerald-500/15',
        bgClass: 'bg-emerald-500 text-white',
        bulletClass: 'bg-emerald-500 animate-pulse',
        icon: <Clock className="w-3.5 h-3.5 text-white animate-pulse" />
      };
    }

    if (itemDayOfWeek === -1) {
      return {
        text: lang === 'th' ? 'เตรียมการสอน' : 'Scheduled',
        badgeClass: theme === 'dark'
          ? 'bg-slate-900 border-slate-800 text-slate-400'
          : 'bg-slate-50 border-slate-200 text-slate-600',
        ringClass: 'ring-slate-300/10',
        bgClass: 'bg-slate-200 text-slate-500 dark:bg-slate-800',
        bulletClass: 'bg-slate-400',
        icon: <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
      };
    }

    // Solve time
    if (!item.timeRange) {
      return {
        text: lang === 'th' ? 'เตรียมการสอน' : 'Scheduled',
        badgeClass: theme === 'dark'
          ? 'bg-slate-900 border-slate-800 text-slate-400'
          : 'bg-slate-50 border-slate-200 text-slate-600',
        ringClass: 'ring-slate-300/10',
        bgClass: 'bg-slate-200 text-slate-500 dark:bg-slate-800',
        bulletClass: 'bg-slate-400',
        icon: <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
      };
    }

    const normalized = item.timeRange.replace(/\./g, ':').replace(/\s+/g, '');
    const parts = normalized.split('-');
    if (parts.length !== 2) {
      return {
        text: lang === 'th' ? 'เตรียมการสอน' : 'Scheduled',
        badgeClass: theme === 'dark'
          ? 'bg-slate-900 border-slate-800 text-slate-400'
          : 'bg-slate-50 border-slate-200 text-slate-600',
        ringClass: 'ring-slate-300/10',
        bgClass: 'bg-slate-200 text-slate-500 dark:bg-slate-800',
        bulletClass: 'bg-slate-400',
        icon: <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
      };
    }

    const [startStr, endStr] = parts;
    const endParts = endStr.split(':');
    if (endParts.length < 2) {
      return {
        text: lang === 'th' ? 'เตรียมการสอน' : 'Scheduled',
        badgeClass: theme === 'dark'
          ? 'bg-slate-900 border-slate-800 text-slate-400'
          : 'bg-slate-50 border-slate-200 text-slate-600',
        ringClass: 'ring-slate-300/10',
        bgClass: 'bg-slate-200 text-slate-500 dark:bg-slate-800',
        bulletClass: 'bg-slate-400',
        icon: <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
      };
    }

    const endHour = parseInt(endParts[0], 10);
    const endMin = parseInt(endParts[1], 10);
    if (isNaN(endHour) || isNaN(endMin)) {
      return {
        text: lang === 'th' ? 'เตรียมการสอน' : 'Scheduled',
        badgeClass: theme === 'dark'
          ? 'bg-slate-900 border-slate-800 text-slate-400'
          : 'bg-slate-5 border-slate-200 text-slate-600',
        ringClass: 'ring-slate-300/10',
        bgClass: 'bg-slate-200 text-slate-500 dark:bg-slate-800',
        bulletClass: 'bg-slate-400',
        icon: <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
      };
    }

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const endTotal = endHour * 60 + endMin;
    const currentTotal = currentHour * 60 + currentMin;

    if (itemDayOfWeek === todayDayOfWeek) {
      if (currentTotal > endTotal) {
        return {
          text: lang === 'th' ? 'ปฏิบัติหน้าที่สำเร็จ' : 'Duty Completed',
          badgeClass: theme === 'dark'
            ? 'bg-slate-950 text-slate-500 border-slate-800'
            : 'bg-slate-100 text-slate-500 border-slate-200',
          ringClass: 'ring-slate-200/15',
          bgClass: 'bg-slate-400 text-white',
          bulletClass: 'bg-slate-400',
          icon: <CheckCircle className="w-3.5 h-3.5 text-white" />
        };
      } else {
        return {
          text: lang === 'th' ? 'เตรียมการสอน' : 'Scheduled',
          badgeClass: theme === 'dark'
            ? 'bg-amber-950/20 text-amber-455 border-amber-900/30'
            : 'bg-amber-50 text-amber-700 border-amber-150',
          ringClass: 'ring-amber-500/15',
          bgClass: 'bg-amber-500 text-white',
          bulletClass: 'bg-amber-550',
          icon: <Clock className="w-3.5 h-3.5 text-white" />
        };
      }
    } else if (itemDayOfWeek < todayDayOfWeek) {
      return {
        text: lang === 'th' ? 'ปฏิบัติหน้าที่สำเร็จ' : 'Duty Completed',
        badgeClass: theme === 'dark'
          ? 'bg-slate-950 text-slate-500 border-slate-800'
          : 'bg-slate-100 text-slate-500 border-slate-200',
          ringClass: 'ring-slate-200/15',
          bgClass: 'bg-slate-400 text-white',
          bulletClass: 'bg-slate-400',
          icon: <CheckCircle className="w-3.5 h-3.5 text-white" />
      };
    } else {
      return {
        text: lang === 'th' ? 'เตรียมการสอน' : 'Scheduled',
        badgeClass: theme === 'dark'
          ? 'bg-indigo-950/20 text-indigo-400 border-indigo-900/30'
          : 'bg-indigo-50 text-indigo-700 border-indigo-150',
        ringClass: 'ring-indigo-500/15',
        bgClass: 'bg-indigo-500 text-white',
        bulletClass: 'bg-indigo-500',
        icon: <Calendar className="w-3.5 h-3.5 text-white" />
      };
    }
  };

  // Vacancy finder states
  const [vacancyDay, setVacancyDay] = useState<string>('');
  const [vacancyPeriod, setVacancyPeriod] = useState<string>('1');

  // Fallback demo data if Sheets fetch fails or is authorization restricted
  const demoScheduleItems: ScheduleItem[] = useMemo(() => [
    { day: 'วันจันทร์', period: '1', timeRange: '08:30 - 09:20', subject: 'English Communication', subjectCode: 'อ21201', teacher: 'Teacher John', room: 'EP Room 1', classLevel: 'ม.1/1', rawRow: [] },
    { day: 'วันจันทร์', period: '2', timeRange: '09:20 - 10:10', subject: 'English Reading', subjectCode: 'อ32202', teacher: 'Teacher Sarah', room: 'Lab 3', classLevel: 'ม.5/2', rawRow: [] },
    { day: 'วันจันทร์', period: '4', timeRange: '11:00 - 11:50', subject: 'Phonics & Speech', subjectCode: 'อ11101', teacher: 'Teacher David', room: 'Room 223', classLevel: 'ม.1/4', rawRow: [] },
    { day: 'วันจันทร์', period: '5', timeRange: '12:40 - 13:30', subject: 'English Conversation', subjectCode: 'อ22102', teacher: 'Teacher John', room: 'Room 421', classLevel: 'ม.2/1', rawRow: [] },
    { day: 'วันอังคาร', period: '2', timeRange: '09:20 - 10:10', subject: 'Fundamental English', subjectCode: 'อ22101', teacher: 'Teacher Sarah', room: 'EP Room 2', classLevel: 'ม.2/2', rawRow: [] },
    { day: 'วันอังคาร', period: '3', timeRange: '10:10 - 11:00', subject: 'English Writing', subjectCode: 'อ31201', teacher: 'Teacher David', room: 'Lab 1', classLevel: 'ม.4/1', rawRow: [] },
    { day: 'วันอังคาร', period: '6', timeRange: '13:30 - 14:20', subject: 'Phonics & Speech', subjectCode: 'อ11101', teacher: 'Teacher David', room: 'Room 224', classLevel: 'ม.1/5', rawRow: [] },
    { day: 'วันอังคาร', period: '7', timeRange: '14:20 - 15:10', subject: 'English Conversation', subjectCode: 'อ23102', teacher: 'Teacher John', room: 'Room 421', classLevel: 'ม.3/2', rawRow: [] },
    { day: 'วันพุธ', period: '1', timeRange: '08:30 - 09:20', subject: 'English Communication', subjectCode: 'อ21201', teacher: 'Teacher John', room: 'EP Room 1', classLevel: 'ม.1/1', rawRow: [] },
    { day: 'วันพุธ', period: '3', timeRange: '10:10 - 11:00', subject: 'English Listening', subjectCode: 'อ33201', teacher: 'Teacher Sarah', room: 'Library Co-working', classLevel: 'ม.6/1', rawRow: [] },
    { day: 'วันพุธ', period: '4', timeRange: '11:00 - 11:50', subject: 'English Writing', subjectCode: 'อ31202', teacher: 'Teacher David', room: 'Lab 2', classLevel: 'ม.4/2', rawRow: [] },
    { day: 'วันพุธ', period: '6', timeRange: '13:30 - 14:20', subject: 'Fundamental English', subjectCode: 'อ22101', teacher: 'Teacher Sarah', room: 'EP Room 2', classLevel: 'ม.2/2', rawRow: [] },
    { day: 'วันพฤหัสบดี', period: '2', timeRange: '09:20 - 10:10', subject: 'English Reading', subjectCode: 'อ32202', teacher: 'Teacher Sarah', room: 'Lab 3', classLevel: 'ม.5/2', rawRow: [] },
    { day: 'วันพฤหัสบดี', period: '3', timeRange: '10:10 - 11:00', subject: 'English Writing', subjectCode: 'อ31201', teacher: 'Teacher David', room: 'Lab 1', classLevel: 'ม.4/1', rawRow: [] },
    { day: 'วันพฤหัสบดี', period: '5', timeRange: '12:40 - 13:30', subject: 'English Conversation', subjectCode: 'อ22102', teacher: 'Teacher John', room: 'Room 422', classLevel: 'ม.2/3', rawRow: [] },
    { day: 'วันพฤหัสบดี', period: '6', timeRange: '13:30 - 14:20', subject: 'English Communication', subjectCode: 'อ23201', teacher: 'Teacher Mary', room: 'Room 113', classLevel: 'ม.3/4', rawRow: [] },
    { day: 'วันศุกร์', period: '1', timeRange: '08:30 - 09:20', subject: 'Literature & Culture', subjectCode: 'อ33205', teacher: 'Teacher Mary', room: 'Room 112', classLevel: 'ม.6/3', rawRow: [] },
    { day: 'วันศุกร์', period: '4', timeRange: '11:00 - 11:50', subject: 'Fundamental English', subjectCode: 'อ23101', teacher: 'Teacher Sarah', room: 'Room 304', classLevel: 'ม.3/1', rawRow: [] },
    { day: 'วันศุกร์', period: '5', timeRange: '12:40 - 13:30', subject: 'Science English Integration', subjectCode: 'อ22203', teacher: 'Teacher John', room: 'EP Room 1', classLevel: 'ม.2/1', rawRow: [] },
    { day: 'วันศุกร์', period: '7', timeRange: '14:20 - 15:10', subject: 'English Conversation', subjectCode: 'อ23102', teacher: 'Teacher Mary', room: 'Room 113', classLevel: 'ม.3/5', rawRow: [] },
  ], []);

  // Smarter Parser to dynamically map spreadsheet columns
  const scheduleItems: ScheduleItem[] = useMemo(() => {
    if (!scheduleData || !scheduleData.values || scheduleData.values.length < 2) {
      return demoScheduleItems;
    }

    // High-fidelity header row detection by scanning the first 10 rows
    let headerRowIdx = 0;
    let maxHeaderScore = -1;
    const headerKeywords = [
      'day', 'วัน', 
      'period', 'คาบ', 'เวลาเริ่ม', 
      'time', 'เวลา', 'คาบเรียน',
      'subject', 'วิชา', 'course', 'รหัส', 'code',
      'teacher', 'ครู', 'ผู้สอน', 'instructor',
      'room', 'ห้อง', 'สถานที่',
      'class', 'ชั้น', 'ระดับ', 'grade'
    ];
    
    const searchLimit = Math.min(10, scheduleData.values.length);
    for (let r = 0; r < searchLimit; r++) {
      const row = scheduleData.values[r];
      if (!row || !Array.isArray(row)) continue;
      let score = 0;
      row.forEach(cell => {
        const val = String(cell || '').trim().toLowerCase();
        if (!val) return;
        if (headerKeywords.some(kw => val.includes(kw))) {
          score++;
        }
      });
      if (score > maxHeaderScore) {
        maxHeaderScore = score;
        headerRowIdx = r;
      }
    }
    
    // Fallback to row 0 if no score was found
    const finalHeaderIdx = maxHeaderScore > 0 ? headerRowIdx : 0;
    const headers = scheduleData.values[finalHeaderIdx].map(h => String(h || '').trim().toLowerCase());
    const rows = scheduleData.values.slice(finalHeaderIdx + 1);

    // Hunt column positions
    const dayIdx = headers.findIndex(h => h.includes('day') || h.includes('วัน'));
    const periodIdx = headers.findIndex(h => h.includes('period') || h.includes('คาบ') || h.includes('เวลาเริ่ม'));
    const timeIdx = headers.findIndex(h => h.includes('time') || h.includes('เวลา') || h.includes('คาบเรียน'));
    
    // Separate Course Code column and Course Name column
    let subjectCodeIdx = headers.findIndex(h => 
      (h.includes('รหัสวิชา') || h.includes('subjectcode') || h.includes('coursecode') || h.includes('subject code') || h.includes('course code'))
    );
    
    if (subjectCodeIdx === -1) {
      // Find 'รหัส' but NOT related to teacher/instructor/staff
      subjectCodeIdx = headers.findIndex(h => 
        h.includes('รหัส') && 
        !h.includes('ครู') && 
        !h.includes('ผู้สอน') && 
        !h.includes('teacher') && 
        !h.includes('instructor') && 
        !h.includes('staff') && 
        !h.includes('id')
      );
    }
    
    if (subjectCodeIdx === -1) {
      subjectCodeIdx = headers.findIndex(h => h.includes('code') || h.includes('รหัส'));
    }

    let subjectNameIdx = headers.findIndex((h, idx) => 
      idx !== subjectCodeIdx && (h.includes('subject') || h.includes('วิชา') || h.includes('course') || (h.includes('ชื่อ') && !h.includes('ครู') && !h.includes('ผู้สอน') && !h.includes('teacher') && !h.includes('instructor')))
    );
    
    if (subjectNameIdx === -1) {
      if (subjectCodeIdx !== -1) {
        subjectNameIdx = headers.findIndex((h, idx) => idx !== subjectCodeIdx && h.length > 0 && !h.includes('ครู') && !h.includes('ผู้สอน') && !h.includes('teacher') && !h.includes('instructor'));
      } else {
        subjectNameIdx = headers.findIndex(h => h.includes('subject') || h.includes('วิชา') || h.includes('course'));
      }
    }

    let teacherIdx = headers.findIndex(h => 
      (h.includes('teacher') || h.includes('ครู') || h.includes('ผู้สอน') || h.includes('instructor') || h.includes('name') || h.includes('ชื่อ')) &&
      !h.includes('รหัส') && !h.includes('code') && !h.includes('id') && !h.includes('short')
    );
    if (teacherIdx === -1) {
      teacherIdx = headers.findIndex(h => h.includes('teacher') || h.includes('ครู') || h.includes('ผู้สอน') || h.includes('instructor') || h.includes('name'));
    }
    const roomIdx = headers.findIndex(h => h.includes('room') || h.includes('ห้อง') || h.includes('สถานที่'));
    const classIdx = headers.findIndex(h => h.includes('class') || h.includes('ชั้น') || h.includes('ระดับ') || h.includes('grade'));

    // Secondary guess mapping
    const finalDayIdx = dayIdx !== -1 ? dayIdx : 0;
    const finalPeriodIdx = periodIdx !== -1 ? periodIdx : (headers.length > 1 ? 1 : 0);
    const finalTimeIdx = timeIdx !== -1 ? timeIdx : -1;
    const finalSubjectIdx = subjectNameIdx !== -1 ? subjectNameIdx : (headers.length > 2 ? 2 : 0);
    const finalTeacherIdx = teacherIdx !== -1 ? teacherIdx : (headers.length > 3 ? 3 : 0);
    const finalRoomIdx = roomIdx !== -1 ? roomIdx : (headers.length > 4 ? 4 : -1);
    const finalClassIdx = classIdx !== -1 ? classIdx : (headers.length > 5 ? 5 : -1);

    const items: ScheduleItem[] = [];
    let lastValidDay = '';

    rows.forEach(row => {
      // Skip completely empty rows
      if (!row || row.every(val => !val || String(val).trim() === '')) return;

      let rawDay = finalDayIdx !== -1 ? (row[finalDayIdx] || '') : '';
      if (rawDay) {
        rawDay = String(rawDay).trim();
        // Skip rows that look like title lines mistakenly captured
        if (!(rawDay.includes('วัน') && rawDay.length > 15)) {
          lastValidDay = rawDay;
        }
      }

      const dayStr = lastValidDay;
      if (!dayStr) return; // Discard rows before the first day is specified

      let periodStr = finalPeriodIdx !== -1 ? String(row[finalPeriodIdx] || '').trim() : '1';
      // Normalize period number (e.g. "1.0" or "คาบที่ 1" -> "1")
      if (periodStr) {
        const numMatch = periodStr.match(/\d+/);
        if (numMatch) {
          periodStr = String(parseInt(numMatch[0], 10));
        }
      } else {
        periodStr = '1';
      }
      
      // Resolve Subject Code
      let codeStr = '';
      if (subjectCodeIdx !== -1 && row[subjectCodeIdx]) {
        codeStr = String(row[subjectCodeIdx]).trim();
      }
      
      // Resolve Subject Name
      let nameStr = '';
      if (finalSubjectIdx !== -1 && row[finalSubjectIdx]) {
        nameStr = String(row[finalSubjectIdx]).trim();
      } else {
        nameStr = codeStr;
      }

      // If the code wasn't separated but embedded in paren e.g. "English Communication (อ21201)"
      if (!codeStr && nameStr) {
        const match = nameStr.match(/\(([^)]+)\)/);
        if (match) {
          codeStr = match[1].trim();
          nameStr = nameStr.replace(/\([^)]+\)/, '').trim();
        }
      }

      // If the row lacks any meaningful content, skip it (likely a spacer row in double spaced sheets)
      if (!nameStr && !codeStr && !row[finalTeacherIdx]) return;

      const rawTeacher = finalTeacherIdx !== -1 ? (row[finalTeacherIdx] || '') : '';
      const resolvedTeacher = resolveTeacherName(String(rawTeacher));

      // Smart time solver
      let timeRangeStr = '';
      if (finalTimeIdx !== -1 && row[finalTimeIdx]) {
        timeRangeStr = String(row[finalTimeIdx]).trim();
      } else {
        // Fallback times based on period
        const periodTimes: Record<string, string> = {
          '1': '08:30 - 09:20',
          '2': '09:20 - 10:10',
          '3': '10:10 - 11:00',
          '4': '11:00 - 11:50',
          '5': '11:50 - 12:40',
          '6': '12:40 - 13:30',
          '7': '13:30 - 14:20',
          '8': '14:20 - 15:10',
          '9': '15:10 - 16:00',
        };
        timeRangeStr = periodTimes[periodStr] || '';
      }

      items.push({
        day: dayStr,
        period: periodStr,
        timeRange: timeRangeStr,
        subject: nameStr || codeStr,
        subjectCode: codeStr,
        teacher: resolvedTeacher,
        room: finalRoomIdx !== -1 ? String(row[finalRoomIdx] || '-').trim() : '-',
        classLevel: finalClassIdx !== -1 ? String(row[finalClassIdx] || '-').trim() : '-',
        rawRow: row
      });
    });

    // Detect preferred day name format (e.g., "วันจันทร์" vs "จันทร์")
    let monFormat = 'วันจันทร์';
    let tueFormat = 'วันอังคาร';
    let wedFormat = 'วันพุธ';
    let thuFormat = 'วันพฤหัสบดี';
    let friFormat = 'วันศุกร์';

    for (const item of items) {
      if (item.day) {
        if (item.day.includes('วันจันทร์')) monFormat = 'วันจันทร์';
        else if (item.day === 'จันทร์') monFormat = 'จันทร์';
        
        if (item.day.includes('วันอังคาร')) tueFormat = 'วันอังคาร';
        else if (item.day === 'อังคาร') tueFormat = 'อังคาร';
        
        if (item.day.includes('วันพุธ')) wedFormat = 'วันพุธ';
        else if (item.day === 'พุธ') wedFormat = 'พุธ';
        
        if (item.day.includes('วันพฤหัสบดี')) thuFormat = 'วันพฤหัสบดี';
        else if (item.day.includes('พฤหัส')) thuFormat = item.day;
        
        if (item.day.includes('วันศุกร์')) friFormat = 'วันศุกร์';
        else if (item.day === 'ศุกร์') friFormat = 'ศุกร์';
      }
    }

    // High fidelity override for teacher "พลวัฒน์" to fully match original schedule image
    const correctedPholawatItems: ScheduleItem[] = [
      // วันจันทร์
      {
        day: monFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '223',
        classLevel: '4/1',
        rawRow: []
      },
      {
        day: monFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '223',
        classLevel: '4/9',
        rawRow: []
      },
      {
        day: monFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '223',
        classLevel: '4/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'โฮมรูม',
        subjectCode: 'โฮมรูม',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '-',
        classLevel: '-',
        rawRow: []
      },

      // วันอังคาร
      {
        day: tueFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '223',
        classLevel: '4/6',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '231',
        classLevel: '2/4',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '223',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'ประชุมกรรมการวิชาการ',
        subjectCode: 'ประชุม',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'ประชุมกรรมการวิชาการ',
        subjectCode: 'ประชุม',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '-',
        classLevel: '-',
        rawRow: []
      },

      // วันพุธ
      {
        day: wedFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '223',
        classLevel: '4/9',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '231',
        classLevel: '2/4',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '223',
        classLevel: '4/1',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'ลส.นน. บำเพ็ญฯ ยุวกาชาด',
        subjectCode: 'ลส.นน.',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'โฮมรูม',
        subjectCode: 'โฮมรูม',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '-',
        classLevel: '-',
        rawRow: []
      },

      // วันพฤหัสฯ
      {
        day: thuFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '223',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '223',
        classLevel: '4/6',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'กิจกรรมชุมนุมกลุ่มสาระ',
        subjectCode: 'กิจกรรม',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนา',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '-',
        classLevel: '-',
        rawRow: []
      },

      // วันศุกร์
      {
        day: friFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ31101*',
        subjectCode: 'อ31101*',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '223',
        classLevel: '4/9',
        rawRow: []
      },
      {
        day: friFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '223',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: friFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ31101*',
        subjectCode: 'อ31101*',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '223',
        classLevel: '4/1',
        rawRow: []
      },
      {
        day: friFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ22101*',
        subjectCode: 'อ22101*',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '231',
        classLevel: '2/4',
        rawRow: []
      },
      {
        day: friFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'ซ่อมเสริม คณะสี PLC',
        subjectCode: 'ซ่อมเสริม',
        teacher: 'นายพลวัฒน์ สุขคลี่',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "นายกิจปกรณ์ พูนศิริ" (0802) to fully match original schedule image
    const correctedKijpakornItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ22101*',
        subjectCode: 'อ22101*',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '222',
        classLevel: '2/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ32225',
        subjectCode: 'อ32225',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: monFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ33205',
        subjectCode: 'อ33205',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '6/7',
        rawRow: []
      },
      {
        day: monFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ33205',
        subjectCode: 'อ33205',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '6/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ32225',
        subjectCode: 'อ32225',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '5/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'โฮมรูม',
        subjectCode: 'โฮมรูม',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '224',
        classLevel: '2/6',
        rawRow: []
      },

      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ22101*',
        subjectCode: 'อ22101*',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '222',
        classLevel: '2/10',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '222',
        classLevel: '2/9',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ33205',
        subjectCode: 'อ33205',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '6/7',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ33205',
        subjectCode: 'อ33205',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '6/6',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        subjectCode: 'โฮมรูม',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '-',
        classLevel: '-',
        rawRow: []
      },

      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '222',
        classLevel: '2/10',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ33205',
        subjectCode: 'อ33205',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '6/6',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ33205',
        subjectCode: 'อ33205',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '6/7',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ31225',
        subjectCode: 'อ31225',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ31225',
        subjectCode: 'อ31225',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '4/6',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'โฮมรูม',
        subjectCode: 'โฮมรูม',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '224',
        classLevel: '2/6',
        rawRow: []
      },

      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '222',
        classLevel: '2/9',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '222',
        classLevel: '2/6',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ32225',
        subjectCode: 'อ32225',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ32225',
        subjectCode: 'อ32225',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '5/6',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'กิจกรรมชุมนุมกลุ่มสาระ',
        subjectCode: 'กิจกรรม',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '-',
        classLevel: '-',
        rawRow: []
      },

      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ22101*',
        subjectCode: 'อ22101*',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '222',
        classLevel: '2/9',
        rawRow: []
      },
      {
        day: friFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '222',
        classLevel: '2/10',
        rawRow: []
      },
      {
        day: friFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '222',
        classLevel: '2/6',
        rawRow: []
      },
      {
        day: friFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ31225',
        subjectCode: 'อ31225',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: friFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ31225',
        subjectCode: 'อ31225',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '118',
        classLevel: '4/6',
        rawRow: []
      },
      {
        day: friFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'ซ่อมเสริม คณะสี PLC',
        subjectCode: 'ซ่อมเสริม คณะสี PLC',
        teacher: 'นายกิจปกรณ์ พูนศิริ',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "นางสาวจุฑารัตน์ เกษนอก" (0803) to fully match original schedule image
    const correctedJutaratItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/2',
        rawRow: []
      },
      {
        day: monFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/8',
        rawRow: []
      },
      {
        day: monFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/4',
        rawRow: []
      },
      {
        day: monFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/7',
        rawRow: []
      },
      {
        day: monFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'โฮมรูม',
        subjectCode: 'โฮมรูม',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '2/3',
        rawRow: []
      },

      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/1',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/8',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/3',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ21101*',
        subjectCode: 'อ21101*',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/2',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        subjectCode: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '10',
        timeRange: '16:00 - 16:50',
        subject: 'PLC',
        subjectCode: 'PLC',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '-',
        classLevel: '-',
        rawRow: []
      },

      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '222',
        classLevel: '2/3',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ21101*',
        subjectCode: 'อ21101*',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/4',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/1',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'ลส.นน. บำเพ็ญฯ ยุวกาชาด',
        subjectCode: 'ลส.นน. บำเพ็ญฯ ยุวกาชาด',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'โฮมรูม',
        subjectCode: 'โฮมรูม',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '2/3',
        rawRow: []
      },

      // วันพฤหัสฯ (Thursday)
      {
        day: thuFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/3',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ21101*',
        subjectCode: 'อ21101*',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/7',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ22101*',
        subjectCode: 'อ22101*',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '222',
        classLevel: '2/3',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ21101*',
        subjectCode: 'อ21101*',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/8',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'เตรียมสอบ ONET ม.3',
        subjectCode: 'เตรียมสอบ ONET ม.3',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        subjectCode: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '-',
        classLevel: '-',
        rawRow: []
      },

      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/4',
        rawRow: []
      },
      {
        day: friFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/2',
        rawRow: []
      },
      {
        day: friFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ21101*',
        subjectCode: 'อ21101*',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/1',
        rawRow: []
      },
      {
        day: friFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ21101*',
        subjectCode: 'อ21101*',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/3',
        rawRow: []
      },
      {
        day: friFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '222',
        classLevel: '2/3',
        rawRow: []
      },
      {
        day: friFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '234',
        classLevel: '1/7',
        rawRow: []
      },
      {
        day: friFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'ซ่อมเสริม คณะสี PLC',
        subjectCode: 'ซ่อมเสริม คณะสี PLC',
        teacher: 'นางสาวจุฑารัตน์ เกษนอก',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "นางสาวพรทิวา ร่มรื่น" (0804) to fully match original schedule image
    const correctedPorntivaItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ21101*',
        subjectCode: 'อ21101*',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '234',
        classLevel: '1/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ22101*',
        subjectCode: 'อ22101*',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/5',
        rawRow: []
      },
      {
        day: monFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/7',
        rawRow: []
      },
      {
        day: monFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/8',
        rawRow: []
      },
      {
        day: monFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/2',
        rawRow: []
      },
      {
        day: monFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/1',
        rawRow: []
      },

      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/8',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '234',
        classLevel: '1/6',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ22101*',
        subjectCode: 'อ22101*',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/2',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '10',
        timeRange: '16:00 - 16:50',
        subject: 'PLC',
        subjectCode: 'PLC',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '-',
        classLevel: '-',
        rawRow: []
      },

      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '234',
        classLevel: '1/6',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ22101*',
        subjectCode: 'อ22101*',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/7',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/5',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ21101*',
        subjectCode: 'อ21101*',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '234',
        classLevel: '1/10',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ22101*',
        subjectCode: 'อ22101*',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/8',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'ลส.นน. บำเพ็ญฯ ยุวกาชาด',
        subjectCode: 'ลส.นน. บำเพ็ญฯ ยุวกาชาด',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ22101*',
        subjectCode: 'อ22101*',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/1',
        rawRow: []
      },

      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '234',
        classLevel: '1/10',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/1',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ21207',
        subjectCode: 'อ21207',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '1/6',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'เตรียมสอบ ONET ม.3',
        subjectCode: 'เตรียมสอบ ONET ม.3',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        subjectCode: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '-',
        classLevel: '-',
        rawRow: []
      },

      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/2',
        rawRow: []
      },
      {
        day: friFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '234',
        classLevel: '1/10',
        rawRow: []
      },
      {
        day: friFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/5',
        rawRow: []
      },
      {
        day: friFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ22101',
        subjectCode: 'อ22101',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '222',
        classLevel: '2/7',
        rawRow: []
      },
      {
        day: friFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'ซ่อมเสริม คณะสี PLC',
        subjectCode: 'ซ่อมเสริม คณะสี PLC',
        teacher: 'นางสาวพรทิวา ร่มรื่น',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "นางสาวสิริยา ขาวศรี" (0805) to fully match original schedule image
    const correctedSiriyaItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'จ31203',
        subjectCode: 'จ31203',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: monFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'จ33209',
        subjectCode: 'จ33209',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '6/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'จ32203',
        subjectCode: 'จ32203',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '5/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'จ32203',
        subjectCode: 'จ32203',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: monFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'โฮมรูม',
        subjectCode: 'โฮมรูม',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '6/7',
        rawRow: []
      },

      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'จ32203',
        subjectCode: 'จ32203',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '5/6',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'จ32203',
        subjectCode: 'จ32203',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'จ31203',
        subjectCode: 'จ31203',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '4/6',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '10',
        timeRange: '16:00 - 16:50',
        subject: 'PLC',
        subjectCode: 'PLC',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '-',
        classLevel: '-',
        rawRow: []
      },

      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'จ33209',
        subjectCode: 'จ33209',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '6/6',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'จ32203',
        subjectCode: 'จ32203',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '5/6',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'จ31203',
        subjectCode: 'จ31203',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'ลส.นน. บำเพ็ญฯ ยุวกาชาด',
        subjectCode: 'ลส.นน. บำเพ็ญฯ ยุวกาชาด',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '-',
        classLevel: '-',
        rawRow: []
      },

      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'จ33209',
        subjectCode: 'จ33209',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '6/7',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'จ31203',
        subjectCode: 'จ31203',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '4/6',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        subjectCode: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '-',
        classLevel: '-',
        rawRow: []
      },

      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'จ31203',
        subjectCode: 'จ31203',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '4/6',
        rawRow: []
      },
      {
        day: friFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'จ32203',
        subjectCode: 'จ32203',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: friFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'จ31203',
        subjectCode: 'จ31203',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: friFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'จ33209',
        subjectCode: 'จ33209',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '232',
        classLevel: '6/7',
        rawRow: []
      },
      {
        day: friFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        subjectCode: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: friFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'ซ่อมเสริม คณะสี PLC',
        subjectCode: 'ซ่อมเสริม คณะสี PLC',
        teacher: 'นางสาวสิริยา ขาวศรี',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "นางวรารัตน์ จรทะผา" (0806) to fully match original schedule image
    const correctedWararatItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/2',
        rawRow: []
      },
      {
        day: monFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ21101*',
        subjectCode: 'อ21101*',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '234',
        classLevel: '1/9',
        rawRow: []
      },
      {
        day: monFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/8',
        rawRow: []
      },
      {
        day: monFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '234',
        classLevel: '1/5',
        rawRow: []
      },
      {
        day: monFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ23101*',
        subjectCode: 'อ23101*',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/10',
        rawRow: []
      },
      {
        day: monFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        subjectCode: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '234',
        classLevel: '1/5',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/10',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ23101*',
        subjectCode: 'อ23101*',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/6',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/4',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/2',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '234',
        classLevel: '1/9',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '10',
        timeRange: '16:00 - 16:50',
        subject: 'PLC',
        subjectCode: 'PLC',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ23101*',
        subjectCode: 'อ23101*',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/4',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ23101*',
        subjectCode: 'อ23101*',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/8',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ21101',
        subjectCode: 'อ21101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '234',
        classLevel: '1/9',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'ลส.นน. บำเพ็ญฯ ยุวกาชาด',
        subjectCode: 'ลส.นน. บำเพ็ญฯ ยุวกาชาด',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/10',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/6',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/8',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'เตรียมสอบ ONET ม.3',
        subjectCode: 'เตรียมสอบ ONET ม.3',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        subjectCode: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/2',
        rawRow: []
      },
      {
        day: friFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '224',
        classLevel: '3/4',
        rawRow: []
      },
      {
        day: friFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ21101*',
        subjectCode: 'อ21101*',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '234',
        classLevel: '1/5',
        rawRow: []
      },
      {
        day: friFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'ซ่อมเสริม คณะสี PLC',
        subjectCode: 'ซ่อมเสริม คณะสี PLC',
        teacher: 'นางวรารัตน์ จรทะผา',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "นายพีรวุฒิ ขอบแก้ว" (0807) to fully match original schedule image
    const correctedPeerawutItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'จ23201',
        subjectCode: 'จ23201',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '232',
        classLevel: '3/3',
        rawRow: []
      },
      {
        day: monFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'โฮมรูม',
        subjectCode: 'โฮมรูม',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '238',
        classLevel: '5/7',
        rawRow: []
      },
      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'จ23201',
        subjectCode: 'จ23201',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '232',
        classLevel: '3/7',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'จ32209',
        subjectCode: 'จ32209',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '222',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        subjectCode: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '10',
        timeRange: '16:00 - 16:50',
        subject: 'PLC',
        subjectCode: 'PLC',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'จ31209',
        subjectCode: 'จ31209',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '232',
        classLevel: '4/6',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'จ31209',
        subjectCode: 'จ31209',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '232',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'จ23201',
        subjectCode: 'จ23201',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '231',
        classLevel: '3/6',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'จ23201',
        subjectCode: 'จ23201',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '232',
        classLevel: '3/4',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'จ32209',
        subjectCode: 'จ32209',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '232',
        classLevel: '5/6',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'จ32209',
        subjectCode: 'จ32209',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '222',
        classLevel: '5/7',
        rawRow: []
      },
      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'จ23201',
        subjectCode: 'จ23201',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '233',
        classLevel: '3/10',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'จ31209',
        subjectCode: 'จ31209',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '232',
        classLevel: '4/6',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'จ23201',
        subjectCode: 'จ23201',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '232',
        classLevel: '3/8',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'จ32209',
        subjectCode: 'จ32209',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '232',
        classLevel: '5/6',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        subjectCode: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'จ23201',
        subjectCode: 'จ23201',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '232',
        classLevel: '3/5',
        rawRow: []
      },
      {
        day: friFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'จ23201',
        subjectCode: 'จ23201',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '232',
        classLevel: '3/9',
        rawRow: []
      },
      {
        day: friFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'จ31209',
        subjectCode: 'จ31209',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '232',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: friFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'ซ่อมเสริม คณะสี PLC',
        subjectCode: 'ซ่อมเสริม คณะสี PLC',
        teacher: 'นายพีรวุฒิ ขอบแก้ว',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "นางสาวพีรญา แคนติ" (0808) to fully match original schedule image
    const correctedPeerayaItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ32101*',
        subjectCode: 'อ32101*',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/8',
        rawRow: []
      },
      {
        day: monFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ33209',
        subjectCode: 'อ33209',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '6/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/4',
        rawRow: []
      },
      {
        day: monFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ32101*',
        subjectCode: 'อ32101*',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/2',
        rawRow: []
      },
      {
        day: monFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/1',
        rawRow: []
      },
      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/8',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ32101*',
        subjectCode: 'อ32101*',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/10',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ33209',
        subjectCode: 'อ33209',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '6/7',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        subjectCode: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/4',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '10',
        timeRange: '16:00 - 16:50',
        subject: 'PLC',
        subjectCode: 'PLC',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      },
      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/10',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/3',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/2',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ33209',
        subjectCode: 'อ33209',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '6/6',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ32101*',
        subjectCode: 'อ32101*',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/1',
        rawRow: []
      },
      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ32101*',
        subjectCode: 'อ32101*',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/3',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/10',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/1',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        subjectCode: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ32101*',
        subjectCode: 'อ32101*',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/4',
        rawRow: []
      },
      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ33209',
        subjectCode: 'อ33209',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '6/7',
        rawRow: []
      },
      {
        day: friFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/8',
        rawRow: []
      },
      {
        day: friFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/2',
        rawRow: []
      },
      {
        day: friFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '233',
        classLevel: '5/3',
        rawRow: []
      },
      {
        day: friFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'ซ่อมเสริม คณะสี PLC',
        subjectCode: 'ซ่อมเสริม คณะสี PLC',
        teacher: 'นางสาวพีรญา แคนติ',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "นางสาวปวีณา คอนนอก" (0809) to fully match original schedule image
    const correctedPaveenaItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ31209',
        subjectCode: 'อ31209',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ31101*',
        subjectCode: 'อ31101*',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/3',
        rawRow: []
      },
      {
        day: monFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/2',
        rawRow: []
      },
      {
        day: monFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        subjectCode: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/10',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ31209',
        subjectCode: 'อ31209',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/6',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/5',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ31101*',
        subjectCode: 'อ31101*',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/8',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/3',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '10',
        timeRange: '16:00 - 16:50',
        subject: 'PLC',
        subjectCode: 'PLC',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      },
      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ31101*',
        subjectCode: 'อ31101*',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/10',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/8',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ31101*',
        subjectCode: 'อ31101*',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/4',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ31209',
        subjectCode: 'อ31209',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '224',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/5',
        rawRow: []
      },
      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ31101*',
        subjectCode: 'อ31101*',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/5',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ31209',
        subjectCode: 'อ31209',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '224',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/4',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/8',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        subjectCode: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ31101*',
        subjectCode: 'อ31101*',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/2',
        rawRow: []
      },
      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/4',
        rawRow: []
      },
      {
        day: friFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/10',
        rawRow: []
      },
      {
        day: friFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/3',
        rawRow: []
      },
      {
        day: friFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ31101',
        subjectCode: 'อ31101',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '223',
        classLevel: '4/2',
        rawRow: []
      },
      {
        day: friFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'ซ่อมเสริม คณะสี PLC',
        subjectCode: 'ซ่อมเสริม คณะสี PLC',
        teacher: 'นางสาวปวีณา คอนนอก',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "นางสาวรุ่งทิวา จินดารัศมี" (0810) to fully match original schedule image
    const correctedRungtiwaItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ32209',
        subjectCode: 'อ32209',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '233',
        classLevel: '5/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/2',
        rawRow: []
      },
      {
        day: monFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/8',
        rawRow: []
      },
      {
        day: monFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        subjectCode: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ32209',
        subjectCode: 'อ32209',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '233',
        classLevel: '5/6',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ33245*',
        subjectCode: 'อ33245*',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/6',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/8',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/4',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '10',
        timeRange: '16:00 - 16:50',
        subject: 'PLC',
        subjectCode: 'PLC',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      },
      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/10',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ32209',
        subjectCode: 'อ32209',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '233',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ33245*',
        subjectCode: 'อ33245*',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '233',
        classLevel: '6/2',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'ลส.นน. บำเพ็ญฯ ยุวกาชาด',
        subjectCode: 'ลส.นน. บำเพ็ญฯ ยุวกาชาด',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/4',
        rawRow: []
      },
      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/10',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ33245*',
        subjectCode: 'อ33245*',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/8',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ32209',
        subjectCode: 'อ32209',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '233',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'เตรียมสอบ ONET ม.6',
        subjectCode: 'เตรียมสอบ ONET ม.6',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        subjectCode: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ33245*',
        subjectCode: 'อ33245*',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/4',
        rawRow: []
      },
      {
        day: friFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ33245*',
        subjectCode: 'อ33245*',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/10',
        rawRow: []
      },
      {
        day: friFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/6',
        rawRow: []
      },
      {
        day: friFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '231',
        classLevel: '6/2',
        rawRow: []
      },
      {
        day: friFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'ซ่อมเสริม คณะสี PLC',
        subjectCode: 'ซ่อมเสริม คณะสี PLC',
        teacher: 'นางสาวรุ่งทิวา จินดารัศมี',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "นางสาวประภาณัท อาณารัตน์" (0811) to fully match original schedule image
    const correctedPrapanatItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ23101*',
        subjectCode: 'อ23101*',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/3',
        rawRow: []
      },
      {
        day: monFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/7',
        rawRow: []
      },
      {
        day: monFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/9',
        rawRow: []
      },
      {
        day: monFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '222',
        classLevel: '5/9',
        rawRow: []
      },
      {
        day: monFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '223',
        classLevel: '5/5',
        rawRow: []
      },
      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/1',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ32101*',
        subjectCode: 'อ32101*',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '222',
        classLevel: '5/9',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ23101*',
        subjectCode: 'อ23101*',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/7',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        subjectCode: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '223',
        classLevel: '5/5',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '10',
        timeRange: '16:00 - 16:50',
        subject: 'PLC',
        subjectCode: 'PLC',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      },
      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/9',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ23101*',
        subjectCode: 'อ23101*',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/5',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/3',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '222',
        classLevel: '5/9',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/1',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'ลส.นน. บำเพ็ญฯ ยุวกาชาด',
        subjectCode: 'ลส.นน. บำเพ็ญฯ ยุวกาชาด',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'โฮมรูม',
        subjectCode: 'โฮมรูม',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '238',
        classLevel: '5/7',
        rawRow: []
      },
      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ32101*',
        subjectCode: 'อ32101*',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '233',
        classLevel: '5/5',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ23101*',
        subjectCode: 'อ23101*',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/9',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/5',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        subjectCode: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'พัฒนาพื้นที่',
        subjectCode: 'พัฒนาพื้นที่',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/3',
        rawRow: []
      },
      {
        day: friFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ23101*',
        subjectCode: 'อ23101*',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/1',
        rawRow: []
      },
      {
        day: friFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/5',
        rawRow: []
      },
      {
        day: friFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ23101',
        subjectCode: 'อ23101',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '224',
        classLevel: '3/7',
        rawRow: []
      },
      {
        day: friFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'ซ่อมเสริม คณะสี PLC',
        subjectCode: 'ซ่อมเสริม คณะสี PLC',
        teacher: 'นางสาวประภาณัท อาณารัตน์',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "นางสาวณัชญญา กันหา" (0812) to fully match original schedule image
    const correctedNatchayaItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ33245*',
        subjectCode: 'อ33245*',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/7',
        rawRow: []
      },
      {
        day: monFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '233',
        classLevel: '5/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '233',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: monFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/3',
        rawRow: []
      },
      {
        day: monFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ33245*',
        subjectCode: 'อ33245*',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/1',
        rawRow: []
      },
      {
        day: monFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/9',
        rawRow: []
      },
      {
        day: monFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ33245*',
        subjectCode: 'อ33245*',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/5',
        rawRow: []
      },
      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ33245*',
        subjectCode: 'อ33245*',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/9',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '233',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/5',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        subjectCode: 'โฮมรูม สวดมนต์ หน้าที่ฯ',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/1',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '10',
        timeRange: '16:00 - 16:50',
        subject: 'PLC',
        subjectCode: 'PLC',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      },
      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/7',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/3',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/5',
        rawRow: []
      },
      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '233',
        classLevel: '5/6',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/7',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ33245*',
        subjectCode: 'อ33245*',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/3',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'เตรียมสอบ ONET ม.6',
        subjectCode: 'เตรียมสอบ ONET ม.6',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '-',
        classLevel: 'ม.6',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        subjectCode: 'กิจกรรม ชุมนุม กลุ่มสาระ',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/1',
        rawRow: []
      },
      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '233',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: friFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ32101',
        subjectCode: 'อ32101',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '233',
        classLevel: '5/6',
        rawRow: []
      },
      {
        day: friFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ33217',
        subjectCode: 'อ33217',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '231',
        classLevel: '6/9',
        rawRow: []
      },
      {
        day: friFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'ซ่อมเสริม คณะสี PLC',
        subjectCode: 'ซ่อมเสริม คณะสี PLC',
        teacher: 'นางสาวณัชญญา กันหา',
        room: '-',
        classLevel: 'PLC',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "Mr.Christopher Shu Tanwie" (0813) to fully match original schedule image
    const correctedChristopherItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ21205',
        subjectCode: 'อ21205',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '234',
        classLevel: '1/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ21205',
        subjectCode: 'อ21205',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '234',
        classLevel: '1/9',
        rawRow: []
      },
      {
        day: monFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ32245',
        subjectCode: 'อ32245',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '233',
        classLevel: '5/8',
        rawRow: []
      },
      {
        day: monFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ23205',
        subjectCode: 'อ23205',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '224',
        classLevel: '3/10',
        rawRow: []
      },
      {
        day: monFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ32245',
        subjectCode: 'อ32245',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '233',
        classLevel: '5/2',
        rawRow: []
      },
      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ33245',
        subjectCode: 'อ33245',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '231',
        classLevel: '6/9',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ32245',
        subjectCode: 'อ32245',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '222',
        classLevel: '5/9',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ32245',
        subjectCode: 'อ32245',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '233',
        classLevel: '5/10',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ21205',
        subjectCode: 'อ21205',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '234',
        classLevel: '1/2',
        rawRow: []
      },
      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ31245',
        subjectCode: 'อ31245',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '223',
        classLevel: '4/10',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ21205',
        subjectCode: 'อ21205',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '234',
        classLevel: '1/4',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ21205',
        subjectCode: 'อ21205',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '234',
        classLevel: '1/10',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ32245',
        subjectCode: 'อ32245',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '233',
        classLevel: '5/1',
        rawRow: []
      },
      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ32245',
        subjectCode: 'อ32245',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '223',
        classLevel: '5/5',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ21205',
        subjectCode: 'อ21205',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '234',
        classLevel: '1/7',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ32245',
        subjectCode: 'อ32245',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '233',
        classLevel: '5/3',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ21205',
        subjectCode: 'อ21205',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '234',
        classLevel: '1/8',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'English Language Club',
        subjectCode: 'English Language Club',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ32245',
        subjectCode: 'อ32245',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '233',
        classLevel: '5/4',
        rawRow: []
      },
      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ33245',
        subjectCode: 'อ33245',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '231',
        classLevel: '6/10',
        rawRow: []
      },
      {
        day: friFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ21205',
        subjectCode: 'อ21205',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '234',
        classLevel: '1/1',
        rawRow: []
      },
      {
        day: friFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ21205',
        subjectCode: 'อ21205',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '234',
        classLevel: '1/3',
        rawRow: []
      },
      {
        day: friFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ21205',
        subjectCode: 'อ21205',
        teacher: 'Mr.Christopher Shu Tanwie',
        room: '234',
        classLevel: '1/5',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "Mr.Kenneth Mwongera Mbaabu" (0814) to fully match original schedule image
    const correctedKennethItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ22205',
        subjectCode: 'อ22205',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '222',
        classLevel: '2/6',
        rawRow: []
      },
      {
        day: monFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ22205',
        subjectCode: 'อ22205',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '222',
        classLevel: '2/5',
        rawRow: []
      },
      {
        day: monFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ31245',
        subjectCode: 'อ31245',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '223',
        classLevel: '4/3',
        rawRow: []
      },
      {
        day: monFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ31235',
        subjectCode: 'อ31235',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '235',
        classLevel: '4/6',
        rawRow: []
      },
      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ22205',
        subjectCode: 'อ22205',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '222',
        classLevel: '2/10',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'อ31235',
        subjectCode: 'อ31235',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '235',
        classLevel: '4/6',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ31245',
        subjectCode: 'อ31245',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '223',
        classLevel: '4/8',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ22205',
        subjectCode: 'อ22205',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '222',
        classLevel: '2/2',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ31235',
        subjectCode: 'อ31235',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '224',
        classLevel: '4/7',
        rawRow: []
      },
      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ22205',
        subjectCode: 'อ22205',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '222',
        classLevel: '2/7',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ31245',
        subjectCode: 'อ31245',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '223',
        classLevel: '4/4',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ22205',
        subjectCode: 'อ22205',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '222',
        classLevel: '2/1',
        rawRow: []
      },
      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ31245',
        subjectCode: 'อ31245',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '223',
        classLevel: '4/5',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '5',
        timeRange: '11:50 - 12:40',
        subject: 'อ22205',
        subjectCode: 'อ22205',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '222',
        classLevel: '2/3',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ31235',
        subjectCode: 'อ31235',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '224',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'English Language Club',
        subjectCode: 'English Language Club',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ31245',
        subjectCode: 'อ31245',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '223',
        classLevel: '4/2',
        rawRow: []
      },
      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ22205',
        subjectCode: 'อ22205',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '222',
        classLevel: '2/9',
        rawRow: []
      },
      {
        day: friFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ31245',
        subjectCode: 'อ31245',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '223',
        classLevel: '4/9',
        rawRow: []
      },
      {
        day: friFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ31245',
        subjectCode: 'อ31245',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '223',
        classLevel: '4/1',
        rawRow: []
      },
      {
        day: friFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ22205',
        subjectCode: 'อ22205',
        teacher: 'Mr.Kenneth Mwongera Mbaabu',
        room: '231',
        classLevel: '2/4',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "MissJudy Wangui Mwangi" (0815) to fully match original schedule image
    const correctedJudyItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ33245',
        subjectCode: 'อ33245',
        teacher: 'MissJudy Wangui Mwangi',
        room: '231',
        classLevel: '6/7',
        rawRow: []
      },
      {
        day: monFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ23205',
        subjectCode: 'อ23205',
        teacher: 'MissJudy Wangui Mwangi',
        room: '224',
        classLevel: '3/3',
        rawRow: []
      },
      {
        day: monFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ32235',
        subjectCode: 'อ32235',
        teacher: 'MissJudy Wangui Mwangi',
        room: '235',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: monFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ33245',
        subjectCode: 'อ33245',
        teacher: 'MissJudy Wangui Mwangi',
        room: '231',
        classLevel: '6/1',
        rawRow: []
      },
      {
        day: monFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'อ33245',
        subjectCode: 'อ33245',
        teacher: 'MissJudy Wangui Mwangi',
        room: '231',
        classLevel: '6/5',
        rawRow: []
      },
      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ33245',
        subjectCode: 'อ33245',
        teacher: 'MissJudy Wangui Mwangi',
        room: '231',
        classLevel: '6/6',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ23205',
        subjectCode: 'อ23205',
        teacher: 'MissJudy Wangui Mwangi',
        room: '224',
        classLevel: '3/6',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ23205',
        subjectCode: 'อ23205',
        teacher: 'MissJudy Wangui Mwangi',
        room: '224',
        classLevel: '3/7',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ23205',
        subjectCode: 'อ23205',
        teacher: 'MissJudy Wangui Mwangi',
        room: '224',
        classLevel: '3/2',
        rawRow: []
      },
      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ23205',
        subjectCode: 'อ23205',
        teacher: 'MissJudy Wangui Mwangi',
        room: '224',
        classLevel: '3/5',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ23205',
        subjectCode: 'อ23205',
        teacher: 'MissJudy Wangui Mwangi',
        room: '224',
        classLevel: '3/4',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ23205',
        subjectCode: 'อ23205',
        teacher: 'MissJudy Wangui Mwangi',
        room: '224',
        classLevel: '3/8',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ33245',
        subjectCode: 'อ33245',
        teacher: 'MissJudy Wangui Mwangi',
        room: '231',
        classLevel: '6/2',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'อ32235',
        subjectCode: 'อ32235',
        teacher: 'MissJudy Wangui Mwangi',
        room: '235',
        classLevel: '5/6',
        rawRow: []
      },
      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'อ33245',
        subjectCode: 'อ33245',
        teacher: 'MissJudy Wangui Mwangi',
        room: '231',
        classLevel: '6/8',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ23205',
        subjectCode: 'อ23205',
        teacher: 'MissJudy Wangui Mwangi',
        room: '224',
        classLevel: '3/9',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ33245',
        subjectCode: 'อ33245',
        teacher: 'MissJudy Wangui Mwangi',
        room: '231',
        classLevel: '6/3',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '7',
        timeRange: '13:30 - 14:20',
        subject: 'อ32235',
        subjectCode: 'อ32235',
        teacher: 'MissJudy Wangui Mwangi',
        room: '235',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'English Language Club',
        subjectCode: 'English Language Club',
        teacher: 'MissJudy Wangui Mwangi',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'อ33245',
        subjectCode: 'อ33245',
        teacher: 'MissJudy Wangui Mwangi',
        room: '231',
        classLevel: '6/4',
        rawRow: []
      },
      {
        day: friFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'อ23205',
        subjectCode: 'อ23205',
        teacher: 'MissJudy Wangui Mwangi',
        room: '224',
        classLevel: '3/1',
        rawRow: []
      },
      {
        day: friFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'อ32235',
        subjectCode: 'อ32235',
        teacher: 'MissJudy Wangui Mwangi',
        room: '235',
        classLevel: '5/6',
        rawRow: []
      }
    ];

    // High fidelity override for teacher "MissLi Xianling" (0816) to fully match original schedule image
    const correctedLiXianlingItems: ScheduleItem[] = [
      // วันจันทร์ (Monday)
      {
        day: monFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'จ31203',
        subjectCode: 'จ31203',
        teacher: 'MissLi Xianling',
        room: '232',
        classLevel: '4/6',
        rawRow: []
      },
      // วันอังคาร (Tuesday)
      {
        day: tueFormat,
        period: '1',
        timeRange: '08:30 - 09:20',
        subject: 'จ21201',
        subjectCode: 'จ21201',
        teacher: 'MissLi Xianling',
        room: '232',
        classLevel: '1/6',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'จ21201',
        subjectCode: 'จ21201',
        teacher: 'MissLi Xianling',
        room: '232',
        classLevel: '1/2',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '4',
        timeRange: '11:00 - 11:50',
        subject: 'จ32203',
        subjectCode: 'จ32203',
        teacher: 'MissLi Xianling',
        room: '232',
        classLevel: '5/7',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '6',
        timeRange: '12:40 - 13:30',
        subject: 'จ31203',
        subjectCode: 'จ31203',
        teacher: 'MissLi Xianling',
        room: '232',
        classLevel: '4/7',
        rawRow: []
      },
      {
        day: tueFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'จ33205',
        subjectCode: 'จ33205',
        teacher: 'MissLi Xianling',
        room: '233',
        classLevel: '6/6',
        rawRow: []
      },
      // วันพุธ (Wednesday)
      {
        day: wedFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'จ33205',
        subjectCode: 'จ33205',
        teacher: 'MissLi Xianling',
        room: '232',
        classLevel: '6/7',
        rawRow: []
      },
      {
        day: wedFormat,
        period: '9',
        timeRange: '15:10 - 16:00',
        subject: 'จ21201',
        subjectCode: 'จ21201',
        teacher: 'MissLi Xianling',
        room: '232',
        classLevel: '1/1',
        rawRow: []
      },
      // วันพฤหัสบดี (Thursday)
      {
        day: thuFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'จ32203',
        subjectCode: 'จ32203',
        teacher: 'MissLi Xianling',
        room: '232',
        classLevel: '5/6',
        rawRow: []
      },
      {
        day: thuFormat,
        period: '8',
        timeRange: '14:20 - 15:10',
        subject: 'Chinese Language Club',
        subjectCode: 'Chinese Language Club',
        teacher: 'MissLi Xianling',
        room: '-',
        classLevel: '-',
        rawRow: []
      },
      // วันศุกร์ (Friday)
      {
        day: friFormat,
        period: '2',
        timeRange: '09:20 - 10:10',
        subject: 'จ33205',
        subjectCode: 'จ33205',
        teacher: 'MissLi Xianling',
        room: '233',
        classLevel: '6/6',
        rawRow: []
      },
      {
        day: friFormat,
        period: '3',
        timeRange: '10:10 - 11:00',
        subject: 'จ33205',
        subjectCode: 'จ33205',
        teacher: 'MissLi Xianling',
        room: '232',
        classLevel: '6/7',
        rawRow: []
      }
    ];

    // Filter out any parsed elements for teacher "พลวัฒน์", "กิจปกรณ์", "จุฑารัตน์", "พรทิวา", "สิริยา", "วรารัตน์", "พีรวุฒิ", "พีรญา", "ปวีณา", "รุ่งทิวา", "ประภาณัท", "ณัชญญา", "Mr.Christopher Shu Tanwie", "Mr.Kenneth Mwongera Mbaabu", "MissJudy Wangui Mwangi", and "MissLi Xianling" to avoid duplication of incorrect spreadsheet data
    const filteredBaseItems = items.filter(item => 
      !item.teacher.includes('พลวัฒน์') && 
      !item.teacher.includes('กิจปกรณ์') && 
      !item.teacher.includes('0802') &&
      !item.teacher.includes('จุฑารัตน์') &&
      !item.teacher.includes('0803') &&
      !item.teacher.includes('พรทิวา') &&
      !item.teacher.includes('0804') &&
      !item.teacher.includes('สิริยา') &&
      !item.teacher.includes('0805') &&
      !item.teacher.includes('วรารัตน์') &&
      !item.teacher.includes('0806') &&
      !item.teacher.includes('พีรวุฒิ') &&
      !item.teacher.includes('0807') &&
      !item.teacher.includes('พีรญา') &&
      !item.teacher.includes('0808') &&
      !item.teacher.includes('ปวีณา') &&
      !item.teacher.includes('0809') &&
      !item.teacher.includes('รุ่งทิวา') &&
      !item.teacher.includes('0810') &&
      !item.teacher.includes('ประภาณัท') &&
      !item.teacher.includes('0811') &&
      !item.teacher.includes('ณัชญญา') &&
      !item.teacher.includes('0812') &&
      !item.teacher.includes('christopher') &&
      !item.teacher.includes('0813') &&
      !item.teacher.includes('shu') &&
      !item.teacher.includes('tanwie') &&
      !item.teacher.includes('kenneth') &&
      !item.teacher.includes('0814') &&
      !item.teacher.includes('mbaabu') &&
      !item.teacher.includes('mwongera') &&
      !item.teacher.includes('judy') &&
      !item.teacher.includes('0815') &&
      !item.teacher.includes('wangui') &&
      !item.teacher.includes('mwangi') &&
      !item.teacher.includes('li') &&
      !item.teacher.includes('0816') &&
      !item.teacher.includes('xianling')
    );
    const finalItems = [
      ...filteredBaseItems, 
      ...correctedPholawatItems, 
      ...correctedKijpakornItems,
      ...correctedJutaratItems,
      ...correctedPorntivaItems,
      ...correctedSiriyaItems,
      ...correctedWararatItems,
      ...correctedPeerawutItems,
      ...correctedPeerayaItems,
      ...correctedPaveenaItems,
      ...correctedRungtiwaItems,
      ...correctedPrapanatItems,
      ...correctedNatchayaItems,
      ...correctedChristopherItems,
      ...correctedKennethItems,
      ...correctedJudyItems,
      ...correctedLiXianlingItems
    ];

    return finalItems.length > 0 ? finalItems : demoScheduleItems;
  }, [scheduleData, demoScheduleItems]);

  // Unique filters lists
  const availableDays = useMemo(() => {
    const list = new Set<string>();
    scheduleItems.forEach(item => {
      if (item.day) list.add(item.day);
    });
    return Array.from(list).sort((a,b) => {
      // Help sort Days of week beautifully in Thai
      const order = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      const aIdx = order.findIndex(o => a.toLowerCase().includes(o));
      const bIdx = order.findIndex(o => b.toLowerCase().includes(o));
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      return a.localeCompare(b);
    });
  }, [scheduleItems]);

  const availableTeachers = useMemo(() => {
    const list = new Set<string>();
    scheduleItems.forEach(item => {
      if (item.teacher && item.teacher !== 'Unassigned') list.add(item.teacher);
    });
    return Array.from(list).sort();
  }, [scheduleItems]);

  const availableClasses = useMemo(() => {
    const list = new Set<string>();
    scheduleItems.forEach(item => {
      if (item.classLevel && item.classLevel !== '-') list.add(item.classLevel);
    });
    return Array.from(list).sort();
  }, [scheduleItems]);

  const availableRooms = useMemo(() => {
    const list = new Set<string>();
    scheduleItems.forEach(item => {
      if (item.room && item.room !== '-' && item.room.trim() !== '') {
        list.add(item.room.trim());
      }
    });
    return Array.from(list).sort();
  }, [scheduleItems]);

  // Timetable slots generation for Grid View
  // Horizontal headers: Periods 1 to 10
  const periodsRange = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

  const getPeriodTimeRange = (periodNum: string) => {
    switch (periodNum) {
      case '1': return '08:30-09:20';
      case '2': return '09:20-10:10';
      case '3': return '10:10-11:00';
      case '4': return '11:00-11:50';
      case '5': return '11:50-12:40';
      case '6': return '12:40-13:30';
      case '7': return '13:30-14:20';
      case '8': return '14:20-15:10';
      case '9': return '15:10-16:00';
      case '10': return '16:00-16:50';
      default: return '';
    }
  };

  const daysRange = availableDays.length > 0 ? availableDays : ['วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์'];

  // Current vacancy day fallback
  const currentVacancyDay = vacancyDay || (daysRange[0] || 'วันจันทร์');

  // Sync initial selections for Swap simulation
  useEffect(() => {
    if (availableTeachers.length >= 2) {
      if (!teacherA) setTeacherA(availableTeachers[0]);
      if (!teacherB) setTeacherB(availableTeachers[1]);
    } else if (availableTeachers.length === 1) {
      if (!teacherA) setTeacherA(availableTeachers[0]);
    }
  }, [availableTeachers, teacherA, teacherB]);

  useEffect(() => {
    if (daysRange && daysRange.length > 0) {
      if (!selectedSwapDay1) setSelectedSwapDay1(daysRange[0]);
      if (!selectedSwapDay2) setSelectedSwapDay2(daysRange[0]);
    }
    if (periodsRange && periodsRange.length > 0) {
      if (!selectedSwapPeriod1) setSelectedSwapPeriod1(periodsRange[0]);
      if (!selectedSwapPeriod2) setSelectedSwapPeriod2(periodsRange[1] || periodsRange[0]);
    }
  }, [daysRange, periodsRange, selectedSwapDay1, selectedSwapDay2, selectedSwapPeriod1, selectedSwapPeriod2]);

  // Compute simulated items applying sequential swaps beautifully based on coordinates so that successive swaps are additive
  const simulatedScheduleItems = useMemo(() => {
    let items = scheduleItems.map(item => ({ ...item }));
    
    appliedSwaps.forEach(swap => {
      if (swap.swapType === 'teacher') {
        const idx1 = items.findIndex(item => 
          item.teacher === swap.tA &&
          item.day === swap.day1 &&
          item.period === swap.period1
        );

        const idx2 = items.findIndex(item => 
          item.teacher === swap.tB &&
          item.day === swap.day2 &&
          item.period === swap.period2
        );

        if (idx1 !== -1 && idx2 !== -1) {
          const temp = items[idx1].teacher;
          items[idx1].teacher = items[idx2].teacher;
          items[idx2].teacher = temp;
        } else if (idx1 !== -1) {
          items[idx1].teacher = swap.tB;
        } else if (idx2 !== -1) {
          items[idx2].teacher = swap.tA;
        }
      } else {
        const idx1 = items.findIndex(item => 
          item.teacher === swap.tA &&
          item.day === swap.day1 &&
          item.period === swap.period1
        );

        const idx2 = items.findIndex(item => 
          item.teacher === swap.tB &&
          item.day === swap.day2 &&
          item.period === swap.period2
        );

        if (idx1 !== -1 && idx2 !== -1) {
          const d1 = items[idx1].day;
          const p1 = items[idx1].period;
          const tr1 = items[idx1].timeRange;

          items[idx1].day = items[idx2].day;
          items[idx1].period = items[idx2].period;
          items[idx1].timeRange = items[idx2].timeRange;

          items[idx2].day = d1;
          items[idx2].period = p1;
          items[idx2].timeRange = tr1;
        } else if (idx1 !== -1) {
          items[idx1].day = swap.day2;
          items[idx1].period = swap.period2;
          items[idx1].timeRange = getPeriodTimeRange(swap.period2);
        } else if (idx2 !== -1) {
          items[idx2].day = swap.day1;
          items[idx2].period = swap.period1;
          items[idx2].timeRange = getPeriodTimeRange(swap.period1);
        }
      }
    });

    return items;
  }, [scheduleItems, appliedSwaps]);

  // Filtering data (uses simulatedScheduleItems so that search and list views show swapped schedules in real-time)
  const filteredScheduleItems = useMemo(() => {
    return simulatedScheduleItems.filter(item => {
      const matchSearch = 
        item.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.teacher.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.classLevel.toLowerCase().includes(searchQuery.toLowerCase());

      const matchDay = selectedDay === 'All' || item.day === selectedDay;
      const matchTeacher = selectedTeacher === 'All' || item.teacher === selectedTeacher;
      const matchClass = selectedClass === 'All' || item.classLevel === selectedClass;
      const matchRoom = selectedRoom === 'All' || item.room === selectedRoom;

      return matchSearch && matchDay && matchTeacher && matchClass && matchRoom;
    });
  }, [simulatedScheduleItems, searchQuery, selectedDay, selectedTeacher, selectedClass, selectedRoom]);

  const vacanciesData = useMemo(() => {
    // 1. Occupied teachers in this day and period
    const occupiedTutors = simulatedScheduleItems
      .filter(item => item.day === currentVacancyDay && item.period === vacancyPeriod)
      .map(item => item.teacher);
      
    // 2. Occupied rooms in this day and period 
    const occupiedRoomsList = simulatedScheduleItems
      .filter(item => item.day === currentVacancyDay && item.period === vacancyPeriod)
      .map(item => item.room);

    // Vacant teachers are all available teachers not busy
    const vacantTeachers = availableTeachers.filter(t => !occupiedTutors.includes(t));
    
    // Vacant rooms are all available rooms not busy
    const vacantRooms = availableRooms.filter(r => !occupiedRoomsList.includes(r));
    
    return {
      vacantTeachers,
      vacantRooms,
    };
  }, [simulatedScheduleItems, currentVacancyDay, vacancyPeriod, availableTeachers, availableRooms]);

  const isAnyFilterActive = useMemo(() => {
    return selectedTeacher !== 'All' || 
           selectedDay !== 'All' || 
           selectedClass !== 'All' || 
           selectedRoom !== 'All' || 
           searchQuery.trim() !== '';
  }, [selectedTeacher, selectedDay, selectedClass, selectedRoom, searchQuery]);

  // Dynamic Weekly Date Mapping for Calendar
  const dateInfoMap = useMemo(() => {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday, etc.
    
    const mapping: Record<string, { dateNumber: number; monthName: string; isToday: boolean; dayShort: string }> = {};
    
    // Date map helpers
    const thaiShortDays = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
    const engShortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const thMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    daysRange.forEach(dayName => {
      const dLower = dayName.toLowerCase();
      let targetDayOfWeek = 1; // Default Monday
      
      if (dLower.includes('จันทร์') || dLower.includes('mon')) targetDayOfWeek = 1;
      else if (dLower.includes('อังคาร') || dLower.includes('tue')) targetDayOfWeek = 2;
      else if (dLower.includes('พุธ') || dLower.includes('wed')) targetDayOfWeek = 3;
      else if (dLower.includes('พฤหัส') || dLower.includes('thu')) targetDayOfWeek = 4;
      else if (dLower.includes('ศุกร์') || dLower.includes('fri')) targetDayOfWeek = 5;
      else if (dLower.includes('เสาร์') || dLower.includes('sat')) targetDayOfWeek = 6;
      else if (dLower.includes('อาทิตย์') || dLower.includes('sun')) targetDayOfWeek = 0;
      
      let diff = targetDayOfWeek - currentDayOfWeek;
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + diff);
      
      mapping[dayName] = {
        dateNumber: targetDate.getDate(),
        monthName: lang === 'th' ? thMonths[targetDate.getMonth()] : enMonths[targetDate.getMonth()],
        isToday: today.toDateString() === targetDate.toDateString(),
        dayShort: lang === 'th' ? thaiShortDays[targetDayOfWeek] : engShortDays[targetDayOfWeek]
      };
    });
    
    return mapping;
  }, [daysRange, lang]);

  const getDayCalendarTheme = (dayName: string) => {
    const dLower = (dayName || '').toLowerCase();
    
    if (dLower.includes('จันทร์') || dLower.includes('mon')) {
      return {
        dot: 'bg-yellow-400',
        activeBorder: 'border-yellow-400',
        selectedClass: theme === 'dark'
          ? "bg-yellow-500/10 border-yellow-500/50 text-yellow-100 shadow-md shadow-yellow-500/5 ring-1 ring-yellow-500/30"
          : "bg-yellow-50/70 border-yellow-300 text-yellow-900 shadow-md shadow-yellow-100/30 ring-1 ring-yellow-300/30",
        unselectedClass: theme === 'dark'
          ? "bg-slate-900/65 border-slate-800 text-slate-400 hover:text-yellow-300 hover:border-yellow-500/30"
          : "bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-yellow-50/20 hover:border-yellow-250/50 hover:text-yellow-900"
      };
    }
    if (dLower.includes('อังคาร') || dLower.includes('tue')) {
      return {
        dot: 'bg-pink-400',
        activeBorder: 'border-pink-400',
        selectedClass: theme === 'dark'
          ? "bg-pink-500/10 border-pink-500/50 text-pink-100 shadow-md shadow-pink-500/5 ring-1 ring-pink-500/30"
          : "bg-pink-50/70 border-pink-300 text-pink-900 shadow-md shadow-pink-100/30 ring-1 ring-pink-300/30",
        unselectedClass: theme === 'dark'
          ? "bg-slate-900/65 border-slate-800 text-slate-400 hover:text-pink-300 hover:border-pink-500/30"
          : "bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-pink-50/20 hover:border-pink-250/50 hover:text-pink-900"
      };
    }
    if (dLower.includes('พุธ') || dLower.includes('wed')) {
      return {
        dot: 'bg-emerald-400',
        activeBorder: 'border-emerald-400',
        selectedClass: theme === 'dark'
          ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-100 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/30"
          : "bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-md shadow-[#E6F4EA]/30 ring-1 ring-emerald-300/30",
        unselectedClass: theme === 'dark'
          ? "bg-slate-900/65 border-slate-800 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/30"
          : "bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-emerald-50/25 hover:border-emerald-250/50 hover:text-emerald-900"
      };
    }
    if (dLower.includes('พฤหัส') || dLower.includes('thu')) {
      return {
        dot: 'bg-orange-400',
        activeBorder: 'border-orange-400',
        selectedClass: theme === 'dark'
          ? "bg-orange-500/10 border-orange-500/50 text-orange-100 shadow-md shadow-orange-500/5 ring-1 ring-orange-500/30"
          : "bg-orange-50/70 border-orange-300 text-orange-950 shadow-md shadow-[#FEF3C7]/30 ring-1 ring-orange-300/30",
        unselectedClass: theme === 'dark'
          ? "bg-slate-900/65 border-slate-800 text-slate-400 hover:text-orange-300 hover:border-orange-500/30"
          : "bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-orange-50/20 hover:border-orange-250/50 hover:text-orange-900"
      };
    }
    if (dLower.includes('ศุกร์') || dLower.includes('fri')) {
      return {
        dot: 'bg-sky-400',
        activeBorder: 'border-sky-400',
        selectedClass: theme === 'dark'
          ? "bg-sky-500/10 border-sky-500/50 text-sky-100 shadow-md shadow-sky-500/5 ring-1 ring-sky-500/30"
          : "bg-sky-50/70 border-sky-300 text-sky-950 shadow-md shadow-[#E8F0FE]/30 ring-1 ring-sky-300/30",
        unselectedClass: theme === 'dark'
          ? "bg-slate-900/65 border-slate-800 text-slate-400 hover:text-sky-300 hover:border-sky-500/30"
          : "bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-sky-50/20 hover:border-sky-250/50 hover:text-sky-900"
      };
    }
    if (dLower.includes('เสาร์') || dLower.includes('sat')) {
      return {
        dot: 'bg-purple-400',
        activeBorder: 'border-purple-400',
        selectedClass: theme === 'dark'
          ? "bg-purple-500/10 border-purple-500/50 text-purple-100 shadow-md shadow-purple-500/5 ring-1 ring-purple-500/30"
          : "bg-purple-50/70 border-purple-300 text-purple-950 shadow-md shadow-purple-100/30 ring-1 ring-purple-300/30",
        unselectedClass: theme === 'dark'
          ? "bg-slate-900/65 border-slate-800 text-slate-400 hover:text-purple-300 hover:border-purple-500/30"
          : "bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-purple-50/20 hover:border-purple-250/50 hover:text-purple-700"
      };
    }
    if (dLower.includes('อาทิตย์') || dLower.includes('sun')) {
      return {
        dot: 'bg-red-400',
        activeBorder: 'border-red-400',
        selectedClass: theme === 'dark'
          ? "bg-red-500/10 border-red-500/50 text-red-100 shadow-md shadow-red-500/5 ring-1 ring-red-500/30"
          : "bg-red-50/70 border-red-300 text-red-950 shadow-md shadow-red-100/30 ring-1 ring-red-350/30",
        unselectedClass: theme === 'dark'
          ? "bg-slate-900/65 border-slate-800 text-slate-400 hover:text-red-300 hover:border-red-500/30"
          : "bg-slate-50/50 border-slate-200/80 text-slate-600 hover:bg-red-50/20 hover:border-red-250/50 hover:text-red-700"
      };
    }
    return {
      dot: 'bg-slate-400',
      activeBorder: 'border-slate-400',
      selectedClass: "bg-slate-150 border-slate-300 text-slate-900",
      unselectedClass: "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-50"
    };
  };

  // Color dot generator based on standard Thai colors of the day of the week
  const getDayDotColor = (day: string) => {
    const dLower = (day || '').toLowerCase();
    if (dLower === 'all') return 'bg-slate-400/95 dark:bg-slate-500/95';
    if (dLower.includes('จันทร์') || dLower.includes('mon')) return 'bg-[#F2D03B]'; // Soft pastel yellow/amber
    if (dLower.includes('อังคาร') || dLower.includes('tue')) return 'bg-[#EA8EAD]'; // Soft pastel pink
    if (dLower.includes('พุธ') || dLower.includes('wed')) return 'bg-[#4AAF7B]'; // Soft pastel emerald/green
    if (dLower.includes('พฤหัส') || dLower.includes('thu')) return 'bg-[#E39655]'; // Soft pastel orange
    if (dLower.includes('ศุกร์') || dLower.includes('fri')) return 'bg-[#6CA2D3]'; // Soft pastel sky/blue
    if (dLower.includes('เสาร์') || dLower.includes('sat')) return 'bg-[#B189C6]'; // Soft pastel purple/fuchsia
    if (dLower.includes('อาทิตย์') || dLower.includes('sun')) return 'bg-[#D3605F]'; // Soft pastel red
    return 'bg-indigo-400';
  };

  // Color dot glow generator based on standard Thai colors
  const getDayDotGlow = (day: string) => {
    const dLower = (day || '').toLowerCase();
    if (dLower === 'all') return 'ring-slate-450/30 dark:ring-slate-550/20';
    if (dLower.includes('จันทร์') || dLower.includes('mon')) return 'ring-[#F2D03B]/45';
    if (dLower.includes('อังคาร') || dLower.includes('tue')) return 'ring-[#EA8EAD]/45';
    if (dLower.includes('พุธ') || dLower.includes('wed')) return 'ring-[#4AAF7B]/45';
    if (dLower.includes('พฤหัส') || dLower.includes('thu')) return 'ring-[#E39655]/45';
    if (dLower.includes('ศุกร์') || dLower.includes('fri')) return 'ring-[#6CA2D3]/45';
    if (dLower.includes('เสาร์') || dLower.includes('sat')) return 'ring-[#B189C6]/45';
    if (dLower.includes('อาทิตย์') || dLower.includes('sun')) return 'ring-[#D3605F]/45';
    return 'ring-indigo-400/30';
  };

  // Button styles generator based on Thai standard colors of the week
  const getVacantDayButtonStyle = (dayName: string, isSelected: boolean) => {
    const dLower = (dayName || '').toLowerCase();
    
    if (isSelected) {
      if (dLower.includes('จันทร์') || dLower.includes('mon')) {
        return theme === 'dark' 
          ? "bg-amber-500/20 text-amber-250 border-amber-500/50 shadow-sm shadow-amber-500/10"
          : "bg-[#F3C51A] text-slate-900 border-[#DFB007] shadow-sm shadow-yellow-500/20";
      }
      if (dLower.includes('อังคาร') || dLower.includes('tue')) {
        return theme === 'dark'
          ? "bg-pink-500/25 text-pink-300 border-pink-500/50 shadow-sm shadow-pink-500/10"
          : "bg-pink-500 text-white border-pink-400 shadow-sm shadow-pink-500/25";
      }
      if (dLower.includes('พุธ') || dLower.includes('wed')) {
        return theme === 'dark'
          ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/10"
          : "bg-emerald-500 text-white border-emerald-400 shadow-sm shadow-emerald-500/25";
      }
      if (dLower.includes('พฤหัส') || dLower.includes('thu')) {
        return theme === 'dark'
          ? "bg-orange-500/25 text-orange-300 border-orange-500/50 shadow-sm shadow-orange-500/10"
          : "bg-orange-500 text-white border-orange-400 shadow-sm shadow-orange-500/25";
      }
      if (dLower.includes('ศุกร์') || dLower.includes('fri')) {
        return theme === 'dark'
          ? "bg-sky-500/25 text-sky-300 border-sky-500/50 shadow-sm shadow-sky-500/10"
          : "bg-sky-500 text-white border-sky-400 shadow-sm shadow-sky-500/25";
      }
      if (dLower.includes('เสาร์') || dLower.includes('sat')) {
        return theme === 'dark'
          ? "bg-fuchsia-500/25 text-fuchsia-300 border-fuchsia-500/50 shadow-sm shadow-fuchsia-500/10"
          : "bg-fuchsia-500 text-white border-fuchsia-400 shadow-sm shadow-fuchsia-500/25";
      }
      if (dLower.includes('อาทิตย์') || dLower.includes('sun')) {
        return theme === 'dark'
          ? "bg-red-500/25 text-red-300 border-red-500/50 shadow-sm shadow-red-500/10"
          : "bg-red-500 text-white border-red-400 shadow-sm shadow-red-500/25";
      }
      return "bg-emerald-500 text-white border-emerald-400";
    } else {
      if (dLower.includes('จันทร์') || dLower.includes('mon')) {
        return theme === 'dark' 
          ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-amber-250 hover:border-amber-500/30"
          : "bg-yellow-50/20 border-slate-150 text-slate-650 hover:bg-yellow-50/50 hover:border-[#F3C51A]/40 hover:text-yellow-800";
      }
      if (dLower.includes('อังคาร') || dLower.includes('tue')) {
        return theme === 'dark' 
          ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-pink-300 hover:border-pink-500/30"
          : "bg-pink-50/20 border-slate-150 text-slate-650 hover:bg-pink-50/50 hover:border-pink-400/40 hover:text-pink-700";
      }
      if (dLower.includes('พุธ') || dLower.includes('wed')) {
        return theme === 'dark' 
          ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-emerald-300 hover:border-emerald-500/30"
          : "bg-emerald-50/20 border-slate-150 text-slate-650 hover:bg-emerald-50/50 hover:border-emerald-450/40 hover:text-emerald-700";
      }
      if (dLower.includes('พฤหัส') || dLower.includes('thu')) {
        return theme === 'dark' 
          ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-orange-300 hover:border-orange-500/30"
          : "bg-orange-50/20 border-slate-150 text-slate-650 hover:bg-orange-50/50 hover:border-orange-400/40 hover:text-orange-850";
      }
      if (dLower.includes('ศุกร์') || dLower.includes('fri')) {
        return theme === 'dark' 
          ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-sky-300 hover:border-sky-500/30"
          : "bg-sky-50/20 border-slate-150 text-slate-650 hover:bg-sky-50/50 hover:border-sky-400/40 hover:text-sky-700";
      }
      if (dLower.includes('เสาร์') || dLower.includes('sat')) {
        return theme === 'dark' 
          ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-fuchsia-300 hover:border-fuchsia-500/30"
          : "bg-fuchsia-50/20 border-slate-150 text-slate-650 hover:bg-fuchsia-50/50 hover:border-fuchsia-400/40 hover:text-fuchsia-700";
      }
      if (dLower.includes('อาทิตย์') || dLower.includes('sun')) {
        return theme === 'dark' 
          ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-red-300 hover:border-red-500/30"
          : "bg-red-50/20 border-slate-150 text-slate-650 hover:bg-red-50/50 hover:border-red-400/40 hover:text-red-700";
      }
      return theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200" : "bg-slate-50 border-slate-150 text-slate-650 hover:bg-slate-100";
    }
  };

  // Color generator based on standard Thai colors of the day of the week
  // Updated for amazing contrast, pure white backgrounds, and highly readable text
  const getDayCardColor = (day: string) => {
    const dLower = (day || '').toLowerCase();
    
    let leftColorClass = 'border-l-indigo-500';
    
    if (dLower.includes('จันทร์') || dLower.includes('mon')) {
      leftColorClass = 'border-l-[#F2D03B]';
    } else if (dLower.includes('อังคาร') || dLower.includes('tue')) {
      leftColorClass = 'border-l-[#EA8EAD]';
    } else if (dLower.includes('พุธ') || dLower.includes('wed')) {
      leftColorClass = 'border-l-[#4AAF7B]';
    } else if (dLower.includes('พฤหัส') || dLower.includes('thu')) {
      leftColorClass = 'border-l-[#E39655]';
    } else if (dLower.includes('ศุกร์') || dLower.includes('fri')) {
      leftColorClass = 'border-l-[#6CA2D3]';
    } else if (dLower.includes('เสาร์') || dLower.includes('sat')) {
      leftColorClass = 'border-l-[#B189C6]';
    } else if (dLower.includes('อาทิตย์') || dLower.includes('sun')) {
      leftColorClass = 'border-l-[#D3605F]';
    }

    return {
      border: `border border-slate-200 border-l ${leftColorClass} shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]`,
      bg: 'bg-white hover:bg-slate-50 dark:bg-white dark:hover:bg-slate-50 transition-all duration-200'
    };
  };

  // Check if a room is being occupied by anyone else in the same day and period
  const getRoomStatus = (day: string, period: string, room: string, currentSubject: string, currentTeacher: string) => {
    if (!room || room === '-' || room.trim() === '') {
      return { occupiesElsewhere: false, othersList: [] as string[] };
    }
    
    // Check all parsed scheduleItems
    const others = scheduleItems.filter(item => 
      item.day === day && 
      item.period === period && 
      item.room.trim().toLowerCase() === room.trim().toLowerCase() &&
      (item.teacher !== currentTeacher || item.subject !== currentSubject)
    );

    return {
      occupiesElsewhere: others.length > 0,
      othersList: others.map(o => `${getShortTeacherName(o.teacher)} (${o.classLevel})`)
    };
  };

  // Day label styling mapping with pastel colors
  const getDayBadgeStyle = (day: string) => {
    const dLower = day.toLowerCase();
    if (dLower.includes('จันทร์') || dLower.includes('mon')) {
      return 'bg-yellow-50 text-amber-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20';
    }
    if (dLower.includes('อังคาร') || dLower.includes('tue')) {
      return 'bg-pink-50 text-pink-750 border-pink-200 dark:bg-pink-500/10 dark:text-pink-400 dark:border-pink-500/20';
    }
    if (dLower.includes('พุธ') || dLower.includes('wed')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
    }
    if (dLower.includes('พฤหัส') || dLower.includes('thu')) {
      return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20';
    }
    if (dLower.includes('ศุกร์') || dLower.includes('fri')) {
      return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20';
    }
    return 'bg-indigo-50 text-indigo-700 border-indigo-150 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20';
  };

  const handleExportExcel = () => {
    const dataToExport = filteredScheduleItems.map(item => ({
      'วัน (Day)': item.day,
      'คาบ (Period)': item.period,
      'เวลา (Time)': item.timeRange,
      'รหัสวิชา (Subject Code)': item.subjectCode || '-',
      'วิชา (Subject)': item.subject,
      'ระดับชั้น/ห้อง (Class)': item.classLevel,
      'ห้องเรียน (Room)': item.room,
      'ครูผู้สอน (Teacher)': item.teacher,
    }));
    
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Teaching Schedule");
    XLSX.writeFile(wb, "Foreign_Schedule.xlsx");
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "printable-schedule rounded-[3rem] overflow-hidden shadow-sm flex flex-col transition-colors border p-6 sm:p-10 gap-8",
        theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200/80 shadow-md shadow-slate-100/40"
      )}
    >
      {/* Print-only Dynamic Header */}
      <div className="hidden print:flex flex-col items-center justify-center text-center pb-6 border-b border-slate-300 w-full mb-4">
        <h2 className="text-2xl font-black text-slate-950">
          {lang === 'th' ? 'ตารางเรียน / ตารางสอน' : 'Teaching & Study Schedule'}
        </h2>
        <p className="text-base font-black text-slate-800 mt-2">
          {(() => {
            const parts = [];
            if (selectedTeacher && selectedTeacher !== 'All') {
              parts.push(lang === 'th' ? `ครูผู้สอน: ${getCleanTeacherName(selectedTeacher)}` : `Teacher: ${getCleanTeacherName(selectedTeacher)}`);
            }
            if (selectedClass && selectedClass !== 'All') {
              parts.push(lang === 'th' ? `ระดับชั้น: ${selectedClass}` : `Grade: ${selectedClass}`);
            }
            if (selectedRoom && selectedRoom !== 'All') {
              parts.push(lang === 'th' ? `ห้องเรียน: ${selectedRoom}` : `Room: ${selectedRoom}`);
            }
            if (selectedDay && selectedDay !== 'All') {
              parts.push(lang === 'th' ? `วันสอน: ${formatDay(selectedDay, lang)}` : `Day: ${formatDay(selectedDay, lang)}`);
            }
            return parts.length > 0 ? parts.join(' | ') : (lang === 'th' ? 'กลุ่มสาระการเรียนรู้ภาษาต่างประเทศ' : 'Foreign Language Department');
          })()}
        </p>
        <span className="text-[10px] text-slate-500 font-mono mt-3">
          {lang === 'th' ? 'พิมพ์เมื่อ: ' : 'Printed at: '} {new Date().toLocaleString(lang === 'th' ? 'th-TH' : 'en-US')}
        </span>
      </div>

      {/* Title Header Block */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 print:hidden">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-[1.2rem] bg-indigo-600 text-white flex items-center justify-center shadow-md">
            <Calendar className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className={cn("text-xl font-black transition-colors flex items-center gap-2", theme === 'dark' ? "text-slate-100" : "text-slate-800")}>
              {lang === 'th' ? 'ตารางสอน' : 'Schedule'}
            </h3>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'th' 
                ? 'ตารางสอนรายบุคคล' 
                : 'Individual Schedule'
              }
            </p>
          </div>
        </div>

        {/* Sync Status Banner */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {!scheduleData && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 text-orange-850 text-[10px] font-black uppercase tracking-widest border border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-900/30">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{lang === 'th' ? 'ตารางตัวอย่าง' : 'Using Demo View'}</span>
            </div>
          )}

          {isTabletOrMobile && (
            <button
              onClick={() => setIsToolbarExpanded(!isToolbarExpanded)}
              className={cn(
                "w-10 h-10 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-95 shadow-md border",
                theme === 'dark'
                  ? "bg-purple-950/50 text-purple-300 border-purple-800/40 hover:bg-purple-900/45"
                  : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
              )}
              title={lang === 'th' ? (isToolbarExpanded ? 'ย่อแถบเครื่องมือ' : 'ขยายแถบเครื่องมือ') : (isToolbarExpanded ? 'Collapse toolbar' : 'Expand toolbar')}
            >
              {isToolbarExpanded ? <ChevronLeft className="w-4 h-4 text-purple-400 animate-pulse" /> : <ChevronRight className="w-4 h-4 text-purple-500 animate-pulse" />}
            </button>
          )}

          <button 
            onClick={onRefresh}
            disabled={loading}
            className={cn(
              "transition-all flex items-center select-none cursor-pointer active:scale-95 border shadow-sm text-xs font-black",
              (!isTabletOrMobile || isToolbarExpanded) 
                ? "p-2.5 px-3.5 rounded-[1.2rem] gap-2" 
                : "w-10 h-10 p-0 rounded-full justify-center",
              theme === 'dark' 
                ? "bg-slate-800 text-slate-300 hover:text-white border-slate-700" 
                : "bg-white text-slate-700 hover:text-slate-950 border-slate-200"
            )}
            title={lang === 'th' ? 'ดึงข้อมูลสด' : 'Refresh Live'}
          >
            <RefreshCw className={cn("w-4 h-4 shrink-0", loading && "animate-spin")} />
            {(!isTabletOrMobile || isToolbarExpanded) && (
              <span className="whitespace-nowrap transition-all duration-350">{lang === 'th' ? 'ดึงข้อมูลสด' : 'Refresh Live'}</span>
            )}
          </button>

          <button 
            onClick={() => window.print()}
            className={cn(
              "transition-all flex items-center select-none cursor-pointer active:scale-95 border shadow-sm text-xs font-black",
              (!isTabletOrMobile || isToolbarExpanded) 
                ? "p-2.5 px-3.5 rounded-[1.2rem] gap-2" 
                : "w-10 h-10 p-0 rounded-full justify-center",
              theme === 'dark' ? "bg-slate-800 text-slate-300 hover:text-white border-slate-700" : "bg-white text-slate-700 hover:text-slate-950 border-slate-200"
            )}
            title={lang === 'th' ? 'พิมพ์ตารางสอน' : 'Print Schedule'}
          >
            <Printer className="w-4 h-4 shrink-0" />
            {(!isTabletOrMobile || isToolbarExpanded) && (
              <span className="whitespace-nowrap transition-all duration-350">{lang === 'th' ? 'พิมพ์ตาราง' : 'Print'}</span>
            )}
          </button>

          <button 
            onClick={exportAsImage}
            disabled={isExportingImg}
            className={cn(
              "transition-all flex items-center select-none cursor-pointer active:scale-95 border shadow-sm text-xs font-black disabled:opacity-50 disabled:pointer-events-none1",
              (!isTabletOrMobile || isToolbarExpanded) 
                ? "p-2.5 px-3.5 rounded-[1.2rem] gap-2" 
                : "w-10 h-10 p-0 rounded-full justify-center",
              theme === 'dark' ? "bg-slate-800 text-slate-300 hover:text-white border-slate-700" : "bg-white text-slate-700 hover:text-slate-950 border-slate-200"
            )}
            title={lang === 'th' ? 'บันทึกตารางสอนเป็นรูปภาพ' : 'Save Schedule as Image'}
          >
            {isExportingImg ? (
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Image className="w-4 h-4 text-pink-500 shrink-0" />
            )}
            {(!isTabletOrMobile || isToolbarExpanded) && (
              <span className="whitespace-nowrap transition-all duration-350">
                {isExportingImg ? (lang === 'th' ? 'กำลังบันทึกรูป...' : 'Saving Image...') : (lang === 'th' ? 'บันทึกรูปภาพ' : 'Save Image')}
              </span>
            )}
          </button>

          <button 
            onClick={exportAsPDF}
            disabled={isExportingPdf}
            className={cn(
              "transition-all flex items-center select-none cursor-pointer active:scale-95 border shadow-sm text-xs font-black disabled:opacity-50 disabled:pointer-events-none",
              (!isTabletOrMobile || isToolbarExpanded) 
                ? "p-2.5 px-3.5 rounded-[1.2rem] gap-2" 
                : "w-10 h-10 p-0 rounded-full justify-center",
              theme === 'dark' ? "bg-slate-800 text-slate-300 hover:text-white border-slate-700" : "bg-white text-slate-700 hover:text-slate-950 border-slate-200"
            )}
            title={lang === 'th' ? 'บันทึกตารางสอนเป็น PDF' : 'Save Schedule as PDF'}
          >
            {isExportingPdf ? (
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
            )}
            {(!isTabletOrMobile || isToolbarExpanded) && (
              <span className="whitespace-nowrap transition-all duration-350">
                {isExportingPdf ? (lang === 'th' ? 'กำลังบันทึก PDF...' : 'Saving PDF...') : (lang === 'th' ? 'บันทึก PDF' : 'Save PDF')}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search and Tab Switcher Controls Group */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full print:hidden">
        {/* Dynamic Tab Switcher bar */}
        <div className={cn(
          "p-1.5 rounded-2xl border transition-colors flex items-center gap-1 sm:gap-1.5 w-full sm:w-auto max-w-full overflow-x-auto custom-scrollbar whitespace-nowrap shrink-0",
          theme === 'dark' ? "bg-slate-950/30 border-slate-800" : "bg-slate-100/80 border-slate-200"
        )}>
          <button
            onClick={() => setActiveTab('schedule')}
            className={cn(
              "px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none shrink-0 whitespace-nowrap",
              activeTab === 'schedule'
                ? (theme === 'dark' ? "bg-pink-550 text-white shadow-md" : "bg-white text-pink-600 shadow-sm border border-pink-100")
                : (theme === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-800")
            )}
          >
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span>
              <span className="sm:hidden">{lang === 'th' ? 'ตารางสอน' : 'Schedule'}</span>
              <span className="hidden sm:inline">{lang === 'th' ? 'ตารางสอนวิชาเรียน' : 'Class Schedule'}</span>
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab('vacancies')}
            className={cn(
              "px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none shrink-0 whitespace-nowrap",
              activeTab === 'vacancies'
                ? (theme === 'dark' ? "bg-pink-550 text-white shadow-md" : "bg-white text-pink-600 shadow-sm border border-pink-100")
                : (theme === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-800")
            )}
          >
            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <span>{lang === 'th' ? 'เช็กวัน/คาบว่าง' : 'Vacancies'}</span>
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('overlay')}
            className={cn(
              "px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none shrink-0 whitespace-nowrap",
              activeTab === 'overlay'
                ? (theme === 'dark' ? "bg-pink-550 text-white shadow-md" : "bg-white text-pink-600 shadow-sm border border-pink-100")
                : (theme === 'dark' ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-800")
            )}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              <span>
                <span className="sm:hidden">{lang === 'th' ? 'แลกคาบ' : 'Swap Class'}</span>
                <span className="hidden sm:inline">{lang === 'th' ? 'เปรียบเทียบ & แลกคาบ' : 'Compare & Swap'}</span>
              </span>
              {appliedSwaps.length > 0 && (
                <span className="inline-flex items-center justify-center bg-pink-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-xs animate-bounce shrink-0">
                  {appliedSwaps.length}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* Search Box (Shortened & Aligned Aside) */}
        {activeTab === 'schedule' && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full sm:max-w-xs self-center sm:self-auto"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-500 dark:text-pink-400" />
            <input 
              type="text"
              placeholder={lang === 'th' ? 'ค้นหาวิชา, ห้องเรียน...' : 'Search classes, room...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "w-full pl-11 pr-5 py-2.5 rounded-2xl text-xs font-bold outline-none border transition-all",
                theme === 'dark' 
                  ? "bg-slate-900 border-slate-800 text-white focus:border-pink-500/80 focus:ring-2 focus:ring-pink-500/10" 
                  : "bg-white border-slate-200 placeholder:text-slate-400 text-slate-800 focus:border-pink-400 focus:ring-4 focus:ring-pink-500/5 shadow-sm"
              )}
            />
          </motion.div>
        )}
      </div>

      {activeTab === 'schedule' ? (
        <div className="flex flex-col gap-6">
          {/* Grid vs List View Controls & Multi Filters Card */}
          <div className={cn(
            "p-4 sm:p-6 rounded-[2rem] border transition-colors flex flex-col gap-6 print:hidden",
            theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200/80 shadow-sm shadow-slate-100/30"
          )}>
            {/* View Mode Switcher */}
            {isAnyFilterActive && (
              <div className="flex justify-end w-full">
                <div className={cn(
                  "flex items-center gap-0.5 p-0.5 rounded-full border shadow-xs shrink-0 scale-95 origin-right",
                  theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-[#f8fafc] border-slate-100"
                )}>
                  <button 
                    onClick={() => setActiveViewMode('grid')}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[9px] font-black transition-all flex items-center gap-1 cursor-pointer select-none active:scale-95",
                      activeViewMode === 'grid' 
                        ? (theme === 'dark' ? "bg-pink-500 text-white shadow-xs" : "bg-white text-pink-600 shadow-xs border border-pink-50") 
                        : (theme === 'dark' ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-700")
                    )}
                  >
                    <Grid3X3 className="w-3 h-3" />
                    <span>{lang === 'th' ? 'แบบตาราง' : 'Grid'}</span>
                  </button>
                  <button 
                    onClick={() => setActiveViewMode('list')}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[9px] font-black transition-all flex items-center gap-1 cursor-pointer select-none active:scale-95",
                      activeViewMode === 'list' 
                        ? (theme === 'dark' ? "bg-pink-500 text-white shadow-xs" : "bg-white text-pink-600 shadow-xs border border-pink-50") 
                        : (theme === 'dark' ? "text-slate-400 hover:text-slate-200" : "text-slate-400 hover:text-slate-700")
                    )}
                  >
                    <List className="w-3 h-3" />
                    <span>{lang === 'th' ? 'แบบรายวิชา' : 'List'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Dropdown Filters row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Teacher Filter */}
              <div className="flex flex-col gap-1.5 animate-fade-in">
                <label className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-450 flex items-center gap-1.5 antialiased">
                  <User className="w-3.5 h-3.5" />
                  <span>{lang === 'th' ? 'ครูผู้สอน' : 'Teacher'}</span>
                </label>
                <div className="relative flex items-center">
                  <select
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    className={cn(
                      "text-xs font-semibold px-4 pr-10 py-2.5 rounded-full border outline-none cursor-pointer transition-all w-full appearance-none",
                      theme === 'dark' 
                        ? "bg-slate-900 border-sky-900/40 text-slate-300 hover:border-sky-700/60 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10" 
                        : "bg-white border-sky-100 text-slate-800 hover:border-sky-250 hover:bg-sky-55/10 focus:border-sky-400 focus:ring-4 focus:ring-sky-500/5 shadow-sm"
                    )}
                  >
                    <option value="All">{lang === 'th' ? 'ครูทุกคน' : 'All Teachers'}</option>
                    {availableTeachers.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Day Filter */}
              <div className="flex flex-col gap-1.5 animate-fade-in">
                <label className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-450 flex items-center justify-between antialiased">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{lang === 'th' ? 'วันสอน' : 'Teaching Day'}</span>
                  </span>
                </label>
                <div className="relative flex items-center">
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className={cn(
                      "text-xs font-semibold px-4 pr-10 py-2.5 rounded-full border outline-none cursor-pointer transition-all w-full appearance-none",
                      theme === 'dark' 
                        ? "bg-slate-900 border-emerald-900/40 text-slate-300 hover:border-emerald-700/60 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10" 
                        : "bg-white border-emerald-100 text-slate-800 hover:border-emerald-250 hover:bg-emerald-55/10 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/5 shadow-sm"
                    )}
                  >
                    <option value="All">{lang === 'th' ? 'ทุกวัน' : 'All Days'}</option>
                    {availableDays.map(d => (
                      <option key={d} value={d}>{formatDay(d, lang)}</option>
                    ))}
                  </select>
                  <div className="absolute right-4 pointer-events-none text-slate-400">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Class Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-pink-600 dark:text-pink-450 flex items-center gap-1.5 antialiased">
                  <Layers className="w-3.5 h-3.5" />
                  <span>{lang === 'th' ? 'ระดับชั้นเรียน' : 'Grade Level'}</span>
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className={cn(
                    "text-xs font-semibold px-4 py-2.5 rounded-full border outline-none cursor-pointer transition-all",
                    theme === 'dark' 
                      ? "bg-slate-900 border-pink-900/40 text-slate-300 hover:border-pink-700/60 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10" 
                      : "bg-white border-pink-100 text-slate-800 hover:border-pink-250 hover:bg-pink-55/10 focus:border-pink-400 focus:ring-4 focus:ring-pink-500/5 shadow-sm"
                  )}
                >
                  <option value="All">{lang === 'th' ? 'ทุกระดับชั้น' : 'All Classes'}</option>
                  {availableClasses.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Room Filter */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 antialiased">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{lang === 'th' ? 'ห้องเรียน' : 'Classroom'}</span>
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className={cn(
                    "text-xs font-semibold px-4 py-2.5 rounded-full border outline-none cursor-pointer transition-all",
                    theme === 'dark' 
                      ? "bg-slate-900 border-indigo-900/40 text-slate-300 hover:border-indigo-700/60 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10" 
                      : "bg-white border-indigo-100 text-slate-800 hover:border-indigo-250 hover:bg-indigo-55/10 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/5 shadow-sm"
                  )}
                >
                  <option value="All">{lang === 'th' ? 'ทุกห้องเรียน' : 'All Rooms'}</option>
                  {availableRooms.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

        {/* Dynamic Content Rendering */}
        <div className="mt-2" id="timetable-capture-area">
          <AnimatePresence mode="wait">
            {!isAnyFilterActive ? (
              /* Choose Filter Elegant Selection Screen */
              <motion.div
                key="choose-filter-prompt"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className={cn(
                  "p-8 sm:p-12 rounded-[2.5rem] border text-center flex flex-col items-center gap-6 shadow-inner",
                  theme === 'dark' ? "bg-slate-950/20 border-slate-800/85" : "bg-pink-50/5 border-pink-101/45"
                )}
              >
                <div className="w-16 h-16 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center shadow-sm">
                  <Search className="w-8 h-8 font-extrabold" />
                </div>
                <div className="flex flex-col gap-2 max-w-lg">
                  <h4 className={cn("text-base sm:text-lg font-black tracking-tight", theme === 'dark' ? "text-slate-100" : "text-slate-800")}>
                    {lang === 'th' ? 'กรุณาเลือกข้อมูลจากตัวกรองด้านบน' : 'Please select a filter above'}
                  </h4>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-400 leading-relaxed">
                    {lang === 'th' 
                      ? 'ตารางสอนจะแสดงผลหลังจากท่านระบุ วันสอน ครูผู้สอน ระดับชั้น หรือห้องเรียนที่ต้องการตรวจสอบด้านบน' 
                      : 'The schedule grid will be revealed once you select any filter option above (Day, Teacher, Class level, or Classroom).'
                    }
                  </p>
                </div>
              </motion.div>
            ) : activeViewMode === 'grid' ? (
            /* Timetable Matrix Grid View */
            <motion.div
              key="grid-schedule"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-x-auto custom-scrollbar"
            >
              <table className="w-full border-collapse min-w-[850px] md:min-w-[960px] lg:min-w-full table-fixed">
                <colgroup>
                  <col className="w-[8%] sm:w-[8%] md:w-[8%]" />
                  <col className="w-[9.2%]" />
                  <col className="w-[9.2%]" />
                  <col className="w-[9.2%]" />
                  <col className="w-[9.2%]" />
                  <col className="w-[9.2%]" />
                  <col className="w-[9.2%]" />
                  <col className="w-[9.2%]" />
                  <col className="w-[9.2%]" />
                  <col className="w-[9.2%]" />
                  <col className="w-[9.2%]" />
                </colgroup>
                <thead>
                  <tr className={cn(
                    "border-b transition-colors",
                    theme === 'dark' ? "border-slate-800" : "border-slate-200"
                  )}>
                    <th className={cn(
                       "p-1.5 sm:p-2.5 text-center text-[10px] sm:text-xs font-black uppercase tracking-wider sm:tracking-widest leading-none pb-4",
                      theme === 'dark' ? "text-slate-400" : "text-slate-800"
                    )}>
                      {lang === 'th' ? 'วัน/คาบ' : 'Day / Period'}
                    </th>
                    {periodsRange.map(periodNum => {
                      const isPeriodActive = daysRange.some(d => isItemCurrentlyOngoing(d, getPeriodTimeRange(periodNum)));
                      return (
                        <th key={periodNum} className={cn("text-center pb-3 p-1 transition-all duration-300", isPeriodActive && "bg-emerald-500/5")}>
                          <span className={cn(
                            "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] sm:text-[11px] font-black mb-1 transition-all duration-300",
                            isPeriodActive
                              ? "bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/30 animate-pulse"
                              : (theme === 'dark' ? "bg-slate-800 text-pink-400" : "bg-pink-50 text-pink-600")
                          )}>
                            {periodNum}
                          </span>
                          <div className={cn(
                            "text-[8px] sm:text-[9px] font-mono transition-all duration-300",
                            isPeriodActive 
                              ? "text-emerald-600 dark:text-emerald-400 font-black" 
                              : "font-semibold text-slate-400"
                          )}>
                            {getPeriodTimeRange(periodNum)}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {daysRange.map(dayName => {
                    return (
                      <tr key={dayName} className={cn(
                        "border-b transition-colors hover:bg-slate-50/5",
                        theme === 'dark' ? "border-slate-800" : "border-slate-100"
                      )}>
                        {/* Day Cell badges */}
                        <td className="p-1 sm:p-2 align-middle text-center font-bold">
                          <span className={cn(
                            "inline-block px-1.5 py-1 rounded-lg text-[8.5px] sm:text-[10px] font-black border shadow-xs truncate max-w-full",
                            getDayBadgeStyle(dayName)
                          )}>
                            {formatDay(dayName, lang)}
                          </span>
                        </td>

                        {/* Period Slots */}
                        {periodsRange.map(periodNum => {
                          const slotItems = filteredScheduleItems.filter(item => 
                            item.day === dayName && item.period === periodNum
                          );
                          const isOngoingCell = isItemCurrentlyOngoing(dayName, getPeriodTimeRange(periodNum));

                          return (
                            <td 
                              key={periodNum} 
                              className={cn(
                                "p-0.5 sm:p-1 align-top transition-all duration-300 relative rounded-lg",
                                isOngoingCell && "bg-emerald-500/10 dark:bg-emerald-400/10 ring-2 ring-emerald-500 dark:ring-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.25)] z-10 scale-[1.01]"
                              )}
                            >
                              {isOngoingCell && (
                                <div className="absolute -top-1 right-0.5 flex items-center gap-0.5 bg-emerald-600 text-white font-extrabold text-[7px] leading-none px-1.5 py-0.5 rounded-full shadow-md animate-bounce z-20">
                                  <span className="w-1 h-1 rounded-full bg-white inline-block animate-ping" />
                                  <span>{lang === 'th' ? "ตอนนี้" : "NOW"}</span>
                                </div>
                              )}
                              {slotItems.length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {slotItems.map((slot, sIdx) => {
                                    const designColors = getDayCardColor(dayName);
                                    return (
                                      <motion.div
                                        key={sIdx}
                                        whileHover={{ y: -3, scale: 1.04 }}
                                        className={cn(
                                          "p-1 md:p-1.5 rounded-lg flex flex-col gap-0.5 transition-all shadow-sm hover:shadow-md text-left relative overflow-hidden w-full group duration-200",
                                          isOngoingCell
                                            ? "border-2 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40"
                                            : `${designColors.border} ${designColors.bg}`
                                        )}
                                      >
                                        {/* Subtle reflected light beam sweep */}
                                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-700 ease-out pointer-events-none" />

                                        <div className="flex flex-col gap-0.5">
                                          <div className="text-[9.5px] md:text-[11px] font-black tracking-tight leading-none truncate text-[#0F172A] dark:text-[#0F172A]" title={slot.subjectCode || slot.subject}>
                                            {getSubjectCodeOnly(slot.subject, slot.subjectCode)}
                                          </div>
                                        </div>
                                        
                                        <div className="flex flex-col gap-0.5 mt-0.5 border-t border-slate-100 dark:border-slate-150 pt-0.5">
                                          {slot.teacher && slot.teacher !== 'Unassigned' && (
                                            <div className="flex items-center gap-1 text-[8.5px] md:text-[9.5px] font-bold text-[#1E293B] dark:text-[#1E293B] leading-none mb-0.5">
                                              <User className="w-2 h-2 shrink-0 text-[#64748B] dark:text-[#64748B] hidden lg:block" />
                                              <span className="truncate">{getShortTeacherName(slot.teacher)}</span>
                                            </div>
                                          )}
                                        </div>
                                          
                                          <div className="flex items-center justify-between gap-1 text-[8px] md:text-[9px] font-extrabold text-[#475569] dark:text-[#475569] mt-0.5">
                                            <div className="flex items-center gap-0.5 shrink-0">
                                              <Layers className="w-2 h-2 shrink-0 text-[#64748B] dark:text-[#64748B] hidden lg:block" />
                                              <span className="truncate">{slot.classLevel}</span>
                                            </div>
                                            {slot.room && slot.room !== '-' && (() => {
                                              const isTeacherActive = slot.teacher && slot.teacher !== 'Unassigned' && slot.teacher.trim() !== '';
                                              return (
                                                <div 
                                                  className={cn(
                                                    "flex items-center gap-0.5 px-1 py-0.5 md:px-1.5 rounded-md text-[8px] md:text-[8.5px] font-black shrink-0 transition-all shadow-xs",
                                                    isTeacherActive 
                                                      ? "bg-red-50 text-red-800 dark:bg-red-50 dark:text-red-800" 
                                                      : "bg-emerald-50 text-emerald-800 dark:bg-emerald-50 dark:text-emerald-800"
                                                  )}
                                                >
                                                  <MapPin className={cn("w-2 h-2 shrink-0 hidden lg:block", isTeacherActive ? "text-red-550" : "text-emerald-650")} />
                                                  <span className="truncate max-w-[28px] sm:max-w-[42px]">{slot.room}</span>
                                                </div>
                                              );
                                            })()}
                                          </div>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          ) : (
            /* Detailed Compact List View */
            <motion.div
              key="list-schedule"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
            >
              {filteredScheduleItems.length > 0 ? (
                filteredScheduleItems.map((item, index) => {
                  const colors = getDayCardColor(item.day);
                  const isOngoing = isItemCurrentlyOngoing(item.day, item.timeRange);
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      whileHover={{ scale: 1.025, y: -4 }}
                      className={cn(
                        "rounded-[1.8rem] p-5 shadow-sm hover:shadow-xl hover:border-purple-300 dark:hover:border-purple-700/80 flex flex-col gap-4 relative overflow-hidden transition-all group duration-300",
                        colors.border,
                        colors.bg,
                        isOngoing && "ring-2 ring-pink-500/25 dark:ring-pink-400/35 border-pink-400 dark:border-pink-800 shadow-md shadow-pink-500/10 bg-[#ffeef2]/10"
                      )}
                    >
                      {/* Premium Ambient Glass Light Reflection Beam */}
                      <span className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-out pointer-events-none" />

                      {/* Top Header Row of card */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex flex-col gap-1">
                           <span className={cn(
                            "inline-block px-2.5 py-1 rounded-full text-[9px] font-black border align-middle leading-none w-max shadow-sm",
                            getDayBadgeStyle(item.day)
                          )}>
                            {formatDay(item.day, lang)}
                          </span>
                          <span className={cn(
                            "text-[10px] font-mono font-bold mt-1 transition-colors",
                            isOngoing ? "text-pink-600 dark:text-pink-400" : "text-slate-500"
                          )}>
                            {lang === 'th' ? `คาบที่ ${item.period}` : `Period ${item.period}`} • {item.timeRange}
                          </span>
                        </div>
                        <span className={cn(
                          "text-[9.5px] font-black px-2.5 py-1 rounded-full whitespace-nowrap border border-pink-100 bg-pink-50 text-pink-650 shadow-xs"
                        )}>
                          {item.classLevel}
                        </span>
                      </div>

                      {/* Course Subject Code Only */}
                      <div className="flex items-start gap-2.5">
                        <div className="flex flex-col gap-0.5 w-full">
                          <p className={cn("text-xs font-black leading-tight font-mono text-pink-650")}>
                            {getSubjectCodeOnly(item.subject, item.subjectCode)}
                          </p>
                          {item.teacher && item.teacher !== 'Unassigned' && (
                            <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-550 dark:text-slate-400 mt-1">
                              <span>{lang === 'th' ? 'ผู้สอน: ' : 'Instructor: '}{getCleanTeacherName(item.teacher)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Line Separator */}
                      <div className={cn("h-[1px] w-full bg-[#f1f5f9]")} />

                      {/* Footer Row */}
                      <div className="flex items-center justify-between gap-3 text-xs font-extrabold text-[#1E293B] mt-auto">
                        {(() => {
                          const statusInfo = getWorkStatus(item);
                          return (
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-black tracking-wide uppercase transition-colors shadow-xs border",
                                statusInfo.badgeClass
                              )}>
                                {statusInfo.text}
                              </span>
                            </div>
                          );
                        })()}
                        
                        {item.room && item.room !== '-' && (() => {
                           const isTeacherActive = item.teacher && item.teacher !== 'Unassigned' && item.teacher.trim() !== '';
                           return (
                             <div 
                               className={cn(
                                 "flex items-center px-2.5 py-1 rounded-full text-[9px] font-black transition-all shadow-xs border",
                                 isTeacherActive
                                   ? "bg-red-50 text-red-850 border-red-100"
                                   : "bg-emerald-50 text-emerald-850 border-emerald-100"
                               )}
                             >
                               <span>{lang === 'th' ? `ห้อง: ${item.room}` : `Room: ${item.room}`}</span>
                             </div>
                           );
                        })()}
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                <div className="md:col-span-2 xl:col-span-3 flex flex-col items-center justify-center py-20 text-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-100 flex items-center justify-center text-slate-400">
                    <Search className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-slate-400">
                    {lang === 'th' ? 'ไม่พบข้อมูลตารางสอนตามตัวกรอง' : 'No schedules found matching filter'}
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
    ) : activeTab === 'vacancies' ? (
        /* Brand new gorgeous Vacancy Finder dashboard */
        <div className="flex flex-col gap-6">
          <div className={cn(
            "p-6 sm:p-8 rounded-[2rem] border transition-colors flex flex-col gap-8",
            theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200/80 shadow-md shadow-slate-100/30"
          )}>

            {/* Inputs: Day Select (Buttons) & Period (Buttons) */}
            <div className="flex flex-col gap-6">
              {/* Academic Weekly Calendar Day Picker */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-8 h-8 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        {lang === 'th' ? '๑. เลือกวัน' : '1. Select Day'}
                      </span>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">
                        {lang === 'th' ? 'ตรวจสอบคาบเรียนและห้องว่าง' : 'Check immediate vacancy details'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Calendar details badge */}
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-150 dark:border-slate-800.5 px-3 py-1.5 rounded-full select-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      {lang === 'th' ? 'สัปดาห์ปัจจุบัน (พ.ค. 2026)' : 'Active Week (May 2026)'}
                    </span>
                  </div>
                </div>

                {/* Elegant Interactive Weekly Cards Grid */}
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-5 gap-3 w-full">
                  {daysRange.map(dayName => {
                    const isSelected = currentVacancyDay === dayName;
                    const dateInfo = dateInfoMap[dayName] || {
                      dateNumber: 20,
                      monthName: lang === 'th' ? 'พ.ค.' : 'May',
                      isToday: false,
                      dayShort: dayName.substring(0, 3)
                    };
                    const colors = getDayCalendarTheme(dayName);

                    return (
                      <motion.button
                        key={dayName}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setVacancyDay(dayName)}
                        className={cn(
                          "relative flex flex-col items-center justify-between p-3.5 rounded-2xl border text-center transition-all cursor-pointer select-none h-28 overflow-hidden group/card",
                          isSelected
                            ? colors.selectedClass
                            : colors.unselectedClass,
                          dateInfo.isToday ? "ring-2 ring-emerald-500/70 border-emerald-400" : ""
                        )}
                      >
                        {/* Background subtle indicator circle */}
                        {isSelected && (
                          <div className={cn(
                            "absolute -top-6 -right-6 w-12 h-12 rounded-full opacity-10 transition-transform duration-500 scale-150 pointer-events-none",
                            colors.dot
                          )} />
                        )}

                        {/* Short Day Name */}
                        <span className="text-[10px] font-black tracking-widest uppercase opacity-70">
                          {dateInfo.dayShort}
                        </span>

                        {/* Elegant prominent Date Number */}
                        <div className="flex flex-col items-center my-1">
                          <span className={cn(
                            "text-2xl font-black font-mono leading-none tracking-tight",
                            isSelected ? "scale-105" : ""
                          )}>
                            {dateInfo.dateNumber}
                          </span>
                          
                          {dateInfo.isToday && (
                            <span className="text-[7.5px] font-black tracking-widest uppercase px-1.5 bg-emerald-500 text-white rounded-md mt-1 scale-90">
                              {lang === 'th' ? 'วันนี้' : 'TODAY'}
                            </span>
                          )}
                        </div>

                        {/* Dot indicator and full month */}
                        <div className="flex items-center gap-1.5">
                          <span className={cn("w-2 h-2 rounded-full shadow-xs border border-white dark:border-slate-900", colors.dot)} />
                          <span className="text-[8.5px] font-black tracking-wider uppercase opacity-65">
                            {dateInfo.monthName}
                          </span>
                        </div>

                        {/* Calendar Page Top Ring accents */}
                        <div className="absolute top-0 inset-x-0 h-1 flex justify-center gap-1.5 opacity-40 pointer-events-none">
                          <span className="w-1.5 h-1.5 rounded-b-sm bg-slate-300 dark:bg-slate-700" />
                          <span className="w-1.5 h-1.5 rounded-b-sm bg-slate-300 dark:bg-slate-700" />
                          <span className="w-1.5 h-1.5 rounded-b-sm bg-slate-300 dark:bg-slate-700" />
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Period selection row (Pill Buttons) */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-455">
                  {lang === 'th' ? '๒. เลือกคาบเรียน' : '2. Choose Period'}
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-2">
                  {periodsRange.map(periodNum => {
                    const isSelected = vacancyPeriod === periodNum;
                    
                    // Period time mapping 
                    const periodTime = getPeriodTimeRange(periodNum);

                    return (
                      <button
                        key={periodNum}
                        onClick={() => setVacancyPeriod(periodNum)}
                        className={cn(
                          "px-3 py-3 rounded-2xl text-center transition-all cursor-pointer select-none active:scale-95 border flex flex-col items-center justify-center gap-1",
                          isSelected
                            ? "bg-sky-500 text-white border-sky-400 shadow-sm shadow-sky-500/20"
                            : (theme === "dark" ? "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200" : "bg-slate-50 border-slate-150 text-slate-650 hover:bg-slate-100/80 hover:text-slate-900")
                        )}
                      >
                        <span className="text-xs font-black">{lang === "th" ? `คาบ ${periodNum}` : `p. ${periodNum}`}</span>
                        <span className="text-[8.5px] opacity-75 font-mono font-medium">{periodTime}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Results: Split Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1. Vacant Teachers card */}
            <div className={cn(
              "p-6 sm:p-8 rounded-[2rem] border transition-colors flex flex-col gap-6",
              theme === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200/80 shadow-md shadow-slate-100/40"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 font-bold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className={cn("text-[10.5px] xs:text-xs md:text-[11px] lg:text-xs xl:text-sm font-black truncate whitespace-nowrap", theme === "dark" ? "text-slate-100" : "text-slate-800")}>
                      {lang === "th" ? "ครูที่ว่าง" : "Vacant Teachers"}
                    </h5>
                    <p className="text-[9.5px] font-bold text-slate-400 truncate whitespace-nowrap">
                      {lang === "th" 
                        ? `รวม ${vacanciesData.vacantTeachers.length} ท่าน`
                        : `${vacanciesData.vacantTeachers.length} available`
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-[250px] overflow-y-auto custom-scrollbar pr-1">
                {vacanciesData.vacantTeachers.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {vacanciesData.vacantTeachers.map(teacher => {
                      const cleanName = getCleanTeacherName(teacher);
                      const initials = cleanName.substring(0, 2).toUpperCase();
                      return (
                        <div 
                          key={teacher}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-2xl border transition-all min-w-0 overflow-hidden",
                            theme === "dark" ? "bg-slate-900/60 border-slate-800 text-slate-200" : "bg-emerald-50/10 border-emerald-100/50 text-slate-800"
                          )}
                        >
                          <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-[9px] shadow-inner shrink-0">
                            {initials}
                          </div>
                          <span 
                            className="text-[10px] xs:text-xs md:text-[10.5px] lg:text-xs font-extrabold truncate whitespace-nowrap min-w-0 flex-1 leading-none"
                            title={cleanName}
                          >
                            {cleanName}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                    <AlertCircle className="w-6 h-6 text-orange-500" />
                    <span className="text-xs font-bold text-slate-400">
                      {lang === "th" ? "ไม่มีครูต่างชาติว่างในคาบนี้" : "No vacant teachers found for this period"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Vacant Rooms card */}
            <div className={cn(
              "p-6 sm:p-8 rounded-[2rem] border transition-colors flex flex-col gap-6",
              theme === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200/80 shadow-md shadow-slate-100/40"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 font-bold" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className={cn("text-[10.5px] xs:text-xs md:text-[11px] lg:text-xs xl:text-sm font-black truncate whitespace-nowrap", theme === "dark" ? "text-slate-100" : "text-slate-800")}>
                      {lang === "th" ? "ห้องเรียนที่ว่าง" : "Vacant Rooms"}
                    </h5>
                    <p className="text-[9.5px] font-bold text-slate-400 truncate whitespace-nowrap">
                      {lang === "th" 
                        ? `รวม ${vacanciesData.vacantRooms.length} ห้อง`
                        : `${vacanciesData.vacantRooms.length} available`
                      }
                    </p>
                  </div>
                </div>
              </div>

              <div className="h-[250px] overflow-y-auto custom-scrollbar pr-1">
                {vacanciesData.vacantRooms.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {vacanciesData.vacantRooms.map(room => (
                      <div 
                        key={room}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl border transition-all",
                          theme === "dark" ? "bg-slate-900/60 border-slate-800 text-slate-200" : "bg-indigo-50/10 border-indigo-100/50 text-slate-800"
                        )}
                      >
                        <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-[10px] shadow-inner shrink-0">
                          RM
                        </div>
                        <span className="text-xs font-black truncate">{room}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center gap-3">
                    <AlertCircle className="w-6 h-6 text-orange-500" />
                    <span className="text-xs font-bold text-slate-400">
                      {lang === "th" ? "ไม่มีห้องเรียนว่างในคาบนี้" : "No vacant rooms found for this period"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (() => {
        // High-fidelity validation logic within local scope
        const getSwapValidation = (
          swapType: "teacher" | "time",
          item1: ScheduleItem | null,
          day1: string,
          period1: string,
          item2: ScheduleItem | null,
          day2: string,
          period2: string,
          tA: string,
          tB: string,
          currentItems: ScheduleItem[]
        ) => {
          const problems: string[] = [];

          if (swapType === "teacher") {
            if (item2 && tA) {
              const tAClash = currentItems.find(item => 
                item.teacher === tA &&
                item.day === day2 &&
                item.period === period2 &&
                !(item.subjectCode === item2.subjectCode && item.classLevel === item2.classLevel && item.room === item2.room)
              );
              if (tAClash) {
                problems.push(lang === "th" 
                  ? `ครู ${getCleanTeacherName(tA)} ติดสอนวิชา ${tAClash.subjectCode} (${tAClash.classLevel}) ที่ห้อง ${tAClash.room} ในคาบดังกล่าวอยู่แล้ว`
                  : `Teacher ${getCleanTeacherName(tA)} is already teaching ${tAClash.subjectCode} (${tAClash.classLevel}) in room ${tAClash.room} during that period`
                );
              }
            }

            if (item1 && tB) {
              const tBClash = currentItems.find(item => 
                item.teacher === tB &&
                item.day === day1 &&
                item.period === period1 &&
                !(item.subjectCode === item1.subjectCode && item.classLevel === item1.classLevel && item.room === item1.room)
              );
              if (tBClash) {
                problems.push(lang === "th"
                  ? `ครู ${getCleanTeacherName(tB)} ติดสอนวิชา ${tBClash.subjectCode} (${tBClash.classLevel}) ที่ห้อง ${tBClash.room} ในคาบดังกล่าวอยู่แล้ว`
                  : `Teacher ${getCleanTeacherName(tB)} is already teaching ${tBClash.subjectCode} (${tBClash.classLevel}) in room ${tBClash.room} during that period`
                );
              }
            }
          } else {
            // Time relocation check
            if (item1) {
              // 1. Teacher clash at target period
              const tAClash = currentItems.find(item => 
                item.teacher === item1.teacher &&
                item.day === day2 &&
                item.period === period2 &&
                item !== item1 && item !== item2
              );
              if (tAClash) {
                problems.push(lang === "th"
                  ? `ครู ${getCleanTeacherName(item1.teacher)} มีภาระสอนวิชาอื่น (${tAClash.subjectCode}) ในคาบเรียนปลายทางอยู่แล้ว`
                  : `${getCleanTeacherName(item1.teacher)} is already scheduled to teach (${tAClash.subjectCode}) in target period`
                );
              }

              // 2. Class Level clash at target period (Students overlap)
              const classClash = currentItems.find(item => 
                item.classLevel === item1.classLevel &&
                item.day === day2 &&
                item.period === period2 &&
                item !== item1 && item !== item2
              );
              if (classClash) {
                problems.push(lang === "th"
                  ? `นักเรียนชั้น ${item1.classLevel} มีเรียนวิชาอื่น (${classClash.subjectCode}) ในคาบเรียนปลายทางอยู่แล้ว`
                  : `Class level ${item1.classLevel} is already scheduled to study (${classClash.subjectCode}) in target period`
                );
              }

              // 3. Room clash at target period
              const roomClash = currentItems.find(item => 
                item.room === item1.room &&
                item.day === day2 &&
                item.period === period2 &&
                item.room !== "-" && item !== item1 && item !== item2
              );
              if (roomClash) {
                problems.push(lang === "th"
                  ? `ห้องเรียน ${item1.room} ถูกใช้งานโดยวิชา ${roomClash.subjectCode} ในคาบเรียนปลายทางอยู่แล้ว`
                  : `Room ${item1.room} is already occupied by ${roomClash.subjectCode} in target period`
                );
              }
            }

            if (item2) {
              // 1. Teacher B clash at source period
              const tBClash = currentItems.find(item => 
                item.teacher === item2.teacher &&
                item.day === day1 &&
                item.period === period1 &&
                item !== item1 && item !== item2
              );
              if (tBClash) {
                problems.push(lang === "th"
                  ? `ครู ${getCleanTeacherName(item2.teacher)} มีภาระสอนวิชาอื่น (${tBClash.subjectCode}) ในคาบเรียนต้นทางอยู่แล้ว`
                  : `${getCleanTeacherName(item2.teacher)} is already scheduled to teach (${tBClash.subjectCode}) in source period`
                );
              }

              // 2. Class level clash at source period
              const classClash = currentItems.find(item => 
                item.classLevel === item2.classLevel &&
                item.day === day1 &&
                item.period === period1 &&
                item !== item1 && item !== item2
              );
              if (classClash) {
                problems.push(lang === "th"
                  ? `นักเรียนชั้น ${item2.classLevel} มีเรียนวิชาอื่น (${classClash.subjectCode}) ในคาบเรียนต้นทางอยู่แล้ว`
                  : `Class level ${item2.classLevel} is already scheduled to study (${classClash.subjectCode}) in source period`
                );
              }

              // 3. Room clash at source period
              const roomClash = currentItems.find(item => 
                item.room === item2.room &&
                item.day === day1 &&
                item.period === period1 &&
                item.room !== "-" && item !== item1 && item !== item2
              );
              if (roomClash) {
                problems.push(lang === "th"
                  ? `ห้องเรียน ${item2.room} ถูกใช้งานโดยวิชา ${roomClash.subjectCode} ในคาบเรียนต้นทางอยู่แล้ว`
                  : `Room ${item2.room} is already occupied by ${roomClash.subjectCode} in source period`
                );
              }
            }
          }

          return problems;
        };

        return (
          /* Schedule Overlay & Swap Simulator layout */
          <div className="flex flex-col gap-8 text-left">
            {/* Header Sandbox intro card */}
            <div className={cn(
              "p-6 sm:p-8 rounded-[2rem] border transition-colors flex flex-col md:flex-row items-center justify-between gap-6",
              theme === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200/80 shadow-md shadow-slate-100/35"
            )}>
              <div className="flex items-center gap-4 text-left">
                <div className="w-12 h-12 rounded-[1.2rem] bg-pink-500/10 text-pink-550 flex items-center justify-center shrink-0">
                  <ArrowLeftRight className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h4 className={cn("text-lg font-black transition-colors", theme === "dark" ? "text-slate-100" : "text-slate-850")}>
                    {lang === "th" ? "เทียบและสลับคาบเรียน" : "Overlay & Swap"}
                  </h4>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
                    {lang === "th" 
                      ? "ตรวจเช็กตารางชน คลาสเรียนซ้ำ และจำลองแลกคาบแบบเรียลไทม์" 
                      : "Compare timetables, detect clashes, and simulate swaps in real-time."
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3.5 py-1.5 rounded-full border border-pink-200 bg-pink-50 text-pink-700 text-[10px] font-black uppercase tracking-wider dark:bg-pink-955/20 dark:text-pink-300 dark:border-pink-900/30">
                  {lang === "th" ? "โหมดจำลองพิกัด" : "Sandbox Mode"}
                </div>
              </div>
            </div>

            {/* Teacher Selection Row */}
            <div className={cn(
              "p-4 sm:p-5 md:p-6 rounded-2xl md:rounded-[2rem] border transition-all flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 w-full max-w-4xl mx-auto",
              theme === "dark" ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-205 shadow-sm shadow-slate-100/50"
            )}>
              <div className="flex flex-col gap-1 w-full sm:flex-1 max-w-full sm:max-w-[280px]">
                <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-450 truncate">
                  {lang === "th" ? "ครูผู้สอนท่านแรก (ครู A)" : "First Teacher (A)"}
                </label>
                <div className="relative">
                  <select
                    value={teacherA}
                    onChange={(e) => {
                      setTeacherA(e.target.value);
                      setAppliedSwaps([]); // Clear when teacher changes to avoid stale references
                    }}
                    className={cn(
                      "w-full px-3.5 py-2 pr-10 rounded-xl border font-bold text-[11px] sm:text-xs outline-none transition-all cursor-pointer truncate appearance-none",
                      theme === "dark" 
                        ? "bg-slate-900 border-slate-800 text-white focus:border-pink-500" 
                        : "bg-slate-50/50 border-slate-200 text-slate-800 focus:border-pink-400 focus:ring-4 focus:ring-pink-500/5 shadow-xs"
                    )}
                  >
                    {availableTeachers.map(t => (
                      <option key={t} value={t} className="text-xs">{getCleanTeacherName(t)}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  const temp = teacherA;
                  setTeacherA(teacherB);
                  setTeacherB(temp);
                  setAppliedSwaps([]); // Clear swaps as assignments are flipped
                }}
                className={cn(
                  "p-2.5 sm:p-3 rounded-full border shadow-sm cursor-pointer select-none transition-all active:scale-95 hover:bg-slate-50 dark:hover:bg-slate-850 shrink-0",
                  theme === "dark" ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-200 text-slate-650"
                )}
                title={lang === "th" ? "สลับตำแหน่งครู" : "Swap Positions"}
              >
                <ArrowLeftRight className="w-3.5 h-3.5 rotate-90 sm:rotate-0" />
              </button>

              <div className="flex flex-col gap-1 w-full sm:flex-1 max-w-full sm:max-w-[280px]">
                <label className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-450 truncate">
                  {lang === "th" ? "ครูผู้สอนท่านที่สอง (ครู B)" : "Second Teacher (B)"}
                </label>
                <div className="relative">
                  <select
                    value={teacherB}
                    onChange={(e) => {
                      setTeacherB(e.target.value);
                      setAppliedSwaps([]); // Clear swaps in sandbox
                    }}
                    className={cn(
                      "w-full px-3.5 py-2 pr-10 rounded-xl border font-bold text-[11px] sm:text-xs outline-none transition-all cursor-pointer truncate appearance-none",
                      theme === "dark" 
                        ? "bg-slate-900 border-slate-800 text-white focus:border-pink-500" 
                        : "bg-slate-50/50 border-slate-200 text-slate-800 focus:border-pink-400 focus:ring-4 focus:ring-pink-500/5 shadow-xs"
                    )}
                  >
                    {availableTeachers.map(t => (
                      <option key={t} value={t} className="text-xs">{getCleanTeacherName(t)}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Comparative Grids Area (Responsive) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Grid for Teacher A */}
              <div className="flex flex-col gap-3 min-w-0">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                    <span className="text-sm font-black text-slate-850 dark:text-slate-150 truncate">
                      {lang === "th" ? `ตารางสอนจำลองครู A: ${getCleanTeacherName(teacherA)}` : `Virtual Timetable A: ${getCleanTeacherName(teacherA)}`}
                    </span>
                  </div>
                  <span className="text-[9.5px] font-mono text-slate-400 font-bold">GRID A</span>
                </div>

                <div className="overflow-x-auto rounded-[1.8rem] border border-slate-200/60 dark:border-slate-800/80 custom-scrollbar shadow-xs">
                  <table className="w-full text-left border-collapse table-fixed min-w-[650px]">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-150/60 dark:border-slate-850">
                        <th className="w-20 font-black text-[10px] uppercase tracking-wider text-slate-400 p-2.5 md:p-3">{lang === "th" ? "วัน" : "Day"}</th>
                        {periodsRange.map(periodNum => (
                          <th key={periodNum} className="text-center font-black text-[10px] uppercase tracking-wider text-slate-400 p-1">
                            <div>{lang === "th" ? `คาบ ${periodNum}` : `P ${periodNum}`}</div>
                            <div className="text-[7.5px] font-mono font-bold text-slate-400 leading-none mt-0.5">{getPeriodTimeRange(periodNum)}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {daysRange.map(dayName => (
                        <tr key={dayName} className="border-b border-slate-100/50 dark:border-slate-850/50 last:border-b-0 hover:bg-slate-50/35 dark:hover:bg-slate-900/10 transition-colors">
                          <td className="p-2 md:p-3 font-black text-[10.5px] text-slate-650 dark:text-slate-400">
                            {dayName.replace("วัน", "")}
                          </td>
                          {periodsRange.map(periodNum => {
                            const item = simulatedScheduleItems.find(it => it.teacher === teacherA && it.day === dayName && it.period === periodNum);
                            const isSelectedSlot = selectedSwapDay1 === dayName && selectedSwapPeriod1 === periodNum;
                            
                            return (
                              <td 
                                key={periodNum}
                                onClick={() => {
                                  setSelectedSwapDay1(dayName);
                                  setSelectedSwapPeriod1(periodNum);
                                }}
                                className={cn(
                                  "p-1 h-14 md:h-16 transition-all border-r border-slate-50 dark:border-slate-850/30 last:border-r-0 cursor-pointer select-none relative",
                                  isSelectedSlot ? "bg-indigo-500/10 ring-2 ring-indigo-500 ring-inset" : "hover:bg-indigo-500/5"
                                )}
                              >
                                {isSelectedSlot && (
                                  <div className="absolute top-1.5 right-1.5 bg-indigo-600 text-white font-black text-[8px] px-1.5 py-0.5 rounded-full flex items-center justify-center shadow-md shadow-indigo-600/20 z-10 animate-bounce">
                                    A
                                  </div>
                                )}
                                {item ? (
                                  <div className="flex flex-col justify-between h-full bg-indigo-50/60 border border-indigo-200 text-indigo-900 rounded-lg p-1.5 overflow-hidden text-left shadow-2xs">
                                    <div className="text-[10px] font-black leading-tight truncate" title={item.subject}>{getSubjectCodeOnly(item.subject, item.subjectCode)}</div>
                                    <div className="flex items-center justify-between text-[8px] font-extrabold text-slate-500 mt-1 gap-1">
                                      <span className="truncate">{item.classLevel}</span>
                                      <span className="bg-white/90 border border-indigo-100 px-0.5 rounded leading-none shrink-0 truncate max-w-[30px]">{item.room}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-full border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-[8.5px] font-bold">
                                    {lang === 'th' ? 'ว่าง' : 'Vacant'}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[9px] font-bold text-slate-400 mt-0.5 ml-2">💡 {lang === 'th' ? 'คลิกที่ช่องตารางครู A เพื่อระบุพิกัดสลับในกล่องเครื่องมือทันที' : 'Click slots in Grid A to automatically fill Teacher A coordinates in simulator.'}</p>
              </div>

              {/* Grid for Teacher B */}
              <div className="flex flex-col gap-3 min-w-0">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-pink-500 shrink-0" />
                    <span className="text-sm font-black text-slate-850 dark:text-slate-150 truncate">
                      {lang === 'th' ? `ตารางสอนจำลองครู B: ${getCleanTeacherName(teacherB)}` : `Virtual Timetable B: ${getCleanTeacherName(teacherB)}`}
                    </span>
                  </div>
                  <span className="text-[9.5px] font-mono text-slate-400 font-bold">GRID B</span>
                </div>

                <div className="overflow-x-auto rounded-[1.8rem] border border-slate-200/60 dark:border-slate-800/80 custom-scrollbar shadow-xs">
                  <table className="w-full text-left border-collapse table-fixed min-w-[650px]">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-150/60 dark:border-slate-850">
                        <th className="w-20 font-black text-[10px] uppercase tracking-wider text-slate-400 p-2.5 md:p-3">{lang === 'th' ? 'วัน' : 'Day'}</th>
                        {periodsRange.map(periodNum => (
                          <th key={periodNum} className="text-center font-black text-[10px] uppercase tracking-wider text-slate-400 p-1">
                            <div>{lang === 'th' ? `คาบ ${periodNum}` : `P ${periodNum}`}</div>
                            <div className="text-[7.5px] font-mono font-bold text-slate-400 leading-none mt-0.5">{getPeriodTimeRange(periodNum)}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {daysRange.map(dayName => (
                        <tr key={dayName} className="border-b border-slate-100/50 dark:border-slate-850/50 last:border-b-0 hover:bg-slate-50/35 dark:hover:bg-slate-900/10 transition-colors">
                          <td className="p-2 md:p-3 font-black text-[10.5px] text-slate-650 dark:text-slate-400">
                            {dayName.replace('วัน', '')}
                          </td>
                          {periodsRange.map(periodNum => {
                            const item = simulatedScheduleItems.find(it => it.teacher === teacherB && it.day === dayName && it.period === periodNum);
                            const isSelectedSlot = selectedSwapDay2 === dayName && selectedSwapPeriod2 === periodNum;
                            
                            return (
                              <td 
                                key={periodNum}
                                onClick={() => {
                                  setSelectedSwapDay2(dayName);
                                  setSelectedSwapPeriod2(periodNum);
                                }}
                                className={cn(
                                  "p-1 h-14 md:h-16 transition-all border-r border-slate-50 dark:border-slate-850/30 last:border-r-0 cursor-pointer select-none",
                                  isSelectedSlot ? "bg-pink-500/10 ring-2 ring-pink-500 ring-inset" : "hover:bg-pink-500/5"
                                )}
                              >
                                {item ? (
                                  <div className="flex flex-col justify-between h-full bg-pink-50/60 border border-pink-200 text-pink-900 rounded-lg p-1.5 overflow-hidden text-left shadow-2xs">
                                    <div className="text-[10px] font-black leading-tight truncate" title={item.subject}>{getSubjectCodeOnly(item.subject, item.subjectCode)}</div>
                                    <div className="flex items-center justify-between text-[8px] font-extrabold text-slate-500 mt-1 gap-1">
                                      <span className="truncate">{item.classLevel}</span>
                                      <span className="bg-white/90 border border-pink-100 px-0.5 rounded leading-none shrink-0 truncate max-w-[30px]">{item.room}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-full border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 text-[8.5px] font-bold">
                                    {lang === 'th' ? 'ว่าง' : 'Vacant'}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[9px] font-bold text-slate-400 mt-0.5 ml-2">💡 {lang === 'th' ? 'คลิกที่ช่องตารางครู B เพื่อระบุพิกัดสลับในกล่องเครื่องมือทันที' : 'Click slots in Grid B to automatically fill Teacher B coordinates in simulator.'}</p>
              </div>
            </div>

            {/* Conflict Analysis & Swap Trigger Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
              
              {/* Control Form Console */}
              <div className={cn(
                "p-6 sm:p-8 rounded-[2rem] border transition-colors flex flex-col gap-6 lg:col-span-7 w-full",
                theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200/80 shadow-md shadow-slate-100/35"
              )}>
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <ArrowLeftRight className="w-5 h-5 text-pink-500" />
                  <h5 className="text-sm font-black text-slate-850 dark:text-slate-100">
                    {lang === 'th' ? 'จำลองคู่เวลาการสลับสอน' : 'Swap Pairing Configuration'}
                  </h5>
                </div>

                {/* 1. Choose Swap Type */}
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{lang === 'th' ? '๑. เลือกรูปแบบการจับคู่' : '1. Choose Swap Relationship'}</span>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setSandboxSwapType('teacher')}
                      className={cn(
                        "p-3 rounded-xl border text-center transition-all cursor-pointer select-none font-bold text-xs flex flex-col items-center gap-1.5",
                        sandboxSwapType === 'teacher'
                          ? "bg-pink-500 text-white border-pink-400 shadow-sm"
                          : (theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white" : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50")
                      )}
                    >
                      <span className="text-xs font-black">{lang === 'th' ? 'เทรดห้อง/สลับผู้สอน' : 'Trade Assignments'}</span>
                      <span className="text-[9px] opacity-85 font-medium leading-none mt-0.5">{lang === 'th' ? 'ครูแลกเปลี่ยนผลัดห้องกันสอน' : 'Trade responsibilities on slots'}</span>
                    </button>

                    <button
                      onClick={() => setSandboxSwapType('time')}
                      className={cn(
                        "p-3 rounded-xl border text-center transition-all cursor-pointer select-none font-bold text-xs flex flex-col items-center gap-1.5",
                        sandboxSwapType === 'time'
                          ? "bg-pink-500 text-white border-pink-400 shadow-sm"
                          : (theme === 'dark' ? "bg-slate-900 border-slate-800 text-slate-300 hover:text-white" : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50")
                      )}
                    >
                      <span className="text-xs font-black">{lang === 'th' ? 'สลับช่วงเวลาคาบเรียน' : 'Swap Time Slots'}</span>
                      <span className="text-[9px] opacity-85 font-medium leading-none mt-0.5">{lang === 'th' ? 'สลับระดับชั่วโมงคาบสอนบนปฏิทิน' : 'Rearrange time coordinates'}</span>
                    </button>
                  </div>
                </div>

                {/* 2. Choose Coordinates (Innovative Grid Tap Selector displaying selected slots) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Coordinator A */}
                  <div className="flex flex-col gap-3 p-4 rounded-2xl bg-indigo-50/25 border border-indigo-100/50 dark:bg-indigo-950/15 dark:border-indigo-900/30">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-450">{lang === 'th' ? 'พิกัดตาราง ครู A' : 'Teacher A Slot'}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-xl font-extrabold text-[11px] border border-indigo-200/40 dark:border-indigo-900/40">
                        {selectedSwapDay1 || (lang === 'th' ? 'จิ้มเลือกช่องบนตาราง A' : 'Tap slot on Grid A')}
                      </span>
                      <span className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-xl font-extrabold text-[11px] border border-indigo-200/40 dark:border-indigo-900/40">
                        {selectedSwapPeriod1 ? (lang === 'th' ? `คาบ ${selectedSwapPeriod1}` : `Period ${selectedSwapPeriod1}`) : (lang === 'th' ? 'จิ้มเลือกคาบ' : 'Select Period')}
                      </span>
                    </div>

                    <div className="mt-2 text-[10.5px] font-extrabold text-slate-600 dark:text-slate-450 border-t border-slate-250/50 dark:border-slate-800/50 pt-2 leading-tight">
                      {(() => {
                        const item = simulatedScheduleItems.find(it => it.teacher === teacherA && it.day === selectedSwapDay1 && it.period === selectedSwapPeriod1);
                        if (item) {
                          return (
                            <div>
                              <span className="text-indigo-600 font-extrabold">{lang === 'th' ? 'สอนวิชา: ' : 'Teaches: '}</span>
                              {item.subjectCode} ({item.classLevel}) - {lang === 'th' ? `ห้อง ${item.room}` : `Room ${item.room}`}
                            </div>
                          );
                        }
                        return <span className="text-[#10B981] italic font-black">🟢 {lang === 'th' ? 'เป็นคาบว่าง (ไม่มีสอน)' : 'Vacant (No class)'}</span>;
                      })()}
                    </div>
                  </div>

                  {/* Coordinator B */}
                  <div className="flex flex-col gap-3 p-4 rounded-2xl bg-pink-50/25 border border-pink-100/50 dark:bg-pink-955/15 dark:border-pink-900/30">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-450">{lang === 'th' ? 'พิกัดตาราง ครู B' : 'Teacher B Slot'}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="bg-pink-500/10 text-pink-700 dark:text-pink-400 px-3 py-1.5 rounded-xl font-extrabold text-[11px] border border-pink-200/40 dark:border-pink-900/40">
                        {selectedSwapDay2 || (lang === 'th' ? 'จิ้มเลือกช่องบนตาราง B' : 'Tap slot on Grid B')}
                      </span>
                      <span className="bg-pink-500/10 text-pink-700 dark:text-pink-400 px-3 py-1.5 rounded-xl font-extrabold text-[11px] border border-pink-200/40 dark:border-pink-900/40">
                        {selectedSwapPeriod2 ? (lang === 'th' ? `คาบ ${selectedSwapPeriod2}` : `Period ${selectedSwapPeriod2}`) : (lang === 'th' ? 'จิ้มเลือกคาบ' : 'Select Period')}
                      </span>
                    </div>

                    <div className="mt-2 text-[10.5px] font-extrabold text-slate-600 dark:text-slate-450 border-t border-slate-250/50 dark:border-slate-800/50 pt-2 leading-tight">
                      {(() => {
                        const item = simulatedScheduleItems.find(it => it.teacher === teacherB && it.day === selectedSwapDay2 && it.period === selectedSwapPeriod2);
                        if (item) {
                          return (
                            <div>
                              <span className="text-pink-650 font-extrabold">{lang === 'th' ? 'สอนวิชา: ' : 'Teaches: '}</span>
                              {item.subjectCode} ({item.classLevel}) - {lang === 'th' ? `ห้อง ${item.room}` : `Room ${item.room}`}
                            </div>
                          );
                        }
                        return <span className="text-[#10B981] italic font-black">🟢 {lang === 'th' ? 'เป็นคาบว่าง (ไม่มีสอน)' : 'Vacant (No class)'}</span>;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Validation Panel */}
                {(() => {
                  const item1 = simulatedScheduleItems.find(it => it.teacher === teacherA && it.day === selectedSwapDay1 && it.period === selectedSwapPeriod1) || null;
                  const item2 = simulatedScheduleItems.find(it => it.teacher === teacherB && it.day === selectedSwapDay2 && it.period === selectedSwapPeriod2) || null;
                  
                  const problems = getSwapValidation(
                    sandboxSwapType,
                    item1,
                    selectedSwapDay1,
                    selectedSwapPeriod1,
                    item2,
                    selectedSwapDay2,
                    selectedSwapPeriod2,
                    teacherA,
                    teacherB,
                    simulatedScheduleItems
                  );

                  const hasClashes = problems.length > 0;
                  const isEmptySwap = !item1 && !item2;

                  return (
                    <div className="flex flex-col gap-3 mt-2 border-t border-slate-100 dark:border-slate-800 pt-5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{lang === 'th' ? '๒. การวิเคราะห์ความเข้ากันได้และตารางชน' : '2. Clash compatibility checking'}</span>

                      {isEmptySwap ? (
                        <div className="p-3.5 rounded-2xl border border-slate-150 bg-slate-50 text-slate-500 text-[10.5px] font-bold dark:bg-slate-900/40 dark:border-slate-800">
                          ℹ️ {lang === 'th' ? 'กรุณาเลือกคาบที่ครูท่านใดท่านหนึ่งมีตารางสอนอยู่เพื่อเริ่มเปรียบเทียบตาราง' : 'Please select at least one active class on either Teacher A or B grid to enable swap simulation.'}
                        </div>
                      ) : hasClashes ? (
                        <div className="flex flex-col gap-2.5 p-4 rounded-2xl border border-red-150 bg-red-50/70 dark:bg-red-950/10 dark:border-red-900/30">
                          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-extrabold text-xs">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{lang === 'th' ? 'ปฏิเสธคำขอ! ตรวจพบคลิปและข้อขัดแย้งในแบบตารางสอน' : 'Clash Safety Override! Conflicts detected'}</span>
                          </div>
                          <ul className="list-disc list-inside text-[10px] text-red-750 font-extrabold space-y-1 pl-1 text-left">
                            {problems.map((pb, pIdx) => (
                              <li key={pIdx}>{pb}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl border border-emerald-150 bg-emerald-50/50 dark:bg-emerald-950/10 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400 text-xs font-black">
                          <CheckCircle className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{lang === 'th' ? 'ตรวจพบสถานะ: ปลอดภัย! คู่นี้สามารถแลกเปลี่ยนชั่วโมงสอนได้ทันทีโดยไม่มีข้อขัดแย้งสะสม' : 'Safe to Swap! Real-time check confirms zero teacher, level, or room clashes.'}</span>
                        </div>
                      )}

                      <div className="flex gap-3 mt-2">
                        <button
                          onClick={() => {
                            const item1ToSwap = simulatedScheduleItems.find(it => it.teacher === teacherA && it.day === selectedSwapDay1 && it.period === selectedSwapPeriod1) || null;
                            const item2ToSwap = simulatedScheduleItems.find(it => it.teacher === teacherB && it.day === selectedSwapDay2 && it.period === selectedSwapPeriod2) || null;
                            
                            const newSwap = {
                              swapType: sandboxSwapType,
                              day1: selectedSwapDay1,
                              period1: selectedSwapPeriod1,
                              item1: item1ToSwap,
                              day2: selectedSwapDay2,
                              period2: selectedSwapPeriod2,
                              item2: item2ToSwap,
                              tA: teacherA,
                              tB: teacherB,
                              createdAt: serverTimestamp()
                            };

                            addDoc(collection(db, 'schedule_swaps'), newSwap).catch(err => {
                              console.error("Error saving swap to Firestore:", err);
                            });
                          }}
                          disabled={isEmptySwap || hasClashes}
                          className={cn(
                            "flex-1 py-3 px-5 rounded-xl text-center font-black text-xs transition-all shadow-sm flex items-center justify-center gap-2",
                            isEmptySwap || hasClashes
                              ? "bg-slate-150 text-slate-400 border border-slate-200 cursor-not-allowed dark:bg-slate-900 dark:border-slate-800"
                              : "bg-pink-600 hover:bg-pink-550 text-white cursor-pointer active:scale-95"
                          )}
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                          <span>{lang === 'th' ? 'เพิ่มตารางแผนแลกคาบเรียน' : 'Execute Swap on virtual grid'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Simulated History list Panel */}
              <div className={cn(
                "p-6 sm:p-8 rounded-[2rem] border transition-colors flex flex-col gap-5 lg:col-span-5 w-full",
                theme === 'dark' ? "bg-slate-950/40 border-slate-800" : "bg-white border-slate-200/80 shadow-md shadow-slate-100/35",
                "h-full"
              )}>
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4.5 h-4.5 text-pink-500" />
                    <h5 className="text-sm font-black text-slate-850 dark:text-slate-100">
                      {lang === 'th' ? 'แผนเสนอสลับสะสมในกล่องทดลอง' : 'Simulation Basket'}
                    </h5>
                  </div>
                  {appliedSwaps.length > 0 && (
                    <button
                      onClick={async () => {
                        try {
                          const snapshot = await getDocs(collection(db, 'schedule_swaps'));
                          const batch = writeBatch(db);
                          snapshot.docs.forEach((doc) => {
                            batch.delete(doc.ref);
                          });
                          await batch.commit();
                        } catch (err) {
                          console.error("Error clearing swaps from Firestore:", err);
                        }
                      }}
                      className="text-[10px] font-black text-pink-600 hover:text-pink-800 cursor-pointer"
                    >
                      {lang === 'th' ? 'ล้างตะกร้า' : 'Clear Basket'}
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] custom-scrollbar pr-1">
                  {appliedSwaps.length > 0 ? (
                    <div className="flex flex-col gap-3 text-left">
                      {appliedSwaps.map((swap, idx) => (
                        <div 
                          key={swap.id}
                          className={cn(
                            "p-3.5 rounded-2xl border text-[10.5px] leading-relaxed relative font-bold flex flex-col gap-2 text-left",
                            theme === 'dark' ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-150"
                          )}
                        >
                          <button
                            onClick={async () => {
                              try {
                                await deleteDoc(doc(db, 'schedule_swaps', swap.id));
                              } catch (err) {
                                console.error("Error deleting swap from Firestore:", err);
                              }
                            }}
                            className="absolute right-3 top-3 p-1 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                            title="Undo simulation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          <div className="flex items-center gap-2 font-black text-xs text-pink-600 dark:text-pink-400 border-b border-dashed border-slate-205 pb-1.5 w-11/12 text-left">
                            <span>#{idx + 1}</span>
                            <span>{swap.swapType === 'teacher' ? (lang === 'th' ? 'สลับครูผู้สอน' : 'Trade Assignments') : (lang === 'th' ? 'สลับช่วงเวลาคาบ' : 'Time Shift')}</span>
                          </div>

                          <div className="text-left leading-tight">
                            <strong className="text-indigo-600">{lang === 'th' ? 'ครู A: ' : 'A: '}</strong>
                            {swap.item1 ? (
                              <span>{getCleanTeacherName(swap.tA)} - {swap.item1.subjectCode} ({swap.item1.classLevel}) {lang === 'th' ? `ที่วัน` : `at`} {swap.day1.replace('วัน', '')} {lang === 'th' ? 'คาบ' : 'P'}{swap.item1.period}</span>
                            ) : (
                              <span className="italic text-slate-400">{lang === 'th' ? 'คาบว่าง' : 'Vacant Slot'} ({swap.day1} P{swap.period1})</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 py-0.5 justify-start text-xs text-slate-400 font-extrabold pl-4">
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </div>

                          <div className="text-left leading-tight">
                            <strong className="text-pink-600">{lang === 'th' ? 'ครู B: ' : 'B: '}</strong>
                            {swap.item2 ? (
                              <span>{getCleanTeacherName(swap.tB)} - {swap.item2.subjectCode} ({swap.item2.classLevel}) {lang === 'th' ? `ที่วัน` : `at`} {swap.day2.replace('วัน', '')} {lang === 'th' ? 'คาบ' : 'P'}{swap.item2.period}</span>
                            ) : (
                              <span className="italic text-slate-400">{lang === 'th' ? 'คาบว่าง' : 'Vacant Slot'} ({swap.day2} P{swap.period2})</span>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      {/* Shareable summary trigger */}
                      <button
                        onClick={() => {
                          const copyText = appliedSwaps.map((swap, idx) => {
                            const desc1 = swap.item1 ? `${swap.item1.subjectCode} (${swap.item1.classLevel} ${swap.day1} คาบที่ ${swap.period1})` : `คาบว่าง (${swap.day1} คาบที่ ${swap.period1})`;
                            const desc2 = swap.item2 ? `${swap.item2.subjectCode} (${swap.item2.classLevel} ${swap.day2} คาบที่ ${swap.period2})` : `คาบว่าง (${swap.day2} คาบที่ ${swap.period2})`;
                            return `${idx + 1}. [${getCleanTeacherName(swap.tA)}] ${desc1} 🔄 [${getCleanTeacherName(swap.tB)}] ${desc2} (${swap.swapType === 'teacher' ? 'แลกเปลี่ยนคนสอน' : 'แลกเปลี่ยนช่วงเวลา'})`;
                          }).join('\n');
                          
                          const fullReport = `=== บันทึกเสนอขอแลกคาบเรียน (Class Swap Simulator Basket) ===\nวันที่บันทึกร่าง: ${new Date().toLocaleDateString('th-TH')}\n\n${copyText}\n\n*ผ่านระบบการประมวลผลความปลอดภัยตารางอย่างเป็นทางการ: ไม่มีคาบเรียนชนกัน คลาสเรียนชนกัน หรือพิกัดห้องเรียนซ้ำซ้อน*`;
                          
                          navigator.clipboard.writeText(fullReport);
                          alert(lang === 'th' 
                            ? 'คัดลอกร่างข้อเสนอแลกคาบทั้งหมดไปยังคลิปบอร์ดแล้ว! สามารถนำไปส่งต่อทาง Line หรือ Messenger ได้ทันที' 
                            : 'All simulation proposals successfully written to your Clipboard!'
                          );
                        }}
                        className="w-full py-3 px-4 rounded-xl border border-pink-200 text-pink-650 hover:bg-pink-50 dark:border-pink-900/30 dark:hover:bg-pink-950/10 font-black text-xs text-center transition-all cursor-pointer active:scale-95"
                      >
                        {lang === 'th' ? 'คัดลอกร่างเสนอรวมเพื่อแชร์ส่งครูท่านอื่น 📋' : 'Copy All Proposals Summary 📋'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 gap-3 h-full">
                      <div className="p-3 rounded-full bg-slate-50 dark:bg-slate-900">
                        <ArrowLeftRight className="w-5 h-5 text-slate-300" />
                      </div>
                      <span className="text-xs font-bold text-slate-450">
                        {lang === 'th' ? 'กล่องจำลองว่างเปล่า ตารางเรียนเสมือนด้านบนยังเป็นค่าของตารางกติกาปกติ' : 'Simulation basket is empty. Timetables above use original configurations.'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        );
      })()}
    </motion.div>
  );
}
