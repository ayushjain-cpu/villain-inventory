import { useState, useRef, useEffect } from 'react';

// ── Exact MyFitness palette ───────────────────────────────────────────────────
const BG      = '#0b0f14';
const BG2     = '#0f1419';
const BG3     = 'rgba(255,255,255,0.03)';
const BORDER  = 'rgba(255,255,255,0.07)';
const TEXT    = '#e6edf3';
const TEXT2   = '#c9d1d9';
const MUTED   = '#6b7a8d';
const RED     = '#ff2d55';
const MONO    = 'monospace';

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
  return (
    <span style={{ background: s.bg, color: s.color, border: s.border, padding: '2px 8px', borderRadius: 5, fontFamily: MONO, fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.06em' }}>
      {fmtDoc(v)}
    </span>
  );
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

function GH({ label, cols, color }) {
  return (
    <th colSpan={cols} style={{ padding: '5px 10px', textAlign: 'center', fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color, borderBottom: `1px solid ${color}55`, background: BG, position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap', borderRight: `1px solid ${BORDER}` }}>
      {label}
    </th>
  );
}

export default function App() {
  const [data, setData]           = useState({ b2b: [], b2c: [] });
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [activeTab, setActiveTab] = useState('b2b');
  const [sortCol, setSortCol]     = useState('totalDOC');
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

  const skus = activeTab === 'b2b' ? data.b2b : data.b2c;

  const totalSOH       = skus.reduce((s, r) => s + r.totalSOH, 0);
  const totalGGN       = skus.reduce((s, r) => s + r.sohGGN, 0);
  const totalBHW       = skus.reduce((s, r) => s + r.sohBHW, 0);
  const totalBLR       = skus.reduce((s, r) => s + r.sohBLR, 0);
  const totalDRR       = skus.reduce((s, r) => s + r.totalDRR, 0);
  const totalIntransit = skus.reduce((s, r) => s + r.totalIntransit, 0);
  const avgDOC         = totalDRR > 0 ? totalSOH / totalDRR : null;
  const criticalCnt    = skus.filter(r => r.totalDOC > 0 && r.totalDOC <= 15).length;
  const stockoutCnt    = skus.filter(r => r.totalSOH === 0).length;

  const filtered = [...skus]
    .filter(r => r.style.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av = a[sortCol] ?? 0, bv = b[sortCol] ?? 0;
      if (sortCol === 'style' || sortCol === 'channelTag') return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      if (av === 0 && sortDir === 'asc') av = Infinity;
      if (bv === 0 && sortDir === 'asc') bv = Infinity;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

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
        body: JSON.stringify({ message: msg, history: chat.slice(-6), activeTab })
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setChat(h => [...h, { role: 'ai', text: json.reply }]);
    } catch (e) { setChat(h => [...h, { role: 'ai', text: 'Error: ' + e.message }]); }
    setChatLoading(false);
  }

  function toggleVoice() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) { alert('Voice not supported'); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'en-IN'; r.continuous = false; r.interimResults = false;
    r.onresult = e => { setInput(e.results[0][0].transcript); setListening(false); };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recognitionRef.current = r; r.start(); setListening(true);
  }

  const TH = ({ label, col, right }) => (
    <th onClick={() => toggleSort(col)} style={{
      padding: '9px 11px', textAlign: right ? 'right' : 'left',
      color: sortCol === col ? '#e879f9' : MUTED,
      cursor: 'pointer', userSelect: 'none',
      fontFamily: MONO, fontSize: 9,
      letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      borderBottom: `1px solid ${BORDER}`,
      background: BG2, position: 'sticky', top: 22, zIndex: 1, fontWeight: 400,
    }}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16, background: BG }}>
      <div style={{ fontFamily: 'monospace', fontSize: 13, color: MUTED, letterSpacing: '0.14em' }}>VILLAIN · INVENTORY REVIEW</div>
      <div style={{ width: 180, height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
        <div style={{ width: '60%', height: '100%', background: RED, borderRadius: 2 }} />
      </div>
      <div style={{ color: MUTED, fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em' }}>loading data...</div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 14, padding: 32, background: BG }}>
      <div style={{ fontFamily: MONO, fontSize: 13, color: MUTED, letterSpacing: '0.14em' }}>VILLAIN · INVENTORY REVIEW</div>
      <div style={{ color: '#ff6b6b', fontSize: 12, background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.2)', padding: '10px 18px', borderRadius: 8, maxWidth: 480, textAlign: 'center', fontFamily: MONO }}>{error}</div>
      <button onClick={fetchData} style={{ background: RED, border: 'none', borderRadius: 8, padding: '9px 24px', color: '#fff', fontFamily: MONO, fontSize: 12, cursor: 'pointer', letterSpacing: '0.08em' }}>retry</button>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: BG, color: TEXT }}>

      {/* Header — exact MyFitness style */}
      <div style={{ padding: '0 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: BG2, height: 46 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: TEXT, letterSpacing: '0.04em' }}>📦 Villain Inventory Review</span>
          {lastUpdated && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,200,150,0.08)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 20, padding: '3px 10px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00c896', display: 'inline-block' }} />
              <span style={{ fontFamily: MONO, fontSize: 9, color: '#00c896', letterSpacing: '0.08em' }}>LIVE · {lastUpdated}</span>
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {stockoutCnt > 0 && <span style={{ background: 'rgba(255,68,68,0.12)', border: '1px solid rgba(255,68,68,0.3)', color: '#ff4444', fontFamily: MONO, fontSize: 10, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>⚠ {stockoutCnt} Stockout</span>}
          {criticalCnt > 0 && <span style={{ background: 'rgba(245,166,35,0.10)', border: '1px solid rgba(245,166,35,0.3)', color: '#f5a623', fontFamily: MONO, fontSize: 10, padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>⚠ {criticalCnt} Critical</span>}
          <button onClick={fetchData} style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 14px', color: MUTED, fontSize: 10, cursor: 'pointer', fontFamily: MONO }}>↻ Refresh</button>
        </div>
      </div>

      {/* Tabs — exact MyFitness style */}
      <div style={{ display: 'flex', padding: '0 20px', background: BG2, borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        {[{ key: 'b2b', label: '📊 B2B Summary' }, { key: 'b2c', label: '🛒 B2C Summary' }].map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSearch(''); setSortCol('totalDOC'); setSortDir('asc'); setChat([]); }}
            style={{ padding: '10px 18px', background: 'none', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #e879f9' : '2px solid transparent', color: activeTab === tab.key ? '#e879f9' : MUTED, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer', textTransform: 'uppercase', marginBottom: -1, transition: 'color 0.15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cards — exact MyFitness sizing */}
      <div style={{ display: 'flex', gap: 10, padding: '14px 20px', flexShrink: 0, flexWrap: 'wrap' }}>
        <Card label="Total SOH"  value={fmtFull(totalSOH)} sub={`GGN: ${fmtFull(totalGGN)} · BHW: ${fmtFull(totalBHW)} · BLR: ${fmtFull(totalBLR)}`} accent="#e879f9" />
        <Card label="Avg DOC"    value={fmtDoc(avgDOC)}    sub={`${skus.length} SKUs`} />
        <Card label="Total DRR"  value={fmtFull(totalDRR)} sub="daily run rate" accent="#00c896" />
        <Card label="Intransit"  value={fmtFull(totalIntransit)} sub="STN + Factory" accent="#7c5cfc" />
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', flex: 1, padding: '0 20px 16px', gap: 14, minHeight: 0 }}>

        {/* Table */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexShrink: 0 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search style..."
              style={{ background: BG3, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '7px 12px', color: TEXT, fontSize: 12, outline: 'none', fontFamily: MONO, width: 220 }} />
            <span style={{ color: MUTED, fontFamily: MONO, fontSize: 10 }}>{filtered.length} / {skus.length} SKUs</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', borderRadius: 8, border: `1px solid ${BORDER}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th colSpan={activeTab === 'b2b' ? 2 : 1} style={{ background: BG, position: 'sticky', top: 0, zIndex: 2, borderBottom: `1px solid ${BORDER}` }} />
                  <GH label="SOH"                 cols={4} color="#ff4444" />
                  <GH label="DRR"                 cols={4} color="#00c896" />
                  <GH label="DOC"                 cols={4} color="#f5a623" />
                  <GH label="Intransit"           cols={4} color="#7c5cfc" />
                  <GH label="DOC w/ Intransit"    cols={4} color="#e879f9" />
                </tr>
                <tr>
                  <TH label="Style"   col="style"          />
                  {activeTab === 'b2b' && <TH label="Channel" col="channelTag" />}
                  <TH label="Total"   col="totalSOH"       right />
                  <TH label="GGN"     col="sohGGN"         right />
                  <TH label="BHW"     col="sohBHW"         right />
                  <TH label="BLR"     col="sohBLR"         right />
                  <TH label="Total"   col="totalDRR"       right />
                  <TH label="GGN"     col="drrGGN"         right />
                  <TH label="BHW"     col="drrBHW"         right />
                  <TH label="BLR"     col="drrBLR"         right />
                  <TH label="Total"   col="totalDOC"       right />
                  <TH label="GGN"     col="docGGN"         right />
                  <TH label="BHW"     col="docBHW"         right />
                  <TH label="BLR"     col="docBLR"         right />
                  <TH label="Total"   col="totalIntransit" right />
                  <TH label="GGN"     col="intGGN"         right />
                  <TH label="BHW"     col="intBHW"         right />
                  <TH label="BLR"     col="intBLR"         right />
                  <TH label="Total"   col="docIntTotal"    right />
                  <TH label="GGN"     col="docIntGGN"      right />
                  <TH label="BHW"     col="docIntBHW"      right />
                  <TH label="BLR"     col="docIntBLR"      right />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={`${r.style}-${i}`}
                    style={{ borderBottom: `1px solid rgba(255,255,255,0.04)`, background: r.totalSOH === 0 ? 'rgba(255,68,68,0.05)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,121,249,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = r.totalSOH === 0 ? 'rgba(255,68,68,0.05)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                  >
                    <td style={{ padding: '8px 11px', color: TEXT2, fontWeight: 600, whiteSpace: 'nowrap', minWidth: 150 }}>{r.style}</td>
                    {activeTab === 'b2b' && <td style={{ padding: '8px 11px', color: MUTED, fontSize: 11, whiteSpace: 'nowrap' }}>{r.channelTag || '—'}</td>}
                    <td style={{ padding: '8px 11px', textAlign: 'right', color: TEXT, fontFamily: MONO, fontSize: 11, fontWeight: 600 }}>{fmtFull(r.totalSOH)}</td>
                    <td style={{ padding: '8px 11px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(r.sohGGN)}</td>
                    <td style={{ padding: '8px 11px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(r.sohBHW)}</td>
                    <td style={{ padding: '8px 11px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(r.sohBLR)}</td>
                    <td style={{ padding: '8px 11px', textAlign: 'right', color: TEXT, fontFamily: MONO, fontSize: 11, fontWeight: 600 }}>{fmtFull(r.totalDRR)}</td>
                    <td style={{ padding: '8px 11px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(r.drrGGN)}</td>
                    <td style={{ padding: '8px 11px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(r.drrBHW)}</td>
                    <td style={{ padding: '8px 11px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(r.drrBLR)}</td>
                    <td style={{ padding: '8px 11px', textAlign: 'right' }}><Pill v={r.totalDOC} /></td>
                    <td style={{ padding: '8px 11px', textAlign: 'right' }}><Pill v={r.docGGN} /></td>
                    <td style={{ padding: '8px 11px', textAlign: 'right' }}><Pill v={r.docBHW} /></td>
                    <td style={{ padding: '8px 11px', textAlign: 'right' }}><Pill v={r.docBLR} /></td>
                    <td style={{ padding: '8px 11px', textAlign: 'right', color: TEXT, fontFamily: MONO, fontSize: 11, fontWeight: 600 }}>{fmtFull(r.totalIntransit)}</td>
                    <td style={{ padding: '8px 11px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(r.intGGN)}</td>
                    <td style={{ padding: '8px 11px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(r.intBHW)}</td>
                    <td style={{ padding: '8px 11px', textAlign: 'right', color: MUTED, fontFamily: MONO, fontSize: 11 }}>{fmt(r.intBLR)}</td>
                    <td style={{ padding: '8px 11px', textAlign: 'right' }}><Pill v={r.docIntTotal} /></td>
                    <td style={{ padding: '8px 11px', textAlign: 'right' }}><Pill v={r.docIntGGN} /></td>
                    <td style={{ padding: '8px 11px', textAlign: 'right' }}><Pill v={r.docIntBHW} /></td>
                    <td style={{ padding: '8px 11px', textAlign: 'right' }}><Pill v={r.docIntBLR} /></td>
                  </tr>
                ))}
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

        {/* Chat — exact MyFitness meeting assistant style */}
        <div style={{ width: 280, flexShrink: 0, background: BG2, border: `1px solid ${BORDER}`, borderRadius: 8, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '11px 16px', borderBottom: `1px solid ${BORDER}`, fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: '0.16em', textTransform: 'uppercase', flexShrink: 0 }}>
            ▸▸ Meeting Assistant
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {chat.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ color: MUTED, fontFamily: MONO, fontSize: 10, marginBottom: 4 }}>Ask about {activeTab.toUpperCase()} inventory...</div>
                {['Critical SKUs?', 'Low DOC items?', 'Stockout risk?'].map(q => (
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
            {chatLoading && (
              <div style={{ alignSelf: 'flex-start', color: MUTED, fontFamily: MONO, fontSize: 10, padding: '8px 12px', background: BG3, borderRadius: '10px 10px 10px 2px', border: `1px solid ${BORDER}` }}>
                analyzing...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '10px 12px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 6, flexShrink: 0 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask about any SKU or metric..."
              style={{ flex: 1, background: BG3, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '8px 10px', color: TEXT, fontSize: 11, outline: 'none', fontFamily: MONO }} />
            <button onClick={toggleVoice} title="Voice input"
              style={{ background: listening ? 'rgba(232,121,249,0.15)' : BG3, border: `1px solid ${listening ? 'rgba(232,121,249,0.4)' : BORDER}`, borderRadius: 6, padding: '8px 9px', color: listening ? '#e879f9' : MUTED, cursor: 'pointer', fontSize: 13 }}>🎙</button>
            <button onClick={sendChat} disabled={chatLoading || !input.trim()}
              style={{ background: 'linear-gradient(135deg, #e879f9, #7c5cfc)', border: 'none', borderRadius: 6, padding: '8px 14px', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 700, opacity: chatLoading || !input.trim() ? 0.3 : 1 }}>→</button>
          </div>
        </div>
      </div>
    </div>
  );
}
