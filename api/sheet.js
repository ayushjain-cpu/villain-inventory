export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1rRJPFefx_fKLeqJIlsQgu9GKTqimGJhC8GNGPchij-A';
  const B2B_GID  = '1352994444';
  const B2C_GID  = '1431205073';

  // From debug output, column positions (0-indexed) for both tabs:
  // 0=Style, 1=EAN, 2=Channel Tagging
  // SOH: 3=Total WH SOH, 4=GGN, 5=BHW, 6=BLR
  // DRR: 7=Total DRR, 8=GGN, 9=BHW, 10=BLR
  // DOC: 11=Total DOC, 12=GGN, 13=BHW, 14=BLR
  // Intransit: 15=Total Intransit, 16=GGN, 17=BHW, 18=BLR

  async function fetchTab(gid) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');

    if (req.query.debug) {
      return {
        headers: parseCSVLine(lines[2]),
        groupRow: parseCSVLine(lines[0]),
        row4: parseCSVLine(lines[3])
      };
    }

    // Row 3 = headers (index 2), data starts row 4 (index 3)
    const skus = lines.slice(3)
      .map(line => parseCSVLine(line))
      .filter(r => r[0] && r[0].trim() !== '')
      .map(r => ({
        style:          r[0].trim(),
        ean:            r[1] ? r[1].trim() : '',
        channelTag:     r[2] ? r[2].trim() : '',
        totalSOH:       n(r[3]),
        sohGGN:         n(r[4]),
        sohBHW:         n(r[5]),
        sohBLR:         n(r[6]),
        totalDRR:       n(r[7]),
        drrGGN:         n(r[8]),
        drrBHW:         n(r[9]),
        drrBLR:         n(r[10]),
        totalDOC:       n(r[11]),
        docGGN:         n(r[12]),
        docBHW:         n(r[13]),
        docBLR:         n(r[14]),
        totalIntransit: n(r[15]),
        intGGN:         n(r[16]),
        intBHW:         n(r[17]),
        intBLR:         n(r[18]),
      }));

    return skus;
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
