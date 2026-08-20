import { useState, useRef, useEffect } from 'react';

const RED = '#ff2d55';
const MONO = "'Space Mono', monospace";
const BEBAS = "'Bebas Neue', sans-serif";

function fmt(v) {
  if (v === null || v === undefined || isNaN(v) || v === 0) return '—';
  return Math.round(v).toLocaleString('en-IN');
}
function fmtDoc(v) {
  if (!v || isNaN(v) || !isFinite(v) || v === 0) return '—';
  return Math.round(v) + 'd';
}
function docPill(doc) {
  if (!doc || !isFinite(doc) || doc === 0) return { color: '#555', bg: 'rgba(255,255,255,0.06)' };
  if (doc <= 7)  return { color: '#ff2d55', bg: 'rgba(255,45,85,0.18)' };
  if (doc <= 15) return { color: '#ff6b00', bg: 'rgba(255,107,0,0.15)' };
  if (doc <= 30) return { color: '#f5c518', bg: 'rgba(245,197,24,0.13)' };
  if (doc <= 60) return { color: '#00e676', bg: 'rgba(0,230,118,0.12)' };
  return           { color: '#7c5cfc', bg: 'rgba(124,92,252,0.13)' };
}

function Pill({ v }) {
  const s = docPill(v);
  return <span style={{ background: s.bg, color: s.color, padding: '2px 7px', borderRadius: 4, fontFamily: MONO, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtDoc(v)}</span>;
}

function Card({ label, value, sub, accent }) {
  return (
    <div style={{ flex: 1, minWidth: 130, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${accent}`, borderRadius: 8, padding: '10px 14px' }}>
      <div style={{ color: '#888', fontSize: 9, fontFamily: MONO, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#f0f0f0', fontSize: 20, fontWeight: 700, fontFamily: BEBAS, letterSpacing: '0.04em', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color: '#888', fontSize: 10, marginTop: 3, fontFamily: MONO }}>{sub}</div>}
    </div>
  );
}

// Grouped header
function GH({ label, cols, color }) {
  return <th colSpan={cols} style={{ padding: '5px 8px', textAlign: 'center', fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color, borderBottom: `1px solid ${color}30`, background: '#111', position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap' }}>{label}</th>;
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
      setLastUpdated(new Date(json.updatedAt).toLocaleTimeString('en-IN'));
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
      padding: '6px 10px', textAlign: right ? 'right' : 'left',
      color: sortCol === col ? RED : '#aaa',
      cursor: 'pointer', userSelect: 'none',
      fontFamily: MONO, fontSize: 9,
      letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: '#111', position: 'sticky', top: 22, zIndex: 1,
    }}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, background: '#0a0a0a' }}>
      <div style={{ fontFamily: BEBAS, fontSize: 52, color: RED, letterSpacing: '0.1em' }}>VILLAIN</div>
      <div style={{ color: '#333', fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em' }}>LOADING INVENTORY...</div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, padding: 32, background: '#0a0a0a' }}>
      <div style={{ fontFamily: BEBAS, fontSize: 52, color: RED, letterSpacing: '0.1em' }}>VILLAIN</div>
      <div style={{ color: RED, fontSize: 12, background: 'rgba(255,45,85,0.1)', padding: '10px 18px', borderRadius: 8, maxWidth: 500, textAlign: 'center', fontFamily: MONO }}>{error}</div>
      <button onClick={fetchData} style={{ background: RED, border: 'none', borderRadius: 8, padding: '8px 24px', color: '#fff', fontFamily: BEBAS, fontSize: 20, cursor: 'pointer', letterSpacing: '0.1em' }}>RETRY</button>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a0a0a', color: '#e8e8e8' }}>

      {/* Header */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'rgba(255,45,85,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontFamily: BEBAS, fontSize: 30, color: RED, letterSpacing: '0.12em' }}>VILLAIN</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: '#555', letterSpacing: '0.2em' }}>INVENTORY REVIEW</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {stockoutCnt > 0 && <span style={{ background: 'rgba(255,45,85,0.15)', border: '1px solid rgba(255,45,85,0.3)', color: RED, fontFamily: MONO, fontSize: 10, padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>⚠ {stockoutCnt} STOCKOUT</span>}
          {criticalCnt > 0 && <span style={{ background: 'rgba(255,107,0,0.12)', border: '1px solid rgba(255,107,0,0.3)', color: '#ff6b00', fontFamily: MONO, fontSize: 10, padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>⚠ {criticalCnt} CRITICAL</span>}
          {lastUpdated && <span style={{ color: '#555', fontFamily: MONO, fontSize: 9 }}>updated {lastUpdated}</span>}
          <button onClick={fetchData} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 12px', color: '#555', fontSize: 10, cursor: 'pointer', fontFamily: MONO }}>↻ REFRESH</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '0 20px', background: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        {['b2b', 'b2c'].map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setSearch(''); setSortCol('totalDOC'); setSortDir('asc'); setChat([]); }}
            style={{ padding: '9px 20px', background: 'none', border: 'none', borderBottom: activeTab === tab ? `2px solid ${RED}` : '2px solid transparent', color: activeTab === tab ? RED : '#888', fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', textTransform: 'uppercase', marginBottom: -1 }}>
            {tab === 'b2b' ? 'B2B Summary' : 'B2C Summary'}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 20px', flexShrink: 0, flexWrap: 'wrap' }}>
        <Card label="Total SOH"  value={fmt(totalSOH)}       sub={`GGN: ${fmt(totalGGN)} · BHW: ${fmt(totalBHW)} · BLR: ${fmt(totalBLR)}`} accent={RED} />
        <Card label="Avg DOC"    value={fmtDoc(avgDOC)}      sub={`across ${skus.length} SKUs`} accent="#f5c518" />
        <Card label="Total DRR"  value={fmt(totalDRR)}       sub="daily run rate" accent="#00e676" />
        <Card label="Intransit"  value={fmt(totalIntransit)} sub="STN + Factory" accent="#7c5cfc" />
      </div>

      {/* Main */}
      <div style={{ display: 'flex', flex: 1, padding: '0 20px 16px', gap: 14, minHeight: 0 }}>

        {/* Table */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexShrink: 0 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search style..."
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 12px', color: '#e8e8e8', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: 200 }} />
            <span style={{ color: '#666', fontFamily: MONO, fontSize: 10 }}>{filtered.length} of {skus.length} SKUs</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                {/* Group row */}
                <tr>
                  <th colSpan={activeTab === 'b2b' ? 2 : 1} style={{ background: '#111', position: 'sticky', top: 0, zIndex: 2, borderBottom: '1px solid rgba(255,255,255,0.06)' }} />
                  <GH label="SOH" cols={4} color="#ff2d55" />
                  <GH label="DRR" cols={4} color="#00e676" />
                  <GH label="DOC" cols={4} color="#f5c518" />
                  <GH label="Intransit (STN+Factory)" cols={4} color="#7c5cfc" />
                  <GH label="DOC w/ Intransit" cols={4} color="#00bcd4" />
                </tr>
                {/* Col headers */}
                <tr>
                  <TH label="Style"    col="style"       />
                  {activeTab === 'b2b' && <TH label="Channel" col="channelTag" />}
                  <TH label="Total"    col="totalSOH"    right />
                  <TH label="GGN"      col="sohGGN"      right />
                  <TH label="BHW"      col="sohBHW"      right />
                  <TH label="BLR"      col="sohBLR"      right />
                  <TH label="Total"    col="totalDRR"    right />
                  <TH label="GGN"      col="drrGGN"      right />
                  <TH label="BHW"      col="drrBHW"      right />
                  <TH label="BLR"      col="drrBLR"      right />
                  <TH label="Total"    col="totalDOC"    right />
                  <TH label="GGN"      col="docGGN"      right />
                  <TH label="BHW"      col="docBHW"      right />
                  <TH label="BLR"      col="docBLR"      right />
                  <TH label="Total"    col="totalIntransit" right />
                  <TH label="GGN"      col="intGGN"      right />
                  <TH label="BHW"      col="intBHW"      right />
                  <TH label="BLR"      col="intBLR"      right />
                  <TH label="Total"    col="docIntTotal" right />
                  <TH label="GGN"      col="docIntGGN"   right />
                  <TH label="BHW"      col="docIntBHW"   right />
                  <TH label="BLR"      col="docIntBLR"   right />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={`${r.style}-${i}`}
                    style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,45,85,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                  >
                    <td style={{ padding: '7px 10px', color: '#e8e8e8', fontWeight: 500, whiteSpace: 'nowrap', minWidth: 160 }}>{r.style}</td>
                    {activeTab === 'b2b' && <td style={{ padding: '7px 10px', color: '#aaa', fontSize: 11, whiteSpace: 'nowrap' }}>{r.channelTag || '—'}</td>}
                    {/* SOH */}
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#e8e8e8', fontFamily: MONO, fontSize: 11, fontWeight: 600 }}>{fmt(r.totalSOH)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#ccc', fontFamily: MONO, fontSize: 11 }}>{fmt(r.sohGGN)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#ccc', fontFamily: MONO, fontSize: 11 }}>{fmt(r.sohBHW)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#ccc', fontFamily: MONO, fontSize: 11 }}>{fmt(r.sohBLR)}</td>
                    {/* DRR */}
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#e8e8e8', fontFamily: MONO, fontSize: 11, fontWeight: 600 }}>{fmt(r.totalDRR)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#ccc', fontFamily: MONO, fontSize: 11 }}>{fmt(r.drrGGN)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#ccc', fontFamily: MONO, fontSize: 11 }}>{fmt(r.drrBHW)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#ccc', fontFamily: MONO, fontSize: 11 }}>{fmt(r.drrBLR)}</td>
                    {/* DOC */}
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}><Pill v={r.totalDOC} /></td>
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}><Pill v={r.docGGN} /></td>
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}><Pill v={r.docBHW} /></td>
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}><Pill v={r.docBLR} /></td>
                    {/* Intransit */}
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#e8e8e8', fontFamily: MONO, fontSize: 11, fontWeight: 600 }}>{fmt(r.totalIntransit)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#ccc', fontFamily: MONO, fontSize: 11 }}>{fmt(r.intGGN)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#ccc', fontFamily: MONO, fontSize: 11 }}>{fmt(r.intBHW)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'right', color: '#ccc', fontFamily: MONO, fontSize: 11 }}>{fmt(r.intBLR)}</td>
                    {/* DOC w/ Intransit */}
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}><Pill v={r.docIntTotal} /></td>
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}><Pill v={r.docIntGGN} /></td>
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}><Pill v={r.docIntBHW} /></td>
                    <td style={{ padding: '7px 10px', textAlign: 'right' }}><Pill v={r.docIntBLR} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', flexShrink: 0 }}>
            {[['≤7d', '#ff2d55'], ['≤15d CRITICAL', '#ff6b00'], ['≤30d LOW', '#f5c518'], ['≤60d HEALTHY', '#00e676'], ['>60d OVERSTOCK', '#7c5cfc']].map(([l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 9, color: '#aaa' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div style={{ width: 270, flexShrink: 0, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: MONO, fontSize: 9, color: RED, letterSpacing: '0.14em', flexShrink: 0 }}>
            ◈ AI ANALYST · {activeTab.toUpperCase()}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chat.length === 0 && (
              <div style={{ color: '#555', fontSize: 11, fontFamily: MONO, lineHeight: 1.7 }}>
                Ask about {activeTab.toUpperCase()} inventory...<br /><br />
                <span style={{ color: '#444' }}>"Critical SKUs?" · "Low DOC?" · "Stockout risk?"</span>
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%',
                background: m.role === 'user' ? 'rgba(255,45,85,0.14)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${m.role === 'user' ? 'rgba(255,45,85,0.25)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                padding: '8px 10px', fontSize: 12, lineHeight: 1.6,
                color: m.role === 'user' ? RED : '#ccc', whiteSpace: 'pre-wrap'
              }}>{m.text}</div>
            ))}
            {chatLoading && <div style={{ alignSelf: 'flex-start', color: RED, fontFamily: MONO, fontSize: 10 }}>analyzing...</div>}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6, flexShrink: 0 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask the analyst..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '7px 10px', color: '#e8e8e8', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={toggleVoice} style={{ background: listening ? 'rgba(255,45,85,0.2)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 8px', color: listening ? RED : '#555', cursor: 'pointer', fontSize: 12 }}>🎙</button>
            <button onClick={sendChat} disabled={chatLoading || !input.trim()} style={{ background: RED, border: 'none', borderRadius: 6, padding: '7px 12px', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700, opacity: chatLoading || !input.trim() ? 0.4 : 1 }}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}
