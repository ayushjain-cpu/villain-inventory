import { useState, useRef, useEffect } from 'react';

// ── Exact MyFitness values ────────────────────────────────────────────────────
const BG      = '#0b0f14';
const BG2     = '#0f1419';
const BORDER  = 'rgba(255,255,255,0.06)';
const BORDER2 = 'rgba(255,255,255,0.07)';
const TEXT    = '#e6edf3';
const TEXT2   = '#c9d1d9';
const MUTED   = '#6b7a8d';
const DIM     = '#a0aab4';
const FONT    = "'DM Sans', sans-serif";
const MONO    = 'monospace';

// ── SKU size classification ───────────────────────────────────────────────────
function getSizeGroup(style) {
  const s = style.toLowerCase();
  // Gift packs first (before size check)
  if (['am_pm','combo','pack_of','collection','aura_30','partycombo','heist_combo','rebel_perfume','7_deadly','party_combo'].some(k => s.includes(k))) return 'Gift Packs';
  if (s.includes('100ml') || s.includes('100 ml') || s.includes('reign') || s.includes('voltage') || s.includes('on_the_rocks') || s.includes('gold_revol') || s.includes('smoked_oud') || s.includes('white_oud') || s.includes('golden_oud') || s.includes('bukhoor') || s.includes('azure') || s.includes('midnight') || s.includes('desire')) return '100ml';
  if (s.includes('50ml') || s.includes('tempt') || s.includes('legacy') || s.includes('hurricane') || s.includes('unstoppable') || s.includes('exotic_oud')) return '50ml';
  if (s.includes('20ml') || s.includes('snakeedp_20') || s.includes('hydraedp_20') || s.includes('oudedp_20') || s.includes('edp_20')) return '20ml';
  if (s.includes('100')) return '100ml';
  if (s.includes('50')) return '50ml';
  if (s.includes('20')) return '20ml';
  return '100ml';
}

function fmt(v) {
  if (!v || isNaN(v) || v === 0) return '—';
  if (v >= 1000) return (v / 1000).toFixed(v >= 100000 ? 0 : 1) + 'k';
  return String(Math.round(v));
}
function fmtFull(v) {
  if (!v || isNaN(v) || v === 0) return '—';
  return Math.round(v).toLocaleString('en-IN');
}
function fmtDoc(v) {
  if (!v || isNaN(v) || !isFinite(v) || v === 0) return '—';
  return Math.round(v) + 'd';
}
function docStatus(doc) {
  if (!doc || !isFinite(doc) || doc === 0) return { label: '—', color: MUTED, bg: 'transparent', border: `1px solid rgba(255,255,255,0.08)` };
  if (doc <= 7)  return { label: 'Critical', color: '#ff4444', bg: 'rgba(255,68,68,0.12)',   border: '1px solid rgba(255,68,68,0.33)' };
  if (doc <= 15) return { label: 'Low',      color: '#f5a623', bg: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.33)' };
  if (doc <= 30) return { label: 'Low',      color: '#f5c518', bg: 'rgba(245,197,24,0.10)', border: '1px solid rgba(245,197,24,0.33)' };
  if (doc <= 60) return { label: 'OK',       color: '#00c896', bg: 'rgba(0,200,150,0.10)',  border: '1px solid rgba(0,200,150,0.33)' };
  return           { label: 'OK',       color: '#7c5cfc', bg: 'rgba(124,92,252,0.10)', border: '1px solid rgba(124,92,252,0.33)' };
}

// ── Card — exact MyFitness ────────────────────────────────────────────────────
function Card({ label, value, sub, accent }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER2}`, borderRadius: 10, padding: '10px 14px', flex: 1 }}>
      <div style={{ fontSize: 9, color: MUTED, fontFamily: MONO, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent || TEXT, fontFamily: MONO }}>{value}</div>
      {sub !== undefined && <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// DOC pill — exact MyFitness status badge
function DocBadge({ v }) {
  const s = docStatus(v);
  if (!v || v === 0) return <span style={{ color: MUTED, fontFamily: MONO, fontSize: 11, fontWeight: 700 }}>—</span>;
  return (
    <span style={{ background: s.bg, color: s.color, border: s.border, borderRadius: 5, padding: '2px 8px', fontSize: 9, fontFamily: MONO, fontWeight: 700, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
      {fmtDoc(v)}
    </span>
  );
}

const SIZE_TABS = [
  { id: 'All',        label: 'All',        emoji: '📦', color: '#e6edf3' },
  { id: '100ml',      label: '100ml',      emoji: '🟣', color: '#e879f9' },
  { id: '50ml',       label: '50ml',       emoji: '🟢', color: '#00c896' },
  { id: '20ml',       label: '20ml',       emoji: '🟡', color: '#f5a623' },
  { id: 'Gift Packs', label: 'Gift Packs', emoji: '🎁', color: '#7c5cfc' },
];

export default function App() {
  const [data, setData]           = useState({ b2b: [], b2c: [] });
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [sizeTab, setSizeTab]     = useState('All');
  const [sortCol, setSortCol]     = useState('b2b_totalDOC');
  const [sortDir, setSortDir]     = useState('asc');
  const [search, setSearch]       = useState('');
  const [chat, setChat]           = useState([]);
  const [input, setInput]         = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [listening, setListening] = useState(false);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);
  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/sheet');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData({ b2b: json.b2b || [], b2c: json.b2c || [] });
      const now = new Date(json.updatedAt);
      setLastUpdated(`${now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  // Union of B2B + B2C
  const merged = (() => {
    const map = {};
    data.b2b.forEach(r => { map[r.style] = { style: r.style, sizeGroup: getSizeGroup(r.style), b2b: r, b2c: null }; });
    data.b2c.forEach(r => {
      if (map[r.style]) map[r.style].b2c = r;
      else map[r.style] = { style: r.style, sizeGroup: getSizeGroup(r.style), b2b: null, b2c: r };
    });
    return Object.values(map);
  })();

  const tab = SIZE_TABS.find(t => t.id === sizeTab);

  const visibleRows = merged
    .filter(r => sizeTab === 'All' || r.sizeGroup === sizeTab)
    .filter(r => r.style.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortCol === 'style') return sortDir === 'asc' ? a.style.localeCompare(b.style) : b.style.localeCompare(a.style);
      const [src, ...rest] = sortCol.split('_');
      const col = rest.join('_');
      let av = (a[src]?.[col] ?? 0), bv = (b[src]?.[col] ?? 0);
      if (av === 0 && sortDir === 'asc') av = Infinity;
      if (bv === 0 && sortDir === 'asc') bv = Infinity;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  // Summary
  const allB2B = merged.map(r => r.b2b).filter(Boolean);
  const allB2C = merged.map(r => r.b2c).filter(Boolean);
  const b2bSOH = allB2B.reduce((s, r) => s + r.totalSOH, 0);
  const b2cSOH = allB2C.reduce((s, r) => s + r.totalSOH, 0);
  const b2bDRR = allB2B.reduce((s, r) => s + r.totalDRR, 0);
  const b2cDRR = allB2C.reduce((s, r) => s + r.totalDRR, 0);
  const b2bDOC = b2bDRR > 0 ? b2bSOH / b2bDRR : null;
  const b2cDOC = b2cDRR > 0 ? b2cSOH / b2cDRR : null;
  const critCnt = merged.filter(r => (r.b2b?.totalDOC > 0 && r.b2b?.totalDOC <= 15) || (r.b2c?.totalDOC > 0 && r.b2c?.totalDOC <= 15)).length;
  const stockCnt = merged.filter(r => !r.b2b?.totalSOH && !r.b2c?.totalSOH).length;

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  async function sendChat() {
    if (!input.trim() || chatLoading) return;
    const msg = input.trim(); setInput('');
    setChat(h => [...h, { role: 'user', text: msg }]);
    setChatLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: chat.slice(-6), activeTab: 'combined' })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setChat(h => [...h, { role: 'ai', text: json.reply }]);
    } catch (e) { setChat(h => [...h, { role: 'ai', text: 'Error: ' + e.message }]); }
    setChatLoading(false);
  }

  function toggleVoice() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'en-IN'; r.continuous = false; r.interimResults = false;
    r.onresult = e => { setInput(e.results[0][0].transcript); setListening(false); };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recognitionRef.current = r; r.start(); setListening(true);
  }

  // Table header — exact MyFitness style
  const TH = ({ label, col, right }) => (
    <th onClick={() => toggleSort(col)} style={{
      padding: '10px 12px', textAlign: right ? 'right' : 'left',
      color: sortCol === col ? tab.color : MUTED,
      cursor: 'pointer', userSelect: 'none',
      fontFamily: MONO, fontSize: 9,
      letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      borderBottom: `1px solid ${BORDER2}`,
      background: '#0b0f14', position: 'sticky', top: 22, zIndex: 1, fontWeight: 400,
    }}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  // Group header
  const GH = ({ label, cols, color, leftBorder }) => (
    <th colSpan={cols} style={{
      padding: '5px 10px', textAlign: 'center',
      fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase',
      color, borderBottom: `1px solid ${color}55`,
      background: BG, position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap',
      borderLeft: leftBorder ? '1px solid rgba(255,255,255,0.06)' : 'none',
    }}>
      {label}
    </th>
  );

  if (loading) return (
    <div style={{ height: '100vh', background: BG, color: TEXT, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 16, fontWeight: 700 }}>📦 Villain Inventory Review</div>
      <div style={{ width: 160, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
        <div style={{ width: '55%', height: '100%', background: '#e879f9', borderRadius: 2 }} />
      </div>
      <div style={{ fontSize: 12, color: MUTED }}>Loading data...</div>
    </div>
  );

  if (error) return (
    <div style={{ height: '100vh', background: BG, color: TEXT, fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, padding: 32 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <div style={{ fontSize: 16, fontWeight: 700 }}>📦 Villain Inventory Review</div>
      <div style={{ color: '#ff6b6b', fontSize: 13, background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', padding: '10px 18px', borderRadius: 8, maxWidth: 460, textAlign: 'center' }}>{error}</div>
      <button onClick={fetchData} style={{ background: '#e879f9', border: 'none', borderRadius: 8, padding: '9px 22px', color: '#fff', fontFamily: FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
    </div>
  );

  const SUGGESTIONS = ['Critical SKUs?', 'Which 100ml are low DOC?', 'B2C stockout risk?', 'Gift pack DOC summary?'];

  return (
    <div style={{ height: '100vh', background: BG, color: TEXT, fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header — exact MyFitness */}
      <div style={{ padding: '16px 24px 0', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>📦 Villain Inventory Review</span>
          {lastUpdated && (
            <span style={{ fontSize: 10, color: MUTED, fontFamily: MONO, background: 'rgba(255,255,255,0.05)', borderRadius: 5, padding: '2px 8px' }}>
              LIVE · {lastUpdated}
            </span>
          )}
          {stockCnt > 0 && <span style={{ fontSize: 10, color: '#ff4444', fontFamily: MONO, background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)', borderRadius: 5, padding: '2px 8px', fontWeight: 700 }}>⚠ {stockCnt} Stockout</span>}
          {critCnt > 0 && <span style={{ fontSize: 10, color: '#f5a623', fontFamily: MONO, background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 5, padding: '2px 8px', fontWeight: 700 }}>⚠ {critCnt} Critical</span>}
          <button onClick={fetchData} style={{ marginLeft: 'auto', fontSize: 11, color: MUTED, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER2}`, borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontFamily: FONT }}>↻ Refresh</button>
        </div>

        {/* Size tabs — exact MyFitness tab style */}
        <div style={{ display: 'flex', gap: 2 }}>
          {SIZE_TABS.map(t => {
            const count = t.id === 'All' ? merged.length : merged.filter(r => r.sizeGroup === t.id).length;
            return (
              <button key={t.id} onClick={() => { setSizeTab(t.id); setSearch(''); setSortCol('b2b_totalDOC'); setSortDir('asc'); }}
                style={{ padding: '9px 18px', border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, borderRadius: '7px 7px 0 0', background: sizeTab === t.id ? 'rgba(255,255,255,0.06)' : 'transparent', color: sizeTab === t.id ? t.color : MUTED, borderBottom: sizeTab === t.id ? `2px solid ${t.color}` : '2px solid transparent', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                {t.emoji} {t.label}
                <span style={{ fontSize: 10, background: sizeTab === t.id ? `${t.color}22` : 'rgba(255,255,255,0.04)', color: sizeTab === t.id ? t.color : '#444', border: `1px solid ${sizeTab === t.id ? t.color + '44' : 'rgba(255,255,255,0.06)'}`, borderRadius: 10, padding: '0 6px', lineHeight: '18px' }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: cards + table */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid ${BORDER}` }}>

          {/* Cards — exact MyFitness gap/padding */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 20px', flexShrink: 0 }}>
            {[
              { label: 'Total SOH', b2bVal: fmtFull(b2bSOH), b2cVal: fmtFull(b2cSOH), b2bColor: tab.color, b2cColor: '#00c896', sub: `${allB2B.length} B2B · ${allB2C.length} B2C SKUs` },
              { label: 'Total DRR', b2bVal: fmtFull(b2bDRR), b2cVal: fmtFull(b2cDRR), b2bColor: TEXT, b2cColor: TEXT, sub: 'daily run rate' },
              { label: 'Avg DOC  (SOH ÷ DRR)', b2bVal: fmtDoc(b2bDOC), b2cVal: fmtDoc(b2cDOC),
                b2bColor: !b2bDOC ? TEXT : b2bDOC <= 15 ? '#ff4444' : b2bDOC <= 30 ? '#f5a623' : b2bDOC <= 60 ? '#00c896' : '#7c5cfc',
                b2cColor: !b2cDOC ? TEXT : b2cDOC <= 15 ? '#ff4444' : b2cDOC <= 30 ? '#f5a623' : b2cDOC <= 60 ? '#00c896' : '#7c5cfc',
                sub: critCnt > 0 ? `⚠ ${critCnt} critical` : stockCnt > 0 ? `⚠ ${stockCnt} stockout` : 'all healthy' },
            ].map(c => (
              <div key={c.label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER2}`, borderRadius: 10, padding: '10px 14px', flex: 1 }}>
                <div style={{ fontSize: 9, color: MUTED, fontFamily: MONO, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>{c.label}</div>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontSize: 9, color: MUTED, fontFamily: MONO, marginBottom: 2, letterSpacing: '0.08em' }}>B2B</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: c.b2bColor, fontFamily: MONO, lineHeight: 1 }}>{c.b2bVal}</div>
                  </div>
                  <div style={{ width: 1, height: 28, background: BORDER2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 9, color: MUTED, fontFamily: MONO, marginBottom: 2, letterSpacing: '0.08em' }}>B2C</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: c.b2cColor, fontFamily: MONO, lineHeight: 1 }}>{c.b2cVal}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: c.label.includes('DOC') && critCnt > 0 ? '#ff4444' : MUTED, marginTop: 2 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Search */}
          <div style={{ padding: '0 20px 10px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search style..."
              style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER2}`, borderRadius: 6, padding: '7px 12px', color: TEXT, fontSize: 13, outline: 'none', fontFamily: FONT, width: 220 }} />
            <span style={{ color: MUTED, fontSize: 12 }}>{visibleRows.length} / {merged.length} SKUs</span>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th colSpan={2} style={{ background: BG, position: 'sticky', top: 0, zIndex: 2, borderBottom: `1px solid ${BORDER}` }} />
                  <GH label="Summary" cols={3} color="#ffffff" leftBorder />
                  <GH label="B2B — SOH" cols={4} color="#e879f9" leftBorder />
                  <GH label="B2B — DOC" cols={4} color="#f5a623" leftBorder />
                  <GH label="B2B — DRR" cols={4} color="#00c896" leftBorder />
                  <GH label="B2C — SOH" cols={4} color="#e879f9" leftBorder />
                  <GH label="B2C — DOC" cols={4} color="#f5a623" leftBorder />
                  <GH label="B2C — DRR" cols={4} color="#00c896" leftBorder />
                </tr>
                <tr style={{ borderBottom: `1px solid ${BORDER2}` }}>
                  <TH label="Style"      col="style"   />
                  <TH label="Size"       col="size"    />
                  <TH label="Total SOH"  col="b2b_totalSOH" right />
                  <TH label="Total DRR"  col="b2b_totalDRR" right />
                  <TH label="Total DOC"  col="b2b_totalDOC" right />
                  <TH label="Total"  col="b2b_totalSOH" right /><TH label="GGN" col="b2b_sohGGN" right /><TH label="BHW" col="b2b_sohBHW" right /><TH label="BLR" col="b2b_sohBLR" right />
                  <TH label="Total"  col="b2b_totalDOC" right /><TH label="GGN" col="b2b_docGGN" right /><TH label="BHW" col="b2b_docBHW" right /><TH label="BLR" col="b2b_docBLR" right />
                  <TH label="Total"  col="b2b_totalDRR" right /><TH label="GGN" col="b2b_drrGGN" right /><TH label="BHW" col="b2b_drrBHW" right /><TH label="BLR" col="b2b_drrBLR" right />
                  <TH label="Total"  col="b2c_totalSOH" right /><TH label="GGN" col="b2c_sohGGN" right /><TH label="BHW" col="b2c_sohBHW" right /><TH label="BLR" col="b2c_sohBLR" right />
                  <TH label="Total"  col="b2c_totalDOC" right /><TH label="GGN" col="b2c_docGGN" right /><TH label="BHW" col="b2c_docBHW" right /><TH label="BLR" col="b2c_docBLR" right />
                  <TH label="Total"  col="b2c_totalDRR" right /><TH label="GGN" col="b2c_drrGGN" right /><TH label="BHW" col="b2c_drrBHW" right /><TH label="BLR" col="b2c_drrBLR" right />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => {
                  const b = row.b2b, c = row.b2c;
                  const sColor = SIZE_TABS.find(t => t.id === row.sizeGroup)?.color || MUTED;
                  const isStockout = !b?.totalSOH && !c?.totalSOH;
                  const rowBg = isStockout ? 'rgba(255,68,68,0.05)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)';
                  return (
                    <tr key={`${row.style}-${i}`}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: rowBg, transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = `${sColor}0a`}
                      onMouseLeave={e => e.currentTarget.style.background = rowBg}
                    >
                      <td style={{ padding: '9px 12px', color: TEXT2, fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 }}>{row.style}</td>
                      <td style={{ padding: '9px 10px' }}>
                        <span style={{ color: sColor, fontFamily: MONO, fontSize: 9, fontWeight: 700, background: `${sColor}15`, border: `1px solid ${sColor}33`, padding: '2px 7px', borderRadius: 10 }}>{row.sizeGroup}</span>
                      </td>
                      {/* Summary: combined B2B+B2C SOH, DRR, DOC */}
                      {(() => {
                        const combSOH = (b?.totalSOH || 0) + (c?.totalSOH || 0);
                        const combDRR = (b?.totalDRR || 0) + (c?.totalDRR || 0);
                        const combDOC = combDRR > 0 ? combSOH / combDRR : null;
                        const ds = combDOC ? (!isFinite(combDOC) ? {color:MUTED,bg:'transparent',border:`1px solid rgba(255,255,255,0.08)`} : combDOC<=7 ? {color:'#ff4444',bg:'rgba(255,68,68,0.12)',border:'1px solid rgba(255,68,68,0.33)'} : combDOC<=15 ? {color:'#f5a623',bg:'rgba(245,166,35,0.12)',border:'1px solid rgba(245,166,35,0.33)'} : combDOC<=30 ? {color:'#f5c518',bg:'rgba(245,197,24,0.10)',border:'1px solid rgba(245,197,24,0.33)'} : combDOC<=60 ? {color:'#00c896',bg:'rgba(0,200,150,0.10)',border:'1px solid rgba(0,200,150,0.33)'} : {color:'#7c5cfc',bg:'rgba(124,92,252,0.10)',border:'1px solid rgba(124,92,252,0.33)'}) : null;
                        return <>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: TEXT, fontFamily: MONO, fontSize: 11, fontWeight: 700, borderLeft: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>{combSOH ? fmtFull(combSOH) : '—'}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', color: TEXT, fontFamily: MONO, fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.02)' }}>{combDRR ? fmtFull(combDRR) : '—'}</td>
                          <td style={{ padding: '9px 12px', textAlign: 'right', background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                            {ds ? <span style={{ background: ds.bg, color: ds.color, border: ds.border, borderRadius: 5, padding: '2px 8px', fontSize: 9, fontFamily: MONO, fontWeight: 700, letterSpacing: '0.06em' }}>{combDOC ? Math.round(combDOC)+'d' : '—'}</span> : <span style={{ color: MUTED }}>—</span>}
                          </td>
                        </>;
                      })()}
                      {/* B2B SOH */}
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: TEXT, fontFamily: MONO, fontSize: 11, fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,0.04)' }}>{fmtFull(b?.totalSOH)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: DIM, fontFamily: MONO, fontSize: 11 }}>{fmt(b?.sohGGN)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: DIM, fontFamily: MONO, fontSize: 11 }}>{fmt(b?.sohBHW)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: DIM, fontFamily: MONO, fontSize: 11 }}>{fmt(b?.sohBLR)}</td>
                      {/* B2B DOC */}
                      <td style={{ padding: '9px 12px', textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.04)' }}><DocBadge v={b?.totalDOC} /></td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}><DocBadge v={b?.docGGN} /></td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}><DocBadge v={b?.docBHW} /></td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}><DocBadge v={b?.docBLR} /></td>
                      {/* B2B DRR */}
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: TEXT, fontFamily: MONO, fontSize: 11, fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,0.04)' }}>{fmtFull(b?.totalDRR)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: DIM, fontFamily: MONO, fontSize: 11 }}>{fmt(b?.drrGGN)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: DIM, fontFamily: MONO, fontSize: 11 }}>{fmt(b?.drrBHW)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: DIM, fontFamily: MONO, fontSize: 11 }}>{fmt(b?.drrBLR)}</td>
                      {/* B2C SOH */}
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: TEXT, fontFamily: MONO, fontSize: 11, fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,0.08)' }}>{fmtFull(c?.totalSOH)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: DIM, fontFamily: MONO, fontSize: 11 }}>{fmt(c?.sohGGN)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: DIM, fontFamily: MONO, fontSize: 11 }}>{fmt(c?.sohBHW)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: DIM, fontFamily: MONO, fontSize: 11 }}>{fmt(c?.sohBLR)}</td>
                      {/* B2C DOC */}
                      <td style={{ padding: '9px 12px', textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.04)' }}><DocBadge v={c?.totalDOC} /></td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}><DocBadge v={c?.docGGN} /></td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}><DocBadge v={c?.docBHW} /></td>
                      <td style={{ padding: '9px 10px', textAlign: 'right' }}><DocBadge v={c?.docBLR} /></td>
                      {/* B2C DRR */}
                      <td style={{ padding: '9px 12px', textAlign: 'right', color: TEXT, fontFamily: MONO, fontSize: 11, fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,0.04)' }}>{fmtFull(c?.totalDRR)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: DIM, fontFamily: MONO, fontSize: 11 }}>{fmt(c?.drrGGN)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: DIM, fontFamily: MONO, fontSize: 11 }}>{fmt(c?.drrBHW)}</td>
                      <td style={{ padding: '9px 10px', textAlign: 'right', color: DIM, fontFamily: MONO, fontSize: 11 }}>{fmt(c?.drrBLR)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, padding: '0 20px 12px', flexWrap: 'wrap', flexShrink: 0 }}>
            {[['≤7d Critical', '#ff4444'], ['≤15d Low', '#f5a623'], ['≤30d', '#f5c518'], ['≤60d Healthy', '#00c896'], ['>60d Overstock', '#7c5cfc']].map(([l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 9, color: MUTED }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Right: chat — exact MyFitness */}
        <div style={{ width: 320, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, fontSize: 10, color: MUTED, fontFamily: MONO, letterSpacing: '0.1em' }}>
            💬 MEETING ASSISTANT
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {chat.length === 0 && (
              <>
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>Ask me anything about B2B or B2C inventory during your review.</div>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SUGGESTIONS.map(q => (
                    <div key={q} onClick={() => setInput(q)}
                      style={{ fontSize: 12, color: MUTED, cursor: 'pointer', padding: '8px 12px', borderRadius: 7, border: `1px solid ${BORDER2}`, transition: 'all 0.15s', background: 'rgba(255,255,255,0.02)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = tab.color; e.currentTarget.style.color = tab.color; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER2; e.currentTarget.style.color = MUTED; }}>
                      {q}
                    </div>
                  ))}
                </div>
              </>
            )}
            {chat.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%',
                background: m.role === 'user' ? `${tab.color}18` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${m.role === 'user' ? tab.color + '33' : BORDER2}`,
                borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                padding: '10px 12px', fontSize: 13, lineHeight: 1.6,
                color: m.role === 'user' ? tab.color : TEXT2, whiteSpace: 'pre-wrap',
              }}>{m.text}</div>
            ))}
            {chatLoading && (
              <div style={{ alignSelf: 'flex-start', fontSize: 12, color: MUTED, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px 10px 10px 2px', border: `1px solid ${BORDER2}` }}>
                Analyzing...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask about any month or SKU..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER2}`, borderRadius: 8, padding: '9px 12px', color: TEXT, fontSize: 13, outline: 'none', fontFamily: FONT }} />
            <button onClick={toggleVoice}
              style={{ background: listening ? `${tab.color}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${listening ? tab.color + '55' : BORDER2}`, borderRadius: 8, padding: '9px 10px', color: listening ? tab.color : MUTED, cursor: 'pointer', fontSize: 14 }}>🎙</button>
            <button onClick={sendChat} disabled={chatLoading || !input.trim()}
              style={{ background: `linear-gradient(135deg, ${tab.color}, #7c5cfc)`, border: 'none', borderRadius: 8, padding: '9px 16px', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 600, opacity: chatLoading || !input.trim() ? 0.4 : 1 }}>→</button>
          </div>
        </div>
      </div>
    </div>
  );
}
