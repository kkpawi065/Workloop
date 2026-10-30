import { createHash } from "node:crypto";
import { GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx";
import { authenticate } from "../lib/auth.mts";

// Netlify Functions v2: serves every /api/* request from this one function.
export const config = { path: "/api/*" };

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "youthful-kit-0cf5x";
const ALLOWED_EMAIL_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS || "").split(",");
const ANALYSIS_MODEL = process.env.GEMINI_ANALYSIS_MODEL || "gemini-3-flash-preview";
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

async function readJson(req: Request): Promise<any | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : null;
  } catch {
    return null;
  }
}

let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return aiClient;
}

// ---------------------------------------------------------------------------
// POST /api/analyze-teacher
// ---------------------------------------------------------------------------
async function analyzeTeacher(req: Request): Promise<Response> {
  const auth = await authenticate(req, { projectId: FIREBASE_PROJECT_ID, allowedDomains: ALLOWED_EMAIL_DOMAINS });
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const body = await readJson(req);
  if (!body) return json({ error: "Invalid JSON body" }, 400);
  if (!Array.isArray(body.averageScores)) return json({ error: "No averageScores provided" }, 400);

  // Bound the size of everything that goes into the prompt.
  const lang = body.lang === "th" ? "th" : "en";
  const role = body.role === "coteacher" ? "coteacher" : "teacher";
  const teacherName = String(body.teacherName ?? "").slice(0, 200);
  const averageScores = body.averageScores
    .slice(0, 20)
    .map((s: any) => ({ aspect: String(s?.aspect ?? "").slice(0, 200), score: Number(s?.score) }));
  const comments: string[] = (Array.isArray(body.comments) ? body.comments : [])
    .slice(0, 40)
    .map((c: any) => String(c).slice(0, 1000));

      const isTh = lang === 'th';
    const commentsSnippet = comments && comments.length > 0 
      ? comments.slice(0, 40).map((c: string, idx: number) => `Comment ${idx + 1}: "${c}"`).join('\n')
      : isTh ? 'ไม่มีความเห็นเพิ่มเติม' : 'No comments provided';

    const scoresSnippet = averageScores.map((s: any) => `${s.aspect}: ${s.score} / 10`).join('\n');

    const promptText = isTh 
      ? (role === 'coteacher'
        ? `คุณเป็นที่ปรึกษาการจัดการเรียนรู้ร่วมกัน (Co-teaching Advisor) และผู้เชี่ยวชาญด้านการจัดกิจกรรมคู่ระหว่างครูไทยและครูต่างชาติ (Bilingual Classroom Partnership)
กรุณาวิเคราะห์และให้คำแนะนำสำหรับ "ครูสอนร่วมชาวไทย" (Co-teacher) เพื่อการทำงานร่วมกันอย่างมีประสิทธิภาพและราบรื่นกับครูต่างชาติคนนี้:

ชื่อครูต่างชาติที่ร่วมสอน: ${teacherName}

คะแนนเฉลี่ย 5 สถิติมิติการสอนของครูต่างชาติคนนี้ (เต็ม 10 คะแนน):
${scoresSnippet}

ความคิดเห็นเชิงคุณภาพจากการสังเกตการสอนในชั้นเรียน ( Qualitative Comments from Observers ):
${commentsSnippet}

ข้อกำหนดรูปแบบคำสร้างรายงาน:
1. ตอบกลับด้วยความเคารพ สรุปเป็นภาษาไทยอย่างเป็นมิตร กระชับ และสร้างแรงบันดาลใจในการทำงานร่วมกันเป็นทีมเวิร์กคู่คิด
2. มีหัวข้อย่อยชัดเจน (ใช้ ### หรือหัวข้อย่อยเพื่อให้อ่านง่ายสอดคล้องกับ UI บล็อก):
   - ### 🤝 แนวทางการสนับสนุนและสอดประสานในห้องเรียน (Practical Collaboration & Support)
   - ### 💡 วิธีการช่วยเหลือนักเรียนในส่วนที่เกี่ยวข้อง (Student Liaison Tips)
   - ### 🎯 แผนกลยุทธ์สอนร่วมกันเพื่อความสำเร็จสูงสุด (Co-teaching Success Strategies)
3. เจาะลึกการจับคู่งานสอน โดยอาศัยคะแนนและจุดสังเกตเพื่อช่วยให้ครูไทยเสริมเติมเต็มส่วนที่ครูต่างชาติอาจจะยังบกพร่องอยู่ หรือช่วยแชร์ความรับผิดชอบ
4. ห้ามปั้นแต่งสถิติหลอกลวง ให้ยึดจากความคิดเห็นจริงและตัวเลขที่ให้มา`
        : `คุณเป็นผู้เชี่ยวชาญด้านนิเทศการจัดกิจกรรมการเรียนรู้และที่ปรึกษาครูผู้สอนระดับสากล
กรุณาวิเคราะห์จุดเด่น (Strengths) และให้คำแนะนำเชิงรุกเชิงปฏิบัติ (Actionable Recommendations) สำหรับครูต่างชาติคนนี้:

ชื่อครู: ${teacherName}

คะแนนเฉลี่ย 5 สถิติมิติการสอน (เต็ม 10 คะแนน):
${scoresSnippet}

ความคิดเห็นจากการสังเกตการสอนเชิงคุณภาพ ( Qualitative Comments from Observers ):
${commentsSnippet}

ข้อกำหนดรูปแบบคำสร้างรายงาน:
1. ตอบกลับด้วยความเคารพ สรุปเป็นภาษาไทยอย่างเป็นมิตร กระชับ และสุภาพ (หากชื่อเป็นครูต่างชาติ ให้อ้างอิงบริบทการปรับตัวเชิงวัฒนธรรมและการจัดการห้องเรียนไทยได้)
2. มีหัวข้อย่อยชัดเจน (ใช้ ### หรือหัวข้อย่อยเพื่อให้อ่านง่ายสอดคล้องกับ UI บล็อก):
   - ### 🌟 มิติจุดเด่นที่ยอดเยี่ยม (Teaching Strengths)
   - ### 💡 แนวทางคำแนะนำในการพัฒนาเชิงรุก (Actionable Development Advice)
   - ### 🎯 กลยุทธ์ห้องเรียนไทยในอนาคต (Thai Classroom Strategies)
3. สำหรับจุดเด่น ให้ระบุด้านที่มีคะแนนสูงสุดหรือได้รับคำชมที่ดีจากความคิดเห็น
4. สำหรับแนวทางแนะนำ ให้เจาะจงจุดที่คะแนนต่ำสุด หรือมีคำเตือน และเขียนเป็นข้อๆ พร้อมคำอธิบายที่มีน้ำหนัก นำไปทำตามได้จริง
5. ห้ามปั้นแต่งสถิติหลอกลวง ให้ยึดจากความคิดเห็นจริงและตัวเลขที่ให้มา`)
      : (role === 'coteacher'
        ? `You are an expert bilingual co-teaching partnership coach and professional development advisor.
Please provide co-teaching insights and collaboration guidelines for the Thai "Co-teacher" (partner teacher) who works alongside this foreign teacher:

Foreign Teacher Name: ${teacherName}

Average score of teaching dimensions (out of 10):
${scoresSnippet}

Qualitative Feedback & Observations comments:
${commentsSnippet}

Output expectations:
1. Format your response into readable paragraphs or clean bullet points using markdown header lines (###) for structure.
2. Group the feedback into these exact headings:
   - ### 🤝 Collaborative Classroom Synergy & Coordination Help
   - ### 💡 Active Support Tactics for Challenging Dimensions
   - ### 🎯 Strategic Co-teaching Activities for Thai Classrooms
3. Reference their metrics and feedback comments to suggest how the Thai Co-teacher can effectively step in, support, translate, or coordinate tasks in the classroom.
4. Keep the tone professional, supportive, and respectful.`
        : `You are an expert international pedagogy observer and teacher development coach.
Please provide a strengths analysis and action-oriented counseling recommendations for this foreign teacher:

Teacher Name: ${teacherName}

Average score of teaching dimensions (out of 10):
${scoresSnippet}

Qualitative Feedback & Observations comments:
${commentsSnippet}

Output expectations:
1. Format your response into readable paragraphs or clean bullet points using markdown header lines (###) for structure.
2. Group the feedback into these exact headings:
   - ### 🌟 Classroom Strengths & Pedagogical Highlights
   - ### 💡 Practical Development Tips & Professional Advice
   - ### 🎯 Thai Student Engagement Strategies
3. Reference their strongest metrics and highlight patterns in their feedback logs.
4. Give concrete, respectful guidance on their lowest metrics and suggest actionable solutions.
5. Absolute respect, professional tone, and localized suggestions for English Program (EP) / Bilingual contexts in Thailand.`);

  try {
    const response = await getAI().models.generateContent({
      model: ANALYSIS_MODEL,
      contents: [{ role: "user", parts: [{ text: promptText }] }],
    });
    return json({ analysis: response.text });
  } catch (error: any) {
    console.error("Teacher analysis error:", error);
    return json({ error: "Failed to compile AI insights" }, 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/chat
// ---------------------------------------------------------------------------
async function chat(req: Request): Promise<Response> {
  const auth = await authenticate(req, { projectId: FIREBASE_PROJECT_ID, allowedDomains: ALLOWED_EMAIL_DOMAINS });
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const body = await readJson(req);
  if (!body) return json({ error: "Invalid JSON body" }, 400);
  const { history, dataContext } = body;
  if (!history || !Array.isArray(history)) {
    return json({ error: "Missing or invalid history array" }, 400);
  }
  const lang = body.lang === "th" ? "th" : "en";

      const isTh = lang === 'th';
    
    // Transform data context into readable text grounding block
    let contextStr = "";
    if (dataContext) {
      if (dataContext.teacherEvaluation) {
        contextStr += `\n[ข้อมูลกำกับติดตามการทำงานครูต่างชาติ / Teacher Monitoring & Observation Data]:\n${JSON.stringify(dataContext.teacherEvaluation).substring(0, 12000)}`;
      }
      if (dataContext.studentEvaluation) {
        contextStr += `\n[ข้อมูลผลประเมินการจัดการเรียนการสอนโดยผู้เรียน / Student Evaluation Data]:\n${JSON.stringify(dataContext.studentEvaluation).substring(0, 12000)}`;
      }
      if (dataContext.schedule) {
        contextStr += `\n[ข้อมูลตารางสอน / Teaching Schedule Data]:\n${JSON.stringify(dataContext.schedule).substring(0, 6000)}`;
      }
      if (dataContext.newsAnnouncements) {
        contextStr += `\n[ข้อมูลข่าวประชาสัมพันธ์ล่าสุด / Latest School News & Announcements]:\n${JSON.stringify(dataContext.newsAnnouncements).substring(0, 3000)}`;
      }
    }

    const systemInstruction = isTh ?
      `คุณคือ "WorkLoop AI" 🪄✨ ที่ปรึกษาอัจฉริยะระบบงานสอน การจัดกิจกรรม และจิตวิทยาในห้องเรียน
คุณวิเคราะห์และให้คำแนะนำจากข้อมูลจริงที่ระบุไว้ในระบบเท่านั้น ห้ามใช้หรือแต่งข้อมูลจำลองเด็ดขาด

แหล่งข้อมูลและลิงก์อ้างอิงของระบบ:
1. [แบบฟอร์มกำกับติดตามการทำงานครูต่างชาติ ภาคเรียนที่ 1/2569]:
   - ลิงก์ตาราง: https://docs.google.com/spreadsheets/d/1evNW1UcflWMYAlwB8bFkGXiLyPilTamkph1sLTVycPU/edit?gid=1626148274#gid=1626148274
   - บันทึกการจัดการเรียนการสอน รายงานการนิเทศการสอน และการปฏิบัติหน้าที่ของครูผู้สอนชาวต่างชาติ

2. [แบบฟอร์มประเมินการทำงานครูต่างชาติโดยผู้เรียน ภาคเรียนที่ 1/2569]:
   - ลิงก์ตาราง: https://docs.google.com/spreadsheets/d/1sUF9nS8f4zkQ9GldUVcU82q0a7Eh83jidLYBamERcI4/edit?gid=959993909#gid=959993909
   - ความคิดเห็น สถิติคะแนนความพึงพอใจ ข้อเสนอแนะ และผลตอบรับรายบุคคลของผู้เรียนที่มีต่อกระบวนการสอนของครูต่างชาติ

ข้อมูลจริงในระบบขณะนี้ (ดึงจากชีตแบบเรียลไทม์):
${contextStr}

คำแนะนำแนวการตอบ:
1. พูดคุยด้วยโทนเสียงที่กระตือรือร้น สุภาพ แฝงความน่ารัก และอบอุ่น (ใช้คำลงท้าย "ค่ะ/นะคะ" เสมอ)
2. เมื่อตอบคำถามเกี่ยวกับสถิติการสอน ข้อมูลครู คะแนน หรือข้อเสนอแนะ ให้ดึงข้อเท็จจริงจริงจากข้อมูลชีตด้านบนมาสรุปตอบกลับอย่างถูกต้องและระบุลิงก์แหล่งที่มาของตารางนั้นๆ อย่างชัดเจน
3. ห้ามแต่งตัวเลข ข้อคิดเห็น สถิติ ครูจำลอง หรือข้อมูลอื่นใดที่ไม่มีอยู่จริงในคลังข้อมูลที่ดึงมาโดยเด็ดขาด หากไม่มีข้อมูลหรือไม่มีการบันทึกไว้ในชีต ให้แจ้งอย่างสุภาพและตรงไปตรงมาว่า "ปัจจุบันข้อมูลส่วนนี้ไม่มีระบุอยู่ในตารางข้อมูลระบบค่ะ" 
4. เน้นการแนะแนวทางจิตวิทยาการศึกษา และการจัดกิจกรรมชั้นเรียนอย่างมีคุณภาพที่ใช้งานได้จริงในห้องเรียน`
      :
      `You are the "WorkLoop AI" 🪄✨ - a brilliant school pedagogy counselor, classroom advisor, and administrative tutor.
You analyze and provide guidance strictly based on the actual system data. Never use or hallucinate mock, simulated, or fake statistics/data.

Official System References & Data Sources (Please display and mention these links where appropriate):
1. [Foreign Teacher Monitoring and Tracking Sheet - Semester 1/2569]:
   - Spreadsheet link: https://docs.google.com/spreadsheets/d/1evNW1UcflWMYAlwB8bFkGXiLyPilTamkph1sLTVycPU/edit?gid=1626148274#gid=1626148274
   - For monitoring lesson logs, classroom inspections, and professional responsibilities of foreign trainers.

2. [Student Evaluation of Foreign Teachers Feedback Sheet - Semester 1/2569]:
   - Spreadsheet link: https://docs.google.com/spreadsheets/d/1sUF9nS8f4zkQ9GldUVcU82q0a7Eh83jidLYBamERcI4/edit?gid=959993909#gid=959993909
   - Collects students' satisfaction metrics, qualitative feedback paragraphs, and teaching quality ratings.

Grounding School Context Data (Fetched live from active system sheets):
${contextStr}

Guidance Rules:
1. Speak in a friendly, extremely supportive, and motivating tone.
2. When answering about teacher evaluations or work monitoring trackers, construct active bullet-summaries using the live context parsed above, and include the official Google Sheets hyperlinks so users can quickly open and view or log further information.
3. NEVER make up statistics, numbers, teacher names, reports, or history. If the requested information is not present in the grounding data, state clearly and politely: "This specific information is currently not recorded in the system."
4. Provide high-quality, actionable pedagogical solutions and classroom management advice.`;

  const mappedContents = history.slice(-30).map((h: any) => ({
    role: h?.role === "assistant" || h?.role === "model" ? "model" : "user",
    parts: (Array.isArray(h?.parts) ? h.parts : []).map((p: any) => ({ text: String(p?.text ?? "").slice(0, 4000) })),
  }));

  try {
    const response = await getAI().models.generateContent({
      model: CHAT_MODEL,
      contents: mappedContents,
      config: { systemInstruction, temperature: 0.7 },
    });
    return json({ reply: response.text });
  } catch (error: any) {
    console.error("Chatbot generation error:", error);
    return json({ error: "Failed to generate AI chat reply" }, 500);
  }
}

// ---------------------------------------------------------------------------
// GET /api/gsheets/:id  (proxy to Google Sheets / Drive using the caller's own Google token)
// ---------------------------------------------------------------------------
type CacheEntry = { data: any; timestamp: number };
// Best effort only: serverless instances are short-lived and not shared.
const sheetsCache = new Map<string, CacheEntry>();
const CACHE_TTL = 3000;
const metadataCache = new Map<string, CacheEntry>();
const METADATA_CACHE_TTL = 3600000;

async function fetchWithRetry(url: string, options: RequestInit, retries = 2, delay = 1000): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, options);
      if ((response.status === 429 || response.status === 503) && i < retries) {
        console.warn(`[Retry] Google API status ${response.status}. Retrying in ${delay}ms (${i + 1}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      return response;
    } catch (err: any) {
      if (i < retries) {
        console.warn(`[Retry] Network error: ${err.message}. Retrying in ${delay}ms (${i + 1}/${retries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed to fetch after retries");
}

async function gsheets(req: Request, id: string, url: URL): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(id)) return json({ error: "Invalid spreadsheet id" }, 400);

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "No authorization header" }, 401);
  const token = authHeader.split(" ")[1];
  if (!token) return json({ error: "No token provided" }, 401);
  if (token === "GUEST_SESSION_TOKEN") return json({ error: "Guest sessions cannot use live Google access" }, 403);

  const gid = url.searchParams.get("gid");
  if (gid !== null && !/^\d{1,12}$/.test(gid)) return json({ error: "Invalid gid" }, 400);

  // The cache is keyed by a hash of the caller's full token, so one user can never be served
  // data that was fetched with another user's permissions.
  const tokenHash = createHash("sha256").update(token).digest("hex").slice(0, 32);
  const cacheKey = `${id}${gid ? `-${gid}` : ""}-${tokenHash}`;
  const metaKey = `${id}-${tokenHash}`;

  const forceRefresh = url.searchParams.get("force") === "true";
  const cached = sheetsCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return json(cached.data);
  }

  try {
    let metadata: any = null;
    const cachedMeta = metadataCache.get(metaKey);
    if (cachedMeta && Date.now() - cachedMeta.timestamp < METADATA_CACHE_TTL) {
      metadata = cachedMeta.data;
    } else {
      const metadataResponse = await fetchWithRetry(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}?includeGridData=false`,
        { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
      );
      metadata = await metadataResponse.json();

      if (!metadataResponse.ok) {
        const isOfficeFile =
          metadataResponse.status === 400 &&
          typeof metadata?.error?.message === "string" &&
          metadata.error.message.includes("must not be an Office file");

        if (!isOfficeFile && cached) {
          console.warn(`[Cache Fallback] Google API status ${metadataResponse.status}. Returning cached data.`);
          return json(cached.data);
        }

        if (isOfficeFile) {
          // Excel file stored in Drive: download it and parse it ourselves.
          let excelTitle = "Teaching Schedule (Excel)";
          try {
            const fileMetaResponse = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files/${id}`, {
              headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
            });
            if (fileMetaResponse.ok) {
              const fileMeta: any = await fileMetaResponse.json();
              if (fileMeta?.name) excelTitle = fileMeta.name;
            }
          } catch (metaErr) {
            console.error("Failed to fetch Excel metadata from Drive:", metaErr);
          }

          const driveResponse = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!driveResponse.ok) {
            if (cached) return json(cached.data);
            const driveErrText = await driveResponse.text();
            return json(
              {
                error: `Excel file detected but failed to download from Google Drive: ${driveResponse.statusText}`,
                details: driveErrText,
              },
              driveResponse.status,
            );
          }

          const buffer = Buffer.from(await driveResponse.arrayBuffer());
          const workbook = XLSX.read(buffer, { type: "buffer" });
          if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return json({ error: "No sheets found in the downloaded Excel file" }, 404);
          }

          let sheetName = workbook.SheetNames[0];
          const commonNames = ["schedule", "ตาราง", "teach", "สอน", "table", "class"];
          const foundMatch = workbook.SheetNames.find((name) =>
            commonNames.some((term) => name.toLowerCase().includes(term)),
          );
          if (foundMatch) sheetName = foundMatch;

          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) return json({ error: `Sheet "${sheetName}" not found in Excel file` }, 404);

          const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          const values: string[][] = rawRows.map((row: any) =>
            Array.isArray(row) ? row.map((val: any) => (val !== undefined && val !== null ? String(val) : "")) : [],
          );

          const responseData = { title: excelTitle, values };
          sheetsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
          return json(responseData);
        }

        return json(
          {
            error: metadata?.error?.message || "Failed to fetch spreadsheet metadata",
            status: metadataResponse.status,
            details: metadata,
          },
          metadataResponse.status,
        );
      }

      metadataCache.set(metaKey, { data: metadata, timestamp: Date.now() });
    }

    let sheetName = metadata.sheets?.[0]?.properties?.title;
    if (gid !== null) {
      const matchingSheet = metadata.sheets?.find((s: any) => s.properties?.sheetId === Number(gid));
      if (matchingSheet) sheetName = matchingSheet.properties?.title;
    }
    if (!sheetName) return json({ error: "No sheets found" }, 404);

    const valuesResponse = await fetchWithRetry(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(sheetName)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
    );
    const valuesData: any = await valuesResponse.json();

    if (!valuesResponse.ok) {
      if (cached) return json(cached.data);
      return json(
        {
          error: valuesData?.error?.message || "Failed to fetch values",
          status: valuesResponse.status,
          details: valuesData,
        },
        valuesResponse.status,
      );
    }

    const responseData = { title: metadata.properties?.title, values: valuesData.values || [] };
    sheetsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    return json(responseData);
  } catch (error: any) {
    console.error("Sheets proxy unexpected error:", error);
    if (cached) return json(cached.data);
    return json({ error: "Internal Server Error" }, 500);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  // Works whether the request arrives as /api/... or as /.netlify/functions/api/...
  const apiIndex = url.pathname.indexOf("/api/");
  const path = (apiIndex >= 0 ? url.pathname.slice(apiIndex) : url.pathname).replace(/\/+$/, "");

  try {
    if (req.method === "GET" && path === "/api/health") return json({ status: "ok" });

    if (req.method === "GET" && path.startsWith("/api/gsheets/")) {
      const id = decodeURIComponent(path.slice("/api/gsheets/".length));
      return await gsheets(req, id, url);
    }
    if (req.method === "POST" && path === "/api/analyze-teacher") return await analyzeTeacher(req);
    if (req.method === "POST" && path === "/api/chat") return await chat(req);

    return json({ error: "Not found" }, 404);
  } catch (error: any) {
    console.error("Uncaught API error:", error);
    return json({ error: "Internal Server Error" }, 500);
  }
};
