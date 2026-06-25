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
  if (doc === null || !isFinite(doc)) return { label: '—', color: '#999', bg: '#f0f0f0' };
  if (doc <= 0)  return { label: 'STOCKOUT',  color: '#c0001a', bg: '#ffe0e4' };
  if (doc <= 15) return { label: fmtDoc(doc), color: '#b94400', bg: '#ffe8d6' };
  if (doc <= 30) return { label: fmtDoc(doc), color: '#7a6000', bg: '#fff5c0' };
  if (doc <= 60) return { label: fmtDoc(doc), color: '#1a6e3c', bg: '#d4f5e2' };
  return           { label: fmtDoc(doc), color: '#4a2fa0', bg: '#ece8ff' };
}

function Card({ label, value, sub, accent }) {
  return (
    <div style={{
      flex: 1, minWidth: 120,
      background: '#fff',
      border: '1px solid #e8e8e8',
      borderLeft: `3px solid ${accent}`,
      borderRadius: 8, padding: '10px 14px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    }}>
      <div style={{ color: '#999', fontSize: 9, fontFamily: "'Space Mono',monospace", letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#111', fontSize: 20, fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '0.04em', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color: '#bbb', fontSize: 10, marginTop: 3, fontFamily: "'Space Mono',monospace" }}>{sub}</div>}
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
  const avgDoc      = totalAvg > 0 ? (totalSOH / totalAvg) * 30 : null;
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
      color: sortCol === col ? '#e0001a' : '#555',
      cursor: 'pointer', userSelect: 'none',
      fontFamily: "'Space Mono',monospace", fontSize: 10,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      borderBottom: '2px solid #e8e8e8',
      background: '#fafafa',
      position: 'sticky', top: 0, zIndex: 1,
    }}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, background: '#f5f5f5' }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, color: '#e0001a', letterSpacing: '0.1em' }}>VILLAIN</div>
      <div style={{ color: '#aaa', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>LOADING INVENTORY...</div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, padding: 32, background: '#f5f5f5' }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, color: '#e0001a', letterSpacing: '0.1em' }}>VILLAIN</div>
      <div style={{ color: '#c0001a', fontSize: 12, background: '#ffe0e4', padding: '10px 18px', borderRadius: 8, maxWidth: 500, textAlign: 'center', fontFamily: "'Space Mono',monospace" }}>{error}</div>
      <button onClick={fetchData} style={{ background: '#e0001a', border: 'none', borderRadius: 8, padding: '8px 20px', color: '#fff', fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, cursor: 'pointer' }}>RETRY</button>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f5f5f7' }}>

      {/* Header */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: '#e0001a', letterSpacing: '0.1em' }}>VILLAIN</span>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#bbb', letterSpacing: '0.18em' }}>INVENTORY REVIEW</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {criticalCnt > 0 && (
            <span style={{ background: '#ffe0e4', border: '1px solid #ffb3bb', color: '#c0001a', fontFamily: "'Space Mono',monospace", fontSize: 10, padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>
              ⚠ {criticalCnt} CRITICAL
            </span>
          )}
          {lastUpdated && <span style={{ color: '#bbb', fontFamily: "'Space Mono',monospace", fontSize: 9 }}>updated {lastUpdated}</span>}
          <button onClick={fetchData} style={{ background: '#f5f5f7', border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 12px', color: '#888', fontSize: 10, cursor: 'pointer', fontFamily: "'Space Mono',monospace" }}>↻ REFRESH</button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 20px', flexShrink: 0, flexWrap: 'wrap' }}>
        <Card label="Total SOH"         value={fmt(totalSOH)}             sub={`MRP: ${fmt(totalMRP)} · SOR: ${fmt(totalSOR)} · B2C: ${fmt(totalB2C)}`} accent="#e0001a" />
        <Card label="Avg DOC"           value={fmtDoc(avgDoc)}            sub={`across ${skus.length} SKUs`} accent="#f5a623" />
        <Card label="Jun'26 MTD"        value={fmt(totalMTD)}             sub="month to date" accent="#27ae60" />
        <Card label="Avg Monthly Sales" value={fmt(Math.round(totalAvg))} sub="Apr + May avg" accent="#6c47ff" />
      </div>

      {/* Main: table + chat */}
      <div style={{ display: 'flex', flex: 1, padding: '0 20px 16px', gap: 14, minHeight: 0 }}>

        {/* Table */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexShrink: 0 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search style..."
              style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, padding: '6px 12px', color: '#333', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: 200 }}
            />
            <span style={{ color: '#bbb', fontFamily: "'Space Mono',monospace", fontSize: 10 }}>{filtered.length} of {skus.length} SKUs</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
                      style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fff5f5'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'}
                    >
                      <td style={{ padding: '8px 12px', color: '#111', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.style}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.mrp)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.sor)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.b2c)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#111', fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 600 }}>{fmt(r.totalSOH)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.apr)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.may)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.mtd)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(Math.round(r.avg))}</td>
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
            {[['STOCKOUT', '#c0001a'], ['CRITICAL ≤15d', '#b94400'], ['LOW ≤30d', '#7a6000'], ['HEALTHY ≤60d', '#1a6e3c'], ['OVERSTOCK >60d', '#4a2fa0']].map(([l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#aaa' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        <div style={{ width: 280, flexShrink: 0, background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, display: 'flex', flexDirection: 'column', minHeight: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', fontFamily: "'Space Mono',monospace", fontSize: 9, color: '#e0001a', letterSpacing: '0.14em', flexShrink: 0 }}>
            ◈ AI ANALYST
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chat.length === 0 && (
              <div style={{ color: '#ccc', fontSize: 11, fontFamily: "'Space Mono',monospace", lineHeight: 1.7 }}>
                Ask anything about Villain inventory...<br /><br />
                <span style={{ color: '#ddd' }}>"Which SKUs are critical?" · "What needs replenishment?"</span>
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
                background: m.role === 'user' ? '#ffe0e4' : '#f5f5f7',
                border: `1px solid ${m.role === 'user' ? '#ffb3bb' : '#e8e8e8'}`,
                borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                padding: '8px 10px', fontSize: 12, lineHeight: 1.6,
                color: m.role === 'user' ? '#c0001a' : '#333',
                whiteSpace: 'pre-wrap'
              }}>{m.text}</div>
            ))}
            {chatLoading && <div style={{ alignSelf: 'flex-start', color: '#e0001a', fontFamily: "'Space Mono',monospace", fontSize: 10 }}>analyzing...</div>}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '8px 10px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 6, flexShrink: 0 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask the analyst..."
              style={{ flex: 1, background: '#f5f5f7', border: '1px solid #e0e0e0', borderRadius: 6, padding: '7px 10px', color: '#333', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={toggleVoice} style={{ background: listening ? '#ffe0e4' : '#f5f5f7', border: '1px solid #e0e0e0', borderRadius: 6, padding: '7px 8px', color: listening ? '#e0001a' : '#aaa', cursor: 'pointer', fontSize: 12 }}>🎙</button>
            <button onClick={sendChat} disabled={chatLoading || !input.trim()} style={{ background: '#e0001a', border: 'none', borderRadius: 6, padding: '7px 12px', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700, opacity: chatLoading || !input.trim() ? 0.4 : 1 }}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}
