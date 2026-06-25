import { useState, useRef, useEffect } from 'react';

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmt(v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return Math.round(v).toLocaleString('en-IN');
}
function fmtDoc(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return Math.round(v) + 'd';
}

function docStatus(doc) {
  if (doc === null || !isFinite(doc)) return { label: '—', color: '#555', bg: 'rgba(255,255,255,0.05)' };
  if (doc <= 0)  return { label: 'STOCKOUT',  color: '#ff2d55', bg: 'rgba(255,45,85,0.18)' };
  if (doc <= 15) return { label: fmtDoc(doc), color: '#ff6b00', bg: 'rgba(255,107,0,0.15)' };
  if (doc <= 30) return { label: fmtDoc(doc), color: '#f5c518', bg: 'rgba(245,197,24,0.13)' };
  if (doc <= 60) return { label: fmtDoc(doc), color: '#00e676', bg: 'rgba(0,230,118,0.12)' };
  return           { label: fmtDoc(doc), color: '#7c5cfc', bg: 'rgba(124,92,252,0.13)' };
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function Card({ label, value, sub, accent }) {
  return (
    <div style={{
      flex: 1, minWidth: 140,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderLeft: `3px solid ${accent}`,
      borderRadius: 10, padding: '16px 20px',
    }}>
      <div style={{ color: '#555', fontSize: 10, fontFamily: "'Space Mono',monospace", letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ color: '#f0f0f0', fontSize: 26, fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '0.04em' }}>{value}</div>
      {sub && <div style={{ color: '#444', fontSize: 11, marginTop: 4, fontFamily: "'Space Mono',monospace" }}>{sub}</div>}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
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
  const chatEndRef = useRef(null);

  // Voice input
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

  // Load sheet data on mount
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
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  // ── Summary stats ────────────────────────────────────────────────────────
  const totalMRP    = skus.reduce((s, r) => s + r.mrp, 0);
  const totalSOR    = skus.reduce((s, r) => s + r.sor, 0);
  const totalB2C    = skus.reduce((s, r) => s + r.b2c, 0);
  const totalSOH    = totalMRP + totalSOR + totalB2C;
  const totalMTD    = skus.reduce((s, r) => s + r.mtd, 0);
  const totalAvg    = skus.reduce((s, r) => s + r.avg, 0);
  const validDocs   = skus.filter(r => r.doc !== null && isFinite(r.doc));
  const avgDoc      = validDocs.length ? validDocs.reduce((s, r) => s + r.doc, 0) / validDocs.length : null;
  const criticalCnt = skus.filter(r => r.doc !== null && r.doc <= 30).length;

  // ── Sort & filter ────────────────────────────────────────────────────────
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

  // ── Chat ─────────────────────────────────────────────────────────────────
  async function sendChat() {
    if (!input.trim() || chatLoading) return;
    const msg = input.trim();
    setInput('');
    const newHistory = [...chat, { role: 'user', text: msg }];
    setChat(newHistory);
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

  // ── Voice input ──────────────────────────────────────────────────────────
  function toggleVoice() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser'); return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'en-IN';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = e => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
    };
    r.onerror = () => setListening(false);
    r.onend   = () => setListening(false);
    recognitionRef.current = r;
    r.start();
    setListening(true);
  }

  // ── Column header ────────────────────────────────────────────────────────
  const TH = ({ label, col, right }) => (
    <th onClick={() => toggleSort(col)} style={{
      padding: '10px 14px', textAlign: right ? 'right' : 'left',
      color: sortCol === col ? '#ff2d55' : '#444',
      cursor: 'pointer', userSelect: 'none',
      fontFamily: "'Space Mono',monospace", fontSize: 10,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      whiteSpace: 'nowrap',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  // ── Loading / error states ───────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, color: '#ff2d55', letterSpacing: '0.1em' }}>VILLAIN</div>
      <div style={{ color: '#444', fontFamily: "'Space Mono',monospace", fontSize: 12, letterSpacing: '0.1em' }}>LOADING INVENTORY...</div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16, padding: 32 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, color: '#ff2d55', letterSpacing: '0.1em' }}>VILLAIN</div>
      <div style={{ color: '#ff2d55', fontFamily: "'Space Mono',monospace", fontSize: 12, background: 'rgba(255,45,85,0.1)', padding: '12px 20px', borderRadius: 8, maxWidth: 500, textAlign: 'center' }}>{error}</div>
      <button onClick={fetchData} style={{ background: '#ff2d55', border: 'none', borderRadius: 8, padding: '10px 24px', color: '#fff', fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: '0.1em', cursor: 'pointer' }}>RETRY</button>
    </div>
  );

  // ── Dashboard ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,45,85,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 34, color: '#ff2d55', letterSpacing: '0.1em' }}>VILLAIN</span>
          <span style={{ fontFamily: "'Space Mono',monospace", fontSize: 10, color: '#333', letterSpacing: '0.18em' }}>INVENTORY REVIEW</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {criticalCnt > 0 && (
            <span style={{ background: 'rgba(255,45,85,0.15)', border: '1px solid rgba(255,45,85,0.3)', color: '#ff2d55', fontFamily: "'Space Mono',monospace", fontSize: 11, padding: '5px 12px', borderRadius: 6, fontWeight: 700 }}>
              ⚠ {criticalCnt} CRITICAL SKU{criticalCnt !== 1 ? 'S' : ''}
            </span>
          )}
          {lastUpdated && <span style={{ color: '#333', fontFamily: "'Space Mono',monospace", fontSize: 10 }}>updated {lastUpdated}</span>}
          <button onClick={fetchData} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 14px', color: '#555', fontSize: 11, cursor: 'pointer', fontFamily: "'Space Mono',monospace" }}>↻ REFRESH</button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 12, padding: '20px 28px', flexWrap: 'wrap' }}>
        <Card label="Total SOH"          value={fmt(totalSOH)}          sub={`MRP: ${fmt(totalMRP)} · SOR: ${fmt(totalSOR)} · B2C: ${fmt(totalB2C)}`} accent="#ff2d55" />
        <Card label="Avg DOC"            value={fmtDoc(avgDoc)}         sub={`across ${skus.length} SKUs`} accent="#f5c518" />
        <Card label="Jun'26 MTD Sales"   value={fmt(totalMTD)}          sub="month to date" accent="#00e676" />
        <Card label="Avg Monthly Sales"  value={fmt(Math.round(totalAvg))} sub="Apr + May average" accent="#7c5cfc" />
      </div>

      {/* Main: table + chat */}
      <div style={{ display: 'flex', flex: 1, padding: '0 28px 28px', gap: 20, minHeight: 0 }}>

        {/* Table */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search style..."
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 14px', color: '#e8e8e8', fontSize: 13, outline: 'none', fontFamily: 'inherit', width: 220 }}
            />
            <span style={{ color: '#333', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{filtered.length} of {skus.length} SKUs</span>
          </div>

          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <TH label="Style"      col="style"    />
                  <TH label="MRP SOH"    col="mrp"      right />
                  <TH label="SOR SOH"    col="sor"      right />
                  <TH label="B2C SOH"    col="b2c"      right />
                  <TH label="Total SOH"  col="totalSOH" right />
                  <TH label="Apr Sales"  col="apr"      right />
                  <TH label="May Sales"  col="may"      right />
                  <TH label="Jun MTD"    col="mtd"      right />
                  <TH label="Avg Sales"  col="avg"      right />
                  <TH label="DOC"        col="doc"      right />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const st = docStatus(r.doc);
                  return (
                    <tr key={r.style} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,45,85,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                    >
                      <td style={{ padding: '9px 14px', color: '#e8e8e8', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.style}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#777', fontFamily: "'Space Mono',monospace", fontSize: 12 }}>{fmt(r.mrp)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#777', fontFamily: "'Space Mono',monospace", fontSize: 12 }}>{fmt(r.sor)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#777', fontFamily: "'Space Mono',monospace", fontSize: 12 }}>{fmt(r.b2c)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#e8e8e8', fontFamily: "'Space Mono',monospace", fontSize: 12, fontWeight: 600 }}>{fmt(r.totalSOH)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#777', fontFamily: "'Space Mono',monospace", fontSize: 12 }}>{fmt(r.apr)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#777', fontFamily: "'Space Mono',monospace", fontSize: 12 }}>{fmt(r.may)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#777', fontFamily: "'Space Mono',monospace", fontSize: 12 }}>{fmt(r.mtd)}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right', color: '#777', fontFamily: "'Space Mono',monospace", fontSize: 12 }}>{fmt(Math.round(r.avg))}</td>
                      <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                        <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 6, fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
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
          <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
            {[['STOCKOUT', '#ff2d55'], ['CRITICAL ≤15d', '#ff6b00'], ['LOW ≤30d', '#f5c518'], ['HEALTHY ≤60d', '#00e676'], ['OVERSTOCK >60d', '#7c5cfc']].map(([l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Space Mono',monospace", fontSize: 10, color: '#444' }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />{l}
              </div>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        <div style={{ width: 300, flexShrink: 0, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontFamily: "'Space Mono',monospace", fontSize: 10, color: '#ff2d55', letterSpacing: '0.14em' }}>
            ◈ AI ANALYST
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 200 }}>
            {chat.length === 0 && (
              <div style={{ color: '#333', fontSize: 11, fontFamily: "'Space Mono',monospace", lineHeight: 1.7 }}>
                Ask me anything about Villain's inventory...<br /><br />
                <span style={{ color: '#2a2a2a' }}>Try: "Which SKUs are critical?" · "What needs urgent replenishment?"</span>
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                background: m.role === 'user' ? 'rgba(255,45,85,0.14)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${m.role === 'user' ? 'rgba(255,45,85,0.25)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                padding: '8px 11px', fontSize: 12, lineHeight: 1.6, color: '#ccc',
                whiteSpace: 'pre-wrap'
              }}>{m.text}</div>
            ))}
            {chatLoading && <div style={{ alignSelf: 'flex-start', color: '#ff2d55', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>analyzing...</div>}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '9px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 7 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask the analyst..."
              style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '7px 10px', color: '#e8e8e8', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={toggleVoice} title="Voice input" style={{ background: listening ? 'rgba(255,45,85,0.25)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '7px 9px', color: listening ? '#ff2d55' : '#555', cursor: 'pointer', fontSize: 13 }}>🎙</button>
            <button onClick={sendChat} disabled={chatLoading || !input.trim()} style={{ background: '#ff2d55', border: 'none', borderRadius: 6, padding: '7px 13px', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700, opacity: chatLoading || !input.trim() ? 0.4 : 1 }}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}
