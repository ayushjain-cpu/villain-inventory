export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1rRJPFefx_fKLeqJIlsQgu9GKTqimGJhC8GNGPchij-A';
  const B2B_GID  = '1352994444';
  const B2C_GID  = '1431205073';

  // B2B: 0=Style, 1=EAN, 2=Channel Tagging, 3=TotalSOH, 4=GGN, 5=BHW, 6=BLR, 7=TotalDRR, 8=GGN, 9=BHW, 10=BLR, 11=TotalDOC, 12=GGN, 13=BHW, 14=BLR, 15=TotalIntransit, 16=GGN, 17=BHW, 18=BLR, 19=DocInt, 20=GGN, 21=BHW, 22=BLR
  // B2C: 0=Style, 1=EAN, NO channel, 2=TotalSOH, 3=GGN, 4=BHW, 5=BLR, 6=TotalDRR, 7=GGN, 8=BHW, 9=BLR, 10=TotalDOC, 11=GGN, 12=BHW, 13=BLR, 14=TotalIntransit, 15=GGN, 16=BHW, 17=BLR, 18=DocInt, 19=GGN, 20=BHW, 21=BLR

  function parseRow(r, hasChannel) {
    const o = hasChannel ? 1 : 0; // offset
    return {
      style:          r[0].trim(),
      ean:            (r[1] || '').trim(),
      channelTag:     hasChannel ? (r[2] || '').trim() : null,
      totalSOH:       n(r[2 + o]),
      sohGGN:         n(r[3 + o]),
      sohBHW:         n(r[4 + o]),
      sohBLR:         n(r[5 + o]),
      totalDRR:       n(r[6 + o]),
      drrGGN:         n(r[7 + o]),
      drrBHW:         n(r[8 + o]),
      drrBLR:         n(r[9 + o]),
      totalDOC:       n(r[10 + o]),
      docGGN:         n(r[11 + o]),
      docBHW:         n(r[12 + o]),
      docBLR:         n(r[13 + o]),
      totalIntransit: n(r[14 + o]),
      intGGN:         n(r[15 + o]),
      intBHW:         n(r[16 + o]),
      intBLR:         n(r[17 + o]),
      docIntTotal:    n(r[18 + o]),
      docIntGGN:      n(r[19 + o]),
      docIntBHW:      n(r[20 + o]),
      docIntBLR:      n(r[21 + o]),
    };
  }

  async function fetchTab(gid, hasChannel) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');

    if (req.query.debug) {
      return { headers: parseCSVLine(lines[2]), row4: parseCSVLine(lines[3]) };
    }

    return lines.slice(3)
      .map(line => parseCSVLine(line))
      .filter(r => r[0] && r[0].trim() !== '')
      .map(r => parseRow(r, hasChannel));
  }

  try {
    const [b2b, b2c] = await Promise.all([
      fetchTab(B2B_GID, true),
      fetchTab(B2C_GID, false)
    ]);
    if (req.query.debug) return res.status(200).json({ b2b, b2c });
    res.status(200).json({ b2b, b2c, updatedAt: new Date().toISOString() });
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
  const result = []; let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; }
    else if (ch === ',' && !inQuote) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur); return result;
}
