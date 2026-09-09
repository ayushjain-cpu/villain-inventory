export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1rRJPFefx_fKLeqJIlsQgu9GKTqimGJhC8GNGPchij-A';
  const B2B_GID  = '1352994444';
  const B2C_GID  = '1431205073';
  const ASN_GID  = '635966600';

  function parseRow(r, hasChannel) {
    const o = hasChannel ? 1 : 0;
    return {
      style:          r[0].trim(),
      ean:            (r[1] || '').trim(),
      channelTag:     hasChannel ? (r[2] || '').trim() : null,
      totalSOH:       n(r[2+o]), sohGGN: n(r[3+o]), sohBHW: n(r[4+o]), sohBLR: n(r[5+o]),
      totalDRR:       n(r[6+o]), drrGGN: n(r[7+o]), drrBHW: n(r[8+o]), drrBLR: n(r[9+o]),
      totalDOC:       n(r[10+o]), docGGN: n(r[11+o]), docBHW: n(r[12+o]), docBLR: n(r[13+o]),
      totalIntransit: n(r[14+o]), intGGN: n(r[15+o]), intBHW: n(r[16+o]), intBLR: n(r[17+o]),
      docIntTotal:    n(r[18+o]), docIntGGN: n(r[19+o]), docIntBHW: n(r[20+o]), docIntBLR: n(r[21+o]),
    };
  }

  async function fetchInventoryTab(gid, hasChannel) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    if (req.query.debug) return { headers: parseCSVLine(lines[2]), row4: parseCSVLine(lines[3]) };
    return lines.slice(3).map(l => parseCSVLine(l))
      .filter(r => r[0] && r[0].trim() !== '')
      .map(r => parseRow(r, hasChannel));
  }

  async function fetchASN() {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${ASN_GID}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`ASN fetch failed: ${response.status}`);
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());

    if (req.query.debug_asn) {
      const iStatus = headers.indexOf('asn_status');
      const statusVals = [...new Set(
        lines.slice(1).map(l => parseCSVLine(l)[iStatus] || '').filter(Boolean)
      )];
      return { headers, totalRows: lines.length - 1, uniqueStatuses: statusVals };
    }

    const iStatus  = headers.indexOf('asn_status');
    const iStyle   = headers.indexOf('sku_style_id');
    const iWH      = headers.indexOf('warehouse_location');
    const iEDD     = headers.indexOf('expected_delivery_date');
    const iActual  = headers.indexOf('actual_delivery_date');
    const iQty     = headers.indexOf('packing_list_qty');

    // Today's date in IST (UTC+5:30) as YYYY-MM-DD
    const now = new Date();
    const istOffset = 5.5 * 60 * 60000;
    const todayIST = new Date(now.getTime() + istOffset).toISOString().slice(0, 10);

    const VALID = new Set(['approved', 'dispatched', 'ops_approval_pending']);

    const allRows = lines.slice(1)
      .map(l => parseCSVLine(l))
      .filter(r => r[iStyle] && r[iStyle].trim());

    // ASN active (APPROVED / DISPATCHED / OPS_APPROVAL_PENDING)
    const asnRows = allRows
      .filter(r => VALID.has((r[iStatus] || '').trim().toLowerCase()))
      .map(r => ({
        style:  r[iStyle].trim(),
        wh:     (r[iWH] || '').trim(),
        edd:    (r[iEDD] || '').trim(),
        qty:    n(r[iQty]),
        status: (r[iStatus] || '').trim().toUpperCase(),
      }));

    // Dedupe ASN at style × wh × edd
    const asnMap = {};
    asnRows.forEach(r => {
      const key = `${r.style}||${r.wh}||${r.edd}`;
      if (asnMap[key]) asnMap[key].qty += r.qty;
      else asnMap[key] = { ...r };
    });
    const asn = Object.values(asnMap).sort((a, b) =>
      a.style !== b.style ? a.style.localeCompare(b.style) :
      a.edd !== b.edd ? a.edd.localeCompare(b.edd) :
      a.wh.localeCompare(b.wh)
    );

    // Delivered today: status=DELIVERED AND actual_delivery_date = today (IST)
    const deliveredRows = allRows
      .filter(r => {
        const status = (r[iStatus] || '').trim().toLowerCase();
        const actualDate = (r[iActual] || '').trim().slice(0, 10); // take YYYY-MM-DD part
        return status === 'delivered' && actualDate === todayIST;
      })
      .map(r => ({
        style:      r[iStyle].trim(),
        wh:         (r[iWH] || '').trim(),
        actualDate: (r[iActual] || '').trim(),
        qty:        n(r[iQty]),
        status:     'DELIVERED',
      }));

    // Dedupe delivered at style × wh × actualDate
    const delMap = {};
    deliveredRows.forEach(r => {
      const key = `${r.style}||${r.wh}||${r.actualDate}`;
      if (delMap[key]) delMap[key].qty += r.qty;
      else delMap[key] = { ...r };
    });
    const asnDelivered = Object.values(delMap).sort((a, b) =>
      a.style !== b.style ? a.style.localeCompare(b.style) : a.wh.localeCompare(b.wh)
    );

    return { asn, asnDelivered, todayIST };
  }

  try {
    if (req.query.debug_asn) {
      return res.status(200).json(await fetchASN());
    }
    const [b2b, b2c, asnData] = await Promise.all([
      fetchInventoryTab(B2B_GID, true),
      fetchInventoryTab(B2C_GID, false),
      fetchASN(),
    ]);
    if (req.query.debug) return res.status(200).json({ b2b, b2c });
    res.status(200).json({ b2b, b2c, asn: asnData.asn, asnDelivered: asnData.asnDelivered, updatedAt: new Date().toISOString() });
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
