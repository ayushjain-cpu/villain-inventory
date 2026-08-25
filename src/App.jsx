import { useState, useRef, useEffect } from 'react';

const BG      = '#0b0f14';
const BG2     = '#0f1419';
const BG3     = 'rgba(255,255,255,0.03)';
const BORDER  = 'rgba(255,255,255,0.07)';
const TEXT    = '#e6edf3';
const TEXT2   = '#c9d1d9';
const MUTED   = '#6b7a8d';
const MONO    = 'monospace';

// ── SKU size classification ──────────────────────────────────────────────────
const SIZE_100ML = [
  'villain_classicedp_100ml','villain_hydraedp_100ml','villain_snakeedp_100ml',
  'villain_oudedp_100ml','villain_desireedp_100ml','villain_voltage_eau_de_parfum_100_ml',
  'villain_on_the_rocks_eau_de_parfum_100ml','villain_gold_revolvedp_100ml',
  'villain_gold_revolveredp_100ml','smoked_oud_edp_100ml','white_oud_edp_100ml',
  'golden_oud_edp_100ml','bukhoor_oud_edp_100ml','azure_musk_100ml',
  'midnight_mirage','villain_reign_100ml'
];
const SIZE_50ML = [
  'villain_legacy_classic_50ml','villain_hurricane_hydra_50ml',
  'villain_unstoppable_mischief_50ml','villain_exotic_oud_50ml','villain_tempt_50ml'
];
const SIZE_20ML = [
  'villain_edp_20ml','villain_hydraedp_20ml','villain_oudedp_20ml','villain_snakeedp_20ml'
];
const SIZE_GIFT = [
  'am_pm_edp_40ml','7_deadly_scents_combo','villain_party_combo_xl_1',
  'villain_rebel_perfume_combo_20ml_pack_of_4','partycombo_mini',
  'aura_30ml_pack_of_3','alpha_collection','villain_heist_combo_xl'
];

function getSizeGroup(style) {
  const s = style.toLowerCase();
  if (SIZE_100ML.some(k => s.includes(k) || k.includes(s))) return '100ml';
  if (SIZE_50ML.some(k => s.includes(k) || k.includes(s))) return '50ml';
  if (SIZE_20ML.some(k => s.includes(k) || k.includes(s))) return '20ml';
  if (SIZE_GIFT.some(k => s.includes(k) || k.includes(s))) return 'Gift Packs';
  // Fallback by name pattern
  if (s.includes('100ml') || s.includes('100 ml')) return '100ml';
  if (s.includes('50ml'))  return '50ml';
  if (s.includes('20ml'))  return '20ml';
  if (s.includes('combo') || s.includes('pack') || s.includes('collection') || s.includes('aura') || s.includes('mirage') && !s.includes('100')) return 'Gift Packs';
  return '100ml'; // default remaining to 100ml
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
function docPill(doc) {
  if (!doc || !isFinite(doc) || doc === 0) return { color: MUTED, bg: 'transparent', border: `1px solid rgba(255,255,255,0.08)` };
  if (doc <= 7)  return { color: '#ff4444', bg: 'rgba(255,68,68,0.12)',   border: '1px solid rgba(255,68,68,0.33)' };
  if (doc <= 15) return { color: '#f5a623', bg: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.33)' };
  if (doc <= 30) return { color: '#f5c518', bg: 'rgba(245,197,24,0.10)', border: '1px solid rgba(245,197,24,0.33)' };
  if (doc <= 60) return { color: '#00c896', bg: 'rgba(0,200,150,0.10)',  border: '1px solid rgba(0,200,150,0.33)' };
  return           { color: '#7c5cfc', bg: 'rgba(124,92,252,0.10)', border: '1px solid rgba(124,92,252,0.33)' };
}

function Pill({ v }) {
  const s = docPill(v);
  return <span style={{ background: s.bg, color: s.color, border: s.border, padding: '2px 8px', borderRadius: 5, fontFamily: MONO, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.06em', display: 'inline-block' }}>{fmtDoc(v)}</span>;
}

function Card({ label, value, sub, accent }) {
  return (
    <div style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px', flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 9, color: MUTED, fontFamily: MONO, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent || TEXT, fontFamily: MONO }}>{value}</div>
      {sub !== undefined && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const SIZE_TABS = ['All', '100ml', '50ml', '20ml', 'Gift Packs'];
const SIZE_COLORS = { '100ml': '#e879f9', '50ml': '#00c896', '20ml': '#f5a623', 'Gift Packs': '#7c5cfc', 'All': '#6b7a8d' };

export default function App() {
  const [data, setData]             = useState({ b2b: [], b2c: [] });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [sizeTab, setSizeTab]       = useState('All');
  const [sortCol, setSortCol]       = useState('b2b_totalDOC');
  const [sortDir, setSortDir]       = useState('asc');
  const [search, setSearch]         = useState('');
  const [chat, setChat]             = useState([]);
  const [input, setInput]           = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');
  const [listening, setListening]   = useState(false);
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

  // ── Merge B2B + B2C into unified rows ─────────────────────────────────────
  const merged = (() => {
    const map = {};
    data.b2b.forEach(r => {
      map[r.style] = { style: r.style, sizeGroup: getSizeGroup(r.style), b2b: r, b2c: null };
    });
    data.b2c.forEach(r => {
      if (map[r.style]) map[r.style].b2c = r;
      else map[r.style] = { style: r.style, sizeGroup: getSizeGroup(r.style), b2b: null, b2c: r };
    });
    return Object.values(map);
  })();

  const visibleRows = merged
    .filter(r => sizeTab === 'All' || r.sizeGroup === sizeTab)
    .filter(r => r.style.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const [src, col] = sortCol.split('_').length > 1 ? [sortCol.split('_')[0], sortCol.slice(sortCol.indexOf('_') + 1)] : ['b2b', sortCol];
      const getV = (r) => (r[src] ? r[src][col] : 0) ?? 0;
      let av = getV(a), bv = getV(b);
      if (sortCol === 'style') return sortDir === 'asc' ? a.style.localeCompare(b.style) : b.style.localeCompare(a.style);
      if (av === 0 && sortDir === 'asc') av = Infinity;
      if (bv === 0 && sortDir === 'asc') bv = Infinity;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  // Summary stats
  const allB2B = merged.map(r => r.b2b).filter(Boolean);
  const allB2C = merged.map(r => r.b2c).filter(Boolean);
  const totalB2BSOH = allB2B.reduce((s, r) => s + r.totalSOH, 0);
  const totalB2CSOH = allB2C.reduce((s, r) => s + r.totalSOH, 0);
  const totalB2BDRR = allB2B.reduce((s, r) => s + r.totalDRR, 0);
  const totalB2CDRR = allB2C.reduce((s, r) => s + r.totalDRR, 0);
  const avgB2BDOC   = totalB2BDRR > 0 ? totalB2BSOH / totalB2BDRR : null;
  const avgB2CDOC   = totalB2CDRR > 0 ? totalB2CSOH / totalB2CDRR : null;
  const criticalCnt = merged.filter(r => (r.b2b?.totalDOC > 0 && r.b2b?.totalDOC <= 15) || (r.b2c?.totalDOC > 0 && r.b2c?.totalDOC <= 15)).length;
  const stockoutCnt = merged.filter(r => r.b2b?.totalSOH === 0 && r.b2c?.totalSOH === 0).length;

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

  const TH = ({ label, col, right, title }) => (
    <th onClick={() => toggleSort(col)} title={title} style={{
      padding: '8px 10px', textAlign: right ? 'right' : 'left',
      color: sortCol === col ? '#e879f9' : MUTED,
      cursor: 'pointer', userSelect: 'none',
      fontFamily: MONO, fontSize: 9,
      letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      borderBottom: `1px solid ${BORDER}`,
      background: BG2, position: 'sticky', top: 22, zIndex: 1, fontWeight: 400,
    }}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  // Group header
  const GH = ({ label, cols, color, border }) => (
    <th colSpan={cols} style={{ padding: '5px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color, borderBottom: `1px solid ${color}55`, background: BG, position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap', borderLeft: border ? `1px solid rgba(255,255,255,0.06)` : 'none' }}>
      {label}
    </th>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 14, background: BG }}>
      <div style={{ fontFamily: MONO, fontSize: 13, color: MUTED, letterSpacing: '0.1em' }}>VILLAIN · INVENTORY REVIEW</div>
      <div style={{ width: 160, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
        <div style={{ width: '50%', height: '100%', background: '#e879f9', borderRadius: 2 }} />
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, padding: 32, background: BG }}>
      <div style={{ fontFamily: MONO, fontSize: 13, color: MUTED }}>VILLAIN · INVENTORY REVIEW</div>
      <div style={{ color: '#ff6b6b', fontSize: 12, background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', padding: '10px 18px', borderRadius: 8, fontFamily: MONO }}>{error}</div>
      <button onClick={fetchData} style={{ background: '#e879f9', border: 'none', borderRadius: 8, padding: '8px 22px', color: '#fff', fontFamily: MONO, fontSize: 12, cursor: 'pointer' }}>retry</button>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BG, color: TEXT }}>

      {/* Header */}
      <div style={{ padding: '0 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: BG2, height: 46 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: TEXT }}>📦 Villain Inventory Review</span>
          {lastUpdated && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 20, padding: '3px 10px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00c896', display: 'inline-block' }} />
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#00c896' }}>LIVE · {lastUpdated}</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {stockoutCnt > 0 && <span style={{ background: 'rgba(255,68,68,0.12)', border: '1px solid rgba(255,68,68,0.3)', color: '#ff4444', fontFamily: MONO, fontSize: 10, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>⚠ {stockoutCnt} Stockout</span>}
          {criticalCnt > 0 && <span style={{ background: 'rgba(245,166,35,0.10)', border: '1px solid rgba(245,166,35,0.3)', color: '#f5a623', fontFamily: MONO, fontSize: 10, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>⚠ {criticalCnt} Critical</span>}
          <button onClick={fetchData} style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 14px', color: MUTED, fontSize: 10, cursor: 'pointer', fontFamily: MONO }}>↻ Refresh</button>
        </div>
      </div>

      {/* Size tabs */}
      <div style={{ display: 'flex', padding: '0 20px', background: BG2, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {SIZE_TABS.map(tab => {
          const count = tab === 'All' ? merged.length : merged.filter(r => r.sizeGroup === tab).length;
          const color = SIZE_COLORS[tab];
          return (
            <button key={tab} onClick={() => { setSizeTab(tab); setSearch(''); setSortCol('b2b_totalDOC'); setSortDir('asc'); }}
              style={{ padding: '10px 18px', background: 'none', border: 'none', borderBottom: sizeTab === tab ? `2px solid ${color}` : '2px solid transparent', color: sizeTab === tab ? color : MUTED, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', textTransform: 'uppercase', marginBottom: -1, transition: 'color 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
              {tab}
              <span style={{ fontSize: 9, background: sizeTab === tab ? `${color}22` : 'rgba(255,255,255,0.05)', color: sizeTab === tab ? color : '#444', border: `1px solid ${sizeTab === tab ? color + '44' : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, padding: '1px 6px' }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 10, padding: '12px 20px', flexShrink: 0, flexWrap: 'wrap' }}>
        <Card label="B2B Total SOH"  value={fmtFull(totalB2BSOH)} sub={`${allB2B.length} SKUs`}  accent="#e879f9" />
        <Card label="B2B Avg DOC"    value={fmtDoc(avgB2BDOC)}    sub="SOH ÷ DRR"               />
        <Card label="B2C Total SOH"  value={fmtFull(totalB2CSOH)} sub={`${allB2C.length} SKUs`}  accent="#00c896" />
        <Card label="B2C Avg DOC"    value={fmtDoc(avgB2CDOC)}    sub="SOH ÷ DRR"               />
        <Card label="Total DRR"      value={fmtFull(totalB2BDRR + totalB2CDRR)} sub="B2B + B2C" accent="#f5a623" />
      </div>

      {/* Main */}
      <div style={{ display: 'flex', flex: 1, padding: '0 20px 16px', gap: 14, minHeight: 0 }}>

        {/* Table */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexShrink: 0 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search style..."
              style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 12px', color: TEXT, fontSize: 12, outline: 'none', fontFamily: MONO, width: 220 }} />
            <span style={{ color: MUTED, fontFamily: MONO, fontSize: 10 }}>{visibleRows.length} / {merged.length} SKUs</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', borderRadius: 8, border: `1px solid ${BORDER}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                {/* Group row */}
                <tr>
                  <th rowSpan={2} style={{ padding: '8px 12px', background: BG, position: 'sticky', top: 0, zIndex: 3, borderBottom: `1px solid ${BORDER}`, textAlign: 'left', fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', minWidth: 160 }}>Style</th>
                  <th rowSpan={2} style={{ padding: '8px 10px', background: BG, position: 'sticky', top: 0, zIndex: 3, borderBottom: `1px solid ${BORDER}`, textAlign: 'center', fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Size</th>
                  <GH label="B2B — SOH" cols={4} color="#e879f9" border />
                  <GH label="B2B — DOC" cols={4} color="#f5a623" border />
                  <GH label="B2B — DRR" cols={4} color="#00c896" border />
                  <GH label="B2C — SOH" cols={4} color="#e879f9" border />
                  <GH label="B2C — DOC" cols={4} color="#f5a623" border />
                  <GH label="B2C — DRR" cols={4} color="#00c896" border />
                </tr>
                <tr>
                  {/* B2B SOH */}
                  <TH label="Total" col="b2b_totalSOH" right /><TH label="GGN" col="b2b_sohGGN" right /><TH label="BHW" col="b2b_sohBHW" right /><TH label="BLR" col="b2b_sohBLR" right />
                  {/* B2B DOC */}
                  <TH label="Total" col="b2b_totalDOC" right /><TH label="GGN" col="b2b_docGGN" right /><TH label="BHW" col="b2b_docBHW" right /><TH label="BLR" col="b2b_docBLR" right />
                  {/* B2B DRR */}
                  <TH label="Total" col="b2b_totalDRR" right /><TH label="GGN" col="b2b_drrGGN" right /><TH label="BHW" col="b2b_drrBHW" right /><TH label="BLR" col="b2b_drrBLR" right />
                  {/* B2C SOH */}
                  <TH label="Total" col="b2c_totalSOH" right /><TH label="GGN" col="b2c_sohGGN" right /><TH label="BHW" col="b2c_sohBHW" right /><TH label="BLR" col="b2c_sohBLR" right />
                  {/* B2C DOC */}
                  <TH label="Total" col="b2c_totalDOC" right /><TH label="GGN" col="b2c_docGGN" right /><TH label="BHW" col="b2c_docBHW" right /><TH label="BLR" col="b2c_docBLR" right />
                  {/* B2C DRR */}
                  <TH label="Total" col="b2c_totalDRR" right /><TH label="GGN" col="b2c_drrGGN" right /><TH label="BHW" col="b2c_drrBHW" right /><TH label="BLR" col="b2c_drrBLR" right />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => {
                  const b = row.b2b, c = row.b2c;
                  const sizeColor = SIZE_COLORS[row.sizeGroup] || MUTED;
                  const isStockout = !b?.totalSOH && !c?.totalSOH;
                  return (
                    <tr key={`${row.style}-${i}`}
                      style={{ borderBottom: `1px solid rgba(255,255,255,0.04)`, background: isStockout ? 'rgba(255,68,68,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', transition: 'background 0.1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,121,249,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = isStockout ? 'rgba(255,68,68,0.04)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                    >
                      <td style={{ padding: '8px 12px', color: TEXT2, fontWeight: 600, whiteSpace: 'nowrap', fontFamily: MONO, fontSize: 11 }}>{row.style}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{ color: sizeColor, fontFamily: MONO, fontSize: 9, fontWeight: 700, background: `${sizeColor}15`, border: `1px solid ${sizeColor}33`, padding: '2px 7px', borderRadius: 10 }}>{row.sizeGroup}</span>
                      </td>
                      {/* B2B SOH */}
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: TEXT, fontFamily: MONO, fontSize: 11, fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,0.04)' }}>{fmtFull(b?.totalSOH)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(b?.sohGGN)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(b?.sohBHW)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(b?.sohBLR)}</td>
                      {/* B2B DOC */}
                      <td style={{ padding: '8px 10px', textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.04)' }}><Pill v={b?.totalDOC} /></td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}><Pill v={b?.docGGN} /></td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}><Pill v={b?.docBHW} /></td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}><Pill v={b?.docBLR} /></td>
                      {/* B2B DRR */}
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: TEXT, fontFamily: MONO, fontSize: 11, fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,0.04)' }}>{fmtFull(b?.totalDRR)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(b?.drrGGN)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(b?.drrBHW)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(b?.drrBLR)}</td>
                      {/* B2C SOH */}
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: TEXT, fontFamily: MONO, fontSize: 11, fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,0.08)' }}>{fmtFull(c?.totalSOH)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(c?.sohGGN)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(c?.sohBHW)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(c?.sohBLR)}</td>
                      {/* B2C DOC */}
                      <td style={{ padding: '8px 10px', textAlign: 'right', borderLeft: '1px solid rgba(255,255,255,0.04)' }}><Pill v={c?.totalDOC} /></td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}><Pill v={c?.docGGN} /></td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}><Pill v={c?.docBHW} /></td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }}><Pill v={c?.docBLR} /></td>
                      {/* B2C DRR */}
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: TEXT, fontFamily: MONO, fontSize: 11, fontWeight: 600, borderLeft: '1px solid rgba(255,255,255,0.04)' }}>{fmtFull(c?.totalDRR)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(c?.drrGGN)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(c?.drrBHW)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(c?.drrBLR)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', flexShrink: 0 }}>
            {[['≤7d Critical', '#ff4444'], ['≤15d Low', '#f5a623'], ['≤30d', '#f5c518'], ['≤60d Healthy', '#00c896'], ['>60d Overstock', '#7c5cfc']].map(([l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 9, color: MUTED }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div style={{ width: 270, flexShrink: 0, background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '11px 16px', borderBottom: `1px solid ${BORDER}`, fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.16em', textTransform: 'uppercase', flexShrink: 0 }}>
            ▸▸ Meeting Assistant
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chat.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ color: MUTED, fontFamily: MONO, fontSize: 10, marginBottom: 4 }}>Ask about B2B or B2C inventory...</div>
                {['Critical SKUs?', 'Which 100ml are low?', 'Gift pack DOC?', 'B2C stockout risk?'].map(q => (
                  <div key={q} onClick={() => setInput(q)}
                    style={{ color: MUTED, cursor: 'pointer', padding: '7px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, fontFamily: MONO, fontSize: 11, transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#e879f9'; e.currentTarget.style.color = '#e879f9'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = MUTED; }}>
                    {q}
                  </div>
                ))}
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '94%',
                background: m.role === 'user' ? 'rgba(232,121,249,0.1)' : BG3,
                border: `1px solid ${m.role === 'user' ? 'rgba(232,121,249,0.25)' : BORDER}`,
                borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                padding: '9px 12px', fontSize: 12, lineHeight: 1.6,
                color: m.role === 'user' ? '#e879f9' : TEXT2, whiteSpace: 'pre-wrap',
              }}>{m.text}</div>
            ))}
            {chatLoading && <div style={{ alignSelf: 'flex-start', color: MUTED, fontFamily: MONO, fontSize: 10, padding: '8px 12px', background: BG3, borderRadius: '10px 10px 10px 2px', border: `1px solid ${BORDER}` }}>analyzing...</div>}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '10px 12px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 6, flexShrink: 0 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask about any SKU..."
              style={{ flex: 1, background: BG3, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '8px 10px', color: TEXT, fontSize: 11, outline: 'none', fontFamily: MONO }} />
            <button onClick={toggleVoice} style={{ background: listening ? 'rgba(232,121,249,0.15)' : BG3, border: `1px solid ${listening ? 'rgba(232,121,249,0.4)' : BORDER}`, borderRadius: 6, padding: '8px 9px', color: listening ? '#e879f9' : MUTED, cursor: 'pointer', fontSize: 13 }}>🎙</button>
            <button onClick={sendChat} disabled={chatLoading || !input.trim()} style={{ background: 'linear-gradient(135deg, #e879f9, #7c5cfc)', border: 'none', borderRadius: 6, padding: '8px 14px', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 700, opacity: chatLoading || !input.trim() ? 0.3 : 1 }}>→</button>
          </div>
        </div>
      </div>
    </div>
  );
}
