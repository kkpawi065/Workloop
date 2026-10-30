import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SpreadsheetData {
  title: string;
  values: string[][];
  isMock?: boolean;
  isCached?: boolean;
  error?: string;
  isAuthError?: boolean;
  cachedAt?: number;
}

export const fetchSpreadsheetData = async (accessToken: string, spreadsheetId: string, gid?: string, force?: boolean): Promise<SpreadsheetData | null> => {
  const cacheKey = `g_sheet_cache_${spreadsheetId}${gid ? `_${gid}` : ''}`;
  const docId = `${spreadsheetId}${gid ? `_${gid}` : ''}`;
  
  // Helper to read from localStorage cache
  const getCachedData = (): SpreadsheetData | null => {
    try {
      const cachedStr = localStorage.getItem(cacheKey);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.values)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Error reading from localStorage cache:', err);
    }
    return null;
  };

  // Helper to write to localStorage cache
  const setCachedData = (data: SpreadsheetData) => {
    try {
      const enriched = {
        ...data,
        cachedAt: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(enriched));
    } catch (err) {
      console.warn('Error saving to localStorage cache:', err);
    }
  };

  // Helper to read from Firestore cache
  const getFirestoreCachedData = async (): Promise<SpreadsheetData | null> => {
    try {
      const docRef = doc(db, 'sheets_cache', docId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const cached = docSnap.data();
        if (cached && Array.isArray(cached.values)) {
          return {
            title: cached.title || 'Document',
            values: cached.values,
            isCached: true,
            isMock: false
          };
        }
      }
    } catch (err) {
      console.warn('Error reading from Firestore cache:', err);
    }
    return null;
  };

  // Helper to write to Firestore cache
  const setFirestoreCachedData = async (data: SpreadsheetData) => {
    try {
      const docRef = doc(db, 'sheets_cache', docId);
      await setDoc(docRef, {
        title: data.title || '',
        values: data.values || [],
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Error saving to Firestore cache:', err);
    }
  };

  // Check if guest token - if yes, skip Google Sheets API and load cached data
  if (accessToken === "GUEST_SESSION_TOKEN") {
    console.log(`Guest token detected. Fetching ${spreadsheetId} directly from Firestore cache...`);
    const firestoreData = await getFirestoreCachedData();
    if (firestoreData) {
      return firestoreData;
    }
    const cachedData = getCachedData();
    if (cachedData) {
      return cachedData;
    }
    const mockSpreadsheet = getDefaultMockSpreadsheet(spreadsheetId, gid);
    return {
      ...mockSpreadsheet,
      isMock: true,
      isCached: false
    };
  }

  // Client-side fetch with retry helper (handles network failures / Too Many Requests status)
  const fetchWithRetry = async (url: string, options: RequestInit, retries = 3, delay = 800): Promise<Response> => {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.status === 429 || response.status === 502 || response.status === 503 || response.status === 504) {
          if (i < retries) {
            console.warn(`[Client Retry-HTTP] Got status ${response.status}. Retrying in ${delay}ms... (Attempt ${i + 1} of ${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
            continue;
          }
        }
        return response;
      } catch (err: any) {
        if (i < retries) {
          console.warn(`[Client Retry-Network] Network failure: ${err.message}. Retrying in ${delay}ms... (Attempt ${i + 1} of ${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        throw err;
      }
    }
    throw new Error("Failed to fetch after all retries on client");
  };

  try {
    let url = gid ? `/api/gsheets/${spreadsheetId}?gid=${gid}` : `/api/gsheets/${spreadsheetId}`;
    if (force) {
      url += (gid ? '&' : '?') + 'force=true&_cb=' + Date.now();
    }
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    const text = await res.text();
    let data: any = null;
    const contentType = res.headers.get("content-type");
    
    if (contentType && contentType.includes("application/json")) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn('Failed to parse JSON even though content-type is json:', text.substring(0, 100));
      }
    }

    if (!res.ok) {
      let errorMessage = `Failed to fetch data: ${res.status} ${res.statusText}`;
      if (data && data.error) {
        if (typeof data.error === 'object' && data.error.message) {
          errorMessage = data.error.message;
        } else {
          errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        }
      } else if (text && text.includes("<html>")) {
        errorMessage = `Access Forbidden (403). Possible reasons: 
        1. Access Token expired (try Logout/Login).
        2. Spreadsheet not shared with your account.
        3. Google Sheets API not enabled for this project.`;
      } else if (text) {
        errorMessage = text;
      }

      const isAuthError = res.status === 401 || res.status === 403 || errorMessage.toLowerCase().includes("invalid authentication") || errorMessage.toLowerCase().includes("expired") || errorMessage.toLowerCase().includes("credentials");

      // TRY FIRESTORE CACHE FIRST ON ERROR
      const firestoreData = await getFirestoreCachedData();
      if (firestoreData) {
        console.warn(`Fetch to Google Sheets failed (${errorMessage}). Falling back to global Firestore cache.`);
        return {
          ...firestoreData,
          isCached: true,
          isMock: false,
          isAuthError,
          error: errorMessage
        };
      }

      // GRACEFUL FALLBACK TO CLIENT CACHE ON FAIL / RATE EXCEEDED
      const cachedData = getCachedData();
      if (cachedData) {
        console.warn(`Fetch to Google Sheets failed (${errorMessage}). Falling back to cached localStorage data.`);
        return {
          ...cachedData,
          isCached: true,
          isMock: false,
          isAuthError,
          error: errorMessage
        };
      }

      // Defensive fallback to beautiful realistic offline mock data to avoid any application crash
      console.warn(`Spreadsheet fetch failed: ${errorMessage}. Falling back to default mock spreadsheet.`);
      const mockSpreadsheet = getDefaultMockSpreadsheet(spreadsheetId, gid);
      return {
        ...mockSpreadsheet,
        isMock: true,
        isCached: false,
        isAuthError,
        error: errorMessage
      };
    }
    
    if (data && Array.isArray(data.values)) {
      // Save successful response data to local cache
      setCachedData(data);
      // Save to global Firestore cache in the background
      setFirestoreCachedData(data).catch(err => console.warn('Background Firestore cache write error:', err));
      return {
        ...data,
        cachedAt: Date.now(),
        isMock: false,
        isCached: false
      };
    }
    
    // If it's OK but no valid JSON data values found, try fallback
    console.warn('Received non-JSON response with status OK:', text.substring(0, 100));
    
    // Try Firestore Cache first
    const firestoreData = await getFirestoreCachedData();
    if (firestoreData) {
      return firestoreData;
    }

    const cachedData = getCachedData();
    if (cachedData) {
      return {
        ...cachedData,
        isCached: true,
        isMock: false
      };
    }
    const mockSpreadsheet = getDefaultMockSpreadsheet(spreadsheetId, gid);
    return {
      ...mockSpreadsheet,
      isMock: true,
      isCached: false,
      error: "Non-JSON response structure received"
    };
  } catch (error: any) {
    console.warn('Error fetching spreadsheet data (graceful fallback active):', error);
    const isAuthError = error.message?.includes("401") || error.message?.includes("403");
    
    // Try Firestore Cache first
    try {
      const docRef = doc(db, 'sheets_cache', `${spreadsheetId}${gid ? `_${gid}` : ''}`);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const cached = docSnap.data();
        if (cached && Array.isArray(cached.values)) {
          console.warn('Returning cached data from Firestore due to fetch exception:', error.message);
          return {
            title: cached.title || 'Document',
            values: cached.values,
            isCached: true,
            isMock: false,
            isAuthError,
            error: error.message
          };
        }
      }
    } catch (fsErr) {
      console.warn("Failed to query Firestore cache on exception:", fsErr);
    }

    // GRACEFUL FALLBACK TO CACHE ON EXCEPTION
    const cachedData = getCachedData();
    if (cachedData) {
      console.warn('Returning cached data due to fetch exception:', error.message);
      return {
        ...cachedData,
        isCached: true,
        isMock: false,
        isAuthError,
        error: error.message
      };
    }
    console.warn('Returning default mock spreadsheet due to fetch exception:', error.message);
    const mockSpreadsheet = getDefaultMockSpreadsheet(spreadsheetId, gid);
    return {
      ...mockSpreadsheet,
      isMock: true,
      isCached: false,
      isAuthError,
      error: error.message
    };
  }
};

const getDefaultMockSpreadsheet = (spreadsheetId: string, gid?: string): SpreadsheetData => {
  const teacherId = '1evNW1UcflWMYAlwB8bFkGXiLyPilTamkph1sLTVycPU';
  const studentId = '1sUF9nS8f4zkQ9GldUVcU82q0a7Eh83jidLYBamERcI4';
  const scheduleId = '13wfOLqX81c6GAU81KpwZIgZFWIhIdQtc';

  if (spreadsheetId === teacherId) {
    // Return mock teacher database
    return {
      title: "Teacher Performance Evaluation Data",
      values: [
        [
          "Timestamp",
          "ชื่อย่อรายวิชา / Class Code",
          "ครูผู้ประเมิน / Evaluator",
          "ครูต่างชาติ (Foreign Teacher)",
          "ชั้นเรียน / Classroom",
          "เนื้อหาสาระที่นำเสนอมีความถูกต้องตามหลักวิชา",
          "การจัดกิจกรรมที่สอดคล้องกับวัตถุประสงค์ของบทเรียน",
          "การเลือกใช้สื่อการสอนมีความเหมาะสมกับระดับความรู้ของผู้เรียน",
          "มีการใช้ภาษาที่เหมาะสมในการถ่ายทอดความรู้",
          "สามารถควบคุมชั้นเรียนได้ดี",
          "ความเห็น / Comments"
        ],
        // Teacher John evaluations
        ["2026-06-08 08:30:00", "EN101", "นายสมชาย ใจดี", "Teacher John", "ม.1/1", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดี", "Excellent teaching skill and content accuracy."],
        ["2026-06-08 09:30:00", "EN101", "นางสาวสมศรี สิทธิ", "Teacher John", "ม.1/1", "ดีมาก", "ดี", "ดีมาก", "ดีมาก", "ดีมาก", "Highly engaging lesson with plenty of examples."],
        ["2026-06-07 10:30:00", "EN101", "นายสมชาย ใจดี", "Teacher John", "ม.1/2", "ดี", "ดี", "ดี", "ดี", "พอใช้", "Students enjoyed the speaking activity."],
        ["2026-06-07 11:30:05", "EN101", "ครูสมาน แสนสวย", "Teacher John", "ม.1/2", "ดีมาก", "ดีมาก", "ดี", "ดีมาก", "ดีมาก", "Very professional and kind to students."],
        ["2026-06-06 13:00:00", "EN101", "นางสาวสมหญิง แก้วงาม", "Teacher John", "ม.1/1", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Awesome presentation design and pronunciation."],
        ["2026-06-06 14:00:22", "EN202", "นายสมชาย ใจดี", "Teacher John", "ม.2/1", "ดี", "ดีมาก", "ดี", "ดี", "ดี", "Organized classroom environment."],
        ["2026-06-05 09:00:00", "EN202", "นางสาวสมหญิง แก้วงาม", "Teacher John", "ม.2/1", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Love how he interactive with the students!"],
        ["2026-06-05 10:15:00", "EN202", "นายสมชาย ใจดี", "Teacher John", "ม.2/2", "ดี", "ดี", "ดีมาก", "ดีมาก", "พอใช้", "Control of the classroom was a bit difficult today."],
        ["2026-06-04 11:00:00", "EN101", "นางสาวสมหญิง แก้วงาม", "Teacher John", "ม.1/1", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Keep up the amazing work."],
        ["2026-06-04 14:00:00", "EN101", "นายสมชาย ใจดี", "Teacher John", "ม.1/2", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Phenomenal speaking practice session."],
        ["2026-06-03 10:00:00", "EN101", "นายสมชาย ใจดี", "Teacher John", "ม.1/1", "ดี", "ดี", "ดีมาก", "ดีมาก", "ดี", "Solid performance, well done."],
        ["2026-06-03 11:00:00", "EN101", "ครูสมาน แสนสวย", "Teacher John", "ม.1/2", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Strong command over presentation topic."],
        ["2026-06-02 13:00:00", "EN101", "นายสมชาย ใจดี", "Teacher John", "ม.1/1", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Interactive lesson, students were very excited."],
        ["2026-06-02 14:00:00", "EN202", "นายสมชาย ใจดี", "Teacher John", "ม.2/1", "ดีมาก", "ดี", "ดีมาก", "ดีมาก", "ดี", "Great learning materials used."],
        ["2026-06-01 10:00:00", "EN101", "นายสมชาย ใจดี", "Teacher John", "ม.1/1", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Superb class presence."],

        // Teacher Sarah evaluations
        ["2026-06-08 09:00:00", "EN301", "นายสมชาย ใจดี", "Teacher Sarah", "ม.3/1", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Excellent material and friendly character."],
        ["2026-06-08 10:30:00", "EN301", "นางสาวสมหญิง แก้วงาม", "Teacher Sarah", "ม.3/1", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดี", "Perfect layout and beautiful voice."],
        ["2026-06-07 08:30:00", "EN301", "นางสาวสมหญิง แก้วงาม", "Teacher Sarah", "ม.3/2", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Extremely kind, kids absolutely love her!"],
        ["2026-06-07 14:00:00", "EN301", "นายสมชาย ใจดี", "Teacher Sarah", "ม.3/2", "ดีมาก", "ดีมาก", "ดี", "ดีมาก", "ดี", "Engages quiet students effectively."],
        ["2026-06-06 10:00:00", "EN301", "ครูสมาน แสนสวย", "Teacher Sarah", "ม.3/1", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Top notch presentation and pronunciation."],
        ["2026-06-05 13:00:00", "EN301", "นายสมชาย ใจดี", "Teacher Sarah", "ม.3/1", "ดีมาก", "ดี", "ดีมาก", "ดีมาก", "ดีมาก", "Comprehensive grammar explanations."],
        ["2026-06-04 09:30:00", "EN301", "นางสาวสมหญิง แก้วงาม", "Teacher Sarah", "ม.3/2", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Outstanding classroom management and fun games."],
        ["2026-06-03 14:00:00", "EN301", "นายสมชาย ใจดี", "Teacher Sarah", "ม.3/2", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Inspiring teacher with infinite energy."],
        ["2026-06-02 10:30:00", "EN301", "นางสาวสมหญิง แก้วงาม", "Teacher Sarah", "ม.3/1", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Perfect class engagement!"],
        ["2026-06-01 11:00:00", "EN301", "นายสมชาย ใจดี", "Teacher Sarah", "ม.3/1", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Wonderful teaching and activities."],

        // Teacher David evaluations
        ["2026-06-08 11:00:00", "SC501", "นางสาวสมหญิง แก้วงาม", "Teacher David", "ม.4/1", "ดี", "ดี", "พอใช้", "ดี", "พอใช้", "Speaks a bit fast. Students struggle to follow."],
        ["2026-06-08 13:30:00", "SC501", "นายสมชาย ใจดี", "Teacher David", "ม.4/1", "ดี", "พอใช้", "พอใช้", "ดี", "พอใช้", "Needs better lesson planning and visuals."],
        ["2026-06-07 10:00:00", "SC501", "ครูสมาน แสนสวย", "Teacher David", "ม.4/2", "พอใช้", "พอใช้", "ดี", "ดี", "พอใช้", "Good math explanation, but classroom was loud."],
        ["2026-06-06 11:00:00", "SC501", "นางสาวสมหญิง แก้วงาม", "Teacher David", "ม.4/2", "ดี", "พอใช้", "พอใช้", "ดี", "พอใช้", "Try checking students understanding more often."],
        ["2026-06-05 14:00:00", "SC501", "นายสมชาย ใจดี", "Teacher David", "ม.4/1", "ดี", "พอใช้", "ดี", "ดี", "พอใช้", "Content is good, but needs stronger control."],

        // Teacher Mary evaluations
        ["2026-06-08 10:00:00", "EN401", "นางสาวสมหญิง แก้วงาม", "Teacher Mary", "ม.5/1", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Outstanding interactive conversation drills."],
        ["2026-06-07 13:00:00", "EN401", "นายสมชาย ใจดี", "Teacher Mary", "ม.5/1", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Engages students in high-level speaking."],
        ["2026-06-06 09:30:00", "ครูสมาน แสนสวย", "Teacher Mary", "ม.5/2", "ดีมาก", "ดีมาก", "ดี", "ดีมาก", "ดีมาก", "Class was productive and organized."],
        ["2026-06-05 11:00:00", "นางสาวสมหญิง แก้วงาม", "Teacher Mary", "ม.5/2", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Magnificent teaching method and active games."]
      ]
    };
  } else if (spreadsheetId === studentId) {
    // Return mock student database
    return {
      title: "Student Feedback Data",
      values: [
        [
          "Timestamp",
          "ชื่อรายวิชา / Subject",
          "ชื่อนักเรียน / Student",
          "ชั้นเรียน / Classroom",
          "ครูต่างชาติที่สอน (Teacher)",
          "การใช้สื่อการสอนที่เหมาะสมกับนักเรียน",
          "การปรับวิธีการสอนให้เข้ากับระดับภาษาของนักเรียน",
          "ความสามารถในการควบคุมชั้นเรียน",
          "ความกระตือรือร้นในการสอนของครู",
          "การให้คำแนะนำและตอบคำถามอย่างสุภาพ",
          "กระบวนการจัดการเรียนการสอนมีความสนุกสนาน",
          "นักเรียนมีส่วนร่วมในการเรียนการสอนอย่างทั่วถึง",
          "ครูใช้ภาษาอังกฤษในการจัดกิจกรรมอย่างสม่ำเสมอ",
          "ความคิดเห็นและข้อเสนอแนะเพิ่มเติม / Additional Comments"
        ],
        ["2026-06-08 15:00:00", "English", "เด็กชายวินัย", "ม.1/1", "Teacher John", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "เรียนสนุกมากและได้พูดคุยภาษาอังกฤษเยอะมากครับ"],
        ["2026-06-08 15:10:00", "English", "เด็กหญิงสมปอง", "ม.1/1", "Teacher John", "ดีมาก", "ดีมาก", "ดี", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Teacher John ใจดีมาก สอนเข้าใจง่ายสุดๆ ค่ะ"],
        ["2026-06-07 15:30:00", "English", "เด็กชายอนุชา", "ม.1/2", "Teacher John", "ดีมาก", "ดี", "ดี", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ชอบกิจกรรมบอร์ดเกมในห้องเรียนครับ"],
        ["2026-06-08 15:05:00", "English", "เด็กหญิงพัชรา", "ม.3/1", "Teacher Sarah", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Teacher Sarah สอนภาษาอังกฤษสนุกที่สุดค่ะ รักเลย"],
        ["2026-06-07 15:20:00", "English", "เด็กชายปกรณ์", "ม.3/2", "Teacher Sarah", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "สนุกสนานมาก อยากเรียนทุกวันเลยครับ"],
        ["2026-06-08 15:15:00", "Science", "เด็กชายธนา", "ม.4/1", "Teacher David", "พอใช้", "ดี", "พอใช้", "ดี", "ดี", "พอใช้", "พอใช้", "ดี", "อยากให้ครูอธิบายช้าลงหน่อยครับ บ่อยครั้งฟังไม่ทันเลย"],
        ["2026-06-07 15:45:00", "Science", "เด็กหญิงกุลยา", "ม.4/1", "Teacher David", "พอใช้", "พอใช้", "พอใช้", "ดี", "ดี", "พอใช้", "พอใช้", "ดี", "มีคำศัพท์ยากเยอะ อยากให้ครูแปลไทยให้บางคำด้วยค่ะ"],
        ["2026-06-08 15:25:00", "English", "เด็กหญิงวิภา", "ม.5/1", "Teacher Mary", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "ดีมาก", "Teacher Mary makes English very easy and interesting."]
      ]
    };
  } else if (spreadsheetId === scheduleId) {
    return {
      title: "Class Schedule Master Info",
      values: [
        [
          "วัน",
          "คาบ",
          "เวลา",
          "รหัสวิชา",
          "วิชา",
          "ครูผู้สอน",
          "ห้อง",
          "ชั้น"
        ],
        ["วันจันทร์", "1", "08:30 - 09:20", "อ21201", "English Communication", "Teacher John", "EP Room 1", "ม.1/1"],
        ["วันจันทร์", "2", "09:20 - 10:10", "อ21201", "English Communication", "Teacher John", "EP Room 1", "ม.1/2"],
        ["วันจันทร์", "5", "12:40 - 13:30", "อ22102", "English Conversation", "Teacher John", "Room 421", "ม.2/1"],
        ["วันจันทร์", "3", "10:15 - 11:05", "อ23102", "English Conversation", "Teacher Sarah", "Room 422", "ม.3/1"],
        ["วันอังคาร", "2", "09:20 - 10:10", "อ23102", "English Conversation", "Teacher Sarah", "Room 422", "ม.3/2"],
        ["วันอังคาร", "7", "14:20 - 15:10", "อ21201", "English Communication", "Teacher John", "Room 421", "ม.3/2"],
        ["วันพุธ", "1", "08:30 - 09:20", "อ21201", "English Communication", "Teacher John", "EP Room 1", "ม.1/1"],
        ["วันพุธ", "3", "10:15 - 11:05", "อ23102", "English Conversation", "Teacher Sarah", "Room 422", "ม.3/1"],
        ["วันพุธ", "4", "11:05 - 11:55", "ว22203", "Science (Bilingual)", "Teacher David", "Lab Room A", "ม.4/1"],
        ["วันพฤหัสบดี", "5", "12:40 - 13:30", "อ22102", "English Conversation", "Teacher John", "Room 422", "ม.2/3"],
        ["วันพฤหัสบดี", "6", "13:30 - 14:20", "ว22203", "Science (Bilingual)", "Teacher David", "Lab Room A", "ม.4/2"],
        ["วันศุกร์", "2", "09:20 - 10:10", "อ24102", "High School English", "Teacher Mary", "Room 411", "ม.5/1"],
        ["วันศุกร์", "5", "12:40 - 13:30", "ว22203", "Science (Bilingual)", "Teacher John", "EP Room 1", "ม.2/1"],
        ["วันศุกร์", "6", "13:30 - 14:20", "อ24102", "High School English", "Teacher Mary", "Room 411", "ม.5/2"]
      ]
    };
  }

  // Generic fallback structure
  return {
    title: "Document",
    values: [["Column1"], ["Placeholder"]]
  };
};

export const appendSpreadsheetData = async (accessToken: string, spreadsheetId: string, sheetName: string, values: string[][]): Promise<boolean> => {
  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to append data: ${res.statusText}`);
    }

    return true;
  } catch (error) {
    console.warn('Error appending spreadsheet data:', error);
    return false;
  }
};

export const createSheet = async (accessToken: string, spreadsheetId: string, sheetTitle: string): Promise<boolean> => {
  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetTitle,
              },
            },
          },
        ],
      }),
    });

    return res.ok;
  } catch (error) {
    console.warn('Error creating sheet:', error);
    return false;
  }
};

export const createSpreadsheet = async (accessToken: string, title: string): Promise<string | null> => {
  try {
    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          title,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create spreadsheet: ${res.statusText}`);
    }

    const data = await res.json();
    return data.spreadsheetId;
  } catch (error) {
    console.warn('Error creating spreadsheet:', error);
    return null;
  }
};
