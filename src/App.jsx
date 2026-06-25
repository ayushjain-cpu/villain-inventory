import { useState, useRef, useEffect } from 'react';

function fmt(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return Math.round(v).toLocaleString('en-IN');
}
function fmtDoc(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return Math.round(v) + 'd';
}
function docStatus(doc) {
  if (doc === null || !isFinite(doc)) return { label: '—', color: '#777', bg: 'rgba(255,255,255,0.05)' };
  if (doc <= 0)  return { label: 'STOCKOUT',  color: '#ff2d55', bg: 'rgba(255,45,85,0.18)' };
  if (doc <= 15) return { label: fmtDoc(doc), color: '#ff6b00', bg: 'rgba(255,107,0,0.15)' };
  if (doc <= 30) return { label: fmtDoc(doc), color: '#f5c518', bg: 'rgba(245,197,24,0.13)' };
  if (doc <= 60) return { label: fmtDoc(doc), color: '#00e676', bg: 'rgba(0,230,118,0.12)' };
  return           { label: fmtDoc(doc), color: '#7c5cfc', bg: 'rgba(124,92,252,0.13)' };
}

function Card({ label, value, sub, accent }) {
  return (
    <div style={{
      flex: 1, minWidth: 120,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `3px solid ${accent}`,
      borderRadius: 8, padding: '10px 14px',
    }}>
      <div style={{ color: '#666', fontSize: 9, fontFamily: "'Space Mono',monospace", letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#f0f0f0', fontSize: 20, fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '0.04em', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color: '#444', fontSize: 10, marginTop: 3, fontFamily: "'Space Mono',monospace" }}>{sub}</div>}
    </div>
  );
}

export default function App() {
  const [skus, setSkus]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [sortCol, setSortCol]     = useState('doc');
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
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSkus(data.skus);
      setLastUpdated(new Date(data.updatedAt).toLocaleTimeString('en-IN'));
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  const totalMRP    = skus.reduce((s, r) => s + r.mrp, 0);
  const totalSOR    = skus.reduce((s, r) => s + r.sor, 0);
  const totalB2C    = skus.reduce((s, r) => s + r.b2c, 0);
  const totalSOH    = totalMRP + totalSOR + totalB2C;
  const totalMTD    = skus.reduce((s, r) => s + r.mtd, 0);
  const totalAvg    = skus.reduce((s, r) => s + r.avg, 0);
  const validDocs   = skus.filter(r => r.doc !== null && isFinite(r.doc));
  const avgDoc      = validDocs.length ? validDocs.reduce((s, r) => s + r.doc, 0) / validDocs.length : null;
  const criticalCnt = skus.filter(r => r.doc !== null && r.doc <= 30).length;

  const filtered = [...skus]
    .filter(r => r.style.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (av === null) av = sortDir === 'asc' ? Infinity : -Infinity;
      if (bv === null) bv = sortDir === 'asc' ? Infinity : -Infinity;
      if (sortCol === 'style') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  async function sendChat() {
    if (!input.trim() || chatLoading) return;
    const msg = input.trim();
    setInput('');
    setChat(h => [...h, { role: 'user', text: msg }]);
    setChatLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history: chat.slice(-6) })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setChat(h => [...h, { role: 'ai', text: data.reply }]);
    } catch (e) {
      setChat(h => [...h, { role: 'ai', text: 'Error: ' + e.message }]);
    }
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
    recognitionRef.current = r;
    r.start(); setListening(true);
  }

  const TH = ({ label, col, right }) => (
    <th onClick={() => toggleSort(col)} style={{
      padding: '8px 12px', textAlign: right ? 'right' : 'left',
      color: sortCol === col ? '#ff2d55' : '#aaa',
      cursor: 'pointer', userSelect: 'none',
      fontFamily: "'Space Mono',monospace", fontSize: 10,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      background: '#111',
      position: 'sticky', top: 0, zIndex: 1,
    }}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, color: '#ff2d55', letterSpacing: '0.1em' }}>VILLAIN</div>
      <div style={{ color: '#444', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>LOADING INVENTORY...</div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, padding: 32 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, color: '#ff2d55', letterSpacing: '0.1em' }}>VILLAIN</div>
      <div style={{ color: '#ff2d55', fontSize: 12, background: 'rgba(255,45,85,0.1)', padding: '10px 18px', borderRadius: 8, maxWidth: 500, textAlign: 'center', fontFamily: "'Space Mono',monospace" }}>{error}</div>
      <button onClick={fetchData} style={{ background: '#ff2d55', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, cursor: 'pointer' }}>RETRY</button>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#ff2d55', letterSpacing: '0.1em' }}>VILLAIN</span>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#333', letterSpacing: '0.18em' }}>INVENTORY REVIEW</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {criticalCnt > 0 && (
            <span style={{ background: 'rgba(255,45,85,0.15)', border: '1px solid rgba(255,45,85,0.3)', color: '#ff2d55', fontFamily: "'Space Mono',monospace", fontSize: 10, padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>
              ⚠ {criticalCnt} CRITICAL
            </span>
          )}
          {lastUpdated && <span style={{ color: '#333', fontFamily: "'Space Mono',monospace", fontSize: 9 }}>updated {lastUpdated}</span>}
          <button onClick={fetchData} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '4px 12px', color: '#555', fontSize: 10, cursor: 'pointer', fontFamily: "'Space Mono',monospace" }}>↻ REFRESH</button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 20px', flexShrink: 0, flexWrap: 'wrap' }}>
        <Card label="Total SOH"         value={fmt(totalSOH)}             sub={`MRP: ${fmt(totalMRP)} · SOR: ${fmt(totalSOR)} · B2C: ${fmt(totalB2C)}`} accent="#ff2d55" />
        <Card label="Avg DOC"           value={fmtDoc(avgDoc)}            sub={`across ${skus.length} SKUs`} accent="#f5c518" />
        <Card label="Jun'26 MTD"        value={fmt(totalMTD)}             sub="month to date" accent="#00e676" />
        <Card label="Avg Monthly Sales" value={fmt(Math.round(totalAvg))} sub="Apr + May avg" accent="#7c5cfc" />
      </div>

      {/* Main: table + chat — fills remaining height */}
      <div style={{ display: 'flex', flex: 1, padding: '0 20px 16px', gap: 16, minHeight: 0 }}>

        {/* Table panel */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexShrink: 0 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search style..."
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 12px', color: '#e8e8e8', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: 200 }}
            />
            <span style={{ color: '#333', fontFamily: "'Space Mono',monospace", fontSize: 10 }}>{filtered.length} of {skus.length} SKUs</span>
          </div>

          {/* Scrollable table */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <TH label="Style"     col="style"    />
                  <TH label="MRP SOH"   col="mrp"      right />
                  <TH label="SOR SOH"   col="sor"      right />
                  <TH label="B2C SOH"   col="b2c"      right />
                  <TH label="Total SOH" col="totalSOH" right />
                  <TH label="Apr Sales" col="apr"      right />
                  <TH label="May Sales" col="may"      right />
                  <TH label="Jun MTD"   col="mtd"      right />
                  <TH label="Avg Sales" col="avg"      right />
                  <TH label="DOC"       col="doc"      right />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const st = docStatus(r.doc);
                  return (
                    <tr key={r.style}
                      style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,45,85,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                    >
                      <td style={{ padding: '8px 12px', color: '#e8e8e8', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.style}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.mrp)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.sor)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.b2c)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#e8e8e8', fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 600 }}>{fmt(r.totalSOH)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.apr)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.may)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.mtd)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#888', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(Math.round(r.avg))}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 5, fontFamily: "'Space Mono',monospace", fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap', flexShrink: 0 }}>
            {[['STOCKOUT', '#ff2d55'], ['CRITICAL ≤15d', '#ff6b00'], ['LOW ≤30d', '#f5c518'], ['HEALTHY ≤60d', '#00e676'], ['OVERSTOCK >60d', '#7c5cfc']].map(([l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#444' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Chat panel — full height, sticky */}
        <div style={{ width: 280, flexShrink: 0, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#ff2d55', letterSpacing: '0.14em', flexShrink: 0 }}>
            ◈ AI ANALYST
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chat.length === 0 && (
              <div style={{ color: '#2a2a2a', fontSize: 11, fontFamily: "'Space Mono',monospace", lineHeight: 1.7 }}>
                Ask anything about Villain inventory...<br /><br />
                <span style={{ color: '#222' }}>"Which SKUs are critical?" · "What needs replenishment?"</span>
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
                background: m.role === 'user' ? 'rgba(255,45,85,0.14)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${m.role === 'user' ? 'rgba(255,45,85,0.25)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                padding: '8px 10px', fontSize: 12, lineHeight: 1.6, color: '#ccc',
                whiteSpace: 'pre-wrap'
              }}>{m.text}</div>
            ))}
            {chatLoading && <div style={{ alignSelf: 'flex-start', color: '#ff2d55', fontFamily: "'Space Mono',monospace", fontSize: 10 }}>analyzing...</div>}
            <div ref={chatEndRef} />
          </div>
          {/* Input always visible at bottom */}
          <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 6, flexShrink: 0 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask the analyst..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '7px 10px', color: '#e8e8e8', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={toggleVoice} style={{ background: listening ? 'rgba(255,45,85,0.25)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 8px', color: listening ? '#ff2d55' : '#555', cursor: 'pointer', fontSize: 12 }}>🎙</button>
            <button onClick={sendChat} disabled={chatLoading || !input.trim()} style={{ background: '#ff2d55', border: 'none', borderRadius: 6, padding: '7px 12px', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700, opacity: chatLoading || !input.trim() ? 0.4 : 1 }}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}
