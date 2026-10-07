import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function App() {
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  useEffect(() => { fetch('/data/municipios.json').then((r) => r.json()).then(setRows).catch(() => setRows([])) }, [])
  useEffect(() => {
    const el = document.getElementById('mun-q')
    const h = () => setQ(el.value.trim())
    el?.addEventListener('input', h)
    return () => el?.removeEventListener('input', h)
  }, [])
  const f = rows.filter((m) => !q || m.nome.toLowerCase().includes(q.toLowerCase()) || m.ibge.includes(q))
  return (
    <div>
      <p>{f.length} município(s) · contratos, turnos e volumetria (Skill 2.6)</p>
      <table className="table"><thead><tr><th>Município</th><th>IBGE</th><th>Contrato</th><th>Volumetria</th></tr></thead>
      <tbody>{f.map((m) => <tr key={m.ibge}><td>{m.nome}/{m.uf}</td><td>{m.ibge}</td><td>{m.contrato}</td><td>{m.volumetria}</td></tr>)}
      {!f.length && <tr><td colSpan="4">Nada encontrado — tente “Pão de Açúcar”.</td></tr>}</tbody></table>
    </div>
  )
}
createRoot(document.getElementById('mun-app')).render(<App />)
