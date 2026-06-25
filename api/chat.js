export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const SHEET_ID   = process.env.GOOGLE_SHEET_ID;

  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });
  if (!SHEET_ID)   return res.status(500).json({ error: 'GOOGLE_SHEET_ID not set' });

  const { message, history = [] } = req.body || {};
  if (!message) return res.status(400).json({ error: 'No message provided' });

  try {
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
    const sheetRes = await fetch(sheetUrl);
    let dataContext = '';

    if (sheetRes.ok) {
      const csvText = await sheetRes.text();
      const lines = csvText.trim().split('\n');
      // Headers on row 4 (index 3), data from row 5 (index 4)
      const headers = parseCSVLine(lines[3]);

      const rows = lines.slice(4).map(line => {
        const vals = parseCSVLine(line);
        const obj = {};
        headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
        return obj;
      });

      const skus = rows
        .filter(r => r['Style'] && r['Style'].trim() !== '')
        .map(r => {
          const apr = n(r["Apr'26 Sales"]);
          const may = n(r["May'26 Sales"]);
          const avg = (apr + may) / 2;
          const mrp = n(r['New MRP WH SOH']);
          const sor = n(r['SOR SOH']);
          const b2c = n(r['Total B2C WH SOH']);
          const totalSOH = mrp + sor + b2c;
          const doc = avg > 0 ? Math.round((totalSOH / avg) * 30) : null;
          return `${r['Style'].trim()}: MRP SOH=${mrp}, SOR SOH=${sor}, B2C SOH=${b2c}, Total SOH=${totalSOH}, Apr Sales=${apr}, May Sales=${may}, Jun MTD=${n(r["Jun'26 MTD"])}, Avg Sales=${Math.round(avg)}, DOC=${doc !== null ? doc + 'd' : 'N/A'}`;
        });

      dataContext = skus.join('\n');
    }

    const systemPrompt = `You are an expert inventory analyst for Villain, a consumer brand. You help the team run weekly inventory review meetings.

DOC (Days of Cover) = (MRP SOH + SOR SOH + B2C SOH) ÷ Average Monthly Sales × 30
Thresholds: STOCKOUT = 0d | CRITICAL ≤ 15d | LOW ≤ 30d | HEALTHY ≤ 60d | OVERSTOCK > 60d

Current inventory data:
${dataContext}

Be concise, direct, and actionable. Highlight risks clearly. Flag critical SKUs proactively. Keep answers to 3-6 sentences unless more detail is asked for. Do not use markdown bold (**) in your responses.`;

    const contents = [
      ...history.slice(-6).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { maxOutputTokens: 1000, temperature: 0.3 }
        })
      }
    );

    const geminiData = await geminiRes.json();
    const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error('No response from Gemini: ' + JSON.stringify(geminiData));

    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function n(v) {
  if (!v) return 0;
  const x = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(x) ? 0 : x;
}

function parseCSVLine(line) {
  const result = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}
