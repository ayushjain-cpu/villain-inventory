export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  const SHEET_ID = process.env.GOOGLE_SHEET_ID;
  if (!SHEET_ID) return res.status(500).json({ error: 'GOOGLE_SHEET_ID not set' });

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);
    const csvText = await response.text();

    const lines = csvText.trim().split('\n');

    // Headers are on row 4 (index 3), data starts row 5 (index 4)
    const headers = parseCSVLine(lines[3]);

    if (req.query.debug) {
      return res.status(200).json({ headers, row5: lines[4] ? parseCSVLine(lines[4]) : [] });
    }

    const rows = lines.slice(4).map(line => {
      const vals = parseCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
      return obj;
    });

    const findCol = (row, ...keywords) => {
      const key = Object.keys(row).find(k =>
        keywords.every(kw => k.toLowerCase().includes(kw.toLowerCase()))
      );
      return key ? row[key] : '0';
    };

    const skus = rows
      .filter(r => {
        const sk = Object.keys(r).find(k => k.trim().toLowerCase() === 'style');
        return sk && r[sk] && r[sk].trim() !== '';
      })
      .map(r => {
        const sk = Object.keys(r).find(k => k.trim().toLowerCase() === 'style');
        const apr = n(findCol(r, 'apr'));
        const may = n(findCol(r, 'may'));
        const avg = (apr + may) / 2;
        const mrp = n(findCol(r, 'mrp'));
        const sor = n(findCol(r, 'sor'));
        const b2c = n(findCol(r, 'b2c'));
        const totalSOH = mrp + sor + b2c;
        const doc = avg > 0 ? (totalSOH / avg) * 30 : null;
        return {
          style: r[sk].trim(),
          apr, may,
          mtd: n(findCol(r, 'mtd')),
          mrp, sor, b2c, totalSOH, avg, doc
        };
      });

    res.status(200).json({ skus, updatedAt: new Date().toISOString() });
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
