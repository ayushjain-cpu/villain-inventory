export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1rRJPFefx_fKLeqJIlsQgu9GKTqimGJhC8GNGPchij-A';
  const B2B_GID  = '1352994444';
  const B2C_GID  = '1431205073';

  // Column positions (0-indexed), same for both tabs:
  // 0=Style, 1=EAN, 2=Channel Tagging
  // SOH: 3=Total WH SOH, 4=GGN, 5=BHW, 6=BLR
  // DRR: 7=Total DRR, 8=GGN, 9=BHW, 10=BLR
  // DOC: 11=Total DOC, 12=GGN, 13=BHW, 14=BLR
  // Intransit(STN+Factory): 15=Total, 16=GGN, 17=BHW, 18=BLR
  // DOC with Intransit: 19=Total, 20=GGN, 21=BHW, 22=BLR

  async function fetchTab(gid) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');

    if (req.query.debug) {
      return {
        line0: parseCSVLine(lines[0]),
        line1: parseCSVLine(lines[1]),
        line2: parseCSVLine(lines[2]),
        line3: parseCSVLine(lines[3]),
        totalLines: lines.length
      };
    }

    return lines.slice(3)
      .map(line => parseCSVLine(line))
      .filter(r => r[0] && r[0].trim() !== '')
      .map(r => ({
        style:          r[0].trim(),
        ean:            (r[1] || '').trim(),
        channelTag:     (r[2] || '').trim(),
        // SOH
        totalSOH:       n(r[3]),
        sohGGN:         n(r[4]),
        sohBHW:         n(r[5]),
        sohBLR:         n(r[6]),
        // DRR
        totalDRR:       n(r[7]),
        drrGGN:         n(r[8]),
        drrBHW:         n(r[9]),
        drrBLR:         n(r[10]),
        // DOC
        totalDOC:       n(r[11]),
        docGGN:         n(r[12]),
        docBHW:         n(r[13]),
        docBLR:         n(r[14]),
        // Intransit
        totalIntransit: n(r[15]),
        intGGN:         n(r[16]),
        intBHW:         n(r[17]),
        intBLR:         n(r[18]),
        // DOC with Intransit
        docIntTotal:    n(r[19]),
        docIntGGN:      n(r[20]),
        docIntBHW:      n(r[21]),
        docIntBLR:      n(r[22]),
      }));
  }

  try {
    const [b2b, b2c] = await Promise.all([fetchTab(B2B_GID), fetchTab(B2C_GID)]);
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
