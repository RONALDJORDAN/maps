import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  const [mun, setMun] = useState([])
  const [esc, setEsc] = useState([])
  useEffect(() => {
    fetch('/data/municipios.json').then((r) => r.json()).then(setMun).catch(() => {})
    fetch('/data/escolas.json').then((r) => r.json()).then(setEsc).catch(() => {})
  }, [])
  useEffect(() => {
    if (!window.Chart || !esc.length) return
    const ctx = document.getElementById('ch1')
    if (!ctx || ctx._c) return
    const byTurn = {}
    esc.forEach((e) => { byTurn[e.turno] = (byTurn[e.turno] || 0) + e.alunos })
    ctx._c = new window.Chart(ctx, { type: 'bar', data: { labels: Object.keys(byTurn), datasets: [{ label: 'Alunos por turno', data: Object.values(byTurn) }] }, options: { animation: { duration: 700, easing: 'easeOutQuart' } } })
  }, [esc])
  const total = esc.reduce((a, e) => a + (e.alunos || 0), 0)
  return (
    <div>
      <div className="kpis" style={{ padding: 0, marginBottom: 12 }}>
        <div className="kpi"><b>{mun.length}</b><span>Municípios</span></div>
        <div className="kpi"><b>{esc.length}</b><span>Escolas</span></div>
        <div className="kpi"><b>{total}</b><span>Alunos</span></div>
      </div>
      <div className="card in"><h4>Alunos por turno</h4><canvas id="ch1" height="120"></canvas></div>
      <p><button className="btn" onClick={() => window.print()}>Exportar PDF (print)</button></p>
    </div>
  )
}
createRoot(document.getElementById('dash-app')).render(<App />)
