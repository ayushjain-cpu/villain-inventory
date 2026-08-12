export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const SHEET_ID   = process.env.GOOGLE_SHEET_ID || '1rRJPFefx_fKLeqJIlsQgu9GKTqimGJhC8GNGPchij-A';
  const B2B_GID    = '1352994444';
  const B2C_GID    = '1431205073';

  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

  const { message, history = [], activeTab = 'b2b' } = req.body || {};
  if (!message) return res.status(400).json({ error: 'No message provided' });

  async function fetchTab(gid) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const csvText = await r.text();
    const lines = csvText.trim().split('\n');
    const headers = parseCSVLine(lines[2]);
    const idx = {};
    headers.forEach((h, i) => { idx[h.trim()] = i; });
    return lines.slice(3).map(line => parseCSVLine(line))
      .filter(r => r[idx['Style']] && r[idx['Style']].trim() !== '')
      .map(r => {
        const g = (col) => r[idx[col]] !== undefined ? r[idx[col]].trim() : '0';
        return `${r[idx['Style']].trim()}: SOH=${g('Total WH SOH')}, GGN=${g('GGN')}, BHW=${g('BHW')}, BLR=${g('BLR')}, DRR=${g('Total DRR')}, DOC=${g('Total DOC')}d, Intransit=${g('Total Intransit')}`;
      });
  }

  try {
    const gid = activeTab === 'b2c' ? B2C_GID : B2B_GID;
    const skus = await fetchTab(gid);
    const tabLabel = activeTab === 'b2c' ? 'B2C' : 'B2B';

    const systemPrompt = `You are an expert inventory analyst for Villain, a fragrance brand. You are helping the team run their weekly ${tabLabel} inventory review.

DOC = Days of Cover = Total SOH ÷ Daily Run Rate × 1 (already pre-calculated in data)
GGN = Gurugram warehouse, BHW = Bhiwandi warehouse, BLR = Bangalore warehouse
DRR = Daily Run Rate

Current ${tabLabel} inventory data:
${skus.join('\n')}

Be concise, direct, and actionable. No markdown bold. Surface risks and flag low DOC SKUs proactively.`;

    const contents = [
      ...history.slice(-6).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig: { maxOutputTokens: 1000, temperature: 0.3 } }) }
    );
    const geminiData = await geminiRes.json();
    const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) throw new Error('No Gemini response');
    res.status(200).json({ reply });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

function parseCSVLine(line) {
  const result = []; let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur); return result;
}
