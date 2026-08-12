import { useState, useRef, useEffect } from 'react';

function fmt(v) {
  if (v === null || v === undefined || isNaN(v) || v === 0) return '—';
  return Math.round(v).toLocaleString('en-IN');
}
function fmtDoc(v) {
  if (!v || isNaN(v) || !isFinite(v) || v === 0) return '—';
  return Math.round(v) + 'd';
}
function docStatus(doc) {
  if (!doc || !isFinite(doc) || doc === 0) return { color: '#999', bg: '#f0f0f0' };
  if (doc <= 7)  return { color: '#c0001a', bg: '#ffe0e4' };
  if (doc <= 15) return { color: '#b94400', bg: '#ffe8d6' };
  if (doc <= 30) return { color: '#7a6000', bg: '#fff5c0' };
  if (doc <= 60) return { color: '#1a6e3c', bg: '#d4f5e2' };
  return           { color: '#4a2fa0', bg: '#ece8ff' };
}

function Card({ label, value, sub, accent }) {
  return (
    <div style={{ flex: 1, minWidth: 120, background: '#fff', border: '1px solid #e8e8e8', borderLeft: `3px solid ${accent}`, borderRadius: 8, padding: '10px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ color: '#999', fontSize: 9, fontFamily: "'Space Mono',monospace", letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#111', fontSize: 20, fontWeight: 700, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '0.04em', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color: '#bbb', fontSize: 10, marginTop: 3, fontFamily: "'Space Mono',monospace" }}>{sub}</div>}
    </div>
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
      setData({ b2b: json.b2b, b2c: json.b2c });
      setLastUpdated(new Date(json.updatedAt).toLocaleTimeString('en-IN'));
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  const skus = activeTab === 'b2b' ? data.b2b : data.b2c;

  // Summary stats
  const totalSOH      = skus.reduce((s, r) => s + r.totalSOH, 0);
  const totalGGN      = skus.reduce((s, r) => s + r.sohGGN, 0);
  const totalBHW      = skus.reduce((s, r) => s + r.sohBHW, 0);
  const totalBLR      = skus.reduce((s, r) => s + r.sohBLR, 0);
  const totalDRR      = skus.reduce((s, r) => s + r.totalDRR, 0);
  const totalIntransit= skus.reduce((s, r) => s + r.totalIntransit, 0);
  const avgDOC        = totalDRR > 0 ? totalSOH / totalDRR : null;
  const criticalCnt   = skus.filter(r => r.totalDOC > 0 && r.totalDOC <= 15).length;
  const stockoutCnt   = skus.filter(r => r.totalSOH === 0).length;

  const filtered = [...skus]
    .filter(r => r.style.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (sortCol === 'style') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      if (av === 0) av = sortDir === 'asc' ? Infinity : -Infinity;
      if (bv === 0) bv = sortDir === 'asc' ? Infinity : -Infinity;
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
      padding: '8px 12px', textAlign: right ? 'right' : 'left',
      color: sortCol === col ? '#e0001a' : '#555',
      cursor: 'pointer', userSelect: 'none',
      fontFamily: "'Space Mono',monospace", fontSize: 10,
      letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap',
      borderBottom: '2px solid #e8e8e8', background: '#fafafa',
      position: 'sticky', top: 0, zIndex: 1,
    }}>
      {label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, background: '#f5f5f7' }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, color: '#e0001a', letterSpacing: '0.1em' }}>VILLAIN</div>
      <div style={{ color: '#aaa', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>LOADING INVENTORY...</div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 12, padding: 32, background: '#f5f5f7' }}>
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
          {stockoutCnt > 0 && <span style={{ background: '#ffe0e4', border: '1px solid #ffb3bb', color: '#c0001a', fontFamily: "'Space Mono',monospace", fontSize: 10, padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>⚠ {stockoutCnt} STOCKOUT</span>}
          {criticalCnt > 0 && <span style={{ background: '#fff5c0', border: '1px solid #ffe066', color: '#7a6000', fontFamily: "'Space Mono',monospace", fontSize: 10, padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>⚠ {criticalCnt} CRITICAL</span>}
          {lastUpdated && <span style={{ color: '#bbb', fontFamily: "'Space Mono',monospace", fontSize: 9 }}>updated {lastUpdated}</span>}
          <button onClick={fetchData} style={{ background: '#f5f5f7', border: '1px solid #e0e0e0', borderRadius: 6, padding: '4px 12px', color: '#888', fontSize: 10, cursor: 'pointer', fontFamily: "'Space Mono',monospace" }}>↻ REFRESH</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, padding: '0 20px', background: '#fff', borderBottom: '1px solid #e0e0e0', flexShrink: 0 }}>
        {['b2b', 'b2c'].map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setSearch(''); setSortCol('totalDOC'); setSortDir('asc'); }}
            style={{ padding: '10px 20px', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid #e0001a' : '2px solid transparent', color: activeTab === tab ? '#e0001a' : '#999', fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', textTransform: 'uppercase', marginBottom: -1 }}>
            {tab === 'b2b' ? 'B2B Summary' : 'B2C Summary'}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', gap: 10, padding: '10px 20px', flexShrink: 0, flexWrap: 'wrap' }}>
        <Card label="Total SOH"   value={fmt(totalSOH)}    sub={`GGN: ${fmt(totalGGN)} · BHW: ${fmt(totalBHW)} · BLR: ${fmt(totalBLR)}`} accent="#e0001a" />
        <Card label="Avg DOC"     value={fmtDoc(avgDOC)}   sub={`across ${skus.length} SKUs`} accent="#f5a623" />
        <Card label="Total DRR"   value={fmt(totalDRR)}    sub="daily run rate" accent="#27ae60" />
        <Card label="Intransit"   value={fmt(totalIntransit)} sub="STN + Factory" accent="#6c47ff" />
      </div>

      {/* Main: table + chat */}
      <div style={{ display: 'flex', flex: 1, padding: '0 20px 16px', gap: 14, minHeight: 0 }}>

        {/* Table */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexShrink: 0 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search style..."
              style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, padding: '6px 12px', color: '#333', fontSize: 12, outline: 'none', fontFamily: 'inherit', width: 200 }} />
            <span style={{ color: '#bbb', fontFamily: "'Space Mono',monospace", fontSize: 10 }}>{filtered.length} of {skus.length} SKUs</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <TH label="Style"         col="style"          />
                  <TH label="Channel"        col="channelTag"     />
                  <TH label="Total SOH"      col="totalSOH"       right />
                  <TH label="GGN"            col="sohGGN"         right />
                  <TH label="BHW"            col="sohBHW"         right />
                  <TH label="BLR"            col="sohBLR"         right />
                  <TH label="Total DRR"      col="totalDRR"       right />
                  <TH label="Total DOC"      col="totalDOC"       right />
                  <TH label="Intransit"      col="totalIntransit" right />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const st = docStatus(r.totalDOC);
                  return (
                    <tr key={r.style + i}
                      style={{ background: i % 2 === 0 ? '#fff' : '#fafafa', borderBottom: '1px solid #f0f0f0' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#fff5f5'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'}
                    >
                      <td style={{ padding: '8px 12px', color: '#111', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.style}</td>
                      <td style={{ padding: '8px 12px', color: '#888', fontSize: 11 }}>{r.channelTag || '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#111', fontFamily: "'Space Mono',monospace", fontSize: 11, fontWeight: 600 }}>{fmt(r.totalSOH)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.sohGGN)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.sohBHW)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.sohBLR)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.totalDRR)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <span style={{ background: st.bg, color: st.color, padding: '2px 8px', borderRadius: 5, fontFamily: "'Space Mono',monospace", fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {fmtDoc(r.totalDOC)}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#666', fontFamily: "'Space Mono',monospace", fontSize: 11 }}>{fmt(r.totalIntransit)}</td>
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
            ◈ AI ANALYST · {activeTab.toUpperCase()}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {chat.length === 0 && (
              <div style={{ color: '#ccc', fontSize: 11, fontFamily: "'Space Mono',monospace", lineHeight: 1.7 }}>
                Ask about {activeTab.toUpperCase()} inventory...<br /><br />
                <span style={{ color: '#ddd' }}>"Which SKUs are critical?" · "Low DOC items?" · "Stockout risk?"</span>
              </div>
            )}
            {chat.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%',
                background: m.role === 'user' ? '#ffe0e4' : '#f5f5f7',
                border: `1px solid ${m.role === 'user' ? '#ffb3bb' : '#e8e8e8'}`,
                borderRadius: m.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                padding: '8px 10px', fontSize: 12, lineHeight: 1.6,
                color: m.role === 'user' ? '#c0001a' : '#333', whiteSpace: 'pre-wrap'
              }}>{m.text}</div>
            ))}
            {chatLoading && <div style={{ alignSelf: 'flex-start', color: '#e0001a', fontFamily: "'Space Mono',monospace", fontSize: 10 }}>analyzing...</div>}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '8px 10px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 6, flexShrink: 0 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask the analyst..."
              style={{ flex: 1, background: '#f5f5f7', border: '1px solid #e0e0e0', borderRadius: 6, padding: '7px 10px', color: '#333', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={toggleVoice} style={{ background: listening ? '#ffe0e4' : '#f5f5f7', border: '1px solid #e0e0e0', borderRadius: 6, padding: '7px 8px', color: listening ? '#e0001a' : '#aaa', cursor: 'pointer', fontSize: 12 }}>🎙</button>
            <button onClick={sendChat} disabled={chatLoading || !input.trim()} style={{ background: '#e0001a', border: 'none', borderRadius: 6, padding: '7px 12px', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700, opacity: chatLoading || !input.trim() ? 0.4 : 1 }}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}
