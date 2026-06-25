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

    // Exact column names from the sheet
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
        const doc = avg > 0 ? (totalSOH / avg) * 30 : null;
        return {
          style: r['Style'].trim(),
          apr, may,
          mtd: n(r["Jun'26 MTD"]),
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
