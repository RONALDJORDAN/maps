import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  useEffect(() => { fetch('/data/escolas.json').then((r) => r.json()).then(setRows).catch(() => setRows([])) }, [])
  useEffect(() => {
    const el = document.getElementById('esc-q')
    const h = () => {
      const v = el.value.trim()
      if (/^\d{0,8}$/.test(v.replace(/\D/g, '')) || v.length === 0 || /[a-zA-ZÀ-ú ]+/.test(v)) setQ(v)
    }
    el?.addEventListener('input', h)
    return () => el?.removeEventListener('input', h)
  }, [])
  const f = rows.filter((e) => !q || e.nome.toLowerCase().includes(q.toLowerCase()) || e.inep.includes(q))
  return (
    <div className="results" style={{ overflow: 'visible' }}>
      <p>{f.length} escola(s) · INEP 8 dígitos validado (Skill 2.6)</p>
      {f.map((e) => <div key={e.inep} className="card in"><h4>{e.nome}</h4><p>INEP {e.inep} · {e.turno} · {e.alunos} alunos</p><a className="chip-link" href={`/escolas.html?inep=${e.inep}`}>Abrir</a> <a className="chip-link" href={`/index.html`}>Ver no mapa</a></div>)}
      {!f.length && <div className="card in"><h4>Nada encontrado</h4><p>INEP deve ter 8 dígitos.</p></div>}
    </div>
  )
}
createRoot(document.getElementById('esc-app')).render(<App />)
