import { GoogleGenAI } from "@google/genai";
import * as XLSX from "xlsx";

// Minimal request/response shapes shared by the Express dev server and the Netlify Function adapter
export interface ApiRequest {
  params: Record<string, string>;
  query: Record<string, any>;
  headers: Record<string, any>;
  body: any;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  json(data: any): any;
}

export type ApiHandler = (req: ApiRequest, res: ApiResponse) => any;

export interface ApiRouter {
  get(path: string, handler: ApiHandler): void;
  post(path: string, handler: ApiHandler): void;
}

export function registerApiRoutes(app: ApiRouter) {
  // Reads GEMINI_API_KEY (and GOOGLE_GEMINI_BASE_URL when running on Netlify AI Gateway) from the environment
  const ai = new GoogleGenAI({});

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // AI Analysis Route
  app.post("/api/analyze", async (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "No data provided" });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Analyze this spreadsheet data and provide a concise summary of the key trends and insights. 
                Format the output as a few short bullet points in a professional tone. 
                The data is: ${JSON.stringify(data.slice(0, 50))}`
              }
            ]
          }
        ]
      });

      res.json({ analysis: response.text });
    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ error: "Failed to analyze data", message: error.message });
    }
  });

  // AI Teacher Strengths & Recommendations Analytical Route
  app.post("/api/analyze-teacher", async (req, res) => {
    const { teacherName, averageScores, comments, lang, role } = req.body;
    if (!averageScores) return res.status(400).json({ error: "No averageScores provided" });

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
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: promptText
              }
            ]
          }
        ]
      });

      res.json({ analysis: response.text });
    } catch (error: any) {
      console.error("Teacher analysis error:", error);
      res.status(500).json({ error: "Failed to compile AI insights", message: error.message });
    }
  });

  // Simple in-memory cache for Sheets data
  const sheetsCache = new Map<string, { data: any, timestamp: number }>();
  const CACHE_TTL = 3000; // 3 seconds real-time cache for fresh updates and responsive live sync

  // Simple in-memory cache for spreadsheet metadata
  const metadataCache = new Map<string, { data: any, timestamp: number }>();
  const METADATA_CACHE_TTL = 3600000; // 1 hour metadata cache to eliminate redundant schema queries

  // Simple in-memory retry mechanism for Google Sheets API (handles 429 and 503)
  async function fetchWithRetry(url: string, options: any, retries = 2, delay = 1000): Promise<Response> {
    for (let i = 0; i <= retries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.status === 429 || response.status === 503) {
          if (i < retries) {
            console.warn(`[Retry helper] Got status ${response.status} from Google API. Retrying in ${delay}ms... (Attempt ${i + 1} of ${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2; // exponential backoff
            continue;
          }
        }
        return response;
      } catch (err: any) {
        if (i < retries) {
          console.warn(`[Retry helper] Network error fetching Google API: ${err.message}. Retrying in ${delay}ms... (Attempt ${i + 1} of ${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        throw err;
      }
    }
    throw new Error("Failed to fetch after retries");
  }

  // Google Sheets Proxy Route
  app.get("/api/gsheets/:id", async (req, res) => {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "No authorization header" });
    
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "No token provided" });

    const gidParamStr = req.query.gid ? `-${req.query.gid}` : '';
    const cacheKey = `${id}${gidParamStr}-${token.substring(token.length - 1)}`;
    
    // Support force query param for live, real-time bypass of CacheTTL
    const forceRefresh = req.query.force === 'true';
    const cached = sheetsCache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json(cached.data);
    }

    try {
      let metadata: any = null;
      const cachedMeta = metadataCache.get(id);
      if (cachedMeta && (Date.now() - cachedMeta.timestamp < METADATA_CACHE_TTL)) {
        metadata = cachedMeta.data;
      } else {
        const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${id}?includeGridData=false`;
        const metadataResponse = await fetchWithRetry(metadataUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        metadata = await metadataResponse.json();

        if (!metadataResponse.ok) {
          const isOfficeFile = metadataResponse.status === 400 && 
                               metadata && 
                               metadata.error && 
                               typeof metadata.error.message === 'string' && 
                               metadata.error.message.includes("must not be an Office file");

          // Stale cache fallback if not an Office file and API rate limited/errored
          if (!isOfficeFile && cached) {
            console.warn(`[Cache Fallback] Google API responded with error status ${metadataResponse.status}. Returning cached data instead.`);
            return res.json(cached.data);
          }

          if (isOfficeFile) {
            console.log(`Document ${id} is an Office/Excel file. Downloading raw file from Google Drive API as fallback...`);
            
            // 1. Fetch file name/title first from Drive API
            let excelTitle = "Teaching Schedule (Excel)";
            try {
              const fileMetaResponse = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files/${id}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Accept': 'application/json'
                }
              });
              if (fileMetaResponse.ok) {
                const fileMeta = await fileMetaResponse.json();
                if (fileMeta && fileMeta.name) {
                  excelTitle = fileMeta.name;
                }
              }
            } catch (metaErr) {
              console.error("Failed to fetch Excel metadata from Drive:", metaErr);
            }

            // 2. Fetch the raw file bytes
            const driveResponse = await fetchWithRetry(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });

            if (!driveResponse.ok) {
              if (cached) {
                console.warn("[Cache Fallback] Excel drive fetch failed. Returning cached data instead.");
                return res.json(cached.data);
              }
              const driveErrText = await driveResponse.text();
              return res.status(driveResponse.status).json({
                error: `Excel file detected but failed to download from Google Drive: ${driveResponse.statusText}`,
                details: driveErrText
              });
            }

            const arrayBuffer = await driveResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // 3. Parse via XLSX
            const workbook = XLSX.read(buffer, { type: 'buffer' });

            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
              return res.status(404).json({ error: "No sheets found in the downloaded Excel file" });
            }

            let sheetName = workbook.SheetNames[0];
            
            // Try to look for common teaching/schedule sheet names
            const commonNames = ["schedule", "ตาราง", "teach", "สอน", "table", "class"];
            const foundMatch = workbook.SheetNames.find(name => 
              commonNames.some(term => name.toLowerCase().includes(term))
            );
            if (foundMatch) {
              sheetName = foundMatch;
            }

            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) {
              return res.status(404).json({ error: `Sheet "${sheetName}" not found in Excel file` });
            }

            // Convert to 2D array matrix of strings
            const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            
            const values: string[][] = rawRows.map((row: any) => {
              if (!Array.isArray(row)) return [];
              return row.map((val: any) => (val !== undefined && val !== null) ? String(val) : '');
            });

            const responseData = {
              title: excelTitle,
              values: values
            };

            sheetsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
            return res.json(responseData);
          }

          return res.status(metadataResponse.status).json({
            error: metadata.error?.message || "Failed to fetch spreadsheet metadata",
            status: metadataResponse.status,
            details: metadata
          });
        }

        // Cache successful metadata
        metadataCache.set(id, { data: metadata, timestamp: Date.now() });
      }

      let sheetName = metadata.sheets?.[0]?.properties?.title;
      const gidParam = req.query.gid ? Number(req.query.gid) : null;
      if (gidParam !== null && !isNaN(gidParam)) {
        const matchingSheet = metadata.sheets?.find((s: any) => s.properties?.sheetId === gidParam);
        if (matchingSheet) {
          sheetName = matchingSheet.properties?.title;
        }
      }

      if (!sheetName) return res.status(404).json({ error: "No sheets found" });

      const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${encodeURIComponent(sheetName)}`;
      const valuesResponse = await fetchWithRetry(valuesUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      const valuesData = await valuesResponse.json();

      if (!valuesResponse.ok) {
        if (cached) {
          console.warn(`[Cache Fallback] Values API responded with error status ${valuesResponse.status}. Returning cached data instead.`);
          return res.json(cached.data);
        }
        return res.status(valuesResponse.status).json({
          error: valuesData.error?.message || "Failed to fetch values",
          status: valuesResponse.status,
          details: valuesData
        });
      }

      const responseData = {
        title: metadata.properties?.title,
        values: valuesData.values || [],
      };

      sheetsCache.set(cacheKey, { data: responseData, timestamp: Date.now() });
      res.json(responseData);
    } catch (error: any) {
      console.error("Sheets proxy unexpected error:", error);
      if (cached) {
        console.warn("[Cache Fallback] Serving expired cached data due to exception:", error.message);
        return res.json(cached.data);
      }
      res.status(500).json({ error: "Internal Server Error", message: error.message });
    }
  });

  // AI Chatbot Route
  app.post("/api/chat", async (req, res) => {
    const { history, dataContext, lang } = req.body;
    if (!history || !Array.isArray(history)) {
      return res.status(400).json({ error: "Missing or invalid history array" });
    }

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

    // Map roles: 'model' in clients -> 'model' inside contents array
    const mappedContents = history.map((h: any) => ({
      role: h.role === 'assistant' || h.role === 'model' ? 'model' : 'user',
      parts: h.parts.map((p: any) => ({ text: p.text }))
    }));

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: mappedContents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ reply: response.text });
    } catch (error: any) {
      console.error("Chatbot generation error:", error);
      res.status(500).json({ error: "Failed to generate AI chat reply", message: error.message });
    }
  });
}
