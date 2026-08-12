export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1rRJPFefx_fKLeqJIlsQgu9GKTqimGJhC8GNGPchij-A';
  const B2B_GID  = '1352994444';
  const B2C_GID  = '1431205073';

  async function fetchTab(gid) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    const csvText = await res.text();
    const lines = csvText.trim().split('\n');
    // Row 1 = group headers (SOH/DRR/DOC/Intransit)
    // Row 2 = totals row
    // Row 3 = column headers (index 2)
    // Row 4+ = data (index 3+)
    const groupRow   = parseCSVLine(lines[0]);
    const headers    = parseCSVLine(lines[2]);
    // Build column index map
    const idx = {};
    headers.forEach((h, i) => { idx[h.trim()] = i; });

    if (req.query.debug) return { headers, groupRow, row4: parseCSVLine(lines[3]) };

    const rows = lines.slice(3).map(line => parseCSVLine(line));
    const skus = rows
      .filter(r => r[idx['Style']] && r[idx['Style']].trim() !== '')
      .map(r => {
        const g = (col) => r[idx[col]] !== undefined ? r[idx[col]].trim() : '';
        return {
          style:         g('Style'),
          ean:           g('EAN'),
          channelTag:    g('Channel Tagging'),
          totalSOH:      n(g('Total WH SOH')),
          sohGGN:        n(g('GGN')),   // first GGN = SOH
          sohBHW:        n(g('BHW')),
          sohBLR:        n(g('BLR')),
          totalDRR:      n(g('Total DRR')),
          totalDOC:      n(g('Total DOC')),
          totalIntransit:n(g('Total Intransit')),
        };
      });
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
